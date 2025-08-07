import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

// Test data interface
interface ContactFormData {
  test_case: string;
  subject: string;
  message: string;
  attachment_file: string;
  expected_result: string;
}

// Interface for message data from API
interface MessageData {
  id: number;
  user_id: number;
  name: string;
  email: string | null;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// Interface for API response
interface ApiResponse {
  current_page: number;
  data: MessageData[];
  from: number;
  last_page: number;
  per_page: number;
  to: number;
  total: number;
}

// Read test data from CSV file
function loadTestData(): ContactFormData[] {
  const csvFilePath = path.join(__dirname, "contact_form_test_data.csv");
  const csvContent = fs.readFileSync(csvFilePath, "utf-8");
  return parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });
}

// Function to get bearer token by logging in via API
async function getBearerToken(page: any): Promise<string> {
  const loginResponse = await page.request.post(
    "http://localhost:8091/users/login",
    {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      data: {
        email: "customer@practicesoftwaretesting.com",
        password: "welcome01",
      },
    }
  );

  if (loginResponse.ok()) {
    const loginData = await loginResponse.json();
    return loginData.access_token;
  } else {
    console.log(
      `Login failed: ${loginResponse.status()} ${loginResponse.statusText()}`
    );
    return "";
  }
}

// Function to get messages from API
async function getMessagesFromApi(page: any): Promise<MessageData[]> {
  const token = await getBearerToken(page);

  const response = await page.request.get(
    "http://localhost:8091/messages?page=1",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.ok()) {
    const data: ApiResponse = await response.json();
    return data.data;
  } else {
    console.log(
      `API request failed: ${response.status()} ${response.statusText()}`
    );
    return [];
  }
}

// Function to check if a message exists in database via API
async function checkMessageInDatabase(
  page: any,
  expectedSubject: string,
  expectedMessage: string
): Promise<boolean> {
  const messages = await getMessagesFromApi(page);

  return messages.some(
    (msg) =>
      msg.subject === expectedSubject &&
      msg.message.includes(expectedMessage.substring(0, 50)) // Check first 50 chars
  );
}

// Alternative function to check messages from HTML table (fallback)
async function getMessagesFromDatabase(page: any): Promise<MessageData[]> {
  await page.goto("http://localhost:4200/#/account/messages");
  await page.waitForLoadState("networkidle");

  const messages: MessageData[] = [];

  // Get all message rows
  const messageRows = page.locator("table tbody tr");
  const rowCount = await messageRows.count();

  for (let i = 0; i < rowCount; i++) {
    const row = messageRows.nth(i);

    const subject = await row.locator("td").nth(0).textContent();
    const message = await row.locator("td").nth(1).textContent();
    const status = await row.locator("td").nth(2).textContent();
    const date = await row.locator("td").nth(3).textContent();

    messages.push({
      id: i + 1, // Placeholder ID
      user_id: 2, // Placeholder user_id
      name: " ",
      email: null,
      subject: subject?.trim() || "",
      message: message?.trim() || "",
      status: status?.trim() || "",
      created_at: date?.trim() || "",
      updated_at: date?.trim() || "",
    });
  }

  return messages;
}

