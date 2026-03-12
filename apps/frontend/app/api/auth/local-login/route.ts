import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiRes = await fetch(`${API_URL}/auth/local-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await apiRes.json().catch(() => ({}));

    if (!apiRes.ok) {
      return NextResponse.json(data, { status: apiRes.status });
    }

    const response = NextResponse.json(data);
    const token = (data as { access_token?: string }).access_token;
    if (token) {
      response.cookies.set("psikoport_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });
    }
    return response;
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Giriş başarısız" } },
      { status: 500 }
    );
  }
}
