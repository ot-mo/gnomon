// Where saves are kept (TECH_DESIGN §7.3). One adapter shape for every backend, so every save check runs
// headless in Node:
//
//   Adapter = { kind, get(store, key) → Promise<value | undefined>, put(store, value) → Promise, del(store, key) → Promise,
//               list(store, { slot } = {}) → Promise<[value]>, tx(fn) → Promise<fn's result>, writeNow(ops) → Promise }
//     stores: "slots" (key: the record's id) and "zones", "checkpointZones" (key: [slot, key], from the record's
//     slot and key fields), as IndexedDB's object stores with those key paths; and "meta" (key: id), the game's own
//     records beside the slots (save.js: the graveyard; screens/options.js: the view settings). put stores a copy (IndexedDB's
//     structured clone), get and list hand out copies, so nothing stored is ever a live object. list("zones",
//     { slot }) lists one slot's zones.
//     tx(fn): fn(t) gets an adapter of the same shape whose writes land together when fn's promise settles, and
//     not at all if it throws: the moment they land is the commit (write-behind waits for it before a zone may
//     leave memory). put, del outside a tx are a tx of their own. Reads inside a tx see its own writes. On
//     IndexedDB fn may await only t's own calls: anything else (a timer, compression) lets the transaction
//     commit under it, so the save does its compressing first and opens the tx after.
//     writeNow(ops): one transaction opened before it returns (the unload save: §7.3 "one transaction opened
//     right in the handler"), its ops in order:
//       { op: "put", store, value } · { op: "del", store, key } · { op: "clear", store, slot }   (a zone store's rows of one slot)
//       { op: "keep", key: [slot, zoneKey], epoch }   copy on write for a checkpoint (§7.5): the zone row stored
//                                     under that key moves a copy to checkpointZones when it was written before
//                                     checkpoint `epoch` (its cp field is lower) and no copy is kept there yet.
//                                     Put a keep before the put that overwrites the row.
//     → a promise that settles when the transaction commits (or rejects when it aborts).
//   memoryAdapter({ latency = 0, from = null } = {}) → Adapter & { dump(), stats }
//                                     Maps in memory: Node, and the browser where IndexedDB can't be opened.
//                                     latency (ms): every commit waits that long first (checks hold a write
//                                     open with it); dump() → the contents as JSON, which `from` takes back (a
//                                     fresh process loading a save)
//   idbAdapter(name = "<GAME_ID>-saves", { indexedDB } = {}) → Adapter & { ready, close() }
//                                     IndexedDB (database `name`, version 1: the three stores with the key paths
//                                     above, and an index "slot" on the two zone stores). The connection opens
//                                     at once; `ready` settles when it has (every call waits for it, but
//                                     writeNow, which needs it open already). Without IndexedDB every call
//                                     rejects, and so does `ready`
//   openSaves({ name, indexedDB } = {}) → Promise<{ store, persistent, reason }>
//                                     the store the title screen keeps saves in: IndexedDB if it opens (and it
//                                     becomes the current store), else the current memory store, and why
//   storageLeft() → Promise<bytes | null>   navigator.storage.estimate()'s quota − usage (null when unknown)
//   useStore(adapter) · currentStore() → adapter | null   the store saves go to (main.js sets the memory one)
import { GAME_ID } from "../config.js";

export const STORES = { slots: "id", zones: ["slot", "key"], checkpointZones: ["slot", "key"], meta: "id" };

const keyOf = (store, value) => {
  const path = STORES[store];
  if (!path) throw new Error(`store: no store ${store}`);
  return Array.isArray(path) ? path.map((k) => value[k]) : value[path];
};
const flat = (key) => (Array.isArray(key) ? key.map(String).join("\u0000") : String(key));
const copy = (v) => (v === undefined ? undefined : structuredClone(v));
// A copy-on-write op's decision, the same in both backends: the old row needs keeping.
const keepsOld = (old, epoch) => !!old && (old.cp ?? 0) < epoch;

