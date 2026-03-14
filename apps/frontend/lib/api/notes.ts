import { apiFetch } from "./client";

export interface NoteListItem {
  id: string;
  sessionDate: string;
  sessionNumber: number | null;
  sessionType: string | null;
  tags: string[];
  symptomCategories: string[];
  moodRating: number | null;
  durationMinutes: number | null;
  createdAt: string;
}

export interface NotesListResponse {
  data: NoteListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NoteDetail {
  id: string;
  sessionDate: string;
  sessionNumber: number | null;
  sessionType: string | null;
  tags: string[];
  symptomCategories: string[];
  moodRating: number | null;
  durationMinutes: number | null;
  content: string;
  createdAt: string;
}

export interface CreateNotePayload {
  sessionDate: string;
  sessionNumber?: number;
  sessionType?: string;
  tags?: string[];
  symptomCategories?: string[];
  moodRating?: number;
  durationMinutes?: number;
  content: string;
}

export interface NoteQueryParams {
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  tags?: string[];
}

export function fetchNotes(
  clientId: string,
  params: NoteQueryParams = {}
): Promise<NotesListResponse> {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.fromDate) sp.set("fromDate", params.fromDate);
  if (params.toDate) sp.set("toDate", params.toDate);
  if (params.tags?.length) sp.set("tags", params.tags.join(","));
  const qs = sp.toString();
  return apiFetch<NotesListResponse>(
    `/clients/${clientId}/notes${qs ? `?${qs}` : ""}`
  );
}

export function fetchNote(
  clientId: string,
  noteId: string
): Promise<NoteDetail> {
  return apiFetch<NoteDetail>(`/clients/${clientId}/notes/${noteId}`);
}

export function createNote(
  clientId: string,
  payload: CreateNotePayload
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/clients/${clientId}/notes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteNote(
  clientId: string,
  noteId: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(
    `/clients/${clientId}/notes/${noteId}`,
    { method: "DELETE" }
  );
}
