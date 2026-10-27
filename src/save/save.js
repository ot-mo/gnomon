// Saving and loading a run (TECH_DESIGN §7.3-§7.6, §1.4 "save (WS9)").
//
//   saveGame(game, { reason = "manual", store, slotId, clean = false } = {}) → Promise<{ id, updated, zones, reason }>
//       The slot record and every visited zone without a committed record (the one you are in, always). Snapshot
//       first: the slot's JSON and the zones' snapshots are made before saveGame returns (codec.js snapshotSlot,
//       snapshotZone), and compression and the store come after and never read a live object, so play goes on
//       while it is written. Only in a saveable screen (screens.js `saveable`: explore and map), or under screens a
//       save looks through (canSave, SAVE_THROUGH: the pause card, options, the log, the inventory), with no zone
//       being read: a request anywhere else waits for the first frame in one (its promise settles then; it is
//       refused if by then that run has ended: a new run, a load, a death). The first save of a run makes its
//       slot (slotId, else a new id) in `store` (default: currentStore(), else a memory store of this module's
//       own). A save to another slot or store than the run's copies the old slot's records over, so the new
//       slot has every visited zone (and, with a checkpoint up, the checkpoint's copies too). clean: the save
//       of a session that ends here (save and quit): the slot's `live` is cleared (§7.5).
//   loadGame(slotId, { game, store, version, migrations } = {}) → Promise<game>
//       §7.3 "Loading": the record migrated up to `version` (VERSION.save) by `migrations` (MIGRATIONS, §7.6), the
//       world chosen by state.world.id (registerWorld; the test world and the real one), restoreRun(slot.run),
//       never buildRun; state, player and the id counter (before any zone: the slot's, or a zone record's when
//       that is higher); then changeZone(where, { how: "load" }) reads the zone you were in and puts you back
//       exactly as you were, and setMode(game, playMode(game)) starts the mode stack afresh (in 3D the pause card
//       on top: a click takes the pointer); until then the title screen covers the wait, from wherever it was
//       called. Every other visited zone stays in the store until it is entered or prefetched (zones.js
//       ZONE_LOADER, readZone; each record migrated as it is read). A slot whose `live` is still set was left
//       without a clean save: its `unclean` count goes up (and is written back at once, with this session's
//       live); under One Wick with SAVE_RULES.oneWick.unclean = "death" that is a death instead (the slot goes,
//       a grave is written, and the load is refused with error.code "unclean").
//   listSlots({ store } = {}) → Promise<[{ id, created, updated, seed, mode, character, where, time, unclean, live,
//                                         checkpoint, genVersion, version }]>   newest first
//   deleteSlot(id, { store } = {}) → Promise<bool>     the slot, its zones and its checkpoint's copies
//   checkpoint(game) → Promise<{ id, n } | null>       a checkpoint now (§7.5, copy on write; below); null when the
//                                                      run's mode has none
//   endRun(game, { cause }) → Promise                  a death: One Wick's slot goes (and a grave record is written);
//                                                      a checkpoint mode's slot goes back to its last checkpoint
//   wakeAtCheckpoint(game) → Promise<game>             after endRun in a checkpoint mode: load what it restored
//   restoreCheckpoint(slotId, { store }) → Promise<SlotRecord | null>   the checkpoint written back in the store
//   unloadSave(game) → Promise | null                  the page is going (§7.3 "Unload"): everything not yet
//                                                      written, then the slot (live cleared) and the zone you are in
//                                                      uncompressed, in one transaction opened before it returns
//   pageShown(game)                                    the page is back: a save soon sets live again
//   listenPage(doc, win, game = the game) → unlisten  visibilitychange (hidden → unloadSave, visible →
//                                                      pageShown) and pagehide; save/index.js calls it in a browser
//   exportSlot(id, { store }) → Promise<SaveFile> · importSlot(file, { store }) → Promise<id>   (§7.3 "Export / import")
//       SaveFile = { kind: "gnomon-save", game, version, exported, slot, zones, checkpointZones }; an id the store
//       already has gets a new one.
//   moveSlot(game, store) → Promise<bool>              the run's whole slot copied into `store`, which it saves to
//                                                      from then on (the title moving a game from memory to IndexedDB)
//   graveyard({ store }) → Promise<[{ name, seed, mode, level, cause, where, time, unclean, at }]>   newest last: the store's
//                                                      meta record "graveyard" (the last SAVE_RULES.graveyard), not localStorage,
//                                                      which only audio.js touches (check-config)
//   migrate(slot, zones, { to, migrations }) → { slot, zones }   MIGRATIONS[n] = { slot(rec), zone(rec) } takes n → n + 1
//   registerWorld(id, def | () => def | Promise<def>)  the worlds a load can choose by state.world.id
//   requestSave(game, reason, { delay, checkpoint }) the automatic saves' request (below), for other modules
//   canSave(game) → bool (a saveable screen, or one under SAVE_THROUGH's) · whenWritten(game) → Promise · saveStatus(game) ·
//   SAVE_STATS · SAVE_RULES · RUN_MODES · SESSION · SAVE_THROUGH
//
// Run modes (DECISIONS §1, bible §10.1): state.mode is "oneWick" (one life: death ends the run and its slot),
// "commonsLamp" (a checkpoint whenever you enter or leave a settlement, landing or village, and on the run's first
// save; you wake at the last one) or "pilgrim" (its XP rules are the progression's; it wakes at checkpoints like
// the Commons Lamp, as the bible names no death rule for it). A run without a mode is One Wick.
//
// Automatic saves (§7.3), once the run has a slot or a store is in use (useStore: main.js sets one; Node checks
// only when they do), while SAVE_RULES.auto: SAVE_RULES.afterChange real seconds after a zone change completes
// (zone:enter, not a load: off the swap's own frame; under a checkpoint mode a settlement's makes a checkpoint
// instead), every SAVE_RULES.every seconds of play in explore and map, every SAVE_RULES.travelEvery real seconds
// of the world map ("world", WS1), and soon after the page comes back. Each waits for a saveable screen.
//
// The writes (§7.3, §7.5): every save, write-behind and death is a job of rows snapshotted at once, and the jobs
// go to the store one after another, in the order they were made, so an older record never lands over a newer
// one; the unload save writes every job not yet begun, then its own rows, in its one transaction (and those
// jobs then stand down). Write-behind: once a run has a slot, leaving a zone (zone:leave, after every other
// handler) snapshots its record then and there; the zone stays in memory, and may leave it (zones.js
// evictDormant) only once that write has committed (ZONE_LOADER.canEvict).
// Checkpoints (§7.5, copy on write): a checkpoint is a save whose slot record is also kept as slot.checkpoint
// (with its number n), whose zone rows are written as of before it (cp n − 1), and which drops the last
// checkpoint's copies. After it every zone row is written with cp n, and the first time a row written before it
// is overwritten, the old row moves to checkpointZones first (the store's "keep" op). Restoring writes those
// copies back, deletes the rows first written after the checkpoint (cp n, no copy), and puts the checkpoint's slot
// record back. A settlement visit costs one slot record and the zones not yet written, never a copy of every zone.
//
// game.saving (runtime, reset by every new run): { slotId, created, store, committed: Set<key>, pending: Map<key, n>,
// stored: Map<key, savedAt>, queue: Promise, jobs: [job not yet written], failed: [], cp, cpRecord, unclean, dead,
// live, last: { reason, at, ok } }.
import { GAME_ID, VERSION } from "../config.js";
import { game as theGame, resumeRun } from "../game.js";
import { screenFor, setMode, pushMode, syncStack } from "../screens.js";
import { playMode } from "../screens/play.js";
import { on, registerUpdate } from "../events.js";
import { changeZone, ZONE_LOADER, evictDormant, zoneState, parseKey } from "../zones.js";
import { restoreRun } from "../world/run.js";
import { setIds } from "../ids.js";
import { TEST_WORLD } from "../content/world/test-world.js";
import { snapshotZone, finishZone, finishZoneNow, snapshotSlot, decodeZone, decodePlayer } from "./codec.js";
import { currentStore, memoryAdapter } from "./store.js";

