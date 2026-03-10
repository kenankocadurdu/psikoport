const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface FormSchemaResponse {
  id: string;
  code: string;
  title: string;
  schema: {
    version: number;
    sections: Array<{
      id: string;
      title: string;
      icon?: string;
      fields: Array<{
        id: string;
        type: string;
        label: string;
        placeholder?: string;
        required?: boolean;
        options?: Array<{ value: string; label: string }>;
        validation?: { min?: number; max?: number; minLength?: number; maxLength?: number };
        condition?: { field: string; operator: string; value: string | number };
        crisisTrigger?: { values: string[]; action: string };
        triggersAddonForms?: boolean;
      }>;
    }>;
  };
}

export async function fetchFormSchema(token: string): Promise<FormSchemaResponse> {
  const res = await fetch(
    `${API_URL}/forms/public/schema?token=${encodeURIComponent(token)}`
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err?.message ?? "Form yüklenemedi");
  }
  return res.json();
}

export async function submitForm(
  token: string,
  responses: Record<string, unknown>,
  completionStatus: "DRAFT" | "COMPLETE"
): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/forms/public/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, responses, completionStatus }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err?.message ?? "Kayıt başarısız");
  }
  return res.json();
}
