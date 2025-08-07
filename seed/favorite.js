// seed-favorites.js
// Usage: npm install mysql2 @faker-js/faker && node seed-favorites.js

const { randomUUID } = require("crypto");
const mysql = require("mysql2/promise");

const DB_CONFIG = {
  host: "localhost",
  user: "root",
  password: "root",
  database: "toolshop",
};

async function seedFavorites(count = 200) {
  const conn = await mysql.createConnection(DB_CONFIG);

  // 1. Lấy danh sách user và product IDs
  const [users] = await conn.query(`SELECT id FROM users`);
  const [products] = await conn.query(`SELECT id FROM products`);

  if (!users.length || !products.length) {
    console.error("❌ Cần seed trước users và products!");
    process.exit(1);
  }

  const userIds = users.map((r) => r.id);
  const productIds = products.map((r) => r.id);

  // 2. Sinh các cặp (user_id, product_id) không trùng
  const seen = new Set();
  const rows = [];
  const now = new Date();

  while (rows.length < count) {
    const user_id = userIds[Math.floor(Math.random() * userIds.length)];
    const product_id =
      productIds[Math.floor(Math.random() * productIds.length)];
    const key = `${user_id}::${product_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // id CHAR(26)
    const id = randomUUID().replace(/-/g, "").slice(0, 26);

    rows.push([id, user_id, product_id, now, now]);
  }

  // 3. Thực hiện INSERT
  const sql = `
    INSERT INTO favorites
      (id, user_id, product_id, created_at, updated_at)
    VALUES ?
  `;

  const [result] = await conn.query(sql, [rows]);
  console.log(`✅ Đã chèn ${result.affectedRows} favorites.`);
  await conn.end();
}

seedFavorites(200).catch((err) => {
  console.error("❌ Lỗi khi seed favorites:", err);
  process.exit(1);
});
