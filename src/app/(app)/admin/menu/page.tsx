"use client";

import { useEffect, useState, useRef } from "react";
import { formatPrice, cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

interface MenuItem {
  id: string;
  nameEl: string;
  nameEn: string;
  descriptionEl: string | null;
  descriptionEn: string | null;
  priceCents: number;
  pricingType: "unit" | "weight";
  available: boolean;
  imageUrl: string | null;
  categoryNameEl: string | null;
  categoryNameEn: string | null;
  categoryId: string;
  stationId: string;
  stationNameEl: string | null;
}

interface Category {
  id: string;
  nameEl: string;
  nameEn: string;
}

interface Station {
  id: string;
  slug: string;
  nameEl: string;
  nameEn: string;
}

interface ItemForm {
  nameEl: string;
  nameEn: string;
  descriptionEl: string;
  descriptionEn: string;
  categoryId: string;
  stationId: string;
  priceEuros: string;
  pricingType: "unit" | "weight";
  available: boolean;
  imageUrl: string;
}

const emptyForm: ItemForm = {
  nameEl: "",
  nameEn: "",
  descriptionEl: "",
  descriptionEn: "",
  categoryId: "",
  stationId: "",
  priceEuros: "",
  pricingType: "unit",
  available: true,
  imageUrl: "",
};

export default function AdminMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<MenuItem>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => {
        if (!r.ok) throw new Error(`Menu API: ${r.status}`);
        return r.json();
      })
      .then(setItems)
      .catch(console.error);
    fetch("/api/categories")
      .then((r) => {
        if (!r.ok) throw new Error(`Categories API: ${r.status}`);
        return r.json();
      })
      .then(setCategories)
      .catch(console.error);
    fetch("/api/stations")
      .then((r) => {
        if (!r.ok) throw new Error(`Stations API: ${r.status}`);
        return r.json();
      })
      .then(setStations)
      .catch(console.error);
  }, []);

  const handleToggleAvailable = async (id: string, available: boolean) => {
    await fetch("/api/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, available: !available }),
    });
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, available: !available } : i))
    );
  };

  const handleSave = async (id: string) => {
    await fetch("/api/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...editData }),
    });
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...editData } : i))
    );
    setEditing(null);
    setEditData({});
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await fetch("/api/menu", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const getImageDimensions = (
    dataUrl: string
  ): Promise<{ width: number; height: number }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = reject;
      img.src = dataUrl;
    });

  const handleImageUpload = async (
    file: File,
    target: "form" | "edit"
  ) => {
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be under 2MB");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    const { width, height } = await getImageDimensions(dataUrl);
    const ratio = width / height;
    if (ratio < 1.3 || ratio > 2.0) {
      alert(
        `Image aspect ratio is ${ratio.toFixed(2)}:1.\nRecommended: 3:2 (e.g. 600x400px).\nImages outside ~3:2 to ~2:1 will be cropped in the menu view.`
      );
    }
    if (target === "form") {
      setForm((f) => ({ ...f, imageUrl: dataUrl }));
    } else {
      setEditData((d) => ({ ...d, imageUrl: dataUrl }));
    }
  };

  const handleCreateItem = async () => {
    if (!form.nameEl || !form.nameEn || !form.categoryId || !form.stationId || !form.priceEuros) {
      alert("Please fill in name (EL & EN), category, station, and price.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameEl: form.nameEl,
          nameEn: form.nameEn,
          descriptionEl: form.descriptionEl || undefined,
          descriptionEn: form.descriptionEn || undefined,
          categoryId: form.categoryId,
          stationId: form.stationId,
          priceCents: Math.round(parseFloat(form.priceEuros) * 100),
          pricingType: form.pricingType,
          available: form.available,
          imageUrl: form.imageUrl || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create item");
      const newItem = await res.json();
      const cat = categories.find((c) => c.id === form.categoryId);
      setItems((prev) => [
        ...prev,
        {
          ...newItem,
          categoryNameEl: cat?.nameEl ?? null,
          categoryNameEn: cat?.nameEn ?? null,
        },
      ]);
      setShowAddModal(false);
      setForm(emptyForm);
    } catch (err) {
      console.error(err);
      alert("Failed to create item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-on-surface">Menu Management</h1>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setForm(emptyForm);
            setShowAddModal(true);
          }}
        >
          <span className="material-symbols-outlined">add</span>
          Add Item
        </Button>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant">
              <h2 className="text-xl font-bold text-on-surface">Add Menu Item</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {/* Image */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-2">
                  Image
                </label>
                {form.imageUrl ? (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden border border-outline-variant mb-2">
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                      className="absolute top-2 right-2 bg-surface/90 rounded-full p-1 hover:bg-error-container"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="material-symbols-outlined text-[18px]">upload</span>
                    Upload
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, "form");
                      e.target.value = "";
                    }}
                  />
                  <span className="text-xs text-outline self-center">600×400px, max 2MB</span>
                </div>
                <input
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm mt-2"
                  placeholder="https://example.com/image.jpg"
                  value={form.imageUrl.startsWith("data:") ? "" : form.imageUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, imageUrl: e.target.value }))
                  }
                />
              </div>

              {/* Name EL */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-1">
                  Name (Greek) *
                </label>
                <input
                  className="w-full border border-outline-variant rounded-lg px-3 py-2"
                  value={form.nameEl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nameEl: e.target.value }))
                  }
                />
              </div>

              {/* Name EN */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-1">
                  Name (English) *
                </label>
                <input
                  className="w-full border border-outline-variant rounded-lg px-3 py-2"
                  value={form.nameEn}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nameEn: e.target.value }))
                  }
                />
              </div>

              {/* Description EL */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-1">
                  Description (Greek)
                </label>
                <textarea
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 resize-none"
                  rows={2}
                  value={form.descriptionEl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, descriptionEl: e.target.value }))
                  }
                />
              </div>

              {/* Description EN */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-1">
                  Description (English)
                </label>
                <textarea
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 resize-none"
                  rows={2}
                  value={form.descriptionEn}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, descriptionEn: e.target.value }))
                  }
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-1">
                  Category *
                </label>
                <select
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface"
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categoryId: e.target.value }))
                  }
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nameEl} / {cat.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Station */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-1">
                  Prep Station *
                </label>
                <select
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface"
                  value={form.stationId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stationId: e.target.value }))
                  }
                >
                  <option value="">Select station...</option>
                  {stations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.nameEl} / {st.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-1">
                  {form.pricingType === "weight" ? "Price per kg (€) *" : "Price (€) *"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full border border-outline-variant rounded-lg px-3 py-2"
                  placeholder="0.00"
                  value={form.priceEuros}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priceEuros: e.target.value }))
                  }
                />
              </div>

              {/* Pricing Type */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-1">
                  Pricing Type *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, pricingType: "unit" }))}
                    className={cn(
                      "flex-1 py-3 rounded-lg font-semibold text-sm min-h-[48px] border transition-all",
                      form.pricingType === "unit"
                        ? "bg-primary text-on-primary border-primary"
                        : "bg-surface text-on-surface border-outline-variant hover:bg-surface-container-low"
                    )}
                  >
                    Per Unit
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, pricingType: "weight" }))}
                    className={cn(
                      "flex-1 py-3 rounded-lg font-semibold text-sm min-h-[48px] border transition-all",
                      form.pricingType === "weight"
                        ? "bg-primary text-on-primary border-primary"
                        : "bg-surface text-on-surface border-outline-variant hover:bg-surface-container-low"
                    )}
                  >
                    Per Kilo (/kg)
                  </button>
                </div>
              </div>

              {/* Available */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, available: e.target.checked }))
                  }
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm font-semibold text-on-surface">
                  Available
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-outline-variant">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleCreateItem}
                disabled={saving}
              >
                {saving ? "Saving..." : "Create Item"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-outline-variant overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="text-left p-3 font-semibold text-sm text-outline w-12">Image</th>
              <th className="text-left p-3 font-semibold text-sm text-outline">Name (EL / EN)</th>
              <th className="text-left p-3 font-semibold text-sm text-outline">Category</th>
              <th className="text-left p-3 font-semibold text-sm text-outline">Price</th>
              <th className="text-left p-3 font-semibold text-sm text-outline">Status</th>
              <th className="text-right p-3 font-semibold text-sm text-outline">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low"
              >
                <td className="p-3">
                  {editing === item.id ? (
                    <div className="flex flex-col gap-1">
                      {(editData.imageUrl ?? item.imageUrl) ? (
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden">
                          <img
                            src={editData.imageUrl ?? item.imageUrl ?? ""}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setEditData((d) => ({ ...d, imageUrl: null }))}
                            className="absolute -top-1 -right-1 bg-surface rounded-full w-4 h-4 flex items-center justify-center shadow"
                          >
                            <span className="material-symbols-outlined text-[10px]">close</span>
                          </button>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        className="text-xs text-primary"
                      >
                        Change
                      </button>
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file, "edit");
                          e.target.value = "";
                        }}
                      />
                    </div>
                  ) : item.imageUrl ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.nameEl}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center">
                      <span className="material-symbols-outlined text-outline text-[18px]">
                        restaurant
                      </span>
                    </div>
                  )}
                </td>
                <td className="p-3">
                  {editing === item.id ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-outline w-8 shrink-0">EL</span>
                        <input
                          className="border border-outline-variant rounded-lg px-3 py-1 text-base flex-1"
                          value={editData.nameEl ?? item.nameEl}
                          onChange={(e) =>
                            setEditData({ ...editData, nameEl: e.target.value })
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-outline w-8 shrink-0">EN</span>
                        <input
                          className="border border-outline-variant rounded-lg px-3 py-1 text-base flex-1"
                          value={editData.nameEn ?? item.nameEn}
                          onChange={(e) =>
                            setEditData({ ...editData, nameEn: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="font-medium text-on-surface">{item.nameEl}</span>
                      <span className="block text-sm text-outline">{item.nameEn}</span>
                    </div>
                  )}
                </td>
                <td className="p-3 text-base text-outline">
                  {editing === item.id ? (
                    <div className="flex flex-col gap-2">
                      <select
                        className="border border-outline-variant rounded-lg px-3 py-1 text-base bg-surface"
                        value={editData.categoryId ?? item.categoryId}
                        onChange={(e) =>
                          setEditData({ ...editData, categoryId: e.target.value })
                        }
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.nameEl} / {cat.nameEn}
                          </option>
                        ))}
                      </select>
                      <select
                        className="border border-outline-variant rounded-lg px-3 py-1 text-base bg-surface"
                        value={editData.stationId ?? item.stationId}
                        onChange={(e) =>
                          setEditData({ ...editData, stationId: e.target.value })
                        }
                      >
                        {stations.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.nameEl} / {st.nameEn}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <span>{item.categoryNameEl}</span>
                      {item.stationNameEl && (
                        <span className="block text-xs text-outline">
                          {item.stationNameEl}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-3 font-bold text-on-surface">
                  {editing === item.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="number"
                        className="border border-outline-variant rounded-lg px-3 py-1 w-24 text-base"
                        value={(editData.priceCents ?? item.priceCents) / 100}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            priceCents: Math.round(parseFloat(e.target.value) * 100),
                          })
                        }
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setEditData((d) => ({ ...d, pricingType: "unit" }))}
                          className={cn(
                            "px-2 py-1 rounded text-xs font-semibold border",
                            (editData.pricingType ?? item.pricingType) === "unit"
                              ? "bg-primary text-on-primary border-primary"
                              : "bg-surface text-on-surface border-outline-variant"
                          )}
                        >
                          Unit
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditData((d) => ({ ...d, pricingType: "weight" }))}
                          className={cn(
                            "px-2 py-1 rounded text-xs font-semibold border",
                            (editData.pricingType ?? item.pricingType) === "weight"
                              ? "bg-primary text-on-primary border-primary"
                              : "bg-surface text-on-surface border-outline-variant"
                          )}
                        >
                          /kg
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span>
                      {formatPrice(item.priceCents)}
                      {item.pricingType === "weight" && <span className="text-xs text-outline font-normal">/kg</span>}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => handleToggleAvailable(item.id, item.available)}
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.available
                        ? "bg-primary-container text-on-primary"
                        : "bg-error-container text-error"
                    }`}
                  >
                    {item.available ? "Available" : "Unavailable"}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {editing === item.id ? (
                      <>
                        <Button variant="primary" size="sm" onClick={() => handleSave(item.id)}>
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(null);
                            setEditData({});
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(item.id);
                            setEditData({});
                          }}
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          <span className="material-symbols-outlined text-[18px] text-error">
                            delete
                          </span>
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
