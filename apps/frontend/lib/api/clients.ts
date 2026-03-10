import { apiFetch } from "./client";

export interface ClientListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  tags: string[];
  createdAt: string;
}

export interface ClientsResponse {
  data: ClientListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Client {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  tcKimlik: string | null;
  birthDate: string | null;
  gender: string | null;
  maritalStatus: string | null;
  educationLevel: string | null;
  occupation: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergencyContact: Record<string, unknown> | null;
  preferredContact: string[];
  tags: string[];
  complaintAreas: string[];
  referralSource: string | null;
  status: string;
  deletedAt: string | null;
  anonymizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientInput {
  firstName: string;
  lastName: string;
  tcKimlik?: string;
  birthDate?: string;
  gender?: string;
  maritalStatus?: string;
  educationLevel?: string;
  occupation?: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContact?: Record<string, unknown>;
  preferredContact?: string[];
  tags?: string[];
  complaintAreas?: string[];
  referralSource?: string;
}

export interface ClientQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "ACTIVE" | "INACTIVE";
  tags?: string[];
  complaintAreas?: string[];
}

export function fetchClients(params: ClientQueryParams = {}): Promise<ClientsResponse> {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.search) sp.set("search", params.search);
  if (params.status) sp.set("status", params.status);
  if (params.tags?.length) sp.set("tags", params.tags.join(","));
  if (params.complaintAreas?.length) sp.set("complaintAreas", params.complaintAreas.join(","));
  const qs = sp.toString();
  return apiFetch<ClientsResponse>(`/clients${qs ? `?${qs}` : ""}`);
}

export function fetchClient(id: string): Promise<Client> {
  return apiFetch<Client>(`/clients/${id}`);
}

export function createClient(data: CreateClientInput): Promise<{ id: string; firstName: string; lastName: string }> {
  return apiFetch(`/clients`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateClient(
  id: string,
  data: Partial<CreateClientInput>
): Promise<Client> {
  return apiFetch<Client>(`/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteClient(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/clients/${id}`, {
    method: "DELETE",
  });
}

export interface ImportClientRow {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  birthDate?: string;
  gender?: string;
  complaintAreas?: string[];
}

export interface ImportClientsResult {
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export function importClients(
  rows: ImportClientRow[]
): Promise<ImportClientsResult> {
  return apiFetch<ImportClientsResult>("/clients/import", {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}
