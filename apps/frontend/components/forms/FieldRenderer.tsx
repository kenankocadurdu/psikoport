"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { SingleSelectField } from "./fields/SingleSelectField";
import { MultiSelectField } from "./fields/MultiSelectField";
import { cn } from "@/lib/utils";

export interface FormFieldSchema {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: { min?: number; max?: number; minLength?: number; maxLength?: number };
  condition?: { field: string; operator: string; value: string | number };
}

interface FieldRendererProps {
  field: FormFieldSchema & { crisisTrigger?: { values: string[]; action: string } };
  value: unknown;
  onChange: (value: unknown) => void;
  onCrisisTrigger?: () => void;
  disabled?: boolean;
}

export function FieldRenderer({
  field,
  value,
  onChange,
  onCrisisTrigger,
  disabled = false,
}: FieldRendererProps) {
  const handleChange = (v: unknown) => {
    onChange(v);
    if (field.crisisTrigger && typeof v === "string" && field.crisisTrigger.values.includes(v)) {
      onCrisisTrigger?.();
    }
  };
  const id = `field-${field.id}`;
  const label = (
    <Label htmlFor={id} className="font-medium">
      {field.label}
      {field.required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );

  switch (field.type) {
    case "text_short":
      return (
        <div className="space-y-2">
          {label}
          <Input
            id={id}
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            disabled={disabled}
            maxLength={field.validation?.maxLength}
            className="min-h-[44px] text-base"
          />
        </div>
      );

    case "text_long":
      return (
        <div className="space-y-2">
          {label}
          <Textarea
            id={id}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            disabled={disabled}
            rows={4}
            maxLength={field.validation?.maxLength}
            className="min-h-[88px] resize-y text-base"
          />
        </div>
      );

    case "single_select":
      return (
        <SingleSelectField
          id={id}
          label={field.label}
          value={(value as string) ?? ""}
          onChange={(v) => handleChange(v)}
          options={field.options ?? []}
          required={field.required}
          disabled={disabled}
        />
      );

    case "multi_select":
      return (
        <MultiSelectField
          id={id}
          label={field.label}
          value={(value as string[]) ?? []}
          onChange={(v) => onChange(v)}
          options={field.options ?? []}
          required={field.required}
          disabled={disabled}
        />
      );

    case "number":
      return (
        <div className="space-y-2">
          {label}
          <Input
            id={id}
            type="number"
            value={(value as number | string) ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? undefined : Number(v));
            }}
            placeholder={field.placeholder}
            required={field.required}
            disabled={disabled}
            min={field.validation?.min}
            max={field.validation?.max}
            className="min-h-[44px] text-base"
          />
        </div>
      );

    case "email":
      return (
        <div className="space-y-2">
          {label}
          <Input
            id={id}
            type="email"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            disabled={disabled}
            className="min-h-[44px] text-base"
          />
        </div>
      );

    case "phone":
      return (
        <div className="space-y-2">
          {label}
          <Input
            id={id}
            type="tel"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            disabled={disabled}
            className="min-h-[44px] text-base"
          />
        </div>
      );

    case "date":
      return (
        <div className="space-y-2">
          {label}
          <Input
            id={id}
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            required={field.required}
            disabled={disabled}
            className="min-h-[44px] text-base"
          />
        </div>
      );

    case "time":
      return (
        <div className="space-y-2">
          {label}
          <Input
            id={id}
            type="time"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            required={field.required}
            disabled={disabled}
            className="min-h-[44px] text-base"
          />
        </div>
      );

    case "yes_no":
      return (
        <div className="space-y-2" role="group" aria-labelledby={id}>
          <div id={id}>{label}</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "yes", label: "Evet" },
              { value: "no", label: "Hayır" },
            ].map((opt) => {
              const checked =
                (value as string) === opt.value ||
                (value === true && opt.value === "yes") ||
                (value === false && opt.value === "no");
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "flex min-h-[44px] items-center justify-center gap-2 rounded-lg border cursor-pointer transition-colors",
                    checked
                      ? "border-primary bg-primary/10"
                      : "border-input hover:bg-muted/50"
                  )}
                >
                  <input
                    type="radio"
                    name={id}
                    value={opt.value}
                    checked={checked}
                    onChange={() => onChange(opt.value)}
                    disabled={disabled}
                    className="sr-only"
                  />
                  <span className="text-base font-medium">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      );

    case "rating":
    case "scale": {
      const min = field.validation?.min ?? 1;
      const max = field.validation?.max ?? 10;
      const numVal = typeof value === "number" ? value : value != null ? Number(value) : min;
      const safeVal = Math.min(Math.max(isNaN(numVal) ? min : numVal, min), max);
      return (
        <div className="space-y-4">
          {label}
          <div className="flex items-center gap-4">
            <Slider
              value={[safeVal]}
              onValueChange={([v]) => onChange(v)}
              min={min}
              max={max}
              step={1}
              disabled={disabled}
              className="flex-1 [&_[data-slot=thumb]]:size-8 [&_[data-slot=track]]:h-3"
            />
            <span className="text-lg font-medium tabular-nums w-8 text-center">{safeVal}</span>
          </div>
        </div>
      );
    }

    case "likert": {
      const opts = field.options ?? [];
      const selected = (value as string) ?? "";
      return (
        <div className="space-y-3" role="group" aria-labelledby={id}>
          <div id={id}>{label}</div>
          <div className="flex flex-wrap gap-2">
            {opts.map((opt) => {
              const checked = selected === opt.value;
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "flex min-h-[44px] min-w-[44px] items-center justify-center px-4 py-2 rounded-lg border text-base cursor-pointer transition-colors",
                    checked
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input hover:bg-muted/50"
                  )}
                >
                  <input
                    type="radio"
                    name={id}
                    value={opt.value}
                    checked={checked}
                    onChange={() => onChange(opt.value)}
                    disabled={disabled}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    default:
      return (
        <div className="space-y-2">
          {label}
          <Input
            id={id}
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        </div>
      );
  }
}
