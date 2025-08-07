# Contact Form Automation with Playwright and Database Validation

Script automation cho contact form sử dụng Playwright với data driven testing approach và database validation.

## Cấu trúc dự án

```
automation_scripts/
├── contact_filling_form_automation.spec.ts    # Script chính với DB validation
├── contact_form_test_data.csv                 # Test data cập nhật
├── test_files/                                # Files test cho upload
│   ├── test_file.txt                         # File txt hợp lệ
│   ├── invalid_file.pdf                      # File PDF không hợp lệ
│   ├── test_file.sql                         # File SQL không hợp lệ
│   ├── test_file.xlsx                        # File Excel không hợp lệ
│   ├── test_file.csv                         # File CSV không hợp lệ
│   └── large_file.pdf                        # File lớn để test size limit
├── package.json                               # Dependencies
├── playwright.config.ts                       # Cấu hình Playwright
└── README.md                                  # Hướng dẫn này
```

## Cài đặt

1. **Cài đặt dependencies:**

```bash
npm install
```

2. **Cài đặt Playwright browsers:**

```bash
npm run install:browsers
```

## Chạy tests

### Chạy tất cả tests

```bash
npm test
```

### Chạy với UI mode (debug)

```bash
npm run test:ui
```

### Chạy với headed mode (xem browser)

```bash
npm run test:headed
```

### Chạy với debug mode

```bash
npm run test:debug
```

## Test Data

File `contact_form_test_data.csv` chứa các test cases với các trường:

- **test_case**: Tên test case
- **subject**: Subject dropdown value
- **message**: Nội dung message
- **attachment_file**: Tên file đính kèm
- **expected_result**: Kết quả mong đợi (success/error)

## Test Cases

### Valid Cases

- `valid_contact_form`: Form hợp lệ với customer-service
- `valid_contact_form_webmaster`: Form hợp lệ với webmaster
- `valid_contact_form_return`: Form hợp lệ với return
- `valid_contact_form_payments`: Form hợp lệ với payments
- `valid_contact_form_warranty`: Form hợp lệ với warranty
- `valid_contact_form_order_status`: Form hợp lệ với status-of-order

### Invalid Cases

- `invalid_empty_subject`: Test validation khi không chọn subject
- `invalid_short_message`: Test validation khi message quá ngắn
- `invalid_file_type_pdf`: Test validation khi upload file PDF
- `invalid_file_type_sql`: Test validation khi upload file SQL
- `invalid_file_type_xlsx`: Test validation khi upload file Excel
- `invalid_file_type_csv`: Test validation khi upload file CSV
- `invalid_file_size`: Test validation khi file quá lớn

## Database Validation

Script mới bao gồm database validation để kiểm tra:

### Success Cases

- Form submit thành công
- Message được lưu vào database
- Kiểm tra tại trang `/account/messages`

### Error Cases

- Form validation hiển thị lỗi
- Message KHÔNG được lưu vào database
- Kiểm tra tại trang `/account/messages`

## Preconditions

Script tự động thực hiện login với:

- **Email**: customer@practicesoftwaretesting.com
- **Password**: welcome01

## Features

### Data Driven Testing

- Sử dụng CSV file để quản lý test data
- Dễ dàng thêm/sửa test cases mà không cần sửa code
- Hỗ trợ multiple test scenarios

### Database Validation

- Kiểm tra message được lưu vào database
- Verify tại trang `/account/messages`
- So sánh nội dung message
- Kiểm tra cả success và error cases

### Validation Testing

- Test required field validation
- Test message length validation (minimum 50 characters)
- Test file upload validation (only .txt files, max 500KB)
- Test multiple invalid file types (.pdf, .sql, .xlsx, .csv)

### Cross Browser Testing

- Hỗ trợ Chrome, Firefox, Safari
- Hỗ trợ mobile testing
- Parallel execution

### Reporting

- HTML report
- JSON report
- JUnit XML report
- Screenshots và videos cho failed tests

## Contact Form Structure

Dựa trên source code analysis, contact form có các fields:

### Authenticated User

- **Subject** (required): Dropdown với options:
  - customer-service
  - webmaster
  - return
  - payments
  - warranty
  - status-of-order
- **Message** (required, min 50 chars): Textarea
- **Attachment** (optional): File upload (only .txt, max 500KB)

### Non-Authenticated User

- **First Name** (required)
- **Last Name** (required)
- **Email** (required, valid format)
- **Subject** (required)
- **Message** (required, min 50 chars)
- **Attachment** (optional)

## File Validation Rules

### Allowed File Types

- `.txt` files only
- `.pdf` files (should be rejected)
- `.jpg` files (should be rejected)

### File Size Limit

- Maximum 500KB
- Files larger than 500KB should be rejected

### Test Files

- `test_file.txt`: Valid file (empty)
- `invalid_file.pdf`: Invalid file type
- `test_file.sql`: Invalid file type
- `test_file.xlsx`: Invalid file type
- `test_file.csv`: Invalid file type
- `large_file.pdf`: Oversized file (>500KB)

## Error Handling

Script xử lý các trường hợp:

- File không tồn tại
- Network errors
- Element không tìm thấy
- Validation errors
- Database connection issues

## Customization

### Thêm test cases mới

1. Thêm row vào `contact_form_test_data.csv`
2. Đảm bảo file test tồn tại trong `test_files/` nếu cần

### Thay đổi test data

- Sửa file CSV trực tiếp
- Không cần sửa code

### Thêm browsers

- Sửa `playwright.config.ts`
- Thêm browser vào projects array

## Troubleshooting

### Common Issues

1. **Login failed**

   - Kiểm tra credentials
   - Kiểm tra network connection
   - Kiểm tra base URL

2. **Element not found**

   - Kiểm tra data-test attributes
   - Kiểm tra page structure
   - Thêm wait conditions

3. **File upload failed**

   - Kiểm tra file path
   - Kiểm tra file permissions
   - Kiểm tra file format

4. **Database validation failed**
   - Kiểm tra connection đến `/account/messages`
   - Kiểm tra login status
   - Kiểm tra message content matching

### Debug Tips

1. **Sử dụng UI mode:**

```bash
npm run test:ui
```

2. **Sử dụng headed mode:**

```bash
npm run test:headed
```

3. **Sử dụng debug mode:**

```bash
npm run test:debug
```

4. **Xem reports:**

```bash
npx playwright show-report
```

## Bug Detection

Script này được thiết kế để phát hiện các bug:

1. **File Type Validation Bug**: Hệ thống chấp nhận file .sql, .xlsx, .csv
2. **Database Persistence Bug**: Message không được lưu vào database
3. **Error Message Bug**: Error message không chính xác
4. **Size Validation Bug**: File size validation không hoạt động đúng
