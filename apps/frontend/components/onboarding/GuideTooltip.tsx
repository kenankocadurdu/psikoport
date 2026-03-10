"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STORAGE_PREFIX = "psikoport_tooltip_";

function hasBeenShown(id: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`${STORAGE_PREFIX}${id}`) === "1";
}

function markAsShown(id: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, "1");
  }
}

interface GuideTooltipProps {
  id: string;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactNode;
}

/**
 * Wraps a critical UI element and shows a tooltip on first use.
 * Once the user has seen it (tooltip closed), it won't show again (localStorage).
 */
export function GuideTooltip({
  id,
  content,
  side = "bottom",
  children,
}: GuideTooltipProps) {
  const [show, setShow] = React.useState(false);
  const hasShownRef = React.useRef(false);

  React.useEffect(() => {
    setShow(!hasBeenShown(id));
  }, [id]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && show && !hasShownRef.current) {
        hasShownRef.current = true;
        markAsShown(id);
        setShow(false);
      }
    },
    [id, show]
  );

  if (!show) return <>{children}</>;

  return (
    <Tooltip onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} className="max-w-[220px]">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
