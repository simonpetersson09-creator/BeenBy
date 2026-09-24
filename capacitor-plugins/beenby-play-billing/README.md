# beenby-play-billing

Android-only Capacitor plugin for Google Play Billing (Billing Library 8).
Apple's StoreKit lives in `beenby-storekit` and is not touched by this package.

JS name: `BeenbyPlayBilling` — bridge in `src/lib/playBilling.ts`.

The device only hands Google's `purchaseToken` to BeenBy's backend
(`/api/public/native/premium`, action `submit_google`). The server verifies it
with the Google Play Developer API and writes `premium_entitlements` — the same
row and access rules as iOS.
