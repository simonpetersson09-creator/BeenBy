/**
 * Tracks when the family chat was last read, so the home screen can show a
 * red badge with the number of unread messages.
 */
const EVENT = "beenby-chat-read";

function key(circleId: string) {
  return `beenby.chatReadAt.${circleId}`;
}

export function getLastReadAt(circleId: string): string {
  if (typeof window === "undefined") return new Date(0).toISOString();
  return window.localStorage.getItem(key(circleId)) ?? new Date(0).toISOString();
}

/**
 * `when` should be a server timestamp (a message's `created_at`) so the badge
 * never depends on the device clock. Falls back to the device clock only when
 * there are no messages at all. The stored value never moves backwards.
 */
export function markChatRead(circleId: string, when: string = new Date().toISOString()) {
  if (typeof window === "undefined") return;
  const prev = window.localStorage.getItem(key(circleId));
  if (prev && prev >= when) return;
  window.localStorage.setItem(key(circleId), when);
  window.dispatchEvent(new Event(EVENT));
}

export function onChatRead(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
