import { apiFetch } from "./client";

export interface FormDefinitionListItem {
  id: string;
  formType: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  version: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface FormDefinitionsListResponse {
  data: FormDefinitionListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FormDefinitionQueryParams {
  page?: number;
  limit?: number;
  formType?: string;
  category?: string;
  isSystem?: boolean;
}

export function fetchFormDefinitions(
  params: FormDefinitionQueryParams = {}
): Promise<FormDefinitionsListResponse> {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.formType) sp.set("formType", params.formType);
  if (params.category) sp.set("category", params.category);
  if (params.isSystem !== undefined) sp.set("isSystem", String(params.isSystem));
  const qs = sp.toString();
  return apiFetch<FormDefinitionsListResponse>(
    `/form-definitions${qs ? `?${qs}` : ""}`
  );
}
