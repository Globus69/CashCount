// app.js — UI-Steuerung.
// Iteration 1: Erfassen, Live-Bestand, Verlauf (bearbeiten/löschen), Anfangsbestand.
// Iteration 2: Kategorien-CRUD, wiederkehrende Einträge (+ Auto-Erzeugung), Monatsübersicht.

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const INTERVAL_LABELS = { daily: 'täglich', weekly: 'wöchentlich', monthly: 'monatlich' };
  // getDay(): 0=So … 6=Sa. Anzeige Mo–So.
  const WEEKDAYS = [
    { v: 1, l: 'Montag' }, { v: 2, l: 'Dienstag' }, { v: 3, l: 'Mittwoch' },
    { v: 4, l: 'Donnerstag' }, { v: 5, l: 'Freitag' }, { v: 6, l: 'Samstag' }, { v: 0, l: 'Sonntag' },
  ];

  const state = {
    settings: null,
    categories: [],
    transactions: [],
    recurring: [],
    capture: { type: CONFIG.ui.defaultType || 'expense', categoryId: null },
    edit: { id: null, type: null, categoryId: null },
    cat: { id: null, color: null },
    recur: { id: null, type: 'expense', categoryId: null },
    filter: { q: '', type: 'all', cat: 'all' },
  };

  // ---------- Datums-Helfer ----------
  function nextDay(iso) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  function isDue(rule, iso) {
    const d = new Date(iso + 'T00:00:00');
    if (rule.interval === 'daily') return true;
    if (rule.interval === 'weekly') return d.getDay() === rule.anchorDay;
    if (rule.interval === 'monthly') {
      const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(rule.anchorDay || 1, dim);
    }
    return false;
  }

  // ---------- Allgemeine Helfer ----------
  function applyTheme() {
    const t = (CONFIG.ui && CONFIG.ui.theme) || {};
    const root = document.documentElement.style;
    if (t.accent) root.setProperty('--accent', t.accent);
    if (t.expense) root.setProperty('--expense', t.expense);
    if (t.income) root.setProperty('--income', t.income);
  }
  const categoryById = (id) => state.categories.find((c) => c.id === id) || null;
  const categoriesForType = (type) =>
    state.categories.filter((c) => !c.archived && (c.type === type || c.type === 'both'));

  function dateLabel(iso) {
    if (iso === todayISO()) return 'Heute';
    if (iso === nextDay(new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10))) return 'Gestern';
    return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE',
      { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    setTimeout(() => { t.hidden = true; }, 1500);
  }

  function computeBalance() {
    const s = state.settings || {};
    let txs = state.transactions;
    if ((s.mode || 'once') === 'monthly') {
      const m = todayISO().slice(0, 7);
      txs = txs.filter((t) => (t.date || '').slice(0, 7) === m);
    }
    let bal = s.startBalanceCents || 0;
    for (const t of txs) bal += t.type === 'income' ? t.amountCents : -t.amountCents;
    return bal;
  }

  // ---------- Wiederkehrende Einträge erzeugen ----------
  async function generateDueRecurring() {
    const rules = await DB.listRecurring();
    const today = todayISO();
    let created = 0;
    for (const r of rules) {
      if (!r.active) continue;
      let from = r.startDate;
      if (r.lastRun && r.lastRun >= from) from = nextDay(r.lastRun);
      const end = (r.endDate && r.endDate < today) ? r.endDate : today;
      for (let d = from; d <= end; d = nextDay(d)) {
        if (d < r.startDate) continue;
        if (isDue(r, d)) {
          await DB.putTransaction({
            id: DB.uuid(), date: d, amountCents: r.amountCents, type: r.type,
            categoryId: r.categoryId, note: r.note, recurringId: r.id,
            createdAt: new Date().toISOString(),
          });
          created++;
        }
      }
      r.lastRun = today;
      await DB.putRecurring(r);
    }
    return created;
  }

  // ---------- Chips ----------
  function renderChips(container, type, selectedId, onPick) {
    container.innerHTML = '';
    categoriesForType(type).forEach((c) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (c.id === selectedId ? ' is-active' : '');
      chip.style.setProperty('--chip', c.color);
      chip.innerHTML = `<span class="chip__icon">${c.icon || ''}</span>${escapeHtml(c.name)}`;
      chip.addEventListener('click', () => onPick(c.id));
      container.appendChild(chip);
    });
  }

  // ---------- Renders ----------
  function renderBalance() {
    const bal = computeBalance();
    const el = $('#balanceValue');
    el.textContent = Money.format(bal);
    el.classList.toggle('is-negative', bal < 0);
    const s = state.settings || {};
    $('#balanceSub').textContent =
      s.mode === 'monthly' ? 'Monat ' + todayISO().slice(0, 7) : 'seit ' + (s.startDate || '–');
  }

  function renderCapture() {
    $$('#captureType .typebtn').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.type === state.capture.type));
    const valid = categoriesForType(state.capture.type);
    if (!valid.some((c) => c.id === state.capture.categoryId))
      state.capture.categoryId = valid[0] ? valid[0].id : null;
    renderChips($('#captureChips'), state.capture.type, state.capture.categoryId, (id) => {
      state.capture.categoryId = id; renderCapture();
    });
  }

  function populateFilterCats() {
    const sel = $('#filterCat');
    if (!sel) return;
    const cur = state.filter.cat;
    sel.innerHTML = '<option value="all">Alle Kategorien</option>';
    state.categories.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = (c.icon ? c.icon + ' ' : '') + c.name;
      sel.appendChild(o);
    });
    sel.value = state.categories.some((c) => c.id === cur) ? cur : 'all';
  }

  function applyFilter(txs) {
    const f = state.filter;
    const q = f.q.trim().toLowerCase();
    return txs.filter((t) => {
      if (f.type !== 'all' && t.type !== f.type) return false;
      if (f.cat !== 'all' && t.categoryId !== f.cat) return false;
      if (q) {
        const cat = categoryById(t.categoryId);
        const hay = ((t.note || '') + ' ' + (cat ? cat.name : '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderHistory() {
    const list = $('#historyList');
    list.innerHTML = '';
    if (state.transactions.length === 0) {
      list.innerHTML = '<p class="placeholder">Noch keine Einträge.</p>';
      return;
    }
    const sorted = applyFilter(state.transactions).sort((a, b) =>
      a.date === b.date ? (b.createdAt || '').localeCompare(a.createdAt || '') : b.date.localeCompare(a.date));
    if (sorted.length === 0) {
      list.innerHTML = '<p class="placeholder">Keine Treffer für den Filter.</p>';
      return;
    }
    let currentDay = null;
    sorted.forEach((t) => {
      if (t.date !== currentDay) {
        currentDay = t.date;
        let sum = 0;
        sorted.filter((x) => x.date === currentDay)
          .forEach((x) => sum += x.type === 'income' ? x.amountCents : -x.amountCents);
        const head = document.createElement('div');
        head.className = 'dayhead';
        head.innerHTML = `<span>${dateLabel(currentDay)}</span><span class="${sum < 0 ? 'neg' : 'pos'}">${Money.format(sum)}</span>`;
        list.appendChild(head);
      }
      const cat = categoryById(t.categoryId);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'entry';
      row.innerHTML =
        `<span class="entry__icon" style="--chip:${cat ? cat.color : '#64748b'}">${cat ? cat.icon : '❓'}${t.recurringId ? '<span class="entry__rec">↻</span>' : ''}</span>` +
        `<span class="entry__main"><span class="entry__cat">${cat ? escapeHtml(cat.name) : 'Unbekannt'}</span>` +
        `<span class="entry__note">${t.note ? escapeHtml(t.note) : ''}</span></span>` +
        `<span class="entry__amount ${t.type === 'income' ? 'pos' : 'neg'}">${t.type === 'income' ? '+' : '−'}${Money.format(t.amountCents, { withSymbol: false })} €</span>`;
      row.addEventListener('click', () => openEdit(t));
      list.appendChild(row);
    });
  }

  function renderStats() {
    const m = todayISO().slice(0, 7);
    $('#statMonth').textContent = new Date(m + '-01T00:00:00')
      .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const txs = state.transactions.filter((t) => (t.date || '').slice(0, 7) === m);
    let inc = 0, exp = 0;
    const byCat = {};
    txs.forEach((t) => {
      if (t.type === 'income') inc += t.amountCents;
      else { exp += t.amountCents; byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amountCents; }
    });
    $('#statIncome').textContent = '+' + Money.format(inc);
    $('#statExpense').textContent = '−' + Money.format(exp);
    const net = inc - exp;
    const netEl = $('#statNet');
    netEl.textContent = Money.format(net);
    netEl.className = net < 0 ? 'neg' : 'pos';

    const wrap = $('#statByCat');
    wrap.innerHTML = '';
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) { wrap.innerHTML = '<p class="muted">Keine Ausgaben diesen Monat.</p>'; return; }
    entries.forEach(([id, cents]) => {
      const cat = categoryById(id);
      const pct = exp ? Math.round((cents / exp) * 100) : 0;
      const r = document.createElement('div');
      r.className = 'statcat';
      r.innerHTML =
        `<span class="entry__icon" style="--chip:${cat ? cat.color : '#64748b'}">${cat ? cat.icon : '❓'}</span>` +
        `<span class="statcat__name">${cat ? escapeHtml(cat.name) : 'Unbekannt'}</span>` +
        `<span class="statcat__bar"><span style="width:${pct}%;background:${cat ? cat.color : '#64748b'}"></span></span>` +
        `<span class="statcat__val">${Money.format(cents)}</span>`;
      wrap.appendChild(r);
    });
  }

  function renderCategoryList() {
    const cl = $('#categoryListMore');
    cl.innerHTML = '';
    state.categories.forEach((c) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'catitem' + (c.archived ? ' is-archived' : '');
      item.innerHTML =
        `<span class="entry__icon" style="--chip:${c.color}">${c.icon || ''}</span>` +
        `<span>${escapeHtml(c.name)}</span>` +
        `<span class="muted">${c.archived ? 'archiviert' : (c.type === 'income' ? 'Einnahme' : c.type === 'both' ? 'beides' : 'Ausgabe')}</span>`;
      item.addEventListener('click', () => openCatEdit(c));
      cl.appendChild(item);
    });
  }

  function renderRecurringList() {
    const rl = $('#recurringList');
    rl.innerHTML = '';
    if (state.recurring.length === 0) { rl.innerHTML = '<p class="muted">Noch keine Regeln.</p>'; return; }
    state.recurring.forEach((r) => {
      const cat = categoryById(r.categoryId);
      let when = INTERVAL_LABELS[r.interval] || r.interval;
      if (r.interval === 'weekly') when += ', ' + (WEEKDAYS.find((w) => w.v === r.anchorDay) || {}).l;
      if (r.interval === 'monthly') when += ', Tag ' + r.anchorDay;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'catitem' + (r.active ? '' : ' is-archived');
      item.innerHTML =
        `<span class="entry__icon" style="--chip:${cat ? cat.color : '#64748b'}">${cat ? cat.icon : '↻'}</span>` +
        `<span><span>${escapeHtml((cat ? cat.name : '?') )}</span><br><span class="muted">${when}</span></span>` +
        `<span class="entry__amount ${r.type === 'income' ? 'pos' : 'neg'}">${r.type === 'income' ? '+' : '−'}${Money.format(r.amountCents, { withSymbol: false })} €</span>`;
      item.addEventListener('click', () => openRecurEdit(r));
      rl.appendChild(item);
    });
  }

  function renderMore() {
    const s = state.settings || {};
    $('#startInput').value = Money.format(s.startBalanceCents || 0, { withSymbol: false });
    $('#startMode').textContent = s.mode === 'monthly'
      ? 'Modus: monatlich neu (jeder Monat startet mit diesem Wert).'
      : 'Modus: einmalig (läuft fortlaufend).';
    renderStats();
    renderCategoryList();
    renderRecurringList();
  }

  // ---------- Erfassen / Bestand ----------
  async function saveCapture(e) {
    e.preventDefault();
    const cents = Money.parse($('#amountInput').value);
    if (!cents || cents <= 0) { toast('Bitte gültigen Betrag eingeben'); return; }
    if (!state.capture.categoryId) { toast('Bitte Kategorie wählen'); return; }
    const t = {
      id: DB.uuid(), date: $('#dateInput').value || todayISO(),
      amountCents: cents, type: state.capture.type, categoryId: state.capture.categoryId,
      note: $('#noteInput').value.trim(), recurringId: null, createdAt: new Date().toISOString(),
    };
    await DB.putTransaction(t);
    state.transactions.push(t);
    $('#amountInput').value = ''; $('#noteInput').value = '';
    renderBalance(); renderHistory();
    toast('Gespeichert ✓');
  }

  async function saveStart() {
    const cents = Money.parse($('#startInput').value);
    if (cents == null) { toast('Bitte gültigen Betrag'); return; }
    state.settings.startBalanceCents = cents;
    await DB.setSettings(state.settings);
    renderBalance();
    toast('Anfangsbestand gesichert ✓');
  }

  // ---------- Eintrag bearbeiten ----------
  function openEdit(t) {
    state.edit = { id: t.id, type: t.type, categoryId: t.categoryId };
    $('#editAmount').value = Money.format(t.amountCents, { withSymbol: false });
    $('#editDate').value = t.date;
    $('#editNote').value = t.note || '';
    renderEditOverlay();
    $('#editOverlay').hidden = false;
  }
  function renderEditOverlay() {
    $$('#editType .typebtn').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.type === state.edit.type));
    const valid = categoriesForType(state.edit.type);
    if (!valid.some((c) => c.id === state.edit.categoryId))
      state.edit.categoryId = valid[0] ? valid[0].id : null;
    renderChips($('#editChips'), state.edit.type, state.edit.categoryId, (id) => {
      state.edit.categoryId = id; renderEditOverlay();
    });
  }
  const closeEdit = () => { $('#editOverlay').hidden = true; state.edit.id = null; };

  async function saveEdit() {
    const cents = Money.parse($('#editAmount').value);
    if (!cents || cents <= 0) { toast('Bitte gültigen Betrag'); return; }
    if (!state.edit.categoryId) { toast('Bitte Kategorie wählen'); return; }
    const t = state.transactions.find((x) => x.id === state.edit.id);
    if (!t) return;
    t.amountCents = cents; t.type = state.edit.type; t.categoryId = state.edit.categoryId;
    t.date = $('#editDate').value || t.date; t.note = $('#editNote').value.trim();
    await DB.putTransaction(t);
    closeEdit(); renderBalance(); renderHistory();
    toast('Aktualisiert ✓');
  }
  async function deleteEdit() {
    const id = state.edit.id; if (!id) return;
    await DB.deleteTransaction(id);
    state.transactions = state.transactions.filter((x) => x.id !== id);
    closeEdit(); renderBalance(); renderHistory();
    toast('Gelöscht');
  }

  // ---------- Kategorien-CRUD ----------
  function renderSwatches() {
    const wrap = $('#catSwatches');
    wrap.innerHTML = '';
    (CONFIG.ui.colorPalette || ['#64748b']).forEach((col) => {
      const s = document.createElement('button');
      s.type = 'button';
      s.className = 'swatch' + (col === state.cat.color ? ' is-active' : '');
      s.style.background = col;
      s.addEventListener('click', () => { state.cat.color = col; renderSwatches(); });
      wrap.appendChild(s);
    });
  }
  function openCatEdit(cat) {
    const isNew = !cat;
    state.cat.id = isNew ? null : cat.id;
    state.cat.color = isNew ? (CONFIG.ui.colorPalette || ['#64748b'])[0] : cat.color;
    $('#catSheetTitle').textContent = isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten';
    $('#catIcon').value = isNew ? '' : (cat.icon || '');
    $('#catName').value = isNew ? '' : cat.name;
    $('#catType').value = isNew ? 'expense' : cat.type;
    $('#catArchived').checked = isNew ? false : !!cat.archived;
    $('#catDelete').hidden = isNew;
    renderSwatches();
    $('#catOverlay').hidden = false;
  }
  const closeCat = () => { $('#catOverlay').hidden = true; state.cat.id = null; };

  async function saveCat() {
    const name = $('#catName').value.trim();
    if (!name) { toast('Bitte Name eingeben'); return; }
    const existing = state.cat.id ? state.categories.find((c) => c.id === state.cat.id) : null;
    const cat = {
      id: state.cat.id || DB.uuid(),
      name, icon: $('#catIcon').value.trim(), color: state.cat.color,
      type: $('#catType').value, archived: $('#catArchived').checked,
    };
    if (existing) Object.assign(existing, cat);
    await DB.putCategory(cat);
    state.categories = await DB.listCategories();
    closeCat(); renderCapture(); renderHistory(); renderMore(); populateFilterCats();
    toast('Kategorie gespeichert ✓');
  }
  async function deleteCat() {
    const id = state.cat.id; if (!id) return;
    await DB.deleteCategory(id);
    state.categories = await DB.listCategories();
    closeCat(); renderCapture(); renderHistory(); renderMore(); populateFilterCats();
    toast('Kategorie gelöscht');
  }

  // ---------- Wiederkehrend-CRUD ----------
  function buildIntervalSelect() {
    const sel = $('#recurInterval');
    sel.innerHTML = '';
    (CONFIG.recurring.enabledIntervals || ['monthly']).forEach((iv) => {
      const o = document.createElement('option');
      o.value = iv; o.textContent = INTERVAL_LABELS[iv] || iv;
      sel.appendChild(o);
    });
    const wd = $('#recurWeekday');
    wd.innerHTML = '';
    WEEKDAYS.forEach((w) => {
      const o = document.createElement('option');
      o.value = String(w.v); o.textContent = w.l;
      wd.appendChild(o);
    });
  }
  function updateRecurAnchorUI() {
    const iv = $('#recurInterval').value;
    $('#recurWeekdayRow').hidden = iv !== 'weekly';
    $('#recurDayRow').hidden = iv !== 'monthly';
  }
  function openRecurEdit(rule) {
    const isNew = !rule;
    state.recur.id = isNew ? null : rule.id;
    state.recur.type = isNew ? 'expense' : rule.type;
    state.recur.categoryId = isNew ? null : rule.categoryId;
    $('#recurAmount').value = isNew ? '' : Money.format(rule.amountCents, { withSymbol: false });
    $('#recurNote').value = isNew ? '' : (rule.note || '');
    $('#recurInterval').value = isNew ? (CONFIG.recurring.enabledIntervals || ['monthly'])[0] : rule.interval;
    $('#recurWeekday').value = String(isNew ? 1 : (rule.interval === 'weekly' ? rule.anchorDay : 1));
    $('#recurDay').value = isNew ? '1' : (rule.interval === 'monthly' ? rule.anchorDay : '1');
    $('#recurStart').value = isNew ? todayISO() : rule.startDate;
    $('#recurEnd').value = isNew ? '' : (rule.endDate || '');
    $('#recurActive').checked = isNew ? true : !!rule.active;
    $('#recurDelete').hidden = isNew;
    updateRecurAnchorUI();
    renderRecurOverlay();
    $('#recurOverlay').hidden = false;
  }
  function renderRecurOverlay() {
    $$('#recurType .typebtn').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.type === state.recur.type));
    const valid = categoriesForType(state.recur.type);
    if (!valid.some((c) => c.id === state.recur.categoryId))
      state.recur.categoryId = valid[0] ? valid[0].id : null;
    renderChips($('#recurChips'), state.recur.type, state.recur.categoryId, (id) => {
      state.recur.categoryId = id; renderRecurOverlay();
    });
  }
  const closeRecur = () => { $('#recurOverlay').hidden = true; state.recur.id = null; };

  async function saveRecur() {
    const cents = Money.parse($('#recurAmount').value);
    if (!cents || cents <= 0) { toast('Bitte gültigen Betrag'); return; }
    if (!state.recur.categoryId) { toast('Bitte Kategorie wählen'); return; }
    const iv = $('#recurInterval').value;
    let anchor = 1;
    if (iv === 'weekly') anchor = parseInt($('#recurWeekday').value, 10);
    if (iv === 'monthly') anchor = Math.min(31, Math.max(1, parseInt($('#recurDay').value, 10) || 1));
    const existing = state.recur.id ? state.recurring.find((r) => r.id === state.recur.id) : null;
    const rule = {
      id: state.recur.id || DB.uuid(),
      amountCents: cents, type: state.recur.type, categoryId: state.recur.categoryId,
      note: $('#recurNote').value.trim(), interval: iv, anchorDay: anchor,
      startDate: $('#recurStart').value || todayISO(),
      endDate: $('#recurEnd').value || null,
      // beim Bearbeiten lastRun erhalten, sonst neu (rückwirkend ab Start erzeugen)
      lastRun: existing ? existing.lastRun : null,
      active: $('#recurActive').checked,
    };
    await DB.putRecurring(rule);
    closeRecur();
    await refreshAfterRecurringChange();
    toast('Regel gespeichert ✓');
  }
  async function deleteRecur() {
    const id = state.recur.id; if (!id) return;
    await DB.deleteRecurring(id);
    closeRecur();
    state.recurring = await DB.listRecurring();
    renderMore();
    toast('Regel gelöscht');
  }
  async function refreshAfterRecurringChange() {
    await generateDueRecurring();
    state.recurring = await DB.listRecurring();
    state.transactions = await DB.listTransactions();
    renderBalance(); renderHistory(); renderMore();
  }

  // ---------- Daten: Export / Import ----------
  async function exportCsv() {
    if (state.transactions.length === 0) { toast('Keine Daten zum Exportieren'); return; }
    const res = await Exporter.exportCSV(state.transactions, state.categories);
    if (res !== 'cancelled') toast('CSV bereit ✓');
  }
  async function exportBackup() {
    const data = await DB.exportAll();
    const res = await Exporter.exportBackup(data);
    if (res !== 'cancelled') toast('Backup bereit ✓');
  }
  async function importBackup(file) {
    if (!file) return;
    try {
      const data = await Exporter.readBackupFile(file);
      const n = Array.isArray(data.transactions) ? data.transactions.length : 0;
      if (!window.confirm(`Backup laden? Alle aktuellen Daten werden ersetzt (${n} Einträge im Backup).`)) return;
      await DB.importAll(data);
      state.settings = await DB.getSettings();
      state.categories = await DB.listCategories();
      state.transactions = await DB.listTransactions();
      state.recurring = await DB.listRecurring();
      populateFilterCats();
      renderBalance(); renderCapture(); renderHistory(); renderMore();
      toast('Backup geladen ✓');
    } catch (e) {
      console.error(e); toast('Import fehlgeschlagen: ' + e.message);
    }
  }

  // ---------- Navigation ----------
  function showView(name) {
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== name; });
    $$('.tab').forEach((tb) => tb.classList.toggle('is-active', tb.dataset.goto === name));
    if (name === 'more') renderMore();
  }

  // ---------- Events ----------
  function wireEvents() {
    $$('.tab').forEach((tb) => tb.addEventListener('click', () => showView(tb.dataset.goto)));

    $('#captureType').addEventListener('click', (e) => {
      const b = e.target.closest('.typebtn'); if (!b) return;
      state.capture.type = b.dataset.type; renderCapture();
    });
    $('#captureForm').addEventListener('submit', saveCapture);
    $('#saveStartBtn').addEventListener('click', saveStart);

    // Eintrag-Overlay
    $('#editType').addEventListener('click', (e) => {
      const b = e.target.closest('.typebtn'); if (!b) return;
      state.edit.type = b.dataset.type; renderEditOverlay();
    });
    $('#editSave').addEventListener('click', saveEdit);
    $('#editDelete').addEventListener('click', deleteEdit);
    $('#editCancel').addEventListener('click', closeEdit);
    $('#editOverlay').addEventListener('click', (e) => { if (e.target.id === 'editOverlay') closeEdit(); });

    // Kategorie-Overlay
    $('#addCatBtn').addEventListener('click', () => openCatEdit(null));
    $('#catSave').addEventListener('click', saveCat);
    $('#catDelete').addEventListener('click', deleteCat);
    $('#catCancel').addEventListener('click', closeCat);
    $('#catOverlay').addEventListener('click', (e) => { if (e.target.id === 'catOverlay') closeCat(); });

    // Wiederkehrend-Overlay
    $('#addRecurBtn').addEventListener('click', () => openRecurEdit(null));
    $('#recurType').addEventListener('click', (e) => {
      const b = e.target.closest('.typebtn'); if (!b) return;
      state.recur.type = b.dataset.type; renderRecurOverlay();
    });
    $('#recurInterval').addEventListener('change', updateRecurAnchorUI);
    $('#recurSave').addEventListener('click', saveRecur);
    $('#recurDelete').addEventListener('click', deleteRecur);
    $('#recurCancel').addEventListener('click', closeRecur);
    $('#recurOverlay').addEventListener('click', (e) => { if (e.target.id === 'recurOverlay') closeRecur(); });

    // Verlauf: Filter & Suche
    $('#searchInput').addEventListener('input', (e) => { state.filter.q = e.target.value; renderHistory(); });
    $('#filterType').addEventListener('change', (e) => { state.filter.type = e.target.value; renderHistory(); });
    $('#filterCat').addEventListener('change', (e) => { state.filter.cat = e.target.value; renderHistory(); });

    // Daten: Export / Import
    $('#exportCsvBtn').addEventListener('click', exportCsv);
    $('#backupBtn').addEventListener('click', exportBackup);
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', (e) => {
      importBackup(e.target.files[0]); e.target.value = '';
    });
  }

  // ---------- Init ----------
  async function init() {
    applyTheme();
    await DB.open();
    await DB.ensureSeed(CONFIG);
    await generateDueRecurring();
    state.settings = await DB.getSettings();
    state.categories = await DB.listCategories();
    state.transactions = await DB.listTransactions();
    state.recurring = await DB.listRecurring();

    $('#dateInput').value = todayISO();
    buildIntervalSelect();
    populateFilterCats();
    wireEvents();
    renderBalance();
    renderCapture();
    renderHistory();
    renderMore();
    showView(CONFIG.ui.defaultView || 'capture');
  }

  init().catch((e) => console.error('Init-Fehler:', e));

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch((e) =>
        console.warn('Service Worker nicht registriert:', e));
    });
  }
})();
