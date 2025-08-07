// seed-invoice-items.js
// Usage: npm install mysql2 @faker-js/faker && node seed-invoice-items.js

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
 * Tạo ID duy nhất 26 ký tự
 */
function generateId() {
  return randomUUID().replace(/-/g, "").slice(0, 26);
}

/**
 * Tạo dữ liệu invoice items cho một invoice
 */
function createInvoiceItemsForInvoice(invoiceId, productMap, productIds) {
  const itemCount = faker.number.int({ min: 1, max: 5 });
  const used = new Set();
  const items = [];
  const now = new Date();

  console.log(
    `  📦 Tạo ${itemCount} items cho invoice ${invoiceId.slice(0, 8)}...`
  );

  while (used.size < itemCount) {
    // Chọn product ngẫu nhiên, đảm bảo unique trong cùng invoice
    const productId = faker.helpers.arrayElement(productIds);
    if (used.has(productId)) continue;
    used.add(productId);

    const unitPrice = productMap[productId];
    const quantity = faker.number.int({ min: 1, max: 10 });
    const discountPercentage = faker.number.float({
      min: 0,
      max: 30,
      precision: 0.01,
    });

    // Tính giá sau giảm giá
    const discountedPrice = parseFloat(
      (unitPrice * (1 - discountPercentage / 100)).toFixed(2)
    );

    const item = [
      generateId(),
      unitPrice.toFixed(2),
      quantity,
      discountPercentage.toFixed(2),
      discountedPrice.toFixed(2),
      now,
      now,
      invoiceId,
      productId,
    ];

    items.push(item);

    console.log(
      `    ✓ Product ${productId.slice(
        0,
        8
      )}: ${quantity}x ${unitPrice} (${discountPercentage.toFixed(
        1
      )}% off) = ${(discountedPrice * quantity).toFixed(2)}`
    );
  }

  return items;
}

/**
 * Cập nhật subtotal và total của invoices dựa trên invoice_items
 */
async function updateInvoiceTotals(conn) {
  console.log("\n🔄 Đang cập nhật subtotal và total cho invoices...");

  try {
    const [totals] = await conn.query(`
      SELECT
        invoice_id,
        SUM(unit_price * quantity) AS subtotal,
        SUM(discounted_price * quantity) AS total,
        COUNT(*) as item_count
      FROM invoice_items
      GROUP BY invoice_id
    `);

    console.log(`📊 Tìm thấy ${totals.length} invoices cần cập nhật`);

    let updatedCount = 0;
    for (const t of totals) {
      // Convert to number để đảm bảo có thể gọi .toFixed()
      const subtotal = parseFloat(t.subtotal);
      const total = parseFloat(t.total);

      await conn.query(
        `UPDATE invoices SET subtotal = ?, total = ? WHERE id = ?`,
        [subtotal.toFixed(2), total.toFixed(2), t.invoice_id]
      );

      console.log(
        `  ✓ Invoice ${t.invoice_id.slice(0, 8)}: ${
          t.item_count
        } items, subtotal=${subtotal.toFixed(2)}, total=${total.toFixed(2)}`
      );
      updatedCount++;
    }

    console.log(
      `✅ Đã cập nhật subtotal và total cho ${updatedCount} invoices.`
    );
    return updatedCount;
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật invoice totals:", error.message);
    throw error;
  }
}

/**
 * Hàm chính để seed invoice items
 */
async function seedInvoiceItems() {
  let conn;

  try {
    console.log("🚀 Bắt đầu seed invoice items...");

    // 1. Kết nối database
    console.log("📡 Đang kết nối database...");
    conn = await mysql.createConnection(DB_CONFIG);
    console.log("✅ Kết nối database thành công");

    // 2. Kiểm tra và lấy dữ liệu dependencies
    console.log("\n🔍 Đang kiểm tra dữ liệu dependencies...");

    const [invoices] = await conn.query(`SELECT id FROM invoices`);
    const [products] = await conn.query(`SELECT id, price FROM products`);

    if (!invoices.length) {
      throw new Error(
        "❌ Bảng invoices chưa có dữ liệu! Hãy seed invoices trước."
      );
    }

    if (!products.length) {
      throw new Error(
        "❌ Bảng products chưa có dữ liệu! Hãy seed products trước."
      );
    }

    console.log(
      `✅ Tìm thấy ${invoices.length} invoices và ${products.length} products`
    );

    // 3. Chuẩn bị dữ liệu products
    console.log("\n⚙️ Đang chuẩn bị dữ liệu products...");
    const productMap = {};
    products.forEach((p) => {
      productMap[p.id] = parseFloat(p.price);
    });
    const productIds = Object.keys(productMap);
    console.log(`✅ Đã chuẩn bị ${productIds.length} products`);

    // 4. Tạo invoice items
    console.log("\n📦 Đang tạo invoice items...");
    const allItems = [];
    let totalItems = 0;

    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      console.log(
        `\n[${i + 1}/${invoices.length}] Invoice: ${invoice.id.slice(0, 8)}...`
      );

      const items = createInvoiceItemsForInvoice(
        invoice.id,
        productMap,
        productIds
      );
      allItems.push(...items);
      totalItems += items.length;
    }

    console.log(`\n📊 Tổng cộng đã tạo ${totalItems} invoice items`);

    // 5. Chèn vào database
    console.log("\n💾 Đang chèn dữ liệu vào database...");
    const sql = `
      INSERT INTO invoice_items
        (id, unit_price, quantity, discount_percentage, discounted_price,
         created_at, updated_at, invoice_id, product_id)
      VALUES ?
    `;

    const [result] = await conn.query(sql, [allItems]);
    console.log(`✅ Đã chèn ${result.affectedRows} invoice_items vào database`);

    // 6. Cập nhật invoice totals
    const updatedInvoices = await updateInvoiceTotals(conn);

    // 7. Thống kê cuối cùng
    console.log("\n📈 THỐNG KÊ CUỐI CÙNG:");
    console.log(`  • Invoice items đã tạo: ${result.affectedRows}`);
    console.log(`  • Invoices đã cập nhật: ${updatedInvoices}`);
    console.log(
      `  • Trung bình items/invoice: ${(
        result.affectedRows / updatedInvoices
      ).toFixed(1)}`
    );

    console.log("\n🎉 Hoàn thành seed invoice items thành công!");
  } catch (error) {
    console.error("\n❌ LỖI TRONG QUÁ TRÌNH SEED:");
    console.error(`   Message: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    process.exit(1);
  } finally {
    if (conn) {
      await conn.end();
      console.log("📡 Đã đóng kết nối database");
    }
  }
}

// Chạy script
if (require.main === module) {
  seedInvoiceItems().catch((err) => {
    console.error("❌ Lỗi không mong muốn:", err);
    process.exit(1);
  });
}

module.exports = { seedInvoiceItems };