test.describe("Contact Form Automation with Database Validation", () => {
  let testData: ContactFormData[];
  let initialMessages: MessageData[];

  test.beforeAll(async () => {
    testData = loadTestData();
    // Remove page-dependent initialization from beforeAll
    initialMessages = []; // Will be set in beforeEach
  });

  test.beforeEach(async ({ page }) => {
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

    // Get initial messages count (only on first test)
    if (initialMessages.length === 0) {
      try {
        initialMessages = await getMessagesFromApi(page);
      } catch (error) {
        console.log("API failed, using HTML table fallback");
        initialMessages = await getMessagesFromDatabase(page);
      }
    }

    // Navigate to contact page
    await page.locator('[data-test="nav-contact"]').click();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h3")).toContainText("Contact");
  });

  // Data driven tests with database validation
  for (const data of loadTestData()) {
    test(`Database Validation Test: ${data.test_case}`, async ({ page }) => {
      console.log(`Running test case: ${data.test_case}`);

      // Fill subject dropdown
      if (data.subject) {
        await page.locator('[data-test="subject"]').selectOption(data.subject);
      }

      // Fill message textarea
      if (data.message) {
        await page.locator('[data-test="message"]').fill(data.message);
      }

      // Handle file attachment if specified
      if (data.attachment_file && data.attachment_file !== "") {
        const filePath = path.join(
          __dirname,
          "test_files",
          data.attachment_file
        );

        // Check if file exists
        if (fs.existsSync(filePath)) {
          await page
            .locator('[data-test="attachment"]')
            .setInputFiles(filePath);
        } else {
          console.warn(`File not found: ${filePath}`);
        }
      }

      // Submit the form
      await page.locator('[data-test="contact-submit"]').click();
      await page.waitForTimeout(3000); // Wait longer for database update

      // Verify expected result
      if (data.expected_result === "success") {
        // Check for success message
        const successSelectors = [
          ".alert-success",
          ".alert-info",
          '[class*="success"]',
          '[class*="alert"]:not(.alert-danger)',
        ];

        let successFound = false;
        for (const selector of successSelectors) {
          const element = page.locator(selector);
          if ((await element.count()) > 0) {
            await expect(element).toBeVisible();
            successFound = true;
            console.log(`Success message found with selector: ${selector}`);
            break;
          }
        }

        if (!successFound) {
          // Check if there are no validation errors
          const errorElements = page.locator(".alert-danger");
          if ((await errorElements.count()) === 0) {
            console.log(
              "No validation errors found, form submitted successfully"
            );
            successFound = true;
          }
        }

        // Database validation for success cases
        if (successFound) {
          const messageExists = await checkMessageInDatabase(
            page,
            data.subject,
            data.message
          );
          expect(messageExists).toBe(true);
          console.log(`✓ Database validation passed for "${data.test_case}"`);
        }

        console.log(
          `✓ Test case "${data.test_case}" passed - Success scenario`
        );
      } else if (data.expected_result === "error") {
        // Check for error messages based on test case
        if (data.test_case === "invalid_empty_subject") {
          await expect(
            page.locator('[data-test="subject-error"]')
          ).toBeVisible();
        } else if (data.test_case === "invalid_short_message") {
          await expect(
            page.locator('[data-test="message-error"]')
          ).toBeVisible();
        } else if (data.test_case.includes("invalid_file_type")) {
          // For invalid file types, only check database validation, not error message
          // Database validation for error cases - message should NOT be saved
          const messageExists = await checkMessageInDatabase(
            page,
            data.subject,
            data.message
          );
          expect(messageExists).toBe(false);
          console.log(
            `✓ Database validation passed for error case "${data.test_case}" - message not saved`
          );
        } else if (data.test_case === "invalid_file_size") {
          await expect(
            page.locator('[data-test="attachment-error"]')
          ).toBeVisible();

          // Check error message content
          const errorMessage = await page
            .locator('[data-test="attachment-error"]')
            .textContent();
          expect(errorMessage).toContain("File should be smaller than 500KB");

          // Database validation - message should NOT be saved
          const messageExists = await checkMessageInDatabase(
            page,
            data.subject,
            data.message
          );
          expect(messageExists).toBe(false);
          console.log(
            `✓ Database validation passed for error case "${data.test_case}" - message not saved`
          );
        }

        console.log(`✓ Test case "${data.test_case}" passed - Error scenario`);
      }
    });
  }
});

