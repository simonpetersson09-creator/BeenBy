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
