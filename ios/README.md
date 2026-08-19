# iOS launch screen

`App/App/Base.lproj/LaunchScreen.storyboard` ligger i git så att den alltid följer med
till den lokala Xcode-projektstrukturen (`ios/App/App/Base.lproj/`).

Utan en giltig launch screen startar iOS appen i compatibility mode (4:3) med svarta
band över och under. Storyboarden är edge-to-edge, använder safe areas och BeenBys
bakgrundsfärg `#AFA9A6` — ingen logotyp, för att undvika skalningsproblem.

## Efter git pull

```bash
npm run build:ios
npx cap sync ios
```

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

`NSPhotoLibraryAddUsageDescription` behövs inte – appen sparar aldrig bilder tillbaka
till telefonens bildbibliotek. Inga nya capabilities krävs i Xcode.
