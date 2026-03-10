import { test as base, Page } from "@playwright/test";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:3001";

export async function getE2EToken(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/e2e-token`);
  if (!res.ok) {
    throw new Error(`E2E token failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}

export async function setAuthStorage(page: Page, token: string) {
  await page.goto("/");
  await page.evaluate(
    (t) => {
      localStorage.setItem("access_token", t);
      sessionStorage.setItem("access_token", t);
    },
    token
  );
}

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    const token = await getE2EToken();
    await setAuthStorage(page, token);
    await use(page);
  },
});

export { expect } from "@playwright/test";
