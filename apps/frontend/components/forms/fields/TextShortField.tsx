"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type TextShortType = "text_short" | "email" | "phone";

interface TextShortFieldProps {
  id: string;
  label: string;
  type?: TextShortType;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

const inputTypeMap: Record<TextShortType, React.HTMLInputTypeAttribute> = {
  text_short: "text",
  email: "email",
  phone: "tel",
};

export function TextShortField({
  id,
  label,
  type = "text_short",
  value,
  onChange,
  placeholder,
  required,
  disabled,
  "aria-label": ariaLabel,
  className,
}: TextShortFieldProps) {
  const inputType = inputTypeMap[type];

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-base">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={id}
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        aria-required={required}
        className="min-h-[44px]"
      />
    </div>
  );
}