export const SAVE_STATS = { saves: 0, loads: 0, zoneWrites: 0, unloads: 0, checkpoints: 0, restores: 0 };
export const SAVE_RULES = {
  auto: true,          // the automatic saves below
  afterChange: 0.5,    // real seconds after a completed zone change
  every: 120,          // seconds of play in explore and map
  travelEvery: 10,     // real seconds of world-map travel
  oneWick: { unclean: "warn" },   // "warn" | "death": a One Wick slot loaded after a session that never saved cleanly
  graveyard: 50,       // grave records kept
  retry: 10,           // real seconds after a failed write before the save is tried again
  told: 30,            // real seconds between two log lines telling of failed saves
};
export const RUN_MODES = {
  oneWick: { name: "One Wick", note: "one life: death ends the run, and its save", death: "end" },
  commonsLamp: { name: "Commons Lamp", note: "a checkpoint whenever you enter or leave a settlement; you wake at the last one", death: "checkpoint" },
  pilgrim: { name: "Pilgrim", note: "friendlier factions, no XP for kills; you wake at the last settlement", death: "checkpoint" },
};
export const modeOf = (game) => (RUN_MODES[game.state?.mode] ? game.state.mode : "oneWick");
const checkpoints = (game) => RUN_MODES[modeOf(game)].death === "checkpoint";

// This page's (or process's) session: a slot it plays holds it in `live` until a clean save.
export const SESSION = globalThis.crypto?.randomUUID?.() ?? `s${Date.now().toString(36)}${Math.floor(performance.now() * 1000).toString(36)}`;

// --- Worlds a load can choose (state.world.id) ---------------------------------------------------------
const WORLDS = new Map([[TEST_WORLD.world.id, () => TEST_WORLD],
  ["gnomon", async () => (await import("../content/world/worldmap.js")).REAL_WORLD]]);   // (loaded by content/index.js)
export function registerWorld(id, def) { WORLDS.set(id, typeof def === "function" ? def : () => def); }
async function worldFor(id) {
  const get = WORLDS.get(id);
  if (!get) throw new Error(`loadGame: the save is of world "${id}", which this game doesn't have`);
  return get();
}

// --- Migrations (§7.6) --------------------------------------------------------------------------------
// MIGRATIONS[n] = { slot(record) → record, zone(record) → record }: a record of save version n to n + 1. A zone
// record carries its version in v (none: 1).
export const MIGRATIONS = {};
export function migrate(slot, zones = [], { to = VERSION.save, migrations = MIGRATIONS } = {}) {
  const from = slot.version;
  if (!Number.isInteger(from)) throw new Error(`loadGame: ${slot.id} has no save version`);
  if (from > to) throw new Error(`loadGame: ${slot.id} has save version ${from}; this game reads ${to} (a newer game made it)`);
  let s = slot;
  for (let n = from; n < to; n++) {
    if (!migrations[n]?.slot) throw new Error(`loadGame: ${slot.id} has save version ${from}, and there is no migration from ${n} to ${n + 1} (§7.6)`);
    s = { ...migrations[n].slot(s), version: n + 1 };
  }
  return { slot: s, zones: zones.map((r) => migrateZone(r, to, migrations)) };
}
function migrateZone(rec, to = VERSION.save, migrations = MIGRATIONS) {
  let r = rec;
  for (let n = r.v ?? 1; n < to; n++) {
    if (!migrations[n]) throw new Error(`loadGame: zone ${rec.key} has save version ${n}, and there is no migration from it`);
    r = { ...(migrations[n].zone ? migrations[n].zone(r) : r), v: n + 1 };
  }
  return r;
}

