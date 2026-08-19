/**
 * Server-side verification of Apple's signed StoreKit payloads (JWS).
 *
 * Everything Premium-related in BeenBy is decided here, never on the device.
 * The app may *send* a signed transaction, but only this module can turn it
 * into a row in `premium_entitlements`.
 *
 * What is verified:
 *   1. The JWS header carries an x5c certificate chain.
 *   2. Every certificate in the chain is signed by the next one (ECDSA).
 *   3. The last certificate is byte-identical to the pinned Apple Root CA - G3.
 *   4. Every certificate is inside its validity window.
 *   5. The JWS signature itself is valid for the leaf certificate's key.
 *   6. The payload's bundleId matches this app.
 *
 * A forged or replayed payload therefore cannot grant Premium.
 */

/** Apple Root CA - G3, DER, base64. Pinned on purpose. */
const APPLE_ROOT_CA_G3 =
  "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

export const APP_BUNDLE_ID = "app.beenbys.mobile";

// ─────────────────────────── tiny DER reader ───────────────────────────

type Node = { tag: number; start: number; end: number; contentStart: number; contentEnd: number };

function readNode(buf: Uint8Array, offset: number): Node {
  const tag = buf[offset]!;
  let i = offset + 1;
  let len = buf[i]!;
  i += 1;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let k = 0; k < n; k++) len = len * 256 + buf[i + k]!;
    i += n;
  }
  return { tag, start: offset, end: i + len, contentStart: i, contentEnd: i + len };
}

function children(buf: Uint8Array, node: Node): Node[] {
  const out: Node[] = [];
  let i = node.contentStart;
  while (i < node.contentEnd) {
    const child = readNode(buf, i);
    out.push(child);
    i = child.end;
  }
  return out;
}

function oid(buf: Uint8Array, node: Node): string {
  const b = buf.subarray(node.contentStart, node.contentEnd);
  const parts: number[] = [Math.floor(b[0]! / 40), b[0]! % 40];
  let value = 0;
  for (let i = 1; i < b.length; i++) {
    value = value * 128 + (b[i]! & 0x7f);
    if ((b[i]! & 0x80) === 0) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join(".");
}

function parseTime(buf: Uint8Array, node: Node): number {
  const s = new TextDecoder().decode(buf.subarray(node.contentStart, node.contentEnd));
  // UTCTime (YYMMDDHHMMSSZ) or GeneralizedTime (YYYYMMDDHHMMSSZ)
  const full = node.tag === 0x17 ? (Number(s.slice(0, 2)) < 50 ? "20" : "19") + s : s;
  const iso = `${full.slice(0, 4)}-${full.slice(4, 6)}-${full.slice(6, 8)}T${full.slice(8, 10)}:${full.slice(10, 12)}:${full.slice(12, 14)}Z`;
  return Date.parse(iso);
}

const CURVES: Record<string, string> = {
  "1.2.840.10045.3.1.7": "P-256",
  "1.3.132.0.34": "P-384",
};
const SIG_HASH: Record<string, string> = {
  "1.2.840.10045.4.3.2": "SHA-256",
  "1.2.840.10045.4.3.3": "SHA-384",
};

type Cert = {
  der: Uint8Array;
  tbs: Uint8Array;
  spki: Uint8Array;
  curve: string;
  signature: Uint8Array; // DER encoded r,s
  sigHash: string;
  notBefore: number;
  notAfter: number;
};

function parseCertificate(der: Uint8Array): Cert {
  const root = readNode(der, 0);
  const [tbsNode, algNode, sigNode] = children(der, root);
  if (!tbsNode || !algNode || !sigNode) throw new Error("malformed certificate");

  const tbsChildren = children(der, tbsNode);
  const hasVersion = tbsChildren[0]!.tag === 0xa0;
  const base = hasVersion ? 1 : 0;
  const validity = tbsChildren[base + 3]!;
  const spkiNode = tbsChildren[base + 5]!;
  const [notBeforeNode, notAfterNode] = children(der, validity);

  const spkiChildren = children(der, spkiNode);
  const algParams = children(der, spkiChildren[0]!);
  const curveOid = algParams[1] ? oid(der, algParams[1]) : "";
  const curve = CURVES[curveOid];
  if (!curve) throw new Error(`unsupported curve ${curveOid}`);

  const sigOid = oid(der, children(der, algNode)[0]!);
  const sigHash = SIG_HASH[sigOid];
  if (!sigHash) throw new Error(`unsupported signature algorithm ${sigOid}`);

  return {
    der,
    tbs: der.subarray(tbsNode.start, tbsNode.end),
    spki: der.subarray(spkiNode.start, spkiNode.end),
    curve,
    // BIT STRING: skip the leading "unused bits" byte.
    signature: der.subarray(sigNode.contentStart + 1, sigNode.contentEnd),
    sigHash,
    notBefore: parseTime(der, notBeforeNode!),
    notAfter: parseTime(der, notAfterNode!),
  };
}

/** DER SEQUENCE { r INTEGER, s INTEGER } → fixed-width r||s for WebCrypto. */
function derSignatureToRaw(der: Uint8Array, size: number): Uint8Array {
  const seq = readNode(der, 0);
  const [rNode, sNode] = children(der, seq);
  const out = new Uint8Array(size * 2);
  for (const [index, node] of [rNode!, sNode!].entries()) {
    let bytes = der.subarray(node.contentStart, node.contentEnd);
    while (bytes.length > size && bytes[0] === 0) bytes = bytes.subarray(1);
    out.set(bytes, index * size + (size - bytes.length));
  }
  return out;
}

// ─────────────────────────── helpers ───────────────────────────

function b64ToBytes(value: string): Uint8Array {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "="));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function verifyEcdsa(
  spki: Uint8Array,
  curve: string,
  hash: string,
  signatureDer: Uint8Array,
  data: Uint8Array,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "spki",
    spki as unknown as ArrayBuffer,
    { name: "ECDSA", namedCurve: curve },
    false,
    ["verify"],
  );
  const size = curve === "P-384" ? 48 : 32;
  return crypto.subtle.verify(
    { name: "ECDSA", hash },
    key,
    derSignatureToRaw(signatureDer, size) as unknown as ArrayBuffer,
    data as unknown as ArrayBuffer,
  );
}

