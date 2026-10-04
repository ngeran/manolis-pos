// Slot capacity: covers already booked (excluding cancellations) plus the new
// party must not exceed the restaurant's per-slot limit.
export function slotHasCapacity(
  bookedCovers: number,
  newPartySize: number,
  maxCovers: number
): boolean {
  return bookedCovers + newPartySize <= maxCovers;
}

/** "Γιώργος Παπαδόπουλος" → { firstName: "Γιώργος", lastName: "Παπαδόπουλος" } */
export function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] || "Unknown", lastName: parts.slice(1).join(" ") };
}

/** "21:00" → "21:00:00" (the Postgres time column returns seconds). */
export function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

/** "21:00:00" → "21:00" for display. */
export function displayTime(t: string): string {
  return t.slice(0, 5);
}
