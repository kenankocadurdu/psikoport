const API_PATH = "/calendar-integrations";

export interface CalendarIntegrationItem {
  id: string;
  provider: string;
  calendarId: string;
  createdAt: string;
}

export interface GoogleAuthUrlResponse {
  url: string;
  state: string;
}

export async function fetchGoogleAuthUrl(): Promise<GoogleAuthUrlResponse> {
  const { apiFetch } = await import("./client");
  return apiFetch<GoogleAuthUrlResponse>(`${API_PATH}/google/auth-url`);
}

export async function fetchOutlookAuthUrl(): Promise<GoogleAuthUrlResponse> {
  const { apiFetch } = await import("./client");
  return apiFetch<GoogleAuthUrlResponse>(`${API_PATH}/outlook/auth-url`);
}

export async function fetchIntegrations(): Promise<CalendarIntegrationItem[]> {
  const { apiFetch } = await import("./client");
  return apiFetch<CalendarIntegrationItem[]>(API_PATH);
}

export async function disconnectIntegration(id: string): Promise<void> {
  const { apiFetch } = await import("./client");
  await apiFetch(`${API_PATH}/${id}`, { method: "DELETE" });
}

export async function triggerSync(id: string): Promise<void> {
  const { apiFetch } = await import("./client");
  await apiFetch(`${API_PATH}/${id}/sync`, { method: "POST" });
}

// --- Video Integrations ---
const VIDEO_PATH = "/video-integrations";

export interface VideoIntegrationItem {
  id: string;
  provider: string;
  createdAt: string;
}

export async function fetchVideoIntegrations(): Promise<VideoIntegrationItem[]> {
  const { apiFetch } = await import("./client");
  return apiFetch<VideoIntegrationItem[]>(VIDEO_PATH);
}

export async function fetchZoomAuthUrl(): Promise<{ url: string; state: string }> {
  const { apiFetch } = await import("./client");
  return apiFetch<{ url: string; state: string }>(`${VIDEO_PATH}/zoom/auth-url`);
}

export async function disconnectVideoIntegration(id: string): Promise<void> {
  const { apiFetch } = await import("./client");
  await apiFetch(`${VIDEO_PATH}/${id}`, { method: "DELETE" });
}
