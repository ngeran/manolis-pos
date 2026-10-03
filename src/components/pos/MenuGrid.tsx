"use client";

import { formatPrice, cn } from "@/lib/utils";

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
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function MenuGrid({
  items,
  activeCategory,
  onCategoryChange,
  categories,
  onAddItem,
  searchQuery,
  onSearchChange,
}: MenuGridProps) {
  const query = searchQuery.trim().toLowerCase();
  // Searching overrides the category filter so staff find items across the menu.
  const filtered = query
    ? items.filter(
        (i) =>
          i.nameEl.toLowerCase().includes(query) ||
          i.nameEn.toLowerCase().includes(query)
      )
    : activeCategory
      ? items.filter((i) => i.categoryId === activeCategory)
      : items;

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky search + category chips */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pt-1 pb-2 shadow-sm flex flex-col gap-2">
        <div className="relative">
          <span className="material-symbols-outlined text-outline absolute left-3 top-1/2 -translate-y-1/2 text-[20px] pointer-events-none">
            search
          </span>
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Αναζήτηση…"
            className="w-full bg-surface border border-outline-variant rounded-full pl-10 pr-10 py-2.5 text-base min-h-[44px] focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Καθαρισμός"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => onCategoryChange(null)}
            className={`px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap min-h-[44px] ${
              !activeCategory
                ? "bg-primary text-on-primary"
                : "bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-low"
            }`}
          >
            Όλα
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap min-h-[44px] ${
                activeCategory === cat.id
                  ? "bg-primary text-on-primary"
                  : "bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-low"
              }`}
            >
              {cat.nameEl}
            </button>
          ))}
        </div>
      </div>

      {/* Phone: dense 2-col tap-anywhere tiles; sm+: roomier image cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-4 pb-6">
        {filtered.map((item) => (
          <button
            key={item.id}
            onClick={() => item.available && onAddItem(item)}
            disabled={!item.available}
            className="bg-surface border border-outline-variant rounded-xl overflow-hidden text-left hover:border-primary-container active:bg-primary-container/10 transition-all flex flex-col h-full disabled:opacity-60"
          >
            <div className="relative w-full h-16 sm:h-auto sm:aspect-[3/2] shrink-0 overflow-hidden bg-surface-container-low">
              {item.imageUrl ? (
                <img
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  src={item.imageUrl}
                  alt={item.nameEl}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-outline text-[28px] sm:text-[48px]">
                    restaurant
                  </span>
                </div>
              )}
              {!item.available && (
                <div className="absolute inset-0 bg-surface/80 flex items-center justify-center">
                  <span className="text-error font-bold text-sm">
                    Μη διαθέσιμο
                  </span>
                </div>
              )}
            </div>

            <div className="p-2 sm:p-3 flex flex-col flex-grow gap-0.5 sm:gap-1 w-full">
              <h3 className="font-semibold text-sm sm:text-lg text-on-surface line-clamp-2 sm:line-clamp-1">
                {item.nameEl}
              </h3>
              <p className="text-[11px] sm:text-xs font-medium text-outline line-clamp-1 sm:line-clamp-2">
                {item.nameEn}
              </p>
              <div className="mt-auto pt-1 flex items-center justify-between gap-2 w-full">
                <span className="font-bold text-sm sm:text-base text-on-surface">
                  {formatPrice(item.priceCents)}
                  {item.pricingType === "weight" && (
                    <span className="text-xs text-outline font-normal">/kg</span>
                  )}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-lg bg-surface-container-low text-primary border border-primary-container font-semibold",
                    "min-h-[40px] min-w-[40px] px-2 flex items-center justify-center",
                    "sm:min-h-[48px] sm:flex-grow sm:gap-1 sm:text-sm sm:hover:bg-primary-container sm:hover:text-on-primary"
                  )}
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  <span className="hidden sm:inline">Προσθήκη</span>
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-outline py-10">
          Κανένα αποτέλεσμα{query ? ` για «${searchQuery.trim()}»` : ""}.
        </p>
      )}
    </div>
  );
}
