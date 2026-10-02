"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { VoidReason } from "@/lib/db/schema";

const REASONS: { value: VoidReason; label: string }[] = [
  { value: "wrong_item", label: "Λάθος προϊόν" },
  { value: "unavailable_86", label: "Δεν υπάρχει (86)" },
  { value: "customer_changed_mind", label: "Άλλαξε γνώμη ο πελάτης" },
  { value: "kitchen_error", label: "Λάθος κουζίνας" },
  { value: "other", label: "Άλλο" },
];

interface VoidModalProps {
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  onConfirm: (reason: VoidReason, note?: string) => void;
  onCancel: () => void;
}

/** Reason-picker for voiding an item or cancelling an order — audited server-side. */
export function VoidModal({
  title,
  subtitle,
  confirmLabel = "Ακύρωση",
  onConfirm,
  onCancel,
}: VoidModalProps) {
  const [reason, setReason] = useState<VoidReason | null>(null);
  const [note, setNote] = useState("");

  const noteRequired = reason === "other";
  const valid = reason !== null && (!noteRequired || note.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-on-surface">{title}</h2>
            {subtitle && <p className="text-sm text-outline truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onCancel}
            className="text-outline hover:text-on-surface min-h-[48px] min-w-[48px] flex items-center justify-center"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={cn(
                  "py-3 px-4 rounded-xl font-semibold text-base min-h-[48px] border text-left transition-all",
                  reason === r.value
                    ? "bg-error text-on-error border-error"
                    : "bg-surface text-on-surface border-outline-variant hover:bg-surface-container-low"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-semibold text-on-surface mb-1">
              Σημείωση{noteRequired ? " (απαραίτητη)" : " (προαιρετική)"}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={cn(
                "w-full border rounded-lg px-3 py-3 text-base bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none",
                noteRequired && !note.trim() ? "border-error" : "border-outline-variant"
              )}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-outline-variant">
          <Button variant="ghost" size="md" onClick={onCancel}>
            Κλείσιμο
          </Button>
          <Button
            variant="danger"
            size="md"
            disabled={!valid}
            onClick={() => reason && onConfirm(reason, note || undefined)}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
