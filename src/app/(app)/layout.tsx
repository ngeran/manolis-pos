"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useOrderStore } from "@/lib/store";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/pos", label: "New Order", icon: "table_restaurant" },
  { href: "/orders", label: "Orders", icon: "history" },
  { href: "/kitchen", label: "Kitchen", icon: "skillet" },
  { href: "/admin/menu", label: "Menu Admin", icon: "restaurant" },
  { href: "/admin/tables", label: "Tables", icon: "event_seat" },
  { href: "/admin/categories", label: "Categories", icon: "category" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tableNumber = useOrderStore((s) => s.tableNumber);
  const setTableNumber = useOrderStore((s) => s.setTableNumber);
  const { theme, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // The cart persists to localStorage; rehydrate after mount so the SSR
  // markup (which always renders an empty cart) matches the first client render.
  useEffect(() => {
    useOrderStore.persist.rehydrate();
  }, []);

  const isActive = (href: string) =>
    href === "/pos" ? pathname === "/pos" || pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className="fixed top-0 w-full z-50 flex justify-between items-center h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] px-3 md:px-6 bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="text-outline hover:bg-surface-container-high p-1 rounded-lg transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <span className="material-symbols-outlined">
              {sidebarOpen ? "menu_open" : "menu"}
            </span>
          </button>
          <span className="text-2xl md:text-3xl font-bold text-primary">Manolis</span>
        </div>
        <div className="flex items-center gap-2 md:gap-6">
          <div className="flex items-center gap-1 md:gap-3">
            <span className="material-symbols-outlined text-primary text-xl">table_restaurant</span>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="Table #"
              className="w-20 md:w-24 text-base font-semibold text-primary bg-transparent border-b border-primary-container focus:outline-none text-center"
            />
          </div>
          <div className="flex items-center gap-1 md:gap-3">
            <button
              onClick={toggle}
              className="text-outline hover:bg-surface-container-high p-1 rounded-lg transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span className="material-symbols-outlined">
                {theme === "dark" ? "light_mode" : "dark_mode"}
              </span>
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-outline hover:bg-surface-container-high p-1 rounded-lg transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
              title="Sign out"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex h-dvh pt-[calc(4rem+env(safe-area-inset-top))]">
        <nav
          className={cn(
            "fixed left-0 top-0 h-full w-[280px] z-40 flex flex-col p-3 bg-surface-container-low border-r border-outline-variant transition-transform duration-300 ease-in-out",
            !sidebarOpen && "-translate-x-full"
          )}
        >
          <div className="flex flex-col gap-1 flex-grow mt-[calc(4rem+env(safe-area-inset-top))]">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "font-medium flex items-center gap-3 px-3 py-3 rounded-lg min-h-[48px]",
                  isActive(item.href)
                    ? "bg-primary-container text-on-primary font-bold"
                    : "text-secondary hover:bg-surface-container-high"
                )}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-semibold text-sm">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        <main
          className={cn(
            // min-w-0: without it main's automatic min size tracks the widest
            // intrinsic content (e.g. the POS category chips row) and the whole
            // panel overflows horizontally on phones.
            "flex-grow flex bg-background h-full transition-[margin] duration-300 ease-in-out min-w-0",
            sidebarOpen && "lg:ml-[280px]"
          )}
        >
          {children}
        </main>
      </div>
    </>
  );
}
