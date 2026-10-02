"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface NoteModalProps {
  itemName: string;
  initialNotes: string;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
}

export function NoteModal({ itemName, initialNotes, onConfirm, onCancel }: NoteModalProps) {
  const [notes, setNotes] = useState(initialNotes);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Item notes</h2>
            <p className="text-sm text-outline">{itemName}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-outline hover:text-on-surface min-h-[48px] min-w-[48px] flex items-center justify-center"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            autoFocus
            placeholder="e.g. no onion, well done..."
            className="w-full border border-outline-variant rounded-lg px-3 py-3 text-base bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-outline-variant">
          <Button variant="ghost" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={() => onConfirm(notes)}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