export function memoryAdapter({ latency = 0, from = null } = {}) {
  const data = Object.fromEntries(Object.keys(STORES).map((s) => [s, new Map()]));
  if (from) for (const [s, rows] of Object.entries(from)) for (const v of rows) data[s].set(flat(keyOf(s, v)), copy(v));
  const stats = { commits: 0, puts: 0, dels: 0, byStore: { slots: 0, zones: 0, checkpointZones: 0, meta: 0 } };
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
  let last = Promise.resolve();   // the commit before: transactions land in the order they were opened, as IndexedDB's do
  const adapter = {
    kind: "memory",
    ...read(null),
    async tx(fn) {
      const staged = new Map();   // "store\u0001key" → { value } | { del: true }
      const t = {
        ...read(staged),
        async put(store, value) { staged.set(`${store}\u0001${flat(keyOf(store, value))}`, { value: copy(value) }); },
        async del(store, key) { staged.set(`${store}\u0001${flat(key)}`, { del: true }); },
        tx: (f) => f(t),
      };
      const before = last;
      let release;
      last = new Promise((r) => { release = r; });
      try {
        const result = await fn(t);
        if (latency) await new Promise((r) => setTimeout(r, latency));
        await before;
        for (const [sk, op] of staged) {
          const [store, k] = sk.split("\u0001");
          if (op.del) { data[store].delete(k); stats.dels++; } else { data[store].set(k, op.value); stats.puts++; stats.byStore[store]++; }
        }
        stats.commits++;
        return result;
      } finally { release(); }
    },
    put(store, value) { return adapter.tx((t) => t.put(store, value)); },
    del(store, key) { return adapter.tx((t) => t.del(store, key)); },
    // The same ops as IndexedDB's, staged before it returns: a put's value is copied now (as a structured clone
    // would be), and a keep reads the row as it stands when the transaction runs, before the put after it.
    writeNow(ops) {
      const rows = ops.map((o) => (o.op === "put" ? { ...o, value: copy(o.value) } : o));
      return adapter.tx(async (t) => {
        for (const o of rows) {
          if (o.op === "put") await t.put(o.store, o.value);
          else if (o.op === "del") await t.del(o.store, o.key);
          else if (o.op === "clear") { for (const r of await t.list(o.store, { slot: o.slot })) await t.del(o.store, [o.slot, r.key]); }
          else if (o.op === "keep") {
            const old = await t.get("zones", o.key);
            if (keepsOld(old, o.epoch) && !(await t.get("checkpointZones", o.key))) await t.put("checkpointZones", old);
          } else throw new Error(`writeNow: no op ${o.op}`);
        }
      });
    },
    dump: () => Object.fromEntries(Object.entries(data).map(([s, m]) => [s, [...m.values()].map(copy)])),
    stats,
  };
  return adapter;
}

// --- IndexedDB ---------------------------------------------------------------------------------------
const DB_VERSION = 1;
const settle = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

function openDb(idb, name) {
  return new Promise((resolve, reject) => {
    let req;
    try { req = idb.open(name, DB_VERSION); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [store, path] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(store)) continue;
        const os = db.createObjectStore(store, { keyPath: path });
        if (Array.isArray(path)) os.createIndex("slot", "slot");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error(`IndexedDB ${name} wouldn't open`));
    req.onblocked = () => reject(new Error(`IndexedDB ${name} is held open at an older version by another tab`));
  });
}

