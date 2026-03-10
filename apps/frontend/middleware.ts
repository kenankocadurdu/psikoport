import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@auth0/nextjs-auth0/edge";

/**
 * Korumalı sayfalarda oturum kontrolü.
 * - Session yoksa → /login (kendi giriş/kayıt sayfamız)
 * - Session varsa → devam
 *
 * withMiddlewareAuthRequired kullanılmaz çünkü o Auth0'a doğrudan yönlendirir.
 * Kullanıcı önce /login sayfasını görmeli, oradan Giriş Yap veya Kayıt Ol seçebilmeli.
 */
export default async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const session = await getSession(req, res);

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|login|register|forms|api/auth|auth/sync-token|setup-2fa).*)",
  ],
};
