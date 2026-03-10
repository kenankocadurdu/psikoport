import { apiFetch } from "./client";

export interface SubscaleScore {
  id: string;
  score: number;
  maxScore?: number;
}

export interface ScoresPayload {
  totalScore?: number;
  subscales?: SubscaleScore[];
  severityLevel?: string;
  severityLabel?: string;
  riskFlags?: string[];
  rawItemScores?: Record<string, number>;
}

export interface FormSubmissionListItem {
  id: string;
  formDefinitionId: string;
  formDefinition: { code: string; title: string };
  completionStatus: string;
  submittedAt: string | null;
  createdAt: string;
  scores: ScoresPayload | null;
  severityLevel: string | null;
  riskFlags: string[];
}

export interface FormSubmissionDetail {
  id: string;
  clientId: string;
  formDefinitionId: string;
  formDefinition: {
    code: string;
    title: string;
    schema: unknown;
    scoringConfig: unknown;
  };
  completionStatus: string;
  responses: Record<string, unknown>;
  scores: ScoresPayload | null;
  severityLevel: string | null;
  riskFlags: string[];
  submittedAt: string | null;
  createdAt: string;
}

export interface FormSubmissionsListResponse {
  data: FormSubmissionListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface FormSubmissionQueryParams {
  page?: number;
  limit?: number;
  completionStatus?: string;
  formDefinitionId?: string;
}

export function fetchFormSubmissionsByClient(
  clientId: string,
  params: FormSubmissionQueryParams = {}
): Promise<FormSubmissionsListResponse> {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.completionStatus) sp.set("completionStatus", params.completionStatus);
  if (params.formDefinitionId) sp.set("formDefinitionId", params.formDefinitionId);
  const qs = sp.toString();
  return apiFetch<FormSubmissionsListResponse>(
    `/clients/${clientId}/form-submissions${qs ? `?${qs}` : ""}`
  );
}

export function fetchFormSubmission(submissionId: string): Promise<FormSubmissionDetail> {
  return apiFetch<FormSubmissionDetail>(`/form-submissions/${submissionId}`);
}

export interface GenerateLinkResponse {
  token: string;
  url: string;
}

export function generateFormLink(
  clientId: string,
  formDefinitionId: string
): Promise<GenerateLinkResponse> {
  return apiFetch<GenerateLinkResponse>("/form-submissions/generate-link", {
    method: "POST",
    body: JSON.stringify({ clientId, formDefinitionId }),
  });
}
