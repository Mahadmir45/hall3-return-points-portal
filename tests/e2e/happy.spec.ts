import { test, expect } from "@playwright/test";

test("sign in and view dashboard", async ({ page }) => {
  await page.goto("/signin");
  await page.fill("#email", "tutor@hall3.dev");
  await page.fill("#password", "hall3dev");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/h\/hall-3/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
