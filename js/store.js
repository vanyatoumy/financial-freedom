// Persistence: the whole state is one JSON document kept in IndexedDB.
import { defaultState, DEFAULT_JARS, DEFAULT_WALLETS, DEFAULT_CATEGORIES } from './defaults.js';
import { ICON_NAMES } from './icons.js';

const DB_NAME = 'six-comptes'; // internal storage name, kept so saved data is never lost
const STORE = 'kv';
const KEY = 'state';

export let state = defaultState();
const listeners = new Set();

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export async function load() {
  try {
    const saved = await idb('readonly', s => s.get(KEY));
    if (saved) state = migrate({ ...defaultState(), ...saved });
  } catch (e) {
    console.error('Lecture impossible', e);
  }
  try { await navigator.storage?.persist?.(); } catch {}
  return state;
}

// v1 stored emoji icons: switch known items to the SVG icon names, unknown ones to 'tag'.
function migrate(s) {
  if ((s.version || 1) >= 3) return s;
  if ((s.version || 1) === 2) {
    for (const w of s.wallets) {
      const d = DEFAULT_WALLETS.find(x => x.id === w.id);
      if (d?.fees) Object.assign(w, { fees: d.fees, allowTo: d.allowTo, allowFrom: d.allowFrom });
    }
    s.version = 3;
    return s;
  }
  const fix = (list, defs) => list.forEach(x => {
    const d = defs.find(y => y.id === x.id);
    if (d) { x.icon = d.icon; if (d.color && !x.color) x.color = d.color; }
    else if (!ICON_NAMES.includes(x.icon)) x.icon = 'tag';
  });
  fix(s.jars, DEFAULT_JARS); fix(s.wallets, DEFAULT_WALLETS); fix(s.categories, DEFAULT_CATEGORIES);
  s.favorites.forEach(f => { f.label = f.label.replace(/^\S+\s/, ''); });
  s.version = 2;
  return migrate(s);
}

export async function save() {
  await idb('readwrite', s => s.put(state, KEY));
  listeners.forEach(fn => fn(state));
}

export function replaceState(next) {
  state = migrate({ ...defaultState(), ...next });
  return save();
}

export function onChange(fn) { listeners.add(fn); }

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
