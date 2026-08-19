# iOS launch screen

`App/App/Base.lproj/LaunchScreen.storyboard` ligger i git så att den alltid följer med
till den lokala Xcode-projektstrukturen (`ios/App/App/Base.lproj/`).

Utan en giltig launch screen startar iOS appen i compatibility mode (4:3) med svarta
band över och under. Storyboarden är edge-to-edge, använder safe areas och BeenBys
bakgrundsfärg `#AFA9A6` — ingen logotyp, för att undvika skalningsproblem.

## Från en färsk klon

Xcode-projektet (`ios/App/App.xcodeproj`, `Info.plist`, `AppDelegate.swift`) genereras
av Capacitor och ligger inte i git. Ett komplett bygge från noll:

```bash
npm install
npm run ios:init   # npx cap add ios – hoppas över om projektet redan finns
npm run ios:sync   # bygger webben, synkar och kör alla patchskript
```

`ios:sync` är det enda kommando du behöver även efter en `git pull`; det kör
`build:ios`, `npx cap sync ios` och därefter samtliga patchskript nedan.

Kontrollera en gång i Xcode: target **App** → *General* → *App Icons and Launch Screen*
→ **Launch Screen File** = `LaunchScreen`. Avinstallera appen från enheten innan ny
körning; iOS cachar launch screen-snapshoten.

## Kamera och bilder i chatten

Chatten använder `@capacitor/camera`. Info.plist genereras av `npx cap add ios` och
ligger inte i git, så kör efter varje `npx cap sync ios`:

```bash
npm run ios:plist
```

Eller allt i ett steg:

```bash
npm run ios:sync
```

Det lägger in (idempotent):

- `NSCameraUsageDescription` (engelsk bastext)
- `NSPhotoLibraryUsageDescription` (engelsk bastext)
- `CFBundleLocalizations` med `en, sv, de, da, fi, es, fr`
- `ios/App/App/<språk>.lproj/InfoPlist.strings` med översatta behörighetstexter

Samma kommando kör även `scripts/patch-ios-project.mjs`, som registrerar de sju
`*.lproj/InfoPlist.strings` som en variantgrupp i `App.xcodeproj` och lägger den i
App-targetens *Copy Bundle Resources* samt i `knownRegions`. Ingen manuell
drag-and-drop i Xcode behövs. Skriptet är idempotent och kan köras om efter varje sync.

## Push och bakgrundslägen

`scripts/patch-ios-capabilities.mjs` (körs av `npm run ios:plist` / `ios:sync`) sätter
push-capability automatiskt – ingen manuell bock i Xcode:

- skapar `ios/App/App/App.entitlements` med `aps-environment = production`
  (TestFlight och App Store använder produktions-APNs; utvecklingsbyggen faller
  automatiskt tillbaka till sandbox)
- registrerar filen i `App.xcodeproj` och sätter `CODE_SIGN_ENTITLEMENTS`
- `patch-ios-plist.mjs` lägger till `UIBackgroundModes` med
  `remote-notification`, `location` och `fetch`

Pushnotiser innehåller aldrig bilder, så någon Notification Service Extension
behövs inte.

`NSPhotoLibraryAddUsageDescription` behövs inte – appen sparar aldrig bilder tillbaka
till telefonens bildbibliotek. Inga nya capabilities krävs i Xcode.
