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
import type { ReservationStatus } from "@/lib/db/schema";

const STATUS_LABEL: Record<ReservationStatus, string> = {
  reserved: "Κράτηση",
  confirmed: "Κράτηση",
  seated: "Καθισμένοι",
  cancelled: "Ακυρώθηκε",
  no_show: "Δεν εμφανίστηκαν",
};

const STATUS_STYLE: Record<ReservationStatus, string> = {
  reserved: "bg-warning-container text-on-warning-container",
  confirmed: "bg-warning-container text-on-warning-container",
  seated: "bg-primary-container text-on-primary-container",
  cancelled: "bg-surface-container-low text-outline",
  no_show: "bg-error-container text-error",
};

function athensToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Athens" });
}

function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("el-GR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function exportCSV(rows: Reservation[]) {
  const headers = ["Date", "Time", "Customer", "Phone", "Party", "Table", "Status", "Requests"];
  const body = rows.map((r) => [
    r.reservationDate,
    displayTime(r.reservationTime),
    `${r.customerFirstName} ${r.customerLastName}`.trim(),
    r.customerPhone,
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
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);

  const { data: reservations, isLoading } = useReservations({ date });
  const createRes = useCreateReservation();
  const updateRes = useUpdateReservation();
  const cancelRes = useCancelReservation();

  const dayRows = useMemo(
    () =>
      (reservations ?? [])
        .filter((r) => r.status !== "cancelled")
        .sort((a, b) => a.reservationTime.localeCompare(b.reservationTime)),
    [reservations]
  );
  const covers = dayRows.reduce((sum, r) => sum + r.partySize, 0);

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
            onClick={() => reservations && dayRows.length > 0 && exportCSV(dayRows)}
            disabled={!reservations || dayRows.length === 0}
            className="px-3 min-h-[44px] rounded-lg border border-outline-variant text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            CSV
          </button>
          <Button variant="primary" size="md" onClick={() => setShowAdd(true)}>
            <span className="material-symbols-outlined">event_available</span>
            Νέα κράτηση
          </Button>
        </div>
      </div>

      {/* Day navigation */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setDate((d) => shiftDay(d, -1))}
          className="p-2 min-h-[44px] min-w-[44px] rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-high flex items-center justify-center"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <button
          onClick={() => setDate(athensToday())}
          className="px-4 min-h-[44px] rounded-lg border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container-high"
        >
          {date === athensToday() ? "Σήμερα" : dayLabel(date)}
        </button>
        <button
          onClick={() => setDate((d) => shiftDay(d, 1))}
          className="p-2 min-h-[44px] min-w-[44px] rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-high flex items-center justify-center"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm min-h-[44px] text-on-surface"
        />
        {dayRows.length > 0 && (
          <span className="text-sm text-outline font-semibold">
            {dayRows.length} κρατήσεις · {covers} άτομα
          </span>
        )}
      </div>

      {/* Day list */}
      {isLoading ? (
        <p className="text-outline py-10 text-center">Φόρτωση…</p>
      ) : dayRows.length === 0 ? (
        <div className="text-center py-10 text-outline">
          <span className="material-symbols-outlined text-[56px] block mb-2">event_busy</span>
          <p>Καμία κράτηση για αυτή την ημέρα</p>
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
                  r.status === "confirmed" && "border-primary-container",
                  r.status === "cancelled" && "opacity-50",
                  r.status === "no_show" && "opacity-60"
                )}
              >
                <span className="text-lg font-extrabold text-on-surface w-14 shrink-0">
                  {displayTime(r.reservationTime)}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "font-bold text-on-surface truncate",
                      (r.status === "cancelled" || r.status === "no_show") && "line-through"
                    )}
                  >
                    {guest}
                  </p>
                  <p className="text-xs text-outline truncate">
                    {r.partySize} άτομα
                    {r.tableName ? ` · Τραπέζι ${r.tableName}` : ""}
                    {` · ${r.customerPhone}`}
                    {r.specialRequests ? ` · ${r.specialRequests}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0",
                    STATUS_STYLE[r.status]
                  )}
                >
                  {STATUS_LABEL[r.status]}
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
                      onClick={() =>
                        updateRes.mutate({ id: r.id, status: "no_show" })
                      }
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
                      <span className="material-symbols-outlined text-[16px] text-error">
                        cancel
                      </span>
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddReservationModal onClose={() => setShowAdd(false)} onDone={() => setShowAdd(false)} />}
      {editing && (
        <EditReservationModal
          reservation={editing}
          onClose={() => setEditing(null)}
          onEdit={(r) => setEditing({ ...r })}
        />
      )}
    </div>
  );
}

function AddReservationModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
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
    partySize: "2",
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

  // Phone/name lookup: picking a known customer autofills the name.
  const pickCustomer = (id: string) => {
    const c = found?.find((x) => x.id === id);
    if (!c) return;
    setForm((f) => ({
      ...f,
      customerName: `${c.firstName} ${c.lastName}`.trim(),
      customerPhone: c.phone,
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
        partySize: Math.max(1, parseInt(form.partySize, 10) || 2),
        reservationTime: form.reservationTime,
        tableId: form.tableId || undefined,
        specialRequests: form.specialRequests.trim() || undefined,
      });
      onDone();
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
        <ModalHeader title="Νέα κράτηση" onClose={onClose} />
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
          <input
            className="border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface"
            placeholder="Τηλέφωνο *"
            value={form.customerPhone}
            onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
          />
          <input
            className="border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface"
            placeholder="Όνομα *"
            value={form.customerName}
            onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
          />
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              className="border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] w-24 bg-surface"
              value={form.partySize}
              onChange={(e) => setForm((f) => ({ ...f, partySize: e.target.value }))}
            />
            <input
              type="time"
              step={1800}
              className="border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface flex-1"
              value={form.reservationTime}
              onChange={(e) => setForm((f) => ({ ...f, reservationTime: e.target.value }))}
            />
          </div>
          <select
            className="border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface"
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
          <textarea
            rows={2}
            className="border border-outline-variant rounded-lg px-3 py-2.5 text-base bg-surface resize-none"
            placeholder="Ειδικές απαιτήσεις (π.χ. καρεκλάκι, without onion…)"
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

function EditReservationModal({
  reservation,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
  onEdit: (r: Reservation) => void;
}) {
  const updateRes = useUpdateReservation();
  const cancelRes = useCancelReservation();
  const [form, setForm] = useState({
    partySize: String(reservation.partySize),
    reservationTime: displayTime(reservation.reservationTime),
    specialRequests: reservation.specialRequests ?? "",
  });
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    try {
      await updateRes.mutateAsync({
        id: reservation.id,
        partySize: Math.max(1, parseInt(form.partySize, 10) || reservation.partySize),
        reservationTime: form.reservationTime,
        specialRequests: form.specialRequests.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader
          title={`${reservation.customerFirstName} ${reservation.customerLastName}`}
          onClose={onClose}
        />
        <div className="p-4 flex flex-col gap-3">
          <p className="text-sm text-outline">{reservation.customerPhone}</p>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              className="border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] w-24 bg-surface"
              value={form.partySize}
              onChange={(e) => setForm((f) => ({ ...f, partySize: e.target.value }))}
            />
            <input
              type="time"
              step={1800}
              className="border border-outline-variant rounded-lg px-3 py-2.5 text-base min-h-[44px] bg-surface flex-1"
              value={form.reservationTime}
              onChange={(e) => setForm((f) => ({ ...f, reservationTime: e.target.value }))}
            />
          </div>
          <textarea
            rows={2}
            className="border border-outline-variant rounded-lg px-3 py-2.5 text-base bg-surface resize-none"
            placeholder="Ειδικές απαιτήσεις"
            value={form.specialRequests}
            onChange={(e) => setForm((f) => ({ ...f, specialRequests: e.target.value }))}
          />
          {reservation.status === "confirmed" && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  updateRes.mutate({ id: reservation.id, status: "seated" });
                  onClose();
                }}
                className="text-xs font-semibold bg-primary-container text-on-primary-container rounded-full px-3 py-1.5"
              >
                Καθισμένοι (χωρίς παραγγελία)
              </button>
              <button
                onClick={() => {
                  updateRes.mutate({ id: reservation.id, status: "no_show" });
                  onClose();
                }}
                className="text-xs font-semibold bg-error-container text-error rounded-full px-3 py-1.5"
              >
                No show
              </button>
              <button
                onClick={() => {
                  cancelRes.mutate(reservation.id);
                  onClose();
                }}
                className="text-xs font-semibold text-error rounded-full px-3 py-1.5"
              >
                Ακύρωση κράτησης
              </button>
            </div>
          )}
          {error && <p className="text-sm font-semibold text-error">{error}</p>}
        </div>
        <div className="p-4 border-t border-outline-variant flex justify-end gap-3">
          <Button variant="ghost" size="md" onClick={onClose}>
            Κλείσιμο
          </Button>
          <Button variant="primary" size="md" onClick={save}>
            Αποθήκευση
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-outline-variant">
      <h2 className="text-lg font-bold text-on-surface truncate">{title}</h2>
      <button
        onClick={onClose}
        className="text-outline hover:text-on-surface min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>
  );
}
