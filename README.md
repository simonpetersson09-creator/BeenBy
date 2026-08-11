# BeenBy

13. BACKEND, INLOGGNING OCH REALTIME

Använd Supabase som backend från början.

Appen ska ha riktig persistent data och inte bygga kärnfunktionerna på localStorage eller endast mockdata.

Använd Supabase för:

Authentication

Database

Realtime

Row Level Security

Välj ett så enkelt inloggningsflöde som möjligt för målgruppen. Förbered för Sign in with Apple på iOS samt ett enkelt alternativ via e-post.

En användares konto ska vara permanent kopplat till användarens familjecirkel/cirklar så att informationen finns kvar efter ominstallation eller byte av telefon.

När någon i familjen registrerar, planerar, ändrar eller tar bort ett besök ska övriga familjemedlemmars appar uppdateras i realtid utan att sidan behöver laddas om.

14. DATAMODELL

Skapa en tydlig och skalbar datamodell för:

Users

id

name

created_at

Family circles

id

name

timezone

created_by

created_at

People being visited

id

family_circle_id

name

location_latitude

location_longitude

geofence_radius

Family members

id

family_circle_id

user_id

personal_color

role

joined_at

Visits

id

family_circle_id

person_id

user_id

visited_at

source

created_at

Source ska exempelvis kunna vara:

manual

geofence

confirmed_planned_visit

Planned visits

id

family_circle_id

person_id

user_id

planned_date

status

created_at

Status:

planned

completed

cancelled

Invitations

id

family_circle_id

invite_token

created_by

expires_at

used_at

Datamodellen ska redan nu kunna stödja flera personer som familjen vill besöka i framtiden, exempelvis både mamma och pappa.

Bygg däremot INTE UI för flera personer i första MVP:n.

MVP:n ska fortfarande kännas som att den handlar om EN person.

Detta är endast framtidssäkring av datamodellen så att appen inte behöver byggas om senare.

15. SÄKERHET OCH RÄTTIGHETER

Aktivera Row Level Security på all familjerelaterad data.

Endast personer som är medlemmar i rätt familjecirkel ska kunna läsa information om:

familjen

personen som besöks

familjemedlemmarna

genomförda besök

planerade besök

En användare ska endast kunna ändra eller radera sina egna besök och sina egna planerade besök.

Invite-token ska vara svårt att gissa och inte bestå av ett sekventiellt ID.

Familjekoden ska vara en separat användarvänlig fallback och får inte ersätta säker backend-kontroll.

Visa aldrig någon familjemedlems aktuella GPS-position för andra.

16. INBJUDNINGSLÄNK OCH DEEP LINKING

Inbjudningsflödet är en kritisk del av produkten och ska fungera så friktionsfritt som möjligt.

Invite-länken ska innehålla ett säkert token som identifierar rätt familjecirkel.

Flödet ska vara förberett för följande situation:

Simon skapar Karin.

Simon trycker "Bjud in syskon".

Simon skickar länken till Anna.

Anna trycker på länken.

Om appen finns installerad öppnas rätt familjecirkel.

Om appen inte finns installerad ska flödet vara förberett för installation och därefter anslutning till rätt familjecirkel.

Anna anger sitt namn och väljer en ledig färg.

Anna är nu medlem i Karins familjecirkel.

Familjekoden ska finnas som fallback:

"Har du fått en familjekod?"

→ Ange kod
→ Gå med

Hantera även ogiltiga eller utgångna inbjudningar med ett tydligt och vänligt felmeddelande.

17. FÄRGSYSTEMET

Personernas färger är en central del av appens visuella språk och måste därför hanteras konsekvent.

Skapa en fast palett med tydligt åtskilda och tillgängliga färger.

När en person går med i familjecirkeln ska redan upptagna färger markeras som otillgängliga.

Samma färg ska användas för personen överallt:

genomförda besök

planerade besök

familjelistan

detaljer för en dag

nästa planerade besök

Kom ihåg huvudregeln:

Färg = vem

Fylld = genomfört

Kontur = planerat

Färg får däremot inte vara den enda informationsbäraren. Form/status måste också göra det möjligt att förstå skillnaden.

18. DATUM, VECKOR OCH TIDSZON

28-dagarsvyn måste fungera korrekt oavsett:

veckodag

månadsskifte

årsskifte

sommartid/vintertid

användarens telefoninställningar

Utgå från familjecirkelns lokala tidszon när dagar och besök grupperas.

Veckan ska i svensk lokalisering börja på måndag.

"Idag", "igår" och relativa datum ska alltid beräknas utifrån korrekt lokal dag.

Ett besök kl. 23:55 och ett besök kl. 00:05 ska hamna på rätt respektive dag.

19. FÖRHINDRA FELREGISTRERINGAR

Skydda mot oavsiktliga dubbelregistreringar.

Om användaren dubbeltrycker på Jag är här ska inte två identiska besök skapas.

Om samma person redan registrerat ett besök samma dag ska appen förstå detta och inte skapa onödiga dubbletter utan tydlig användarhandling.

