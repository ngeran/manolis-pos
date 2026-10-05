"use client";

import Link from "next/link";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";

/** Blocks rendering for non-admins (staff) with a clear message. */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const state = useRequireAdmin();

  if (state === "loading") {
    return <p className="p-10 text-center text-outline">Φόρτωση…</p>;
  }
  if (state === "denied") {
    return (
      <div className="w-full p-10 text-center">
        <span className="material-symbols-outlined text-[56px] block mb-2 text-error">
          lock
        </span>
        <p className="font-bold text-on-surface mb-1">Πρόσβαση μόνο για διαχειριστές</p>
        <p className="text-sm text-outline mb-4">
          Ζητήστε από τον διαχειριστή πρόσβαση σε αυτή την ενότητα.
        </p>
        <Link
          href="/pos"
          className="bg-primary text-on-primary rounded-xl px-5 py-2.5 font-semibold inline-flex items-center min-h-[44px]"
        >
          Πίσω στις παραγγελίες
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
