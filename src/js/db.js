// db.js — IndexedDB-Layer. Stores: settings, categories, transactions, recurring.
// Geldbeträge immer als Integer in Cent.

const DB = (() => {
  const DB_NAME = 'cashcount';
  const DB_VERSION = 1;
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
        if (!db.objectStoreNames.contains('categories'))
          db.createObjectStore('categories', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('transactions')) {
          const tx = db.createObjectStore('transactions', { keyPath: 'id' });
          tx.createIndex('byDate', 'date');
          tx.createIndex('byCategory', 'categoryId');
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

  // --- categories ---
  const listCategories = () => store('categories', 'readonly').then((s) => reqP(s.getAll()));
  const putCategory = (cat) => store('categories', 'readwrite').then((s) => reqP(s.put(cat)));
  const deleteCategory = (id) => store('categories', 'readwrite').then((s) => reqP(s.delete(id)));

  // --- transactions ---
  const putTransaction = (t) => store('transactions', 'readwrite').then((s) => reqP(s.put(t)));
  const listTransactions = () => store('transactions', 'readonly').then((s) => reqP(s.getAll()));
  const deleteTransaction = (id) => store('transactions', 'readwrite').then((s) => reqP(s.delete(id)));

  // --- recurring ---
  const listRecurring = () => store('recurring', 'readonly').then((s) => reqP(s.getAll()));
  const putRecurring = (r) => store('recurring', 'readwrite').then((s) => reqP(s.put(r)));
  const deleteRecurring = (id) => store('recurring', 'readwrite').then((s) => reqP(s.delete(id)));

  // Beim ersten Start: Settings & Kategorien aus CONFIG anlegen.
  async function ensureSeed(config) {
    const today = new Date().toISOString().slice(0, 10);
    let settings = await getSettings();
    if (!settings) {
      await setSettings({
        startBalanceCents: Math.round((config.balance.defaultStartEuro || 0) * 100),
        startDate: today,
        currency: config.app.currency,
        locale: config.app.locale,
        mode: config.balance.mode || 'once',
      });
    }
    const cats = await listCategories();
    if (cats.length === 0) {
      for (const c of config.categories) {
        await putCategory({
          id: uuid(),
          name: c.name, icon: c.icon, color: c.color,
          type: c.type, archived: false,
        });
      }
    }
  }

  // --- Export / Import (Backup) ---
  async function exportAll() {
    return {
      meta: { app: 'CashCount', version: 1, exportedAt: new Date().toISOString() },
      settings: await getSettings(),
      categories: await listCategories(),
      transactions: await listTransactions(),
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
    await clearStore('categories');
    await clearStore('transactions');
    await clearStore('recurring');
    if (data.settings) await setSettings(data.settings);
    for (const c of data.categories) await putCategory(c);
    for (const t of data.transactions) await putTransaction(t);
    for (const r of (data.recurring || [])) await putRecurring(r);
  }

  return {
    uuid, open, ensureSeed,
    getSettings, setSettings,
    listCategories, putCategory, deleteCategory,
    putTransaction, listTransactions, deleteTransaction,
    listRecurring, putRecurring, deleteRecurring,
    exportAll, importAll,
  };
})();

if (typeof module !== 'undefined') module.exports = DB;
