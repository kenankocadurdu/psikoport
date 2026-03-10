"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface MultiSelectFieldProps {
  id: string;
  label: string;
  options: SelectOption[];
  value: string[];
  onChange: (v: string[]) => void;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

export function MultiSelectField({
  id,
  label,
  options,
  value,
  onChange,
  required,
  disabled,
  "aria-label": ariaLabel,
  className,
}: MultiSelectFieldProps) {
  const toggle = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  return (
    <fieldset className={cn("space-y-2", className)} aria-labelledby={`${id}-legend`} aria-required={required}>
      <Label asChild>
        <span id={`${id}-legend`} className="text-base block">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </span>
      </Label>
      <div className="space-y-1" role="group" aria-label={ariaLabel ?? label}>
        {options.map((opt, i) => (
          <label
            key={opt.value}
            htmlFor={`${id}-${i}`}
            className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-input bg-transparent px-3 py-2 transition-colors has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
          >
            <input
              type="checkbox"
              id={`${id}-${i}`}
              value={opt.value}
              checked={value.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              disabled={disabled}
              aria-label={opt.label}
              aria-required={required && value.length === 0}
              className="size-5 shrink-0 border-input accent-primary"
            />
            <span className="text-base">{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
