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

## Offene Punkte / zu klären (beantwortet, in Iteration 4 verarbeitet)
- App-Icon: ok, aber in Rot/Orange → **noch offen** (siehe „Offen / später")
- Standard-Kategorien → ersetzt durch Kategorie-Hierarchie aus Iteration 4 (s. u.)
- Anfangsbestand „monatlich neu" → **revidiert**: mit echten Konten durchlaufend (s. Iteration 4)
- Wiederkehrend: Intervalle täglich/wöchentlich/monatlich ✅ (seit Iteration 2)



## Änderungen
01 Auf der Eingabepage sollen vorhanden sein:
Vier Schnell Eingabe Buttons mit: 2,50 € 5 Euro 7,50 Euro, 10 Euro
Bei dem Druck auf die Buttons nacheinander oder mehrfach, Werden die Werte addiert.
Ein Clear Button muss auch neben die angezeigte Summe Platziert werden.

02 die Eingabe von Kategorien soll wie folgt aussehen: Vier Buttons So wie sie jetzt sind Mit folgendem Content:
Drei Spalten:
Spalte a) Einkauf
- Lebensmittel
- Haushalt
- Kleidung
- sonstiges

Spalte b) Boot
- Energie
-- Diesel
-- Benzin
-- Gas
- Technik
-- 

Die Spalten Überschriften ABC sollen immer eingeblendet werden mit darunter eingeblendet Der ersten Ebene
Beispiel:
Boot
- Energie
- Technik


Wird dann zum Beispiel Energie ausgewählt, Wird die zweite Ebene eingeblendet
- Energie
-- Diesel
-- Benzin
-- Gas

03 An einer sinnvollen und praktischen Stelle muss ebenso ausgewählt werden können von welchem Account bezahlt wird:
- Bar
- Sparda
- Revolut
- Mercedes
Vorgabe ist "Bar"

04 Auf einer Unterseite müssen eingestellt werden können Transfer von Konto  A nach B oder Einzahlung oder Abhebungen Von Bargeld

05 Auf der Eingabeseite muss auch klein angezeigt werden die Summe aller Konten Und Die Beträge der Einzel Konten

## Iteration 4 — Konten, Schnell-Eingabe & Kategorie-Hierarchie (umgesetzt 2026-06-11)

- [x] 01 Schnell-Eingabe-Buttons (2,50/5/7,50/10 €, additiv) + Clear-Button am Betragsfeld
- [x] 02 Kategorie-Hierarchie: 3 Spalten (Einkauf/Boot/Sonstiges), Ebene 2 ausklappbar
- [x] 03 Konto-Auswahl beim Erfassen (Bar/Sparda/Revolut/Mercedes, Vorgabe Bar)
- [x] 04 Konten-Tab: Transfer/Einzahlung/Abhebung (reine Umbuchung, nicht in Monatsstatistik)
- [x] 05 Kleine Konten-Summe (gesamt + je Konto) auf der Eingabeseite
- [x] DB v2 (Stores accounts/transfers), CSV mit Konto-Spalte, Service-Worker v6/v7

### Review-Fixes (2026-06-11, nach Agenten-Review)
- [x] **Migration v1→v2**: alte Kategorien ohne `group` machten den Ausgaben-Picker leer
      (Kategorie-Auswahl unsichtbar auf Bestandsgeräten!) → neue Struktur wird nachgeseedet,
      alte flache Ausgaben-Kategorien archiviert; alter globaler Anfangsbestand
      (`settings.startBalanceCents`) wandert aufs Default-Konto
- [x] **Backup-Import alter v1-Backups**: leerte den Konten-Store → `importAll` ruft jetzt
      `ensureSeed` (Migration) auf; Icon/Farbe werden beim Import validiert
- [x] **Datums-Bug (kritisch)**: `nextDay()` via `toISOString()` (UTC) lieferte in UTC+x
      denselben Tag zurück → Endlosschleife in `generateDueRecurring` sobald eine Regel
      aktiv ist; jetzt lokale Datumsformatierung überall
- [x] Toast global statt nur in „Erfassen" sichtbar (z. B. „Umgebucht ✓", Import-Fehler)
- [x] „beides"-Kategorien erscheinen jetzt auch im Ausgaben-Picker
- [x] Max. 2 Kategorie-Ebenen erzwungen; Archivieren eines Parents archiviert Kinder mit
- [x] Reaktivierte wiederkehrende Regel füllt inaktiven Zeitraum nicht mehr rückwirkend auf
- [x] CSV: Alt-Buchungen ohne Konto werden dem Default-Konto zugeordnet (wie in der App)
- [x] `Money.parse`: „1.234,56" (Tausenderpunkt) korrekt

Verbindliche Antworten zu 01–05 (per Spokenly geklärt):

### 02 — Kategorie-Hierarchie (alte flache Kategorien werden ERSETZT, später neu iteriert)
Drei feste Spalten, Überschrift immer sichtbar, darunter Ebene-1-Buttons; Tap auf eine
Ebene-1-Kategorie mit Kindern klappt Ebene 2 auf.
- **a) Einkauf:** Lebensmittel, Haushalt, Kleidung, Sonstiges  (Ebene 2 vorerst leer → „später")
- **b) Boot:**
  - Energie → Diesel, Benzin, Gas
  - Technik → Inside, Outside
- **c) Sonstiges:** Geschenk (u. a., später ergänzen)

### 03/05 — Konten
- Konten: **Bar** (Vorgabe), **Sparda**, **Revolut**, **Mercedes**.
- **Bestand pro Konto** (eigener Anfangsbestand je Konto), durchlaufend — KEIN monatliches
  Zurücksetzen (überschreibt die frühere „monatlich neu"-Entscheidung; mit echten Konten sinnlos).
- Jede Buchung wirkt nur auf das gewählte Konto.
- Eingabeseite zeigt klein: **Summe aller Konten** = Addition + die Einzel-Konto-Beträge.

### 04 — Transfer-Unterseite
- Transfer Konto A → B sowie Bargeld-Einzahlung/Abhebung.
- Reine Umbuchung: **NICHT** als Einnahme/Ausgabe in der Monatsübersicht zählen,
  verändert nur die Konto-Bestände.

### 01 — Schnell-Eingabe
- Vier additive Buttons: 2,50 € · 5 € · 7,50 € · 10 € (mehrfach tippen addiert).
- Clear-Button neben der angezeigten Summe.

### Offen / später
- Ebene-2 für Einkauf-Kategorien, weitere Sonstiges-Einträge, Icon-Recolor (Rot/Orange).
