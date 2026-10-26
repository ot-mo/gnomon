// Saving and loading a run (TECH_DESIGN §7.3, §7.4, §1.4 "save (WS9)"; P0 skeleton → WS9).
//
//   saveGame(game, { reason = "manual", store, slotId } = {}) → Promise<{ id, updated, zones, reason }>
//       The slot record and every visited zone without a committed record (the one you are in, always). Snapshot
//       first: the slot's JSON and the zones' snapshots are made before saveGame returns (codec.js snapshotSlot,
//       snapshotZone), and compression and the store come after and never read a live object, so play goes on
//       while it is written. Only in a saveable screen (screens.js `saveable`: explore and map) with no zone
//       being read: a request anywhere else waits for the first frame in one (its promise settles then). The
//       first save of a run makes its slot (slotId, else a new id) in `store` (default: currentStore(), or a
//       new memory store).
//   loadGame(slotId, { game, store } = {}) → Promise<game>
//       §7.3 "Loading": the world compiled (game.world), restoreRun(slot.run), never buildRun; state, player and
//       the id counter (before any zone); then changeZone(where, { how: "load" }) reads the zone you were in
//       and puts you back exactly as you were, and setMode(game, playMode(game)) starts the mode stack afresh
//       (in 3D the pause card on top: a click takes the pointer); until then the title screen covers the wait,
//       from wherever it was called. Every other visited zone stays in the store
//       until it is entered or prefetched (zones.js ZONE_LOADER, readZone).
//   listSlots({ store } = {}) → Promise<[{ id, created, updated, seed, mode, character, where, time }]>  newest first
//   deleteSlot(id, { store } = {}) → Promise<bool>     the slot and its zones
//   checkpoint(game) → Promise<null>                   P0 stub (commonsLamp's checkpoints, §7.5: WS9)
//   canSave(game) → bool                               a save would happen now (not wait)
//   whenWritten(game) → Promise                        every write begun so far has committed (or failed)
//   saveStatus(game) → { slotId, committed: [keys], pending: [keys], failed: [messages] } | null
//   SAVE_STATS = { saves, loads, zoneWrites }
//
// Write-behind (§7.3): once a run has a slot (saved once, or loaded), leaving a zone (zone:leave, after every
// other handler) snapshots its record there and then; it is compressed and written behind. The zone stays in
// memory, and may leave it (zones.js evictDormant: beyond ZONE_RULES.keepDormant dormant zones) only once
// that write has committed: ZONE_LOADER.canEvict says no while it is pending. Writes go to the store one
// after another, in the order they were snapshotted, so an older record never lands over a newer one.
// Periodic saves (every 120 s of play, on a completed zone change) and the unload save are WS9's.
//
// game.saving (runtime, reset by every new run): { slotId, created, store, committed: Set<key>, pending:
// Map<key, n>, stored: Map<key, savedAt>, queue: Promise, failed: [] }.
import { GAME_ID, VERSION } from "../config.js";
import { game as theGame, resumeRun } from "../game.js";
import { screenFor, setMode, pushMode } from "../screens.js";
import { playMode } from "../screens/play.js";
import { on, registerUpdate } from "../events.js";
import { changeZone, ZONE_LOADER, evictDormant, zoneState } from "../zones.js";
import { restoreRun } from "../world/run.js";
import { setIds } from "../ids.js";
import { snapshotZone, finishZone, snapshotSlot, decodeZone, decodePlayer } from "./codec.js";
import { currentStore, useStore, memoryAdapter } from "./store.js";

export const SAVE_STATS = { saves: 0, loads: 0, zoneWrites: 0 };

const storeFor = (store) => store || currentStore() || useStore(memoryAdapter());
let slotSeq = 0;
const newSlotId = (game) => `${GAME_ID}-${game.seed}-${Date.now().toString(36)}${(slotSeq++).toString(36)}`;
function newSaving(slotId, created, store) {
  return { slotId, created, store, committed: new Set(), pending: new Map(), stored: new Map(), queue: Promise.resolve(), failed: [] };
}
function savingFor(game, store, slotId) {
  const sv = game.saving;
  if (sv && sv.store === store && (!slotId || sv.slotId === slotId)) return sv;
  return (game.saving = newSaving(slotId || newSlotId(game), Date.now(), store));
}

