"use client";

import { cn } from "@/lib/utils";

export interface FormStepperSection {
  id: string;
  title: string;
  icon?: string;
}

interface FormStepperProps {
  currentStep: number;
  sections: FormStepperSection[];
}

export function FormStepper({ currentStep, sections }: FormStepperProps) {
  const totalSections = sections.length;
  const displayStep = currentStep + 1;
  const currentSection = sections[currentStep];

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">
        Bölüm {displayStep}/{totalSections}
        {currentSection && ` — ${currentSection.title}`}
      </p>
      <div className="flex gap-1" role="progressbar" aria-valuenow={displayStep} aria-valuemin={1} aria-valuemax={totalSections} aria-label={`Bölüm ${displayStep} / ${totalSections}`}>
        {sections.map((_, idx) => {
          const isCompleted = idx < currentStep;
          const isActive = idx === currentStep;
          const isFuture = idx > currentStep;

          return (
            <div
              key={sections[idx].id}
              className={cn(
                "h-2 flex-1 rounded-full transition-colors",
                isCompleted && "bg-green-500",
                isActive && "bg-blue-500",
                isFuture && "bg-muted"
              )}
              aria-hidden="true"
            />
          );
        })}
      </div>
    </div>
  );
}