// --- The slot this run saves to ------------------------------------------------------------------------
let fallback = null;
const storeFor = (store) => store || currentStore() || (fallback ||= memoryAdapter());
let slotSeq = 0;
const newSlotId = (game) => `${GAME_ID}-${game.seed}-${Date.now().toString(36)}${(slotSeq++).toString(36)}`;
function newSaving(slotId, created, store, { cp = 0, cpRecord = null, unclean = 0 } = {}) {
  return { slotId, created, store, committed: new Set(), pending: new Map(), stored: new Map(), queue: Promise.resolve(), jobs: [],
           failed: [], cp, cpRecord, unclean, dead: false, live: SESSION, last: null, held: [] };
}
function savingFor(game, store, slotId) {
  const sv = game.saving;
  if (sv && sv.store === store && (!slotId || sv.slotId === slotId)) return sv;
  // A new slot (or store) for this run carries its checkpoint and its unclean count.
  const id = slotId || newSlotId(game);
  game.saving = newSaving(id, Date.now(), store, sv ? { cp: sv.cp, cpRecord: sv.cpRecord && { ...sv.cpRecord, id }, unclean: sv.unclean } : {});
  game.saving.fresh = true;   // (its first write clears the slot: an id given may be another run's)
  return game.saving;
}

const pend = (sv, key, savedAt) => { sv.pending.set(key, (sv.pending.get(key) || 0) + 1); sv.stored.set(key, savedAt); };
function unpend(sv, key) {
  const n = (sv.pending.get(key) || 0) - 1;
  if (n > 0) sv.pending.set(key, n); else sv.pending.delete(key);
}
// A failure is told to the player too (in the log, once in SAVE_RULES.told seconds): what happened since the last save
// would be lost if the page closed now.
function failed(game, sv, what, e) {
  sv.failed.push(`${what}: ${e?.message || e}`);
  console.error(`save: ${what} failed:`, e);
  const now = game.uiTime || 0;
  if (game.saving !== sv || sv.dead || typeof game.log !== "function" || now - (sv.toldAt ?? -Infinity) < SAVE_RULES.told) return;
  sv.toldAt = now;
  const why = String(e?.message || e || "").replace(/.$/, "").slice(0, 80);
  game.log(`The game couldn't be saved${why ? ` (${why})` : ""}. It will try again; if the page closes first, what happened since the last save is lost.`, [255, 150, 100]);
}
// After writes commit, dormant zones beyond the limit may leave memory (only this run's).
const trim = (game, sv) => { if (game.saving === sv) evictDormant(game); };

// Zones you have been in (the one you are in, and every one you have left), not the neighbours made ahead.
const visited = (game, zone) => zone === game.zone || zoneState(game).zoneLeft[zone.key] !== undefined;

// Where a save may be made: a saveable screen (screens.js `saveable`: explore, map, the world map), or one under
// screens a save may look through, as if they were closed: they hold nothing it would lose (no callback in their
// stack data, nothing half done). The pause card, the options, the message log and the inventory (its actions
// happen at once) are; a screen says so itself with `saveThrough: true`. Not the story's pages, talk, trade, the
// level-up choice or the "DEPTH n" beat: they hold what comes next.
export const SAVE_THROUGH = new Set(["pause", "options", "log", "inventory"]);
const holdsCallback = (data) => !!data && typeof data === "object" && Object.values(data).some((v) => typeof v === "function");
function playUnder(game) {
  const st = syncStack(game);
  for (let k = st.length - 1; k >= 0; k--) {
    const def = screenFor(st[k].mode);
    if (def?.saveable) return true;
    if (!(SAVE_THROUGH.has(st[k].mode) || def?.saveThrough) || holdsCallback(st[k].data)) return false;
  }
  return false;
}
export const canSave = (game) => !!(game.state && game.player && game.zone && !game.zoneLoading && playUnder(game));

// --- Jobs: rows snapshotted now, written in order ------------------------------------------------------
// job = { rows: [{ zone: key, snap, cp, keep } | { slot: json } | { carry: { store, slot, key } } | { op }], run?: async (store) → void,
//         checkpoint?: n, issued, absorbed: Promise | null }. rows are made into the store's ops when the job's turn
// comes (zones compressed first); `run` jobs (a restore, which must read first) do their own transaction.
// A row keeps the stored one first (copy on write) only on its key's first write since the checkpoint: sv.kept holds
// the keys that had theirs (or have a copy already, or were first written after it), so a later write has nothing to
// read before it writes (and the unload save's transaction can commit at once).
function zoneRow(sv, zone, savedAt, { cp = sv.cp, keep = sv.cp > 0 && !sv.kept?.has(zone.key), copy = false } = {}) {
  const row = { zone: zone.key, snap: snapshotZone(zone, { slot: sv.slotId, savedAt, cp }), cp, keep, copy, savedAt };
  if (keep || copy) (sv.kept ||= new Set()).add(zone.key);
  return row;
}
async function opsOf(sv, job, now) {
  const ops = [];
  for (const r of job.rows) {
    if (r.op) ops.push(r.op);
    else if (r.zone) {
      if (r.keep) ops.push({ op: "keep", key: [sv.slotId, r.zone], epoch: r.cp });
      const value = now ? finishZoneNow(r.snap) : await finishZone(r.snap);
      ops.push({ op: "put", store: "zones", value });
      if (r.copy) ops.push({ op: "put", store: "checkpointZones", value });   // (a checkpoint's own row, kept as its copy at once)
    } else if (r.slot) ops.push({ op: "put", store: "slots", value: JSON.parse(r.slot) });
    else if (r.carry) {
      const { store, slot, key, into, maybe } = r.carry;
      const rec = await store.get(into, [slot, key]);
      if (!rec && maybe) continue;   // (a keep that found nothing to keep)
      if (!rec) throw new Error(`saveGame: ${key} left memory, and slot ${slot} holds no record of it to copy`);
      ops.push({ op: "put", store: into, value: { ...rec, slot: sv.slotId } });
    }
  }
  return ops;
}
const absorbable = (job) => !job.run && !job.issued && job.rows.every((r) => !r.carry);
function landed(game, sv, job) {
  for (const r of job.rows) if (r.zone) { unpend(sv, r.zone); sv.committed.add(r.zone); SAVE_STATS.zoneWrites++; }
  trim(game, sv);
}
// A job that didn't land: its zones count as never written (they may not leave memory, and the next save writes them
// afresh), its keeps as never made (the next write makes them), and a save is asked for again a little later.
function unwrite(game, sv, job) {
  for (const r of job.rows) if (r.zone) {
    unpend(sv, r.zone);
    sv.committed.delete(r.zone);
    if (r.keep || r.copy) sv.kept?.delete(r.zone);
  }
  if (!sv.dead && game.saving === sv) requestSave(game, "retry", { delay: SAVE_RULES.retry, backoff: true });
}
function submit(game, sv, job) {
  job.absorbed = null;
  sv.jobs.push(job);
  for (const r of job.rows) if (r.zone && !r.pended) pend(sv, r.zone, r.savedAt);
  const standDown = async () => { if (!job.absorbed) return false; try { await job.absorbed; return true; } catch { return false; } };
  // The job's own bookkeeping (job.after) runs inside the queue, so whenWritten settles after it.
  const done = sv.queue.then(async () => {
    if (job.before) await job.before.catch(() => {});   // (another slot's writes, before its records are copied)
    // Made under a checkpoint whose own save failed: it would write that checkpoint's rows and record (failedCheckpoint).
    if (sv.badCp?.has(job.epoch) || job.rows.some((r) => r.zone && sv.badCp?.has(r.cp))) throw new Error("its checkpoint's save failed");
    if (await standDown()) return;
    if (job.run) { job.issued = true; await job.run(sv.store); return; }
    const ops = await opsOf(sv, job, false);
    if (await standDown()) return;   // (the unload save took it while it was compressed)
    job.issued = true;
    await sv.store.writeNow(ops);
  }).finally(() => { const k = sv.jobs.indexOf(job); if (k >= 0) sv.jobs.splice(k, 1); })
    .then(() => { landed(game, sv, job); job.after?.(null); },
          (e) => { unwrite(game, sv, job); job.after?.(e); throw e; });
  sv.queue = done.catch(() => {});
  return done;
}

