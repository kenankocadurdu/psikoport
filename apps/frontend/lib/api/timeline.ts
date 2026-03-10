import { apiFetch } from "./client";

export type TimelineEntryType = "note" | "test" | "appointment";

export interface TimelineEntry {
  type: TimelineEntryType;
  date: string;
  title: string;
  meta: Record<string, unknown>;
  id: string;
}

export interface TimelineResponse {
  data: TimelineEntry[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TimelineQueryParams {
  page?: number;
  limit?: number;
}

export function fetchTimeline(
  clientId: string,
  params: TimelineQueryParams = {}
): Promise<TimelineResponse> {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return apiFetch<TimelineResponse>(
    `/clients/${clientId}/timeline${qs ? `?${qs}` : ""}`
  );
}
