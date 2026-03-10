import { apiFetch } from "./client";

export interface PublicProfile {
  slug: string;
  fullName: string;
  bio: string | null;
  specializations: string[];
  education: Array<{ school: string; degree?: string; year?: string }>;
  experience: Array<{ title: string; organization?: string; years?: string }>;
  photoUrl: string | null;
  sessionTypes: string[];
  sessionFee: number | null;
  officeAddress: string | null;
  languages: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
}

export interface ProfileEdit {
  tenantSlug?: string | null;
  fullName: string;
  bio: string | null;
  specializations: string[];
  education: unknown[];
  experience: unknown[];
  photoUrl: string | null;
  photoDisplayUrl?: string | null;
  sessionTypes: string[];
  sessionFee: number | null;
  officeAddress: string | null;
  languages: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
}

export function fetchPublicProfile(slug: string): Promise<PublicProfile> {
  return apiFetch<PublicProfile>(`/profile/public/${encodeURIComponent(slug)}`);
}

export function fetchMyProfile(): Promise<ProfileEdit> {
  return apiFetch<ProfileEdit>("/profile");
}

export function updateProfile(data: Partial<ProfileEdit>): Promise<unknown> {
  return apiFetch("/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function getPhotoUploadUrl(
  filename: string,
  contentType: string
): Promise<{ uploadUrl: string; key: string }> {
  const sp = new URLSearchParams({
    filename: filename || "photo.jpg",
    contentType: contentType || "image/jpeg",
  });
  return apiFetch(`/profile/photo/upload-url?${sp.toString()}`, {
    method: "POST",
  });
}

export function confirmPhotoUpload(key: string): Promise<unknown> {
  return apiFetch("/profile/photo/confirm", {
    method: "POST",
    body: JSON.stringify({ key }),
  });
}