// --- Saving --------------------------------------------------------------------------------------------
// Requests made outside a saveable screen: [{ game, run, opts, resolve, reject }]. One whose run has ended by the
// time a save could happen (a new run, a load, a death) is refused, never written with the next run's state.
const waiting = [];
export function saveGame(game, opts = {}) {
  if (!canSave(game)) return new Promise((resolve, reject) => waiting.push({ game, run: game.run, opts, resolve, reject }));
  try { return writeSave(game, opts); } catch (e) { return Promise.reject(e); }
}
registerUpdate("save:waiting", (game) => {
  if (!waiting.length || !canSave(game)) return;
  for (const w of waiting.splice(0)) {
    if (w.game !== game) { waiting.push(w); continue; }
    if (w.run !== game.run || game.saving?.dead) { w.reject(new Error("saveGame: the run this save was asked for has ended")); continue; }
    try { writeSave(game, w.opts).then(w.resolve, w.reject); } catch (e) { w.reject(e); }
  }
}, { modes: ["*"] });

function writeSave(game, { reason = "manual", store, slotId, clean = false, checkpoint: cpSave = false } = {}) {
  const old = game.saving, st = store || old?.store || storeFor(), sv = savingFor(game, st, slotId), now = Date.now();
  if (sv.dead) throw new Error("saveGame: this run has ended");
  const moved = old && old !== sv;
  // The snapshot: everything live is read in these lines, and nothing after them. A checkpoint's rows are its
  // baseline (cp: the last checkpoint's number, so the first overwrite after it keeps them).
  const zones = [...game.zones.values()].filter((z) => visited(game, z) && (z === game.zone || moved || (!sv.committed.has(z.key) && !sv.pending.has(z.key))));
  if (moved && sv.cp) sv.kept = new Set(old.kept || []);   // (the copies come over below, and the rows as they stand)
  const prev = cpSave ? { cp: sv.cp, cpRecord: sv.cpRecord, kept: new Set(sv.kept || []) } : null;   // (if this one fails)
  if (cpSave) sv.kept = new Set();   // (the last checkpoint's copies go: this one keeps its own)
  const rows = zones.map((z) => zoneRow(sv, z, now, cpSave ? { keep: false, copy: true } : {}));
  // A run saved to another slot (or store) than before: the old slot's records come over, so the new slot has
  // every visited zone: the zones that left memory, and with a checkpoint up every row and every copy (the
  // keep ops then work on the new slot as they did on the old).
  const carry = [];
  if (moved) {
    const inMemory = new Set(rows.map((r) => r.zone));
    for (const k of old.committed) if (!inMemory.has(k) || sv.cp) carry.push({ carry: { store: old.store, slot: old.slotId, key: k, into: "zones" } });
    if (sv.cp) for (const k of old.kept || []) carry.push({ carry: { store: old.store, slot: old.slotId, key: k, into: "checkpointZones", maybe: true } });
    for (const c of carry) if (c.carry.into === "zones") pend(sv, c.carry.key, old.stored.get(c.carry.key) ?? now);
  }
  // The zones you left since the last save, written behind with this slot record (writeZone): with a checkpoint,
  // part of its baseline. (Saved to another slot, they are snapshotted afresh above.)
  if (moved) for (const r of old.held.splice(0)) unpend(old, r.zone);
  const held = sv.held.splice(0);
  if (cpSave) for (const r of held) { r.keep = false; r.copy = true; sv.kept.add(r.zone); }
  const n = cpSave ? Math.max(sv.cp, sv.cpTop || 0) + 1 : sv.cp;   // (a number is never used twice, a failed one included)
  if (cpSave) sv.cpTop = n;
  const keys = new Map(sv.stored);
  for (const r of rows) keys.set(r.zone, now);
  let slotSnap;
  try {
    slotSnap = snapshotSlot(game, { id: sv.slotId, created: sv.created, updated: now, zones: [...keys].map(([key, savedAt]) => ({ key, savedAt })),
      live: clean ? null : SESSION, unclean: sv.unclean, checkpoint: cpSave ? undefined : sv.cpRecord || undefined });
  } catch (e) { for (const c of carry) if (c.carry.into === "zones") unpend(sv, c.carry.key); throw e; }
  let json = slotSnap.json;
  if (cpSave) {   // the checkpoint: this very record, kept inside itself
    sv.cpRecord = { ...JSON.parse(json), n };
    sv.cp = n;
    const rec = JSON.parse(json);
    rec.checkpoint = sv.cpRecord;
    json = JSON.stringify(rec);
  }
  sv.live = clean ? null : SESSION;
  // A session ending here (save and quit): no save asked for before it may land after it with live set again. The
  // automatic ones stop for this slot, and the waiting ones are answered by this one.
  sv.quitting = clean;
  const answered = [];
  if (clean) {
    autoFor(game).want = null;
    for (const w of waiting.splice(0)) (w.game === game ? answered : waiting).push(w);
  }
  // A slot this run starts writing to: whatever rows it held (another run's, saved under that id before) go first.
  const clear = sv.fresh ? ["zones", "checkpointZones"].map((store) => ({ op: { op: "clear", store, slot: sv.slotId } })) : [];
  sv.fresh = false;
  const job = { rows: [...clear, ...(cpSave && !clear.length ? [{ op: { op: "clear", store: "checkpointZones", slot: sv.slotId } }] : []), ...carry, ...held, ...rows, { slot: json }],
                checkpoint: cpSave ? n : 0, epoch: n, before: moved ? old.queue : null };
  job.after = (e) => {
    if (e && clean) { sv.quitting = false; waiting.push(...answered); }   // (the session goes on: so do they)
    if (e && cpSave) failedCheckpoint(game, sv, n, prev);
    for (const c of carry) if (c.carry.into === "zones") { unpend(sv, c.carry.key); if (!e) sv.committed.add(c.carry.key); }
    sv.last = { reason, at: Date.now(), ok: !e };
    if (e) { failed(game, sv, `saving slot ${sv.slotId}`, e); return; }
    SAVE_STATS.saves++;
    if (cpSave) SAVE_STATS.checkpoints++;
    autoFor(game).play = 0;
  };
  const done = submit(game, sv, job);
  for (const r of rows) sv.stored.set(r.zone, now);
  const meta = done.then(() => ({ id: sv.slotId, updated: now, zones: keys.size, reason, ...(cpSave ? { checkpoint: n } : {}) }));
  meta.then((m) => { for (const w of answered) w.resolve(m); }, () => {});
  return meta;
}

