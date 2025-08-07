// seed-products-data.js
// Usage: npm install dotenv @faker-js/faker googleapis mysql2 && node seed-products-data.js [SỐ_LƯỢNG_SẢN_PHẨM] [--no-images] [--no-database]
// Ví dụ: node seed-products-data.js 300
// Ví dụ (nhanh, không database): node seed-products-data.js 300 --no-images --no-database
// Ví dụ (chỉ CSV): node seed-products-data.js 300 --no-database

require("dotenv").config();
const { faker } = require("@faker-js/faker");
const { randomUUID } = require("crypto");
const fs = require("fs/promises");
const { google } = require("googleapis");
const mysql = require("mysql2/promise");
const path = require("path");

// Đọc arguments
const count = parseInt(process.argv[2] || "300", 10);
const skipImages = process.argv.includes("--no-images");
const skipDatabase = process.argv.includes("--no-database");

// Google API config
const API_KEY = process.env.GOOGLE_API_KEY;
const CX = process.env.GOOGLE_CX;
if (!skipImages && (!API_KEY || !CX)) {
  console.warn(
    "⚠️ Thiếu GOOGLE_API_KEY hoặc GOOGLE_CX trong .env - sẽ sử dụng placeholder images"
  );
}

// Database config
const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "toolshop",
};

const customsearch = skipImages ? null : google.customsearch("v1");

// Stats tracking
let stats = {
  urlTotal: 0,
  urlShortened: 0,
  imagesGenerated: 0,
  productsGenerated: 0,
  dbImagesInserted: 0,
  dbProductsInserted: 0,
  dbSkipped: 0,
};

// Helper functions
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureUrlLength(url, maxLength = 255) {
  stats.urlTotal++;

  if (url.length <= maxLength) {
    return url;
  }

  stats.urlShortened++;
  console.warn(
    `⚠️ URL rút ngắn: ${url.substring(0, 50)}... (${
      url.length
    } → ${maxLength} chars)`
  );

  const shortId = Math.random().toString(36).substring(2, 8);
  const safeUrl = `https://via.placeholder.com/800x600?text=${shortId}`;

  if (safeUrl.length > maxLength) {
    return `https://via.placeholder.com/400x300?text=${shortId}`;
  }

  return safeUrl;
}

function truncateString(str, maxLength) {
  if (!str) return str;
  return str.length > maxLength ? str.substring(0, maxLength) : str;
}

function toMysqlDateTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    ` ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function objectToCSVRow(obj) {
  const values = Object.values(obj).map((value) => {
    const stringValue = String(value || "");
    if (
      stringValue.includes(",") ||
      stringValue.includes('"') ||
      stringValue.includes("\n")
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  });
  return values.join(",");
}

// Read product names from CSV
async function readProductNamesFromCSV() {
  try {
    const csvPath = path.join(__dirname, "products_toolshop.csv");
    const csvContent = await fs.readFile(csvPath, "utf8");
    const lines = csvContent.split("\n").filter((line) => line.trim());

    const productNames = lines
      .slice(1)
      .map((line) => line.trim())
      .filter((name) => name);

    console.log(`✅ Đã đọc ${productNames.length} tên sản phẩm từ CSV`);
    return productNames;
  } catch (error) {
    console.error("❌ Lỗi khi đọc file CSV:", error.message);
    process.exit(1);
  }
}

// Fetch image for product
async function fetchImageFor(productName) {
  if (skipImages) {
    return {
      url: `https://via.placeholder.com/800x600?text=${encodeURIComponent(
        productName.substring(0, 10)
      )}`,
      source: "Placeholder",
    };
  }

  try {
    if (customsearch && API_KEY && CX) {
      const res = await customsearch.cse.list({
        auth: API_KEY,
        cx: CX,
        q: `${productName} tool`,
        searchType: "image",
        num: 1,
        safe: "high",
      });

      const items = res.data.items;
      if (items && items.length) {
        let imageUrl = items[0].link;

        if (imageUrl.length > 255) {
          console.warn(
            `⚠️ URL quá dài cho "${productName}" (${imageUrl.length} chars), sử dụng placeholder`
          );
          const shortName =
            productName.length > 10
              ? productName.substring(0, 10)
              : productName;
          return {
            url: ensureUrlLength(
              `https://via.placeholder.com/800x600?text=${encodeURIComponent(
                shortName
              )}`
            ),
            source: "Placeholder",
          };
        }

        return {
          url: imageUrl,
          source: "Google Custom Search",
        };
      }
    }
  } catch (err) {
    console.warn(`⚠️ Google API failed for "${productName}":`, err.message);
  }

  const shortName =
    productName.length > 10 ? productName.substring(0, 10) : productName;
  return {
    url: ensureUrlLength(
      `https://via.placeholder.com/800x600?text=${encodeURIComponent(
        shortName
      )}`
    ),
    source: "Placeholder",
  };
}

// Database insertion functions
async function validateAndFixImageRow(imageData, index) {
  try {
    const [
      id,
      by_name,
      by_url,
      source_name,
      source_url,
      file_name,
      title,
      created_at,
      updated_at,
    ] = imageData;

    const fixedRow = [
      truncateString(id, 255),
      truncateString(by_name, 220),
      truncateString(by_url, 220),
      truncateString(source_name, 100),
      truncateString(source_url, 255),
      truncateString(file_name, 255),
      truncateString(title, 220),
      created_at,
      updated_at,
    ];

    if (fixedRow[4] && fixedRow[4].length > 255) {
      console.warn(
        `⚠️ Row ${index + 1}: URL quá dài (${
          fixedRow[4].length
        } chars), skipping...`
      );
      return null;
    }

    return fixedRow;
  } catch (error) {
    console.warn(`⚠️ Row ${index + 1}: Error validating data, skipping...`);
    return null;
  }
}

async function insertImageRowsSafely(conn, imageRows) {
  let successCount = 0;
  let skipCount = 0;

  console.log(`⏳ Inserting ${imageRows.length} image rows...`);

  for (let i = 0; i < imageRows.length; i++) {
    try {
      const validRow = validateAndFixImageRow(imageRows[i], i);

      if (!validRow) {
        skipCount++;
        continue;
      }

      await conn.query(
        `INSERT INTO product_images
           (id, by_name, by_url, source_name, source_url, file_name, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        validRow
      );

      successCount++;

      if ((i + 1) % 50 === 0) {
        console.log(
          `📊 Images: ${i + 1}/${
            imageRows.length
          } processed, ${successCount} inserted, ${skipCount} skipped`
        );
      }
    } catch (error) {
      skipCount++;
      console.warn(
        `⚠️ Image row ${i + 1}: SKIPPED - ${error.message.substring(0, 80)}...`
      );
      continue;
    }
  }

  return { successCount, skipCount };
}

