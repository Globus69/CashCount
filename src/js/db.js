// db.js — IndexedDB-Layer. Stores: settings, accounts, categories, transactions,
// transfers, recurring. Geldbeträge immer als Integer in Cent.

const DB = (() => {
  const DB_NAME = 'cashcount';
  const DB_VERSION = 2; // v2: accounts + transfers, Kategorie-Hierarchie
  let _db = null;

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('settings'))
          db.createObjectStore('settings'); // key: "app"
        if (!db.objectStoreNames.contains('accounts'))
          db.createObjectStore('accounts', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('categories'))
          db.createObjectStore('categories', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('transactions')) {
          const tx = db.createObjectStore('transactions', { keyPath: 'id' });
          tx.createIndex('byDate', 'date');
          tx.createIndex('byCategory', 'categoryId');
        }
        if (!db.objectStoreNames.contains('transfers')) {
          const tr = db.createObjectStore('transfers', { keyPath: 'id' });
          tr.createIndex('byDate', 'date');
        }
        if (!db.objectStoreNames.contains('recurring'))
          db.createObjectStore('recurring', { keyPath: 'id' });
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function store(name, mode) {
    return open().then((db) => db.transaction(name, mode).objectStore(name));
  }
  function reqP(request) {
    return new Promise((res, rej) => {
      request.onsuccess = () => res(request.result);
      request.onerror = () => rej(request.error);
    });
  }

  // --- settings (Einzelobjekt unter key "app") ---
  const getSettings = () => store('settings', 'readonly').then((s) => reqP(s.get('app')));
  const setSettings = (obj) => store('settings', 'readwrite').then((s) => reqP(s.put(obj, 'app')));

  // --- accounts ---
  const listAccounts = () => store('accounts', 'readonly').then((s) => reqP(s.getAll()));
  const putAccount = (a) => store('accounts', 'readwrite').then((s) => reqP(s.put(a)));
  const deleteAccount = (id) => store('accounts', 'readwrite').then((s) => reqP(s.delete(id)));

  // --- categories ---
  const listCategories = () => store('categories', 'readonly').then((s) => reqP(s.getAll()));
  const putCategory = (cat) => store('categories', 'readwrite').then((s) => reqP(s.put(cat)));
  const deleteCategory = (id) => store('categories', 'readwrite').then((s) => reqP(s.delete(id)));

  // --- transactions ---
  const putTransaction = (t) => store('transactions', 'readwrite').then((s) => reqP(s.put(t)));
  const listTransactions = () => store('transactions', 'readonly').then((s) => reqP(s.getAll()));
  const deleteTransaction = (id) => store('transactions', 'readwrite').then((s) => reqP(s.delete(id)));

  // --- transfers ---
  const listTransfers = () => store('transfers', 'readonly').then((s) => reqP(s.getAll()));
  const putTransfer = (t) => store('transfers', 'readwrite').then((s) => reqP(s.put(t)));
  const deleteTransfer = (id) => store('transfers', 'readwrite').then((s) => reqP(s.delete(id)));

  // --- recurring ---
  const listRecurring = () => store('recurring', 'readonly').then((s) => reqP(s.getAll()));
  const putRecurring = (r) => store('recurring', 'readwrite').then((s) => reqP(s.put(r)));
  const deleteRecurring = (id) => store('recurring', 'readwrite').then((s) => reqP(s.delete(id)));

  // Flacht den Kategorie-Baum aus CONFIG zu DB-Records (mit group/parentId/order) ab.
  function buildCategoryRecords(config) {
    const records = [];
    let order = 0;
    for (const col of (config.categoryTree || [])) {
      for (const item of (col.items || [])) {
        const parentId = uuid();
        records.push({
          id: parentId, name: item.name, icon: item.icon || '', color: item.color || '#64748b',
          type: 'expense', group: col.column, parentId: null, order: order++, archived: false,
        });
        for (const child of (item.children || [])) {
          records.push({
            id: uuid(), name: child.name, icon: child.icon || '', color: child.color || item.color || '#64748b',
            type: 'expense', group: col.column, parentId, order: order++, archived: false,
          });
        }
      }
    }
    for (const inc of (config.incomeCategories || [])) {
      records.push({
        id: uuid(), name: inc.name, icon: inc.icon || '', color: inc.color || '#16a34a',
        type: 'income', group: null, parentId: null, order: order++, archived: false,
      });
    }
    return records;
  }

  // Beim ersten Start: Konten, Kategorien & Settings aus CONFIG anlegen.
  async function ensureSeed(config) {
    const today = new Date().toISOString().slice(0, 10);

    // Konten zuerst (Settings referenzieren das Default-Konto per ID).
    let accounts = await listAccounts();
    if (accounts.length === 0) {
      let i = 0;
      for (const a of (config.accounts && config.accounts.list) || []) {
        await putAccount({
          id: uuid(), name: a.name,
          startBalanceCents: Math.round((a.startEuro || 0) * 100),
          order: i++, archived: false,
        });
      }
      accounts = await listAccounts();
    }
    const defName = config.accounts && config.accounts.default;
    const defAcc = accounts.find((a) => a.name === defName) || accounts[0];

    let settings = await getSettings();
    if (!settings) {
      await setSettings({
        startDate: today,
        currency: config.app.currency,
        locale: config.app.locale,
        mode: (config.balance && config.balance.mode) || 'once',
        defaultAccountId: defAcc ? defAcc.id : null,
      });
    } else if (!settings.defaultAccountId && defAcc) {
      settings.defaultAccountId = defAcc.id;
      await setSettings(settings);
    }

    const cats = await listCategories();
    if (cats.length === 0) {
      for (const rec of buildCategoryRecords(config)) await putCategory(rec);
    }
  }

  // --- Export / Import (Backup) ---
  async function exportAll() {
    return {
      meta: { app: 'CashCount', version: 2, exportedAt: new Date().toISOString() },
      settings: await getSettings(),
      accounts: await listAccounts(),
      categories: await listCategories(),
      transactions: await listTransactions(),
      transfers: await listTransfers(),
      recurring: await listRecurring(),
    };
  }

  function clearStore(name) {
    return store(name, 'readwrite').then((s) => reqP(s.clear()));
  }

  // Ersetzt ALLE Daten durch die aus dem Backup (vorher leeren).
  async function importAll(data) {
    if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.categories))
      throw new Error('Ungültiges Backup-Format');
    await clearStore('accounts');
    await clearStore('categories');
    await clearStore('transactions');
    await clearStore('transfers');
    await clearStore('recurring');
    if (data.settings) await setSettings(data.settings);
    for (const a of (data.accounts || [])) await putAccount(a);
    for (const c of data.categories) await putCategory(c);
    for (const t of data.transactions) await putTransaction(t);
    for (const t of (data.transfers || [])) await putTransfer(t);
    for (const r of (data.recurring || [])) await putRecurring(r);
  }

  return {
    uuid, open, ensureSeed,
    getSettings, setSettings,
    listAccounts, putAccount, deleteAccount,
    listCategories, putCategory, deleteCategory,
    putTransaction, listTransactions, deleteTransaction,
    listTransfers, putTransfer, deleteTransfer,
    listRecurring, putRecurring, deleteRecurring,
    exportAll, importAll,
  };
})();

if (typeof module !== 'undefined') module.exports = DB;
