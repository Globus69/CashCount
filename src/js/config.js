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

  // --- Anfangsbestand -----------------------------------------------------
  balance: {
    // "once"    = ein einmaliger Anfangsbestand, läuft durch
    // "monthly" = jeder Monat startet neu mit diesem Wert
    mode: "once",
    // Vorgabewert in EURO (NICHT Cent). Beispiel: 100.00 = 100 Euro.
    // Den echten Wert setzt du später bequem in der App.
    defaultStartEuro: 0.00,
  },

  // --- Kategorien ---------------------------------------------------------
  // type: "expense" = nur Ausgaben, "income" = nur Einnahmen, "both" = beides.
  // icon: ein Emoji. color: Hex-Farbe. Reihenfolge = Anzeigereihenfolge.
  // Lösche, ergänze oder benenne nach Belieben um.
  categories: [
    { name: "Lebensmittel", icon: "🛒", color: "#22c55e", type: "expense" },
    { name: "Restaurant",   icon: "🍽️", color: "#f97316", type: "expense" },
    { name: "Transport",    icon: "🚗", color: "#3b82f6", type: "expense" },
    { name: "Wohnen",       icon: "🏠", color: "#a855f7", type: "expense" },
    { name: "Freizeit",     icon: "🎉", color: "#ec4899", type: "expense" },
    { name: "Gesundheit",   icon: "💊", color: "#ef4444", type: "expense" },
    { name: "Sonstiges",    icon: "📦", color: "#64748b", type: "expense" },
    { name: "Einnahme",     icon: "💰", color: "#16a34a", type: "income"  },
  ],

  // --- Wiederkehrende Einträge -------------------------------------------
  recurring: {
    // Welche Intervalle sollen auswählbar sein? Entferne, was du nicht brauchst.
    enabledIntervals: ["daily", "weekly", "monthly"],
  },

  // --- Bedienung / UI -----------------------------------------------------
  ui: {
    defaultType: "expense",   // beim Erfassen vorausgewählt: "expense" oder "income"
    defaultView: "capture",   // Startansicht: "capture" | "history" | "more"
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
    // "Beispiel: Anfangsbestand soll monatlich neu starten.",
  ],

};

// nicht ändern: macht CONFIG im Browser und in Tests verfügbar
if (typeof module !== "undefined") module.exports = CONFIG;
