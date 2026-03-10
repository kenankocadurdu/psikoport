"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TimeFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

export function TimeField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  "aria-label": ariaLabel,
  className,
}: TimeFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-base">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={id}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        aria-required={required}
        className="min-h-[44px]"
      />
    </div>
  );
}
