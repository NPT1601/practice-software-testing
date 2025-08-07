import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// Đọc dữ liệu test từ CSV
const csvFilePath = path.join(__dirname, "address_form_test_data.csv");
const records = parse(fs.readFileSync(csvFilePath), {
  columns: true,
  skip_empty_lines: true,
});

// Precondition 1: Đăng nhập
async function login(page) {
  // Navigate to the application
  await page.goto("http://localhost:4200/#/");

  // Login with customer account
  await page.locator('[data-test="nav-sign-in"]').click();
  await page
    .locator('[data-test="email"]')
    .fill("customer@practicesoftwaretesting.com");
  await page.locator('[data-test="password"]').fill("welcome01");
  await page.locator('[data-test="login-submit"]').click();

  // Wait for login to complete and redirect
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
}

// Precondition 2: Thêm sản phẩm vào cart và chuyển tới checkout
async function addProductToCartAndCheckout(page) {
  // Chuyển tới trang home (có sản phẩm)
  await page.goto("http://localhost:4200/#/");

  // Click vào sản phẩm đầu tiên để xem chi tiết
  await page.click('[data-test="product-1"]');

  // Thêm sản phẩm vào cart
  await page.click('button[data-test="add-to-cart"]');

  // Chuyển tới trang checkout (có 4 bước: cart, login, address, payment)
  await page.goto("http://localhost:4200/#/checkout");

  // Đợi trang checkout load
  await page.waitForLoadState("networkidle");

  // Nhấn proceed từ bước cart (bước 1) sang bước login (bước 2)
  await page.click('button[data-test="proceed-1"]');

  // Nếu đã đăng nhập, nhấn proceed để skip bước login và chuyển sang bước address (bước 3)
  await page.click('button[data-test="proceed-2"]');
}

for (const record of records) {
  test(`Address Form Filling: ${record.Title}`, async ({ page }) => {
    // Precondition 1: Đăng nhập
    await login(page);

    // Precondition 2: Thêm sản phẩm vào cart và chuyển tới checkout
    await addProductToCartAndCheckout(page);

    // Clear và điền form Address với các locator chính xác từ HTML thực tế
    await page.fill('input[data-test="address"]', record.Street || "");
    await page.fill('input[data-test="city"]', record.City || "");
    await page.fill('input[data-test="state"]', record.State || "");
    await page.fill('input[data-test="country"]', record.Country || "");
    await page.fill('input[data-test="postcode"]', record.Postal || "");

    // Đợi validation hoàn thành
    await page.waitForTimeout(2000);

    // Debug: In ra giá trị đã điền
    console.log(`Test: ${record.Title}`);
    console.log(`Street: "${record.Street}"`);
    console.log(`City: "${record.City}"`);
    console.log(`State: "${record.State}"`);
    console.log(`Country: "${record.Country}"`);
    console.log(`Postal: "${record.Postal}"`);

    // Kiểm tra kết quả mong đợi
    if (record.ExpectedResult.includes("Chuyển sang bước thanh toán")) {
      // Kiểm tra button proceed-3 có enabled không
      await expect(page.locator('button[data-test="proceed-3"]')).toBeEnabled();

      // Nhấn tiếp tục từ bước address (bước 3) sang bước payment (bước 4)
      await page.click('button[data-test="proceed-3"]');

      // Kiểm tra chuyển sang bước payment
      await expect(page.locator('button[data-test="finish"]')).toBeVisible();
      await expect(page.locator('h3:has-text("Payment")')).toBeVisible();
    } else if (record.ExpectedResult.includes("Hiển thị lỗi")) {
      // Kiểm tra button proceed-3 bị disabled
      await expect(
        page.locator('button[data-test="proceed-3"]')
      ).toBeDisabled();

      // Kiểm tra có ít nhất một thông báo lỗi
      await expect(page.locator(".alert-danger").first()).toBeVisible();
    } else if (record.ExpectedResult.includes("Lỗi")) {
      // Kiểm tra button proceed-3 bị disabled
      await expect(
        page.locator('button[data-test="proceed-3"]')
      ).toBeDisabled();

      // Kiểm tra có ít nhất một thông báo lỗi
      await expect(page.locator(".alert-danger").first()).toBeVisible();
    } else if (record.ExpectedResult.includes("Chấp nhận")) {
      // Kiểm tra button proceed-3 có enabled không
      await expect(page.locator('button[data-test="proceed-3"]')).toBeEnabled();

      // Nhấn tiếp tục từ bước address (bước 3) sang bước payment (bước 4)
      await page.click('button[data-test="proceed-3"]');

      // Kiểm tra chuyển sang bước payment
      await expect(page.locator('button[data-test="finish"]')).toBeVisible();
      await expect(page.locator('h3:has-text("Payment")')).toBeVisible();
    } else if (record.ExpectedResult.includes("Chặn")) {
      // Kiểm tra button proceed-3 bị disabled
      await expect(
        page.locator('button[data-test="proceed-3"]')
      ).toBeDisabled();

      // Kiểm tra có ít nhất một thông báo lỗi
      await expect(page.locator(".alert-danger").first()).toBeVisible();
    }
  });
}
