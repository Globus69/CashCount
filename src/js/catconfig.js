// catconfig.js — Kategorien-Editor (kategorien.html). Grafische Strukturierung:
// umbenennen, Icon/Farbe, Reihenfolge (Drag & Drop + Pfeile), Ebene wechseln,
// Spalte/Elternknoten verschieben, anlegen, archivieren, löschen, DB-Reset.
// Schreibt direkt in IndexedDB und meldet Änderungen an den Geräte-Sync.

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  let cats = [];
  let dragId = null;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const byId = (id) => cats.find((c) => c.id === id);
  const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

  const groups = () => {
    const seen = [];
    cats.filter((c) => c.type !== 'income' && !c.parentId && c.group).sort(byOrder)
      .forEach((c) => { if (!seen.includes(c.group)) seen.push(c.group); });
    return seen;
  };
  const level1 = (g) => cats.filter((c) => c.type !== 'income' && !c.parentId && c.group === g).sort(byOrder);
  const kidsOf = (id) => cats.filter((c) => c.parentId === id).sort(byOrder);
  const incomes = () => cats.filter((c) => c.type === 'income').sort(byOrder);

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    setTimeout(() => { t.hidden = true; }, 1500);
  }
  function status(msg) { $('#pageStatus').textContent = msg || ''; }

  async function persist(cat) {
    await DB.putCategory(cat);
    Sync.markDirty();
  }
  async function reload() {
    cats = await DB.listCategories();
    render();
  }

  // Geschwister eines Eintrags (gleiche Ebene/Scope) in Reihenfolge
  function siblingsOf(cat) {
    if (cat.type === 'income') return incomes();
    return cat.parentId ? kidsOf(cat.parentId) : level1(cat.group);
  }
  async function renumber(list) {
    let o = 10;
    for (const c of list) {
      if (c.order !== o) { c.order = o; await DB.putCategory(c); }
      o += 10;
    }
    Sync.markDirty();
  }

  // ---------- Operationen ----------
  async function move(cat, dir) {
    const sib = siblingsOf(cat);
    const i = sib.indexOf(cat);
    const j = i + dir;
    if (j < 0 || j >= sib.length) return;
    [sib[i], sib[j]] = [sib[j], sib[i]];
    await renumber(sib);
    render();
  }

  // Ebene 1 -> Unterkategorie der darüberliegenden Ebene-1-Kategorie
  async function demote(cat) {
    if (kidsOf(cat.id).length) { toast('Hat selbst Unterkategorien — erst diese verschieben'); return; }
    const sib = level1(cat.group);
    const i = sib.indexOf(cat);
    if (i <= 0) { toast('Keine Kategorie darüber'); return; }
    const parent = sib[i - 1];
    cat.parentId = parent.id;
    cat.order = kidsOf(parent.id).reduce((m, k) => Math.max(m, k.order || 0), 0) + 10;
    await persist(cat);
    render();
  }

  // Unterkategorie -> Ebene 1 (direkt hinter dem bisherigen Parent)
  async function promote(cat) {
    const parent = byId(cat.parentId);
    cat.parentId = null;
    cat.order = (parent ? (parent.order || 0) : 0) + 5;
    await persist(cat);
    await renumber(level1(cat.group));
    render();
  }

  async function changeGroup(cat, g) {
    cat.group = g;
    cat.order = level1(g).reduce((m, c) => Math.max(m, c.order || 0), 0) + 10;
    await persist(cat);
    for (const k of kidsOf(cat.id)) { k.group = g; await DB.putCategory(k); }
    render();
  }
  async function changeParent(cat, pid) {
    const parent = byId(pid);
    if (!parent) return;
    cat.parentId = pid;
    cat.group = parent.group;
    cat.order = kidsOf(pid).reduce((m, k) => Math.max(m, k.order || 0), 0) + 10;
    await persist(cat);
    render();
  }

  async function toggleArchive(cat) {
    cat.archived = !cat.archived;
    await persist(cat);
    if (cat.archived) {
      for (const k of kidsOf(cat.id)) {
        if (!k.archived) { k.archived = true; await DB.putCategory(k); }
      }
    }
    render();
  }
  async function del(cat) {
    const kids = kidsOf(cat.id);
    const msg = kids.length
      ? `„${cat.name}" und ${kids.length} Unterkategorie(n) löschen?\nBuchungen bleiben erhalten, zeigen aber „Unbekannt".`
      : `„${cat.name}" löschen?\nBuchungen bleiben erhalten, zeigen aber „Unbekannt".`;
    if (!window.confirm(msg)) return;
    for (const k of kids) await DB.deleteCategory(k.id);
    await DB.deleteCategory(cat.id);
    Sync.markDirty();
    await reload();
  }

  function maxOrder() { return cats.reduce((m, c) => Math.max(m, c.order || 0), 0); }
  async function addCategory(opts) {
    const cat = Object.assign({
      id: DB.uuid(), name: 'Neue Kategorie', icon: '🏷️', color: '#64748b',
      type: 'expense', group: null, parentId: null, order: maxOrder() + 10, archived: false,
    }, opts);
    await persist(cat);
    cats.push(cat);
    render();
    // Namensfeld der neuen Zeile fokussieren
    const row = document.querySelector(`.krow[data-id="${cat.id}"] .krow__name`);
    if (row) { row.focus(); row.select(); }
  }

  // ---------- Datenbank-Reset (mit doppeltem Warnhinweis) ----------
  async function resetDatabase() {
    if (!window.confirm(
      '⚠️ DATENBANK ZURÜCKSETZEN?\n\n' +
      'ALLE Daten auf diesem Gerät werden gelöscht:\n' +
      '• alle Buchungen und Umbuchungen\n• alle Konten und Anfangsbestände\n' +
      '• alle Kategorien\n• alle wiederkehrenden Regeln\n\n' +
      'Die App startet danach wie beim ersten Mal.')) return;
    if (!window.confirm(
      'Letzte Warnung — wirklich ALLES löschen?\n\n' +
      'Das kann NICHT rückgängig gemacht werden.\n' +
      'Auch die Sync-Einstellungen dieses Geräts werden entfernt\n' +
      '(die Datei im GitHub-Repo bleibt bestehen).')) return;
    Sync.stopTimer();
    ['cc-sync-repo', 'cc-sync-token', 'cc-sync-enabled', 'cc-sync-sha', 'cc-sync-last', 'cc-sync-dirty']
      .forEach((k) => localStorage.removeItem(k));
    DB.close();
    await new Promise((res) => {
      const r = indexedDB.deleteDatabase('cashcount');
      r.onsuccess = res; r.onerror = res; r.onblocked = res;
    });
    window.location.href = 'index.html';
  }

  // ---------- Drag & Drop (Reihenfolge innerhalb derselben Liste) ----------
  function wireDnD(listEl) {
    listEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragged = listEl.querySelector('.is-dragging');
      if (!dragged) return; // Drag stammt aus anderer Liste -> ignorieren
      const after = [...listEl.querySelectorAll('.krow:not(.is-dragging)')].find((row) => {
        const r = row.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      if (after) listEl.insertBefore(dragged, after);
      else listEl.appendChild(dragged);
    });
    listEl.addEventListener('drop', (e) => e.preventDefault());
  }
  async function finishDrag(listEl) {
    const ids = [...listEl.querySelectorAll('.krow')].map((r) => r.dataset.id);
    await renumber(ids.map(byId).filter(Boolean));
    render();
  }

  // ---------- Render ----------
  function rowEl(cat, kind) {
    const row = document.createElement('div');
    row.className = 'krow' + (kind === 'child' ? ' is-child' : '') + (cat.archived ? ' is-archived' : '');
    row.dataset.id = cat.id;
    row.draggable = true;

    row.innerHTML =
      `<span class="krow__drag" title="Ziehen zum Sortieren">⠿</span>` +
      `<input class="krow__icon" value="${esc(cat.icon || '')}" maxlength="4" title="Symbol">` +
      `<input class="krow__name" value="${esc(cat.name)}" title="Name">` +
      `<input type="color" class="krow__color" value="${/^#[0-9a-f]{6}$/i.test(cat.color) ? cat.color : '#64748b'}" title="Farbe">`;

    // Verschieben-Auswahl: Ebene 1 -> andere Spalte, Kind -> anderer Parent
    const sel = document.createElement('select');
    sel.className = 'krow__sel';
    if (kind === 'income') {
      sel.hidden = true;
    } else if (kind === 'child') {
      sel.title = 'Übergeordnete Kategorie';
      cats.filter((c) => c.type !== 'income' && !c.parentId).sort(byOrder).forEach((p) => {
        const o = document.createElement('option');
        o.value = p.id; o.textContent = (p.group ? p.group + ' › ' : '') + p.name;
        sel.appendChild(o);
      });
      sel.value = cat.parentId;
      sel.addEventListener('change', () => changeParent(cat, sel.value));
    } else {
      sel.title = 'Spalte';
      groups().forEach((g) => {
        const o = document.createElement('option');
        o.value = g; o.textContent = g;
        sel.appendChild(o);
      });
      sel.value = cat.group;
      sel.addEventListener('change', () => changeGroup(cat, sel.value));
    }
    row.appendChild(sel);

    const mkBtn = (label, title, onClick, opts = {}) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'kbtn' + (opts.danger ? ' kbtn--danger' : '');
      b.textContent = label; b.title = title;
      if (opts.disabled) b.disabled = true;
      b.addEventListener('click', onClick);
      row.appendChild(b);
    };
    const sib = siblingsOf(cat);
    mkBtn('↑', 'Nach oben', () => move(cat, -1), { disabled: sib.indexOf(cat) === 0 });
    mkBtn('↓', 'Nach unten', () => move(cat, +1), { disabled: sib.indexOf(cat) === sib.length - 1 });
    if (kind === 'level1') {
      mkBtn('➘', 'Zur Unterkategorie der darüberliegenden machen', () => demote(cat),
        { disabled: sib.indexOf(cat) === 0 || kidsOf(cat.id).length > 0 });
      mkBtn('＋', 'Unterkategorie anlegen', () =>
        addCategory({ group: cat.group, parentId: cat.id, color: cat.color, order: kidsOf(cat.id).reduce((m, k) => Math.max(m, k.order || 0), 0) + 10 }));
    }
    if (kind === 'child') mkBtn('⬆', 'Auf Ebene 1 anheben', () => promote(cat));
    mkBtn(cat.archived ? '👁' : '🚫', cat.archived ? 'Wieder einblenden' : 'Archivieren (ausblenden)', () => toggleArchive(cat));
    mkBtn('✕', 'Löschen', () => del(cat), { danger: true });

    // Inline-Edits
    const iconIn = row.querySelector('.krow__icon');
    const nameIn = row.querySelector('.krow__name');
    const colorIn = row.querySelector('.krow__color');
    iconIn.addEventListener('change', () => { cat.icon = iconIn.value.trim(); persist(cat); });
    nameIn.addEventListener('change', () => {
      const v = nameIn.value.trim();
      if (!v) { nameIn.value = cat.name; return; }
      cat.name = v; persist(cat);
    });
    colorIn.addEventListener('change', () => { cat.color = colorIn.value; persist(cat); });

    // Drag-Quelle
    row.addEventListener('dragstart', (e) => {
      dragId = cat.id;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('is-dragging');
      const listEl = row.parentElement;
      if (listEl && listEl.classList.contains('klist')) finishDrag(listEl);
      dragId = null;
    });

    return row;
  }

  function render() {
    const wrap = $('#groupsWrap');
    wrap.innerHTML = '';
    groups().forEach((g) => {
      const sec = document.createElement('section');
      sec.className = 'kgroup';
      const head = document.createElement('div');
      head.className = 'kgroup__head';
      head.innerHTML = `<span style="flex:1">${esc(g)}</span>`;
      const add = document.createElement('button');
      add.type = 'button'; add.className = 'btn btn--sm'; add.textContent = '+ Kategorie';
      add.addEventListener('click', () =>
        addCategory({ group: g, order: level1(g).reduce((m, c) => Math.max(m, c.order || 0), 0) + 10 }));
      head.appendChild(add);
      sec.appendChild(head);

      level1(g).forEach((l1) => {
        const list = document.createElement('div');
        list.className = 'klist';
        list.dataset.scope = 'l1-' + g + '-' + l1.id;
        list.appendChild(rowEl(l1, 'level1'));
        sec.appendChild(list);
        const kids = kidsOf(l1.id);
        if (kids.length) {
          const kl = document.createElement('div');
          kl.className = 'klist';
          kl.dataset.scope = 'kids-' + l1.id;
          kids.forEach((k) => kl.appendChild(rowEl(k, 'child')));
          wireDnD(kl);
          sec.appendChild(kl);
        }
      });
      // Ebene-1-Zeilen einer Spalte zusätzlich als gemeinsame DnD-Liste? — bewusst nicht:
      // Ebene 1 wird über ↑↓ sortiert, damit Kinder-Blöcke nicht zerreißen.
      wrap.appendChild(sec);
    });

    const il = $('#incomeList');
    il.innerHTML = '';
    incomes().forEach((c) => il.appendChild(rowEl(c, 'income')));
    wireDnD(il);
  }

  // ---------- Init ----------
  async function init() {
    await DB.open();
    await DB.ensureSeed(CONFIG);
    Sync.init(CONFIG, { afterPull: reload, onStatus: (m) => status(m) });
    if (Sync.isEnabled()) await Sync.syncNow('start');
    await reload();

    $('#addGroupBtn').addEventListener('click', () => {
      const name = $('#newGroupName').value.trim();
      if (!name) { toast('Bitte Spalten-Namen eingeben'); return; }
      if (groups().includes(name)) { toast('Spalte existiert schon'); return; }
      $('#newGroupName').value = '';
      addCategory({ group: name });
    });
    $('#addIncomeBtn').addEventListener('click', () =>
      addCategory({ type: 'income', group: null, name: 'Neue Einnahme', icon: '💰', color: '#16a34a' }));
    $('#dbResetBtn').addEventListener('click', resetDatabase);
  }

  init().catch((e) => { console.error(e); status('Fehler: ' + e.message); });
})();