// A checkpoint whose save failed: the run goes back to the last one that was written (the store still has it, and its
// copies), and every job made since under the failed one is set aside when its turn comes (submit), its zones written
// afresh by the save asked for again; so are the zones left since, held under it. The next settlement makes a new one.
function failedCheckpoint(game, sv, n, prev) {
  (sv.badCp ||= new Set()).add(n);
  if (sv.cp === n) { sv.cp = prev.cp; sv.cpRecord = prev.cpRecord; sv.kept = prev.kept; }
  sv.held = sv.held.filter((r) => { if (r.cp !== n) return true; unpend(sv, r.zone); sv.committed.delete(r.zone); return false; });
}

// Write-behind: the zone you leave, after every other zone:leave handler (the clock catches up first), snapshotted
// then and there. With the automatic saves on it is held and goes into the next slot record's job (the change's own
// save, half a second on, or the unload save), in one transaction: the store never holds a zone newer than its slot,
// so no load mixes two moments (an item dropped after a save isn't both in the pack and on the floor), whichever
// screen is up when the page goes. It counts as pending meanwhile (it can't leave memory). Without them (Node
// checks), it is written at once, as in Phase 0.
export function writeZone(game, zone) {
  const sv = game.saving;
  if (!sv || sv.dead) return null;
  let row;
  try { row = zoneRow(sv, zone, Date.now()); } catch (e) { failed(game, sv, `snapshotting ${zone.key}`, e); return null; }
  if (autoOn(game)) { pend(sv, row.zone, row.savedAt); row.pended = true; sv.held.push(row); return null; }
  return submit(game, sv, { rows: [row], epoch: row.cp }).catch((e) => failed(game, sv, `writing ${zone.key}`, e));
}
on("zone:leave", (game, { zone }) => { writeZone(game, zone); }, { priority: -100 });

// --- Automatic saves -------------------------------------------------------------------------------------
const AUTO = new WeakMap();   // run → { play, travel, want: { reason, at, checkpoint } | null, hidden }
function autoFor(game) {
  const key = game.run || game;
  let a = AUTO.get(key);
  if (!a) AUTO.set(key, (a = { play: 0, travel: 0, want: null, hidden: false }));
  return a;
}
const autoOn = (game) => SAVE_RULES.auto && !!(game.run && game.state && game.player) && !game.saving?.dead && !game.saving?.quitting && !!(game.saving || currentStore());
export function requestSave(game, reason, { delay = 0, checkpoint: cp = false, backoff = false } = {}) {
  const a = autoFor(game), at = (game.uiTime || 0) + delay;
  // (Several asked for become one, at the latest of their times: a change's half second holds off a periodic one. A
  // retry's wait doesn't hold off a new one.)
  const later = a.want && !a.want.backoff ? Math.max(a.want.at, at) : at;
  a.want = { reason: a.want ? `${a.want.reason}+${reason}` : reason, at: later, checkpoint: !!(a.want?.checkpoint || cp), backoff: backoff && (!a.want || a.want.backoff) };
}
// A settlement: a surface span whose site (a landmark or a village) is a checkpoint (world/sites.js).
function settlement(game, key) {
  if (!key || !game.run?.sitesAt) return false;
  const { wx, wy, z } = parseKey(key);
  return z === 0 && (game.run.sitesAt.get(`${wx},${wy}`) || []).some((id) => game.run.sites.get(id)?.checkpoint);
}
on("zone:enter", (game, { zone, how, from }) => {
  if (how === "load") return;
  // (Whether it is a checkpoint depends on the run's mode as it is when the save happens: a new game's is set
  // just after startRun.)
  const cp = how === "start" || settlement(game, zone.key) || settlement(game, from);
  requestSave(game, "zone", { delay: SAVE_RULES.afterChange, checkpoint: cp });
}, { priority: -100 });
const PLAY = new Set(["explore", "map"]);
registerUpdate("save:auto", (game, dt) => {
  if (!autoOn(game)) return;
  const a = autoFor(game);
  if (PLAY.has(game.mode)) { a.play += dt; if (a.play >= SAVE_RULES.every && !a.want) requestSave(game, "periodic"); }
  if (game.mode === "world") { a.travel += dt; if (a.travel >= SAVE_RULES.travelEvery && !a.want) requestSave(game, "travel"); }
  if (!a.want || (game.uiTime || 0) < a.want.at || !canSave(game)) return;
  const w = a.want;
  a.want = null; a.play = 0; a.travel = 0;
  try {
    const cp = w.checkpoint && checkpoints(game);
    writeSave(game, { reason: cp ? w.reason.replace(/zone/, "checkpoint") : w.reason, checkpoint: cp }).catch(() => {});
  } catch (e) { if (game.saving) failed(game, game.saving, `the ${w.reason} save`, e); else console.error(`save: the ${w.reason} save failed:`, e); }
}, { modes: ["*"] });

