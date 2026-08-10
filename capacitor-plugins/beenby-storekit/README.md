# beenby-storekit

Local Capacitor plugin implementing Premium purchases with **StoreKit 2** on iOS.

- JS plugin name: `BeenbyStoreKit` (matches `registerPlugin("BeenbyStoreKit")` in `src/lib/storekit.ts`)
- Methods: `getSubscriptionStatus`, `purchasePremium`, `restorePurchases`, `manageSubscription`
- Product ID constant: `ios/Sources/BeenbyStoreKitPlugin/BeenbyStore.swift` → `private let premiumProductID = "..."`

The package is linked from the app's `package.json` as `"beenby-storekit": "file:./capacitor-plugins/beenby-storekit"`,
so `npx cap sync ios` picks it up automatically and never deletes these files.
