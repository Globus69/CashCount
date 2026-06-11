# ITERATION.md — CashCount

Lebendiges Dokument. **Neue Anforderungen unten unter „Neu" eintragen** — sie werden bei
der nächsten Iteration gelesen, offene Fragen per Spokenly geklärt und dann umgesetzt.
Die Detail-Historie aller Iterationen steht in den Git-Commits.

---

## Neu (hier neue Anforderungen eintragen)

*(zurzeit leer)*

---

## Status

Stand **2026-06-11**: Iterationen 0–9 vollständig umgesetzt und live unter
https://globus69.github.io/CashCount/ (Service-Worker v12). Geräte-Sync über das
private Repo `Globus69/cashcount-daten` ist eingerichtet und läuft.

## Getroffene Entscheidungen (gültig)

- **PWA** (Safari → Home-Bildschirm), offline-first, **Vanilla JS ohne Build-Step**.
- **Geld immer als Cent-Integer**; Sprache/Währung Deutsch / Euro.
- **Konten** Bar (Vorgabe), Sparda, Revolut, Mercedes — Bestand **pro Konto**,
  durchlaufend (kein monatliches Zurücksetzen).
- **Transfers** (auch Bargeld-Ein-/Auszahlung) sind reine Umbuchungen —
  zählen **nicht** als Einnahme/Ausgabe.
- **Kategorien**: 3 Spalten (Einkauf / Boot / Sonstiges), **max. 2 Ebenen**,
  gebucht wird nur auf Blatt-Kategorien.
- **Geräte-Sync** über privates GitHub-Repo (Contents-API) — kein eigener Server;
  Token/Repo liegen nur lokal auf dem Gerät.
- **config.js-Abgleich**: dort neu eingetragene Kategorien werden beim App-Start
  ergänzt (auch auf Bestandsgeräten); bestehende/archivierte bleiben unangetastet.

## Erledigte Iterationen (Kurzfassung)

### Iteration 0–3 (2026-06-10) — Grundgerüst & MVP
PWA-Setup (Manifest, Service-Worker, Icons) · Erfassen/Verlauf/Bearbeiten ·
eigene Kategorien · wiederkehrende Regeln (täglich/wöchentlich/monatlich) mit
Auto-Erzeugung · Monatsübersicht · CSV-Export (iOS-Teilen) · JSON-Backup · Filter & Suche.

### Iteration 4 (2026-06-11) — Konten, Schnell-Eingabe & Kategorie-Hierarchie
Vier additive Schnell-Buttons (2,50/5/7,50/10 €) + Clear · Kategorie-Spalten mit
ausklappbarer Ebene 2 · Konto-Auswahl beim Erfassen · Konten-Tab mit
Transfer/Ein-/Auszahlung & Anfangsbeständen je Konto · Konten-Summe auf der
Eingabeseite · DB v2 (accounts/transfers) · CSV mit Konto-Spalte.
**Review-Fixes:** v1→v2-Migration (leerer Picker auf Bestandsgeräten), Backup-Import
alter Backups, UTC-Datums-Bug (Endlosschleife in `generateDueRecurring`), Toast global,
„beides"-Kategorien, max. 2 Ebenen erzwungen, `Money.parse` Tausenderpunkt u. a.

### Iteration 5 (2026-06-11) — Kompakt-Layout, Statistik & Prognose
Kompakte Bestands-Kopfzeile · Speichern-Button sticky (immer sichtbar) ·
Statistik-Tab 📊: Monats-Navigation, Kennzahlen-Karten, Donut „Ausgaben nach Bereich",
Tagesbalken, 6-Monats-Trend, Top-Kategorien · 3-Monats-Prognose aus wiederkehrenden
Regeln auf der Eingabeseite.

### Iteration 6 (2026-06-11) — Offene Punkte & Config-Abgleich
App-Icon in Rot/Orange (Motiv Euro-Münze) · Lebensmittel → Supermarkt/Bäcker ·
`syncConfigCategories` (config.js-Abgleich) · nur-vertikales Scrollen auf dem iPhone.

### Iteration 7 (2026-06-11) — Geräte-Sync über GitHub
`js/sync.js`: privates Repo als Speicher, SHA-Locking · automatisch beim Start
(vor `generateDueRecurring`), alle 5 Min, ~8 s nach Änderungen · ↻-Button im Kopf +
„Jetzt synchronisieren" in „Mehr" · Konflikt → Nachfrage · Einrichtung erfolgt:
Repo `Globus69/cashcount-daten`, Fine-grained-Token (Contents Read/Write).

### Iteration 8 (2026-06-11) — Kategorien-Editor, DB-Reset & Datei-Neustrukturierung
Diese Datei neu strukturiert (alles Bisherige erledigt) · Neue Seite
**`kategorien.html`** (für Desktop gedacht, Link in „Mehr"): Kategorien und
Unterkategorien grafisch bearbeiten — umbenennen, Icon/Farbe ändern, Reihenfolge
per Drag & Drop oder Pfeilen, Ebene wechseln (Ebene 1 ↔ 2), Spalte/Elternknoten
verschieben, neu anlegen, archivieren, löschen · **Datenbank-Reset**-Button mit
doppeltem Warnhinweis · schreibt direkt in die Datenbank und stößt den Geräte-Sync an.

### Iteration 9 (2026-06-11) — Picker-Bugfixes & Savebar
**Kategorie-Wechsel-Bug** behoben: `syncCategory` erzwang den aufgeklappten
Elternknoten bei jedem Render — bei offener Kategorie ließ sich keine andere
öffnen und erneutes Tippen klappte nicht ein; Auf-/Zuklappen steuert jetzt
allein der User · **Einklappen per erneutem Tipp** funktioniert (auch mit
gewählter Unterkategorie; Auswahl bleibt markiert) · **Speichern-Button** als
opake Sticky-Leiste in voller Breite mit weichem Übergang — dahinter scheint
beim Scrollen nichts mehr durch · Härtung: fehlende Konten werden beim Start
einzeln ergänzt (robust gegen unterbrochenes Erst-Seeding; erlaubt neue Konten
via config.js) · Service-Worker v12.


