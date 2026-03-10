import { NextRequest, NextResponse } from "next/server";
import auth0 from "@/lib/auth0";

/**
 * v3: Client için access token döndüren route.
 * sync-token sayfası bunu çağırır, localStorage'a yazar.
 */
export async function GET(req: NextRequest) {
  const res = new NextResponse();
  try {
    const session = await auth0.getSession(req, res);
    if (!session) {
      return NextResponse.json({ error: "No session" }, { status: 401 });
    }
    const tokenData = await auth0.getAccessToken(req, res, {
      authorizationParams: {
        audience: process.env.AUTH0_AUDIENCE ?? "http://localhost:3001",
      },
    });
    const accessToken =
      typeof tokenData === "object" && tokenData?.accessToken
        ? tokenData.accessToken
        : typeof tokenData === "string"
          ? tokenData
          : null;
    if (!accessToken) {
      return NextResponse.json({ error: "No access token" }, { status: 401 });
    }
    return NextResponse.json(
      { token: accessToken, accessToken, access_token: accessToken },
      { headers: res.headers }
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
