"use client";

import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  minimal: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/30",
  },
  mild: {
    bg: "bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/30",
  },
  moderate: {
    bg: "bg-orange-500/15",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-500/30",
  },
  moderate_severe: {
    bg: "bg-red-500/15",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-500/30",
  },
  moderately_severe: {
    bg: "bg-red-500/15",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-500/30",
  },
  severe: {
    bg: "bg-red-700/20",
    text: "text-red-800 dark:text-red-300",
    border: "border-red-700/40",
  },
};

interface SeverityBadgeProps {
  level: string | null | undefined;
  label?: string | null;
  className?: string;
}

export function SeverityBadge({ level, label, className }: SeverityBadgeProps) {
  if (!level) return null;

  const key = level.toLowerCase().replace(/\s/g, "_");
  const styles = SEVERITY_STYLES[key] ?? {
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    border: "border-border",
  };

  const display = label ?? level;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles.bg,
        styles.text,
        styles.border,
        className
      )}
      title={display}
    >
      {display}
    </span>
  );
}
