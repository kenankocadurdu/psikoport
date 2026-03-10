import { NextResponse } from "next/server";

/**
 * Auth0 MFA enrollment akışına yönlendirir.
 * Auth0 SDK'nın /auth/login rotasını kullanır; böylece state parametresi
 * transaction cookie'de doğru saklanır ve callback "state is missing" hatası almaz.
 */
export async function GET() {
  const baseUrl =
    process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const loginUrl = new URL("/api/auth/login", baseUrl);
  loginUrl.searchParams.set("returnTo", "/auth/sync-token");
  return NextResponse.redirect(loginUrl.toString());
}
