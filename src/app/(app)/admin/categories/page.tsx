"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

interface Category {
  id: string;
  nameEl: string;
  nameEn: string;
  sortOrder: number;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newNameEl, setNewNameEl] = useState("");
  const [newNameEn, setNewNameEn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editNameEl, setEditNameEl] = useState("");
  const [editNameEn, setEditNameEn] = useState("");

  const loadCategories = () => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => setError("Failed to load categories"));
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAdd = async () => {
    if (!newNameEl.trim() || !newNameEn.trim()) {
      setError("Both names are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameEl: newNameEl,
          nameEn: newNameEn,
          sortOrder: categories.length,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 403) {
          setError("Admin access required");
        } else {
          setError(data?.error?.fieldErrors?.nameEl?.[0] ?? "Failed to add category");
        }
        return;
      }
      const cat = await res.json();
      setCategories((prev) => [...prev, cat]);
      setNewNameEl("");
      setNewNameEn("");
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (cat: Category) => {
    setEditing(cat.id);
    setEditNameEl(cat.nameEl);
    setEditNameEn(cat.nameEn);
    setError(null);
  };

  const handleSave = async (id: string) => {
    if (!editNameEl.trim() || !editNameEn.trim()) {
      setError("Both names are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, nameEl: editNameEl, nameEn: editNameEn }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to update category");
        return;
      }
      const updated = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditing(null);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category? Menu items in this category will lose their category.")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        setError("Failed to delete category");
        return;
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full p-6 overflow-y-auto">
      <h1 className="text-3xl font-bold text-on-surface mb-6">Categories</h1>

      {error && (
        <div className="mb-4 px-4 py-3 bg-error-container text-on-error-container rounded-lg text-sm font-medium max-w-lg">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6 max-w-lg">
        <input
          className="flex-1 border border-outline-variant rounded-lg px-3 py-3 text-base bg-surface"
          placeholder="Greek name (e.g. Ορεκτικά)"
          value={newNameEl}
          onChange={(e) => setNewNameEl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <input
          className="flex-1 border border-outline-variant rounded-lg px-3 py-3 text-base bg-surface"
          placeholder="English name (e.g. Appetizers)"
          value={newNameEn}
          onChange={(e) => setNewNameEn(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button variant="primary" size="md" onClick={handleAdd} disabled={saving}>
          {saving ? "..." : "Add"}
        </Button>
      </div>

      <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden max-w-lg">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex justify-between items-center p-3 border-b border-outline-variant last:border-0"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm text-outline w-8">
                #{cat.sortOrder}
              </span>
              {editing === cat.id ? (
                <div className="flex flex-col gap-1">
                  <input
                    className="border border-outline-variant rounded-lg px-3 py-1 text-base bg-surface"
                    value={editNameEl}
                    onChange={(e) => setEditNameEl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave(cat.id)}
                  />
                  <input
                    className="border border-outline-variant rounded-lg px-3 py-1 text-base bg-surface"
                    value={editNameEn}
                    onChange={(e) => setEditNameEn(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave(cat.id)}
                  />
                </div>
              ) : (
                <div>
                  <span className="font-medium text-on-surface">{cat.nameEl}</span>
                  <span className="block text-sm text-outline">{cat.nameEn}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {editing === cat.id ? (
                <>
                  <Button variant="primary" size="sm" onClick={() => handleSave(cat.id)} disabled={saving}>
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => startEditing(cat)}>
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(cat.id)}>
                    <span className="material-symbols-outlined text-[18px] text-error">delete</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="p-6 text-center text-outline">No categories yet</div>
        )}
      </div>
    </div>
  );
}
