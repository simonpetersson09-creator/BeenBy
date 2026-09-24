/**
 * Google Play subscription verification (Play Developer API, subscriptionsv2).
 * Server-only. The Apple counterpart is appstore.server.ts — kept separate.
 */
import { googleAccessToken, parseServiceAccount } from "@/lib/googleAuth.server";

const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

export type GoogleSubscription = {
  subscriptionState?: string;
  latestOrderId?: string;
  acknowledgementState?: string;
  testPurchase?: Record<string, unknown>;
  linkedPurchaseToken?: string;
  lineItems?: { productId?: string; expiryTime?: string }[];
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
};

export function packageName(): string {
  return process.env["ANDROID_PACKAGE_NAME"] ?? "app.beenbys.mobile";
}

export function isGooglePlayConfigured(): boolean {
  return parseServiceAccount(process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"]) !== null;
}

async function token(): Promise<string> {
  const sa = parseServiceAccount(process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"]);
  if (!sa) throw new Error("google play not configured");
  return googleAccessToken(sa, SCOPE);
}

export async function fetchSubscription(purchaseToken: string): Promise<GoogleSubscription> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName(),
  )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${await token()}` } });
  if (!res.ok) throw new Error(`play verify ${res.status}`);
  return (await res.json()) as GoogleSubscription;
}

/** Acknowledge within 3 days or Google refunds the purchase. Best effort. */
export async function acknowledgeSubscription(productId: string, purchaseToken: string): Promise<void> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName(),
  )}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" },
      body: "{}",
    });
  } catch {
    /* the device acknowledges too */
  }
}

const ACTIVE_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  // Cancelled but still paid until expiry.
  "SUBSCRIPTION_STATE_CANCELED",
]);

export function latestExpiry(sub: GoogleSubscription): string | null {
  const times = (sub.lineItems ?? []).map((l) => l.expiryTime).filter((t): t is string => !!t);
  if (times.length === 0) return null;
  return times.sort().at(-1) ?? null;
}

export function grantsPremiumGoogle(sub: GoogleSubscription): boolean {
  if (!sub.subscriptionState || !ACTIVE_STATES.has(sub.subscriptionState)) return false;
  const exp = latestExpiry(sub);
  return !exp || Date.parse(exp) > Date.now();
}
