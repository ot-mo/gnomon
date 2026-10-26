// Where saves are kept (TECH_DESIGN §7.3; P0 skeleton → WS9). One adapter shape for every backend, so every
// save check runs headless in Node:
//
//   Adapter = { get(store, key) → Promise<value | undefined>, put(store, value) → Promise, del(store, key) → Promise,
//               list(store, { slot } = {}) → Promise<[value]>, tx(fn) → Promise<fn's result> }
//     stores: "slots" (key: the record's id) and "zones", "checkpointZones" (key: [slot, key], from the record's
//     slot and key fields), as IndexedDB's object stores with those key paths. put stores a copy (IndexedDB's
//     structured clone), get and list hand out copies, so nothing stored is ever a live object. list("zones",
//     { slot }) lists one slot's zones.
//     tx(fn): fn(t) gets an adapter of the same shape whose writes land together when fn's promise settles, and
//     not at all if it throws: the moment they land is the commit (write-behind waits for it before a zone may
//     leave memory). put, del outside a tx are a tx of their own. Reads inside a tx see its own writes.
//   memoryAdapter({ latency = 0, from = null } = {}) → Adapter & { dump(), stats }
//                                     Maps in memory: Node, and the browser until WS9. latency (ms): every commit
//                                     waits that long first (checks hold a write open with it); dump() → the
//                                     contents as JSON, which `from` takes back (a fresh process loading a save)
//   idbAdapter(name = "<GAME_ID>-saves") → Adapter    WS9 builds it on IndexedDB (database name, stores and key
//                                     paths as above). P0: the frozen signature; every call rejects
//   useStore(adapter) · currentStore() → adapter | null   the store saves go to (main.js sets the memory one)
import { GAME_ID } from "../config.js";

export const STORES = { slots: "id", zones: ["slot", "key"], checkpointZones: ["slot", "key"] };

const keyOf = (store, value) => {
  const path = STORES[store];
  if (!path) throw new Error(`store: no store ${store}`);
  return Array.isArray(path) ? path.map((k) => value[k]) : value[path];
};
const flat = (key) => (Array.isArray(key) ? key.map(String).join("\u0000") : String(key));
const copy = (v) => (v === undefined ? undefined : structuredClone(v));

export function memoryAdapter({ latency = 0, from = null } = {}) {
  const data = Object.fromEntries(Object.keys(STORES).map((s) => [s, new Map()]));
  if (from) for (const [s, rows] of Object.entries(from)) for (const v of rows) data[s].set(flat(keyOf(s, v)), copy(v));
  const stats = { commits: 0, puts: 0, dels: 0 };
  const read = (staged) => ({
    async get(store, key) {
      const k = flat(key);
      if (staged?.has(`${store}\u0001${k}`)) return copy(staged.get(`${store}\u0001${k}`).value);
      return copy(data[store].get(k));
    },
    async list(store, { slot } = {}) {
      const rows = new Map(data[store]);
      for (const [sk, op] of staged || []) if (sk.startsWith(`${store}\u0001`)) { const k = sk.slice(store.length + 1); if (op.del) rows.delete(k); else rows.set(k, op.value); }
      return [...rows.values()].filter((v) => slot === undefined || v.slot === slot).map(copy);
    },
  });
  const adapter = {
    ...read(null),
    async tx(fn) {
      const staged = new Map();   // "store\u0001key" → { value } | { del: true }
      const t = {
        ...read(staged),
        async put(store, value) { staged.set(`${store}\u0001${flat(keyOf(store, value))}`, { value: copy(value) }); },
        async del(store, key) { staged.set(`${store}\u0001${flat(key)}`, { del: true }); },
        tx: (f) => f(t),
      };
      const result = await fn(t);
      if (latency) await new Promise((r) => setTimeout(r, latency));
      for (const [sk, op] of staged) {
        const [store, k] = sk.split("\u0001");
        if (op.del) { data[store].delete(k); stats.dels++; } else { data[store].set(k, op.value); stats.puts++; }
      }
      stats.commits++;
      return result;
    },
    put(store, value) { return adapter.tx((t) => t.put(store, value)); },
    del(store, key) { return adapter.tx((t) => t.del(store, key)); },
    dump: () => Object.fromEntries(Object.entries(data).map(([s, m]) => [s, [...m.values()].map(copy)])),
    stats,
  };
  return adapter;
}

// WS9: IndexedDB. The signature and the layout are fixed here; the body is WS9's.
export function idbAdapter(name = `${GAME_ID}-saves`) {
  const no = () => Promise.reject(new Error(`idbAdapter(${name}): IndexedDB saves come with WS9`));
  return { name, get: no, put: no, del: no, list: no, tx: no };
}

let current = null;
export function useStore(adapter) { current = adapter || null; return current; }
export const currentStore = () => current;
