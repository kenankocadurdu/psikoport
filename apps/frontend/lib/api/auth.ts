export interface MeResponse {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: string;
  is2faEnabled: boolean;
}

/**
 * Client: /api/auth/me proxy (session cookie). Server: doğrudan API.
 * CORS ve token timing sorunlarını bypass eder.
 */
export function fetchMe(): Promise<MeResponse> {
  const isClient = typeof window !== "undefined";
  const url = isClient
    ? "/api/auth/me"
    : `${process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/auth/me`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isClient) {
    const t = localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token");
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  return fetch(url, {
    credentials: "include",
    headers,
  }).then(async (res) => {
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? `Request failed (${res.status})`);
    }
    return res.json() as Promise<MeResponse>;
  });
}
