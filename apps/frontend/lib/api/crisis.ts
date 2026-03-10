import { apiFetch } from "./client";

export interface CrisisAlert {
  id: string;
  clientId: string;
  clientName: string;
  formDefinitionId: string;
  formTitle: string;
  submittedAt: string | null;
}

export function fetchCrisisAlerts(): Promise<CrisisAlert[]> {
  return apiFetch<CrisisAlert[]>("/crisis");
}

export function acknowledgeCrisisAlert(
  submissionId: string
): Promise<{ id: string; acknowledged: boolean }> {
  return apiFetch(`/crisis/${submissionId}/acknowledge`, {
    method: "PATCH",
  });
}
