# CLAUDE.md — CashCount

Projekt-Anweisungen für die Arbeit an dieser Codebasis.

## Agenten
Schicke immer so viele deiner besten Agenten los wie für die Iteration die Umsetzung notwendig und sinnvoll sind

## Was ist das?
**CashCount** ist ein kleines, lokales Kassenbuch als **PWA** für das iPhone. Schnelle Eingabe von Ausgaben/Einnahmen, komplett offline, Daten ausschließlich lokal auf dem Gerät (IndexedDB). Kein App Store, kein Entwickler-Account, kein Backend.

Vollständiges Konzept: [docs/KONZEPT.md](docs/KONZEPT.md). Fortschritt/Roadmap: [ITERATION.md](ITERATION.md).

## Eckdaten
- **Sprache/Währung:** Deutsch, Euro (€).
- **Plattform:** iPhone Safari, „Zum Home-Bildschirm" installiert, Standalone/Vollbild.
- **Stack:** Vanilla HTML/CSS/JS, **kein Build-Step**. PWA via `manifest.webmanifest` + `service-worker.js`.
- **Speicher:** IndexedDB. **Geldbeträge immer als Integer in Cent.**

## Projektstruktur
```
CashCount/
├── CLAUDE.md            # diese Datei
├── ITERATION.md        # Roadmap, Entscheidungen, offene Punkte
├── README.md           # Kurzüberblick + Setup
├── docs/
│   └── KONZEPT.md      # ausführliches Konzept & Datenmodell
└── src/                # die eigentliche PWA (das, was gehostet wird)
    ├── index.html
    ├── manifest.webmanifest
    ├── service-worker.js
    ├── css/styles.css
    ├── js/
    │   ├── config.js   # << zentrale Konfiguration; vom User frei editierbar (inkl. "wishes")
    │   ├── app.js      # UI/Steuerung
    │   ├── db.js       # IndexedDB-Wrapper (inkl. Seeding/Migration)
    │   ├── exporter.js # CSV-Export & JSON-Backup (iOS-Teilen-Sheet)
    │   ├── sync.js     # optionaler Geräte-Sync über privates GitHub-Repo
    │   └── money.js    # Geld-Formatierung/Parsing (Cent <-> Anzeige)
    └── icons/          # App-Icons (PWA)
```

## Konventionen
- **Geld:** intern `amountCents` (Integer). Anzeige/Parsing nur über `js/money.js`.
- **IDs:** UUID-Strings.
- **Datum:** ISO-Strings (`YYYY-MM-DD`).
- **Kein** Framework/Build ohne Rücksprache — Einfachheit ist Designziel.
- **Offline-first:** Jede neue Datei, die ausgeliefert wird, muss im Service-Worker-Cache berücksichtigt werden (Cache-Versionsnummer erhöhen).
- UI für **Daumenbedienung**: große Touch-Ziele, wenige Taps pro Eintrag.

## Wichtige Regeln für die Zusammenarbeit
- **Fragen an den User IMMER über das Spokenly-Diktat-Tool** stellen (`mcp__spokenly__ask_user_dictation`), nie als reiner Text.
- **Immer nur EINE Frage nach der anderen stellen.** Fasse im Dialog niemals mehrere Fragen zusammen — eine Frage, Antwort abwarten, dann die nächste.
- **Spokenly-Dialog NIEMALS selbstständig abbrechen oder schließen.** Diese Regel ist dauerhaft und immer gültig:
  - Warte **immer und ausschließlich** auf die echte Eingabe-Bestätigung des Anwenders.
  - Behandle den Dialog **nie** als beantwortet, bevor der Anwender die Frage tatsächlich beantwortet **und** den Dialog konkret selbst geschlossen hat.
  - Es kommt vor, dass der Anwender noch nicht fertig geantwortet hat und der Dialog vom System eigenständig geschlossen wird — **das darf nicht mehr passieren.** Verhindere dies und warte, bis der Anwender fertig ist und selbst bestätigt/schließt.
- Nach Änderungen an `src/`: kurz prüfen, ob Service-Worker-Cache-Liste & Version aktualisiert werden müssen.

## Testen / Lokal ausführen
Statisches Hosting genügt. Lokal z. B.:
```
cd src && python3 -m http.server 8080
```
Dann im Browser `http://localhost:8080` öffnen. Für iPhone-Test: gleiche URL über lokale IP im WLAN, oder auf GitHub Pages/Netlify deployen (siehe KONZEPT.md §6).
