// seed-users.js
// Usage: npm install mysql2 @faker-js/faker && node seed-users.js

const { faker } = require("@faker-js/faker");
const { randomUUID } = require("crypto");
const mysql = require("mysql2/promise");

const DB_CONFIG = {
  host: "localhost",
  user: "root",
  password: "root",
  database: "toolshop",
};

async function seedUsers(count = 100) {
  const conn = await mysql.createConnection(DB_CONFIG);

  const rows = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    // Tạo id 26 ký tự từ UUID
    const rawUuid = randomUUID().replace(/-/g, "");
    const id26 = rawUuid.slice(0, 26);

    rows.push([
      id26, // id CHAR(26)
      // faker.datatype.uuid(), // uid
      null, // provider
      faker.person.firstName(), // first_name
      faker.person.lastName(), // last_name
      faker.location.streetAddress(), // street
      faker.location.city(), // city
      faker.location.state(), // state
      faker.location.country().slice(0, 40), // country
      faker.location.zipCode(), // postal_code
      faker.phone.number(), // phone
      "2000-01-01", // dob
      faker.internet.email(), // email
      "$2y$10$2BcSndh1CE29QpWRUer7Bu15OHNzb3qM2D8sRSJ6P1u3kDa7H2bkK", // password
      "user", // role
      1, // enabled
      0, // failed_login_attempts
      null, // totp_secret
      0, // totp_enabled
      null, // totp_verified_at
      now, // created_at
      now, // updated_at
    ]);
  }

  const sql = `
    INSERT INTO users
      ( id, provider,
       first_name, last_name, street, city, state, country, postal_code,
       phone, dob, email, password, role,
       enabled, failed_login_attempts, totp_secret, totp_enabled, totp_verified_at,
       created_at, updated_at)
    VALUES ?
  `;

  const [result] = await conn.query(sql, [rows]);
  console.log(`✅ Đã chèn \${result.affectedRows} users vào bảng users.`);
  await conn.end();
}

seedUsers().catch((err) => {
  console.error("❌ Lỗi khi seed users:", err);
  process.exit(1);
});

seedUsers().catch((err) => {
  console.error("❌ Lỗi khi seed users:", err);
  process.exit(1);
});
