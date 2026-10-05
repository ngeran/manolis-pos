"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { MenuItemData } from "./MenuGrid";

interface ModifierModalProps {
  item: MenuItemData;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
}

/**
 * Shown when a menu item has predefined options (doneness, without onion…).
 * Single-choice option + optional free comment; combined into the item's
 * notes so kitchen, board and detail all display them.
 */
export function ModifierModal({ item, onConfirm, onCancel }: ModifierModalProps) {
  const options = item.modifierOptions ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const submit = () => {
    const parts = [selected, comment.trim()].filter(Boolean);
    onConfirm(parts.join(" · "));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-outline-variant">
          <div>
            <h2 className="text-lg font-bold text-on-surface">{item.nameEl}</h2>
            {options.length > 0 && (
              <p className="text-xs text-outline">Επιλέξτε προτίμηση</p>
            )}
          </div>
          <button
            onClick={onCancel}
            className="text-outline hover:text-on-surface min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelected((s) => (s === opt ? null : opt))}
                  className={cn(
                    "px-4 py-2.5 rounded-xl border-2 font-semibold text-sm min-h-[44px] transition-colors",
                    selected === opt
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant bg-surface text-on-surface hover:border-primary-container"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-outline mb-1">
              Σχόλιο (προαιρετικό)
            </label>
            <textarea
              rows={2}
              autoFocus
              className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-base bg-surface resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              placeholder="π.χ. λίγο λεμόνι από πάνω…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 border-t border-outline-variant flex justify-end gap-3">
          <Button variant="ghost" size="md" onClick={onCancel}>
            Κλείσιμο
          </Button>
          <Button variant="primary" size="md" onClick={submit}>
            Προσθήκη
          </Button>
        </div>
      </div>
    </div>
  );
}
