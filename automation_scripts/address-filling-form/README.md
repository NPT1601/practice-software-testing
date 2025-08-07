# Address Form Filling Automation

Thư mục này chứa script kiểm thử tự động form địa chỉ (Address) trong quy trình checkout, sử dụng Playwright và data-driven testing.

## Cấu trúc file

- `address_filling_form_automation.spec.ts`: Script kiểm thử tự động với 2 precondition.
- `address_form_test_data.csv`: Dữ liệu test case cho form Address.

## Preconditions

Script này có 2 precondition chính:

1. **Đăng nhập**: Tự động đăng nhập với tài khoản customer
2. **Thêm sản phẩm vào cart**: Thêm sản phẩm vào giỏ hàng và chuyển tới checkout

## Locators được sử dụng

Các locator được lấy từ source code sprint5:

- **Form fields**: `data-test="street"`, `data-test="city"`, `data-test="state"`, `data-test="country"`, `data-test="postal_code"`
- **Buttons**: `data-test="proceed-1"`, `data-test="proceed-2"`, `data-test="proceed-3"`, `data-test="finish"`
- **Login**: `data-test="email"`, `data-test="password"`, `data-test="login-submit"`
- **Cart**: `data-test="add-to-cart"`

## Hướng dẫn sử dụng

1. Cài đặt Playwright và các package cần thiết:
   ```sh
   npm install playwright csv-parse
   ```
2. Chạy script kiểm thử:
   ```sh
   npx playwright test address_filling_form_automation.spec.ts
   ```

## Lưu ý

- Script tự động thực hiện 2 precondition: đăng nhập và thêm sản phẩm vào cart
- Sử dụng các locator chính xác từ sprint5 UI
- Đảm bảo server đang chạy tại `http://localhost:4200`
- Dữ liệu đăng nhập và sản phẩm mẫu có thể chỉnh sửa trong script
