"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { DiningTable } from "@/lib/kitchen";

export default function AdminTablesPage() {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [newName, setNewName] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [newSeats, setNewSeats] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name: string; nickname: string; seats: string }>({
    name: "",
    nickname: "",
    seats: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTables = () =>
    fetch("/api/tables")
      .then((r) => {
        if (!r.ok) throw new Error(`Tables API: ${r.status}`);
        return r.json();
      })
      .then(setTables)
      .catch((err) => setError(String(err)));

  useEffect(() => {
    loadTables();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) {
      setError("Συμπληρώστε όνομα τραπεζιού.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          nickname: newNickname.trim() || undefined,
          seats: newSeats ? parseInt(newSeats, 10) : undefined,
          sortOrder: tables.length,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          res.status === 403
            ? "Admin access required"
            : data?.error ?? "Failed to add table"
        );
        return;
      }
      setTables((prev) => [...prev, data]);
      setNewName("");
      setNewNickname("");
      setNewSeats("");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: editData.name.trim(),
          nickname: editData.nickname.trim() || null,
          seats: editData.seats ? parseInt(editData.seats, 10) : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(res.status === 403 ? "Admin access required" : data?.error ?? "Failed to save");
        return;
      }
      setTables((prev) => prev.map((t) => (t.id === id ? data : t)));
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Διαγραφή τραπεζιού; Ανοιχτές παραγγελίες δεν επηρεάζονται.")) return;
    const res = await fetch("/api/tables", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.status === 403) {
      setError("Admin access required");
      return;
    }
    setTables((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="w-full p-4 md:p-6 overflow-y-auto">
      <h1 className="text-3xl font-bold text-on-surface mb-6">Τραπέζια</h1>

      {error && (
        <div className="bg-error-container text-error rounded-lg px-4 py-2 text-sm font-semibold mb-4">
          {error}
        </div>
      )}

      {/* Add row */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <input
          className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[48px] w-28"
          placeholder="Όνομα (π.χ. 13)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <input
          className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[48px] w-40"
          placeholder="Παρατσούκλι"
          value={newNickname}
          onChange={(e) => setNewNickname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <input
          type="number"
          min="1"
          className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[48px] w-28"
          placeholder="Θέσεις"
          value={newSeats}
          onChange={(e) => setNewSeats(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button variant="primary" size="md" onClick={handleAdd} disabled={saving}>
          <span className="material-symbols-outlined">add</span>
          Προσθήκη
        </Button>
      </div>

      <div className="bg-surface rounded-xl border border-outline-variant">
        {tables.length === 0 ? (
          <p className="p-6 text-center text-outline">
            Κανένα τραπέζι — προσθέστε το πρώτο.
          </p>
        ) : (
          tables.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 p-3 border-b border-outline-variant last:border-0"
            >
              {editing === t.id ? (
                <>
                  <input
                    className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[44px] w-28"
                    value={editData.name}
                    onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleSave(t.id)}
                  />
                  <input
                    className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[44px] w-40"
                    placeholder="Παρατσούκλι"
                    value={editData.nickname}
                    onChange={(e) => setEditData((d) => ({ ...d, nickname: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleSave(t.id)}
                  />
                  <input
                    type="number"
                    min="1"
                    className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[44px] w-24"
                    placeholder="Θέσεις"
                    value={editData.seats}
                    onChange={(e) => setEditData((d) => ({ ...d, seats: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleSave(t.id)}
                  />
                  <div className="ml-auto flex gap-1">
                    <Button variant="primary" size="sm" onClick={() => handleSave(t.id)} disabled={saving}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-outline">table_restaurant</span>
                  <span className="font-bold text-on-surface text-lg">{t.name}</span>
                  {t.nickname && (
                    <span className="text-sm text-outline font-semibold">· {t.nickname}</span>
                  )}
                  {t.seats != null && (
                    <span className="text-sm text-outline flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">event_seat</span>
                      {t.seats}
                    </span>
                  )}
                  <div className={cn("ml-auto flex gap-1")}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(t.id);
                        setEditData({
                          name: t.name,
                          nickname: t.nickname ?? "",
                          seats: t.seats?.toString() ?? "",
                        });
                      }}
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}>
                      <span className="material-symbols-outlined text-[18px] text-error">
                        delete
                      </span>
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-outline mt-4">
        Παραγγελίες Takeaway και παραγγελίες σε τραπέζια που δεν υπάρχουν εδώ
        εμφανίζονται στην άποψη Τραπέζια ως ξεχωριστά πλακίδια.
      </p>
    </div>
  );
}