const pend = (sv, key, savedAt) => { sv.pending.set(key, (sv.pending.get(key) || 0) + 1); sv.stored.set(key, savedAt); };
function unpend(sv, key) {
  const n = (sv.pending.get(key) || 0) - 1;
  if (n > 0) sv.pending.set(key, n); else sv.pending.delete(key);
}
function committed(game, sv, key) {
  unpend(sv, key);
  sv.committed.add(key);
  SAVE_STATS.zoneWrites++;
}
function failed(game, sv, what, e) {
  sv.failed.push(`${what}: ${e?.message || e}`);
  console.error(`save: ${what} failed:`, e);
}
// A write in the slot's queue: `work` runs once every earlier write has settled.
function enqueue(sv, work) {
  const done = sv.queue.then(work);
  sv.queue = done.catch(() => {});
  return done;
}
// After writes commit, dormant zones beyond the limit may leave memory (only this run's).
const trim = (game, sv) => { if (game.saving === sv) evictDormant(game); };

// Zones you have been in (the one you are in, and every one you have left), not the neighbours made ahead.
const visited = (game, zone) => zone === game.zone || zoneState(game).zoneLeft[zone.key] !== undefined;

export const canSave = (game) => !!(game.state && game.player && game.zone && !game.zoneLoading && screenFor(game.mode)?.saveable);

const waiting = [];   // [{ game, opts, resolve, reject }]: requests made outside a saveable screen
export function saveGame(game, opts = {}) {
  if (!canSave(game)) return new Promise((resolve, reject) => waiting.push({ game, opts, resolve, reject }));
  try { return writeSave(game, opts); } catch (e) { return Promise.reject(e); }
}
registerUpdate("save:waiting", (game) => {
  if (!waiting.length || !canSave(game)) return;
  for (const w of waiting.splice(0)) {
    if (w.game !== game) { waiting.push(w); continue; }
    try { writeSave(game, w.opts).then(w.resolve, w.reject); } catch (e) { w.reject(e); }
  }
}, { modes: ["*"] });

function writeSave(game, { reason = "manual", store, slotId } = {}) {
  const st = storeFor(store), sv = savingFor(game, st, slotId), now = Date.now();
  // The snapshot: everything live is read in these lines, and nothing after them.
  const zones = [...game.zones.values()].filter((z) => visited(game, z) && (z === game.zone || (!sv.committed.has(z.key) && !sv.pending.has(z.key))));
  const snaps = zones.map((z) => snapshotZone(z, { slot: sv.slotId, savedAt: now }));
  for (const s of snaps) pend(sv, s.key, now);
  let slotSnap;
  try {
    slotSnap = snapshotSlot(game, { id: sv.slotId, created: sv.created, updated: now, zones: [...sv.stored].map(([key, savedAt]) => ({ key, savedAt })) });
  } catch (e) { for (const s of snaps) unpend(sv, s.key); throw e; }
  return enqueue(sv, async () => {
    const records = [];
    for (const s of snaps) records.push(await finishZone(s));
    const slot = JSON.parse(slotSnap.json);
    await st.tx(async (t) => {
      for (const r of records) await t.put("zones", r);
      await t.put("slots", slot);
    });
    return slot;
  }).then((slot) => {
    for (const s of snaps) committed(game, sv, s.key);
    SAVE_STATS.saves++;
    trim(game, sv);
    return { id: slot.id, updated: slot.updated, zones: slot.zones.length, reason };
  }, (e) => {
    for (const s of snaps) unpend(sv, s.key);
    failed(game, sv, `saving slot ${sv.slotId}`, e);
    throw e;
  });
}

// Write-behind: the zone you leave, after every other zone:leave handler (the clock catches up first).
export function writeZone(game, zone) {
  const sv = game.saving;
  if (!sv) return null;
  let snap;
  const savedAt = Date.now();
  try { snap = snapshotZone(zone, { slot: sv.slotId, savedAt }); } catch (e) { failed(game, sv, `snapshotting ${zone.key}`, e); return null; }
  pend(sv, zone.key, savedAt);
  return enqueue(sv, async () => { await sv.store.put("zones", await finishZone(snap)); })
    .then(() => { committed(game, sv, zone.key); trim(game, sv); },
          (e) => { unpend(sv, zone.key); failed(game, sv, `writing ${zone.key}`, e); });
}
on("zone:leave", (game, { zone }) => { writeZone(game, zone); }, { priority: -100 });

