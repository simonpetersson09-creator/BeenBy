/**
 * Temporary offline queue for visit registrations.
 *
 * This is NOT the source of truth — the database is. The queue only holds
 * actions that could not reach the server yet, each with a stable client token
 * so a retry can never create the same visit twice.
 */

export type PendingVisit = {
  clientToken: string;
  familyCircleId: string;
  personId: string;
  visitedAt: string;
  localDay: string;
  source: string;
  /** Optional activity ids (see src/lib/activities.ts). */
  activities?: string[];
  /** Short free text for the "other" activity. */
  activityNote?: string | null;
};


const KEY = "pending-visits-v1";

function read(): PendingVisit[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as PendingVisit[];
  } catch {
    return [];
  }
}

function write(items: PendingVisit[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("pending-visits-changed"));
}

export function getPending(): PendingVisit[] {
  return read();
}

export function enqueue(item: PendingVisit) {
  const items = read().filter((i) => i.clientToken !== item.clientToken);
  items.push(item);
  write(items);
}

export function dequeue(clientToken: string) {
  write(read().filter((i) => i.clientToken !== clientToken));
}

export function newClientToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
