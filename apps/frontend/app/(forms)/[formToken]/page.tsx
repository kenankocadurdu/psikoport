"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchFormSchema } from "@/lib/api/forms";
import { FormWizard } from "@/components/forms/FormWizard";
import type { FormSchemaResponse } from "@/lib/api/forms";

export default function FormPage() {
  const params = useParams();
  const formToken = params.formToken as string;
  const [data, setData] = useState<FormSchemaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!formToken) {
      setError("Geçersiz form linki");
      setLoading(false);
      return;
    }
    fetchFormSchema(formToken)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Form yüklenemedi"))
      .finally(() => setLoading(false));
  }, [formToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Form yükleniyor...</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
        <p className="text-destructive text-center">{error ?? "Form bulunamadı"}</p>
        <p className="text-sm text-muted-foreground text-center">
          Link geçersiz veya süresi dolmuş olabilir. Lütfen psikoloğunuzla iletişime geçin.
        </p>
      </div>
    );
  }

  return (
    <FormWizard
      token={formToken}
      title={data.title}
      schema={data.schema}
    />
  );
}
