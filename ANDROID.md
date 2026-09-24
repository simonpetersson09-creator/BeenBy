# BeenBy på Android

Samma kodbas som iOS. Det som skiljer plattformarna åt:

| Funktion | iOS | Android |
|---|---|---|
| Geofence | `capacitor-plugins/beenby-geofence/ios` (Core Location) | `capacitor-plugins/beenby-geofence/android` (Google Play-tjänsternas geofencing) |
| Köp | `beenby-storekit` (StoreKit 2, JWS) | `beenby-play-billing` (Play Billing 8, purchaseToken) |
| Push | APNs | FCM (Firebase) |
| Serverkontroll | `appstore.server.ts` | `googleplay.server.ts` |

Båda plattformarna skriver samma rad i `premium_entitlements`, så reglerna för Premium och provperioden är desamma.

## Kommandon
- `npm run android:sync` bygger appen och synkar den till `android/`
- `npm run android:open` öppnar projektet i Android Studio
- `npm run android:bundle` bygger en signerad `.aab` (kräver `android/keystore.properties`)

## Hemligheter på servern
- `FCM_SERVICE_ACCOUNT_JSON`: Firebase-servicekonto (för push)
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: servicekonto med åtkomst i Play Console (för att kontrollera köp)
- `ANDROID_PACKAGE_NAME` (valfri, standard är `app.beenbys.mobile`)
