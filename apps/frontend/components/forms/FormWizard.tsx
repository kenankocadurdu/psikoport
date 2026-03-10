"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FormStepper } from "./FormStepper";
import { FieldRenderer } from "./FieldRenderer";
import { useAutoSave, loadPendingDraft } from "./AutoSave";
import { Button } from "@/components/ui/button";
import { submitForm } from "@/lib/api/forms";
import { evaluateCondition } from "./utils/conditions";
import { toast } from "sonner";

export interface FormWizardSchema {
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
}

interface FormWizardProps {
  token: string;
  title: string;
  schema: FormWizardSchema;
}

export function FormWizard({ token, title, schema }: FormWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>(() =>
    loadPendingDraft(token) ?? {}
  );

  useEffect(() => {
    const pending = loadPendingDraft(token);
    if (pending && Object.keys(pending).length > 0) {
      setResponses(pending);
    }
  }, [token]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sections = schema.sections;
  const totalSteps = sections.length;
  const currentSection = sections[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const visibleFields = useMemo(() => {
    if (!currentSection) return [];
    return currentSection.fields.filter((field) => {
      if (!field.condition) return true;
      return evaluateCondition(
        field.condition as { field: string; operator: "equals" | "not_equals" | "contains" | "greater_than"; value: string | number },
        responses
      );
    });
  }, [currentSection, responses]);

  useAutoSave({
    token,
    responses,
    onSave: async (r) => {
      await submitForm(token, r, "DRAFT");
    },
    enabled: !isSubmitting,
  });

  const updateResponse = useCallback((fieldId: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const saveDraftAndChangeStep = useCallback(
    async (nextStep: number) => {
      setIsSubmitting(true);
      try {
        await submitForm(token, responses, "DRAFT");
        setCurrentStep(nextStep);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Kayıt başarısız");
      } finally {
        setIsSubmitting(false);
      }
    },
    [token, responses]
  );

  const handleBack = useCallback(() => {
    if (isFirstStep) return;
    saveDraftAndChangeStep(currentStep - 1);
  }, [isFirstStep, currentStep, saveDraftAndChangeStep]);

  const handleNext = useCallback(async () => {
    if (isLastStep) {
      setIsSubmitting(true);
      try {
        await submitForm(token, responses, "COMPLETE");
        toast.success("Form başarıyla gönderildi. Teşekkür ederiz.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gönderim başarısız");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    saveDraftAndChangeStep(currentStep + 1);
  }, [isLastStep, token, responses, currentStep, saveDraftAndChangeStep]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      <div className="flex-1 space-y-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        <FormStepper
          currentStep={currentStep}
          sections={sections.map((s) => ({ id: s.id, title: s.title, icon: s.icon }))}
        />
        <div className="space-y-6">
          {visibleFields.map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              value={responses[field.id]}
              onChange={(value) => updateResponse(field.id, value)}
              onCrisisTrigger={() =>
                toast.error("Acil durum tespit edildi. Lütfen 182 ile iletişime geçin veya en yakın sağlık kuruluşuna başvurun.")
              }
              disabled={isSubmitting}
            />
          ))}
        </div>
      </div>

      <footer className="sticky bottom-0 left-0 right-0 mt-8 flex gap-3 border-t bg-background/95 backdrop-blur py-4 -mx-4 px-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={isFirstStep || isSubmitting}
          className="flex-1 sm:flex-none"
        >
          Geri
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          disabled={isSubmitting}
          className="flex-1 sm:flex-none"
        >
          İleri
        </Button>
      </footer>
    </div>
  );
}
