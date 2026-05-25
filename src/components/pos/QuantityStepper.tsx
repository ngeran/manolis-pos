"use client";

interface QuantityStepperProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function QuantityStepper({
  quantity,
  onIncrement,
  onDecrement,
}: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onDecrement}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors min-h-[48px] min-w-[48px]"
      >
        <span className="material-symbols-outlined text-[18px]">remove</span>
      </button>
      <span className="font-bold w-6 text-center">{quantity}</span>
      <button
        onClick={onIncrement}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors min-h-[48px] min-w-[48px]"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
      </button>
    </div>
  );
}
