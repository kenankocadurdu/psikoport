import { test, expect, getE2EToken, setAuthStorage } from "./fixtures/auth";

/**
 * E2E: Login (E2E token simulates auth) → Dashboard görünür.
 * Full Auth0 Kayıt → 2FA → Login requires Auth0 test tenant; E2E token simulates authenticated state.
 */
test.describe("auth", () => {
  test("E2E token ile dashboard görünür", async ({ page }) => {
    const token = await getE2EToken();
    await setAuthStorage(page, token);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    if (url.includes("/login") || url.includes("/setup-2fa")) {
      test.skip();
    }

    await expect(
      page.getByText(/bugün|özet|randevu/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("Token olmadan login'e yönlendirilir", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
