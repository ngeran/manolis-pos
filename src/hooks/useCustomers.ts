"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  totalVisits: number;
  totalSpentCents: number;
  dietaryNotes: string | null;
  birthday: string | null;
  createdAt: string;
  lastVisit: string | null;
  optInMarketing: boolean;
}

function onAuthFailure(status: number) {
  if (status === 401) {
    window.location.assign(
      `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`
    );
  }
}

export function useCustomers(search?: string) {
  const q = search && search.trim().length >= 2 ? `?search=${encodeURIComponent(search.trim())}` : "";
  return useQuery<Customer[]>({
    queryKey: ["customers", q],
    queryFn: async () => {
      const res = await fetch(`/api/customers${q}`);
      onAuthFailure(res.status);
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      onAuthFailure(res.status);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Failed to create customer (${res.status})`);
      }
      return body as Customer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      onAuthFailure(res.status);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to update customer");
      return body as Customer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}
