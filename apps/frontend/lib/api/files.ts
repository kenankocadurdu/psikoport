import { apiFetch } from "./client";

export interface ClientFileItem {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export function fetchFiles(clientId: string): Promise<ClientFileItem[]> {
  return apiFetch<ClientFileItem[]>(`/clients/${clientId}/files`);
}

export function getUploadUrl(
  clientId: string,
  payload: { fileName: string; contentType: string; fileSize?: number }
): Promise<{ url: string; key: string; fileId: string }> {
  return apiFetch<{ url: string; key: string; fileId: string }>(
    `/clients/${clientId}/files/upload-url`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export function getDownloadUrl(
  clientId: string,
  fileId: string
): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(
    `/clients/${clientId}/files/${fileId}/download-url`
  );
}

export function deleteFile(
  clientId: string,
  fileId: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(
    `/clients/${clientId}/files/${fileId}`,
    { method: "DELETE" }
  );
}
