// Saves (0D2; TECH_DESIGN §7, §1.4 "save"; P0 skeleton → WS9): the codec, the store, snapshot-first saves,
// write-behind, loading, and the 0D2 gate.
//
//   checkSave({ game, startRun, inputHandlers, runSession, fresh, screen, root }) → Promise<{ name, ok, problems, stats, notes }>
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
//      decoding doesn't move the id counter; creatures are trimmed to the whitelist and come back with their
//      looks; projectiles are dropped; a zone field that isn't JSON is refused until it registers a codec;
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
//   6. The title screen at 100×30, through the real input handlers: with nothing saved only "New quick game";
//      with a slot "Continue" too; each by keys (Enter, ↓ Enter, 2) and by a click on its line; New starts a
//      run at the intro, Continue loads the newest slot; M still switches the music there.
import fs from "node:fs";
import path from "node:path";
import { canonicalJson, encodeZone, decodeZone, encodePlayer, jsonProblems, snapshotZone, trimCreature, CREATURE_FIELDS,
         CODEC, DEFLATE_AVAILABLE, registerZoneField, packBytes, fromB64 } from "../../src/save/codec.js";
import { memoryAdapter, idbAdapter } from "../../src/save/store.js";
import { saveGame, loadGame, listSlots, deleteSlot, whenWritten, saveStatus, canSave } from "../../src/save/save.js";
import { getZone, cachedZone, evictZone, evictDormant, ZONE_GENERATORS, ZONE_RULES, changeZone, neighbourAddr } from "../../src/zones.js";
import { entityCounter, getIds } from "../../src/ids.js";
import { serializeRun, RUN_STATS } from "../../src/world/run.js";
import { pushMode, popMode, screenFor } from "../../src/screens.js";
import { on } from "../../src/events.js";
import { useStore, currentStore } from "../../src/save/store.js";
import { openTitle } from "../../src/screens/title.js";
import { B, FLOOR_Z } from "../../src/world.js";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

export async function digestGame(game, keys) {
  const out = { state: canonicalJson(game.state), player: canonicalJson(encodePlayer(game.player)), run: canonicalJson(serializeRun(game.run)),
                ids: canonicalJson(getIds()), zones: {} };
  for (const key of keys) {
    const z = cachedZone(game, key) || await getZone(game, key);
    out.zones[key] = z ? canonicalJson({ ...(await encodeZone(z, {}, { deflate: false })), slot: null, savedAt: 0 }) : null;
  }
  return out;
}
const visitedKeys = (game) => [...game.zones.keys()].filter((k) => k === game.zone.key || game.state.zoneLeft[k] !== undefined).sort();
const playing = (game, view = game.view) => { game.view = view; game.mode = view === "map" ? "map" : "explore"; game.paused = false; game.modeStack = []; };

export async function checkSave({ game, startRun, inputHandlers, runSession, fresh, screen, root }) {
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
          for (const f of ["uid", "type", "name", "glyph", "hp", "maxHp", "level", "elite", "xp", "w", "h", "tx", "ty", "z"])
            if (JSON.stringify(o[f]) !== JSON.stringify(c[f])) fail(`${z.key} creature ${c.id} (${c.type}): ${f} ${JSON.stringify(o[f])} → ${JSON.stringify(c[f])}`);
          if (JSON.stringify(o.color) !== JSON.stringify(c.color) || c.x !== c.tx + 0.5 || c.y !== c.ty + 0.5) fail(`${z.key} creature ${c.id}: colour or place`);
          creatures++;
        }
        zonesTried++;
      }
    }
    if (entityCounter() !== was) fail(`decoding moved the id counter ${was} → ${entityCounter()}`);
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
    // Waiting: the inventory (no save there), then a screen whose data holds a callback.
    for (const [what, open, close] of [["the inventory", () => game.debug.openInv(), () => popMode(game, undefined, { pointer: false })],
                                       ["a screen with a callback", () => pushMode(game, "journal", { onPop() {} }, { pointer: false }), () => popMode(game, undefined, { pointer: false })]]) {
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
    const base = memoryAdapter(), delays = [60, 0];
    const ordered = { ...base, put: async (st, v) => { await tick(delays.shift() ?? 0); return base.put(st, v); } };
    await saveGame(game, { store: ordered });
    const L2 = game.zone.key;
    game.zone.markers.push({ x: 1, y: 1 });
    game.debug.enterZone(A, "up"); playing(game, "map");   // write 1 (slow): one marker
    game.debug.enterZone(L2, "down"); playing(game, "map");
    game.zones.get(L2).markers.push({ x: 2, y: 2 });       // (you're in it: the next leave writes two)
    game.debug.enterZone(A, "up"); playing(game, "map");   // write 2 (fast): two markers
    await whenWritten(game);
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
      return saveGame(game, {});
    };
    await openTitle(game);
    let t = text(), ways = 0;
    if (game.mode !== "title" || !t.includes("New quick game") || t.includes("Continue")) fail(`the title with nothing saved: mode ${game.mode}, "${t.replace(/\s+/g, " ").trim().slice(0, 120)}"`);
    const m0 = game.messages.length;
    key("KeyM", "m");
    if (game.messages.length !== m0 + 1 || !/Music/.test(game.messages[game.messages.length - 1]?.text)) fail("M didn't switch the music on the title screen");
    key("KeyM", "m");
    key("Enter");
    if (game.mode !== "story" || !game.player || game.zone?.key !== "0,0,0") fail(`Enter on "New quick game": mode ${game.mode}, zone ${game.zone?.key}`); else ways++;
    await openTitle(game);
    click("New quick game");
    if (game.mode !== "story") fail(`a click on "New quick game": mode ${game.mode}`); else ways++;
    // Continue: by ↓ Enter, by 2, by a click; each loads the newest slot.
    for (const how of ["keys", "digit", "click"]) {
      const m = await saveOne();
      startRun(11); game.pages = null;
      await openTitle(game);
      t = text();
      if (!t.includes("Continue")) { fail(`the title with a slot saved shows no Continue (${how})`); continue; }
      if (how === "keys") { key("ArrowDown"); key("Enter"); } else if (how === "digit") key("Digit2", "2"); else click("Continue");
      await settle();
      if (game.mode === "title" || game.saving?.slotId !== m.id || game.zone?.key !== "0,0,1") fail(`Continue by ${how}: mode ${game.mode}, slot ${game.saving?.slotId} (want ${m.id}), zone ${game.zone?.key}`);
      else ways++;
    }
    stats.title = `100×30: New quick game and Continue reached ${ways} of 5 ways (Enter, click; ↓ Enter, 2, click)`;
    useStore(was);
  }

  return { name: "save", ok: problems.length === 0, problems, stats, notes };
}
