"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePolling } from "@/hooks/usePolling";
import { Button } from "@/components/ui/Button";
import { useOrderStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { guestsLabel } from "@/lib/kitchen";
import type { DiningTable, ReservationRow } from "@/lib/kitchen";

const POLL_MS = 15000;

function athensToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Athens" });
}

/**
 * Phone bookings for a business day. "Κάθισμα" pre-fills the POS with the
 * reservation's table, party size and name; the reservation is marked seated
 * when that order is sent to the kitchen.
 */
export default function ReservationsPage() {
  const router = useRouter();
  const [date, setDate] = useState(athensToday);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [form, setForm] = useState({
    time: "",
    name: "",
    guests: "2",
    phone: "",
    notes: "",
    tableId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { data, isStale, refresh } = usePolling<{ date: string; reservations: ReservationRow[] }>(
    `/api/reservations?date=${date}`,
    { intervalMs: POLL_MS }
  );

  useEffect(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then(setTables)
      .catch(() => {});
  }, []);

  const reservations = data?.reservations ?? [];

  const handleAdd = async () => {
    if (!form.time || !form.name.trim()) {
      setError("Συμπληρώστε ώρα και όνομα.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessDate: date,
          time: form.time,
          name: form.name.trim(),
          guests: Math.max(1, parseInt(form.guests, 10) || 2),
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
          tableId: form.tableId || undefined,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(payload?.error ?? "Αποτυχία καταχώρησης");
        return;
      }
      setForm((f) => ({ ...f, name: "", phone: "", notes: "" }));
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const cancelReservation = async (id: string) => {
    await fetch("/api/reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "cancelled" }),
    });
    refresh();
  };

  const seat = (r: ReservationRow) => {
    const s = useOrderStore.getState();
    s.setTableSelection(
      r.tableId && r.tableName ? [{ id: r.tableId, name: r.tableName }] : []
    );
    s.setGuests(r.guests);
    s.setGuestName(r.name);
    s.setReservationId(r.id);
    router.push("/pos");
  };

  return (
    <div className="w-full p-4 md:p-6 overflow-y-auto min-w-0">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h1 className="text-3xl font-bold text-on-surface">Κρατήσεις</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || athensToday())}
          className="bg-surface border border-outline-variant rounded-full px-4 py-2 text-sm min-h-[44px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      {error && (
        <div className="bg-error-container text-error rounded-lg px-4 py-2 text-sm font-semibold mb-4">
          {error}
        </div>
      )}
      {isStale && (
        <div className="bg-warning-container text-on-warning-container rounded-lg px-4 py-2 text-sm font-semibold mb-4">
          Αποσύνδεση — επανασύνδεση…
        </div>
      )}

      {/* New reservation */}
      <div className="bg-surface rounded-xl border border-outline-variant p-4 mb-6">
        <p className="text-sm font-bold text-on-surface mb-3">Νέα κράτηση</p>
        <div className="flex flex-wrap gap-2 items-end">
          <input
            type="time"
            value={form.time}
            onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
            className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[48px] bg-surface"
          />
          <input
            className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[48px] flex-1 min-w-[160px]"
            placeholder="Όνομα *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <input
            type="number"
            min="1"
            className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[48px] w-20"
            placeholder="Άτομα"
            value={form.guests}
            onChange={(e) => setForm((f) => ({ ...f, guests: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <select
            className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[48px] bg-surface"
            value={form.tableId}
            onChange={(e) => setForm((f) => ({ ...f, tableId: e.target.value }))}
          >
            <option value="">Τραπέζι…</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.nickname ? ` · ${t.nickname}` : ""} ({t.seats ?? "?"})
              </option>
            ))}
          </select>
          <input
            className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[48px] w-36"
            placeholder="Τηλέφωνο"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button variant="primary" size="md" onClick={handleAdd} disabled={saving}>
            <span className="material-symbols-outlined">event_available</span>
            Κράτηση
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {reservations.length === 0 ? (
          <div className="text-center py-10 text-outline">
            <span className="material-symbols-outlined text-[56px] block mb-2">
              event_busy
            </span>
            <p>Καμία κράτηση για {date}</p>
          </div>
        ) : (
          reservations.map((r) => (
            <div
              key={r.id}
              className={cn(
                "bg-surface border rounded-xl p-3 flex flex-wrap items-center gap-3",
                r.status === "cancelled" && "opacity-50",
                r.status === "reserved" && "border-primary-container"
              )}
            >
              <span className="text-lg font-extrabold text-on-surface w-16 shrink-0">
                {r.time}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "font-bold text-on-surface truncate",
                    r.status === "cancelled" && "line-through"
                  )}
                >
                  {r.name}
                </p>
                <p className="text-xs text-outline truncate">
                  {guestsLabel(r.guests)}
                  {r.tableName ? ` · Τραπέζι ${r.tableName}` : " · χωρίς τραπέζι"}
                  {r.phone ? ` · ${r.phone}` : ""}
                  {r.notes ? ` · ${r.notes}` : ""}
                </p>
              </div>
              {r.status === "reserved" ? (
                <span className="bg-warning-container text-on-warning-container px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0">
                  ΚΡΑΤΗΣΗ
                </span>
              ) : r.status === "seated" ? (
                <span className="bg-primary-container text-on-primary-container px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0">
                  ΚΑΘΙΣΜΕΝΟΙ
                </span>
              ) : (
                <span className="bg-surface-container-low text-outline px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0">
                  ΑΚΥΡΩΘΗΚΕ
                </span>
              )}
              {r.status === "reserved" && (
                <div className="flex gap-1 shrink-0">
                  <Button variant="primary" size="sm" onClick={() => seat(r)}>
                    <span className="material-symbols-outlined text-[16px]">event_seat</span>
                    Κάθισμα
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => cancelReservation(r.id)}>
                    Ακύρωση
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
