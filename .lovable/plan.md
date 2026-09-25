# Rätta återställning av Apple-köp

## Mål
Aktiva App Store-prenumerationer ska återställas efter ominstallation, och användaren ska få rätt besked om Apple tillfälligt inte lämnar köpbeviset.

## Ändringar
- Uppdatera iOS-köpmodulen så att återställning skiljer mellan:
  - aktiv prenumeration hittad,
  - inget aktivt köp,
  - Apple-synkningen misslyckades.
- Efter lyckad Apple-synkning läsa den aktuella prenumerationen direkt för BeenBys produkt och skicka Apples signerade köpbevis till BeenBys verifiering.
- Inte längre omvandla ett Apple-fel till det missvisande beskedet ”Inget köp hittades”. Visa ett tydligt, lokalt översatt fel och behåll möjlighet att försöka igen.
- Behåll nuvarande säkerhetsmodell: Premium aktiveras endast efter verifiering av Apples signerade köpbevis. Ingen manuell flytt baserad på ett osäkert ordernummer.

## Kontroll
- Testa svaren för aktivt köp, saknat köp och Apple-fel.
- Kontrollera att webb och Android inte påverkas.
- Kontrollera projektets byggstatus.

## Leverans
Rättningen behöver byggas, skickas till App Store Connect och släppas som en ny iOS-version. Den redan installerade versionen kan inte få denna native-rättning på distans.
