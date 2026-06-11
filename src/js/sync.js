// sync.js — Geräte-Sync über ein PRIVATES GitHub-Repository (Contents-API).
// Die App speichert den kompletten Datenbestand (DB.exportAll) als JSON-Datei
// im Repo. Abgleich: beim Start, im Zeitintervall, nach Änderungen (debounced)
// und manuell per Refresh-Button.
//
// Konfiguration (Repo + Token) liegt NUR lokal im localStorage des Geräts und
// wird nie mitsynchronisiert. Konflikt (beide Geräte geändert): Nachfrage.

const Sync = (() => {
  const FILE = 'cashcount-data.json';
  const LS = {
    repo: 'cc-sync-repo',       // "benutzer/repository"
    token: 'cc-sync-token',     // fine-grained PAT, Contents read/write
    enabled: 'cc-sync-enabled', // '1' | ''
    sha: 'cc-sync-sha',         // SHA der zuletzt gesehenen Remote-Datei
    lastAt: 'cc-sync-last',     // letzter erfolgreicher Sync (ISO)
    dirtyAt: 'cc-sync-dirty',   // letzte lokale Änderung (ISO)
  };
  const INTERVAL_MS = 5 * 60 * 1000;  // automatischer Abgleich
  const DEBOUNCE_MS = 8 * 1000;       // Push kurz nach einer Änderung

  let _config = null;   // CONFIG (für importAll/ensureSeed)
  let _hooks = {};      // { afterPull, onStatus }
  let _timer = null, _debounce = null, _busy = false;

  const get = (k) => localStorage.getItem(k) || '';
  const set = (k, v) => v ? localStorage.setItem(k, v) : localStorage.removeItem(k);

  const isConfigured = () => !!(get(LS.repo) && get(LS.token));
  const isEnabled = () => isConfigured() && get(LS.enabled) === '1';
  const isDirty = () => (get(LS.dirtyAt) || '0') > (get(LS.lastAt) || '0');

  function status(msg, kind) {
    if (_hooks.onStatus) _hooks.onStatus(msg, kind || 'info');
  }

  // --- Unicode-sicheres Base64 ---
  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(b64.replace(/\n/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // --- GitHub Contents-API ---
  function apiUrl() {
    return `https://api.github.com/repos/${get(LS.repo)}/contents/${FILE}`;
  }
  function headers() {
    return {
      'Authorization': 'Bearer ' + get(LS.token),
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }
  async function fetchRemote() {
    const res = await fetch(apiUrl(), { headers: headers(), cache: 'no-store' });
    if (res.status === 404) return null; // noch keine Datei im Repo
    if (res.status === 401 || res.status === 403) throw new Error('Token ungültig oder ohne Zugriff');
    if (!res.ok) throw new Error('GitHub: HTTP ' + res.status);
    const body = await res.json();
    return { data: JSON.parse(b64decode(body.content)), sha: body.sha };
  }
  async function push(sha) {
    const data = await DB.exportAll();
    const payload = {
      message: 'CashCount Sync ' + new Date().toISOString(),
      content: b64encode(JSON.stringify(data)),
    };
    if (sha) payload.sha = sha;
    const res = await fetch(apiUrl(), {
      method: 'PUT', headers: headers(), body: JSON.stringify(payload),
    });
    if (res.status === 409 || res.status === 422) throw new Error('Konflikt beim Hochladen — bitte erneut synchronisieren');
    if (!res.ok) throw new Error('GitHub: HTTP ' + res.status);
    const body = await res.json();
    set(LS.sha, body.content.sha);
  }
  async function pullImport(remote) {
    await DB.importAll(remote.data, _config);
    set(LS.sha, remote.sha);
    set(LS.dirtyAt, ''); // lokaler Stand == Cloud-Stand
    if (_hooks.afterPull) await _hooks.afterPull();
  }

  // --- Kernablauf ---
  async function syncNow(reason) {
    if (_busy || !isConfigured()) return;
    _busy = true;
    status('Synchronisiere…', 'busy');
    try {
      const remote = await fetchRemote();
      const dirty = isDirty();
      if (!remote) {
        await push(null); // erste Initialisierung des Repos
      } else if (remote.sha === get(LS.sha)) {
        if (dirty) await push(remote.sha); // nur wir haben Neues
      } else if (!dirty) {
        await pullImport(remote); // nur die Cloud hat Neues
      } else {
        // beide Seiten geändert -> User entscheidet
        const useRemote = window.confirm(
          'Sync-Konflikt: Auf diesem Gerät UND in der Cloud gibt es Änderungen.\n\n' +
          'OK = Cloud-Stand übernehmen (lokale Änderungen verwerfen)\n' +
          'Abbrechen = lokalen Stand in die Cloud hochladen');
        if (useRemote) await pullImport(remote);
        else await push(remote.sha);
      }
      set(LS.lastAt, new Date().toISOString());
      status('Zuletzt synchronisiert: ' + new Date().toLocaleTimeString('de-DE',
        { hour: '2-digit', minute: '2-digit' }), 'ok');
    } catch (e) {
      console.warn('Sync:', e);
      status('Sync-Fehler: ' + e.message, 'error');
    }
    _busy = false;
  }

  // Nach jeder Datenänderung aufrufen: merkt vor und pusht (debounced).
  function markDirty() {
    set(LS.dirtyAt, new Date().toISOString());
    if (!isEnabled()) return;
    clearTimeout(_debounce);
    _debounce = setTimeout(() => syncNow('change'), DEBOUNCE_MS);
  }

  function startTimer() {
    stopTimer();
    if (isEnabled()) _timer = setInterval(() => syncNow('interval'), INTERVAL_MS);
  }
  function stopTimer() {
    if (_timer) { clearInterval(_timer); _timer = null; }
  }

  function configure(repo, token, enabled) {
    set(LS.repo, repo.trim());
    set(LS.token, token.trim());
    set(LS.enabled, enabled ? '1' : '');
    set(LS.sha, ''); // neue Quelle -> Remote-Stand neu ermitteln
    startTimer();
  }

  function init(config, hooks) {
    _config = config;
    _hooks = hooks || {};
  }

  return {
    init, configure, syncNow, markDirty, startTimer, stopTimer,
    isConfigured, isEnabled,
    getRepo: () => get(LS.repo),
    getToken: () => get(LS.token),
    lastSyncAt: () => get(LS.lastAt),
  };
})();

if (typeof module !== 'undefined') module.exports = Sync;
