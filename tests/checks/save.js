// Saves (0D2; TECH_DESIGN §7, §1.4 "save"; P0 skeleton → WS9): the codec, the store, snapshot-first saves,
// write-behind, loading, and the 0D2 gate.
//
//   checkSave({ game, startRun, inputHandlers, runSession, fresh, screen, root, seeds = [1, 7] }) → Promise<{ name, ok, problems, stats, notes }>
//   digestGame(game, keys) → Promise<{ state, player, run, ids, zones: { key: json } }>   canonical JSON (sorted keys)
//
// game/startRun/inputHandlers: the real game; runSession: tools/bot.mjs's 10-zone session; fresh(dump, slotId,
// keys) → the digest a fresh Node process makes after loading that slot from that store dump; screen(cols, rows)
// → a Node screen of that size, { frameText } (tools/check-save.mjs).
//
//   1. The gate: after the bot's 10-zone session (both views, a dungeon level down and back, span edges), save →
//      load → the canonical JSON of game.state, the player, the Run data, the ids and every visited zone's
//      record identical, loaded in this process after another run replaced everything, and in a fresh Node
//      process that never ran the game. A load never calls buildRun (RUN_STATS spy). The id counter comes back
//      before any zone and exceeds every id in the loaded zones. game.state, the player and the Run data hold
//      no Set, Map, function or class instance (R5's walker), before and after. Record sizes are reported.
//   2. The codec: every zone of the session (visited and prefetched) round-trips exactly, deflated and { raw };
//      decoding doesn't move the id counter; creatures are trimmed to the whitelist and come back with every
//      field it keeps (the check's own list) and their looks; projectiles are dropped; a zone field that isn't JSON is refused until it registers a codec;
//      the walker catches each thing JSON can't carry; deflate is the zlib format and "deflate-raw" appears
//      nowhere in src/.
//   3. The store: copies in and out, a tx is all or nothing, a commit can be held open (latency), dump/from;
//      idbAdapter keeps its signature and rejects.
//   4. Saving: snapshot-first (changes made right after saveGame returns don't reach the records); a save asked
//      for outside a saveable screen (the inventory, a screen whose data holds a callback) waits and happens on
//      the first frame back in a view; write-behind on zone:leave snapshots the zone you leave at once, and it
//      may leave memory only once that write has committed (refused before, allowed after; read back identical);
//      writes land in the order they were made, however long each takes; evictDormant keeps the zone you are in
//      and its neighbours.
//   5. Loading (from the map, frames running and drawn during the read): the mode stack starts afresh (no data, no callbacks) and prefetch state is not saved; zone:enter
//      says "load", never a first visit; a stored neighbour and a stored level are read back over an edge and
//      down stairs, never generated; refused: another game's slot, another save version, another map version,
//      a slot without the zone you were in; listSlots newest first; deleteSlot takes the zones too.
//   7. The gate again on more seeds (seeds, default 1 and 7; 1234 is section 1's): the session, save, load in this
//      process and in a fresh one, canonical JSON identical, buildRun never called, ids above every loaded id.
//   8. What the session doesn't reach, saved → loaded → identical: legacy level 15 after the Colossus has slammed
//      and while its next slam is warned (both views: zone.slam and zone.slamDone hold Sets). Zones made and left
//      after a save (written behind): the load's id counter is above every id in them. A busy state on level 20
//      (a monster hurt, poisoned and chasing, the Lich King in phase 1, holeSeen, uids and zone patches, a person met),
//      every kept creature field compared as well. The run saved to another slot after a zone left memory: the new
//      slot holds it. A save waiting over the inventory when a new run begins is refused. Legacy level 10's Gloom
//      Warden awake with its shades: its fight and their halved xp come back, and it doesn't wake again.
//   6. The title screen at 100×30, through the real input handlers: with nothing saved only "New quick game";
//      with a slot "Continue" too; each by keys (Enter, ↓ Enter, 2) and by a click on its line; New starts a
//      run at the intro, Continue loads the newest slot; M still switches the music there.
import { canonicalJson, encodeZone, decodeZone, encodePlayer, jsonProblems, snapshotZone, trimCreature, CREATURE_FIELDS,
         CODEC, DEFLATE_AVAILABLE, registerZoneField, packBytes, fromB64 } from "../../src/save/codec.js";
import { memoryAdapter, idbAdapter } from "../../src/save/store.js";
import { saveGame, loadGame, listSlots, deleteSlot, whenWritten, saveStatus, canSave, SAVE_RULES } from "../../src/save/save.js";
import { getZone, cachedZone, evictZone, evictDormant, ZONE_GENERATORS, ZONE_RULES, changeZone, neighbourAddr } from "../../src/zones.js";
import { entityCounter, getIds, setEntityCounter } from "../../src/ids.js";
import { serializeRun, RUN_STATS } from "../../src/world/run.js";
import { pushMode, popMode, screenFor, registerScreen } from "../../src/screens.js";
import { on } from "../../src/events.js";
import { useStore, currentStore } from "../../src/save/store.js";
import { openTitle } from "../../src/screens/title.js";
import { B, FLOOR_Z } from "../../src/world.js";
import { CREATURE_TYPES } from "../../src/creatures.js";
import { addStatus } from "../../src/status.js";
import { addZonePatch, claimUid } from "../../src/zones.js";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
// A screen no save is made under (it isn't saveable, nor one a save looks through: like the story's pages or talk).
const BUSY = "check:busy";
registerScreen(BUSY, { draw() {} });
// What a saved creature must keep (§7.2's whitelist, then 0C's state fields, then a guardian's fight and xp).
const KEEP = ["id", "uid", "type", "elite", "tx", "ty", "z", "hp", "maxHp", "level", "brain", "status", "cooldowns", "inv", "body", "merchant",
  "faction", "name", "named", "flags", "state", "phase", "risen", "bounty", "lightBurn", "regenAcc", "g", "xp"];

export async function digestGame(game, keys) {
  const out = { state: canonicalJson(game.state), player: canonicalJson(encodePlayer(game.player)), run: canonicalJson(serializeRun(game.run)),
                ids: canonicalJson(getIds()), zones: {} };
  for (const key of keys) {
    const z = cachedZone(game, key) || await getZone(game, key);
    out.zones[key] = z ? canonicalJson({ ...(await encodeZone(z, {}, { deflate: false })), slot: null, savedAt: 0, ids: null, cp: null, v: null }) : null;
  }
  return out;
}
const visitedKeys = (game) => [...game.zones.keys()].filter((k) => k === game.zone.key || game.state.zoneLeft[k] !== undefined).sort();
const playing = (game, view = game.view) => { game.view = view; game.mode = view === "map" ? "map" : "explore"; game.paused = false; game.modeStack = []; };
// WS4's creation wizard, which the title's first item opens since it is registered (p2-ws4a; at the WS9 merge), by the
// keys alone: Enter on each step, on the mutations' (or implants') list its last row first (End), on the name a
// suggestion first (Tab). → whether it began the run.
async function throughWizard(game, key) {
  const { wizard } = await import("../../src/screens/create.js");
  for (let k = 0; k < 20 && game.mode === "create"; k++) {
    const step = wizard().step;
    if (step === "track") key("End"); else if (step === "name") key("Tab");
    key("Enter");
  }
  return game.mode !== "create";
}

// Sections 1-8 hold Phase 0's saves, asked for by hand (the automatic ones off); 9-18 are WS9's (ws9Sections).
export async function checkSave(opts) {
  const autoWas = SAVE_RULES.auto;
  SAVE_RULES.auto = false;
  try { return await checkSections(opts); } finally { SAVE_RULES.auto = autoWas; useStore(null); }
}

