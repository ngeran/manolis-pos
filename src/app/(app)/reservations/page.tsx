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

const POLL_MS = 15000;

function athensToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Athens" });
}

function athensNowHM(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Athens",
  });
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
  confirmed: "Κράτηση",
  seated: "Καθισμένοι",
  cancelled: "Ακυρώθηκε",
  no_show: "No show",
};

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-warning-container text-on-warning-container",
  seated: "bg-primary-container text-on-primary-container",
  cancelled: "bg-surface-container-low text-outline",
  no_show: "bg-error-container text-error",
};

function exportCSV(rows: Reservation[]) {
  const headers = ["Date", "Time", "Customer", "Phone", "Email", "Party", "Table", "Status", "Requests"];
  const body = rows.map((r) => [
    r.reservationDate,
    displayTime(r.reservationTime),
    `${r.customerFirstName} ${r.customerLastName}`.trim(),
    r.customerPhone,
    r.customerEmail ?? "",
    r.partySize,
    r.tableName ?? "",
    r.status,
    r.specialRequests ?? "",
  ]);
  const csv = [headers, ...body].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kratiseis-${rows[0]?.reservationDate ?? "export"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReservationsPage() {
  const router = useRouter();
  const [date, setDate] = useState(athensToday);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);

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
  const weekCovers = (weekReservations ?? [])
    .filter((r) => r.status === "confirmed")
    .reduce((sum, r) => sum + r.partySize, 0);

  const countFor = (day: string) =>
    (weekReservations ?? [])
      .filter((r) => r.reservationDate === day && r.status !== "cancelled")
      .reduce((sum, r) => sum + r.partySize, 0);

  const monthLabel = new Date(`${date}T12:00:00`).toLocaleDateString("el-GR", {
    month: "long",
    year: "numeric",
  });
  const dayLabelLong = new Date(`${date}T12:00:00`).toLocaleDateString("el-GR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

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
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface capitalize">{monthLabel}</h1>
          <p className="text-sm text-outline font-semibold">
            Εβδομάδα: {weekCovers} άτομα σε κρατήσεις
          </p>
        </div>
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
          <button
            onClick={() => weekReservations && exportCSV(weekReservations)}
            disabled={!weekReservations?.length}
            className="px-3 min-h-[44px] rounded-lg border border-outline-variant text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            CSV
          </button>
          <Button variant="primary" size="md" onClick={() => setShowForm(true)}>
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
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1">
        {weekDays.map((day, i) => (
          <div key={day} className="text-center text-[10px] sm:text-xs font-bold text-outline">
            {WEEKDAY_LABELS[i]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-5">
        {weekDays.map((day) => {
          const selected = day === date;
          const isToday = day === athensToday();
          const count = countFor(day);
          return (
            <button
              key={day}
              onClick={() => setDate(day)}
              className={cn(
                "rounded-xl border-2 p-1.5 sm:p-2.5 flex flex-col items-center gap-1 min-h-[64px] sm:min-h-[80px] transition-colors",
                selected
                  ? "border-primary bg-primary-container/20"
                  : isToday
                    ? "border-primary/50 bg-surface hover:bg-surface-container-low"
                    : "border-transparent bg-surface hover:bg-surface-container-low"
              )}
            >
              <span
                className={cn(
                  "text-[10px] sm:text-xs font-bold leading-none",
                  isToday ? "text-primary" : "text-outline"
                )}
              >
                {WEEKDAY_LABELS[weekDays.indexOf(day)]}
              </span>
              <span
                className={cn(
                  "text-base sm:text-xl font-extrabold leading-none",
                  selected ? "text-primary" : "text-on-surface"
                )}
              >
                {parseInt(day.slice(8), 10)}
              </span>
              {count > 0 ? (
                <span
                  className={cn(
                    "text-[9px] sm:text-[10px] font-bold rounded-full px-1.5",
                    selected
                      ? "bg-primary text-on-primary"
                      : "bg-primary-container text-on-primary-container"
                  )}
                >
                  {count}
                </span>
              ) : (
                <span className="h-3.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day header */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="text-lg font-bold text-on-surface capitalize">{dayLabelLong}</h2>
        {date === athensToday() && (
          <span className="bg-primary text-on-primary rounded-full px-2.5 py-0.5 text-[10px] font-bold">
            ΣΗΜΕΡΑ
          </span>
        )}
        <span className="text-sm text-outline font-semibold">
          {dayRows.length} κρατήσεις · {covers} άτομα
          {cancelledCount > 0 ? ` · ${cancelledCount} ακυρωμένες` : ""}
        </span>
      </div>

      {/* Day timeline */}
      {isLoading ? (
        <p className="text-outline py-10 text-center">Φόρτωση…</p>
      ) : dayRows.length === 0 ? (
        <div className="bg-surface border border-dashed border-outline-variant rounded-2xl text-center py-12 px-6">
          <span className="material-symbols-outlined text-[56px] block mb-2 text-outline">
            event_busy
          </span>
          <p className="font-semibold text-on-surface">Καμία κράτηση για {dayLabelLong}</p>
          <p className="text-sm text-outline mt-1 mb-4">
            Χρησιμοποιήστε το «Νέα κράτηση» όταν μάθατε από τηλέφωνο.
          </p>
          <Button variant="secondary" size="md" onClick={() => setShowForm(true)}>
            <span className="material-symbols-outlined">event_available</span>
            Νέα κράτηση
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {dayRows.map((r, idx) => (
            <ReservationRow
              key={r.id}
              reservation={r}
              isNext={
                date === athensToday() &&
                r.status === "confirmed" &&
                r.reservationTime >= athensNowHM() &&
                !dayRows.some(
                  (x, j) =>
                    j < idx &&
                    x.status === "confirmed" &&
                    x.reservationTime >= athensNowHM()
                )
              }
              onSeat={() => seat(r)}
              onEdit={() => setEditing(r)}
              onNoShow={() => updateRes.mutate({ id: r.id, status: "no_show" })}
              onCancel={() => cancelRes.mutate(r.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ReservationFormModal defaultDate={date} onClose={() => setShowForm(false)} />
      )}
      {editing && (
        <ReservationFormModal
          existing={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ── Reservation row (timeline style) ─────────────────────────────────

function ReservationRow({
  reservation: r,
  isNext,
  onSeat,
  onEdit,
  onNoShow,
  onCancel,
}: {
  reservation: Reservation;
  isNext: boolean;
  onSeat: () => void;
  onEdit: () => void;
  onNoShow: () => void;
  onCancel: () => void;
}) {
  const guest = `${r.customerFirstName} ${r.customerLastName}`.trim();

  return (
    <div
      className={cn(
        "bg-surface border rounded-xl p-3 flex flex-wrap items-center gap-3",
        r.status === "confirmed" && isNext && "border-primary",
        r.status === "confirmed" && !isNext && "border-outline-variant",
        r.status === "seated" && "border-outline-variant opacity-80",
        (r.status === "cancelled" || r.status === "no_show") && "border-outline-variant opacity-50"
      )}
    >
      {/* Time block */}
      <div className="w-14 shrink-0 text-center">
        <p className="text-lg font-extrabold text-on-surface leading-none">
          {displayTime(r.reservationTime)}
        </p>
        <p className="text-[10px] font-semibold text-outline mt-0.5">
          {r.partySize} άτομα
        </p>
      </div>

      <div className="w-px self-stretch bg-outline-variant" />

      {/* Guest info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p
            className={cn(
              "font-bold text-on-surface truncate",
              (r.status === "cancelled" || r.status === "no_show") && "line-through"
            )}
          >
            {guest}
          </p>
          {isNext && r.status === "confirmed" && (
            <span className="bg-primary text-on-primary rounded-full px-2 py-0.5 text-[9px] font-bold shrink-0">
              ΕΠΟΜΕΝΟ
            </span>
          )}
        </div>
        <p className="text-xs text-outline truncate">
          {r.tableName ? `Τραπέζι ${r.tableName}` : "Χωρίς τραπέζι"}
          {` · ${r.customerPhone}`}
          {r.customerEmail ? ` · ${r.customerEmail}` : ""}
        </p>
        {r.specialRequests && (
          <p className="text-xs text-tertiary font-semibold flex items-center gap-1 truncate mt-0.5">
            <span className="material-symbols-outlined text-[12px]">sticky_note_2</span>
            {r.specialRequests}
          </p>
        )}
      </div>

      {/* Status */}
      <span
        className={cn(
          "px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0",
          STATUS_STYLE[r.status] ?? "bg-surface-container-low text-outline"
        )}
      >
        {STATUS_LABEL[r.status] ?? r.status}
      </span>

      {/* Actions */}
      {r.status === "confirmed" && (
        <div className="flex gap-1 shrink-0 ml-auto">
          <Button variant="primary" size="sm" onClick={onSeat}>
            <span className="material-symbols-outlined text-[16px]">event_seat</span>
            Κάθισμα
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} title="Επεξεργασία">
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onNoShow} title="Δεν εμφανίστηκαν">
            <span className="material-symbols-outlined text-[18px]">person_off</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} title="Ακύρωση">
            <span className="material-symbols-outlined text-[18px] text-error">cancel</span>
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Create / edit modal ──────────────────────────────────────────────

function ReservationFormModal({
  existing,
  defaultDate,
  onClose,
}: {
  existing?: Reservation;
  defaultDate?: string;
  onClose: () => void;
}) {
  const isEdit = !!existing;
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const debounced = useDebouncedValue(customerSearch);
  const { data: found } = useCustomers(
    !isEdit && debounced.trim().length >= 3 ? debounced.trim() : undefined
  );
  const createRes = useCreateReservation();
  const updateRes = useUpdateReservation();
  const [form, setForm] = useState({
    customerName: existing
      ? `${existing.customerFirstName} ${existing.customerLastName}`.trim()
      : "",
    customerPhone: existing?.customerPhone ?? "",
    customerEmail: existing?.customerEmail ?? "",
    partySize: String(existing?.partySize ?? 2),
    reservationDate: existing?.reservationDate ?? defaultDate ?? athensToday(),
    reservationTime: displayTime(existing?.reservationTime ?? "21:00:00"),
    tableId: existing?.tableId ?? "",
    specialRequests: existing?.specialRequests ?? "",
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
    const payload = {
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      customerEmail: form.customerEmail.trim() || undefined,
      partySize: Math.max(1, parseInt(form.partySize, 10) || 2),
      reservationTime: form.reservationTime,
      tableId: form.tableId || undefined,
      specialRequests: form.specialRequests.trim() || undefined,
    };
    try {
      if (isEdit) {
        await updateRes.mutateAsync({ id: existing!.id, ...payload });
      } else {
        await createRes.mutateAsync({ ...payload, reservationDate: form.reservationDate });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-outline-variant">
          <h2 className="text-lg font-bold text-on-surface">
            {isEdit ? "Επεξεργασία κράτησης" : "Νέα κράτηση"}
          </h2>
          <button
            onClick={onClose}
            className="text-outline hover:text-on-surface min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {!isEdit && found && found.length > 0 && (
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-outline mb-1">Ημερομηνία</label>
              <input
                type="date"
                value={form.reservationDate}
                onChange={(e) => setForm((f) => ({ ...f, reservationDate: e.target.value }))}
                className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-outline mb-1">Ώρα</label>
              <input
                type="time"
                step={1800}
                value={form.reservationTime}
                onChange={(e) => setForm((f) => ({ ...f, reservationTime: e.target.value }))}
                className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-outline mb-1">Τηλέφωνο *</label>
              <input
                className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface"
                placeholder="69…"
                value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-outline mb-1">Άτομα</label>
              <input
                type="number"
                min="1"
                className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface"
                value={form.partySize}
                onChange={(e) => setForm((f) => ({ ...f, partySize: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-outline mb-1">Όνομα *</label>
              <input
                className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface"
                placeholder="π.χ. Γιώργος Παπαδόπουλος"
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-outline mb-1">
                Email (προαιρετικό)
              </label>
              <input
                type="email"
                className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface"
                placeholder="π.χ. giorgos@example.gr"
                value={form.customerEmail}
                onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-outline mb-1">Τραπέζι</label>
              <select
                className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface"
                value={form.tableId}
                onChange={(e) => setForm((f) => ({ ...f, tableId: e.target.value }))}
              >
                <option value="">Χωρίς τραπέζι…</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.nickname ? ` · ${t.nickname}` : ""} ({t.seats ?? "?"} θέσεις)
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-outline mb-1">
                Ειδικές απαιτήσεις
              </label>
              <textarea
                rows={2}
                className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-base bg-surface resize-none"
                placeholder="καρεκλάκι, αλλεργίες, γιορτή…"
                value={form.specialRequests}
                onChange={(e) => setForm((f) => ({ ...f, specialRequests: e.target.value }))}
              />
            </div>
          </div>

          {error && <p className="text-sm font-semibold text-error">{error}</p>}
        </div>

        <div className="p-4 border-t border-outline-variant flex justify-end gap-3">
          <Button variant="ghost" size="md" onClick={onClose}>
            Κλείσιμο
          </Button>
          <Button variant="primary" size="md" onClick={submit} disabled={saving}>
            {isEdit ? "Αποθήκευση" : "Κράτηση"}
          </Button>
        </div>
      </div>
    </div>
  );
}
