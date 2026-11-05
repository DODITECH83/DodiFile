'use strict';
/* DodiFile – archivio locale (IndexedDB), preferenze (localStorage) e backup. Nessun dato esce dal dispositivo. */

const dbp = new Promise((res, rej) => {
  const r = indexedDB.open('dodifile', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('docs', { keyPath: 'id', autoIncrement: true });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function store(mode, fn) {
  const db = await dbp;
  return new Promise((res, rej) => {
    const t = db.transaction('docs', mode);
    const rq = fn(t.objectStore('docs'));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
  });
}
const dbAll = () => store('readonly', s => s.getAll());
const dbPut = d => store('readwrite', s => s.put(d));
const dbDel = id => store('readwrite', s => s.delete(id));
const dbClear = () => store('readwrite', s => s.clear());

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const normDoc = d => ({ done: false, fav: false, repeat: 'none', amount: null, docDate: null, history: [], uid: uid(), ...d });
const buildSearch = d => norm(`${d.title} ${CATS[d.cat]?.label || ''} ${d.note || ''} ${d.text || ''}`);

/* ---------- Preferenze ---------- */
const DEFAULTS = {
  name: '', scale: 1, theme: 'auto', accent: 'ocean', contrast: false, calm: false, density: 'comfy',
  lockOn: false, bioOn: false, lockTimeout: 30, privacy: false,
  remDays: [7, 1, 0], remHour: 9, notifyOpen: true,
  ocrLang: 'ita', ocrEnhance: true, autoDue: true, cropAsk: true, haptics: true, engineReady: '',
  sort: 'recent', backupNag: true, lastBackup: 0, onboarded: false
};
const prefs = {
  data: { ...DEFAULTS },
  load() {
    try { Object.assign(this.data, JSON.parse(localStorage.getItem('dodifile.prefs') || '{}')); } catch { /* prima volta */ }
    return this;
  },
  get(k) { return this.data[k]; },
  set(k, v) {
    this.data[k] = v;
    try { localStorage.setItem('dodifile.prefs', JSON.stringify(this.data)); } catch { /* modalità privata */ }
    applyPrefs();
  }
};
prefs.load();

const ACCENTS = {
  ocean: { label: 'Oceano', c: '#2563EB' }, emerald: { label: 'Smeraldo', c: '#047857' },
  sunset: { label: 'Tramonto', c: '#C2410C' }, violet: { label: 'Viola', c: '#6D28D9' }, rose: { label: 'Rosa', c: '#BE123C' }
};

function applyPrefs() {
  const r = document.documentElement, p = prefs.data;
  r.style.fontSize = (112.5 * p.scale) + '%';
  r.dataset.theme = p.theme;
  r.dataset.accent = p.accent;
  r.dataset.contrast = p.contrast ? 'high' : 'normal';
  r.dataset.calm = p.calm ? 'on' : 'off';
  r.dataset.density = p.density;
  document.body && document.body.classList.toggle('privacy', !!p.privacy);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = ACCENTS[p.accent]?.c || '#2563EB';
}

/* ---------- Spazio e archivio protetto ---------- */
async function storageInfo() {
  const out = { used: 0, quota: 0, persisted: false };
  try {
    const e = await navigator.storage?.estimate?.();
    out.used = e?.usage || 0; out.quota = e?.quota || 0;
    out.persisted = (await navigator.storage?.persisted?.()) || false;
  } catch { /* non supportato */ }
  return out;
}
const requestPersist = () => navigator.storage?.persist?.().catch(() => false);

/* ---------- Backup ---------- */
const blobToDataURL = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
const dataURLToBlob = u => fetch(u).then(r => r.blob());

async function makeBackup(list) {
  const items = [];
  for (const d of list) items.push({ ...d, blob: d.blob ? await blobToDataURL(d.blob) : null });
  return new Blob([JSON.stringify({ app: 'DodiFile', version: 2, exported: new Date().toISOString(), docs: items })], { type: 'application/json' });
}
/** Importa un backup senza duplicare i documenti già presenti (confronto per uid). Restituisce quanti ne ha aggiunti. */
async function restoreBackup(file, existing) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'DodiFile' || !Array.isArray(data.docs)) throw new Error('File non valido');
  const have = new Set(existing.map(d => d.uid));
  let added = 0;
  for (const raw of data.docs) {
    const d = normDoc(raw);
    if (have.has(d.uid)) continue;
    delete d.id;
    d.blob = raw.blob ? await dataURLToBlob(raw.blob) : null;
    await dbPut(d); added++;
  }
  return added;
}
