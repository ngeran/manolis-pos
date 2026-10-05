"use client";

import { useState } from "react";
import { useCustomers, useCreateCustomer, useUpdateCustomer, type Customer } from "@/hooks/useCustomers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/Button";
import { formatPrice, cn } from "@/lib/utils";

function lastVisitLabel(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("el-GR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data: customers, isLoading } = useCustomers(debouncedSearch);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    dietaryNotes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setForm({ firstName: "", lastName: "", phone: "", email: "", dietaryNotes: "" });
    setEditing(null);
    setShowForm(true);
    setError("");
  };

  const openEdit = (c: Customer) => {
    setForm({
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email ?? "",
      dietaryNotes: c.dietaryNotes ?? "",
    });
    setEditing(c);
    setShowForm(true);
    setError("");
  };

  const save = async () => {
    if (!form.firstName.trim() || !form.phone.trim()) {
      setError("Όνομα και τηλέφωνο είναι υποχρεωτικά.");
      return;
    }
    setSaving(true);
    setError("");
    const payload: Record<string, unknown> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      // Empty strings are sanitized by the API ("" clears the field on edit).
      email: form.email.trim(),
      dietaryNotes: form.dietaryNotes.trim(),
    };
    if (editing) payload.id = editing.id;
    try {
      if (editing) {
        await updateCustomer.mutateAsync(payload as { id: string } & Record<string, unknown>);
      } else {
        await createCustomer.mutateAsync(payload);
      }
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full p-4 md:p-6 overflow-y-auto min-w-0">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h1 className="text-3xl font-bold text-on-surface">Πελάτες</h1>
        <Button variant="primary" size="md" onClick={openCreate}>
          <span className="material-symbols-outlined">person_add</span>
          Νέος πελάτης
        </Button>
      </div>

      <div className="relative max-w-md mb-4">
        <span className="material-symbols-outlined text-outline absolute left-3 top-1/2 -translate-y-1/2 text-[20px] pointer-events-none">
          search
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Όνομα ή τηλέφωνο…"
          className="w-full bg-surface border border-outline-variant rounded-full pl-10 pr-3 py-2 text-base min-h-[44px] focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      {error && (
        <div className="bg-error-container text-error rounded-lg px-4 py-2 text-sm font-semibold mb-4">
          {error}
        </div>
      )}

      {/* Create / edit form */}
      {showForm && (
        <div className="bg-surface rounded-xl border border-outline-variant p-4 mb-4">
          <p className="text-sm font-bold text-on-surface mb-3">
            {editing ? `Επεξεργασία: ${editing.firstName} ${editing.lastName}` : "Νέος πελάτης"}
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <input
              className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[44px] w-36 bg-surface"
              placeholder="Όνομα *"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <input
              className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[44px] w-40 bg-surface"
              placeholder="Επώνυμο"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
            <input
              className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[44px] w-40 bg-surface"
              placeholder="Τηλέφωνο *"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <input
              className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[44px] w-48 bg-surface"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <input
              className="border border-outline-variant rounded-lg px-3 py-2 text-base min-h-[44px] flex-1 min-w-[180px] bg-surface"
              placeholder="Διατροφικές σημειώσεις (αλλεργίες κ.λπ.)"
              value={form.dietaryNotes}
              onChange={(e) => setForm((f) => ({ ...f, dietaryNotes: e.target.value }))}
            />
            <div className="flex gap-1">
              <Button variant="primary" size="md" onClick={save} disabled={saving}>
                Αποθήκευση
              </Button>
              <Button variant="ghost" size="md" onClick={() => setShowForm(false)}>
                Άκυρο
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-outline py-10 text-center">Φόρτωση…</p>
      ) : !customers || customers.length === 0 ? (
        <div className="text-center py-10 text-outline">
          <span className="material-symbols-outlined text-[56px] block mb-2">group_off</span>
          <p>Κανένας πελάτης{debouncedSearch ? " για την αναζήτηση" : ""}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {customers.map((c) => (
            <div
              key={c.id}
              className="bg-surface border border-outline-variant rounded-xl p-3 flex flex-wrap items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-extrabold shrink-0">
                {c.firstName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-on-surface truncate">
                  {c.firstName} {c.lastName}
                </p>
                <p className="text-xs text-outline truncate">
                  {c.phone}
                  {c.dietaryNotes ? ` · ${c.dietaryNotes}` : ""}
                </p>
              </div>
              <div className="text-xs text-outline text-right shrink-0">
                <p>{c.totalVisits} επισκέψεις</p>
                <p>Τελευταία: {lastVisitLabel(c.lastVisit)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
