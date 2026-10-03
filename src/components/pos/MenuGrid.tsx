"use client";

import { useEffect, useState } from "react";
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

type MenuView = "pictures" | "list";

interface MenuGridProps {
  items: MenuItemData[];
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  categories: { id: string; nameEl: string; nameEn: string }[];
  onAddItem: (item: MenuItemData) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  /** Rendered inside the sticky header, above the search (e.g. table picker chip). */
  headerSlot?: React.ReactNode;
}

export function MenuGrid({
  items,
  activeCategory,
  onCategoryChange,
  categories,
  onAddItem,
  searchQuery,
  onSearchChange,
  headerSlot,
}: MenuGridProps) {
  const [view, setView] = useState<MenuView>("pictures");
  const query = searchQuery.trim().toLowerCase();

  // Remember the preferred layout. One-time client init keeps SSR markup stable.
  useEffect(() => {
    const stored = localStorage.getItem("pos-menu-view");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of persisted setting
    if (stored === "pictures" || stored === "list") setView(stored);
  }, []);

  const selectView = (next: MenuView) => {
    setView(next);
    localStorage.setItem("pos-menu-view", next);
  };

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
    <div className="flex flex-col gap-4 min-w-0">
      {/* Sticky header: destination chip + search + view switch, then category chips */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pt-1 pb-2 shadow-sm flex flex-col gap-2 min-w-0">
        <div className="flex flex-col sm:flex-row gap-2">
          {headerSlot}
          <div className="relative flex-1 min-w-0">
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
              className="w-full bg-surface border border-outline-variant rounded-full pl-10 pr-4 py-2.5 text-base min-h-[44px] focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="flex bg-surface-container-low rounded-lg p-0.5 shrink-0 self-center">
            <button
              onClick={() => selectView("pictures")}
              className={cn(
                "px-3 min-h-[40px] rounded-md flex items-center justify-center transition-colors",
                view === "pictures"
                  ? "bg-primary text-on-primary"
                  : "text-outline hover:text-on-surface"
              )}
              title="Προβολή με εικόνες"
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
            </button>
            <button
              onClick={() => selectView("list")}
              className={cn(
                "px-3 min-h-[40px] rounded-md flex items-center justify-center transition-colors",
                view === "list"
                  ? "bg-primary text-on-primary"
                  : "text-outline hover:text-on-surface"
              )}
              title="Συμπαγής λίστα"
            >
              <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
            </button>
          </div>
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

      {view === "pictures" ? (
        /* Column count scales with the screen: 2 phones → 5 on large desktops */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3 pb-6">
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => item.available && onAddItem(item)}
              disabled={!item.available}
              className="bg-surface border border-outline-variant rounded-xl overflow-hidden text-left hover:border-primary-container active:bg-primary-container/10 transition-all flex flex-col h-full disabled:opacity-60"
            >
              <div className="relative w-full h-16 sm:aspect-[3/2] sm:h-auto shrink-0 overflow-hidden bg-surface-container-low">
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
                    <span className="material-symbols-outlined text-outline text-[26px] sm:text-[40px]">
                      restaurant
                    </span>
                  </div>
                )}
                {!item.available && (
                  <div className="absolute inset-0 bg-surface/80 flex items-center justify-center">
                    <span className="text-error font-bold text-sm">Μη διαθέσιμο</span>
                  </div>
                )}
              </div>

              <div className="p-2 sm:p-3 flex flex-col flex-grow gap-0.5 sm:gap-1 w-full">
                <h3 className="font-semibold text-sm sm:text-base text-on-surface line-clamp-2">
                  {item.nameEl}
                </h3>
                <p className="text-[11px] sm:text-xs font-medium text-outline line-clamp-1">
                  {item.nameEn}
                </p>
                <div className="mt-auto pt-1 flex items-center justify-between gap-2 w-full">
                  <span className="font-bold text-sm text-on-surface">
                    {formatPrice(item.priceCents)}
                    {item.pricingType === "weight" && (
                      <span className="text-xs text-outline font-normal">/kg</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-lg bg-surface-container-low text-primary border border-primary-container font-semibold",
                      "min-h-[38px] min-w-[38px] px-2 flex items-center justify-center",
                      "sm:min-h-[44px] hover:bg-primary-container hover:text-on-primary"
                    )}
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Compact list rows — fastest scanning, no images */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-6">
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => item.available && onAddItem(item)}
              disabled={!item.available}
              className={cn(
                "flex items-center gap-3 w-full text-left px-3 py-2 bg-surface border rounded-lg min-h-[54px]",
                "hover:border-primary-container active:bg-primary-container/10 transition-all disabled:opacity-60",
                item.available ? "border-outline-variant" : "border-error/40"
              )}
            >
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm sm:text-base text-on-surface truncate block leading-tight">
                  {item.nameEl}
                </span>
                <span className="text-xs text-outline truncate block">
                  {item.nameEn}
                </span>
              </div>
              <span className="font-bold text-sm text-on-surface shrink-0">
                {formatPrice(item.priceCents)}
                {item.pricingType === "weight" && (
                  <span className="text-xs text-outline font-normal">/kg</span>
                )}
              </span>
              {item.available ? (
                <span className="shrink-0 min-h-[40px] min-w-[40px] rounded-lg bg-surface-container-low text-primary border border-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">add</span>
                </span>
              ) : (
                <span className="shrink-0 text-xs font-bold text-error">Μη διαθ.</span>
              )}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-center text-outline py-10">
          Κανένα αποτέλεσμα{query ? ` για «${searchQuery.trim()}»` : ""}.
        </p>
      )}
    </div>
  );
}