export function checkpoint(game) {
  if (!checkpoints(game)) return Promise.resolve(null);
  return saveGame(game, { reason: "checkpoint", checkpoint: true }).then((m) => ({ id: m.id, n: m.checkpoint }));
}

// --- The page going and coming back (§7.3 "Unload") ------------------------------------------------------
export function unloadSave(game) {
  const sv = game.saving;
  if (!sv || sv.dead || !canSave(game) || !sv.store.writeNow) return null;
  const waitingJobs = sv.jobs.filter((j) => !j.issued);
  if (!waitingJobs.every(absorbable)) return null;   // (a restore or a copy from another slot must read first)
  const now = Date.now();
  let own;
  try {
    const row = zoneRow(sv, game.zone, now);
    const keys = new Map(sv.stored);
    keys.set(row.zone, now);
    const slot = snapshotSlot(game, { id: sv.slotId, created: sv.created, updated: now, zones: [...keys].map(([key, savedAt]) => ({ key, savedAt })),
      live: null, unclean: sv.unclean, checkpoint: sv.cpRecord || undefined });
    own = { rows: [...sv.held.splice(0), row, { slot: slot.json }], epoch: sv.cp };
    sv.stored.set(row.zone, now);
  } catch (e) { failed(game, sv, "the unload save's snapshot", e); return null; }
  // Every job not yet begun, then this one: their ops at once (uncompressed), in order, in one transaction.
  const jobs = [...waitingJobs, own];
  const ops = [];
  let p;
  try {
    for (const j of jobs) for (const r of j.rows) {
      if (r.op) ops.push(r.op);
      else if (r.zone) {
        if (r.keep) ops.push({ op: "keep", key: [sv.slotId, r.zone], epoch: r.cp });
        const value = finishZoneNow(r.snap);
        ops.push({ op: "put", store: "zones", value });
        if (r.copy) ops.push({ op: "put", store: "checkpointZones", value });
      }
      else if (r.slot) ops.push({ op: "put", store: "slots", value: JSON.parse(r.slot) });
    }
    p = sv.store.writeNow(ops);
  } catch (e) { failed(game, sv, "the unload save", e); return null; }
  for (const j of waitingJobs) j.absorbed = p;
  own.absorbed = p;
  sv.live = null;
  autoFor(game).hidden = true;
  SAVE_STATS.unloads++;
  own.after = (e) => { sv.last = { reason: "unload", at: Date.now(), ok: !e }; if (e) failed(game, sv, "the unload save", e); };
  const done = submit(game, sv, own);
  own.absorbed = p;   // (submit cleared it: this job is the transaction above)
  return done;
}
export function pageShown(game) {
  const a = game.run && AUTO.get(game.run);
  if (!a?.hidden) return;
  a.hidden = false;
  if (game.saving && !game.saving.dead && !game.saving.quitting) requestSave(game, "back");   // live again
}
export function listenPage(doc, win, game = null) {
  const g = () => game || theGame;   // (save/index.js listens while game.js is still loading)
  const vis = () => { if (doc.visibilityState === "hidden") unloadSave(g())?.catch(() => {}); else pageShown(g()); };
  const hide = () => { unloadSave(g())?.catch(() => {}); };
  doc.addEventListener("visibilitychange", vis);
  win?.addEventListener("pagehide", hide);
  return () => { doc.removeEventListener("visibilitychange", vis); win?.removeEventListener("pagehide", hide); };
}

// --- Death, checkpoints restored, graves -------------------------------------------------------------------
export async function graveyard({ store } = {}) {
  const st = store || currentStore() || fallback;
  return (st && (await st.get("meta", "graveyard"))?.graves) || [];
}
// A grave and the end of a slot, in one transaction: the slot, its zones and its checkpoint's copies go.
async function bury(st, slotId, rec) {
  await st.tx(async (t) => {
    const graves = (await t.get("meta", "graveyard"))?.graves || [];
    await t.put("meta", { id: "graveyard", graves: [...graves, rec].slice(-SAVE_RULES.graveyard) });
    for (const name of ["zones", "checkpointZones"]) for (const r of await t.list(name, { slot: slotId })) await t.del(name, [slotId, r.key]);
    await t.del("slots", slotId);
  });
}
const graveOf = (game, cause, unclean) => ({ name: game.player?.name ?? null, seed: game.seed, mode: modeOf(game), level: game.player?.level ?? 1,
  cause, where: game.zone?.name ?? game.zone?.key ?? null, time: game.time, unclean, at: Date.now() });


export function endRun(game, { cause = game.deathCause } = {}) {
  const sv = game.saving;
  if (!sv || sv.dead) return Promise.resolve(null);
  sv.dead = true;
  for (const r of sv.held.splice(0)) unpend(sv, r.zone);   // (the zones left since the last save: this life is over)
  for (const w of waiting.splice(0)) if (w.game === game) w.reject(new Error("saveGame: the run this save was asked for has ended")); else waiting.push(w);
  if (checkpoints(game) && sv.cpRecord) {
    sv.restoring = submit(game, sv, { rows: [], run: (st) => writeRestore(st, sv.slotId, sv.cpRecord, sv.unclean) })
      .then(() => { SAVE_STATS.restores++; return sv.cpRecord; });
    return sv.restoring;
  }
  const rec = graveOf(game, cause, sv.unclean);
  return submit(game, sv, { rows: [], run: (st) => bury(st, sv.slotId, rec) }).then(() => null);
}