export function idbAdapter(name = `${GAME_ID}-saves`, { indexedDB: idb = globalThis.indexedDB } = {}) {
  let db = null;
  const ready = idb ? openDb(idb, name).then((d) => { db = d; d.onversionchange = () => { d.close(); db = null; }; return d; })
    : Promise.reject(new Error(`idbAdapter(${name}): this browser has no IndexedDB`));
  ready.catch(() => {});   // (every call reports it)
  const names = Object.keys(STORES);
  // A transaction's calls as promises (they resolve in the request's success event, so awaiting them keeps it alive).
  const view = (tr) => {
    const t = {
      get: (store, key) => settle(tr.objectStore(store).get(key)),
      list: (store, { slot } = {}) => {
        const os = tr.objectStore(store);
        if (slot === undefined) return settle(os.getAll());
        return Array.isArray(STORES[store]) ? settle(os.index("slot").getAll(slot)) : settle(os.getAll()).then((rows) => rows.filter((r) => r.slot === slot));
      },
      put: (store, value) => settle(tr.objectStore(store).put(value)).then(() => {}),
      del: (store, key) => settle(tr.objectStore(store).delete(key)).then(() => {}),
      tx: (f) => f(t),
    };
    return t;
  };
  const committed = (tr) => new Promise((resolve, reject) => {
    tr.oncomplete = () => resolve();
    tr.onabort = () => reject(tr.error || new Error("the save's transaction was aborted"));
  });
  const adapter = {
    kind: "indexeddb", name, ready,
    async tx(fn) {
      const d = db || await ready;
      const tr = d.transaction(names, "readwrite"), done = committed(tr);
      done.catch(() => {});
      let result;
      try { result = await fn(view(tr)); }
      catch (e) { try { tr.abort(); } catch { /* it had finished */ } throw e; }
      await done;
      return result;
    },
    async get(store, key) { const d = db || await ready; return view(d.transaction([store], "readonly")).get(store, key); },
    async list(store, opts) { const d = db || await ready; return view(d.transaction([store], "readonly")).list(store, opts); },
    put(store, value) { return adapter.tx((t) => t.put(store, value)); },
    del(store, key) { return adapter.tx((t) => t.del(store, key)); },
    writeNow(ops) {
      if (!db) return Promise.reject(new Error(`idbAdapter(${name}): not open yet`));
      let tr;
      try { tr = db.transaction(names, "readwrite"); } catch (e) { return Promise.reject(e); }
      const done = committed(tr);
      try {
        for (const o of ops) {
          if (o.op === "put") tr.objectStore(o.store).put(o.value);
          else if (o.op === "del") tr.objectStore(o.store).delete(o.key);
          // [slot] sorts before every [slot, "key"], and [slot, []] after them (an array sorts after a string).
          else if (o.op === "clear") tr.objectStore(o.store).delete(IDBKeyRange.bound([o.slot], [o.slot, []]));
          else if (o.op === "keep") {
            // Requests run in the order made: this read sees the row before the put that follows it.
            const zr = tr.objectStore("zones").get(o.key);
            zr.onsuccess = () => {
              if (!keepsOld(zr.result, o.epoch)) return;
              const cr = tr.objectStore("checkpointZones").get(o.key);
              cr.onsuccess = () => { if (!cr.result) tr.objectStore("checkpointZones").put(zr.result); };
            };
          } else throw new Error(`writeNow: no op ${o.op}`);
        }
      } catch (e) { try { tr.abort(); } catch { /* finished */ } done.catch(() => {}); return Promise.reject(e); }
      // Committed now, not when the task ends: a page that is going (the unload save) is torn down before that, and
      // its transaction with it. (A keep still has its read's requests to make, so that batch commits by itself.)
      if (!ops.some((o) => o.op === "keep")) tr.commit?.();
      return done;
    },
    close() { db?.close(); db = null; },
  };
  return adapter;
}

let current = null;
export function useStore(adapter) { current = adapter || null; return current; }
export const currentStore = () => current;

// The title screen's store: IndexedDB when it opens, kept for the page's life (opened once).
let opening = null;
export function openSaves({ name, indexedDB } = {}) {
  if (current?.kind === "indexeddb") return Promise.resolve({ store: current, persistent: true, reason: "" });
  if (!opening) {
    const a = idbAdapter(name, indexedDB === undefined ? {} : { indexedDB });
    opening = a.ready.then(() => ({ store: useStore(a), persistent: true, reason: "" }),
      (e) => { opening = null; return { store: current || useStore(memoryAdapter()), persistent: false, reason: e?.message || String(e) }; });
  }
  return opening;
}

export async function storageLeft() {
  try {
    const est = await globalThis.navigator?.storage?.estimate?.();
    return est && Number.isFinite(est.quota) && Number.isFinite(est.usage) ? est.quota - est.usage : null;
  } catch { return null; }
}
