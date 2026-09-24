/**
 * End-to-end encryption for the family chat.
 *
 * Promise to the user: nobody outside the family circle — including us, the
 * developers, and the backend — can read what is written or sent.
 *
 * How it works:
 *  - Every device has an ECDH (P-256) key pair. The private key never leaves
 *    the device; the public key is published in `member_public_keys`.
 *  - Every family circle has one random AES-GCM 256 key ("the circle key").
 *    It is generated on the creator's phone and stored only on the devices.
 *  - For each member the circle key is wrapped (encrypted) with an ECDH shared
 *    secret and stored in `circle_key_wraps`. The server therefore only ever
 *    stores ciphertext it has no key for.
 *  - Message bodies and chat photos are encrypted with the circle key before
 *    they leave the phone.
 *
 * Messages written before this existed are plain text; they are shown as they
 * are and recognised by the missing `e1:` prefix.
 */
import { supabase } from "@/integrations/supabase/client";

const IDENTITY_KEY = "beenby.identity.v1";
const CIRCLE_KEY_PREFIX = "beenby.circlekey.";
export const CIPHER_PREFIX = "e1:";

type StoredIdentity = { publicJwk: JsonWebKey; privateJwk: JsonWebKey };

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  view.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function unb64(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function subtle(): SubtleCrypto | null {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  return crypto.subtle;
}

/** true when this environment can do end-to-end encryption at all. */
export function cryptoAvailable(): boolean {
  return subtle() !== null;
}

// ---------------------------------------------------------------- identity

let identityPromise: Promise<{ publicJwk: JsonWebKey; privateKey: CryptoKey } | null> | null = null;

async function loadIdentity() {
  const sub = subtle();
  const store = storage();
  if (!sub || !store) return null;

  const raw = store.getItem(IDENTITY_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredIdentity;
      const privateKey = await sub.importKey(
        "jwk",
        parsed.privateJwk,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveKey"],
      );
      return { publicJwk: parsed.publicJwk, privateKey };
    } catch {
      // Unreadable identity: fall through and create a new one.
    }
  }

  const pair = await sub.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const publicJwk = await sub.exportKey("jwk", pair.publicKey);
  const privateJwk = await sub.exportKey("jwk", pair.privateKey);
  try {
    store.setItem(IDENTITY_KEY, JSON.stringify({ publicJwk, privateJwk } satisfies StoredIdentity));
  } catch {
    // Storage blocked — the key still works for this session.
  }
  return { publicJwk, privateKey: pair.privateKey };
}

function identity() {
  if (!identityPromise) identityPromise = loadIdentity();
  return identityPromise;
}

