// =============================================================================
// CashCount — KONFIGURATION
// =============================================================================
// Das ist DEINE Datei zum Anpassen. Ändere die Werte unten frei.
// Regeln: Texte in "Anführungszeichen", Zahlen ohne, Listen in [ ... ],
// Einträge mit Komma trennen. Bei Unsicherheit: lieber kommentieren statt löschen
// (// am Zeilenanfang macht eine Zeile inaktiv).
//
// Diese Werte sind die STANDARDWERTE/Vorgaben. Wenn du in der App z. B. den
// Anfangsbestand setzt, überschreibt das den hier hinterlegten Default.
// =============================================================================

const CONFIG = {

  // --- Allgemein ----------------------------------------------------------
  app: {
    title: "CashCount",     // Name, der oben/als App-Titel erscheint
    currency: "EUR",        // Währungscode
    symbol: "€",            // angezeigtes Währungszeichen
    locale: "de-DE",        // Format für Zahlen/Datum (Deutsch)
  },

  // --- Konten -------------------------------------------------------------
  // Jedes Konto hat einen EIGENEN, durchlaufenden Bestand. Buchungen wirken
  // nur auf das gewählte Konto. "startEuro" ist der Anfangsbestand in EURO
  // (NICHT Cent) — den echten Wert setzt du bequem im Tab „Konten".
  accounts: {
    list: [
      { name: "Bar",      startEuro: 0.00 },
      { name: "Sparda",   startEuro: 0.00 },
      { name: "Revolut",  startEuro: 0.00 },
      { name: "Mercedes", startEuro: 0.00 },
    ],
    default: "Bar",         // beim Erfassen vorausgewähltes Konto
  },

  // --- Schnell-Eingabe ----------------------------------------------------
  // Buttons auf der Erfassen-Seite. Mehrfaches Tippen addiert die Werte.
  // Beträge in EURO.
  quickAmountsEuro: [2.50, 5.00, 7.50, 10.00],

  // --- Anfangsbestand -----------------------------------------------------
  balance: {
    // Bestand läuft durchlaufend (kein monatliches Zurücksetzen).
    mode: "once",
  },

  // --- Kategorien (Ausgaben) ---------------------------------------------
  // Hierarchie in Spalten. Jede Spalte hat eine Überschrift (column) und
  // Ebene-1-Einträge (items). Ein Eintrag kann "children" (Ebene 2) haben;
  // dann wird beim Antippen die zweite Ebene aufgeklappt und dort gebucht.
  // icon: Emoji, color: Hex.
  //
  // WICHTIG: Hier NEU eingetragene Kategorien werden beim nächsten App-Start
  // automatisch ergänzt (auch auf Geräten mit vorhandenen Daten). Bestehende
  // Kategorien werden dabei nie verändert oder gelöscht — Umbenennen/Löschen
  // machst du direkt in der App (Mehr -> Kategorien).
  categoryTree: [
    {
      column: "Einkauf",
      items: [
        { name: "Lebensmittel", icon: "🛒", color: "#22c55e", children: [
          { name: "Supermarkt", icon: "🛒", color: "#22c55e" },
          { name: "Bäcker",     icon: "🥐", color: "#eab308" },
        ] },
        { name: "Haushalt",     icon: "🧺", color: "#3b82f6" },
        { name: "Kleidung",     icon: "👕", color: "#a855f7" },
        { name: "Sonstiges",    icon: "📦", color: "#64748b" },
      ],
    },
    {
      column: "Boot",
      items: [
        { name: "Energie", icon: "⛽", color: "#f97316", children: [
          { name: "Diesel", icon: "🛢️", color: "#f97316" },
          { name: "Benzin", icon: "⛽", color: "#eab308" },
          { name: "Gas",    icon: "🔥", color: "#ef4444" },
        ] },
        { name: "Technik", icon: "🔧", color: "#14b8a6", children: [
          { name: "Inside",  icon: "🛋️", color: "#14b8a6" },
          { name: "Outside", icon: "⚓", color: "#3b82f6" },
        ] },
      ],
    },
    {
      column: "Sonstiges",
      items: [
        { name: "Geschenk", icon: "🎁", color: "#ec4899" },
      ],
    },
  ],

  // --- Kategorien (Einnahmen) --------------------------------------------
  // Einnahmen sind (noch) flach. Werden als Chips angezeigt.
  incomeCategories: [
    { name: "Einnahme", icon: "💰", color: "#16a34a" },
  ],

  // --- Wiederkehrende Einträge -------------------------------------------
  recurring: {
    // Welche Intervalle sollen auswählbar sein? Entferne, was du nicht brauchst.
    enabledIntervals: ["daily", "weekly", "monthly"],
  },

  // --- Bedienung / UI -----------------------------------------------------
  ui: {
    defaultType: "expense",   // beim Erfassen vorausgewählt: "expense" oder "income"
    defaultView: "capture",   // Startansicht: "capture" | "history" | "accounts" | "more"
    // Farben des Erscheinungsbilds (Hex). Standard: dunkles Design.
    theme: {
      accent:  "#0f766e",     // Akzentfarbe (Bestandsbereich, Buttons)
      expense: "#ef4444",     // Farbe für Ausgaben
      income:  "#22c55e",     // Farbe für Einnahmen
    },
    // Farbauswahl beim Anlegen/Bearbeiten von Kategorien (frei erweiterbar).
    colorPalette: [
      "#22c55e", "#16a34a", "#f97316", "#eab308", "#3b82f6",
      "#a855f7", "#ec4899", "#ef4444", "#14b8a6", "#64748b",
    ],
  },

  // --- Export / Backup ---------------------------------------------------
  export: {
    enabled: true,            // CSV-Export & JSON-Backup im Tab "Mehr" -> "Daten"
    format: "csv",
  },

  // =========================================================================
  // MEINE WÜNSCHE / NOTIZEN
  // -------------------------------------------------------------------------
  // Trag hier formlos ein, was du dir wünschst oder geändert haben möchtest.
  // Ich (Claude) lese das beim nächsten Mal und setze es um.
  // =========================================================================
  wishes: [
    // "Beispiel: Bitte eine Kategorie 'Auto' ergänzen.",
  ],

};

// nicht ändern: macht CONFIG im Browser und in Tests verfügbar
if (typeof module !== "undefined") module.exports = CONFIG;
