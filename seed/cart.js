// seed-carts.js
// Usage: npm install mysql2 @faker-js/faker && node seed-carts.js

const { faker } = require("@faker-js/faker");
const { randomUUID } = require("crypto");
const mysql = require("mysql2/promise");

const DB_CONFIG = {
  host: "localhost",
  user: "root",
  password: "root",
  database: "toolshop",
};

async function seedCarts(count = 50) {
  const conn = await mysql.createConnection(DB_CONFIG);
  const now = new Date();

  const rows = [];
  for (let i = 0; i < count; i++) {
    // id CHAR(26)
    const id = randomUUID().replace(/-/g, "").slice(0, 26);
    // additional_discount_percentage lưu dưới dạng chuỗi, 0–100 với 2 chữ số
    const additional_discount_percentage = faker.number
      .float({ min: 0, max: 100, precision: 0.01 })
      .toFixed(2);
    // tax và lng là DECIMAL(8,2)
    const lat = faker.number.float({ min: 0, max: 500, precision: 0.01 });
    const lng = faker.number.float({ min: 0, max: 1000, precision: 0.01 });

    rows.push([
      id,
      additional_discount_percentage,
      lat,
      lng,
      now, // created_at
      now, // updated_at
    ]);
  }

  const sql = `
    INSERT INTO carts
      (id, additional_discount_percentage, lat, lng, created_at, updated_at)
    VALUES ?
  `;

  const [result] = await conn.query(sql, [rows]);
  console.log(`✅ Đã chèn ${result.affectedRows} carts.`);
  await conn.end();
}

seedCarts().catch((err) => {
  console.error("❌ Lỗi khi seed carts:", err);
  process.exit(1);
});
