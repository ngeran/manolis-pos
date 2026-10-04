"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useReservations,
  useCreateReservation,
  useUpdateReservation,
  useCancelReservation,
} from "@/hooks/useReservations";
import { useCustomers } from "@/hooks/useCustomers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/Button";
import { useOrderStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { displayTime } from "@/lib/booking";
import type { Reservation } from "@/hooks/useReservations";
import type { DiningTable } from "@/lib/kitchen";

function athensToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Athens" });
}

function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday of the week containing `date`. */
function mondayOf(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAY_LABELS = ["Δευ", "Τρί", "Τετ", "Πέμ", "Παρ", "Σάβ", "Κυρ"];

const STATUS_LABEL: Record<string, string> = {
  reserved: "Κράτηση",
  confirmed: "Κράτηση",
  seated: "Καθισμένοι",
  cancelled: "Ακυρώθηκε",
  no_show: "Δεν εμφανίστηκαν",
};

const STATUS_STYLE: Record<string, string> = {
  reserved: "bg-warning-container text-on-warning-container",
  confirmed: "bg-warning-container text-on-warning-container",
  seated: "bg-primary-container text-on-primary-container",
  cancelled: "bg-surface-container-low text-outline",
  no_show: "bg-error-container text-error",
};

export default function ReservationsPage() {
  const router = useRouter();
  const [date, setDate] = useState(athensToday);
  const [showAdd, setShowAdd] = useState(false);

  const monday = mondayOf(date);
  const weekFrom = monday;
  const weekTo = shiftDay(monday, 6);

  const { data: weekReservations, isLoading, isStale } = useReservations({
    from: weekFrom,
    to: weekTo,
  });
  const createRes = useCreateReservation();
  const updateRes = useUpdateReservation();
  const cancelRes = useCancelReservation();

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftDay(monday, i)),
    [monday]
  );

  const dayRows = useMemo(
    () =>
      (weekReservations ?? [])
        .filter((r) => r.reservationDate === date && r.status !== "cancelled")
        .sort((a, b) => a.reservationTime.localeCompare(b.reservationTime)),
    [weekReservations, date]
  );
  const cancelledCount = (weekReservations ?? []).filter(
    (r) => r.reservationDate === date && r.status === "cancelled"
  ).length;
  const covers = dayRows.reduce((sum, r) => sum + r.partySize, 0);

  const countFor = (day: string) =>
    (weekReservations ?? [])
      .filter((r) => r.reservationDate === day && r.status !== "cancelled")
      .reduce((sum, r) => sum + r.partySize, 0);

  const seat = (r: Reservation) => {
    const s = useOrderStore.getState();
    s.setTableSelection(r.tableId && r.tableName ? [{ id: r.tableId, name: r.tableName }] : []);
    s.setGuests(r.partySize);
    s.setGuestName(`${r.customerFirstName} ${r.customerLastName}`.trim());
    s.setReservationId(r.id);
    router.push("/pos");
  };

  return (
    <div className="w-full p-4 md:p-6 overflow-y-auto min-w-0">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h1 className="text-3xl font-bold text-on-surface">Κρατήσεις</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setDate((d) => shiftDay(d, -7))}
            className="p-2 min-h-[44px] min-w-[44px] rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-high flex items-center justify-center"
            title="Προηγούμενη εβδομάδα"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button
            onClick={() => setDate(athensToday())}
            className="px-4 min-h-[44px] rounded-lg border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container-high"
          >
            Σήμερα
          </button>
          <button
            onClick={() => setDate((d) => shiftDay(d, 7))}
            className="p-2 min-h-[44px] min-w-[44px] rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-high flex items-center justify-center"
            title="Επόμενη εβδομάδα"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
          <Button variant="primary" size="md" onClick={() => setShowAdd(true)}>
            <span className="material-symbols-outlined">event_available</span>
            Νέα κράτηση
          </Button>
        </div>
      </div>

      {isStale && (
        <div className="bg-warning-container text-on-warning-container rounded-lg px-4 py-2 text-sm font-semibold mb-4">
          Αποσύνδεση — επανασύνδεση…
        </div>
      )}

      {/* Calendar week strip */}
      <div className="grid grid-cols-7 gap-1.5 mb-1">
        {weekDays.map((day, i) => (
          <div key={day} className="text-center text-[10px] font-bold text-outline">
            {WEEKDAY_LABELS[i]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {weekDays.map((day) => {
          const selected = day === date;
          const isToday = day === athensToday();
          const count = countFor(day);
          return (
            <button
              key={day}
              onClick={() => setDate(day)}
              className={cn(
                "rounded-xl border-2 p-2 flex flex-col items-center gap-0.5 min-h-[64px] transition-colors",
                selected
                  ? "border-primary bg-primary-container/20"
                  : "border-outline-variant bg-surface hover:border-primary-container"
              )}
            >
              <span
                className={cn(
                  "font-extrabold text-on-surface leading-none",
                  isToday ? "text-primary" : "text-sm"
                )}
              >
                {isToday ? "Σήμερα" : day.slice(8)}
              </span>
              <span className="text-[10px] text-outline">
                {count > 0 ? `${count} άτομα` : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected day list */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="text-lg font-bold text-on-surface">{dayLabel(date)}</h2>
        {dayRows.length > 0 && (
          <span className="text-sm text-outline font-semibold">
            {dayRows.length} κρατήσεις · {covers} άτομα
            {cancelledCount > 0 ? ` · ${cancelledCount} ακυρωμένες` : ""}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-outline py-10 text-center">Φόρτωση…</p>
      ) : dayRows.length === 0 ? (
        <div className="text-center py-10 text-outline">
          <span className="material-symbols-outlined text-[56px] block mb-2">event_busy</span>
          <p>Καμία κράτηση για {dayLabel(date)}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {dayRows.map((r) => {
            const guest = `${r.customerFirstName} ${r.customerLastName}`.trim();
            return (
              <div
                key={r.id}
                className={cn(
                  "bg-surface border rounded-xl p-3 flex flex-wrap items-center gap-3",
                  r.status === "confirmed" && "border-primary-container"
                )}
              >
                <span className="text-lg font-extrabold text-on-surface w-14 shrink-0">
                  {displayTime(r.reservationTime)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-on-surface truncate">{guest}</p>
                  <p className="text-xs text-outline truncate">
                    {r.partySize} άτομα
                    {r.tableName ? ` · Τραπέζι ${r.tableName}` : " · χωρίς τραπέζι"}
                    {` · ${r.customerPhone}`}
                    {r.customerEmail ? ` · ${r.customerEmail}` : ""}
                    {r.specialRequests ? ` · ${r.specialRequests}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0",
                    STATUS_STYLE[r.status] ?? "bg-surface-container-low text-outline"
                  )}
                >
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
                {r.status === "confirmed" && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="primary" size="sm" onClick={() => seat(r)}>
                      <span className="material-symbols-outlined text-[16px]">event_seat</span>
                      Κάθισμα
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateRes.mutate({ id: r.id, status: "no_show" })}
                      title="Δεν εμφανίστηκαν"
                    >
                      No show
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelRes.mutate(r.id)}
                      title="Ακύρωση"
                    >
                      <span className="material-symbols-outlined text-[16px] text-error">cancel</span>
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddReservationModal
          defaultDate={date}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("el-GR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ── Create modal ──────────────────────────────────────

function AddReservationModal({ defaultDate, onClose }: { defaultDate: string; onClose: () => void }) {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const debounced = useDebouncedValue(customerSearch);
  const { data: found } = useCustomers(
    debounced.trim().length >= 3 ? debounced.trim() : undefined
  );
  const createRes = useCreateReservation();
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    partySize: "2",
    reservationDate: defaultDate,
    reservationTime: "21:00",
    tableId: "",
    specialRequests: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then(setTables)
      .catch(() => {});
  }, []);

  const pickCustomer = (id: string) => {
    const c = found?.find((x) => x.id === id);
    if (!c) return;
    setForm((f) => ({
      ...f,
      customerName: `${c.firstName} ${c.lastName}`.trim(),
      customerPhone: c.phone,
      customerEmail: c.email ?? f.customerEmail,
    }));
  };

  const submit = async () => {
    if (!form.customerPhone.trim() || !form.customerName.trim()) {
      setError("Συμπληρώστε όνομα και τηλέφωνο.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createRes.mutateAsync({
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        partySize: Math.max(1, parseInt(form.partySize, 10) || 2),
        reservationDate: form.reservationDate,
        reservationTime: form.reservationTime,
        tableId: form.tableId || undefined,
        specialRequests: form.specialRequests.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-outline-variant">
          <h2 className="text-lg font-bold text-on-surface">
            Νέα κράτηση · {dayLabel(form.reservationDate)}
          </h2>
          <button
            onClick={onClose}
            className="text-outline hover:text-on-surface min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {found && found.length > 0 && (
            <div className="bg-primary-container/20 rounded-lg p-2">
              <p className="text-xs font-bold text-outline mb-1">Γνωστοί πελάτες:</p>
              <div className="flex flex-wrap gap-1">
                {found.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => pickCustomer(c.id)}
                    className="text-xs font-semibold bg-surface border border-outline-variant rounded-full px-2.5 py-1 hover:border-primary"
                  >
                    {c.firstName} {c.lastName} · {c.phone}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <input
              className="border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface flex-1"
              placeholder="Τηλέφωνο *"
              value={form.customerPhone}
              onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
            />
            <input
              type="number"
              min="1"
              className="border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] w-24 bg-surface"
              value={form.partySize}
              onChange={(e) => setForm((f) => ({ ...f, partySize: e.target.value }))}
            />
          </div>
          <input
            className="border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface"
            placeholder="Όνομα *"
            value={form.customerName}
            onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
          />
          <input
            type="email"
            className="border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface"
            placeholder="Email (προαιρετικό)"
            value={form.customerEmail}
            onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
          />
          <div className="flex gap-2">
            <input
              type="time"
              step={1800}
              className="border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface flex-1"
              value={form.reservationTime}
              onChange={(e) => setForm((f) => ({ ...f, reservationTime: e.target.value }))}
            />
            <select
              className="border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface flex-1"
              value={form.tableId}
              onChange={(e) => setForm((f) => ({ ...f, tableId: e.target.value }))}
            >
              <option value="">Τραπέζι (προαιρετικό)…</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.nickname ? ` · ${t.nickname}` : ""} ({t.seats ?? "?"} θέσεις)
                </option>
              ))}
            </select>
          </div>
          <textarea
            rows={2}
            className="border border-outline-variant rounded-lg px-3 py-2.5 text-base bg-surface resize-none"
            placeholder="Ειδικές απαιτήσεις (καρεκλάκι, αλλεργίες…)"
            value={form.specialRequests}
            onChange={(e) => setForm((f) => ({ ...f, specialRequests: e.target.value }))}
          />
          {error && <p className="text-sm font-semibold text-error">{error}</p>}
        </div>

        <div className="p-4 border-t border-outline-variant flex justify-end gap-3">
          <Button variant="ghost" size="md" onClick={onClose}>
            Κλείσιμο
          </Button>
          <Button variant="primary" size="md" onClick={submit} disabled={saving}>
            Κράτηση
          </Button>
        </div>
      </div>
    </div>
  );
}
