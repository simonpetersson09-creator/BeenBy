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

export function markChatRead(circleId: string, when: string = new Date().toISOString()) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(circleId), when);
  window.dispatchEvent(new Event(EVENT));
}

export function onChatRead(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