Användaren ska kunna korrigera eller ta bort ett eget felaktigt besök.

Efter ny registrering ska en kort möjlighet finnas:

Besök registrerat ✓

Ångra

20. OFFLINE OCH DÅLIG UPPKOPPLING

Appen ska hantera dålig eller saknad internetanslutning på ett tydligt sätt.

Om användaren trycker Jag är här utan internet ska registreringen inte försvinna.

Spara åtgärden lokalt tillfälligt och synka den när anslutningen återkommer.

Visa tydlig status om något väntar på synkronisering.

Undvik att samma besök skapas två gånger när synkroniseringen sker.

21. TOMMA LÄGEN OCH EDGE CASES

Designa appen så att den känns färdig även när nästan ingen data finns.

Hantera minst:

helt ny familjecirkel utan registrerade besök

endast en familjemedlem

inget kommande besök

flera genomförda besök samma dag

flera planerade besök samma dag

genomfört och planerat besök samma dag

nekad platsbehörighet

nekade notisbehörigheter

offline

ogiltig invite-länk

utgången invite-länk

användaren trycker flera gånger på registreringsknappen

Ingen av dessa situationer ska göra appen oanvändbar.

Platsfunktion och notiser ska vara förbättringar av upplevelsen, inte krav för att appen ska fungera.

22. NOTISPRINCIPER

Notiser ska vara sparsamma, relevanta och mänskliga.

Undvik engagement-notiser vars enda syfte är att få användaren att öppna appen.

Undvik formuleringar som skapar skuld mellan syskon.

Appen ska inte säga:

"Du har inte besökt Karin på 14 dagar."

eller:

"Anna har besökt Karin mer än du."

Notiser ska istället handla om konkreta händelser som användaren behöver agera på eller bekräfta.

23. INTEGRITET

Appen behandlar familjeinformation och platsdata och ska därför byggas med privacy-by-design.

Spara endast platsinformation som behövs för funktionen.

Lagra inte användarnas löpande positionshistorik.

Lagra inte var familjemedlemmarna befinner sig.

Familjen ska inte kunna se varandra på en karta.

Förälderns sparade plats används endast som referenspunkt för den platsbaserade besöksfunktionen.

Användaren ska när som helst kunna stänga av den platsbaserade funktionen utan att övriga delar av appen slutar fungera.

24. TILLGÄNGLIGHET

Appen får inte förutsätta att användaren kan skilja mellan alla färger.

28-dagarsvyn ska därför kombinera:

färg

fylld/ofylld form

tydlig status vid tryck

Lägg till en mycket diskret förklaring/legend första gången användaren ser vyn:

Fylld = genomfört

Kontur = planerat

Klickytorna runt pluttarna ska vara större än själva pluttarnas visuella storlek så att de är lätta att trycka på.

Text, knappar och kontraster ska fungera för äldre och mindre tekniskt vana användare.

25. ARKITEKTUR FÖR NATIVE APP

Bygg webbgränssnittet så att det senare enkelt kan paketeras som native iOS/Android-app med Capacitor.

Funktioner som kräver native-stöd, exempelvis:

background geofencing

lokala notiser

pushnotiser

deep links

native share sheet

ska separeras från vanlig UI- och affärslogik.

Om en native-funktion inte kan fungera fullt ut i Lovables webbpreview ska den inte fejkas som fungerande.

Bygg istället korrekt UI, datalogik och tydliga integrationspunkter så att native-funktionen kan kopplas in senare.

26. MVP-TEST SOM MÅSTE FUNGERA

Innan MVP:n betraktas som klar ska följande kompletta flöde fungera:

Simon öppnar appen

→ skapar Karin

→ anger Karins plats

→ anger sitt namn

→ väljer blå färg

→ får Karins familjecirkel

→ bjuder in Anna

→ Anna öppnar inbjudan

→ Anna går med

→ Anna väljer lila färg

→ Simon trycker "Jag är här"

→ dagens plutt blir fylld blå

→ Anna ser förändringen i realtid

→ Anna planerar ett besök på torsdag

→ torsdagens plutt visas med lila kontur för både Simon och Anna

→ Anna registrerar senare besöket

→ den lila konturplutten blir fylld lila.

Detta end-to-end-flöde är viktigare än ytterligare funktioner.

Bygg och verifiera kärnflödet innan appen utökas.

27. MVP-DISCIPLIN

Lägg inte till funktioner utanför specifikationen bara för att de är tekniskt enkla att bygga.

Fråga hellre innan större nya produktfunktioner introduceras.

Prioritera:

Enkel onboarding

Familjecirkeln

Friktionsfri inbjudan

28-dagarsvyn

Registrera besök

Planera besök

Realtime mellan syskon

Robust datalagring och säkerhet

Native integrationspunkter

Visuell polish

Målet är inte att bygga många funktioner.

Målet är att göra kärnbeteendet exceptionellt enkelt:

Öppna appen → förstå direkt hur besöken sett ut → se vem som kommer nästa gång → registrera ett besök med ett tryck.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5306c12d-e1ba-402f-8e1d-dba155762875).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
