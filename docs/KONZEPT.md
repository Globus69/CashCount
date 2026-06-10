# CashCount — Konzept

> Kleines, lokales Kassenbuch für das iPhone. Schnelle Eingabe „on the fly", komplett offline, Daten bleiben auf dem Gerät.

## 1. Ziel & Rahmen

- **Zweck:** Tägliche Erfassung von Ausgaben (und Einnahmen) als einfaches Kassenbuch.
- **Nutzung:** ca. 10 Einträge pro Tag, sehr schnelle Bedienung.
- **Plattform:** iPhone, als **PWA** (Progressive Web App) — wird in Safari geöffnet und über „Zum Home-Bildschirm" als App-Icon abgelegt.
- **Datenhaltung:** ausschließlich **lokal** auf dem iPhone (IndexedDB). Keine Cloud, kein Server, kein Account.
- **Kein** App Store, **kein** Entwickler-Account, **keine** Ablauffristen.
- **Sprache/Währung:** Deutsch, Euro (€).

## 2. Funktionsumfang (Scope)

### Muss (MVP)
- **Anfangsbestand** eingeben/ändern.
- **Eintrag erfassen:** Betrag, Typ (Ausgabe/Einnahme), Kategorie, Datum (Default heute), optionale Notiz.
- **Kategorien** zuweisen (vordefinierte Liste + eigene anlegbar).
- **Aktueller Bestand** wird automatisch berechnet und prominent angezeigt:
  `Bestand = Anfangsbestand + Σ Einnahmen − Σ Ausgaben`
- **Liste** der Einträge (chronologisch, nach Tag gruppiert).
- **Eintrag bearbeiten / löschen.**

### Soll
- **Wiederkehrende Einträge** (z. B. monatlich Miete, wöchentlich Abo): Regel anlegen → wird automatisch an Fälligkeitsterminen als Eintrag erzeugt.
- **Tages-/Monatssumme** und einfache Übersicht pro Kategorie.

### Kann (später)
- **Export** als CSV (zum Sichern/Teilen, iCloud) — Datenmodell ist dafür vorbereitet.
- Import / Backup-Datei.
- Filter & Suche.
- Dark Mode (folgt System).

## 3. Datenmodell (lokal, IndexedDB)

Object Stores:

### `settings` (Einzelobjekt, key = "app")
```
{
  startBalance: number,   // Anfangsbestand in Cent
  startDate: string,      // ISO-Datum, ab wann gerechnet wird
  currency: "EUR",
  locale: "de-DE"
}
```

### `categories`
```
{
  id: string,             // uuid
  name: string,           // z.B. "Lebensmittel"
  icon: string,           // Emoji oder Icon-Key
  color: string,          // Hex
  type: "expense" | "income" | "both",
  archived: boolean
}
```

### `transactions`
```
{
  id: string,             // uuid
  date: string,           // ISO-Datum
  amountCents: number,    // immer positiv, in Cent
  type: "expense" | "income",
  categoryId: string,
  note: string,
  recurringId: string | null,  // Herkunft, falls aus Regel erzeugt
  createdAt: string
}
```

### `recurring` (Regeln für wiederkehrende Einträge)
```
{
  id: string,
  amountCents: number,
  type: "expense" | "income",
  categoryId: string,
  note: string,
  interval: "daily" | "weekly" | "monthly",
  anchorDay: number,      // z.B. Tag im Monat (1–31) bzw. Wochentag (0–6)
  startDate: string,
  endDate: string | null,
  lastRun: string | null, // bis wann bereits Einträge erzeugt wurden
  active: boolean
}
```

> **Geldbeträge** werden durchgängig in **Cent (Integer)** gespeichert, um Rundungsfehler zu vermeiden. Formatierung erst bei der Anzeige.

## 4. Bedienoberfläche (grob)

Bottom-Navigation mit 3 Bereichen — optimiert für Daumenbedienung:

1. **Erfassen** (Startansicht)
   - Großer Bestand oben.
   - Ziffernblock + Betragsfeld, Umschalter Ausgabe/Einnahme.
   - Kategorie-Chips (häufigste zuerst).
   - Großer „Speichern"-Button.
2. **Verlauf**
   - Einträge nach Tag gruppiert, mit Tagessumme.
   - Tippen → bearbeiten/löschen.
3. **Mehr / Einstellungen**
   - Anfangsbestand, Kategorien verwalten, wiederkehrende Einträge, (später) Export.

Designprinzip: **so wenige Taps wie möglich** für einen Standard-Eintrag (Betrag → Kategorie → Speichern).

## 5. Technik

- **Vanilla HTML/CSS/JS**, kein Build-Step — leicht zu hosten und zu warten.
- **PWA-Bausteine:** `manifest.webmanifest` (Icon, Standalone-Anzeige) + `service-worker.js` (Offline-Cache der App-Dateien).
- **Speicher:** IndexedDB (über kleine Wrapper-Funktionen in `js/db.js`).
- Keine externen Frameworks nötig; bei Bedarf später eine kleine Lib.

## 6. Installation auf dem iPhone (ohne App Store / ohne Dev-Account)

Eine PWA muss **einmalig** über HTTPS erreichbar sein, damit Safari sie installieren und offline cachen kann. Empfohlene Wege (alle kostenlos):

**Option A — GitHub Pages (empfohlen, dauerhaft):**
1. Dateien aus `src/` in ein GitHub-Repo legen, GitHub Pages aktivieren.
2. Auf dem iPhone die URL in **Safari** öffnen.
3. Teilen-Symbol → **„Zum Home-Bildschirm"**.
4. App-Icon erscheint, startet im Vollbild, läuft danach **offline**. Daten liegen lokal.

**Option B — Netlify / Cloudflare Pages:** identisch, Ordner per Drag&Drop hochladen → HTTPS-URL → Safari → Home-Bildschirm.

**Option C — Nur im lokalen WLAN testen (kein dauerhaftes Icon-Offline garantiert):**
   Auf dem Mac einen kleinen Webserver starten (z. B. `python3 -m http.server`) und die lokale IP am iPhone öffnen. Gut zum Entwickeln, für „dauerhaft installiert" ist Option A/B besser.

> Wichtig: Nach dem Hinzufügen zum Home-Bildschirm braucht die App **kein Internet** mehr. Updates der App holst du dir, indem du die gehostete Seite erneut öffnest (Service Worker aktualisiert den Cache).

### Alternativen (falls PWA nicht reichen sollte)
- **Scriptable** (App): JS-Skripte lokal, aber andere UI-Möglichkeiten.
- **Sideloading nativer App** via AltStore/Xcode: braucht Mac und alle 7 Tage Neusignierung (ohne bezahlten Account) → umständlich, daher hier nicht gewählt.

## 7. Offene Punkte / Entscheidungen
Siehe [ITERATION.md](../ITERATION.md).
