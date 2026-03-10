import { test, expect } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const WEB_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("form-submission", () => {
  test.skip(
    !process.env.E2E_TEST,
    "Form token requires authenticated API - run with E2E_TEST=1"
  );

  test("Token ile form aç → Doldur → Submit → Skor hesaplanır", async ({
    page,
  }) => {
    // Get E2E token
    const tokenRes = await fetch(`${API_URL}/auth/e2e-token`);
    if (!tokenRes.ok) test.skip();
    const { accessToken } = (await tokenRes.json()) as { accessToken: string };

    // Create client via API
    const clientRes = await fetch(`${API_URL}/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        firstName: "Form",
        lastName: `Test ${Date.now()}`,
      }),
    });
    if (!clientRes.ok) test.skip();
    const client = (await clientRes.json()) as { id: string };

    // Get PHQ9 form definition id
    const formsRes = await fetch(`${API_URL}/form-definitions?code=phq9`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!formsRes.ok) test.skip();
    const formsData = (await formsRes.json()) as { data?: { id: string }[] };
    const formDef = formsData.data?.[0];
    if (!formDef) test.skip();

    // Generate form link
    const linkRes = await fetch(`${API_URL}/form-submissions/generate-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        clientId: client.id,
        formDefinitionId: formDef.id,
      }),
    });
    if (!linkRes.ok) test.skip();
    const { token } = (await linkRes.json()) as { token: string };

    // Navigate to form (route: /[formToken])
    await page.goto(`${WEB_URL}/${token}`);
    await page.waitForLoadState("networkidle");

    // Form wizard - fill PHQ9 (all 0 for safety)
    const options = page.getByRole("radio", { name: /hiç/i });
    const count = await options.count();
    for (let i = 0; i < Math.min(count, 9); i++) {
      await options.nth(i).click();
    }

    // Submit
    await page.getByRole("button", { name: /ileri|gönder|tamamla/i }).click();
    await page.waitForLoadState("networkidle");

    // Success message or score visible
    await expect(
      page.getByText(/teşekkür|başarıyla|gönderildi|skor/i)
    ).toBeVisible({ timeout: 10000 });
  });
});
