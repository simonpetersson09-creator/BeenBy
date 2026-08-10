const KEY = "beenby:circle-recovery-v1";

export type Recovery = { code: string; name: string; color: string };

/**
 * The identity lives in an anonymous session. If that session is ever lost
 * (new preview build, cleared storage, reinstall), we can silently rejoin the
 * same family circle with the saved family code, name and colour — so the
 * user never has to fill in their details again.
 */
export function saveRecovery(value: Recovery) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable – recovery is a nice-to-have */
  }
}

export function getRecovery(): Recovery | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Recovery>;
    if (!parsed.code || !parsed.name || !parsed.color) return null;
    return { code: parsed.code, name: parsed.name, color: parsed.color };
  } catch {
    return null;
  }
}

export function clearRecovery() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
