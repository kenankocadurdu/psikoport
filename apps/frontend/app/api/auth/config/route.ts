import { NextResponse } from "next/server";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/auth/config`, { cache: "no-store" });
    const data = await res.json().catch(() => ({ useAuth0: true }));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ useAuth0: true });
  }
}
