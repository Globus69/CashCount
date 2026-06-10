# CashCount

Kleines, lokales **Kassenbuch** als **PWA** fürs iPhone. Schnelle Eingabe von Ausgaben & Einnahmen, komplett **offline**, Daten bleiben **lokal** auf dem Gerät. Kein App Store, kein Entwickler-Account.

- 📖 Konzept & Datenmodell: [docs/KONZEPT.md](docs/KONZEPT.md)
- 🗺️ Roadmap & Entscheidungen: [ITERATION.md](ITERATION.md)
- 🤖 Arbeitsanweisungen: [CLAUDE.md](CLAUDE.md)

## Schnellstart (lokal testen)
```bash
cd src
python3 -m http.server 8080
# Browser: http://localhost:8080
```

## Auf dem iPhone installieren (Kurzfassung)
1. `src/` über HTTPS hosten (GitHub Pages / Netlify — kostenlos).
2. URL in **Safari** öffnen → Teilen → **„Zum Home-Bildschirm"**.
3. App startet im Vollbild und läuft danach offline; Daten liegen lokal.

Details: [docs/KONZEPT.md §6](docs/KONZEPT.md#6-installation-auf-dem-iphone-ohne-app-store--ohne-dev-account).

## Stack
Vanilla HTML/CSS/JS, kein Build-Step. PWA (Manifest + Service Worker), Speicher via IndexedDB. Geldbeträge intern als Cent-Integer.
