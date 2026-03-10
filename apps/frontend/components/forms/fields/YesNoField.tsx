"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface YesNoFieldProps {
  id: string;
  label: string;
  value: string | boolean;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
}

export function YesNoField({
  id,
  label,
  value,
  onChange,
  required,
  disabled,
}: YesNoFieldProps) {
  const yes = value === true || value === "yes" || value === "evet" || value === "1";
  const no = value === false || value === "no" || value === "hayır" || value === "0";
  return (
    <fieldset className="space-y-3" role="group" aria-labelledby={`${id}-legend`}>
      <Label asChild>
        <span id={`${id}-legend`} className="text-base block">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </span>
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant={yes ? "default" : "outline"}
          size="lg"
          onClick={() => onChange("yes")}
          disabled={disabled}
          aria-pressed={yes}
          aria-label="Evet"
          className="min-h-[48px] text-base"
        >
          Evet
        </Button>
        <Button
          type="button"
          variant={no ? "default" : "outline"}
          size="lg"
          onClick={() => onChange("no")}
          disabled={disabled}
          aria-pressed={no}
          aria-label="Hayır"
          className="min-h-[48px] text-base"
        >
          Hayır
        </Button>
      </div>
    </fieldset>
  );
}
