import Link from "next/link";

export const metadata = {
  title: "Εκτός σύνδεσης — Manolis Orders",
};

export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background text-center p-6">
      <span className="material-symbols-outlined text-outline text-[72px] mb-4">
        wifi_off
      </span>
      <h1 className="text-2xl font-bold text-on-surface mb-2">Εκτός σύνδεσης</h1>
      <p className="text-outline mb-6 max-w-sm">
        Η σελίδα δεν είναι διαθέσιμη χωρίς σύνδεση. Ελέγξτε το δίκτυο και
        δοκιμάστε ξανά — οι ήδη ανοιχτές οθόνες συνεχίζουν να λειτουργούν.
      </p>
      <Link
        href="/pos"
        className="bg-primary text-on-primary rounded-xl px-6 py-3 font-semibold min-h-[48px] flex items-center"
      >
        Δοκιμή ξανά
      </Link>
    </div>
  );
}
