"use client";

import { formatPrice } from "@/lib/utils";

export interface MenuItemData {
  id: string;
  nameEl: string;
  nameEn: string;
  descriptionEl: string | null;
  descriptionEn: string | null;
  priceCents: number;
  pricingType: "unit" | "weight";
  available: boolean;
  imageUrl: string | null;
  categoryId: string;
  categoryNameEl: string | null;
  categoryNameEn: string | null;
}

interface MenuGridProps {
  items: MenuItemData[];
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  categories: { id: string; nameEl: string; nameEn: string }[];
  onAddItem: (item: MenuItemData) => void;
}

export function MenuGrid({
  items,
  activeCategory,
  onCategoryChange,
  categories,
  onAddItem,
}: MenuGridProps) {
  const filtered = activeCategory
    ? items.filter((i) => i.categoryId === activeCategory)
    : items;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide sticky top-0 z-10 bg-background/95 backdrop-blur-sm pt-1 shadow-sm">
        <button
          onClick={() => onCategoryChange(null)}
          className={`px-6 py-3 rounded-full font-semibold text-sm whitespace-nowrap min-h-[48px] ${
            !activeCategory
              ? "bg-primary text-on-primary"
              : "bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-low"
          }`}
        >
          All Items
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`px-6 py-3 rounded-full font-semibold text-sm whitespace-nowrap min-h-[48px] ${
              activeCategory === cat.id
                ? "bg-primary text-on-primary"
                : "bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-low"
            }`}
          >
            {cat.nameEl}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-6">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-surface border border-outline-variant rounded-xl overflow-hidden group cursor-pointer hover:border-primary-container transition-all flex flex-col h-full"
          >
            <div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden bg-surface-container-low">
              {item.imageUrl ? (
                <img
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  src={item.imageUrl}
                  alt={item.nameEl}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-outline text-[48px]">
                    restaurant
                  </span>
                </div>
              )}
              <div className="absolute top-2 right-2 bg-surface/90 px-3 py-1 rounded-lg font-bold text-primary shadow-sm">
                {formatPrice(item.priceCents)}{item.pricingType === "weight" ? "/kg" : ""}
              </div>
              {!item.available && (
                <div className="absolute inset-0 bg-surface/80 flex items-center justify-center">
                  <span className="text-error font-bold">Unavailable</span>
                </div>
              )}
            </div>
            <div className="p-3 flex flex-col flex-grow">
              <h3 className="font-medium text-lg text-on-surface mb-1 line-clamp-1">
                {item.nameEl}
              </h3>
              <p className="text-xs font-medium text-outline mb-2 line-clamp-2">
                {item.nameEn}
              </p>
              <button
                onClick={() => item.available && onAddItem(item)}
                disabled={!item.available}
                className="mt-auto w-full py-3 bg-surface-container-low text-primary border border-primary-container rounded-lg font-semibold text-sm hover:bg-primary-container hover:text-on-primary flex items-center justify-center gap-1 min-h-[48px] disabled:opacity-50"
              >
                <span
                  className="material-symbols-outlined text-lg"
                >
                  add
                </span>{" "}
                Add to Order
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