/** Publishes this device's public key so family members can share the key with us. */
export async function publishPublicKey(userId: string): Promise<void> {
  const me = await identity();
  if (!me) return;
  await supabase
    .from("member_public_keys")
    .upsert(
      { user_id: userId, public_jwk: me.publicJwk as never, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
}

async function sharedKey(theirJwk: JsonWebKey): Promise<CryptoKey | null> {
  const sub = subtle();
  const me = await identity();
  if (!sub || !me) return null;
  const theirKey = await sub.importKey(
    "jwk",
    theirJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  return sub.deriveKey(
    { name: "ECDH", public: theirKey },
    me.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ------------------------------------------------------------- circle key

const memoryKeys = new Map<string, CryptoKey>();

async function importCircleKey(raw: Uint8Array): Promise<CryptoKey | null> {
  const sub = subtle();
  if (!sub) return null;
  return sub.importKey("raw", raw as BufferSource, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function cachedRaw(circleId: string): Uint8Array | null {
  const store = storage();
  const value = store?.getItem(CIRCLE_KEY_PREFIX + circleId);
  return value ? unb64(value) : null;
}

function cacheRaw(circleId: string, raw: Uint8Array) {
  try {
    storage()?.setItem(CIRCLE_KEY_PREFIX + circleId, b64(raw));
  } catch {
    // Storage blocked — key stays in memory for this session.
  }
}

/** Wraps the circle key for one recipient and stores the ciphertext. */
async function wrapFor(
  circleId: string,
  senderId: string,
  recipientId: string,
  recipientJwk: JsonWebKey,
  raw: Uint8Array,
): Promise<void> {
  const sub = subtle();
  const me = await identity();
  if (!sub || !me) return;
  const shared = await sharedKey(recipientJwk);
  if (!shared) return;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await sub.encrypt({ name: "AES-GCM", iv }, shared, raw as BufferSource);
  await supabase.from("circle_key_wraps").insert({
    family_circle_id: circleId,
    recipient_id: recipientId,
    sender_id: senderId,
    sender_public_jwk: me.publicJwk as never,
    wrapped_key: b64(wrapped),
    iv: b64(iv),
  });
}

/**
 * Creates the circle key when a family circle is created and stores it wrapped
 * for the creator, so it survives a new sign-in on the same account.
 */
export async function createCircleKey(circleId: string, userId: string): Promise<void> {
  const sub = subtle();
  if (!sub) return;
  const raw = crypto.getRandomValues(new Uint8Array(32));
  cacheRaw(circleId, raw);
  const key = await importCircleKey(raw);
  if (key) memoryKeys.set(circleId, key);
  await publishPublicKey(userId);
  const me = await identity();
  if (me) await wrapFor(circleId, userId, userId, me.publicJwk, raw);
}

/** The circle key for this device, or null when it hasn't been shared with us yet. */
export async function getCircleKey(circleId: string, userId: string): Promise<CryptoKey | null> {
  const sub = subtle();
  if (!sub) return null;

  const cachedKey = memoryKeys.get(circleId);
  if (cachedKey) return cachedKey;

  const local = cachedRaw(circleId);
  if (local) {
    const key = await importCircleKey(local);
    if (key) {
      memoryKeys.set(circleId, key);
      return key;
    }
  }

  // Not on this device yet: try the wrap another member made for us.
  const { data } = await supabase
    .from("circle_key_wraps")
    .select("wrapped_key, iv, sender_public_jwk")
    .eq("family_circle_id", circleId)
    .eq("recipient_id", userId)
    .maybeSingle();
  if (!data) return null;

  try {
    const shared = await sharedKey(data.sender_public_jwk as unknown as JsonWebKey);
    if (!shared) return null;
    const raw = new Uint8Array(
      await sub.decrypt(
        { name: "AES-GCM", iv: unb64(data.iv) as BufferSource },
        shared,
        unb64(data.wrapped_key) as BufferSource,
      ),
    );
    cacheRaw(circleId, raw);
    const key = await importCircleKey(raw);
    if (key) memoryKeys.set(circleId, key);
    return key;
  } catch {
    // The wrap was made for another device of ours — it can't be opened here.
    return null;
  }
}

/**
 * Makes sure this device holds the circle key. Circles created before
 * encryption existed have no key yet — the first member to open the app
 * creates it and wraps it for themselves, then shares it with the others.
 */
export async function ensureCircleKey(circleId: string, userId: string): Promise<CryptoKey | null> {
  const existing = await getCircleKey(circleId, userId);
  if (existing) return existing;
  if (!subtle()) return null;
  await createCircleKey(circleId, userId);
  return getCircleKey(circleId, userId);
}

/**
 * Shares the circle key with members who don't have it yet. Runs quietly on any
 * device that already holds the key, so a new family member can read the chat
 * as soon as somebody else opens the app.
 */
export async function shareCircleKeyWithMembers(
  circleId: string,
  userId: string,
  memberIds: string[],
): Promise<void> {
  if (!subtle()) return;
  const raw = cachedRaw(circleId);
  if (!raw) return;

  const { data: wraps } = await supabase
    .from("circle_key_wraps")
    .select("recipient_id")
    .eq("family_circle_id", circleId);
  const have = new Set((wraps ?? []).map((w) => w.recipient_id));
  const missing = memberIds.filter((id) => !have.has(id));
  if (missing.length === 0) return;

  const { data: keys } = await supabase
    .from("member_public_keys")
    .select("user_id, public_jwk")
    .in("user_id", missing);

  for (const row of keys ?? []) {
    try {
      await wrapFor(circleId, userId, row.user_id, row.public_jwk as unknown as JsonWebKey, raw);
    } catch {
      // Someone else wrapped it first, or the row already exists — fine.
    }
  }
}

// ------------------------------------------------------------ text + bytes

/** true for values produced by `encryptText` (older plain-text rows return false). */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(CIPHER_PREFIX);
}

export async function encryptText(key: CryptoKey, plain: string): Promise<string> {
  const sub = subtle();
  if (!sub) return plain;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plain);
  const cipher = await sub.encrypt({ name: "AES-GCM", iv }, key, data as BufferSource);
  return `${CIPHER_PREFIX}${b64(iv)}:${b64(cipher)}`;
}

/** Returns null when the value cannot be decrypted with this key. */
export async function decryptText(key: CryptoKey, stored: string): Promise<string | null> {
  const sub = subtle();
  if (!sub) return null;
  const parts = stored.slice(CIPHER_PREFIX.length).split(":");
  if (parts.length !== 2) return null;
  try {
    const plain = await sub.decrypt(
      { name: "AES-GCM", iv: unb64(parts[0]!) as BufferSource },
      key,
      unb64(parts[1]!) as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** Encrypts a photo. The 12 byte IV is stored as a prefix of the uploaded blob. */
export async function encryptBlob(key: CryptoKey, blob: Blob): Promise<Blob> {
  const sub = subtle();
  if (!sub) return blob;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await sub.encrypt(
    { name: "AES-GCM", iv },
    key,
    (await blob.arrayBuffer()) as BufferSource,
  );
  return new Blob([iv as BufferSource, cipher], { type: "application/octet-stream" });
}

export async function decryptBlob(key: CryptoKey, data: ArrayBuffer): Promise<Blob | null> {
  const sub = subtle();
  if (!sub) return null;
  try {
    const bytes = new Uint8Array(data);
    const iv = bytes.slice(0, 12);
    const cipher = bytes.slice(12);
    const plain = await sub.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      cipher as BufferSource,
    );
    return new Blob([plain], { type: "image/jpeg" });
  } catch {
    return null;
  }
}

/** Encrypted photos are uploaded with this extension so old ones still render. */
export const ENCRYPTED_IMAGE_EXT = ".enc";
export const ENCRYPTED_JPEG_EXT = ".sealed.jpg";

export function isEncryptedImagePath(path: string | null | undefined): boolean {
  return (
    typeof path === "string" &&
    (path.endsWith(ENCRYPTED_IMAGE_EXT) || path.endsWith(ENCRYPTED_JPEG_EXT))
  );
}
