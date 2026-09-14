# Komplett iOS AppIcon-generering

## Genomförande
- Uppdatera ikonskriptet så samma befintliga BeenBy-källbild beskärs, skalas och skrivs utan transparens i alla begärda iPhone- och iPad-storlekar.
- Generera `Contents.json` från samma storlekslista med korrekta `idiom`, `size`, `scale` och filnamn, inklusive App Store-ikonen 1024 × 1024.
- Rensa endast tidigare genererade PNG-filer i AppIcon-katalogen innan nya skapas, så gamla ikonvarianter inte ligger kvar.
- Köra generatorn och kontrollera bildmått, alfa och att varje post i `Contents.json` har en motsvarande fil.
- Verifiera att `ios:sync` fortsätter köra ikonsteget efter Capacitor-synken, så en ny native build inte återställer katalogen till en ensam universalikon.

## Tekniska detaljer
- iPhone: 20@2x/3x, 29@2x/3x, 40@2x/3x, 60@2x/3x.
- iPad: 20@1x/2x, 29@1x/2x, 40@1x/2x, 76@1x/2x, 83.5@2x.
- App Store: 1024@1x med `idiom: ios-marketing`.