// The checkpoint's copies back in zones, the rows first written after it gone, its slot record back (§7.5).
async function writeRestore(st, slotId, cpRecord, unclean) {
  await st.tx(async (t) => {
    const zs = await t.list("zones", { slot: slotId }), cps = await t.list("checkpointZones", { slot: slotId });
    const kept = new Set(cps.map((r) => r.key));
    for (const r of cps) await t.put("zones", r);
    for (const r of zs) if (!kept.has(r.key) && (r.cp ?? 0) >= cpRecord.n) await t.del("zones", [slotId, r.key]);
    for (const r of cps) await t.del("checkpointZones", [slotId, r.key]);
    // (A copy of its own: a structured clone keeps two references to one object as one, and the slot's state
    // becoming the game's would then change the checkpoint kept inside it.)
    const { n, ...rec } = JSON.parse(JSON.stringify(cpRecord));
    await t.put("slots", { ...rec, id: slotId, checkpoint: { ...cpRecord, id: slotId }, live: null, unclean, updated: Date.now() });
  });
}
export async function restoreCheckpoint(slotId, { store } = {}) {
  const st = storeFor(store), slot = await st.get("slots", slotId);
  if (!slot?.checkpoint) return null;
  await writeRestore(st, slotId, slot.checkpoint, slot.unclean || 0);
  SAVE_STATS.restores++;
  return st.get("slots", slotId);
}
export async function wakeAtCheckpoint(game = theGame) {
  const sv = game.saving;
  if (!sv?.restoring) throw new Error("wakeAtCheckpoint: no checkpoint to wake at");
  await sv.restoring;
  return loadGame(sv.slotId, { game, store: sv.store });
}

// --- Reading back -----------------------------------------------------------------------------------------
ZONE_LOADER.has = (game, key) => !!game.saving?.committed.has(key);
ZONE_LOADER.load = async (game, key) => {
  const sv = game.saving;
  if (!sv) return null;
  const rec = await sv.store.get("zones", [sv.slotId, key]);
  return rec ? decodeZone(migrateZone(rec, sv.version, sv.migrations)) : null;
};
ZONE_LOADER.canEvict = (game, key) => { const sv = game.saving; return !!sv && sv.committed.has(key) && !sv.pending.has(key); };

function checkSlot(slot, slotId) {
  if (!slot) throw new Error(`loadGame: no slot ${slotId}`);
  if (slot.game !== GAME_ID) throw new Error(`loadGame: ${slotId} is a save of ${slot.game}, not ${GAME_ID}`);
  if (slot.worldVersion !== VERSION.world) throw new Error(`loadGame: ${slotId} was made on map version ${slot.worldVersion}, the map is version ${VERSION.world} now (§7.6)`);
}

export async function loadGame(slotId, { game = theGame, store, version = VERSION.save, migrations = MIGRATIONS } = {}) {
  const st = storeFor(store);
  const stored = await st.get("slots", slotId);
  checkSlot(stored, slotId);
  const { slot, zones } = migrate(stored, await st.list("zones", { slot: slotId }), { to: version, migrations });
  const where = slot.where?.zoneKey;
  if (!zones.some((r) => r.key === where)) throw new Error(`loadGame: ${slotId} holds no record of ${where}, the zone you were in`);
  const def = await worldFor(slot.state?.world?.id ?? slot.run?.world?.id);
  const run = restoreRun(slot.run, def);
  // A session that ended without a clean save (a crash, the tab closed mid-fight): counted; One Wick may call it a death.
  const unclean = (slot.unclean || 0) + (slot.live ? 1 : 0);
  if (slot.live && (slot.mode ?? "oneWick") === "oneWick" && SAVE_RULES.oneWick.unclean === "death") {
    await bury(st, slotId, { name: slot.character?.name ?? null, seed: slot.seed, mode: "oneWick", level: slot.character?.level ?? 1,
                             cause: "the last session ended without a save", where, time: slot.time, unclean, at: Date.now() });
    const e = new Error("This life's last session ended without a save, and One Wick counts that as a death.");
    e.code = "unclean";
    throw e;
  }
  // Until the zone is read the title screen covers the wait (frames go on, and there is no zone to draw).
  if (game.mode !== "title") setMode(game, "title", null, { pointer: false });
  resumeRun(game, { seed: slot.seed, run, state: slot.state, player: decodePlayer(slot.player), view: slot.where.view });
  // The id counter, before any zone is read (§7.4), above every id in every record of the slot: write-behind
  // goes on writing the zones you leave after a save, and the ones made since then hold ids past the slot's counter.
  setIds({ ...slot.ids, entity: Math.max(slot.ids.entity, ...zones.map((r) => r.ids?.entity || 0)) });
  const sv = game.saving = newSaving(slotId, slot.created, st, { cp: slot.checkpoint?.n || 0, unclean,
    cpRecord: slot.checkpoint ? JSON.parse(JSON.stringify(slot.checkpoint)) : null });   // (never the objects the game plays with)
  sv.version = version; sv.migrations = migrations;
  for (const r of zones) { sv.committed.add(r.key); sv.stored.set(r.key, r.savedAt); }
  // Keys with a copy, or first written after the checkpoint: their next write keeps nothing.
  if (sv.cp) sv.kept = new Set([...(await st.list("checkpointZones", { slot: slotId })).map((r) => r.key), ...zones.filter((r) => (r.cp ?? 0) >= sv.cp).map((r) => r.key)]);
  const p = game.player;
  const entered = await changeZone(game, where, { how: "load", at: { x: p.x, y: p.y, z: p.z, yaw: p.yaw }, keepFacing: true, keepMotion: true });
  if (!entered) throw new Error(`loadGame: couldn't read ${where} back`);
  // This session holds the slot now, the zone read (and the count goes in at once). A load that failed marks nothing.
  submit(game, sv, { rows: [{ op: { op: "put", store: "slots", value: { ...stored, live: SESSION, unclean } } }] }).catch((e) => failed(game, sv, "marking the slot live", e));
  setMode(game, playMode(game), null, { pointer: false });
  if (game.view !== "map") pushMode(game, "pause", null, { pointer: false });
  SAVE_STATS.loads++;
  return game;
}