async function insertProductRowsSafely(conn, productRows) {
  let successCount = 0;
  let skipCount = 0;

  console.log(`⏳ Inserting ${productRows.length} product rows...`);

  for (let i = 0; i < productRows.length; i++) {
    try {
      const row = productRows[i];

      if (row[1] && row[1].length > 220) {
        row[1] = row[1].substring(0, 220);
      }

      await conn.query(
        `INSERT INTO products
           (id, name, description, stock, price,
            is_location_offer, is_rental,
            created_at, updated_at,
            brand_id, category_id, product_image_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row
      );

      successCount++;

      if ((i + 1) % 50 === 0) {
        console.log(
          `📊 Products: ${i + 1}/${
            productRows.length
          } processed, ${successCount} inserted, ${skipCount} skipped`
        );
      }
    } catch (error) {
      skipCount++;
      console.warn(
        `⚠️ Product row ${i + 1}: SKIPPED - ${error.message.substring(
          0,
          80
        )}...`
      );
      continue;
    }
  }

  return { successCount, skipCount };
}

// Main function
async function main() {
  console.log(`🚀 Starting seed process...`);
  console.log(
    `🔧 Mode: ${skipImages ? "No images (fast)" : "With images (slow)"}`
  );
  console.log(`💾 Database: ${skipDatabase ? "Disabled" : "Enabled"}`);
  console.log(`📦 Target: ${count} products\n`);

  // 1. Read product names from CSV
  console.log("⏳ Reading product names from CSV...");
  const productNames = await readProductNamesFromCSV();

  if (productNames.length === 0) {
    console.error("❌ Không có tên sản phẩm nào trong file CSV");
    process.exit(1);
  }

  // 2. Fetch images for sample products
  const productImages = {};
  if (!skipImages) {
    console.log("⏳ Fetching images for sample products...");

    const sampleProducts = productNames.slice(
      0,
      Math.min(50, productNames.length)
    );
    for (const productName of sampleProducts) {
      const { url, source } = await fetchImageFor(productName);
      productImages[productName] = { url, source };
      console.log(`- ${productName} → ${url} (Source: ${source})`);
      await delay(100);
    }
    stats.imagesGenerated = Object.keys(productImages).length;
  } else {
    console.log("⚡ Skipping image fetching for faster generation...");
  }

  // 3. Generate products
  console.log(`\n⏳ Generating ${count} products...`);
  const products = [];
  const usedNames = new Set();

  // CSV Headers
  const csvHeaders = [
    "id",
    "name",
    "description",
    "price",
    "stock",
    "image_source_name",
    "image_source_url",
    "image_title",
    "image_file_name",
    "created_at",
    "updated_at",
  ];

  // Generate products with real images first
  const productsWithImages = Object.keys(productImages);
  console.log(`📸 Products with real images: ${productsWithImages.length}`);

  for (const productName of productsWithImages) {
    if (products.length >= count) break;
    if (usedNames.has(productName)) continue;
    usedNames.add(productName);

    const id26 = randomUUID().replace(/-/g, "").slice(0, 26);
    const description = `High-quality ${productName.toLowerCase()} suitable for ${faker.commerce
      .productMaterial()
      .toLowerCase()} work. Professional grade tool for both DIY enthusiasts and professionals.`;
    const price = parseFloat(faker.commerce.price(5, 500, 2));
    const stock = faker.number.int({ min: 0, max: 100 });

    const imageUrl = ensureUrlLength(productImages[productName].url);
    const imageSource = productImages[productName].source;

    products.push({
      id: id26,
      name: productName,
      description,
      price,
      stock,
      image_source_name: imageSource,
      image_source_url: imageUrl,
      image_title: productName,
      image_file_name: `${id26}.jpg`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // Generate remaining products
  while (products.length < count && usedNames.size < productNames.length) {
    const productName = faker.helpers.arrayElement(productNames);

    if (usedNames.has(productName)) continue;
    usedNames.add(productName);

    const id26 = randomUUID().replace(/-/g, "").slice(0, 26);
    const description = `High-quality ${productName.toLowerCase()} suitable for ${faker.commerce
      .productMaterial()
      .toLowerCase()} work. Professional grade tool for both DIY enthusiasts and professionals.`;
    const price = parseFloat(faker.commerce.price(5, 500, 2));
    const stock = faker.number.int({ min: 0, max: 100 });

    let imageUrl, imageSource;
    if (productImages[productName]) {
      imageUrl = productImages[productName].url;
      imageSource = productImages[productName].source;
    } else {
      const shortName =
        productName.length > 10 ? productName.substring(0, 10) : productName;
      imageUrl = `https://via.placeholder.com/800x600?text=${encodeURIComponent(
        shortName
      )}`;
      imageSource = "Placeholder";
    }

    imageUrl = ensureUrlLength(imageUrl);

    products.push({
      id: id26,
      name: productName,
      description,
      price,
      stock,
      image_source_name: imageSource,
      image_source_url: imageUrl,
      image_title: productName,
      image_file_name: `${id26}.jpg`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // Handle case where we need more products than unique names
  while (products.length < count) {
    const productName = faker.helpers.arrayElement(productNames);
    const id26 = randomUUID().replace(/-/g, "").slice(0, 26);
    const description = `High-quality ${productName.toLowerCase()} suitable for ${faker.commerce
      .productMaterial()
      .toLowerCase()} work. Professional grade tool for both DIY enthusiasts and professionals.`;
    const price = parseFloat(faker.commerce.price(5, 500, 2));
    const stock = faker.number.int({ min: 0, max: 100 });

    let imageUrl, imageSource;
    if (productImages[productName]) {
      imageUrl = productImages[productName].url;
      imageSource = productImages[productName].source;
    } else {
      const shortName =
        productName.length > 10 ? productName.substring(0, 10) : productName;
      imageUrl = `https://via.placeholder.com/800x600?text=${encodeURIComponent(
        shortName
      )}`;
      imageSource = "Placeholder";
    }

    imageUrl = ensureUrlLength(imageUrl);

    products.push({
      id: id26,
      name: productName,
      description,
      price,
      stock,
      image_source_name: imageSource,
      image_source_url: imageUrl,
      image_title: productName,
      image_file_name: `${id26}.jpg`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  stats.productsGenerated = products.length;

  // 4. Write CSV file
  console.log(`\n⏳ Writing CSV file...`);
  const csvFile = "products-final.csv";
  let csvContent = csvHeaders.join(",") + "\n";

  for (const product of products) {
    csvContent += objectToCSVRow(product) + "\n";
  }

  await fs.writeFile(csvFile, csvContent, "utf8");
  console.log(`✅ CSV written: ${csvFile}`);

  // 5. Insert into database
  if (!skipDatabase) {
    console.log(`\n⏳ Connecting to database...`);
    const conn = await mysql.createConnection(DB_CONFIG);

    try {
      // Get brands & categories
      const [brands] = await conn.query(`SELECT id FROM brands`);
      const [categories] = await conn.query(`SELECT id FROM categories`);
      if (!brands.length || !categories.length) {
        throw new Error("Cần seed trước bảng brands và categories!");
      }
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].id;

      await conn.beginTransaction();

      // Prepare image data
      const imageRows = products.map((p) => {
        const imgId = p.image_file_name.replace(/\.jpg$/i, "");
        const by_name = faker.person.firstName().slice(0, 220);
        const by_url = faker.internet.url().slice(0, 220);

        return [
          imgId,
          by_name,
          by_url,
          p.image_source_name,
          p.image_source_url,
          p.image_file_name,
          p.image_title.slice(0, 220),
          toMysqlDateTime(p.created_at),
          toMysqlDateTime(p.updated_at),
        ];
      });

      // Insert images
      const imageResult = await insertImageRowsSafely(conn, imageRows);
      stats.dbImagesInserted = imageResult.successCount;
      stats.dbSkipped += imageResult.skipCount;

      // Get successfully inserted image IDs
      const successfulImageIds = new Set();
      const [insertedImages] = await conn.query(
        "SELECT id FROM product_images"
      );
      insertedImages.forEach((row) => successfulImageIds.add(row.id));

      // Prepare product data (only for successful images)
      const productRows = products
        .filter((p) => {
          const imgId = p.image_file_name.replace(/\.jpg$/i, "");
          return successfulImageIds.has(imgId);
        })
        .map((p) => {
          const imgId = p.image_file_name.replace(/\.jpg$/i, "");
          return [
            p.id,
            p.name.slice(0, 220),
            p.description,
            p.stock,
            p.price,
            faker.number.int({ min: 0, max: 1 }),
            faker.number.int({ min: 0, max: 1 }),
            toMysqlDateTime(p.created_at),
            toMysqlDateTime(p.updated_at),
            pick(brands),
            pick(categories),
            imgId,
          ];
        });

      // Insert products
      const productResult = await insertProductRowsSafely(conn, productRows);
      stats.dbProductsInserted = productResult.successCount;
      stats.dbSkipped += productResult.skipCount;

      await conn.commit();
      console.log(`✅ Database insertion completed!`);
    } catch (err) {
      await conn.rollback();
      console.error("❌ Database error:", err.message);
    } finally {
      await conn.end();
    }
  }

  // 6. Print final summary
  console.log(`\n🎉 Seed process completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   📁 CSV Products: ${stats.productsGenerated}`);
  console.log(`   📸 Images fetched: ${stats.imagesGenerated}`);
  console.log(
    `   🔗 URLs processed: ${stats.urlTotal} (${stats.urlShortened} shortened)`
  );
  console.log(
    `   📦 Products unique: ${usedNames.size}/${productNames.length}`
  );

  if (!skipDatabase) {
    console.log(`   💾 DB Images inserted: ${stats.dbImagesInserted}`);
    console.log(`   💾 DB Products inserted: ${stats.dbProductsInserted}`);
    console.log(`   ⚠️  DB Rows skipped: ${stats.dbSkipped}`);
  }

  console.log(`\n📄 Output file: ${csvFile}`);
}

// Usage help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🚀 seed-products-data.js - Complete Product Data Seeder

Usage:
  node seed-products-data.js [COUNT] [OPTIONS]

Options:
  --no-images           Skip image fetching (faster)
  --no-database         Skip database insertion (CSV only)
  --help, -h           Show this help

Examples:
  node seed-products-data.js 300                 # Full process
  node seed-products-data.js 100 --no-images     # Fast, no real images
  node seed-products-data.js 500 --no-database   # CSV only, no DB
  node seed-products-data.js 50 --no-images --no-database  # Fastest

Environment Variables (.env):
  GOOGLE_API_KEY=your_api_key_here
  GOOGLE_CX=your_search_engine_id_here
  DB_HOST=localhost
  DB_USER=root
  DB_PASSWORD=root
  DB_NAME=toolshop
  `);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