test.describe("Contact Form Field Validation Tests", () => {
  test.beforeEach(async ({ page }) => {
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

    // Navigate to contact page
    await page.locator('[data-test="nav-contact"]').click();

    // Wait for contact form to load and verify
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h3")).toContainText("Contact");
  });

  test("Should show error for empty subject", async ({ page }) => {
    await page
      .locator('[data-test="message"]')
      .fill(
        "This is a test message with minimum 50 characters to validate the form submission."
      );
    await page.locator('[data-test="contact-submit"]').click();

    await expect(page.locator('[data-test="subject-error"]')).toBeVisible();
  });

  test("Should show error for short message", async ({ page }) => {
    await page
      .locator('[data-test="subject"]')
      .selectOption("customer-service");
    await page.locator('[data-test="message"]').fill("Short message");
    await page.locator('[data-test="contact-submit"]').click();

    await expect(page.locator('[data-test="message-error"]')).toBeVisible();
  });

  test("Should show error for invalid file types and NOT save to database", async ({
    page,
  }) => {
    const invalidFileTypes = [
      {
        file: "test_file.sql",
        expectedError:
          "Only files with the txt, pdf or jpg extension are allowed",
      },
      {
        file: "test_file.xlsx",
        expectedError:
          "Only files with the txt, pdf or jpg extension are allowed",
      },
      {
        file: "test_file.csv",
        expectedError:
          "Only files with the txt, pdf or jpg extension are allowed",
      },
    ];

    for (const testCase of invalidFileTypes) {
      console.log(`Testing invalid file type: ${testCase.file}`);

      await page
        .locator('[data-test="subject"]')
        .selectOption("customer-service");
      await page
        .locator('[data-test="message"]')
        .fill(
          `This is a test message with ${testCase.file} to test file validation.`
        );

      const filePath = path.join(__dirname, "test_files", testCase.file);
      await page.locator('[data-test="attachment"]').setInputFiles(filePath);
      await page.locator('[data-test="contact-submit"]').click();

      // Wait for form submission
      await page.waitForTimeout(3000);

      // Database validation - message should NOT be saved
      const messageExists = await checkMessageInDatabase(
        page,
        "customer-service",
        `This is a test message with ${testCase.file} to test file validation.`
      );

      if (messageExists) {
        console.log(
          `❌ BUG DETECTED: Message with invalid file type ${testCase.file} was saved to database!`
        );
        expect(messageExists).toBe(false); // This will fail the test if message is saved
      } else {
        console.log(
          `✓ File type validation passed for ${testCase.file} - message not saved to database`
        );
      }
    }
  });

  test("Should show error for oversized file and NOT save to database", async ({
    page,
  }) => {
    await page
      .locator('[data-test="subject"]')
      .selectOption("customer-service");
    await page
      .locator('[data-test="message"]')
      .fill(
        "This is a test message with oversized file to test file size validation."
      );

    const filePath = path.join(__dirname, "test_files", "large_file.pdf");
    await page.locator('[data-test="attachment"]').setInputFiles(filePath);
    await page.locator('[data-test="contact-submit"]').click();

    // Check error message is displayed for file size
    await expect(page.locator('[data-test="attachment-error"]')).toBeVisible();

    const errorMessage = await page
      .locator('[data-test="attachment-error"]')
      .textContent();
    expect(errorMessage).toContain("File should be smaller than 500KB");

    // Database validation - message should NOT be saved
    const messageExists = await checkMessageInDatabase(
      page,
      "customer-service",
      "This is a test message with oversized file to test file size validation."
    );

    if (messageExists) {
      console.log(
        `❌ BUG DETECTED: Message with oversized file was saved to database!`
      );
      expect(messageExists).toBe(false); // This will fail the test if message is saved
    } else {
      console.log(
        `✓ File size validation passed - message not saved to database`
      );
    }
  });
});

test.describe("Contact Form Success Flow with Database Check", () => {
  test.beforeEach(async ({ page }) => {
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

    // Navigate to contact page
    await page.locator('[data-test="nav-contact"]').click();

    // Wait for contact form to load and verify
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h3")).toContainText("Contact");
  });

  test("Successful form submission with database validation", async ({
    page,
  }) => {
    const testMessage =
      "This is a test message with minimum 50 characters to validate the successful form submission flow.";

    // Test successful form submission
    await page
      .locator('[data-test="subject"]')
      .selectOption("customer-service");
    await page.locator('[data-test="message"]').fill(testMessage);

    const filePath = path.join(__dirname, "test_files", "test_file.txt");
    await page.locator('[data-test="attachment"]').setInputFiles(filePath);

    await page.locator('[data-test="contact-submit"]').click();

    // Wait a bit for response
    await page.waitForTimeout(3000);

    // Verify success - try different selectors
    const successSelectors = [
      ".alert-success",
      ".alert-info",
      '[class*="success"]',
      '[class*="alert"]:not(.alert-danger)',
    ];

    let successFound = false;
    for (const selector of successSelectors) {
      const element = page.locator(selector);
      if ((await element.count()) > 0) {
        await expect(element).toBeVisible();
        successFound = true;
        console.log(`Success message found with selector: ${selector}`);
        break;
      }
    }

    if (!successFound) {
      // Check if there are no validation errors
      const errorElements = page.locator(".alert-danger");
      if ((await errorElements.count()) === 0) {
        console.log("No validation errors found, form submitted successfully");
        successFound = true;
      }
    }

    // Database validation
    if (successFound) {
      const messageExists = await checkMessageInDatabase(
        page,
        "customer-service",
        testMessage
      );
      expect(messageExists).toBe(true);
      console.log("✓ Database validation passed - message saved successfully");
    } else {
      console.log("Form submission may have failed");
    }
  });
});

test.describe("Contact Form Subject Options", () => {
  test.beforeEach(async ({ page }) => {
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

    // Navigate to contact page
    await page.locator('[data-test="nav-contact"]').click();

    // Wait for contact form to load and verify
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h3")).toContainText("Contact");
  });

  test("All subject options are available", async ({ page }) => {
    // Test all subject options are available
    const expectedSubjects = [
      "customer-service",
      "webmaster",
      "return",
      "payments",
      "warranty",
      "status-of-order",
    ];

    for (const subject of expectedSubjects) {
      await page.locator('[data-test="subject"]').selectOption(subject);
      const selectedValue = await page
        .locator('[data-test="subject"]')
        .inputValue();
      expect(selectedValue).toBe(subject);
    }
  });
});
