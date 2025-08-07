// seed-brands.js
// Usage: npm install mysql2 @faker-js/faker && node seed-brands.js

const { faker } = require("@faker-js/faker");
const { randomUUID } = require("crypto");
const mysql = require("mysql2/promise");

const DB_CONFIG = {
  host: "localhost",
  user: "root",
  password: "root",
  database: "toolshop",
};

async function seedBrands(count = 20) {
  const conn = await mysql.createConnection(DB_CONFIG);
  const now = new Date();
  const rows = [];

  for (let i = 0; i < count; i++) {
    // Tạo id 26 ký tự
    const fullUuid = randomUUID().replace(/-/g, "");
    const id26 = fullUuid.slice(0, 26);

    // Sinh tên brand và slug
    const name = faker.company.name();
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // bỏ ký tự không alnum
      .trim()
      .replace(/\s+/g, "-"); // thay spaces bằng '-'

    rows.push([id26, name, slug, now, now]);
  }

  const sql = `
    INSERT INTO brands
      (id, name, slug, created_at, updated_at)
    VALUES ?
  `;

  const [result] = await conn.query(sql, [rows]);
  console.log(`✅ Đã chèn \${result.affectedRows} brands vào bảng brands.`);
  await conn.end();
}

seedBrands().catch((err) => {
  console.error("❌ Lỗi khi seed brands:", err);
  process.exit(1);
});
