// app.js — UI-Steuerung.
// Iteration 1: Erfassen, Live-Bestand, Verlauf (bearbeiten/löschen), Anfangsbestand.
// Iteration 2: Kategorien-CRUD, wiederkehrende Einträge (+ Auto-Erzeugung), Monatsübersicht.
// Iteration 3: CSV/Backup, Filter & Suche.
// Iteration 4: Konten (Bestand pro Konto) + Transfers, Schnell-Eingabe (additiv),
//              Kategorie-Hierarchie (Spalten, Ebene 1 -> Ebene 2).

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  // Datum IMMER lokal formatieren — toISOString() ist UTC und kippt in UTC+x
  // um Mitternacht auf den Vortag (nextDay würde dann nie weiterzählen).
  function fmtISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }
  const todayISO = () => fmtISO(new Date());

  const INTERVAL_LABELS = { daily: 'täglich', weekly: 'wöchentlich', monthly: 'monatlich' };
  // getDay(): 0=So … 6=Sa. Anzeige Mo–So.
  const WEEKDAYS = [
    { v: 1, l: 'Montag' }, { v: 2, l: 'Dienstag' }, { v: 3, l: 'Mittwoch' },
    { v: 4, l: 'Donnerstag' }, { v: 5, l: 'Freitag' }, { v: 6, l: 'Samstag' }, { v: 0, l: 'Sonntag' },
  ];

  const state = {
    settings: null,
    accounts: [],
    categories: [],
    transactions: [],
    transfers: [],
    recurring: [],
    capture: { type: CONFIG.ui.defaultType || 'expense', categoryId: null, expandedParentId: null, accountId: null },
    edit: { id: null, type: null, categoryId: null, expandedParentId: null, accountId: null },
    cat: { id: null, color: null },
    recur: { id: null, type: 'expense', categoryId: null, expandedParentId: null, accountId: null },
    filter: { q: '', type: 'all', cat: 'all' },
    stats: { month: null }, // 'YYYY-MM', wird in init() gesetzt
  };

  // ---------- Datums-Helfer ----------
  function nextDay(iso) {
    const d = new Date(iso + 'T12:00:00'); // Mittag: robust gegen DST-Umstellung
    d.setDate(d.getDate() + 1);
    return fmtISO(d);
  }
  const monthKey = (iso) => (iso || '').slice(0, 7);
  function addMonths(ym, n) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function monthLabel(ym, opts) {
    return new Date(ym + '-01T12:00:00').toLocaleDateString('de-DE',
      opts || { month: 'long', year: 'numeric' });
  }
  function lastDayOfMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    return ym + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
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
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    setTimeout(() => { t.hidden = true; }, 1500);
  }
  function dateLabel(iso) {
    const today = todayISO();
    if (iso === today) return 'Heute';
    if (nextDay(iso) === today) return 'Gestern';
    return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE',
      { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ---------- Konten ----------
  const accountById = (id) => state.accounts.find((a) => a.id === id) || null;
  const activeAccounts = () => state.accounts.filter((a) => !a.archived).sort((a, b) => (a.order || 0) - (b.order || 0));
  function defaultAccountId() {
    const s = state.settings || {};
    if (s.defaultAccountId && accountById(s.defaultAccountId)) return s.defaultAccountId;
    const first = activeAccounts()[0] || state.accounts[0];
    return first ? first.id : null;
  }
  // Buchungen ohne accountId (Altbestand) werden dem Default-Konto zugerechnet.
  const txAccountId = (t) => t.accountId || defaultAccountId();

  function accountBalance(accId) {
    const acc = accountById(accId);
    let bal = acc ? (acc.startBalanceCents || 0) : 0;
    for (const t of state.transactions) {
      if (txAccountId(t) !== accId) continue;
      bal += t.type === 'income' ? t.amountCents : -t.amountCents;
    }
    for (const tr of state.transfers) {
      if (tr.toAccountId === accId) bal += tr.amountCents;
      if (tr.fromAccountId === accId) bal -= tr.amountCents;
    }
    return bal;
  }
  const totalBalance = () => activeAccounts().reduce((sum, a) => sum + accountBalance(a.id), 0);

  // ---------- Kategorien (Hierarchie) ----------
  const categoryById = (id) => state.categories.find((c) => c.id === id) || null;
  const childrenOf = (parentId) =>
    state.categories.filter((c) => !c.archived && c.parentId === parentId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  const isLeaf = (cat) => !cat || childrenOf(cat.id).length === 0;

  // Einnahmen/„beides" werden als flache Chips angeboten.
  const incomeLikeCats = (type) =>
    state.categories.filter((c) => !c.archived && (c.type === type || c.type === 'both'))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Ausgaben-Spalten in Reihenfolge ("beides"-Kategorien zählen mit).
  const isExpenseLike = (c) => c.type === 'expense' || c.type === 'both';
  function expenseGroups() {
    const seen = [];
    state.categories
      .filter((c) => !c.archived && isExpenseLike(c) && !c.parentId && c.group)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((c) => { if (!seen.includes(c.group)) seen.push(c.group); });
    return seen;
  }
  const level1 = (group) =>
    state.categories.filter((c) => !c.archived && isExpenseLike(c) && !c.parentId && c.group === group)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

  function isValidLeaf(id, type) {
    const c = categoryById(id);
    if (!c || c.archived) return false;
    if (type === 'income') return c.type === 'income' || c.type === 'both';
    return isExpenseLike(c) && isLeaf(c);
  }
  function defaultCategoryId(type) {
    if (type === 'income') {
      const inc = incomeLikeCats('income')[0];
      return inc ? inc.id : null;
    }
    for (const g of expenseGroups()) {
      for (const l1 of level1(g)) {
        const kids = childrenOf(l1.id);
        return kids.length ? kids[0].id : l1.id;
      }
    }
    return null;
  }
  // validiert ctx.categoryId für den Typ und klappt ggf. den Elternknoten auf.
  function syncCategory(ctx, type) {
    if (!isValidLeaf(ctx.categoryId, type)) ctx.categoryId = defaultCategoryId(type);
    const c = categoryById(ctx.categoryId);
    ctx.expandedParentId = c && c.parentId ? c.parentId : ctx.expandedParentId;
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
            categoryId: r.categoryId, accountId: r.accountId || defaultAccountId(),
            note: r.note, recurringId: r.id, createdAt: new Date().toISOString(),
          });
          created++;
        }
      }
      r.lastRun = today;
      await DB.putRecurring(r);
    }
    return created;
  }

  // ---------- Kategorie-Picker ----------
  function renderChips(container, cats, selectedId, onPick) {
    cats.forEach((c) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (c.id === selectedId ? ' is-active' : '');
      chip.style.setProperty('--chip', c.color);
      chip.innerHTML = `<span class="chip__icon">${c.icon || ''}</span>${escapeHtml(c.name)}`;
      chip.addEventListener('click', () => onPick(c.id));
      container.appendChild(chip);
    });
  }

  // Hierarchischer Picker (Ausgaben) bzw. Chips (Einnahmen).
  function renderPicker(container, type, selectedId, expandedParentId, onSelectLeaf, onToggleParent) {
    container.innerHTML = '';
    if (type !== 'expense') {
      container.className = 'picker picker--chips';
      renderChips(container, incomeLikeCats(type), selectedId, onSelectLeaf);
      return;
    }
    container.className = 'picker picker--cols';
    expenseGroups().forEach((group) => {
      const col = document.createElement('div');
      col.className = 'catcol';
      const head = document.createElement('div');
      head.className = 'catcol__head';
      head.textContent = group;
      col.appendChild(head);

      level1(group).forEach((l1) => {
        const kids = childrenOf(l1.id);
        const hasKids = kids.length > 0;
        const expanded = expandedParentId === l1.id;
        const selectedHere = selectedId === l1.id || kids.some((k) => k.id === selectedId);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'catl1'
          + (selectedId === l1.id ? ' is-active' : '')
          + (selectedHere ? ' has-sel' : '')
          + (expanded ? ' is-open' : '');
        btn.style.setProperty('--chip', l1.color);
        btn.innerHTML = `<span class="chip__icon">${l1.icon || ''}</span>`
          + `<span class="catl1__name">${escapeHtml(l1.name)}</span>`
          + (hasKids ? `<span class="catl1__caret">${expanded ? '▾' : '▸'}</span>` : '');
        btn.addEventListener('click', () => hasKids ? onToggleParent(l1.id) : onSelectLeaf(l1.id));
        col.appendChild(btn);

        if (hasKids && expanded) {
          const sub = document.createElement('div');
          sub.className = 'catl2';
          kids.forEach((k) => {
            const kb = document.createElement('button');
            kb.type = 'button';
            kb.className = 'catl2btn' + (k.id === selectedId ? ' is-active' : '');
            kb.style.setProperty('--chip', k.color);
            kb.innerHTML = `<span class="chip__icon">${k.icon || ''}</span>${escapeHtml(k.name)}`;
            kb.addEventListener('click', () => onSelectLeaf(k.id));
            sub.appendChild(kb);
          });
          col.appendChild(sub);
        }
      });
      container.appendChild(col);
    });
  }

  // ---------- Renders: Bestand & Konten ----------
  function renderBalance() {
    const bal = totalBalance();
    const el = $('#balanceValue');
    el.textContent = Money.format(bal);
    el.classList.toggle('is-negative', bal < 0);
    $('#balanceSub').textContent = activeAccounts().length + ' Konten';
  }

  function renderAccountSummary() {
    const wrap = $('#captureAccSum');
    if (!wrap) return;
    wrap.innerHTML = '';
    const total = document.createElement('div');
    total.className = 'accsum__total';
    total.innerHTML = `<span>Gesamt</span><span>${Money.format(totalBalance())}</span>`;
    wrap.appendChild(total);
    activeAccounts().forEach((a) => {
      const bal = accountBalance(a.id);
      const row = document.createElement('div');
      row.className = 'accsum__row';
      row.innerHTML = `<span>${escapeHtml(a.name)}</span>`
        + `<span class="${bal < 0 ? 'neg' : ''}">${Money.format(bal)}</span>`;
      wrap.appendChild(row);
    });
    renderForecast(); // hängt am Gesamtbestand
  }

  function renderCaptureAccounts() {
    const wrap = $('#captureAccounts');
    if (!wrap) return;
    if (!accountById(state.capture.accountId)) state.capture.accountId = defaultAccountId();
    wrap.innerHTML = '';
    activeAccounts().forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'acctbtn' + (a.id === state.capture.accountId ? ' is-active' : '');
      b.textContent = a.name;
      b.addEventListener('click', () => { state.capture.accountId = a.id; renderCaptureAccounts(); });
      wrap.appendChild(b);
    });
  }

  function renderQuickButtons() {
    const wrap = $('#quickButtons');
    if (!wrap) return;
    wrap.innerHTML = '';
    (CONFIG.quickAmountsEuro || []).forEach((euro) => {
      const cents = Math.round(euro * 100);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'quickbtn';
      b.textContent = '+ ' + Money.format(cents);
      b.addEventListener('click', () => addQuick(cents));
      wrap.appendChild(b);
    });
  }
  function addQuick(cents) {
    const cur = Money.parse($('#amountInput').value) || 0;
    $('#amountInput').value = Money.format(cur + cents, { withSymbol: false });
  }

  // ---------- Render: Erfassen ----------
  function renderCapture() {
    $$('#captureType .typebtn').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.type === state.capture.type));
    syncCategory(state.capture, state.capture.type);
    renderPicker($('#captureChips'), state.capture.type, state.capture.categoryId, state.capture.expandedParentId,
      (id) => { state.capture.categoryId = id; renderCapture(); },
      (pid) => { state.capture.expandedParentId = state.capture.expandedParentId === pid ? null : pid; renderCapture(); });
    renderCaptureAccounts();
    renderAccountSummary();
  }

  // ---------- Verlauf ----------
  function populateFilterCats() {
    const sel = $('#filterCat');
    if (!sel) return;
    const cur = state.filter.cat;
    sel.innerHTML = '<option value="all">Alle Kategorien</option>';
    state.categories.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = (c.icon ? c.icon + ' ' : '') + c.name + (c.parentId ? ' (Unter)' : '');
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
        const acc = accountById(txAccountId(t));
        const hay = ((t.note || '') + ' ' + (cat ? cat.name : '') + ' ' + (acc ? acc.name : '')).toLowerCase();
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
      const acc = accountById(txAccountId(t));
      const sub = [t.note ? escapeHtml(t.note) : '', acc ? escapeHtml(acc.name) : ''].filter(Boolean).join(' · ');
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'entry';
      row.innerHTML =
        `<span class="entry__icon" style="--chip:${cat ? cat.color : '#64748b'}">${cat ? cat.icon : '❓'}${t.recurringId ? '<span class="entry__rec">↻</span>' : ''}</span>` +
        `<span class="entry__main"><span class="entry__cat">${cat ? escapeHtml(cat.name) : 'Unbekannt'}</span>` +
        `<span class="entry__note">${sub}</span></span>` +
        `<span class="entry__amount ${t.type === 'income' ? 'pos' : 'neg'}">${t.type === 'income' ? '+' : '−'}${Money.format(t.amountCents, { withSymbol: false })} €</span>`;
      row.addEventListener('click', () => openEdit(t));
      list.appendChild(row);
    });
  }

  // ---------- Statistik-Seite (nur Buchungen, keine Transfers) ----------
  function renderStatistics() {
    const ym = state.stats.month || monthKey(todayISO());
    $('#statsMonthLabel').textContent = monthLabel(ym);
    $('#statsNext').disabled = ym >= monthKey(todayISO());

    const txs = state.transactions.filter((t) => monthKey(t.date) === ym);
    let inc = 0, exp = 0;
    const byLeaf = {}, byTop = {}, byDay = {};
    txs.forEach((t) => {
      if (t.type === 'income') { inc += t.amountCents; return; }
      exp += t.amountCents;
      byLeaf[t.categoryId] = (byLeaf[t.categoryId] || 0) + t.amountCents;
      const cat = categoryById(t.categoryId);
      const topId = cat && cat.parentId ? cat.parentId : (cat ? cat.id : 'unknown');
      byTop[topId] = (byTop[topId] || 0) + t.amountCents;
      const day = parseInt((t.date || '').slice(8, 10), 10) || 0;
      byDay[day] = (byDay[day] || 0) + t.amountCents;
    });

    $('#statsIncome').textContent = '+' + Money.format(inc);
    $('#statsExpense').textContent = '−' + Money.format(exp);
    const net = inc - exp;
    const netEl = $('#statsNet');
    netEl.textContent = (net >= 0 ? '+' : '−') + Money.format(Math.abs(net));
    netEl.classList.toggle('neg', net < 0);
    netEl.classList.toggle('pos', net >= 0);

    renderDonut(byTop, exp);
    renderDailyBars(byDay, ym);
    renderTrend(ym);
    renderTopCats(byLeaf, exp);
  }

  // Donut: Ausgaben nach Bereich (Ebene-2 wird dem Elternknoten zugerechnet).
  function renderDonut(byTop, totalExp) {
    const wrap = $('#statsDonut');
    if (!totalExp) { wrap.innerHTML = '<p class="muted">Keine Ausgaben in diesem Monat.</p>'; return; }
    const entries = Object.entries(byTop).sort((a, b) => b[1] - a[1]);
    const R = 15.9155; // Umfang = 100 -> dasharray direkt in Prozent
    let offset = 25;   // Start oben (12 Uhr)
    let segs = '', legend = '';
    entries.forEach(([id, cents]) => {
      const cat = categoryById(id);
      const color = cat ? cat.color : '#64748b';
      const pct = (cents / totalExp) * 100;
      segs += `<circle r="${R}" cx="18" cy="18" fill="none" stroke="${color}" stroke-width="4.6"`
        + ` stroke-dasharray="${pct.toFixed(2)} ${(100 - pct).toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>`;
      offset -= pct;
      legend += `<div class="legrow"><span class="legdot" style="background:${color}"></span>`
        + `<span class="legname">${escapeHtml((cat ? (cat.icon ? cat.icon + ' ' : '') + cat.name : 'Unbekannt'))}</span>`
        + `<span class="legpct">${Math.round(pct)} %</span>`
        + `<span class="legval">${Money.format(cents)}</span></div>`;
    });
    wrap.innerHTML = `<div class="donutbox"><svg viewBox="0 0 36 36" class="donut">${segs}`
      + `<text x="18" y="17.2" class="donut__big">${Money.format(totalExp, { withSymbol: false })}</text>`
      + `<text x="18" y="21.6" class="donut__small">€ Ausgaben</text></svg></div>`
      + `<div class="legend">${legend}</div>`;
  }

  // Tagesbalken über den Monat.
  function renderDailyBars(byDay, ym) {
    const wrap = $('#statsDaily');
    const values = Object.values(byDay);
    if (values.length === 0) { wrap.innerHTML = '<p class="muted">Keine Ausgaben in diesem Monat.</p>'; return; }
    const dim = parseInt(lastDayOfMonth(ym).slice(8, 10), 10);
    const max = Math.max(...values);
    let bars = '';
    for (let d = 1; d <= dim; d++) {
      const v = byDay[d] || 0;
      bars += v
        ? `<div class="dbar" style="height:${Math.max(5, Math.round((v / max) * 100))}%"></div>`
        : '<div class="dbar is-zero"></div>';
    }
    wrap.innerHTML = `<div class="dbars">${bars}</div>`
      + `<div class="dbars__axis"><span>1.</span><span>${Math.round(dim / 2)}.</span><span>${dim}.</span></div>`
      + `<p class="muted">Höchster Tag: ${Money.format(max)}</p>`;
  }

  // Einnahmen vs. Ausgaben der letzten 6 Monate (bis zum gewählten Monat).
  function renderTrend(ym) {
    const wrap = $('#statsTrend');
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(addMonths(ym, -i));
    const data = months.map((m) => {
      let inc = 0, exp = 0;
      state.transactions.forEach((t) => {
        if (monthKey(t.date) !== m) return;
        if (t.type === 'income') inc += t.amountCents; else exp += t.amountCents;
      });
      return { m, inc, exp };
    });
    const max = Math.max(1, ...data.flatMap((d) => [d.inc, d.exp]));
    wrap.innerHTML = data.map((d) => `
      <div class="trendcol${d.m === ym ? ' is-current' : ''}">
        <div class="trendbars">
          <div class="tbar tbar--inc" style="height:${Math.round((d.inc / max) * 100)}%"></div>
          <div class="tbar tbar--exp" style="height:${Math.round((d.exp / max) * 100)}%"></div>
        </div>
        <span class="trendlabel">${monthLabel(d.m, { month: 'short' })}</span>
      </div>`).join('');
  }

  // Top-Kategorien (Blatt-Ebene) mit Balken.
  function renderTopCats(byLeaf, exp) {
    const wrap = $('#statsTopCats');
    wrap.innerHTML = '';
    const entries = Object.entries(byLeaf).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) { wrap.innerHTML = '<p class="muted">Keine Ausgaben in diesem Monat.</p>'; return; }
    entries.slice(0, 8).forEach(([id, cents]) => {
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
    if (entries.length > 8) {
      const rest = entries.slice(8).reduce((s, [, c]) => s + c, 0);
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = `+ ${entries.length - 8} weitere (${Money.format(rest)})`;
      wrap.appendChild(p);
    }
  }

  // ---------- Prognose: Bestand in den nächsten 3 Monaten (wiederkehrend) ----------
  function computeForecast(months = 3) {
    const rules = state.recurring.filter((r) => r.active);
    const rows = [];
    let running = totalBalance();
    let cursor = nextDay(todayISO());
    const baseYm = monthKey(todayISO());
    for (let i = 0; i < months; i++) {
      const ym = addMonths(baseYm, i);
      const end = lastDayOfMonth(ym);
      let delta = 0;
      for (let d = cursor; d <= end; d = nextDay(d)) {
        for (const r of rules) {
          if (d < r.startDate) continue;
          if (r.endDate && d > r.endDate) continue;
          if (isDue(r, d)) delta += r.type === 'income' ? r.amountCents : -r.amountCents;
        }
      }
      running += delta;
      rows.push({ ym, end: running, delta });
      cursor = nextDay(end);
    }
    return rows;
  }
  function renderForecast() {
    const wrap = $('#captureForecast');
    if (!wrap) return;
    if (!state.recurring.some((r) => r.active)) { wrap.hidden = true; return; }
    wrap.hidden = false;
    const rows = computeForecast();
    wrap.innerHTML = '<div class="accsum__total"><span>Prognose (wiederkehrend)</span><span></span></div>'
      + rows.map((r) => `<div class="accsum__row"><span>Ende ${monthLabel(r.ym, { month: 'short', year: 'numeric' })}</span>`
        + `<span class="${r.end < 0 ? 'neg' : ''}">${Money.format(r.end)}`
        + ` <small class="fc ${r.delta < 0 ? 'fc--neg' : 'fc--pos'}">${r.delta >= 0 ? '+' : '−'}${Money.format(Math.abs(r.delta), { withSymbol: false })}</small></span></div>`).join('');
  }

  function renderCategoryList() {
    const cl = $('#categoryListMore');
    cl.innerHTML = '';
    [...state.categories]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((c) => {
        const parent = c.parentId ? categoryById(c.parentId) : null;
        const where = c.type === 'income' ? 'Einnahme'
          : c.type === 'both' ? 'beides'
            : parent ? (c.group + ' › ' + parent.name) : (c.group || 'Ausgabe');
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'catitem' + (c.archived ? ' is-archived' : '') + (c.parentId ? ' is-child' : '');
        item.innerHTML =
          `<span class="entry__icon" style="--chip:${c.color}">${c.icon || ''}</span>` +
          `<span>${escapeHtml(c.name)}</span>` +
          `<span class="muted">${c.archived ? 'archiviert' : escapeHtml(where)}</span>`;
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
      const acc = accountById(r.accountId);
      let when = INTERVAL_LABELS[r.interval] || r.interval;
      if (r.interval === 'weekly') when += ', ' + (WEEKDAYS.find((w) => w.v === r.anchorDay) || {}).l;
      if (r.interval === 'monthly') when += ', Tag ' + r.anchorDay;
      if (acc) when += ' · ' + acc.name;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'catitem' + (r.active ? '' : ' is-archived');
      item.innerHTML =
        `<span class="entry__icon" style="--chip:${cat ? cat.color : '#64748b'}">${cat ? cat.icon : '↻'}</span>` +
        `<span><span>${escapeHtml((cat ? cat.name : '?'))}</span><br><span class="muted">${escapeHtml(when)}</span></span>` +
        `<span class="entry__amount ${r.type === 'income' ? 'pos' : 'neg'}">${r.type === 'income' ? '+' : '−'}${Money.format(r.amountCents, { withSymbol: false })} €</span>`;
      item.addEventListener('click', () => openRecurEdit(r));
      rl.appendChild(item);
    });
  }

  function renderMore() {
    renderCategoryList();
    renderRecurringList();
  }

  // ---------- Konten-Ansicht ----------
  function renderAccountOverview() {
    const wrap = $('#accountOverview');
    if (!wrap) return;
    wrap.innerHTML = '';
    activeAccounts().forEach((a) => {
      const bal = accountBalance(a.id);
      const row = document.createElement('div');
      row.className = 'statrow';
      row.innerHTML = `<span>${escapeHtml(a.name)}</span><span class="${bal < 0 ? 'neg' : 'pos'}">${Money.format(bal)}</span>`;
      wrap.appendChild(row);
    });
    const total = document.createElement('div');
    total.className = 'statrow statrow--total';
    total.innerHTML = `<span>Gesamt</span><span>${Money.format(totalBalance())}</span>`;
    wrap.appendChild(total);
  }

  function fillAccountSelect(sel, selectedId) {
    if (!sel) return;
    sel.innerHTML = '';
    activeAccounts().forEach((a) => {
      const o = document.createElement('option');
      o.value = a.id; o.textContent = a.name;
      sel.appendChild(o);
    });
    if (selectedId && accountById(selectedId)) sel.value = selectedId;
  }

  function renderTransferControls() {
    const accs = activeAccounts();
    fillAccountSelect($('#transferFrom'), $('#transferFrom').value || defaultAccountId());
    fillAccountSelect($('#transferTo'), $('#transferTo').value || (accs[1] ? accs[1].id : (accs[0] ? accs[0].id : '')));
    if (!$('#transferDate').value) $('#transferDate').value = todayISO();
  }

  function renderTransferList() {
    const wrap = $('#transferList');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (state.transfers.length === 0) { wrap.innerHTML = '<p class="muted">Noch keine Umbuchungen.</p>'; return; }
    const sorted = [...state.transfers].sort((a, b) =>
      a.date === b.date ? (b.createdAt || '').localeCompare(a.createdAt || '') : b.date.localeCompare(a.date));
    sorted.slice(0, 30).forEach((tr) => {
      const from = accountById(tr.fromAccountId);
      const to = accountById(tr.toAccountId);
      const item = document.createElement('div');
      item.className = 'catitem';
      item.innerHTML =
        `<span class="entry__icon" style="--chip:#0f766e">🔁</span>` +
        `<span><span>${escapeHtml(from ? from.name : '?')} → ${escapeHtml(to ? to.name : '?')}</span>` +
        `<br><span class="muted">${dateLabel(tr.date)}${tr.note ? ' · ' + escapeHtml(tr.note) : ''}</span></span>` +
        `<span class="entry__amount">${Money.format(tr.amountCents, { withSymbol: false })} €</span>`;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn--sm danger';
      del.textContent = '✕';
      del.addEventListener('click', () => deleteTransfer(tr.id));
      item.appendChild(del);
      wrap.appendChild(item);
    });
  }

  function renderStartBalanceList() {
    const wrap = $('#startBalanceList');
    if (!wrap) return;
    wrap.innerHTML = '';
    activeAccounts().forEach((a) => {
      const row = document.createElement('div');
      row.className = 'startrow';
      row.innerHTML = `<span class="startrow__name">${escapeHtml(a.name)}</span>`;
      const input = document.createElement('input');
      input.className = 'field';
      input.inputMode = 'decimal';
      input.value = Money.format(a.startBalanceCents || 0, { withSymbol: false });
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--sm';
      btn.textContent = 'Sichern';
      btn.addEventListener('click', () => saveStartBalance(a.id, input.value));
      row.appendChild(input);
      row.appendChild(btn);
      wrap.appendChild(row);
    });
  }

  function renderAccounts() {
    renderAccountOverview();
    renderTransferControls();
    renderTransferList();
    renderStartBalanceList();
  }

  // nach Änderungen, die Bestände betreffen
  function refreshBalances() {
    renderBalance();
    renderAccountSummary();
    renderAccountOverview();
  }

  // ---------- Erfassen speichern ----------
  async function saveCapture(e) {
    e.preventDefault();
    const cents = Money.parse($('#amountInput').value);
    if (!cents || cents <= 0) { toast('Bitte gültigen Betrag eingeben'); return; }
    if (!state.capture.categoryId) { toast('Bitte Kategorie wählen'); return; }
    if (!state.capture.accountId) { toast('Bitte Konto wählen'); return; }
    const t = {
      id: DB.uuid(), date: $('#dateInput').value || todayISO(),
      amountCents: cents, type: state.capture.type, categoryId: state.capture.categoryId,
      accountId: state.capture.accountId,
      note: $('#noteInput').value.trim(), recurringId: null, createdAt: new Date().toISOString(),
    };
    await DB.putTransaction(t);
    state.transactions.push(t);
    $('#amountInput').value = ''; $('#noteInput').value = '';
    refreshBalances(); renderHistory();
    toast('Gespeichert ✓');
  }

  async function saveStartBalance(accId, value) {
    const cents = Money.parse(value);
    if (cents == null) { toast('Bitte gültigen Betrag'); return; }
    const acc = accountById(accId);
    if (!acc) return;
    acc.startBalanceCents = cents;
    await DB.putAccount(acc);
    refreshBalances();
    toast('Anfangsbestand gesichert ✓');
  }

  // ---------- Transfer ----------
  async function saveTransfer() {
    const cents = Money.parse($('#transferAmount').value);
    if (!cents || cents <= 0) { toast('Bitte gültigen Betrag'); return; }
    const fromId = $('#transferFrom').value;
    const toId = $('#transferTo').value;
    if (!fromId || !toId) { toast('Bitte Konten wählen'); return; }
    if (fromId === toId) { toast('Von- und Auf-Konto müssen verschieden sein'); return; }
    const tr = {
      id: DB.uuid(), date: $('#transferDate').value || todayISO(),
      amountCents: cents, fromAccountId: fromId, toAccountId: toId,
      note: $('#transferNote').value.trim(), createdAt: new Date().toISOString(),
    };
    await DB.putTransfer(tr);
    state.transfers.push(tr);
    $('#transferAmount').value = ''; $('#transferNote').value = '';
    refreshBalances(); renderTransferList();
    toast('Umgebucht ✓');
  }
  async function deleteTransfer(id) {
    await DB.deleteTransfer(id);
    state.transfers = state.transfers.filter((x) => x.id !== id);
    refreshBalances(); renderTransferList();
    toast('Umbuchung gelöscht');
  }

  // ---------- Eintrag bearbeiten ----------
  function openEdit(t) {
    state.edit = { id: t.id, type: t.type, categoryId: t.categoryId, expandedParentId: null, accountId: txAccountId(t) };
    $('#editAmount').value = Money.format(t.amountCents, { withSymbol: false });
    $('#editDate').value = t.date;
    $('#editNote').value = t.note || '';
    fillAccountSelect($('#editAccount'), state.edit.accountId);
    renderEditOverlay();
    $('#editOverlay').hidden = false;
  }
  function renderEditOverlay() {
    $$('#editType .typebtn').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.type === state.edit.type));
    syncCategory(state.edit, state.edit.type);
    renderPicker($('#editChips'), state.edit.type, state.edit.categoryId, state.edit.expandedParentId,
      (id) => { state.edit.categoryId = id; renderEditOverlay(); },
      (pid) => { state.edit.expandedParentId = state.edit.expandedParentId === pid ? null : pid; renderEditOverlay(); });
  }
  const closeEdit = () => { $('#editOverlay').hidden = true; state.edit.id = null; };

  async function saveEdit() {
    const cents = Money.parse($('#editAmount').value);
    if (!cents || cents <= 0) { toast('Bitte gültigen Betrag'); return; }
    if (!state.edit.categoryId) { toast('Bitte Kategorie wählen'); return; }
    const t = state.transactions.find((x) => x.id === state.edit.id);
    if (!t) return;
    t.amountCents = cents; t.type = state.edit.type; t.categoryId = state.edit.categoryId;
    t.accountId = $('#editAccount').value || state.edit.accountId;
    t.date = $('#editDate').value || t.date; t.note = $('#editNote').value.trim();
    await DB.putTransaction(t);
    closeEdit(); refreshBalances(); renderHistory();
    toast('Aktualisiert ✓');
  }
  async function deleteEdit() {
    const id = state.edit.id; if (!id) return;
    await DB.deleteTransaction(id);
    state.transactions = state.transactions.filter((x) => x.id !== id);
    closeEdit(); refreshBalances(); renderHistory();
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
  function populateCatSelects(current) {
    const gsel = $('#catGroup');
    gsel.innerHTML = '';
    const groups = expenseGroups();
    (CONFIG.categoryTree || []).forEach((c) => { if (!groups.includes(c.column)) groups.push(c.column); });
    groups.forEach((g) => {
      const o = document.createElement('option'); o.value = g; o.textContent = g; gsel.appendChild(o);
    });
    const psel = $('#catParent');
    psel.innerHTML = '<option value="">— (Ebene 1)</option>';
    state.categories
      .filter((c) => isExpenseLike(c) && !c.parentId && (!current || c.id !== current.id))
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((c) => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = (c.group ? c.group + ' › ' : '') + c.name;
        psel.appendChild(o);
      });
  }
  function updateCatRowsVisibility() {
    const isExpense = $('#catType').value !== 'income';
    const hasParent = isExpense && $('#catParent').value;
    // Kategorien mit eigenen Kindern dürfen keinen Parent bekommen (max. 2 Ebenen).
    $('#catParentRow').hidden = !isExpense || state.cat.hasChildren;
    // Spalte nur relevant für Ebene-1; bei gewähltem Elternknoten wird Spalte vererbt.
    $('#catGroupRow').hidden = !isExpense || !!hasParent;
  }
  function openCatEdit(cat) {
    const isNew = !cat;
    state.cat.id = isNew ? null : cat.id;
    state.cat.hasChildren = !isNew && childrenOf(cat.id).length > 0;
    state.cat.color = isNew ? (CONFIG.ui.colorPalette || ['#64748b'])[0] : cat.color;
    $('#catSheetTitle').textContent = isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten';
    $('#catIcon').value = isNew ? '' : (cat.icon || '');
    $('#catName').value = isNew ? '' : cat.name;
    $('#catType').value = isNew ? 'expense' : cat.type;
    $('#catArchived').checked = isNew ? false : !!cat.archived;
    $('#catDelete').hidden = isNew;
    populateCatSelects(cat);
    $('#catGroup').value = isNew ? (expenseGroups()[0] || (CONFIG.categoryTree[0] || {}).column || '') : (cat.group || '');
    $('#catParent').value = isNew ? '' : (cat.parentId || '');
    updateCatRowsVisibility();
    renderSwatches();
    $('#catOverlay').hidden = false;
  }
  const closeCat = () => { $('#catOverlay').hidden = true; state.cat.id = null; };

  async function saveCat() {
    const name = $('#catName').value.trim();
    if (!name) { toast('Bitte Name eingeben'); return; }
    const type = $('#catType').value;
    const existing = state.cat.id ? state.categories.find((c) => c.id === state.cat.id) : null;
    let parentId = null, group = null;
    if (type !== 'income') {
      // Kategorien mit Kindern bleiben Ebene 1 (max. 2 Ebenen).
      parentId = state.cat.hasChildren ? null : ($('#catParent').value || null);
      const parent = parentId ? categoryById(parentId) : null;
      group = parent ? parent.group : ($('#catGroup').value || null);
    }
    const cat = {
      id: state.cat.id || DB.uuid(),
      name, icon: $('#catIcon').value.trim(), color: state.cat.color,
      type, group, parentId,
      order: existing ? (existing.order || 0) : (state.categories.length + 1) * 10,
      archived: $('#catArchived').checked,
    };
    await DB.putCategory(cat);
    // Parent archiviert -> Kinder mit-archivieren (sonst unsichtbar, aber "gültig").
    if (cat.archived) {
      for (const k of state.categories.filter((c) => c.parentId === cat.id && !c.archived)) {
        k.archived = true;
        await DB.putCategory(k);
      }
    }
    state.categories = await DB.listCategories();
    closeCat(); renderCapture(); renderHistory(); renderMore(); populateFilterCats();
    toast('Kategorie gespeichert ✓');
  }
  async function deleteCat() {
    const id = state.cat.id; if (!id) return;
    // Untergeordnete Kategorien mitlöschen.
    const kids = state.categories.filter((c) => c.parentId === id);
    for (const k of kids) await DB.deleteCategory(k.id);
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
    state.recur.expandedParentId = null;
    state.recur.accountId = isNew ? defaultAccountId() : (rule.accountId || defaultAccountId());
    $('#recurAmount').value = isNew ? '' : Money.format(rule.amountCents, { withSymbol: false });
    $('#recurNote').value = isNew ? '' : (rule.note || '');
    fillAccountSelect($('#recurAccount'), state.recur.accountId);
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
    syncCategory(state.recur, state.recur.type);
    renderPicker($('#recurChips'), state.recur.type, state.recur.categoryId, state.recur.expandedParentId,
      (id) => { state.recur.categoryId = id; renderRecurOverlay(); },
      (pid) => { state.recur.expandedParentId = state.recur.expandedParentId === pid ? null : pid; renderRecurOverlay(); });
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
      accountId: $('#recurAccount').value || defaultAccountId(),
      note: $('#recurNote').value.trim(), interval: iv, anchorDay: anchor,
      startDate: $('#recurStart').value || todayISO(),
      endDate: $('#recurEnd').value || null,
      // Reaktivierung beginnt ab heute — der inaktive Zeitraum wird nicht
      // rückwirkend aufgefüllt. Neue Regeln erzeugen ab Startdatum (lastRun null).
      lastRun: existing
        ? (!existing.active && $('#recurActive').checked ? todayISO() : existing.lastRun)
        : null,
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
    refreshBalances(); renderHistory(); renderMore();
  }

  // ---------- Daten: Export / Import ----------
  async function exportCsv() {
    if (state.transactions.length === 0) { toast('Keine Daten zum Exportieren'); return; }
    const res = await Exporter.exportCSV(state.transactions, state.categories, state.accounts, defaultAccountId());
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
      await DB.importAll(data, CONFIG);
      state.settings = await DB.getSettings();
      state.accounts = await DB.listAccounts();
      state.categories = await DB.listCategories();
      state.transactions = await DB.listTransactions();
      state.transfers = await DB.listTransfers();
      state.recurring = await DB.listRecurring();
      populateFilterCats();
      refreshBalances(); renderCapture(); renderHistory(); renderAccounts(); renderMore();
      toast('Backup geladen ✓');
    } catch (e) {
      console.error(e); toast('Import fehlgeschlagen: ' + e.message);
    }
  }

  // ---------- Navigation ----------
  function showView(name) {
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== name; });
    $$('.tab').forEach((tb) => tb.classList.toggle('is-active', tb.dataset.goto === name));
    if (name === 'capture') renderAccountSummary();
    if (name === 'stats') renderStatistics();
    if (name === 'accounts') renderAccounts();
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
    $('#clearAmountBtn').addEventListener('click', () => { $('#amountInput').value = ''; });

    // Konten / Transfer
    $('#transferSaveBtn').addEventListener('click', saveTransfer);

    // Statistik: Monats-Navigation
    $('#statsPrev').addEventListener('click', () => {
      state.stats.month = addMonths(state.stats.month, -1); renderStatistics();
    });
    $('#statsNext').addEventListener('click', () => {
      state.stats.month = addMonths(state.stats.month, 1); renderStatistics();
    });

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
    $('#catType').addEventListener('change', updateCatRowsVisibility);
    $('#catParent').addEventListener('change', updateCatRowsVisibility);
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
    state.settings = await DB.getSettings();
    state.accounts = await DB.listAccounts();
    state.categories = await DB.listCategories();
    state.transfers = await DB.listTransfers();
    await generateDueRecurring();
    state.transactions = await DB.listTransactions();
    state.recurring = await DB.listRecurring();

    state.capture.accountId = defaultAccountId();
    state.stats.month = monthKey(todayISO());
    $('#dateInput').value = todayISO();
    buildIntervalSelect();
    populateFilterCats();
    renderQuickButtons();
    wireEvents();
    renderBalance();
    renderCapture();
    renderHistory();
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