// --- Reading back -----------------------------------------------------------------------------------------
ZONE_LOADER.has = (game, key) => !!game.saving?.committed.has(key);
ZONE_LOADER.load = async (game, key) => {
  const sv = game.saving;
  if (!sv) return null;
  const rec = await sv.store.get("zones", [sv.slotId, key]);
  return rec ? decodeZone(rec) : null;
};
ZONE_LOADER.canEvict = (game, key) => { const sv = game.saving; return !!sv && sv.committed.has(key) && !sv.pending.has(key); };

function checkSlot(slot, slotId) {
  if (!slot) throw new Error(`loadGame: no slot ${slotId}`);
  if (slot.game !== GAME_ID) throw new Error(`loadGame: ${slotId} is a save of ${slot.game}, not ${GAME_ID}`);
  if (slot.version !== VERSION.save) throw new Error(`loadGame: ${slotId} has save version ${slot.version}; this game reads ${VERSION.save} (no migration yet, §7.6)`);
  if (slot.worldVersion !== VERSION.world) throw new Error(`loadGame: ${slotId} was made on map version ${slot.worldVersion}, the map is version ${VERSION.world} now (§7.6)`);
}

export async function loadGame(slotId, { game = theGame, store } = {}) {
  const st = storeFor(store);
  const slot = await st.get("slots", slotId);
  checkSlot(slot, slotId);
  const zones = await st.list("zones", { slot: slotId });
  const where = slot.where?.zoneKey;
  if (!zones.some((r) => r.key === where)) throw new Error(`loadGame: ${slotId} holds no record of ${where}, the zone you were in`);
  const run = restoreRun(slot.run, game.world);
  // Until the zone is read the title screen covers the wait (frames go on, and there is no zone to draw).
  if (game.mode !== "title") setMode(game, "title", null, { pointer: false });
  resumeRun(game,{ seed: slot.seed, run, state: slot.state, player: decodePlayer(slot.player), view: slot.where.view });
  setIds(slot.ids);   // before any zone is read (§7.4)
  const sv = game.saving = newSaving(slotId, slot.created, st);
  for (const r of zones) { sv.committed.add(r.key); sv.stored.set(r.key, r.savedAt); }
  const p = game.player;
  const entered = await changeZone(game, where, { how: "load", at: { x: p.x, y: p.y, z: p.z, yaw: p.yaw }, keepFacing: true, keepMotion: true });
  if (!entered) throw new Error(`loadGame: couldn't read ${where} back`);
  setMode(game, playMode(game), null, { pointer: false });
  if (game.view !== "map") pushMode(game, "pause", null, { pointer: false });
  SAVE_STATS.loads++;
  return game;
}

export async function listSlots({ store } = {}) {
  const st = store || currentStore();
  if (!st) return [];
  return (await st.list("slots"))
    .map((s) => ({ id: s.id, created: s.created, updated: s.updated, seed: s.seed, mode: s.mode, character: s.character, where: s.where, time: s.time }))
    .sort((a, b) => b.updated - a.updated);
}

export async function deleteSlot(id, { store } = {}) {
  const st = store || currentStore();
  if (!st || !(await st.get("slots", id))) return false;
  await st.tx(async (t) => {
    for (const name of ["zones", "checkpointZones"]) for (const r of await t.list(name, { slot: id })) await t.del(name, [id, r.key]);
    await t.del("slots", id);
  });
  return true;
}

// commonsLamp's checkpoint on entering or leaving a settlement (§7.5, copy on write): WS9.
export function checkpoint(game) { void game; return Promise.resolve(null); }

export const whenWritten = (game) => game.saving?.queue ?? Promise.resolve();
export function saveStatus(game) {
  const sv = game.saving;
  return sv ? { slotId: sv.slotId, committed: [...sv.committed], pending: [...sv.pending.keys()], failed: [...sv.failed] } : null;
}
