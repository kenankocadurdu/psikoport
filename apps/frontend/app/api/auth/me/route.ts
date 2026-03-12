import { NextRequest, NextResponse } from "next/server";
import auth0 from "@/lib/auth0";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * /auth/me proxy: Token Authorization header veya session'dan alınır, API'ye iletir.
 * v3: getSession, getAccessToken auth0 instance üzerinden.
 */
export async function GET(request: NextRequest) {
  try {
    const res = new NextResponse();
    const authHeader = request.headers.get("authorization");
    let accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    // Local auth: cookie'den token al
    if (!accessToken) {
      accessToken = request.cookies.get("psikoport_token")?.value ?? null;
    }

    if (!accessToken) {
      const session = await auth0.getSession(request, res);
      if (!session) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "UNAUTHORIZED", message: "No session" },
          },
          { status: 401 }
        );
      }
      const tokenData = await auth0.getAccessToken(request, res, {
        authorizationParams: {
          audience: process.env.AUTH0_AUDIENCE ?? "http://localhost:3001",
        },
      });
      accessToken =
        typeof tokenData === "object" && tokenData?.accessToken
          ? tokenData.accessToken
          : typeof tokenData === "string"
            ? tokenData
            : null;
    }

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "No access token" },
        },
        { status: 401 }
      );
    }

    const apiRes = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = await apiRes.json().catch(() => ({}));
    return NextResponse.json(data, {
      status: apiRes.status,
      headers: res.headers,
    });
  } catch (err) {
    console.error("[api/auth/me proxy]", err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Proxy failed" },
      },
      { status: 500 }
    );
  }
}
