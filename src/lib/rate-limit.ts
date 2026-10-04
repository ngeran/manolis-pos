// Simple in-memory login throttle, keyed by identifier (email). Per-process
// only — on multi-instance deployments it raises the bar rather than airtight.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, { count: number; firstAt: number }>();

function entryValid(
  entry: { count: number; firstAt: number } | undefined
): entry is { count: number; firstAt: number } {
  return !!entry && Date.now() - entry.firstAt <= WINDOW_MS;
}

export function isLockedOut(key: string): boolean {
  const entry = attempts.get(key);
  if (!entryValid(entry)) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailure(key: string): void {
  const entry = attempts.get(key);
  if (entryValid(entry)) {
    entry.count += 1;
  } else {
    attempts.set(key, { count: 1, firstAt: Date.now() });
  }
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
