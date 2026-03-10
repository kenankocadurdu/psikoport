import { redirect } from "next/navigation";

/**
 * Form bu route'a gelir. v3: /api/auth/login (returnTo sync-token handleAuth ile ayarlı).
 */
export function GET() {
  redirect("/api/auth/login");
}
