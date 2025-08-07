// seed-cart-items.js
// Usage: npm install mysql2 @faker-js/faker && node seed-cart-items.js

const { faker } = require("@faker-js/faker");
const { randomUUID } = require("crypto");
const mysql = require("mysql2/promise");

const DB_CONFIG = {
  host: "localhost",
  user: "root",
  password: "root",
  database: "toolshop",
};

async function seedCartItems(count = 200) {
  const conn = await mysql.createConnection(DB_CONFIG);

  // 1. Lấy danh sách carts và products
  const [carts] = await conn.query(`SELECT id FROM carts`);
  const [products] = await conn.query(`SELECT id FROM products`);

  if (!carts.length || !products.length) {
    console.error("❌ Cần seed trước carts và products!");
    process.exit(1);
  }

  const cartIds = carts.map((r) => r.id);
  const productIds = products.map((r) => r.id);

  // 2. Sinh các bản ghi, đảm bảo (cart_id, product_id) unique
  const seen = new Set();
  const rows = [];
  const now = new Date();

  while (rows.length < count) {
    const cart_id = cartIds[Math.floor(Math.random() * cartIds.length)];
    const product_id =
      productIds[Math.floor(Math.random() * productIds.length)];
    const key = `${cart_id}::${product_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // 3. Sinh dữ liệu chi tiết
    const id = randomUUID().replace(/-/g, "").slice(0, 26);
    const quantity = faker.number.int({ min: 1, max: 10 });
    const discount_percentage = faker.number.float({
      min: 0,
      max: 100,
      precision: 0.01,
    });

    rows.push([
      id,
      quantity,
      discount_percentage,
      cart_id,
      product_id,
      now, // created_at
      now, // updated_at
    ]);
  }

  // 4. Chèn vào database
  const sql = `
    INSERT INTO cart_items
      (id, quantity, discount_percentage, cart_id, product_id, created_at, updated_at)
    VALUES ?
  `;

  const [result] = await conn.query(sql, [rows]);
  console.log(`✅ Đã chèn ${result.affectedRows} cart_items.`);
  await conn.end();
}

seedCartItems().catch((err) => {
  console.error("❌ Lỗi khi seed cart_items:", err);
  process.exit(1);
});
