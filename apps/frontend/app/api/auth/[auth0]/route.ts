import type { NextRequest } from "next/server";
import auth0 from "@/lib/auth0";

const handler = auth0.handleAuth({
  login: auth0.handleLogin({
    returnTo: "/auth/sync-token",
    authorizationParams: {
      audience: process.env.AUTH0_AUDIENCE ?? "http://localhost:3001",
    },
  }),
});

async function withAwaitParams(
  req: NextRequest,
  context: { params: Promise<{ auth0: string }> }
) {
  const params = await context.params;
  return (handler as (r: NextRequest, c: { params: { auth0: string } }) => Response | Promise<Response>)(req, { params });
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ auth0: string }> }) => withAwaitParams(req, ctx);
export const POST = (req: NextRequest, ctx: { params: Promise<{ auth0: string }> }) => withAwaitParams(req, ctx);
