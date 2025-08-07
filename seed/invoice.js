// seed-invoices.js
// Usage: npm install mysql2 @faker-js/faker && node seed-invoices.js

const { faker } = require("@faker-js/faker");
const { randomUUID } = require("crypto");
const mysql = require("mysql2/promise");

const DB_CONFIG = {
  host: "localhost",
  user: "root",
  password: "root",
  database: "toolshop",
};

const STATUSES = [
  "AWAITING_FULFILLMENT",
  "ON_HOLD",
  "AWAITING_SHIPMENT",
  "SHIPPED",
  "COMPLETED",
];

async function seedInvoices(count = 100) {
  const conn = await mysql.createConnection(DB_CONFIG);

  // 1. Lấy user IDs
  const [users] = await conn.query(`SELECT id FROM users`);
  if (!users.length) {
    console.error("❌ Cần seed trước bảng users!");
    process.exit(1);
  }
  const userIds = users.map((r) => r.id);

  const rows = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    // id CHAR(26)
    const id = randomUUID().replace(/-/g, "").slice(0, 26);

    // invoice_date trong 12 tháng gần đây
    const invoice_date = faker.date.between({
      from: new Date(Date.now() - 365 * 24 * 3600 * 1000),
      to: new Date(),
    });

    // subtotal
    const subtotal = parseFloat(faker.finance.amount(100, 10000, 2));
    // percentage 0–15%
    const percentage = faker.number.float({ min: 0, max: 15, precision: 0.01 });
    const discount_amount = parseFloat(
      ((subtotal * percentage) / 100).toFixed(2)
    );

    // invoice_number: INV + YYYYMMDD + 6 digits
    const dt = invoice_date;
    const y = dt.getFullYear().toString().padStart(4, "0");
    const m = (dt.getMonth() + 1).toString().padStart(2, "0");
    const d = dt.getDate().toString().padStart(2, "0");
    const rnd6 = faker.number
      .int({ min: 0, max: 999999 })
      .toString()
      .padStart(6, "0");
    const invoice_number = `INV${y}${m}${d}${rnd6}`;

    // billing address
    const billing_street = faker.location.streetAddress().slice(0, 70);
    const billing_city = faker.location.city().slice(0, 40);
    const billing_state = faker.location.state().slice(0, 40);
    const billing_country = faker.location.country().slice(0, 40);
    const billing_postal_code = faker.location.zipCode().slice(0, 10);

    // status
    const status = faker.helpers.arrayElement(STATUSES);
    // status_message đôi khi empty
    const status_message = faker.datatype.boolean()
      ? ""
      : faker.lorem.sentence().slice(0, 255);

    // user_id
    const user_id = faker.helpers.arrayElement(userIds);

    rows.push([
      id,
      invoice_date,
      percentage.toFixed(2),
      discount_amount.toFixed(2),
      invoice_number,
      billing_street,
      billing_city,
      billing_state,
      billing_country,
      billing_postal_code,
      subtotal,
      (subtotal - discount_amount).toFixed(2),
      status,
      status_message,
      now,
      now,
      user_id,
    ]);
  }

  const sql = `
    INSERT INTO invoices
      (id, invoice_date,
       additional_discount_percentage, additional_discount_amount,
       invoice_number,
       billing_street, billing_city, billing_state, billing_country, billing_postal_code,
       subtotal, total,
       status, status_message,
       created_at, updated_at,
       user_id)
    VALUES ?
  `;

  const [result] = await conn.query(sql, [rows]);
  console.log(`✅ Đã chèn ${result.affectedRows} invoices.`);
  await conn.end();
}

seedInvoices(100).catch((err) => {
  console.error("❌ Lỗi khi seed invoices:", err);
  process.exit(1);
});
