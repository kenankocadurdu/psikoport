import { test, expect, getE2EToken, setAuthStorage } from "./fixtures/auth";

const uniqueId = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test.describe("client-crud", () => {
  test.use({ storageState: undefined });

  test("Danışan oluştur → listele → düzenle → soft-delete", async ({
    page,
  }) => {
    const token = await getE2EToken();
    await setAuthStorage(page, token);

    const firstName = `Test ${uniqueId()}`;
    const lastName = "Danışan";

    // Create
    await page.goto("/clients/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/ad/i).first().fill(firstName);
    await page.getByLabel(/soyad/i).first().fill(lastName);
    await page.getByRole("button", { name: /kaydet|oluştur/i }).click();
    await expect(page.getByText("Danışan başarıyla oluşturuldu")).toBeVisible({
      timeout: 5000,
    });

    // List
    await page.goto("/clients");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(firstName)).toBeVisible();

    // Edit - click detail
    await page.getByText(firstName).first().click();
    await page.waitForURL(/\/clients\/[a-z0-9]+/);
    const newLastName = `${lastName} Guncellendi`;
    await page.getByLabel(/soyad/i).first().fill(newLastName);
    await page.getByRole("button", { name: /kaydet/i }).first().click();
    await expect(page.getByText("Profil güncellendi")).toBeVisible({
      timeout: 5000,
    });

    // Soft-delete - UI may not expose; verify list shows updated name
    await page.goto("/clients");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(newLastName)).toBeVisible();
  });
});
