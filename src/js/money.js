// money.js — zentrale Geld-Helfer. Intern wird IMMER in Cent (Integer) gerechnet.
// Anzeige/Parsing nur über diese Funktionen.

const Money = {
  // Cent (Integer) -> "12,34 €"
  format(cents, { withSymbol = true } = {}) {
    const value = (cents || 0) / 100;
    const str = value.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return withSymbol ? `${str} €` : str;
  },

  // Nutzereingabe ("12,34", "12.34", "12") -> Cent (Integer) oder null
  parse(input) {
    if (input == null) return null;
    const cleaned = String(input).trim().replace(/\s|€/g, '').replace(',', '.');
    if (cleaned === '' || isNaN(Number(cleaned))) return null;
    return Math.round(Number(cleaned) * 100);
  },
};

// im Browser global, in Tests via module
if (typeof module !== 'undefined') module.exports = Money;
