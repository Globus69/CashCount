# ITERATION.md — CashCount

Lebendiges Dokument für Roadmap, Entscheidungen und offene Punkte. Neueste Einträge oben.

## Getroffene Entscheidungen
- **2026-06-10**
  - Ansatz: **PWA** (Safari → Zum Home-Bildschirm), offline, Daten lokal (IndexedDB). ✅
  - Umfang: **Anfangsbestand + Ausgaben + Einnahmen** (echtes Kassenbuch, Soll/Haben). ✅
  - **Export (CSV)**: erst später, Datenmodell aber gleich dafür ausgelegt.
  - Sprache/Währung: **Deutsch, Euro**. ✅
  - Stack: **Vanilla JS, kein Build-Step**; Geld als Cent-Integer.

## Roadmap

### Iteration 0 — Setup (erledigt)
- [x] Konzept (docs/KONZEPT.md)
- [x] Projektstruktur & Doku (CLAUDE.md, ITERATION.md, README.md)
- [x] PWA-Grundgerüst (index.html, manifest, service-worker, Ordner)

### Iteration 1 — MVP Erfassung (erledigt 2026-06-10)
- [x] IndexedDB-Wrapper (`db.js`): settings, categories, transactions, recurring + Seeding
- [x] Geld-Helfer (`money.js`): Cent ↔ „12,34 €", Eingabe-Parsing
- [x] Zentrale Konfiguration (`config.js`) inkl. Theme/Defaults/Kategorien
- [x] Anfangsbestand setzen (Tab „Mehr")
- [x] Eintrag erfassen (Betrag, Ausgabe/Einnahme, Kategorie, Datum, Notiz)
- [x] Aktueller Bestand live berechnen & anzeigen (once + monthly)
- [x] Verlaufsliste (nach Tag gruppiert, Tagessumme) + bearbeiten/löschen
- [x] Vordefinierte Kategorien aus CONFIG (Seed beim ersten Start)

### Iteration 2 — Kategorien & Wiederkehrend (erledigt 2026-06-10)
- [x] Eigene Kategorien anlegen/bearbeiten/archivieren (Overlay, Farb-Swatches aus CONFIG)
- [x] Wiederkehrende Einträge (Regeln: täglich/wöchentlich/monatlich, Start/Ende, aktiv)
- [x] Automatische Erzeugung fälliger Einträge beim App-Start (markiert mit ↻)
- [x] Monatsübersicht: Einnahmen/Ausgaben/Saldo + Ausgaben pro Kategorie (Balken)

### Iteration 3 — Komfort & Export (erledigt 2026-06-10)
- [x] CSV-Export (iOS-Teilen-Sheet, Fallback Download; deutsches Format, BOM)
- [x] JSON-Backup sichern & laden (ersetzt alle Daten, mit Bestätigung)
- [x] Filter & Suche im Verlauf (Text, Typ, Kategorie)
- [x] App-Icons (180/192/512 + maskable) generiert — Euro-Münze im Theme-Look

## Offene Punkte / zu klären
- App-Icon: gewünschtes Motiv/Farbe? (Platzhalter vorerst)
- Standard-Kategorien: welche Liste passt für dich (z. B. Lebensmittel, Restaurant, Transport, Wohnen, Freizeit, Sonstiges)?
- Soll der Anfangsbestand pro Zeitraum (z. B. monatlich neu) oder einmalig gelten?
- Wiederkehrend: welche Intervalle brauchst du konkret (täglich/wöchentlich/monatlich)?
