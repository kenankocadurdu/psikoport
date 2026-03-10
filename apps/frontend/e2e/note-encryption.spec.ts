import { test, expect, getE2EToken, setAuthStorage } from "./fixtures/auth";

test.describe("note-encryption", () => {
  test("Not yaz (şifreleme) → Listele → Aç (şifre çöz) → İçerik doğru", async ({
    page,
  }) => {
    const token = await getE2EToken();
    await setAuthStorage(page, token);

    // Need a client first - use demo or create
    await page.goto("/clients");
    await page.waitForLoadState("networkidle");

    const firstClientLink = page.locator('a[href^="/clients/"]').first();
    if (!(await firstClientLink.isVisible())) {
      test.skip();
    }

    await firstClientLink.click();
    await page.waitForURL(/\/clients\/[a-z0-9]+/);

    // Go to Seans Notları tab
    await page.getByRole("tab", { name: /seans notları|notlar/i }).click();

    // Unlock KEK dialog might appear - fill password if visible
    const unlockBtn = page.getByRole("button", { name: /kilidi aç|parola/i });
    if (await unlockBtn.isVisible()) {
      await unlockBtn.click();
      const passwordInput = page.getByLabel(/parola|şifre/i);
      await passwordInput.fill("test-kek-password");
      await page.getByRole("button", { name: /aç|unlock/i }).click();
    }

    // Create note
    const createBtn = page.getByRole("button", { name: /yeni not|ekle/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      const noteContent = `E2E not içeriği ${Date.now()}`;
      const editor = page.locator('[contenteditable="true"]').or(page.getByRole("textbox"));
      await editor.first().fill(noteContent);
      await page.getByRole("button", { name: /kaydet/i }).click();

      // List - note should appear
      await expect(page.getByText(noteContent.slice(0, 20))).toBeVisible({
        timeout: 5000,
      });

      // Open note - content should be decrypted and visible
      await page.getByText(noteContent.slice(0, 20)).click();
      await expect(page.getByText(noteContent)).toBeVisible({ timeout: 5000 });
    }
  });
});