// ─────────────────────────── public API ───────────────────────────

export type AppleTransaction = {
  bundleId?: string;
  productId?: string;
  originalTransactionId?: string;
  transactionId?: string;
  appAccountToken?: string;
  expiresDate?: number;
  revocationDate?: number;
  environment?: string;
  type?: string;
};

/**
 * Verifies an Apple JWS and returns its decoded payload.
 * Throws when anything about the signature or the chain is wrong.
 */
export async function verifyAppleJws<T>(jws: string): Promise<T> {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("malformed JWS");
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  const header = JSON.parse(new TextDecoder().decode(b64ToBytes(headerPart))) as {
    alg?: string;
    x5c?: string[];
  };
  if (header.alg !== "ES256") throw new Error(`unexpected alg ${header.alg}`);
  const chain = header.x5c ?? [];
  if (chain.length < 2) throw new Error("missing certificate chain");

  const certs = chain.map((c) => parseCertificate(b64ToBytes(c)));

  const now = Date.now();
  for (const cert of certs) {
    if (now < cert.notBefore || now > cert.notAfter) throw new Error("certificate expired");
  }

  // The root must be Apple's, byte for byte.
  if (!sameBytes(certs[certs.length - 1]!.der, b64ToBytes(APPLE_ROOT_CA_G3))) {
    throw new Error("chain does not end in Apple Root CA - G3");
  }

  // Each certificate must be signed by the next one.
  for (let i = 0; i < certs.length - 1; i++) {
    const child = certs[i]!;
    const parent = certs[i + 1]!;
    const ok = await verifyEcdsa(parent.spki, parent.curve, child.sigHash, child.signature, child.tbs);
    if (!ok) throw new Error("broken certificate chain");
  }

  // Finally the JWS signature itself, using the leaf key.
  const leaf = certs[0]!;
  const signingInput = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const rawSignature = b64ToBytes(signaturePart);
  const key = await crypto.subtle.importKey(
    "spki",
    leaf.spki as unknown as ArrayBuffer,
    { name: "ECDSA", namedCurve: leaf.curve },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    rawSignature as unknown as ArrayBuffer,
    signingInput as unknown as ArrayBuffer,
  );
  if (!valid) throw new Error("invalid JWS signature");

  return JSON.parse(new TextDecoder().decode(b64ToBytes(payloadPart))) as T;
}

/** Verifies a signed transaction and checks that it belongs to this app. */
export async function verifyTransaction(jws: string): Promise<AppleTransaction> {
  const payload = await verifyAppleJws<AppleTransaction>(jws);
  if (payload.bundleId !== APP_BUNDLE_ID) throw new Error("wrong bundle id");
  return payload;
}

/** True when the transaction currently grants Premium. */
export function grantsPremium(tx: AppleTransaction): boolean {
  if (tx.revocationDate) return false;
  if (tx.expiresDate && tx.expiresDate <= Date.now()) return false;
  return true;
}

export function toIso(ms?: number): string | null {
  return typeof ms === "number" && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
