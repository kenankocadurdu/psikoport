"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TextLongFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  "aria-label"?: string;
  className?: string;
}

export function TextLongField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  disabled,
  rows = 4,
  "aria-label": ariaLabel,
  className,
}: TextLongFieldProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const adjustHeight = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 80)}px`;
  }, []);

  React.useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-base">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        aria-required={required}
        rows={rows}
        className="min-h-[80px] resize-none overflow-hidden"
      />
    </div>
  );
}
