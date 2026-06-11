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

  // Nutzereingabe ("12,34", "12.34", "1.234,56", "12") -> Cent (Integer) oder null
  parse(input) {
    if (input == null) return null;
    let s = String(input).trim().replace(/\s|€/g, '');
    // Deutsches Format: wenn ein Komma vorkommt, sind Punkte Tausendertrenner.
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    if (s === '' || isNaN(Number(s))) return null;
    return Math.round(Number(s) * 100);
  },
};

// im Browser global, in Tests via module
if (typeof module !== 'undefined') module.exports = Money;
