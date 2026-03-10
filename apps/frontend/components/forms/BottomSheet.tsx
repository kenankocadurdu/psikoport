"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  trigger: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * Mobile-friendly bottom sheet for dropdown/select alternatives.
 * Renders from bottom on mobile.
 */
export function BottomSheet({
  trigger,
  title,
  children,
  open,
  onOpenChange,
  className,
}: BottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className={cn(
          "inset-x-0 top-auto max-h-[80vh] rounded-t-2xl flex flex-col",
          className
        )}
      >
        {title && (
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
        )}
        <div className="flex-1 overflow-y-auto py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
