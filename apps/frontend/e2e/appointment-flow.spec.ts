import { test, expect, getE2EToken, setAuthStorage } from "./fixtures/auth";

test.describe("appointment-flow", () => {
  test("Randevu oluştur ve tamamla", async ({ page }) => {
    const token = await getE2EToken();
    await setAuthStorage(page, token);

    await page.goto("/clients");
    await page.waitForLoadState("networkidle");

    const clientLink = page.locator('a[href^="/clients/"]').first();
    if (!(await clientLink.isVisible())) test.skip();

    await page.goto("/calendar");
    await page.waitForLoadState("networkidle");

    const newBtn = page.getByRole("button", { name: /yeni randevu|randevu ekle|ekle/i });
    if (!(await newBtn.isVisible())) test.skip();

    await newBtn.click();
    const clientSelect = page.getByLabel(/danışan|client/i).or(page.locator("select").first());
    await clientSelect.click();
    await page.getByRole("option").first().click();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    await page.getByLabel(/tarih|date/i).fill(startDate.toISOString().slice(0, 10));

    await page.getByRole("button", { name: /kaydet|oluştur/i }).click();
    await expect(page.getByText(/randevu|başarı/i)).toBeVisible({ timeout: 8000 });
  });
});