async function checkSections({ game, startRun, inputHandlers, runSession, fresh, screen, root, seeds = [1, 7], v1 = null, child = null, seedRandom = null }) {
  const problems = [], stats = {}, notes = [];
  const fail = (m) => problems.push(m);
  const compare = (what, a, b) => {
    for (const part of ["state", "player", "run", "ids"]) if (a[part] !== b[part]) fail(`${what}: ${part} differs (${a[part].length} vs ${b[part].length} chars)`);
    for (const key of Object.keys(a.zones)) if (a.zones[key] !== b.zones[key]) fail(`${what}: zone ${key}'s record differs`);
    return problems.length;
  };
  const walk = (what) => {
    const bad = [...jsonProblems(game.state, "state"), ...jsonProblems(game.player, "player"), ...jsonProblems(serializeRun(game.run), "run")];
    if (bad.length) fail(`${what}: not plain JSON (R5): ${bad.slice(0, 4).join("; ")}`);
    return bad.length;
  };
  // A creature as it was and as a load rebuilt it: every field the whitelist keeps (§7.2's and the ones P0's
  // creatures keep their state in; the check's own list, so dropping one from CREATURE_FIELDS shows), its looks'
  // glyph and size, and talk's state and met.
  const sameCreature = (what, o, c) => {
    for (const f of new Set([...KEEP, ...CREATURE_FIELDS, "glyph", "w", "h"]))
      if (JSON.stringify(o[f]) !== JSON.stringify(c[f])) fail(`${what} creature ${c.id} (${c.type}): ${f} ${JSON.stringify(o[f])} → ${JSON.stringify(c[f])}`);
    const talk = (e) => JSON.stringify(e.talk ? { state: e.talk.state, met: e.talk.met } : null);
    if (talk(o) !== talk(c)) fail(`${what} creature ${c.id} (${c.type}): talk ${talk(o)} → ${talk(c)}`);
  };
  const idsAbove = (what) => {
    const n = entityCounter();
    for (const z of game.zones.values()) {
      for (const c of z.creatures) if (!(c.id < n)) fail(`${what}: ${z.key} holds creature id ${c.id}, the counter is ${n}`);
      for (const id of z.sightings.keys()) if (!(id < n)) fail(`${what}: ${z.key} has a sighting of id ${id}, the counter is ${n}`);
    }
  };

  // --- 1. The gate ------------------------------------------------------------------------------------------
  const session = await runSession({ seed: 1234 });
  if (!session.ok) fail(`the 10-zone session: ${session.problems.join("; ")}`);
  stats.session = session.steps[0];
  const keys = visitedKeys(game);
  const sessionZones = [...game.zones.values()];   // (for 2: the visited zones and the neighbours made ahead)
  if (keys.length < 10) fail(`the session visited ${keys.length} zones, not 10`);
  if (!canSave(game)) fail(`after the session, mode ${game.mode}: no save possible`);
  walk("after the session");
  const store = memoryAdapter();
  const before = await digestGame(game, keys);
  const t0 = performance.now();
  const saving = saveGame(game, { store, reason: "gate" });
  const snapMs = performance.now() - t0;
  const meta = await saving;
  const saveMs = performance.now() - t0;
  const dump = store.dump();
  const slotRec = dump.slots[0], zoneRecs = dump.zones;
  const sizes = zoneRecs.map((r) => JSON.stringify(r).length).sort((a, b) => a - b);
  stats.records = `slot ${JSON.stringify(slotRec).length} B (state ${JSON.stringify(slotRec.state).length}, player ${JSON.stringify(slotRec.player).length}, ` +
    `run ${JSON.stringify(slotRec.run).length}); ${zoneRecs.length} zones ${sizes[0]}-${sizes[sizes.length - 1]} B (median ${sizes[sizes.length >> 1]}), ` +
    `${sizes.reduce((a, b) => a + b, 0)} B in all; blocks ${zoneRecs.map((r) => JSON.stringify(r.blocks).length).join("/")} B deflated`;
  stats.saveMs = `snapshot ${snapMs.toFixed(1)} ms (synchronous), written ${saveMs.toFixed(1)} ms`;
  if (meta.zones !== keys.length || zoneRecs.length !== keys.length) fail(`saved ${zoneRecs.length} zone records (slot lists ${meta.zones}) for ${keys.length} visited zones`);
  if (typeof slotRec.blocks !== "undefined") fail("the slot record carries blocks");
  for (const k of ["id", "game", "version", "genVersion", "worldVersion", "created", "updated", "mode", "seed", "character", "where", "time", "state",
                   "player", "ids", "run", "zones", "unclean"]) if (!(k in slotRec)) fail(`the slot record has no ${k} (§7.2)`);
  for (const k of ["seed", "time", "uids", "zonePatches", "zoneLeft", "quests", "hints", "relicsFound", "merchants"])
    if (!(k in slotRec.state)) fail(`the saved state has no ${k} (§2.17)`);
  if (zoneRecs.some((r) => typeof r.blocks !== "string")) fail("a zone's blocks weren't deflated (Node 20.11 has CompressionStream)");
  // In this process, after another run has replaced everything.
  startRun(4321);
  game.pages = null;
  const builds = RUN_STATS.builds;
  await loadGame(meta.id, { store });
  if (RUN_STATS.builds !== builds) fail(`loadGame called buildRun ${RUN_STATS.builds - builds} time(s)`);
  if (getIds().entity !== slotRec.ids.entity) fail(`the id counter came back as ${getIds().entity}, saved ${slotRec.ids.entity}`);
  const loaded = keys.filter((k) => cachedZone(game, k));
  if (loaded.length !== 1 || loaded[0] !== slotRec.where.zoneKey) notes.push(`zones in memory right after the load: ${loaded.join(" ")}`);
  const after = await digestGame(game, keys);
  compare("loaded in this process", before, after);
  idsAbove("in this process");
  walk("after the load");
  stats.gate = `${keys.length} zones (${keys.join(" ")}); state ${before.state.length}, player ${before.player.length}, run ${before.run.length} chars; ` +
    `buildRun calls on load: ${RUN_STATS.builds - builds}; id counter ${getIds().entity}`;
  // In a fresh Node process.
  if (fresh) {
    try {
      const other = await fresh(dump, meta.id, keys);
      const n = problems.length;
      compare("loaded in a fresh process", before, other);
      if (other.builds !== 0) fail(`the fresh process called buildRun ${other.builds} time(s)`);
      if (other.idProblems?.length) fail(`fresh process: ${other.idProblems.slice(0, 3).join("; ")}`);
      stats.fresh = problems.length === n ? `identical (${Object.keys(other.zones).length} zones, buildRun ${other.builds} times)` : "differs";
    } catch (e) { fail(`the fresh process: ${String(e.message || e).slice(0, 300)}`); }
  }

  // --- 2. The codec -----------------------------------------------------------------------------------------
  {
    let zonesTried = 0, creatures = 0;
    const was = entityCounter();
    for (const deflate of [true, false]) {
      for (const z of sessionZones) {
        const rec = await encodeZone(z, { slot: "x", savedAt: 1 }, { deflate });
        if (deflate && typeof rec.blocks !== "string") fail(`${z.key}: deflate gave ${typeof rec.blocks}`);
        if (!deflate && typeof rec.blocks?.raw !== "string") fail(`${z.key}: { raw } expected`);
        const back = await decodeZone(JSON.parse(JSON.stringify(rec)));
        const again = await encodeZone(back, { slot: "x", savedAt: 1 }, { deflate });
        if (canonicalJson(rec) !== canonicalJson(again)) fail(`${z.key} (${deflate ? "deflate" : "raw"}): encode → decode → encode differs`);
        if (back.hasDerived || !back.sealed) fail(`${z.key}: decoded with derived arrays ${back.hasDerived}, sealed ${back.sealed}`);
        for (const c of back.creatures) {
          const o = z.creatures.find((q) => q.id === c.id);
          if (!o) { fail(`${z.key}: creature ${c.id} came back but wasn't there`); continue; }
          sameCreature(z.key, o, c);
          if (JSON.stringify(o.color) !== JSON.stringify(c.color) || c.x !== c.tx + 0.5 || c.y !== c.ty + 0.5) fail(`${z.key} creature ${c.id}: colour or place`);
          creatures++;
        }
        zonesTried++;
      }
    }
    if (entityCounter() !== was) fail(`decoding moved the id counter ${was} → ${entityCounter()}`);
    // Behind it, a creature rebuilt with an id at or past the counter moves the counter past it (rebuildCreature's
    // own guard, beside loadGame's): the counter set to 1, a zone decoded, the counter above every id in it.
    const topId = (z) => Math.max(0, ...z.creatures.map((c) => c.id));
    const zc = sessionZones.reduce((a, z) => (!a || topId(z) > topId(a) ? z : a), null);
    if (!zc || topId(zc) <= 1) fail("no session zone holds a creature id above 1 to rebuild (rebuildCreature's guard untested)");
    else {
      const rec = await encodeZone(zc, { slot: "x", savedAt: 1 }, { deflate: false }), top = topId(zc);
      let after;
      try { setEntityCounter(1); await decodeZone(JSON.parse(JSON.stringify(rec))); after = entityCounter(); }
      finally { setEntityCounter(was); }
      if (!(after > top)) fail(`${zc.key} decoded with the id counter at 1: the counter ${after}, the zone's ids up to ${top} (rebuildCreature)`);
      stats.rebuildGuard = `${zc.key} (ids up to ${top}) decoded with the counter at 1: ${after} after`;
    }
    const dropped = KEEP.filter((f) => !CREATURE_FIELDS.includes(f));
    if (dropped.length) fail(`CREATURE_FIELDS no longer keeps ${dropped.join(", ")}`);
    const allowed = new Set([...CREATURE_FIELDS, "talk", "vis"]);
    for (const z of sessionZones) for (const c of z.creatures) {
      const extra = Object.keys(trimCreature(c)).filter((k) => !allowed.has(k));
      if (extra.length) fail(`a trimmed ${c.type} keeps ${extra.join(", ")}`);
    }
    stats.codec = `${zonesTried / 2} zones of the session round-trip deflated and raw (${creatures / 2} creatures rebuilt); DEFLATE_AVAILABLE ${DEFLATE_AVAILABLE}`;
    if (!DEFLATE_AVAILABLE || !CODEC.deflate) fail("Node 20.11 should have CompressionStream(\"deflate\")");
    const z = game.zone;
    // Projectiles in flight are dropped.
    z.projectiles.push({ x: 1, y: 1, z: 3, vx: 1, vy: 0, vz: 0, from: game.player, kind: "knife" });
    const rp = await encodeZone(z, {});
    if ("projectiles" in rp || (await decodeZone(rp)).projectiles.length) fail("a projectile in flight was saved");
    z.projectiles.length = 0;
    // A field that isn't JSON is refused until it has a codec.
    z.oddField = new Map([[3, { a: 1 }]]);
    let refused = false;
    try { snapshotZone(z, {}); } catch (e) { refused = /oddField/.test(e.message); }
    if (!refused) fail("a zone field holding a Map was saved without a codec");
    registerZoneField("oddField", { encode: (m) => [...m], decode: (a) => new Map(a) });
    const ro = await decodeZone(await encodeZone(z, {}));
    if (!(ro.oddField instanceof Map) || ro.oddField.get(3)?.a !== 1) fail("a registered zone field didn't come back");
    delete z.oddField;
    // The walker.
    class Thing { constructor() { this.a = 1; } }
    const cyc = { a: 1 }; cyc.self = cyc;
    const shared = { s: 1 };
    for (const [what, v, shouldFail] of [["a Set", { s: new Set([1]) }, 1], ["a Map", { m: new Map() }, 1], ["a typed array", { t: new Uint8Array(2) }, 1],
      ["a function", { f: () => 1 }, 1], ["a class instance", { c: new Thing() }, 1], ["a cycle", cyc, 1], ["NaN", { n: NaN }, 1],
      ["undefined in an array", { a: [1, undefined] }, 1], ["one object twice", { a: shared, b: shared }, 1],
      ["plain JSON", { a: [1, "x", { b: null, c: true }], u: undefined }, 0]])
      if (!!jsonProblems(v).length !== !!shouldFail) fail(`the R5 walker on ${what}: ${JSON.stringify(jsonProblems(v))}`);
    // zlib's deflate (not raw): the stream starts 0x78.
    const packed = await packBytes(new Uint8Array(100), { deflate: true });
    if (fromB64(packed)[0] !== 0x78) fail("deflated blocks aren't in the zlib format");
    // "deflate-raw" nowhere in src/.
    const hits = [];
    // (Node's fs only here, so the module also loads in the browser: tests/checks/index.js, check-imports.)
    const { default: fs } = await import("node:fs"), { default: path } = await import("node:path");
    const scan = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) scan(f); else if (/\.(js|mjs|html)$/.test(e.name) && fs.readFileSync(f, "utf8").includes("deflate-raw")) hits.push(path.relative(root, f));
    } };
    scan(path.join(root, "src"));
    if (hits.length) fail(`"deflate-raw" in ${hits.join(", ")} (Node 20.11 rejects it: §7.2)`);
  }

  // --- 3. The store -----------------------------------------------------------------------------------------
  {
    const s = memoryAdapter();
    const v = { id: "a", n: 1, deep: { x: 1 } };
    await s.put("slots", v);
    v.deep.x = 2;
    const got = await s.get("slots", "a");
    if (got.deep.x !== 1) fail("the store kept a live object (put didn't copy)");
    got.deep.x = 3;
    if ((await s.get("slots", "a")).deep.x !== 1) fail("get handed out the stored object itself");
    try { await s.tx(async (t) => { await t.put("slots", { id: "b" }); throw new Error("no"); }); } catch { /* expected */ }
    if (await s.get("slots", "b")) fail("a tx that threw still wrote");
    const slow = memoryAdapter({ latency: 30 });
    const w = slow.put("zones", { slot: "s", key: "1,2,0", v: 1 });
    await tick(5);
    if (await slow.get("zones", ["s", "1,2,0"])) fail("a held commit was visible before it landed");
    await w;
    if (!(await slow.get("zones", ["s", "1,2,0"]))) fail("a commit never landed");
    await slow.put("zones", { slot: "t", key: "0,0,0" });
    if ((await slow.list("zones", { slot: "s" })).length !== 1) fail("list by slot");
    // Transactions commit in the order they were opened, as IndexedDB's do: the first held up, the second at once.
    const ord = memoryAdapter();
    const first = ord.tx(async (t) => { await tick(30); await t.put("slots", { id: "o", n: 1 }); });
    const second = ord.tx(async (t) => { await t.put("slots", { id: "o", n: 2 }); });
    await Promise.all([first, second]);
    if ((await ord.get("slots", "o")).n !== 2) fail("memory transactions committed out of the order they were opened (the first held up landed last)");
    const copy = memoryAdapter({ from: slow.dump() });
    if ((await copy.list("zones")).length !== 2) fail("dump → from lost rows");
    const idb = idbAdapter();
    let rejects = 0;
    for (const m of ["get", "put", "del", "list", "tx"]) await idb[m]("slots", "x").catch(() => rejects++);
    if (rejects !== 5 || idb.name !== "gnomon-saves") fail(`idbAdapter stub: ${rejects} of 5 calls reject, name ${idb.name}`);
  }

  // --- 4. Saving ----------------------------------------------------------------------------------------------
  {
    startRun(77);
    game.pages = null; game.story.cube = true;
    game.debug.enterZone("0,0,1", "down");
    playing(game, "map");
    const s = memoryAdapter(), p = game.player, z = game.zone, c = z.creatures.find((q) => !q.talk);
    // Snapshot first.
    const hp = p.hp, t = game.time, block = z.get(5, 5, FLOOR_Z), chp = c?.hp;
    const pr = saveGame(game, { store: s });
    p.hp = hp - 3; game.time = t + 100; z.set(5, 5, FLOOR_Z, block === B.STONE ? B.ROCK : B.STONE); if (c) c.hp = chp - 1;
    game.state.flags = { probe: 1 };
    const m = await pr;
    const slot = await s.get("slots", m.id), zr = await s.get("zones", [m.id, z.key]);
    const zback = await decodeZone(zr);
    if (slot.player.hp !== hp || slot.time !== t || slot.state.time !== t || slot.state.flags) fail(`snapshot-first: the slot has hp ${slot.player.hp} (was ${hp}), time ${slot.time}/${slot.state.time} (was ${t}), flags ${JSON.stringify(slot.state.flags)}`);
    if (zback.get(5, 5, FLOOR_Z) !== block || (c && zback.creatures.find((q) => q.id === c.id)?.hp !== chp)) fail("snapshot-first: the zone record has changes made after saveGame returned");
    p.hp = hp; game.time = t; z.set(5, 5, FLOOR_Z, block); if (c) c.hp = chp; delete game.state.flags;
    // Waiting: a screen no save is made under, then one a save would look through but whose data holds a callback.
    for (const [what, open, close] of [["a busy screen", () => pushMode(game, BUSY, null, { pointer: false }), () => popMode(game, undefined, { pointer: false })],
                                       ["a screen a save looks through, with a callback", () => pushMode(game, "inventory", { onPop() {} }, { pointer: false }), () => popMode(game, undefined, { pointer: false })]]) {
      open();
      if (screenFor(game.mode)?.saveable) fail(`${what} is saveable`);
      let done = false;
      const before = s.stats.commits;
      const wp = saveGame(game, { store: s }).then(() => { done = true; });
      game.debug.step(1 / 60); await tick(10);
      if (done || s.stats.commits !== before) fail(`a save asked for over ${what} didn't wait`);
      close();
      game.debug.step(1 / 60);
      await Promise.race([wp, tick(2000)]);
      if (!done) fail(`a save asked for over ${what} never happened back on the map`);
    }
    // Write-behind: leave level 1 for level 2 with a commit held open.
    const held = memoryAdapter({ latency: 40 });
    await saveGame(game, { store: held });
    const A = game.zone.key;
    game.debug.enterZone("0,0,2", "down");
    playing(game, "map");
    // (no await before these: the write is held open 40 ms)
    if (!saveStatus(game).pending.includes(A)) fail(`leaving ${A} started no write (pending: ${saveStatus(game).pending})`);
    if (evictZone(game, A) || !cachedZone(game, A)) fail("a zone left memory before its write had committed");
    if (evictDormant(game, 0).includes(A)) fail("evictDormant took a zone whose write hadn't committed");
    await whenWritten(game);
    const atLeave = await digestGame(game, [A]);   // (a dormant zone doesn't change: as you left it)
    if (saveStatus(game).pending.length || !saveStatus(game).committed.includes(A)) fail(`after the commit: ${JSON.stringify(saveStatus(game))}`);
    if (!evictZone(game, A) || cachedZone(game, A)) fail("a dormant zone with a committed record couldn't leave memory");
    const gens = { n: 0 }, real = ZONE_GENERATORS.dungeon;
    ZONE_GENERATORS.dungeon = (...a) => { gens.n++; return real(...a); };
    const readBack = await digestGame(game, [A]);
    ZONE_GENERATORS.dungeon = real;
    if (readBack.zones[A] !== atLeave.zones[A]) fail(`${A} read back from the store differs from the zone you left`);
    if (gens.n) fail(`reading ${A} back generated ${gens.n} zone(s)`);
    // Order: the first write slow, the second fast; the second must still land last.
    const base = memoryAdapter(), delays = [];
    const ordered = { ...base, writeNow: (ops) => { const d = delays.shift() ?? 0; return tick(d).then(() => base.writeNow(ops)); } };
    await saveGame(game, { store: ordered });
    delays.push(60, 0);   // (the two write-behinds below: the first slow, the second fast)
    const L2 = game.zone.key;
    game.zone.markers.push({ x: 1, y: 1 });
    game.debug.enterZone(A, "up"); playing(game, "map");   // write 1 (slow): one marker
    game.debug.enterZone(L2, "down"); playing(game, "map");
    game.zones.get(L2).markers.push({ x: 2, y: 2 });       // (you're in it: the next leave writes two)
    game.debug.enterZone(A, "up"); playing(game, "map");   // write 2 (fast): two markers
    await whenWritten(game);
    await tick(100);   // past the slow write's 60 ms: had the writes not waited for each other, it lands only now
    const last = await base.get("zones", [game.saving.slotId, L2]);
    if (last?.markers?.length !== game.zones.get(L2).markers.length) fail(`writes landed out of order: the store holds ${last?.markers?.length} markers for ${L2}, the zone ${game.zones.get(L2).markers.length}`);
    // evictDormant keeps the zone you're in and its straight neighbours.
    const ev = evictDormant(game, 0);
    if (ev.includes(game.zone.key) || !cachedZone(game, game.zone.key)) fail("evictDormant evicted the zone you're in");
    stats.writeBehind = `pending ${A} refused eviction until its commit (40 ms held), then left memory and came back identical; out-of-order delays (60/0 ms) landed in order; evictDormant(0) took ${ev.length}`;
    if (ZONE_RULES.keepDormant !== 24) fail(`ZONE_RULES.keepDormant ${ZONE_RULES.keepDormant} (§2.2: 24)`);
  }

  // --- 5. Loading -------------------------------------------------------------------------------------------
  {
    const s = memoryAdapter();
    const sess = await runSession({ seed: 7, zones: 10 });
    if (!sess.ok) fail(`session seed 7: ${sess.problems.join("; ")}`);
    const keys7 = visitedKeys(game);
    // A staged prefetch under way and a callback on the stack are never saved.
    game.prefetchJob = { key: "9,9,0", run: game.run, it: (function* () { yield 1; })(), stages: 1 };
    const meta = await saveGame(game, { store: s });
    const slot = await s.get("slots", meta.id);
    if (/prefetch|onPop|modeStack/.test(JSON.stringify(slot))) fail("the slot record holds prefetch state or the mode stack");
    const enters = [];
    const off = on("zone:enter", (g, e) => enters.push({ how: e.how, first: e.first }));
    startRun(5);
    game.pages = null; playing(game, "map");
    // Loaded from the map (not the title), with frames running and drawn while the store is read.
    let settledLoad = false, framesDuring = 0, zoneless = 0;
    const loading = loadGame(meta.id, { store: s }).finally(() => { settledLoad = true; });
    try {
      for (let k = 0; k < 400 && !settledLoad; k++) {
        await tick(0);
        if (settledLoad) break;
        if (!game.zone) zoneless++;
        game.debug.step(1 / 60); game.debug.draw(); framesDuring++;
      }
      await loading;
    } catch (e) { fail(`a frame during a load from the map: ${String(e.stack || e).split(/\r?\n/).slice(0, 3).join(" | ")}`); await loading.catch(() => {}); }
    if (!zoneless) notes.push(`no frame ran while the load had no zone yet (${framesDuring} frames during it)`);
    off();
    const top = game.modeStack;
    const wantStack = game.view === "map" ? ["map"] : ["explore", "pause"];
    if (top.map((e) => e.mode).join() !== wantStack.join() || top.some((e) => e.data !== null)) fail(`after a load the stack is ${JSON.stringify(top)}`);
    if (game.prefetchJob !== null || game.prefetchSeen !== null) fail("prefetch state came back from a load");
    const last = enters[enters.length - 1];
    if (!last || last.how !== "load" || last.first !== false) fail(`zone:enter on a load: ${JSON.stringify(last)}`);
    // Back over an edge into a stored span, and down into a stored level: read, never generated.
    playing(game, "map");
    const gens = { n: 0 }, real = { ...ZONE_GENERATORS };
    for (const k of ["surface", "dungeon"]) ZONE_GENERATORS[k] = (...a) => { gens.n++; return real[k](...a); };
    const back = ["n", "e", "s", "w"].map((side) => neighbourAddr(game, game.zone, side)).find((a) => a && keys7.includes(a.key));
    if (!back) fail(`no stored neighbour of ${game.zone.key}`);
    else {
      const r = await changeZone(game, back.key, { how: "travel" });
      if (r !== true || game.zone.key !== back.key) fail(`changeZone into the stored ${back.key}: ${r}, in ${game.zone.key}`);
    }
    const lvl = keys7.find((k) => k.endsWith(",2"));
    const r2 = changeZone(game, lvl, { how: "down" });
    if (!(r2 instanceof Promise)) fail(`changeZone into the stored ${lvl} (not in memory) didn't read it asynchronously`);
    if ((await r2) !== true || game.zone.key !== lvl) fail(`down into the stored ${lvl}: in ${game.zone.key}`);
    Object.assign(ZONE_GENERATORS, real);
    if (gens.n) fail(`moving into stored zones generated ${gens.n} zone(s)`);
    // Refusals.
    for (const [what, change, re] of [["another game's slot", { game: "other" }, /save of other/], ["another save version", { version: 99 }, /save version/],
                                      ["another map version", { worldVersion: 99 }, /map version/]]) {
      await s.put("slots", { ...slot, ...change, id: "bad" });
      let msg = "";
      try { await loadGame("bad", { store: s }); } catch (e) { msg = e.message; }
      if (!re.test(msg)) fail(`loading ${what}: ${msg || "accepted"}`);
    }
    await s.put("slots", { ...slot, id: "bad", where: { ...slot.where, zoneKey: "39,19,0" } });
    let msg = "";
    try { await loadGame("bad", { store: s }); } catch (e) { msg = e.message; }
    if (!/no record/.test(msg)) fail(`loading a slot without the zone you were in: ${msg || "accepted"}`);
    await deleteSlot("bad", { store: s });
    // listSlots, deleteSlot.
    await tick(2);
    const meta2 = await saveGame(game, { store: s, slotId: "second" }).catch((e) => fail(`a second slot: ${e.message}`));
    const list = await listSlots({ store: s });
    if (list.length !== 2 || list[0].id !== meta2?.id) fail(`listSlots: ${JSON.stringify(list.map((l) => [l.id, l.updated]))}`);
    if (!(await deleteSlot(meta.id, { store: s })) || (await s.list("zones", { slot: meta.id })).length || (await listSlots({ store: s })).length !== 1)
      fail("deleteSlot left the slot or its zones");
    stats.load = `from the map with ${framesDuring} frames drawn during it (${zoneless} with no zone yet); stack ${wantStack.join("+")}; zone:enter how=load first=false; stored span and level read back (${gens.n} generated); 4 refusals`;
  }

  // --- 6. The title screen ----------------------------------------------------------------------------------
  if (screen) {
    const env = await screen(100, 30), was = currentStore(), s = useStore(memoryAdapter());
    const text = () => { game.debug.draw(); return env.frameText(); };
    const key = (code, k = code) => inputHandlers.onKeyDown(code, false, k);
    const click = (label) => {   // a left click on the first cell of `label` where the frame shows it
      const lines = text().split(/\n/), y = lines.findIndex((l) => l.includes(label));
      if (y < 0) { fail(`the title shows no "${label}"`); return; }
      inputHandlers.onMouseDown(0, lines[y].indexOf(label) + 1, y);
    };
    const settle = async () => { for (let k = 0; k < 200 && game.mode === "title"; k++) await tick(5); };
    const saveOne = async () => {
      game.pages = null; playing(game, "map");
      game.debug.enterZone("0,0,1", "down"); playing(game, "map");
      // (A save asked for where none can be made waits for a frame that never comes here: say so instead.)
      if (!canSave(game)) { fail(`a save asked for in ${game.mode} at ${game.zone?.key} would wait (zone loading: ${game.zoneLoading})`); return null; }
      return saveGame(game, {});
    };
    // The first item: "New quick game" on p0-done, "New game" once WS4's wizard is registered (p2-ws4a), which it opens
    // with the title's seed and mode (WS4 #12; at the WS9 merge); the wizard by Enter alone starts the run in that mode.
    const wizard = !!screenFor("create"), first = wizard ? "New game" : "New quick game";
    const begun = async (how, want) => {
      if (wizard) {
        if (game.mode !== "create") { fail(`${how} on "${first}": mode ${game.mode}, not the wizard`); return; }
        await throughWizard(game, key);
      }
      if (game.mode !== "story" || !game.player || game.zone?.key !== "0,0,0" || game.state?.mode !== want)
        fail(`${how} on "${first}": mode ${game.mode}, zone ${game.zone?.key}, the run's mode ${game.state?.mode} (want ${want})`);
      else ways++;
    };
    await openTitle(game);
    let t = text(), ways = 0;
    if (game.mode !== "title" || !t.includes(first) || t.includes("Continue")) fail(`the title with nothing saved: mode ${game.mode}, "${t.replace(/\s+/g, " ").trim().slice(0, 120)}"`);
    const m0 = game.messages.length;
    key("KeyM", "m");
    if (game.messages.length !== m0 + 1 || !/Music/.test(game.messages[game.messages.length - 1]?.text)) fail("M didn't switch the music on the title screen");
    key("KeyM", "m");
    key("ArrowDown"); key("Enter"); key("Enter"); key("ArrowUp");   // the mode line twice: Pilgrim
    key("Enter");
    await begun("Enter", "pilgrim");
    await openTitle(game);
    click(first);
    await begun("a click", "pilgrim");
    await openTitle(game); key("ArrowDown"); key("Enter");   // (the mode line once more: One Wick again, as section 17 expects it)
    // Continue: by ↓ Enter, by 2, by a click; each loads the newest slot.
    for (const how of ["keys", "digit", "click"]) {
      const m = await saveOne();
      if (!m) continue;
      startRun(11); game.pages = null;
      await openTitle(game);
      t = text();
      if (!t.includes("Continue")) { fail(`the title with a slot saved shows no Continue (${how})`); continue; }
      if (how === "keys") { key("ArrowDown"); key("Enter"); } else if (how === "digit") key("Digit2", "2"); else click("Continue");
      await settle();
      if (game.mode === "title" || game.saving?.slotId !== m.id || game.zone?.key !== "0,0,1") fail(`Continue by ${how}: mode ${game.mode}, slot ${game.saving?.slotId} (want ${m.id}), zone ${game.zone?.key}`);
      else ways++;
    }
    stats.title = `100×30: ${first}${wizard ? " (through the wizard, the run in the title's Pilgrim)" : ""} and Continue reached ${ways} of 5 ways (Enter, click; ↓ Enter, 2, click)`;
    useStore(was);
  }

  // --- 7. The gate on more seeds ----------------------------------------------------------------------------
  // The same session, save and load on each seed (the gate asks for 3 with 1234): canonical JSON identical in this
  // process and in a fresh one, buildRun never called by a load, the id counter above every loaded id.
  const gates = [];
  for (const seed of seeds) {
    const n0 = problems.length;
    const s = await runSession({ seed });
    if (!s.ok) fail(`seed ${seed}: the 10-zone session: ${s.problems.join("; ")}`);
    const ks = visitedKeys(game);
    if (ks.length < 10) fail(`seed ${seed}: the session visited ${ks.length} zones, not 10`);
    walk(`seed ${seed}, after the session`);
    const st = memoryAdapter(), was = currentStore();
    const a = await digestGame(game, ks);
    const m = await saveGame(game, { store: st, reason: "gate" });
    startRun(seed + 1000); game.pages = null;
    const b0 = RUN_STATS.builds;
    await loadGame(m.id, { store: st });
    if (RUN_STATS.builds !== b0) fail(`seed ${seed}: loadGame called buildRun ${RUN_STATS.builds - b0} time(s)`);
    compare(`seed ${seed}, loaded in this process`, a, await digestGame(game, ks));
    idsAbove(`seed ${seed}`);
    walk(`seed ${seed}, after the load`);
    let freshly = "not run";
    if (fresh) {
      try {
        const other = await fresh(st.dump(), m.id, ks);
        const n1 = problems.length;
        compare(`seed ${seed}, loaded in a fresh process`, a, other);
        if (other.builds !== 0) fail(`seed ${seed}: the fresh process called buildRun ${other.builds} time(s)`);
        if (other.idProblems?.length) fail(`seed ${seed}, fresh process: ${other.idProblems.slice(0, 3).join("; ")}`);
        freshly = problems.length === n1 ? "identical" : "differs";
      } catch (e) { fail(`seed ${seed}, the fresh process: ${String(e.message || e).slice(0, 300)}`); }
    }
    useStore(was);
    gates.push(`${seed}: ${ks.length} zones, run ${a.run.length} chars, ${problems.length === n0 ? "identical" : "DIFFERS"} (fresh process ${freshly})`);
  }
  if (seeds.length) stats.moreSeeds = gates.join("; ");

  // --- 8. What the session doesn't reach --------------------------------------------------------------------
  // Save → load → canonical JSON identical (in this process) for states the bot's 10-zone session never makes.
  const hard = [];
  const roundTrip = async (what) => {
    const ks = visitedKeys(game), st = memoryAdapter(), n = problems.length;
    let a, m;
    try { a = await digestGame(game, ks); m = await saveGame(game, { store: st, reason: "check" }); }
    catch (e) { fail(`${what}: the save was refused: ${String(e.message || e).slice(0, 240)}`); hard.push(`${what}: REFUSED`); return false; }
    startRun(4321); game.pages = null;
    await loadGame(m.id, { store: st });
    compare(what, a, await digestGame(game, ks));
    idsAbove(what);
    hard.push(`${what}: ${problems.length === n ? "identical" : "DIFFERS"}`);
    return problems.length === n;
  };
  const near = (zone, c) => {   // stand 2 tiles from c (as tools/bot.mjs runSmoke does), out of harm's way
    const p = game.player;
    const spot = [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [0, 3]].map(([ox, oy]) => [c.tx + ox, c.ty + oy])
      .find(([x, y]) => x >= 0 && y >= 0 && x < zone.w && y < zone.d && zone.stand[x + y * zone.w] >= 0);
    if (spot) Object.assign(p, { x: spot[0] + 0.5, y: spot[1] + 0.5, z: zone.stand[spot[0] + spot[1] * zone.w], vz: 0 });
    p.maxHpGain = 1e6; p.hp = 1e6;
  };
  const passTime = (view, until, max = 900) => {   // frames in 3D, waits on the map, until `until()` (or max)
    for (let k = 0; k < max && !until(); k++) {
      if (game.mode !== (view === "map" ? "map" : "explore")) playing(game, view);
      if (view === "map") game.debug.mapKey("Space"); else game.debug.step(1 / 60);
      game.player.hp = 1e6;
    }
    playing(game, view);
    return until();
  };
  // The Colossus (legacy level 15) after it slams: zone.slam and zone.slamDone hold Sets (codec.js registers them).
  for (const view of ["map", "3d"]) {
    startRun(1234); game.pages = null; game.story.cube = true;
    game.debug.enterZone("0,0,15", "down");
    playing(game, view);
    const zone = game.zone, col = zone.creatures.find((c) => c.guardian === "colossus");
    if (!col) { fail("legacy level 15 has no Colossus"); continue; }
    near(zone, col);
    col.state = "chase";
    if (!passTime(view, () => zone.slamDone && zone.slam)) { fail(`level 15 (${view}): the Colossus never slammed (slamDone ${!!zone.slamDone}, slam ${!!zone.slam})`); continue; }
    const cells = [...zone.slamDone.cells].sort((a, b) => a - b).join();
    if (await roundTrip(`level 15 after the Colossus's slam, a slam warned (${view})`)) {
      const back = game.zone.slamDone;
      if (!(back?.cells instanceof Set) || [...back.cells].sort((a, b) => a - b).join() !== cells || !(game.zone.slam?.cells instanceof Set))
        fail(`level 15 (${view}): the slam came back as ${JSON.stringify(back && { ...back, cells: [...back.cells || []].length })}`);
    }
  }
  // A busy run state (the session leaves most of it empty): on legacy level 20 a monster hurt, poisoned and chasing
  // you, the Lich King in its second phase, pits looked into (holeSeen); a zone patch applied there (its uid
  // claimed) and one waiting for a level not made yet; the temple's person met.
  {
    startRun(1234); game.pages = null; game.story.cube = true;
    const person = game.zone.creatures.find((c) => c.talk);
    if (person) person.talk.met = true; else fail("the temple has no one to meet");
    game.debug.enterZone("0,0,20", "down");
    playing(game, "map");
    const zone = game.zone, boss = zone.creatures.find((c) => CREATURE_TYPES[c.type]?.boss);
    const m = zone.creatures.find((c) => !c.talk && c !== boss && c.maxHp > 2);
    if (!boss || !m) fail(`level 20: boss ${boss?.type}, a monster ${m?.type}`);
    else {
      m.hp = m.maxHp - 2; m.state = "chase";
      addStatus(game, m, "poisoned", { t: 30 });
      boss.phase = 1; boss.hp = Math.floor(boss.maxHp * 0.6);
      for (const k of [3, 50, 200, zone.w * 7 + 9]) zone.holeSeen[k] = 1;
      addZonePatch(game, zone.key, { op: "spawnCreature", type: "goblin", uid: "check:here", relativeTo: "arrival" });
      addZonePatch(game, "0,0,7", { op: "spawnCreature", type: "goblin", uid: "check:later", relativeTo: "arrival" });
      claimUid(game, "check:claimed", zone.key);
      const live = [...zone.creatures], st = game.state;
      const busy = `${Object.keys(st.uids).length} uids, ${Object.keys(st.zonePatches).length} zone(s) with patches waiting, ${Object.keys(zone.appliedPatches).length} applied`;
      if (!st.uids["check:here"] || !st.zonePatches["0,0,7"] || !m.status?.poisoned) fail(`level 20: the busy state wasn't made (${busy}, status ${JSON.stringify(m.status)})`);
      if (await roundTrip(`level 20 busy (${busy}; a monster hurt, poisoned and chasing; the boss in phase 1; 4 pit cells; the temple's person met)`)) {
        if (game.zone.key !== zone.key) fail(`the busy load is in ${game.zone.key}`);
        for (const o of live) {
          const c = game.zone.creatures.find((q) => q.id === o.id);
          if (!c) fail(`level 20: creature ${o.id} (${o.type}) didn't come back`); else sameCreature("level 20 (busy)", o, c);
        }
        const back = (await getZone(game, "0,0,0")).creatures.find((c) => c.id === person?.id);
        if (person && back?.talk?.met !== true) fail(`the temple's person came back with talk.met ${back?.talk?.met}`);
      }
    }
  }
  // An awake guardian and its summons (legacy level 10, 3D): its fight (g) and the summons' halved xp come back,
  // and it doesn't wake a second time.
  {
    let wakes = 0;
    const off = on("guardian:wake", () => { wakes++; });
    startRun(1234); game.pages = null; game.story.cube = true;
    game.debug.enterZone("0,0,10", "down");
    playing(game, "3d");
    const zone = game.zone, w = zone.creatures.find((c) => c.guardian === "warden");
    if (!w) fail("legacy level 10 has no Gloom Warden");
    else {
      near(zone, w);
      w.state = "chase";
      passTime("3d", () => zone.creatures.some((c) => c.type === "shade"));
      const id = w.id, g = JSON.stringify(w.g), shades = zone.creatures.filter((c) => c.type === "shade");
      const xp = shades.map((c) => `${c.id}:${c.xp}`).join();
      if (!w.g || !shades.length || wakes !== 1) fail(`level 10: the Gloom Warden woke ${wakes} time(s), fight ${g}, ${shades.length} shades`);
      else if (await roundTrip("level 10, the Gloom Warden awake with its shades (3d)")) {
        const w2 = game.zone.creatures.find((c) => c.id === id);
        const xp2 = game.zone.creatures.filter((c) => c.type === "shade").map((c) => `${c.id}:${c.xp}`).join();
        if (JSON.stringify(w2?.g) !== g) fail(`level 10: the Gloom Warden's fight came back as ${JSON.stringify(w2?.g)} (saved ${g})`);
        if (xp2 !== xp) fail(`level 10: the shades' xp came back as ${xp2} (saved ${xp}: summoned things are worth half)`);
        game.debug.lockChange?.(true);
        passTime("3d", () => false, 30);
        if (wakes !== 1) fail(`level 10: after the load the Gloom Warden woke again (${wakes} wakes)`);
      }
    }
    off();
  }
  // Zones made after the save and left (write-behind wrote them): a load sets the id counter above their ids too,
  // before any zone is read, so no id is handed out twice.
  {
    startRun(1234); game.pages = null; game.story.cube = true;
    playing(game, "map");
    const st = memoryAdapter(), m = await saveGame(game, { store: st });
    const atSave = entityCounter();
    for (const key of ["0,0,1", "0,0,2"]) { await changeZone(game, key, { how: "down" }); playing(game, "map"); }
    await changeZone(game, "0,0,0", { how: "up" }); playing(game, "map");
    await whenWritten(game);
    const recs = await st.list("zones", { slot: m.id });
    const top = Math.max(...recs.flatMap((r) => r.creatures.map((c) => c.id)));
    startRun(4321); game.pages = null;
    await loadGame(m.id, { store: st });
    const n = entityCounter();
    if (!(n > top)) fail(`zones written after the save hold ids up to ${top}, and a load set the counter to ${n} (the slot's was ${atSave})`);
    for (const key of ["0,0,1", "0,0,2"]) await getZone(game, key);
    idsAbove("zones written after the save, read back");
    hard.push(`zones written after the save (ids up to ${top}; the slot's counter ${atSave}): the counter ${n} after a load`);
  }
  // The same run saved to another slot after a visited zone has left memory: the new slot has that zone, read back
  // as it was left (not generated afresh).
  {
    startRun(1234); game.pages = null; game.story.cube = true;
    playing(game, "map");
    await changeZone(game, "0,0,1", { how: "down" }); playing(game, "map");
    const L1 = game.zone, gone = L1.creatures.filter((c) => !c.talk).length;
    L1.creatures = L1.creatures.filter((c) => c.talk);   // every hostile on level 1 dead
    const st = memoryAdapter();
    await saveGame(game, { store: st });
    await changeZone(game, "0,0,2", { how: "down" }); playing(game, "map");
    await whenWritten(game);
    const left = await digestGame(game, [L1.key]);
    if (!evictZone(game, L1.key)) fail(`${L1.key} couldn't leave memory after its write`);
    const b = await saveGame(game, { store: st, slotId: "other" });
    const keysB = (await st.list("zones", { slot: "other" })).map((r) => r.key).sort();
    startRun(4321); game.pages = null;
    await loadGame(b.id, { store: st });
    const gens = { n: 0 }, real = ZONE_GENERATORS.dungeon;
    ZONE_GENERATORS.dungeon = (...a) => { gens.n++; return real(...a); };
    const back = await digestGame(game, [L1.key]);
    ZONE_GENERATORS.dungeon = real;
    if (!keysB.includes(L1.key) || gens.n || back.zones[L1.key] !== left.zones[L1.key])
      fail(`a save to another slot after ${L1.key} left memory: the slot holds ${keysB.join(" ")}; reading ${L1.key} generated ${gens.n} zone(s); ${back.zones[L1.key] === left.zones[L1.key] ? "identical" : "it differs from the zone left"}`);
    hard.push(`saved to another slot after ${L1.key} (${gone} hostiles killed) left memory: the slot holds ${keysB.join(" ")}, ${L1.key} read back ${gens.n ? "GENERATED" : "identical"}`);
  }
  // A save asked for over a screen no save is made under, then a new run before any frame back in a view: refused,
  // never written with the new run's state.
  {
    startRun(1234); game.pages = null; game.story.cube = true;
    playing(game, "map");
    pushMode(game, BUSY, null, { pointer: false });
    const st = memoryAdapter();
    let outcome = "pending";
    const wp = saveGame(game, { store: st }).then((m) => { outcome = `written (${m.id})`; }, (e) => { outcome = `refused: ${e.message}`; });
    startRun(2222); game.pages = null; playing(game, "map");
    game.debug.step(1 / 60);
    await Promise.race([wp, tick(500)]);
    const slots = await st.list("slots");
    if (!outcome.startsWith("refused") || slots.length) fail(`a save asked for in one run, then a new run: ${outcome}; ${slots.length} slot(s) written (seed ${slots[0]?.seed})`);
    hard.push(`a save waiting over a busy screen when a new run began: ${outcome.split(":")[0]}`);
  }
  stats.hardCases = hard.join("; ");

  await ws9Sections({ game, startRun, inputHandlers, runSession, fresh, screen, v1, child, seedRandom, fail, stats, notes, compare, walk, idsAbove, sameCreature, problems });
  return { name: "save", ok: problems.length === 0, problems, stats, notes };
}

