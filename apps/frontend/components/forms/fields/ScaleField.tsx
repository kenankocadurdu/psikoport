"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface ScaleFieldProps {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

export function ScaleField({
  id,
  label,
  min,
  max,
  value,
  onChange,
  required,
  disabled,
  "aria-label": ariaLabel,
  className,
}: ScaleFieldProps) {
  const [localValue, setLocalValue] = React.useState(value);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-base">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <span
          className="min-w-[2ch] text-right text-lg font-medium tabular-nums"
          aria-hidden
        >
          {localValue}
        </span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={1}
        value={[localValue]}
        onValueChange={([v]) => {
          setLocalValue(v);
          onChange(v);
        }}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        aria-required={required}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={localValue}
        className="[&>span:last-of-type]:h-8 [&>span:last-of-type]:w-8"
      />
    </div>
  );
}
