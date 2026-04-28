const { test, expect } = require("@playwright/test");

const pages = [
  { path: "/index.html", title: /EduBridge/i, heading: /EduBridge/i },
  { path: "/tim-gia-su.html", title: /EduBridge/i, heading: /gia su|EduBridge/i },
  { path: "/profile.html", title: /EduBridge/i, heading: /trang c.|EduBridge/i },
  { path: "/admin.html", title: /EduBridge/i, heading: /quan tr.|EduBridge/i },
  { path: "/dang-nhap.html", title: /EduBridge/i, heading: /dang nhap|EduBridge/i },
  { path: "/dang-ky.html", title: /EduBridge/i, heading: /dang ky|EduBridge/i },
  { path: "/quen-mat-khau.html", title: /EduBridge/i, heading: /quen mat khau|EduBridge/i },
  { path: "/thanks.html", title: /EduBridge/i, heading: /EduBridge|yeu cau/i }
];

for (const pageConfig of pages) {
  test(`loads ${pageConfig.path}`, async ({ page }) => {
    const response = await page.goto(pageConfig.path, { waitUntil: "domcontentloaded" });
    expect(response).not.toBeNull();
    expect(response.ok()).toBeTruthy();
    await expect(page).toHaveTitle(pageConfig.title);

    const body = page.locator("body");
    await expect(body).toContainText(pageConfig.heading);
  });
}

test("admin page redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/admin.html", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/dang-nhap\.html\?next=admin\.html/);
  await expect(page).toHaveURL(/dang-nhap\.html\?next=admin\.html/);
});

test("tutor browse page renders filter form", async ({ page }) => {
  await page.goto("/tim-gia-su.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#filter-keyword")).toBeVisible();
});

test("profile page redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/profile.html", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/dang-nhap\.html\?next=profile\.html/);
  await expect(page).toHaveURL(/dang-nhap\.html\?next=profile\.html/);
});

test("notification page redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/thong-bao.html", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/dang-nhap\.html\?next=thong-bao\.html/);
  await expect(page).toHaveURL(/dang-nhap\.html\?next=thong-bao\.html/);
});

test("tutor registration page redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/dang-ky-gia-su.html", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/dang-nhap\.html\?next=dang-ky-gia-su\.html/);
  await expect(page).toHaveURL(/dang-nhap\.html\?next=dang-ky-gia-su\.html/);
});

test("login form validates email identity before Firebase call", async ({ page }) => {
  await page.goto("/dang-nhap.html", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="identity"]').evaluate((input) => {
    input.value = "not-an-email";
  });
  await page.locator('input[name="password"]').fill("12345678");
  await page.locator("#login-form").evaluate((form) => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await expect(page.locator("#login-status")).toContainText(/email/i);
});

test("register form blocks mismatched passwords on the client", async ({ page }) => {
  await page.goto("/dang-ky.html", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="name"]').fill("Test User");
  await page.locator('input[name="email"]').fill("test@example.com");
  await page.locator('input[name="phone"]').fill("0900000000");
  await page.locator('input[name="password"]').fill("12345678");
  await page.locator('input[name="password_confirm"]').fill("87654321");
  await page.locator("#register-form").evaluate((form) => form.requestSubmit());
  await expect(page.locator("#register-status")).toContainText(/khop|khớp/i);
});

test.describe("public page runtime health", () => {
  const runtimeSafePages = [
    "/index.html",
    "/tim-gia-su.html",
    "/dang-nhap.html",
    "/dang-ky.html",
    "/quen-mat-khau.html",
    "/thanks.html"
  ];

  for (const path of runtimeSafePages) {
    test(`has no uncaught runtime errors on ${path}`, async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];

      page.on("pageerror", (error) => {
        pageErrors.push(String(error));
      });

      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });

      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      expect(pageErrors, `Uncaught errors on ${path}`).toEqual([]);
      expect(
        consoleErrors.filter((message) => !message.includes("Failed to load resource")),
        `Console errors on ${path}`
      ).toEqual([]);
    });
  }
});
