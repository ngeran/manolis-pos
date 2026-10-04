"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReservationStatus } from "@/lib/db/schema";

export interface Reservation {
  id: string;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  status: ReservationStatus;
  specialRequests: string | null;
  createdAt: string;
  customerId: string;
  tableId: string | null;
  orderId: string | null;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  tableName: string | null;
}

function onAuthFailure(status: number) {
  if (status === 401) {
    window.location.assign(
      `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`
    );
  }
}

export function useReservations(opts?: { date?: string; from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (opts?.date) params.set("date", opts.date);
  if (opts?.from) params.set("from", opts.from);
  if (opts?.to) params.set("to", opts.to);

  return useQuery<Reservation[]>({
    queryKey: ["reservations", opts?.date ?? null, opts?.from ?? null, opts?.to ?? null],
    queryFn: async () => {
      const res = await fetch(`/api/reservations?${params}`);
      onAuthFailure(res.status);
      if (!res.ok) throw new Error("Failed to fetch reservations");
      return res.json();
    },
  });
}

export interface CreateReservationInput {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  partySize: number;
  reservationDate?: string;
  reservationTime: string;
  tableId?: string;
  specialRequests?: string;
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateReservationInput) => {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      onAuthFailure(res.status);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Failed to create reservation (${res.status})`);
      }
      return body;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}

type ReservationPatch = Partial<
  Pick<Reservation, "partySize" | "reservationTime" | "status" | "specialRequests" | "tableId">
>;

// Apply a patch optimistically to every cached reservations list so the UI
// reacts instantly; rolled back on failure.
function patchCachedReservations(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  patch: ReservationPatch
) {
  const cached = qc.getQueriesData<Reservation[]>({ queryKey: ["reservations"] });
  for (const [key, data] of cached) {
    if (!data) continue;
    qc.setQueryData<Reservation[]>(
      key,
      data.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }
  return cached;
}

export function useUpdateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & ReservationPatch) => {
      const res = await fetch(`/api/reservations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      onAuthFailure(res.status);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to update reservation");
      return body;
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["reservations"] });
      const previous = patchCachedReservations(qc, id, patch);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
      onAuthFailure(res.status);
      if (!res.ok) throw new Error("Failed to cancel reservation");
      return res.json();
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["reservations"] });
      const previous = patchCachedReservations(qc, id, { status: "cancelled" });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}
