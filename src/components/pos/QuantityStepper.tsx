"use client";

import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  /** Dense variant for the desktop ticket (mouse precision, smaller targets). */
  compact?: boolean;
}

export function QuantityStepper({
  quantity,
  onIncrement,
  onDecrement,
  compact = false,
}: QuantityStepperProps) {
  return (
    <div className={cn("flex items-center", compact ? "gap-0.5" : "gap-2")}>
      <button
        onClick={onDecrement}
        className={cn(
          "flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors shrink-0",
          compact
            ? "w-7 h-7 min-h-[30px] min-w-[30px]"
            : "w-8 h-8 min-h-[48px] min-w-[48px]"
        )}
      >
        <span className="material-symbols-outlined text-[18px]">remove</span>
      </button>
      <span className={cn("font-bold text-center", compact ? "w-5 text-sm" : "w-6")}>
        {quantity}
      </span>
      <button
        onClick={onIncrement}
        className={cn(
          "flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors shrink-0",
          compact
            ? "w-7 h-7 min-h-[30px] min-w-[30px]"
            : "w-8 h-8 min-h-[48px] min-w-[48px]"
        )}
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
      </button>
    </div>
  );
}
