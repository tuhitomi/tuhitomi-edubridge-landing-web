const { test, expect } = require("@playwright/test");

const adminEmail = process.env.EDUBRIDGE_ADMIN_EMAIL || "";
const adminPassword = process.env.EDUBRIDGE_ADMIN_PASSWORD || "";
const userEmail = process.env.EDUBRIDGE_USER_EMAIL || "";
const userPassword = process.env.EDUBRIDGE_USER_PASSWORD || "";

async function login(page, email, password) {
  await page.goto("/dang-nhap.html", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="identity"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("#login-form").evaluate((form) => form.requestSubmit());
}

test.describe("authenticated flows", () => {
  test.beforeEach(({ }, testInfo) => {
    const needsAdmin = testInfo.title.includes("[admin]");
    const needsUser = testInfo.title.includes("[user]");
    if (needsAdmin && (!adminEmail || !adminPassword)) {
      test.skip(true, "Missing admin credentials");
    }
    if (needsUser && (!userEmail || !userPassword)) {
      test.skip(true, "Missing user credentials");
    }
  });

  test("[user] can sign in and open profile", async ({ page }) => {
    await login(page, userEmail, userPassword);
    await page.waitForURL(/profile\.html|index\.html/, { timeout: 20_000 });

    await page.goto("/profile.html", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/profile\.html/);
    await expect(page.locator("#profile-form")).toBeVisible();
    await expect(page.locator("#profile-email")).toHaveValue(userEmail);
  });

  test("[user] is blocked from admin page", async ({ page }) => {
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await login(page, userEmail, userPassword);
    await page.waitForURL(/profile\.html|index\.html/, { timeout: 20_000 });

    await page.goto("/admin.html", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/index\.html/, { timeout: 20_000 });
    await expect(page).toHaveURL(/index\.html/);
  });

  test("[admin] can sign in and open admin dashboard", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await page.waitForURL(/index\.html|profile\.html/, { timeout: 20_000 });

    await page.goto("/admin.html", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/admin\.html/);
    await expect(page.locator(".admin-tab-btn")).toHaveCount(6);
    await expect(page.locator("#total-tutors")).toBeVisible();
  });

  test("[admin] notification dropdown opens", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await page.waitForURL(/index\.html|profile\.html/, { timeout: 20_000 });

    await page.goto("/admin.html", { waitUntil: "domcontentloaded" });
    await page.locator("#notification-btn").click();
    await expect(page.locator("#notification-dropdown")).toBeVisible();
  });
});