// --- WS9 (TECH_DESIGN §8.3 "WS9"): sections 9-18 -----------------------------------------------------------
//   9. The gate after the bot's 30-zone session: save → load identical in this process and a fresh one, buildRun
//      never called, ids above every loaded one, R5's walker clean; the records' sizes, projected for 300 zones (≤ 3 MB).
//  10. Migrations (§7.6): a v1 save made by p0-done's own code (child.v1: git archive) loads here unchanged, and through
//      a v1 → v2 migration (the slot's and every zone record's, as each is read) comes back with exactly that change;
//      a chain runs in order; a missing step and a newer save are refused.
//  11. The Continue hazard: an item dropped after a save, the zone left, then a load: Phase 0 (no automatic saves)
//      has it twice; the save when the zone change completes leaves one.
//  12. The automatic saves: 120 s of play, 10 s of the world map (a stand-in "world" screen), back on the page;
//      prefetch reads a stored neighbour through the loader in both views, never generating it.
//  13. The unload save: a simulated `hidden` (and `pagehide`) commits the slot (live cleared) and the zone you are in,
//      uncompressed, with the zone you had just left written ahead of them, in the one transaction opened in the
//      handler; a load gives back that moment.
//  14. live and unclean: a load after a session that never saved cleanly counts it (and writes it back), a clean
//      save doesn't; One Wick's "death" rule ends that life instead (the slot gone, a grave), and only One Wick's.
//  15. Death: One Wick's slot and its rows go, with a grave; no save after. The Commons Lamp: checkpoints at the
//      run's start and on leaving the settlement (one slot record, no copies), copy on write over 5 zone changes,
//      then death and C: exactly the checkpoint's state, the zones first saved after it gone; and again.
//  16. Export → import into another store → load identical; the same file twice gets a new id; bad files refused;
//      a slot moved to another store with its checkpoint, and a save to another store with one up, restore there;
//      a run on the real world loads by state.world.id while new runs are built on the test world; an unknown
//      world is refused.
//  17. The shell at 100×30 through the real input: the title's mode, seed, Load a save (export, delete twice),
//      warnings; Esc on the pause card to the options (field of view kept in the store, the keys of both views),
//      save and quit (a clean slot) and Continue to the same tile; the line under the pause card after its beat
//      (not before); the message log on H (more than 40 messages, scrolling, both views); the death recap after
//      its beat (cause, damage, what the mode does), R keeping the mode, C waking a Commons Lamp life.
//  18. The HUD at 100×30: the hotbar's ready ability while something hunts you (not otherwise, not while it
//      cools), on one row with everything showing and dropped by priority; ?debug=1's line (child.debug).
//  19. Failed writes: a zone whose newest write failed stays in memory; a failed copy on write is made by the next write;
//      a failed checkpoint is given up; the player is told once.
//  20. The pause card in screen-frames.js's four "3d pause card" states at 180×56 (not compared there any more): outside
//      it the view as without it; inside, its lines centred in their colours; at 100×30 every key named.
async function ws9Sections(ctx) {
  const { game, startRun, inputHandlers, runSession, fresh, screen, child, seedRandom, fail, stats, notes, compare, walk, idsAbove, problems } = ctx;
  const save = await import("../../src/save/save.js");
  const { SAVE_RULES: RULES, SAVE_STATS, SESSION, listenPage, unloadSave, pageShown, wakeAtCheckpoint, exportSlot, importSlot, moveSlot,
          graveyard, migrate, checkpoint } = save;
  const { SCREENS, registerScreen } = await import("../../src/screens.js");
  const { prefetchNeighbours } = await import("../../src/zones.js");
  const { startCooldown, addStatus: addStatusTo } = await import("../../src/status.js");
  const hud = await import("../../src/hud.js");
  const frames = (n, dt = 1 / 60) => { for (let k = 0; k < n; k++) game.debug.step(dt); };
  const settle = async () => { frames(40); await whenWritten(game); await tick(0); await whenWritten(game); };
  const freshRun = (seed, { mode = "oneWick", store = null, view = "map", world } = {}) => {
    startRun(seed, world);
    game.pages = null; game.pendingPages = null; game.story.cube = true;
    game.state.mode = mode;
    playing(game, view);
    useStore(store);
  };
  const strip = (json, drop) => { const v = JSON.parse(json); drop(v); return canonicalJson(v); };
  const bombs = (list) => (list || []).filter((it) => it.kind === "bomb").reduce((n, it) => n + (it.count || 1), 0);
  const slotOf = (st, id) => st.get("slots", id);
  const rowsOf = async (st, id, name = "zones") => (await st.list(name, { slot: id })).map((r) => r.key).sort();

  // --- 9. The gate after 30 zones -------------------------------------------------------------------------
  {
    RULES.auto = false; useStore(null);
    const s = await runSession({ seed: 1234, zones: 30 });
    if (!s.ok) fail(`the 30-zone session: ${s.problems.join("; ")}`);
    const ks = visitedKeys(game), n0 = problems.length;
    if (ks.length < 30) fail(`the 30-zone session visited ${ks.length} zones, not 30`);
    walk("after the 30-zone session");
    const st = memoryAdapter(), a = await digestGame(game, ks);
    const t0 = performance.now(), pending = saveGame(game, { store: st, reason: "gate" }), snapMs = performance.now() - t0;
    const m = await pending, allMs = performance.now() - t0;
    const dump = st.dump(), slotB = JSON.stringify(dump.slots[0]).length, zoneB = dump.zones.map((r) => JSON.stringify(r).length);
    const zonesB = zoneB.reduce((x, y) => x + y, 0), per = zonesB / Math.max(1, zoneB.length), projected = slotB + per * 300;
    if (dump.zones.length !== ks.length) fail(`30 zones: ${dump.zones.length} zone records for ${ks.length} visited`);
    if (projected > 3 * 1024 * 1024) fail(`30 zones: 300 projected at ${(projected / 1048576).toFixed(2)} MB (§8.3: ≤ 3 MB)`);
    startRun(4321); game.pages = null;
    const b0 = RUN_STATS.builds;
    await loadGame(m.id, { store: st });
    if (RUN_STATS.builds !== b0) fail(`30 zones: loadGame called buildRun ${RUN_STATS.builds - b0} time(s)`);
    compare("30 zones, loaded in this process", a, await digestGame(game, ks));
    idsAbove("30 zones");
    walk("30 zones, after the load");
    let freshly = "not run";
    if (fresh) {
      try {
        const o = await fresh(dump, m.id, ks), n1 = problems.length;
        compare("30 zones, loaded in a fresh process", a, o);
        if (o.builds !== 0) fail(`30 zones: the fresh process called buildRun ${o.builds} time(s)`);
        if (o.idProblems?.length) fail(`30 zones, fresh process: ${o.idProblems.slice(0, 3).join("; ")}`);
        freshly = problems.length === n1 ? "identical" : "DIFFERS";
      } catch (e) { fail(`30 zones, the fresh process: ${String(e.message || e).slice(0, 300)}`); }
    }
    stats.gate30 = `${s.steps[0]} · save → load ${problems.length === n0 ? "identical" : "DIFFERS"} in this process, ${freshly} in a fresh one; buildRun on load 0; R5 walker clean`;
    stats.sizes30 = `slot ${slotB} B; ${zoneB.length} zone records ${Math.min(...zoneB)}-${Math.max(...zoneB)} B, ${zonesB} B in all (${per.toFixed(0)} B a zone); ` +
      `300 zones projected ${(projected / 1048576).toFixed(2)} MB (≤ 3 MB); the save's snapshot ${snapMs.toFixed(1)} ms (synchronous), written ${allMs.toFixed(1)} ms`;
  }

  // --- 10. Migrations, and p0-done's v1 save ------------------------------------------------------------------
  {
    let fx = null;
    if (child?.v1) { try { fx = await child.v1(); } catch (e) { fail(`the v1 save made by p0-done's code: ${String(e.message || e).slice(0, 300)}`); } }
    else notes.push("10: no v1 save from p0-done (child.v1 not given)");
    if (fx) {
      const n0 = problems.length;
      startRun(4321); game.pages = null;
      await loadGame(fx.slotId, { store: memoryAdapter({ from: fx.dump }) });
      compare("p0-done's v1 save, loaded here", fx.digest, await digestGame(game, fx.keys));
      const asIs = problems.length === n0;
      let zoneRuns = 0;
      const M = { 1: { slot: (r) => ({ ...r, state: { ...r.state, migratedFrom: r.version } }), zone: (z) => { zoneRuns++; return { ...z, migratedZone: z.v ?? 1 }; } } };
      startRun(4321); game.pages = null;
      await loadGame(fx.slotId, { store: memoryAdapter({ from: fx.dump }), version: 2, migrations: M });
      const got = await digestGame(game, fx.keys);
      if (game.state.migratedFrom !== 1) fail(`v1 → v2: state.migratedFrom ${game.state.migratedFrom}`);
      if (zoneRuns !== fx.keys.length) fail(`v1 → v2: the zone migration ran ${zoneRuns} times for ${fx.keys.length} zones read (once each, as each is read)`);
      const unmigrated = { ...got, state: strip(got.state, (v) => delete v.migratedFrom), zones: {} };
      for (const [k, z] of Object.entries(got.zones)) {
        if (JSON.parse(z).migratedZone !== 1) fail(`v1 → v2: zone ${k} wasn't migrated as it was read`);
        unmigrated.zones[k] = strip(z, (v) => delete v.migratedZone);
      }
      const n1 = problems.length;
      compare("v1 → v2, everything but the migration's change", fx.digest, unmigrated);
      const chain = migrate({ id: "c", version: 1 }, [{ key: "k" }], { to: 3, migrations: {
        1: { slot: (r) => ({ ...r, steps: [...(r.steps || []), 1] }), zone: (z) => ({ ...z, steps: [1] }) }, 2: { slot: (r) => ({ ...r, steps: [...r.steps, 2] }) } } });
      if (JSON.stringify(chain.slot.steps) !== "[1,2]" || chain.slot.version !== 3 || chain.zones[0].v !== 3 || JSON.stringify(chain.zones[0].steps) !== "[1]")
        fail(`a v1 → v3 chain: ${JSON.stringify(chain)}`);
      const refused = (f) => { try { f(); return ""; } catch (e) { return e.message; } };
      if (!/no migration from 2/.test(refused(() => migrate({ id: "c", version: 1 }, [], { to: 3, migrations: { 1: { slot: (r) => r } } }))))
        fail("a chain with a step missing wasn't refused");
      if (!/newer/.test(refused(() => migrate({ id: "c", version: 3 }, [], { to: 2 })))) fail("a save from a newer game wasn't refused");
      stats.migration = `p0-done's v1 save (${fx.keys.join(" ")}; made by that tree's code) loads here ${asIs ? "identical" : "DIFFERENT"}; ` +
        `v1 → v2 (state and every zone record, each once, as read: ${zoneRuns} for ${fx.keys.length}) ${problems.length === n1 ? "identical but for the change" : "DIFFERS"}; a v1 → v3 chain in order; a missing step and a newer save refused`;
    }
  }

  // --- 11. The Continue hazard ---------------------------------------------------------------------------------
  {
    const out = [];
    for (const [auto, busy] of [[false, false], [true, false], [true, true]]) {
      RULES.auto = auto;
      const st = memoryAdapter();
      freshRun(1234, { store: auto ? st : null });
      game.debug.enterZone("0,0,1", "down"); playing(game, "map");
      const m = await saveGame(game, { store: st });   // the save you will continue from
      await whenWritten(game);
      const L1 = game.zone.key, p = game.player, before = bombs(p.inv) + bombs(game.zone.items);
      game.debug.openInv();
      game.invSel = p.inv.findIndex((it) => it.kind === "bomb");
      inputHandlers.onKeyDown("KeyX", false, "x");   // drop it (the inventory's X)
      inputHandlers.onKeyDown("Escape", false, "Escape");
      playing(game, "map");
      if (bombs(game.zone.items) <= bombs((await st.get("zones", [m.id, L1]))?.items)) fail(`hazard (${auto ? "WS9" : "P0"}): the bomb wasn't dropped`);
      game.debug.enterZone("0,0,2", "down"); playing(game, "map");
      if (busy) pushMode(game, BUSY, null, { pointer: false });   // (a story page, talk, the "DEPTH n" beat: no save under it)
      await settle();
      startRun(4321); game.pages = null;   // the page dies with nothing more written; then Continue
      await loadGame(m.id, { store: st });
      const n = bombs(game.player.inv) + bombs((await getZone(game, L1)).items);
      out.push(`${auto ? `with the automatic saves${busy ? ", a busy screen up before the change's save" : ""}` : "P0 (no automatic saves)"}: ${n} bombs after the load, ${before} before the drop (loaded in ${game.zone.key})`);
      if (auto && n !== before) fail(`the Continue hazard${busy ? " (a busy screen up before the change's save)" : ""}: ${n} bombs after the load, ${before} before the drop`);
      if (busy && game.zone.key !== L1) fail(`the Continue hazard (a busy screen): loaded in ${game.zone.key}, not ${L1} (the last save)`);
      if (!auto && n === before) notes.push("11: the hazard didn't show without the automatic saves (the check's premise)");
    }
    stats.continueHazard = `${out.join("; ")}. The zone you leave is written with the next slot record, so a load is one moment: the last save's (with a busy screen up, before the change)`;
    RULES.auto = true;
  }

  // --- 12. The automatic saves; prefetch through the loader -------------------------------------------------
  {
    RULES.auto = true;
    const st = memoryAdapter();
    freshRun(77, { store: st });
    await settle();
    const reasons = () => game.saving?.last?.reason;
    if (!game.saving || reasons() !== "zone") fail(`the run's first save: ${JSON.stringify(game.saving?.last)}`);
    const s0 = SAVE_STATS.saves;
    frames(119, 1);   // 119 s of play on the map
    const early = SAVE_STATS.saves - s0;
    frames(2, 1); await whenWritten(game);
    const periodic = reasons(), s1 = SAVE_STATS.saves;
    if (early || periodic !== "periodic" || s1 !== s0 + 1) fail(`120 s of play: ${early} early saves, then ${s1 - s0} (${periodic})`);
    const had = SCREENS.has("world");
    if (!had) registerScreen("world", { over: "none", saveable: true, draw() {} });
    game.mode = "world"; game.modeStack = [];
    frames(9, 1); const early2 = SAVE_STATS.saves - s1;
    frames(2, 1); await whenWritten(game);
    const travel = reasons();
    if (!had) SCREENS.delete("world");
    playing(game, "map");
    if (early2 || travel !== "travel") fail(`10 s of the world map: ${early2} early saves, then ${travel}`);
    unloadSave(game); await whenWritten(game);
    const liveHidden = (await slotOf(st, game.saving.slotId)).live;
    pageShown(game); frames(2); await whenWritten(game);
    const back = reasons(), liveBack = (await slotOf(st, game.saving.slotId)).live;
    if (liveHidden !== null || back !== "back" || liveBack !== SESSION) fail(`hidden then back: live ${liveHidden} → ${liveBack}, the save ${back}`);
    stats.autoSaves = `the run's first (${RULES.afterChange} s after its start); none in 119 s of play, one at 120 (periodic); none in 9 s of the world map, one at 10 (travel); back on the page (live set again)`;
    // Prefetch: a stored span next door is read, never made.
    RULES.auto = false;
    freshRun(1234, { store: null });
    await changeZone(game, "1,0,0", { how: "travel" }); playing(game, "map");
    await changeZone(game, "0,0,0", { how: "travel" }); playing(game, "map");
    const ps = memoryAdapter(), pm = await saveGame(game, { store: ps });
    const res = [];
    for (const view of ["map", "3d"]) {
      startRun(4321); game.pages = null;
      await loadGame(pm.id, { store: ps });
      playing(game, view);
      if (cachedZone(game, "1,0,0")) { fail("prefetch: the stored neighbour was in memory right after the load"); continue; }
      const gens = [], real = ZONE_GENERATORS.surface;
      ZONE_GENERATORS.surface = (g, a) => { gens.push(a.key); return real(g, a); };
      const p = game.player;
      if (view === "3d") Object.assign(p, { x: game.zone.w - 3.5, y: 24.5 });   // near the east edge
      try {
        for (let k = 0; k < 6 && !cachedZone(game, "1,0,0"); k++) { prefetchNeighbours(game); await tick(5); }
      } finally { ZONE_GENERATORS.surface = real; }
      const read = !!cachedZone(game, "1,0,0");
      if (!read || gens.includes("1,0,0")) fail(`prefetch (${view}): the stored 1,0,0 ${read ? "read" : "not read"}, generated ${gens.includes("1,0,0")}`);
      res.push(`${view}: read back, ${gens.length} other neighbour(s) made`);
    }
    stats.prefetch = `a loaded game's stored neighbour 1,0,0 through the loader (ZONE_LOADER.load): ${res.join("; ")}; 1,0,0 never generated`;
  }

  // --- 13. The unload save --------------------------------------------------------------------------------
  {
    RULES.auto = true;
    const held = memoryAdapter({ latency: 30 });
    let opened = 0;
    const realNow = held.writeNow;
    held.writeNow = (ops) => { opened++; return realNow(ops); };
    freshRun(1234, { store: held });
    await settle();
    game.debug.enterZone("0,0,1", "down"); playing(game, "map");   // the temple written behind, not yet begun
    for (const k of ["KeyD", "KeyD", "KeyS"]) game.debug.mapKey(k);
    const L0 = "0,0,0", L1 = game.zone.key, id = game.saving.slotId, o0 = opened;
    const doc = new EventTarget(), win = new EventTarget();
    doc.visibilityState = "visible";
    const off = listenPage(doc, win, game);
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    const inHandler = opened - o0;
    const atHide = await digestGame(game, [L0, L1]), pos = { x: game.player.x, y: game.player.y, z: game.player.z };
    await whenWritten(game); await tick(40);
    const slot = await slotOf(held, id), z1 = await held.get("zones", [id, L1]), z0 = await held.get("zones", [id, L0]);
    if (inHandler !== 1 || opened - o0 !== 1) fail(`the unload save opened ${inHandler} transaction(s) in the handler, ${opened - o0} in all (one, with the write-behind in it)`);
    if (slot?.live !== null || slot?.where?.zoneKey !== L1 || slot?.player?.x !== pos.x || slot?.player?.y !== pos.y) fail(`the unload's slot: ${JSON.stringify(slot && { live: slot.live, where: slot.where, x: slot.player.x })}`);
    if (typeof z1?.blocks?.raw !== "string" || !z0) fail(`the unload's zones: ${L1} ${typeof z1?.blocks}, ${L0} ${z0 ? "written" : "missing"}`);
    startRun(4321); game.pages = null;
    await loadGame(id, { store: held });
    const n0 = problems.length;
    compare("loaded after the unload save", atHide, await digestGame(game, [L0, L1]));
    if (saveStatus(game).unclean !== 0) fail(`a load after the unload save counted ${saveStatus(game).unclean} unclean exit(s)`);
    playing(game, "map");
    doc.visibilityState = "visible"; doc.dispatchEvent(new Event("visibilitychange"));
    frames(2); await whenWritten(game); await tick(40);
    const liveBack = (await slotOf(held, id)).live;
    win.dispatchEvent(new Event("pagehide"));
    await whenWritten(game); await tick(40);
    const liveGone = (await slotOf(held, id)).live;
    off();
    if (liveBack !== SESSION || liveGone !== null) fail(`visible: live ${liveBack}; pagehide: live ${liveGone}`);
    // Under the screens a save looks through (the pause card, the options over it, the log, the inventory) the unload
    // save happens as it does in a view; under one it doesn't (the story's pages, talk, the "DEPTH n" beat) nothing is
    // written, and the last save stands.
    const under = [];
    for (const [what, view, open] of [["the pause card", "3d", () => inputHandlers.onLockChange(false)],
                                      ["the options over it", "3d", () => { inputHandlers.onLockChange(false); inputHandlers.onKeyDown("Escape", false, "Escape"); }],
                                      ["the log", "map", () => inputHandlers.onKeyDown("KeyH", false, "h")], ["the inventory", "map", () => game.debug.openInv()],
                                      ["a busy screen", "map", () => pushMode(game, BUSY, null, { pointer: false })]]) {
      const us = memoryAdapter();
      freshRun(1234, { store: us, view });
      await settle();
      game.debug.enterZone("0,0,1", "down"); playing(game, view);
      await settle();
      const uid = game.saving.slotId, before = { x: game.player.x, y: game.player.y };
      if (view === "map") for (const k of ["KeyD", "KeyD", "KeyS"]) game.debug.mapKey(k); else { game.player.x += 2; game.player.y += 1; }
      const moved = { x: game.player.x, y: game.player.y };
      open();
      const mode = game.mode, d2 = new EventTarget();
      d2.visibilityState = "hidden";
      const off2 = listenPage(d2, null, game);
      d2.dispatchEvent(new Event("visibilitychange"));
      off2();
      await whenWritten(game); await tick(5);
      const s = await slotOf(us, uid), busy = what === "a busy screen", want = busy ? before : moved;
      if ((s.live === null) === busy || s.player.x !== want.x || s.player.y !== want.y)
        fail(`the unload save under ${what} (${mode}): live ${s.live ? "set" : "null"}, at ${s.player.x},${s.player.y} (moved to ${moved.x},${moved.y}, saved at ${before.x},${before.y})`);
      under.push(`${what} ${busy ? "nothing written" : "committed"}`);
    }
    stats.unloadUnder = under.join("; ");
    stats.unload = `hidden: 1 transaction opened in the handler (the temple's write-behind, then the slot with live cleared and ${L1} uncompressed); ` +
      `loaded back ${problems.length === n0 ? "identical" : "DIFFERENT"} with 0 unclean; visible sets live again; pagehide clears it`;
  }

  // --- 14. live and unclean -------------------------------------------------------------------------------
  {
    RULES.auto = false;
    const st = memoryAdapter();
    freshRun(1234, { store: null });
    const m = await saveGame(game, { store: st });
    const live0 = (await slotOf(st, m.id)).live;
    startRun(4321); game.pages = null;   // the session ended without a clean save
    await loadGame(m.id, { store: st }); await whenWritten(game);
    const s1 = await slotOf(st, m.id);
    playing(game, "map");
    await saveGame(game, { clean: true });
    const liveClean = (await slotOf(st, m.id)).live;
    startRun(4321); game.pages = null;
    await loadGame(m.id, { store: st }); await whenWritten(game);
    const s2 = await slotOf(st, m.id), listed = (await listSlots({ store: st }))[0];
    if (live0 !== SESSION || s1.unclean !== 1 || s1.live !== SESSION || liveClean !== null || s2.unclean !== 1 || listed.unclean !== 1)
      fail(`unclean: live ${live0}; after a load ${s1.unclean} (live ${s1.live}); a clean save's live ${liveClean}; the next load ${s2.unclean}; listed ${listed.unclean}`);
    RULES.oneWick.unclean = "death";
    let code = "";
    const g0 = (await graveyard({ store: st })).length;
    startRun(4321); game.pages = null;
    try { await loadGame(m.id, { store: st }); } catch (e) { code = e.code || e.message; }
    const gone = !(await slotOf(st, m.id)), graves = await graveyard({ store: st });
    // A Commons Lamp life left the same way loads (the rule is One Wick's).
    freshRun(99, { mode: "commonsLamp", store: null });
    const mc = await saveGame(game, { store: st });
    startRun(4321); game.pages = null;
    let lamp = "loaded";
    try { await loadGame(mc.id, { store: st }); } catch (e) { lamp = e.message; }
    RULES.oneWick.unclean = "warn";
    if (code !== "unclean" || !gone || graves.length !== g0 + 1 || !/without a save/.test(graves[graves.length - 1]?.cause) || lamp !== "loaded")
      fail(`One Wick's unclean death: ${code}, slot gone ${gone}, graves ${g0} → ${graves.length} (${graves[graves.length - 1]?.cause}); a Commons Lamp slot ${lamp}`);
    // One page a slot: a stand-in for Web Locks (navigator.locks) and another page holding the slot's lock. Continue
    // is refused there (the slot as it was), the slot is listed as open elsewhere, and once that page goes it loads,
    // this page holding it until save and quit.
    {
      const held = new Map(), navWas = Object.getOwnPropertyDescriptor(globalThis, "navigator");
      const fake = {
        request(name, opts, cb) {
          if (held.has(name)) return Promise.resolve(cb(null));
          const hold = new String("this page");   // (its own: released, it takes away only itself)
          held.set(name, hold);
          return Promise.resolve(cb({ name })).finally(() => { if (held.get(name) === hold) held.delete(name); });
        },
        query: async () => ({ held: [...held.keys()].map((name) => ({ name })) }),
      };
      Object.defineProperty(globalThis, "navigator", { value: { locks: fake }, configurable: true, writable: true });
      try {
        RULES.auto = false;
        const ls = memoryAdapter();
        freshRun(1234, { store: null });
        const lm = await saveGame(game, { store: ls });
        const name = `gnomon-slot:${lm.id}`, mine = String(held.get(name));
        save.releaseSlot(lm.id);
        await tick(0);
        held.set(name, "another page");
        const before = await slotOf(ls, lm.id), open = await save.slotsOpenElsewhere();
        startRun(4321); game.pages = null;
        let code = "";
        try { await loadGame(lm.id, { store: ls }); } catch (e) { code = e.code || e.message; }
        const after = await slotOf(ls, lm.id);
        held.delete(name);   // that page goes
        await loadGame(lm.id, { store: ls });
        const nowMine = String(held.get(name));
        playing(game, "map");
        await saveGame(game, { clean: true });
        await tick(0);
        const afterQuit = held.has(name);
        if (mine !== "this page" || !open.has(lm.id) || code !== "open" || after.live !== before.live || after.unclean !== before.unclean || nowMine !== "this page" || afterQuit)
          fail(`one page a slot: first save held ${mine}; open elsewhere ${[...open].join(" ")}; Continue there ${code}, the slot's live ${after.live === before.live ? "kept" : "changed"}; once free, held by ${nowMine}; after save and quit held ${afterQuit}`);
        stats.oneTab = "the first save takes the slot's lock; held by another page: listed as open there, Continue refused (code open, the slot untouched); once that page goes it loads and holds it; save and quit lets it go";
      } finally {
        if (navWas) Object.defineProperty(globalThis, "navigator", navWas); else delete globalThis.navigator;
      }
    }
    // Save and quit while a zone change's save is still to come (Esc twice within its half second): nothing lands after
    // the clean save, so the slot stays clean.
    {
      RULES.auto = true;
      const { optionItems } = await import("../../src/screens/options.js");
      const qs = memoryAdapter({ latency: 600 });   // (the clean save still in flight when the change's save falls due)
      freshRun(1234, { store: qs, view: "3d" });
      await settle();
      game.debug.enterZone("0,0,1", "down"); playing(game, "3d");   // (its save half a second on)
      inputHandlers.onLockChange(false);                            // Esc under the lock: the pause card
      inputHandlers.onKeyDown("Escape", false, "Escape");           // Esc on it: the options
      const k = optionItems(game).findIndex((it) => it.id === "quit");
      for (let j = 0; j < k; j++) inputHandlers.onKeyDown("ArrowDown", false, "ArrowDown");
      inputHandlers.onKeyDown("Enter", false, "Enter");
      for (let j = 0; j < 90; j++) { game.debug.step(1 / 60); await tick(8); }
      await whenWritten(game); await tick(40); await whenWritten(game);
      const quit = await slotOf(qs, game.saving.slotId);
      if (game.mode !== "title" || quit.live !== null || quit.where.zoneKey !== "0,0,1") fail(`save and quit with a zone change's save to come: mode ${game.mode}, live ${quit.live}, in ${quit.where.zoneKey} (${game.saving.last?.reason})`);
      RULES.auto = false;
    }
    stats.unclean = "a load after a session with no clean save counts 1 (written back at once, live this session's); a clean save clears live and the next load counts nothing; " +
      "save and quit within a zone change's half second leaves the slot clean (the change's save answered by it); " +
      `One Wick's "death" rule: the load refused (code unclean), the slot gone, a grave ("${graves[graves.length - 1]?.cause}"); a Commons Lamp life loads under it`;
  }

  // --- 15. Death and checkpoints ----------------------------------------------------------------------------
  {
    RULES.auto = true;
    const st = memoryAdapter();
    freshRun(1234, { store: st, mode: "oneWick" });
    await settle();
    game.debug.enterZone("0,0,1", "down"); playing(game, "map");
    await settle();
    const id = game.saving.slotId, g0 = (await graveyard({ store: st })).length;
    game.hurtPlayer(99999, "a test");
    await whenWritten(game); await tick(0); await whenWritten(game);
    const graves = await graveyard({ store: st }), s0 = SAVE_STATS.saves;
    frames(90);
    const afterDeath = SAVE_STATS.saves - s0, unload = unloadSave(game);
    if (game.mode !== "dead" || (await slotOf(st, id)) || (await rowsOf(st, id)).length || graves.length !== g0 + 1 || graves[graves.length - 1].cause !== "a test"
        || afterDeath || unload !== null)
      fail(`One Wick's death: mode ${game.mode}, slot ${(await slotOf(st, id)) ? "kept" : "gone"}, rows ${(await rowsOf(st, id)).length}, graves ${g0} → ${graves.length}, saves after ${afterDeath}, unload ${unload}`);
    // The Commons Lamp.
    const cs = memoryAdapter();
    freshRun(1234, { store: cs, mode: "commonsLamp" });
    await settle();
    const cp1 = game.saving?.cp;
    const b = { ...cs.stats.byStore };
    game.debug.enterZone("0,0,1", "down"); playing(game, "map");   // leaving the temple, a settlement
    await settle();
    const wrote = Object.fromEntries(Object.keys(b).map((k) => [k, cs.stats.byStore[k] - b[k]]));
    const cid = game.saving.slotId, cp2 = game.saving.cp, kept2 = (await rowsOf(cs, cid, "checkpointZones")).join(" ");
    if (cp1 !== 1 || cp2 !== 2 || wrote.slots !== 1 || kept2 !== "0,0,0 0,0,1") fail(`checkpoints: at the start ${cp1}, on leaving the temple ${cp2}; it wrote ${JSON.stringify(wrote)}; copies after it: ${kept2 || "none"} (want 0,0,0 0,0,1: the zone left and the zone it was made in)`);
    const atCp = await digestGame(game, ["0,0,0", "0,0,1"]);
    const route = [["0,0,2", "down"], ["0,0,3", "down"], ["0,0,2", "up"], ["0,0,1", "up"], ["0,0,2", "down"]];
    for (const [key, how] of route) {
      const z = game.zone;
      z.creatures = z.creatures.filter((c) => c.talk);   // every hostile here killed
      game.player.hp = Math.max(1, game.player.hp - 1);
      game.debug.enterZone(key, how); playing(game, "map");
      await settle();
    }
    const rows = await rowsOf(cs, cid), copies = await rowsOf(cs, cid, "checkpointZones");
    if (game.saving.cp !== 2 || copies.join() !== "0,0,0,0,0,1" || rows.join() !== "0,0,0,0,0,1,0,0,2,0,0,3")
      fail(`after 5 zone changes: checkpoint ${game.saving.cp}, rows ${rows.join(" ")}, copies ${copies.join(" ")} (want 0,0,0 0,0,1: the checkpoint's own)`);
    const wakes = [];
    for (let k = 0; k < 2; k++) {
      game.hurtPlayer(99999, "a test");
      await game.saving.restoring;
      const after = await rowsOf(cs, cid), left = await rowsOf(cs, cid, "checkpointZones");
      await wakeAtCheckpoint(game);
      const n0 = problems.length;
      compare(`woken at the checkpoint (${k + 1})`, atCp, await digestGame(game, ["0,0,0", "0,0,1"]));
      if (after.join() !== "0,0,0,0,0,1" || left.length || game.zone.key !== "0,0,1") fail(`the restore (${k + 1}): rows ${after.join(" ")}, copies ${left.join(" ")}, woke in ${game.zone.key}`);
      if (saveStatus(game).unclean !== 0 || (await slotOf(cs, cid)).live !== SESSION) fail(`woken (${k + 1}): unclean ${saveStatus(game).unclean}, live ${(await slotOf(cs, cid)).live} (a restore leaves the slot clean)`);
      wakes.push(problems.length === n0 ? "identical" : "DIFFERS");
      playing(game, "map");
      game.debug.enterZone("0,0,2", "down"); playing(game, "map");
      await settle();
    }
    stats.checkpoints = `One Wick: death took the slot and its rows, a grave written ("a test"), no save after (90 frames, the unload refused). ` +
      `The Commons Lamp: checkpoint 1 at the run's start, 2 on leaving the temple (the visit wrote ${wrote.slots} slot record and ${wrote.zones} zone rows, the temple left and level 1, in one transaction, and kept those two as its copies: ${kept2}; checkpoint 1's copies dropped); ` +
      `5 zone changes (hostiles killed, hp lost): rows ${rows.join(" ")}, copies ${copies.join(" ")}; death → C ×2: ${wakes.join(", ")} to the checkpoint, 0,0,2 and 0,0,3 gone from the store`;
  }

  // --- 16. Export and import, other stores, the world by id -----------------------------------------------------
  {
    RULES.auto = false;
    const st = memoryAdapter();
    freshRun(1234, { store: null });
    game.debug.enterZone("0,0,1", "down"); playing(game, "map");
    const m = await saveGame(game, { store: st }), ks = visitedKeys(game), a = await digestGame(game, ks);
    const text = JSON.stringify(await exportSlot(m.id, { store: st }));
    const other = memoryAdapter(), id2 = await importSlot(text, { store: other });
    startRun(4321); game.pages = null;
    await loadGame(id2, { store: other });
    const n0 = problems.length;
    compare("exported, imported into another store, loaded", a, await digestGame(game, ks));
    const id3 = await importSlot(text, { store: other });
    if (id3 === id2 || (await listSlots({ store: other })).length !== 2) fail(`the same file imported twice: ids ${id2}, ${id3}`);
    const both = await Promise.all([importSlot(text, { store: other }), importSlot(text, { store: other })]);   // (at once)
    if (both[0] === both[1] || (await listSlots({ store: other })).length !== 4) fail(`the same file imported twice at once: ids ${both.join(", ")}, ${(await listSlots({ store: other })).length} slots (want 4)`);
    const bad = [];
    for (const [what, f, re] of [["another game's", (d) => ({ ...d, game: "other" }), /isn't a GNOMON save/], ["a newer game's", (d) => ({ ...d, slot: { ...d.slot, version: 99 } }), /newer/],
                                 ["one without the zone you were in", (d) => ({ ...d, zones: d.zones.filter((r) => r.key !== d.slot.where.zoneKey) }), /no record/],
                                 ["one whose character is named 42", (d) => ({ ...d, slot: { ...d.slot, character: { ...d.slot.character, name: 42 } } }), /the character/],
                                 ["one whose zone's blocks are broken", (d) => ({ ...d, zones: d.zones.map((r) => (r.key === d.slot.where.zoneKey ? { ...r, blocks: { raw: "AAAA" } } : r)) }), /zone doesn't read/]]) {
      let msg = "";
      try { await importSlot(f(JSON.parse(text)), { store: other }); } catch (e) { msg = e.message; }
      if (!re.test(msg)) fail(`importing ${what} file: ${msg || "accepted"}`); else bad.push(what);
    }
    let notJson = "";
    try { await importSlot("{ not json", { store: other }); } catch (e) { notJson = e.message; }
    if (!notJson) fail("a file that isn't JSON was imported");
    // A slot moved to another store with its checkpoint, and a save to another store with one up.
    RULES.auto = true;
    const res = [];
    for (const how of ["moveSlot", "saveGame to another store"]) {
      const A = memoryAdapter(), B = memoryAdapter();
      freshRun(1234, { store: A, mode: "commonsLamp" });
      await settle();
      game.debug.enterZone("0,0,1", "down"); playing(game, "map");
      await settle();
      const atCp = await digestGame(game, ["0,0,0", "0,0,1"]);
      for (const [key, hw] of [["0,0,2", "down"], ["0,0,1", "up"]]) { game.zone.creatures = game.zone.creatures.filter((c) => c.talk); game.debug.enterZone(key, hw); playing(game, "map"); await settle(); }
      if (how === "moveSlot") await moveSlot(game, B); else await saveGame(game, { store: B });
      useStore(B);
      const sid = game.saving.slotId;
      const copies = await rowsOf(B, sid, "checkpointZones"), rows = await rowsOf(B, sid);
      game.hurtPlayer(99999, "a test");
      await game.saving.restoring;
      await wakeAtCheckpoint(game);
      const n1 = problems.length;
      compare(`${how}, then death and C in the new store`, atCp, await digestGame(game, ["0,0,0", "0,0,1"]));
      res.push(`${how}: rows ${rows.join(" ")}, copies ${copies.join(" ") || "none"}, woke ${problems.length === n1 ? "identical" : "DIFFERENT"}`);
    }
    // A save to another store while the old store still has a save in flight that copies a zone written before the
    // checkpoint (its first write since): the new slot gets that copy too (it waits for the old slot's writes), and
    // death and C there give the zone back as at the checkpoint.
    {
      const A = memoryAdapter({ latency: 80 }), B = memoryAdapter();
      freshRun(1234, { store: A, mode: "commonsLamp" });
      await settle();
      for (const [key, how] of [["0,0,1", "down"], ["0,0,2", "down"], ["0,0,3", "down"]]) { game.debug.enterZone(key, how); playing(game, "map"); await settle(); }
      await checkpoint(game); await whenWritten(game);
      const atCp = await digestGame(game, ["0,0,2"]);
      game.debug.enterZone("0,0,2", "up"); playing(game, "map");
      frames(40);   // its save (the keep of 0,0,2 in it) asked for and in flight, held 80 ms
      await saveGame(game, { store: B });
      useStore(B);
      const copiesB = await rowsOf(B, game.saving.slotId, "checkpointZones");
      game.hurtPlayer(99999, "a test");
      await game.saving.restoring;
      await wakeAtCheckpoint(game);
      const n3 = problems.length;
      compare("a save to another store with a copy on write in flight in the old one: woken there", { ...atCp, state: "", player: "", run: "", ids: "" }, { ...(await digestGame(game, ["0,0,2"])), state: "", player: "", run: "", ids: "" });
      res.push(`a save to another store with the old store's copy of 0,0,2 in flight: the new one's copies ${copiesB.join(" ")}, woken ${problems.length === n3 ? "with 0,0,2 as at the checkpoint" : "CHANGED"}`);
    }
    // The same with the copy still to come in a zone left and held for the next slot record (its keep never ran in the
    // old store): the new slot makes it.
    {
      const A = memoryAdapter(), B = memoryAdapter();
      freshRun(1234, { store: A, mode: "commonsLamp" });
      await settle();
      for (const [key, how] of [["0,0,1", "down"], ["0,0,2", "down"], ["0,0,3", "down"]]) { game.debug.enterZone(key, how); playing(game, "map"); await settle(); }
      await checkpoint(game); await whenWritten(game);
      const atCp = await digestGame(game, ["0,0,2"]);
      game.debug.enterZone("0,0,2", "up"); playing(game, "map");
      game.zone.items.push({ kind: "bomb", count: 9, x: 4, y: 4, z: 0 });
      game.debug.enterZone("0,0,3", "down"); playing(game, "map");   // 0,0,2 left: held, its keep to come
      await saveGame(game, { store: B });
      useStore(B);
      game.hurtPlayer(99999, "a test");
      await game.saving.restoring;
      await wakeAtCheckpoint(game);
      const n4 = problems.length;
      compare("a save to another store with a held zone's copy to come: woken there", { ...atCp, state: "", player: "", run: "", ids: "" }, { ...(await digestGame(game, ["0,0,2"])), state: "", player: "", run: "", ids: "" });
      res.push(`a save to another store with 0,0,2 left and held (its copy to come): woken ${problems.length === n4 ? "with 0,0,2 as at the checkpoint" : "CHANGED"}`);
    }
    RULES.auto = false;
    // A run on the real world, loaded while new runs are built on the test world.
    const { REAL_WORLD } = await import("../../src/content/world/worldmap.js");
    const testWorld = game.world;
    freshRun(1234, { store: null, world: REAL_WORLD });
    const rw = memoryAdapter(), mr = await saveGame(game, { store: rw }), rks = visitedKeys(game), ar = await digestGame(game, rks);
    startRun(4321); game.pages = null;
    await loadGame(mr.id, { store: rw });
    const n2 = problems.length;
    compare("a run on the real world, loaded", ar, await digestGame(game, rks));
    if (game.run.world.id !== "gnomon" || game.world !== testWorld) fail(`the real world's run loaded on ${game.run.world.id}; new runs on ${game.world?.world?.id}`);
    const nowhere = { ...(await slotOf(rw, mr.id)), id: "nowhere" };
    nowhere.state = { ...nowhere.state, world: { id: "nowhere", version: 1 } };
    await rw.put("slots", nowhere);
    for (const r of await rw.list("zones", { slot: mr.id })) await rw.put("zones", { ...r, slot: "nowhere" });
    let unknown = "";
    try { await loadGame("nowhere", { store: rw }); } catch (e) { unknown = e.message; }
    if (!/world "nowhere"/.test(unknown)) fail(`a save of an unknown world: ${unknown || "loaded"}`);
    // A run saved into a slot id another run used: none of that run's rows stay.
    {
      const os = memoryAdapter();
      freshRun(1234, { store: null });
      for (const k of ["0,0,1", "0,0,2", "0,0,3"]) { game.debug.enterZone(k, "down"); playing(game, "map"); }
      await saveGame(game, { store: os, slotId: "slot-A" });
      freshRun(55, { store: null });
      await saveGame(game, { store: os, slotId: "slot-A" });
      const left = await rowsOf(os, "slot-A");
      if (left.join() !== "0,0,0") fail(`a run saved into another run's slot id: the slot holds ${left.join(" ")} (want 0,0,0, the new run's)`);
      stats.reusedSlot = `a run saved into another run's slot id: the slot holds ${left.join(" ")} (the old run's 0,0,1-0,0,3 gone)`;
    }
    // A load that fails (the zone you were in won't read) marks nothing: the slot is as it was.
    {
      const bs = memoryAdapter();
      freshRun(1234, { store: null });
      const bm = await saveGame(game, { store: bs, clean: true });
      const rec = await bs.get("zones", [bm.id, "0,0,0"]);
      await bs.put("zones", { ...rec, blocks: { raw: "AAAA" } });
      startRun(4321); game.pages = null;
      let err = "";
      try { await loadGame(bm.id, { store: bs }); } catch (e) { err = e.message; }
      await tick(5);
      const after = await bs.get("slots", bm.id);
      if (!err || after.live !== null || after.unclean !== 0) fail(`a load that failed (${err || "it loaded"}): the slot's live ${after.live}, unclean ${after.unclean}`);
      stats.failedLoad = `a load whose zone wouldn't read (${err.slice(0, 60)}) left the slot as it was (live null, unclean 0)`;
    }
    stats.exportImport = `export → import → load ${problems.length === n0 ? "identical" : "DIFFERENT"}; the same file twice: 2 slots, twice more at once: 4; refused: ${bad.join(", ")} and a file that isn't JSON`;
    stats.acrossStores = res.join("; ");
    stats.worlds = `the real world's run (${rks.join(" ")}) loaded ${problems.length === n2 ? "identical" : "DIFFERENT"} on "${game.run.world.id}" with new runs still on "${testWorld.world.id}"; an unknown world refused`;
  }

  // --- 17. The shell at 100×30 -----------------------------------------------------------------------------
  if (screen) {
    const env = await screen(100, 30);
    const text = () => { game.debug.draw(); return env.frameText(); };
    const key = (code, k = code) => inputHandlers.onKeyDown(code, false, k);
    const title = await import("../../src/screens/title.js");
    const log = await import("../../src/screens/log.js"), dead = await import("../../src/screens/dead.js"), pause = await import("../../src/screens/pause.js");
    const out = [];
    RULES.auto = false;
    const st = useStore(memoryAdapter());
    // The selected line, and moving the selection to a line of the title (or of a screen over it).
    const selected = () => { const l = text().split("\n").find((r) => /> \S/.test(r)); return l ? l.slice(l.indexOf("> ") + 2).trim() : ""; };
    const pick = (label) => { for (let k = 0; k < 14 && !selected().startsWith(label); k++) key("ArrowDown"); if (!selected().startsWith(label)) fail(`no line "${label}" to choose (at "${selected()}")`); };
    // The title: the mode and the seed of the next game.
    await title.openTitle(game);
    pick("Mode:"); key("ArrowRight");
    const modeLine = text().includes("Mode: Commons Lamp") && title.titleState().mode === "commonsLamp";
    pick("Seed:"); key("Enter");
    const m0 = game.messages.length;
    for (const c of ["4", "2", "m", "4", "2"]) key(c === "m" ? "KeyM" : `Digit${c}`, c);
    key("Enter");
    const seedOk = title.titleState().seed === "4242" && game.messages.length === m0;
    key("Home"); key("Enter");
    if (screenFor("create")) await throughWizard(game, key);   // (the wizard, with the title's seed and mode)
    if (!modeLine || !seedOk || game.seed !== 4242 || game.state?.mode !== "commonsLamp" || game.mode !== "story")
      fail(`the title's mode and seed: mode line ${modeLine}, seed ${title.titleState().seed} (M typed nothing: ${game.messages.length === m0}); the game: seed ${game.seed}, ${game.state?.mode}, ${game.mode}`);
    out.push("the mode (→ Commons Lamp) and a typed seed (4242; M typed into it did nothing) made the game");
    // Two slots, the Load list: export, delete twice; warnings.
    game.pages = null; playing(game, "map");
    await saveGame(game, {});
    freshRun(55, { store: st });
    const second = await saveGame(game, {});
    const s2 = await st.get("slots", second.id);
    await st.put("slots", { ...s2, unclean: 2, genVersion: 0 });   // an unclean exit twice, an older generator
    await title.openTitle(game);
    const warned = title.titleState().warnings.join(" ");
    if (!/last session ended without a save \(2 times\)/.test(warned) || !/older version/.test(warned)) fail(`the title's warnings: ${warned}`);
    {   // At 100×30 every warning shows whole (on more rows when it must).
      const shown = text().replace(/\s+/g, " ");
      for (const w of title.titleState().warnings) if (!shown.includes(w.replace(/\s+/g, " ").slice(-30))) fail(`the title at 100×30 cuts a warning: "${w}"`);
    }
    pick("Load a save"); key("Enter");
    let t = text();
    if (!t.includes("2 unclean")) fail("the Load list at 100×30 cuts a slot's unclean count");
    if (title.titleState().view !== "load" || !t.includes("seed 55") || !t.includes("seed 4242")) fail(`Load a save: ${t.replace(/\s+/g, " ").slice(0, 160)}`);
    key("KeyX", "x"); await tick(5);
    const exported = /Exported/.test(title.titleState().busy);
    // Enter twice on the list: one load (the store holds its reads open a moment), and back on the title after it.
    {
      const loads = SAVE_STATS.loads, slow = { ...st, get: (s, k) => tick(20).then(() => st.get(s, k)) };
      useStore(slow);
      key("Enter"); key("Enter");
      for (let k = 0; k < 100 && (game.mode === "title" || !game.zone); k++) await tick(5);
      await tick(60);
      const once = SAVE_STATS.loads - loads, err = title.titleState().error;
      useStore(st);
      if (once !== 1 || game.mode === "title" || err) fail(`Enter twice on Load a save: ${once} loads, mode ${game.mode}, error "${err}"`);
      await title.openTitle(game);
      pick("Load a save"); key("Enter");
    }
    key("Delete"); const armed = text().includes("Delete again");
    key("ArrowDown"); const disarmed = !text().includes("Delete again");
    key("ArrowUp"); key("Delete"); key("Delete"); await tick(5); await tick(5);
    const left = (await listSlots({ store: st })).map((s) => s.seed);
    if (!exported || !armed || !disarmed || left.length !== 1) fail(`the Load list: exported ${exported}, armed ${armed}, disarmed by another key ${disarmed}, slots left ${left.join(" ")}`);
    key("Escape");
    out.push(`the warnings (unclean twice, an older generator); Load a save: X exported, Enter twice one load, Delete once asked, another key kept it, twice deleted (seed ${left[0]} left)`);
    // A slot as no export makes it (stored by hand: a character named 42, an unclean exit): the title still draws.
    {
      const odd = (await listSlots({ store: st }))[0];
      const rec = await st.get("slots", odd.id);
      await st.put("slots", { ...rec, id: "odd", updated: Date.now() + 1, character: { ...rec.character, name: 42 }, unclean: 1 });
      for (const r of await st.list("zones", { slot: odd.id })) await st.put("zones", { ...r, slot: "odd" });
      let drew = "";
      try { await title.openTitle(game); drew = text(); } catch (e) { fail(`the title with a slot named 42: ${e.message}`); }
      if (drew && !/The quick game's last session ended without a save/.test(drew)) fail(`the title with a slot named 42: "${drew.replace(/\s+/g, " ").slice(0, 160)}"`);
      await deleteSlot("odd", { store: st });
      out.push("a slot stored with a character named 42 drew as the quick game's");
    }
    // The pause card, its line after the beat, Esc to the options.
    freshRun(1234, { store: st, view: "3d" });
    game.debug.enterZone("0,0,1", "down"); playing(game, "3d");
    await saveGame(game, {});
    inputHandlers.onLockChange(false);
    const noLine = !text().includes("Esc: options");
    frames(Math.ceil(pause.HINT_AFTER * 60) + 2);
    const line = text().includes("Esc: options");
    key("Escape");
    const inOptions = game.mode === "options" && text().includes("Field of view: 75");
    pick("Field of view"); key("ArrowRight");
    await tick(2);
    const kept = (await st.get("meta", "settings"))?.fov;
    pick("Keys"); key("Enter");
    t = text();
    const keysView = t.includes("1-9  abilities (hotbar)") && t.includes("H  message log") && t.includes("In 3D") && t.includes("On the map");
    key("Escape");
    if (!noLine || !line || !inOptions || game.fov !== 80 || kept !== 80 || !keysView) fail(`the pause card and options: line before the beat ${!noLine}, after ${line}; options ${inOptions}; fov ${game.fov}, kept ${kept}; keys ${keysView}`);
    out.push(`the pause card's line only after its ${pause.HINT_AFTER} s; Esc → options; the field of view 75 → 80, kept in the store's meta; the keys of both views (1-9 the hotbar, H the log)`);
    // Save and quit, then Continue to the same tile.
    const at = { key: game.zone.key, x: game.player.x, y: game.player.y };
    pick("Save and quit"); key("Enter");
    for (let k = 0; k < 50 && game.mode !== "title"; k++) await tick(5);
    const quitSlot = await st.get("slots", game.saving.slotId);
    await tick(5);
    pick("Continue"); key("Enter");
    for (let k = 0; k < 100 && (game.mode === "title" || !game.zone); k++) await tick(5);
    if (quitSlot?.live !== null || game.zone?.key !== at.key || game.player.x !== at.x || game.player.y !== at.y || saveStatus(game).unclean !== 0)
      fail(`save and quit, Continue: live ${quitSlot?.live}; back in ${game.zone?.key} at ${game.player?.x},${game.player?.y} (left ${at.key} at ${at.x},${at.y}); unclean ${saveStatus(game)?.unclean}`);
    out.push("save and quit: a clean slot (live null), the title; Continue: the same tile, 0 unclean");
    // The message log.
    playing(game, "map");
    for (let k = 1; k <= 60; k++) { game.log(`Log line ${k}.`); if (k % 7 === 0) game.debug.step(1 / 60); }
    key("KeyH");
    t = text();
    const shows = game.mode === "log" && t.includes("Log line 60.") && !t.includes("Log line 1.");
    key("Home"); t = text();
    const top = t.includes("Log line 1.") && t.includes("Messages (");
    key("KeyH");
    const closed = game.mode;
    playing(game, "3d"); key("KeyH"); const in3d = game.mode === "log"; key("Escape");
    if (!shows || !top || closed !== "map" || game.mode !== "explore" || !in3d || log.logHistory(game).length < 60)
      fail(`the log: newest ${shows}, scrolled to the first ${top}, closed to ${closed}, in 3D ${in3d} (then ${game.mode}), ${log.logHistory(game).length} lines kept`);
    out.push("the log on H: 60 lines kept (game.messages keeps 40), the newest shown, Home scrolls to the first; H and Esc close; in both views");
    // The recap; R keeps the mode; C wakes a Commons Lamp life.
    RULES.auto = true;
    freshRun(1234, { store: st, mode: "commonsLamp" });
    await settle();
    game.debug.enterZone("0,0,1", "down"); playing(game, "map");
    await settle();
    game.hurtPlayer(5, "a rat"); game.hurtPlayer(99999, "a test");
    const card = text();
    frames(Math.ceil(dead.RECAP_AFTER * 60) + 2);
    await game.saving.restoring; frames(1);
    t = text();
    const recapOk = card.includes("YOU DIED") && !card.includes("Damage taken") && t.includes("Damage taken: a test") && t.includes("a rat 5") && t.includes("C to wake");
    key("KeyC");
    for (let k = 0; k < 100 && game.mode !== "map"; k++) await tick(5);
    const woke = game.mode === "map" && game.zone?.key === "0,0,1";
    game.hurtPlayer(99999, "a test"); frames(70); await game.saving.restoring;
    key("KeyR");
    const kept2 = game.state.mode === "commonsLamp" && game.mode === "story";
    if (!recapOk || !woke || !kept2) fail(`the recap: card first ${card.includes("YOU DIED")}, recap after its beat ${t.includes("Damage taken")} ("${t.replace(/\s+/g, " ").slice(0, 200)}"); C woke ${woke} (${game.zone?.key}); R kept the mode ${kept2}`);
    out.push(`the death card, then after ${dead.RECAP_AFTER} s the recap (cause, damage by source, C to wake); C woke at the checkpoint; R started a new Commons Lamp run`);
    // A Pilgrim's recap says its own words (not the commons lamp's).
    freshRun(1234, { store: st, mode: "pilgrim" });
    await settle();
    game.hurtPlayer(99999, "a test");
    frames(Math.ceil(dead.RECAP_AFTER * 60) + 2);
    await game.saving.restoring; frames(1);
    t = text();
    if (!t.includes("The road kept your place: C wakes you") || t.includes("commons lamp")) fail(`a Pilgrim's recap: "${t.replace(/\s+/g, " ").slice(0, 300)}"`);
    out.push("a Pilgrim's recap: the road kept its place");
    stats.shell = out.join("; ");
    useStore(null);
  }

  // --- 18. The HUD at 100×30 ----------------------------------------------------------------------------------
  if (screen) {
    await screen(100, 30);
    RULES.auto = false;
    freshRun(7, { store: null });
    game.debug.enterZone("0,0,1", "down"); playing(game, "map");
    const p = game.player, foe = game.zone.creatures.find((c) => !c.talk);
    p.torch = true; p.keys = 3;
    const shownWith = () => hud.layoutHud(game).rows.flat().map((q) => q.text).join(" | ");
    const quiet = shownWith();
    Object.assign(foe, { state: "chase", x: p.x + 4, y: p.y });
    const H = hud.layoutHud(game), hunted = H.rows.flat().map((q) => q.text).join(" | "), pr = (id) => hud.segmentDef(id)?.priority ?? -1;
    foe.x = p.x + 30;
    const far = shownWith();
    foe.x = p.x + 4;
    game.mode = "dead";
    const onDeath = shownWith();
    playing(game, "map");
    startCooldown(p, "foldStep", 12);
    const cooling = shownWith();
    p.cooldowns = {};
    // With every status on as well: one row, the lowest priorities dropped first.
    for (const id of ["flying", "hasted", "shadowed", "poisoned", "darkened", "burning", "blinded"]) addStatusTo(game, p, id, { t: 30 });
    const L = hud.layoutHud(game);
    const inverted = L.dropped.filter((id) => L.rows.flat().some((q) => pr(q.id) < pr(id)));
    const invertedH = H.dropped.filter((id) => H.rows.flat().some((q) => pr(q.id) < pr(id)));
    if (quiet.includes("1 Fold Step") || !hunted.includes("1 Fold Step") || H.rows.length !== 1 || invertedH.length || far.includes("1 Fold Step")
        || onDeath.includes("1 Fold Step") || !/1 Fold Step 1[12]s/.test(cooling) || /1 Fold Step( \||$)/.test(cooling) || L.rows.length !== 1 || inverted.length)
      fail(`the hotbar segment: quiet "${quiet}"; hunted "${hunted}" (${H.rows.length} rows, dropped ${H.dropped.join(",")}); 30 tiles off "${far}"; on the death card "${onDeath}"; cooling "${cooling}"; ` +
           `every status on: ${L.rows.length} rows, dropped ${L.dropped.join(",")}, inverted ${inverted.join(",")}`);
    stats.hud = `100×30: "1 Fold Step" (priority ${pr("hotbar")}) only while a hostile hunts within ${hud.HOTBAR_NEAR} tiles (one row, dropping ${H.dropped.join(", ") || "nothing"} below it; not at 30 tiles, nor on the death card; while it cools "1 Fold Step 12s" instead); ` +
      `with every status on as well, one row, dropped ${L.dropped.join(", ") || "nothing"} (by priority, none inverted)`;
    if (child?.debug) {
      try {
        const d = await child.debug();
        if (!d.ids.includes("debug") || !/0,0,0 .* · no slot/.test(d.text) || d.off.includes("debug")) fail(`?debug=1: ${JSON.stringify(d)}`);
        stats.debugFlag = `?debug=1 registers the "debug" segment ("${d.text}"); without it none`;
      } catch (e) { fail(`?debug=1's child: ${String(e.message || e).slice(0, 200)}`); }
    }
  }

  // --- 19. Failed writes -------------------------------------------------------------------------------------
  // A store whose writes fail while `armed(ops)` says so. A zone whose newest write failed may not leave memory and
  // is written by the next save; a copy on write that failed is made by the next write.
  {
    const failing = (armed) => {
      const a = memoryAdapter(), real = a.writeNow;
      a.fails = 0;
      a.writeNow = (ops) => { if (armed(ops)) { a.fails++; return Promise.reject(new Error("the store refused it (check)")); } return real(ops); };
      return a;
    };
    const quiet = console.error;
    console.error = () => {};
    const out = [];
    try {
      // A zone's newest write fails (written once before): it stays in memory until a save writes it.
      RULES.auto = false;
      let armed = false;
      const fs1 = failing((ops) => armed && ops.some((o) => o.op === "put" && o.store === "zones" && o.value.key === "0,0,1"));
      freshRun(1234, { store: null });
      game.debug.enterZone("0,0,1", "down"); playing(game, "map");
      await saveGame(game, { store: fs1 });
      game.debug.enterZone("0,0,2", "down"); playing(game, "map"); await whenWritten(game);   // 0,0,1 written behind
      game.debug.enterZone("0,0,1", "up"); playing(game, "map");
      game.zone.items.push({ kind: "bomb", count: 8, x: game.player.x, y: game.player.y, z: game.player.z });
      armed = true;
      game.debug.enterZone("0,0,2", "down"); playing(game, "map"); await whenWritten(game);   // its write-behind fails
      armed = false;
      const evicted = evictDormant(game, 0).includes("0,0,1"), inMemory = !!cachedZone(game, "0,0,1"), had = bombs(cachedZone(game, "0,0,1")?.items);
      await saveGame(game, {});
      const back = bombs((await fs1.get("zones", [game.saving.slotId, "0,0,1"]))?.items);
      if (fs1.fails !== 1 || evicted || !inMemory || back !== had) fail(`a failed write-behind: ${fs1.fails} failed, evicted ${evicted}, in memory ${inMemory}, the next save stored ${back} bombs (the zone has ${had})`);
      out.push(`a zone whose newest write failed stayed in memory (evictDormant(0) passed it over) and the next save wrote it (${back} bombs)`);
      // The copy on write of a zone written before the checkpoint fails; the zone's next write keeps it after all.
      RULES.auto = true;
      armed = false;
      const fs2 = failing((ops) => armed && ops.some((o) => o.op === "keep" && o.key[1] === "0,0,2"));
      const go = async (key, how) => { game.zone.creatures = game.zone.creatures.filter((c) => c.talk); game.debug.enterZone(key, how); playing(game, "map"); await settle(); };
      freshRun(1234, { store: fs2, mode: "commonsLamp" });
      await settle();
      await go("0,0,1", "down"); await go("0,0,2", "down"); await go("0,0,3", "down");
      await checkpoint(game); await whenWritten(game);
      const atCp = await digestGame(game, ["0,0,2"]);
      armed = true;
      await go("0,0,2", "up");   // the save that writes 0,0,2 first (its keep) fails
      await saveGame(game, {}).catch(() => {});   // and another at once: told once, in the log
      armed = false;
      const told = game.messages.filter((m) => /couldn't be saved/.test(m.text));
      if (told.length !== 1) fail(`two failed saves told the player ${told.length} time(s) (want once, in the log)`);
      if (!told[0]?.text.includes("couldn't be saved (the store refused it (check)).")) fail(`the failed save's line: "${told[0]?.text}" (the store's reason whole)`);
      out.push(`two failed saves told the player once ("${told[0]?.text.slice(0, 70)}…")`);
      game.zone.items.push({ kind: "bomb", count: 5, x: game.player.x, y: game.player.y, z: game.player.z });
      await go("0,0,3", "down");
      const copies = await rowsOf(fs2, game.saving.slotId, "checkpointZones");
      game.hurtPlayer(99999, "a test");
      await game.saving.restoring;
      await wakeAtCheckpoint(game);
      const n0 = problems.length;
      compare("a failed copy on write, made by the next write: woken", { ...atCp, state: "", player: "", run: "", ids: "" }, { ...(await digestGame(game, ["0,0,2"])), state: "", player: "", run: "", ids: "" });
      if (!fs2.fails || !copies.includes("0,0,2")) fail(`a failed copy on write: ${fs2.fails} failed, copies ${copies.join(" ")}`);
      out.push(`a failed copy on write (${fs2.fails} failed write) made by 0,0,2's next write: woken with 0,0,2 ${problems.length === n0 ? "as at the checkpoint" : "CHANGED"}`);
      // A checkpoint's own save fails, and play goes on (its writes landing): the run goes back to the last checkpoint
      // written, and death and C wake there, exactly.
      armed = false;
      const fs3 = failing((ops) => armed && ops.some((o) => o.op === "clear"));
      freshRun(1234, { store: fs3, mode: "commonsLamp" });
      await settle();
      await go("0,0,1", "down");                     // checkpoint 2, on leaving the temple
      const at2 = await digestGame(game, ["0,0,0", "0,0,1"]), cp2 = game.saving.cp;
      await go("0,0,2", "down"); await go("0,0,3", "down");
      armed = true;
      let refused = "";
      await checkpoint(game).catch((e) => { refused = e.message; });
      armed = false;
      const cpAfter = game.saving.cp;
      await go("0,0,2", "up"); await go("0,0,1", "up"); await go("0,0,2", "down");
      const stored = (await fs3.get("slots", game.saving.slotId)).checkpoint?.n;
      game.hurtPlayer(99999, "a test");
      await game.saving.restoring;
      let woke = "";
      try { await wakeAtCheckpoint(game); woke = game.zone.key; } catch (e) { woke = `refused: ${e.message}`; }
      const n1 = problems.length;
      if (woke === "0,0,1") compare("a failed checkpoint save, then death and C", at2, await digestGame(game, ["0,0,0", "0,0,1"]));
      if (!refused || cpAfter !== cp2 || stored !== cp2 || woke !== "0,0,1")
        fail(`a failed checkpoint save: ${refused || "it resolved"}; the run's checkpoint ${cpAfter} after it (want ${cp2}), the stored slot's ${stored}; woke ${woke}`);
      out.push(`a checkpoint whose save failed: the run back on checkpoint ${cpAfter}, the slot's ${stored} after more play; death and C woke in ${woke} ${problems.length === n1 ? "as at it" : "CHANGED"}`);
    } finally { console.error = quiet; RULES.auto = false; }
    stats.failedWrites = out.join("; ");
  }

  // --- 20. The pause card in the recorded frames' states ----------------------------------------------------------
  // tests/checks/screen-frames.js's four "… 3d pause card" frames (seeds 99 and 31, depths 3 and 11, at 180×56) are
  // drawn but not compared any more (NOT_COMPARED: the card names L, V, the hotbar and the legend's comma). Here the same states are
  // drawn with and without the card: every cell outside the card's box is what the view draws without it; inside,
  // the borders are whole, each line stands centred in its colour, and nothing else is there. At 100×30 the card
  // still fits with every key named.
  if (screen) {
    const env = await screen(180, 56), out = [];
    const W = 180, cell = (y, x) => env.capture.chars[y * W + x], rgb = (y, x) => [...env.capture.colors.slice((y * W + x) * 3, (y * W + x) * 3 + 3)];
    const want = [
      ["THE ROTATION CUBE", [255, 230, 120]], ["", null], ["Click to play", [255, 255, 255]], ["", null],
      ["WASD move · Shift sprint · Space jump", [170, 170, 170]], ["Mouse look · Left click attack · Wheel zoom", [170, 170, 170]],
      ["E use / talk · I inventory · J journal · T / right-click throw · Q quick-heal · R swap weapons · F torch · M music · N sounds", [170, 170, 170]],
      ["L look · V fire · 1-9 the abilities on your hotbar (1 Fold Step)", [170, 170, 170]],
      ["Tab: rotate to the view from above (the map: turn-based; its legend on the , key)", [170, 170, 170]], ["", null],
      ["From inside you see height, depth, light and dark.", [130, 130, 130]],
      ["From above you see the whole floor, the floor's pictures, and the flat things.", [130, 130, 130]],
    ];
    for (const seed of [99, 31]) for (const depth of [3, 11]) {
      const tag = `seed ${seed} depth ${depth} 3d pause card`;
      seedRandom?.(seed * 100 + depth);
      startRun(seed);
      const st = game.run.world.start;
      game.pages = null; game.pendingPages = null; game.story.cube = true;
      game.debug.enterZone(`${st.wx},${st.wy},${depth}`, "down");
      const p = game.player;
      Object.assign(game, { mode: "explore", view: "3d", paused: false, modeStack: [] });
      p.yaw = 0.7; p.pitch = -0.1;
      for (let k = 0; k < 2; k++) game.debug.step(1 / 60);
      game.fps = 60; game.frameMs = 1.5;
      game.debug.draw(); env.S.present();
      const bare = [...env.capture.chars];
      inputHandlers.onLockChange(false);
      game.debug.draw(); env.S.present();
      const boxW = Math.min(W - 2, Math.max(...want.map(([t]) => t.length)) + 6), boxH = want.length + 4;
      const x0 = (W - boxW) >> 1, y0 = Math.max(0, (56 - boxH) >> 1), n0 = problems.length;
      let outside = 0;
      for (let y = 0; y < 56; y++) for (let x = 0; x < W; x++) {
        const inBox = x >= x0 && x < x0 + boxW && y >= y0 && y < y0 + boxH;
        if (!inBox) { if (cell(y, x) !== bare[y * W + x]) outside++; continue; }
        const k = y - y0 - 2, line = want[k];
        let ch = " ";
        if (y === y0 || y === y0 + boxH - 1) ch = "-";
        else if (line?.[0]) { const lx = x0 + ((boxW - line[0].length) >> 1); if (x >= lx && x < lx + line[0].length) ch = line[0][x - lx]; }
        if (cell(y, x) !== ch) { fail(`${tag}: at ${x},${y} "${cell(y, x)}", the card wants "${ch}"`); break; }
      }
      if (outside) fail(`${tag}: ${outside} cells outside the card differ from the view without it`);
      want.forEach(([t, c], k) => {
        if (!t) return;
        const y = y0 + 2 + k, x = x0 + ((boxW - t.length) >> 1);
        if (JSON.stringify(rgb(y, x)) !== JSON.stringify(c)) fail(`${tag}: "${t.slice(0, 20)}…" in ${rgb(y, x)}, not ${c}`);
      });
      out.push(`${tag}: ${problems.length === n0 ? "the card as written" : "WRONG"} (${boxW}×${boxH} at ${x0},${y0}; ${W * 56 - boxW * boxH} cells outside it as without it)`);
      inputHandlers.onLockChange(true);
    }
    // At 100×30 (browser-shell's small window is 100×27) the card still fits, every key named.
    const small = await screen(100, 30);
    inputHandlers.onLockChange(false);
    game.debug.draw();
    const shown = small.frameText().replace(/\s+/g, " ");
    for (const k of ["L look", "V fire", "1-9 the abilities on your hotbar (1 Fold Step)", "its legend on the , key", "I inventory", "J journal", "Click to play"])
      if (!shown.includes(k)) fail(`the pause card at 100×30 lacks "${k}"`);
    inputHandlers.onLockChange(true);
    stats.pauseCard = `${out.join("; ")}; at 100×30 every key named`;
  }
}