export async function listSlots({ store } = {}) {
  const st = store || currentStore() || fallback;
  if (!st) return [];
  return (await st.list("slots"))
    .map((s) => ({ id: s.id, created: s.created, updated: s.updated, seed: s.seed, mode: s.mode, character: s.character, where: s.where, time: s.time,
                   unclean: s.unclean || 0, live: s.live || null, checkpoint: s.checkpoint?.n || 0, genVersion: s.genVersion, version: s.version }))
    .sort((a, b) => b.updated - a.updated);
}

export async function deleteSlot(id, { store } = {}) {
  const st = store || currentStore() || fallback;
  if (!st || !(await st.get("slots", id))) return false;
  await st.tx(async (t) => {
    for (const name of ["zones", "checkpointZones"]) for (const r of await t.list(name, { slot: id })) await t.del(name, [id, r.key]);
    await t.del("slots", id);
  });
  return true;
}

// --- Export, import, moving between stores -------------------------------------------------------------
export async function exportSlot(id, { store } = {}) {
  const st = storeFor(store), slot = await st.get("slots", id);
  if (!slot) throw new Error(`exportSlot: no slot ${id}`);
  return { kind: "gnomon-save", game: GAME_ID, version: slot.version, exported: Date.now(), slot,
           zones: await st.list("zones", { slot: id }), checkpointZones: await st.list("checkpointZones", { slot: id }) };
}
// What a file must hold for the title, a load and the game to read it (an export holds it; a hand-made file may not).
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
function fileProblems({ slot, zones, checkpointZones = [] }) {
  const out = [], c = slot.character;
  if (typeof slot.id !== "string" || !slot.id) out.push("no slot id");
  if (!Number.isInteger(slot.seed)) out.push("the seed");
  if (!isNum(slot.created) || !isNum(slot.updated) || !isNum(slot.time)) out.push("its times");
  if (slot.mode !== undefined && !RUN_MODES[slot.mode]) out.push(`the mode ${JSON.stringify(slot.mode)}`);
  if (!isObj(c) || (c.name !== null && c.name !== undefined && typeof c.name !== "string") || !Number.isInteger(c.level ?? 1)) out.push("the character");
  if (!isObj(slot.where) || typeof slot.where.zoneKey !== "string") out.push("where you were");
  if (!isObj(slot.state) || !isObj(slot.player) || !isObj(slot.run) || !isObj(slot.ids) || !Number.isInteger(slot.ids.entity)) out.push("the state, player, run or ids");
  if (!Number.isInteger(slot.unclean ?? 0) || slot.unclean < 0) out.push("the unclean count");
  if (slot.checkpoint !== undefined && (!isObj(slot.checkpoint) || !Number.isInteger(slot.checkpoint.n))) out.push("the checkpoint");
  for (const r of [...zones, ...(Array.isArray(checkpointZones) ? checkpointZones : [null])])
    if (!isObj(r) || typeof r.key !== "string" || !/^-?\d+,-?\d+,\d+$/.test(r.key)) { out.push("a zone record"); break; }
  return out;
}

// One import at a time (each looks for a free id before it writes), and an id taken gets a suffix of its own.
let importing = Promise.resolve();
export function importSlot(file, opts = {}) {
  const done = importing.then(() => importOne(file, opts));
  importing = done.catch(() => {});
  return done;
}
async function importOne(file, { store } = {}) {
  const st = storeFor(store);
  const data = typeof file === "string" ? JSON.parse(file) : file;
  if (data?.kind !== "gnomon-save" || data.game !== GAME_ID || !data.slot?.id || !Array.isArray(data.zones))
    throw new Error("importSlot: that isn't a GNOMON save file");
  checkSlot(data.slot, data.slot.id);
  migrate(data.slot, [], {});   // (refuses a save from a newer game, or one with no way up)
  const bad = fileProblems(data);
  if (bad.length) throw new Error(`importSlot: the file isn't a save this game can read (${bad.slice(0, 3).join("; ")})`);
  const here = data.zones.find((r) => r.key === data.slot.where.zoneKey);
  if (!here) throw new Error("importSlot: the file holds no record of the zone you were in");
  // The run and the zone you were in, read as a load would read them (nothing kept): a file that would fail to load
  // fails here, before it is stored.
  try { restoreRun(data.slot.run, await worldFor(data.slot.state.world?.id ?? data.slot.run.world?.id)); await decodeZone(migrateZone(here)); }
  catch (e) { throw new Error(`importSlot: the file's ${e.message?.startsWith("restoreRun") || /world/.test(e.message) ? "run" : "zone"} doesn't read (${String(e.message).slice(0, 80)})`); }
  let id = data.slot.id;
  if (await st.get("slots", id)) id = `${id}-${Date.now().toString(36)}${(slotSeq++).toString(36)}`;
  await st.tx(async (t) => {
    for (const r of data.zones) await t.put("zones", { ...r, slot: id });
    for (const r of data.checkpointZones || []) await t.put("checkpointZones", { ...r, slot: id });
    await t.put("slots", { ...data.slot, id, ...(data.slot.checkpoint ? { checkpoint: { ...data.slot.checkpoint, id } } : {}) });
  });
  return id;
}
export async function moveSlot(game, store) {
  const sv = game.saving;
  if (!sv || sv.store === store || sv.dead) return false;
  await sv.queue;
  const file = await exportSlot(sv.slotId, { store: sv.store }).catch(() => null);
  if (!file) return false;
  await store.tx(async (t) => {
    for (const r of file.zones) await t.put("zones", r);
    for (const r of file.checkpointZones) await t.put("checkpointZones", r);
    await t.put("slots", file.slot);
  });
  sv.store = store;
  sv.queue = Promise.resolve();
  return true;
}

export const whenWritten = (game) => game.saving?.queue ?? Promise.resolve();
export function saveStatus(game) {
  const sv = game.saving;
  return sv ? { slotId: sv.slotId, committed: [...sv.committed], pending: [...sv.pending.keys()], failed: [...sv.failed], cp: sv.cp, live: sv.live,
                unclean: sv.unclean, dead: sv.dead, last: sv.last } : null;
}
