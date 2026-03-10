const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token =
    localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Trigger KVKK data export download.
 */
export async function downloadClientExport(
  clientId: string,
  format: "json" | "csv"
): Promise<void> {
  const url = `${API_URL}/clients/${clientId}/export?format=${format}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    const msg = err?.error?.message ?? `Export başarısız (${res.status})`;
    throw new Error(msg);
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get("Content-Disposition");
  let filename = `danisan-export.${format}`;
  const match = contentDisposition?.match(/filename\*?=(?:UTF-8'')?"?([^";\n]+)"?/i);
  if (match?.[1]) {
    filename = decodeURIComponent(match[1].trim());
  }

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
