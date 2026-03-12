import { NextRequest, NextResponse } from "next/server";
import auth0 from "@/lib/auth0";

/**
 * Unified logout: local token cookie'yi temizler + Auth0 session'ı sonlandırır.
 * Local modda Auth0 session olmasa da sorunsuz çalışır.
 */
export async function GET(request: NextRequest) {
  // Local token cookie'yi temizle
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set("psikoport_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  // Auth0 session varsa onu da sonlandır
  try {
    const res = new NextResponse();
    const session = await auth0.getSession(request, res);
    if (session) {
      // Auth0 logout URL'ine yönlendir — o da /login'e döner
      const returnTo = encodeURIComponent(
        new URL("/login", request.url).toString()
      );
      const logoutUrl = new URL("/api/auth/logout", request.url);
      logoutUrl.searchParams.set("returnTo", decodeURIComponent(returnTo));
      return NextResponse.redirect(logoutUrl);
    }
  } catch {
    // Auth0 erişilemez — sadece cookie temizle ve /login'e git
  }

  return response;
}
