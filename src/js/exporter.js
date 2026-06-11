// exporter.js — CSV-Export & JSON-Backup. Auf iOS bevorzugt über das Teilen-Sheet.

const Exporter = (() => {

  function csvEscape(s) {
    s = String(s == null ? '' : s);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // transactions -> CSV-String (deutsch: Semikolon, Komma-Dezimal, mit BOM für Excel)
  function toCSV(transactions, categories, accounts) {
    const catName = (id) => {
      const c = categories.find((x) => x.id === id);
      if (!c) return 'Unbekannt';
      if (c.parentId) {
        const p = categories.find((x) => x.id === c.parentId);
        return (p ? p.name + ' / ' : '') + c.name;
      }
      return c.name;
    };
    const accName = (id) => {
      const a = (accounts || []).find((x) => x.id === id);
      return a ? a.name : '';
    };
    const head = ['Datum', 'Typ', 'Kategorie', 'Konto', 'Betrag', 'Notiz'];
    const rows = [...transactions]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map((t) => [
        t.date,
        t.type === 'income' ? 'Einnahme' : 'Ausgabe',
        catName(t.categoryId),
        accName(t.accountId),
        Money.format(t.amountCents, { withSymbol: false }),
        t.note || '',
      ].map(csvEscape).join(';'));
    return '﻿' + [head.join(';'), ...rows].join('\r\n');
  }

  function tsStamp() {
    return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  }

  // Versucht Teilen (iOS), sonst klassischer Download.
  async function deliver(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return 'shared'; }
      catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; /* sonst Fallback */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }

  async function exportCSV(transactions, categories, accounts) {
    return deliver(`cashcount-${tsStamp()}.csv`, toCSV(transactions, categories, accounts), 'text/csv');
  }

  async function exportBackup(backupObj) {
    return deliver(`cashcount-backup-${tsStamp()}.json`,
      JSON.stringify(backupObj, null, 2), 'application/json');
  }

  function readBackupFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        try { resolve(JSON.parse(r.result)); }
        catch (e) { reject(new Error('Datei ist kein gültiges JSON')); }
      };
      r.onerror = () => reject(r.error);
      r.readAsText(file);
    });
  }

  return { toCSV, exportCSV, exportBackup, readBackupFile };
})();

if (typeof module !== 'undefined') module.exports = Exporter;
