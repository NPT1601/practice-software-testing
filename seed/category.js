// seed-categories.js
// Usage: npm install mysql2 @faker-js/faker && node seed-categories.js

const { faker } = require("@faker-js/faker");
const { randomUUID } = require("crypto");
const mysql = require("mysql2/promise");

const DB_CONFIG = {
  host: "localhost",
  user: "root",
  password: "root",
  database: "toolshop",
};

/**
 * Tạo slug an toàn từ name, tự động thêm hậu tố nếu slug đã tồn tại
 */
function makeUniqueSlug(name, slugCounts) {
  // basic slugify: lowercase, bỏ ký tự lạ, thay space => '-'
  const raw = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  if (!slugCounts[raw]) {
    slugCounts[raw] = 1;
    return raw;
  } else {
    slugCounts[raw]++;
    return `${raw}-${slugCounts[raw]}`;
  }
}

async function seedCategories() {
  const conn = await mysql.createConnection(DB_CONFIG);
  const now = new Date();

  // sẽ chứa số lần dùng mỗi base-slug
  const slugCounts = {};

  // 1. Tạo 5 parent categories
  const parents = [];
  for (let i = 0; i < 5; i++) {
    const fullUuid = randomUUID().replace(/-/g, "");
    const id26 = fullUuid.slice(0, 26);
    const name = faker.commerce.department();
    const slug = makeUniqueSlug(name, slugCounts);

    parents.push({ id: id26, name, slug });
  }

  // 2. Tạo 5 child categories, parent_id lấy ngẫu nhiên từ parents
  const children = [];
  for (let i = 0; i < 5; i++) {
    const fullUuid = randomUUID().replace(/-/g, "");
    const id26 = fullUuid.slice(0, 26);
    const name = faker.commerce.department();
    const slug = makeUniqueSlug(name, slugCounts);
    const parent = faker.helpers.arrayElement(parents);

    children.push({ id: id26, name, slug, parent_id: parent.id });
  }

  // 3. Gom tất cả lại và insert
  const rows = [
    ...parents.map((p) => [p.id, p.name, p.slug, now, now, null]),
    ...children.map((c) => [c.id, c.name, c.slug, now, now, c.parent_id]),
  ];

  const sql = `
    INSERT INTO categories
      (id, name, slug, created_at, updated_at, parent_id)
    VALUES ?
  `;

  const [result] = await conn.query(sql, [rows]);
  console.log(`✅ Đã chèn ${result.affectedRows} categories.`);
  await conn.end();
}

seedCategories().catch((err) => {
  console.error("❌ Lỗi khi seed categories:", err);
  process.exit(1);
});
