"use client";

import { useState } from "react";
import { formatPrice, calculateLineTotal, kgToGrams, formatWeight } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { MenuItemData } from "./MenuGrid";
import { Button } from "@/components/ui/Button";

interface WeightPickerModalProps {
  item: MenuItemData;
  onConfirm: (grams: number) => void;
  onCancel: () => void;
}

const PRESETS = [
  { label: "1/4", grams: 250 },
  { label: "1/2", grams: 500 },
  { label: "3/4", grams: 750 },
  { label: "1", grams: 1000 },
  { label: "1.5", grams: 1500 },
  { label: "2", grams: 2000 },
];

export function WeightPickerModal({ item, onConfirm, onCancel }: WeightPickerModalProps) {
  const [selectedGrams, setSelectedGrams] = useState(0);
  const [customKg, setCustomKg] = useState("");

  const handleCustomChange = (value: string) => {
    setCustomKg(value);
    const kg = parseFloat(value);
    if (!isNaN(kg) && kg > 0) {
      setSelectedGrams(kgToGrams(kg));
    } else {
      setSelectedGrams(0);
    }
  };

  const handlePresetClick = (grams: number) => {
    setSelectedGrams(grams);
    setCustomKg("");
  };

  const lineTotal = selectedGrams > 0 ? calculateLineTotal(item.priceCents, selectedGrams) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <div>
            <h2 className="text-xl font-bold text-on-surface">{item.nameEl}</h2>
            <p className="text-sm text-outline">{formatPrice(item.priceCents)}/kg</p>
          </div>
          <button
            onClick={onCancel}
            className="text-outline hover:text-on-surface"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-3">
              Select weight
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.grams}
                  type="button"
                  onClick={() => handlePresetClick(preset.grams)}
                  className={cn(
                    "py-3 rounded-xl font-semibold text-sm min-h-[48px] border transition-all",
                    selectedGrams === preset.grams && customKg === ""
                      ? "bg-primary text-on-primary border-primary"
                      : "bg-surface text-on-surface border-outline-variant hover:bg-surface-container-low"
                  )}
                >
                  {preset.label} kg
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-on-surface mb-1">
              Custom weight (kg)
            </label>
            <input
              type="number"
              step="0.05"
              min="0.05"
              placeholder="e.g. 0.8"
              value={customKg}
              onChange={(e) => handleCustomChange(e.target.value)}
              className="w-full border border-outline-variant rounded-lg px-3 py-3 text-base min-h-[48px]"
            />
          </div>

          {selectedGrams > 0 && (
            <div className="bg-surface-container-low rounded-xl p-4 flex justify-between items-center">
              <div>
                <span className="text-sm text-outline">Weight</span>
                <p className="font-bold text-on-surface">{formatWeight(selectedGrams)}</p>
              </div>
              <div className="text-right">
                <span className="text-sm text-outline">Price</span>
                <p className="font-bold text-primary text-lg">{formatPrice(lineTotal)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-outline-variant">
          <Button variant="ghost" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={selectedGrams <= 0}
            onClick={() => onConfirm(selectedGrams)}
          >
            Add to Order
          </Button>
        </div>
      </div>
    </div>
  );
}
