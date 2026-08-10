const KEY = "beenby:circle-recovery-v1";
const MAX_AGE = 60 * 60 * 24 * 365; // one year

export type Recovery = { code: string; name: string; color: string };

/**
 * The identity lives in an anonymous session. If that session is ever lost
 * (new preview build, cleared storage, reinstall), we can silently rejoin the
 * same family circle with the saved family code, name and colour — so the
 * user never has to fill in their details again.
 *
 * We keep the data in BOTH localStorage and a long-lived cookie: some
 * webviews/previews wipe localStorage between builds while cookies survive,
 * and vice versa. Whichever survives is enough to get the user back in.
 */
function readCookie(): string | null {
  try {
    const match = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${KEY}=`));
    return match ? decodeURIComponent(match.slice(KEY.length + 1)) : null;
  } catch {
    return null;
  }
}

function parse(raw: string | null): Recovery | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Recovery>;
    if (!parsed.code || !parsed.name || !parsed.color) return null;
    return { code: parsed.code, name: parsed.name, color: parsed.color };
  } catch {
    return null;
  }
}

export function saveRecovery(value: Recovery) {
  const raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    /* storage unavailable – the cookie below is the fallback */
  }
  try {
    document.cookie = `${KEY}=${encodeURIComponent(raw)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function getRecovery(): Recovery | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  const fromStorage = parse(raw);
  if (fromStorage) return fromStorage;

  const fromCookie = parse(readCookie());
  if (fromCookie) {
    // Re-seed localStorage so later reads are fast.
    try {
      window.localStorage.setItem(KEY, JSON.stringify(fromCookie));
    } catch {
      /* ignore */
    }
  }
  return fromCookie;
}

export function clearRecovery() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${KEY}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}
