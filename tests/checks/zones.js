// Zones: the Zone class, zones.js (cache, changes, events, patches, uids, arrival, derived-array
// LRU) and events.js, against the legacy site and a synthetic 80×48×16 surface zone.
//
//   checkZones({ game, startRun }) → { name, ok, problems, stats }
//
// game/startRun: the real game (game.js), so zone changes run exactly as in play.
import { Zone, B, FLOOR_Z, BLOCKS, standWith, solidFor } from "../../src/world.js";
import { changeZone, enterZone, arrivalPoint, addZonePatch, claimUid, uidWhere, killUid, zoneBelow, zoneAbove,
         cachedZone, PATCH_OPS, parseKey, zoneKey, tryWalkOff, EDGE_RULES } from "../../src/zones.js";
import { on, emit, registerUpdate, unregisterUpdate, runUpdates } from "../../src/events.js";
import { reachable, PLAYER_STEP_UP, PLAYER_DROP } from "../../src/pathing.js";
import { generateDungeonLevel, legacyParams } from "../../src/gen/dungeon.js";
import { makeRng, noise2 } from "../../src/rng.js";
import { mapStep } from "../../src/turns.js";
import { damageMonster } from "../../src/monsters.js";
import { REAL_WORLD } from "../../src/content/world/worldmap.js";

// A rolling outdoor zone: grass hills 0-3 blocks over the datum, a pond of deep water (rock bottom),
// a 4-block cliff plateau you can't walk onto, a ruined wall, and a few bottomless pits.
export function syntheticSurface(seed = 1) {
  const z = new Zone({ key: "9,9,0", wx: 9, wy: 9, z: 0, type: "surface", level: 1, seed, w: 80, d: 48, h: 16, name: "Test Downs" });
  const rng = makeRng(seed);
  for (let y = 0; y < z.d; y++)
    for (let x = 0; x < z.w; x++) {
      const n = noise2(x * 0.07 + seed, y * 0.07);
      let rise = Math.min(3, Math.floor(n * 4));
      if (Math.hypot(x - 40, y - 24) < 4) rise = 0;   // a flat middle for the anchor
      const cliff = x >= 60 && x < 70 && y >= 8 && y < 18;
      const top = FLOOR_Z - 1 + rise + (cliff ? 4 : 0);
      for (let k = 0; k <= top; k++) z.set(x, y, k, k === top ? B.GRASS : B.ROCK);
      if (Math.hypot((x - 18) / 7, (y - 34) / 4) < 1) {   // the pond: deep water at the datum, rock under it
        for (let k = FLOOR_Z - 1; k < z.h; k++) z.set(x, y, k, k === FLOOR_Z - 1 ? B.WATER_DEEP : 0);
      }
    }
  for (let x = 25; x < 36; x++) for (let k = FLOOR_Z; k < FLOOR_Z + 6; k++) z.set(x, 12, k, B.STONE);   // a wall
  for (let k = 0; k < 6; k++) {   // pits: no ground at all
    const px = 5 + Math.floor(rng() * 70), py = 3 + Math.floor(rng() * 42);
    for (let q = 0; q < z.h; q++) z.set(px, py, q, 0);
  }
  z.hasSky = true; z.outdoor = true;
  z.refresh();
  z.spawn = { x: 40.5, y: 24.5, z: z.stand[40 + 24 * z.w], yaw: 0 };
  return z.seal();
}

// The parent game's standHeight (world.js:124-137 at 75edbd3), on instance sizes.
function oldStandHeight(f, x, y, doors = "solid") {
  if (f.get(x, y, FLOOR_Z - 1) === B.WATER_DEEP) return -1;
  const isAir = (z) => {
    const b = f.get(x, y, z);
    if (b === 0) return true;
    if (doors === "solid") return false;
    const info = BLOCKS[b];
    return !!info.door && (doors === "all" || !info.locked);
  };
  for (let z = 1; z < f.h - 1; z++) if (!isAir(z - 1) && isAir(z) && isAir(z + 1)) return z;
  return -1;
}

export function checkZones({ game, startRun }) {
  const problems = [], stats = {};
  const fail = (msg) => problems.push(msg);
  const expect = (cond, msg) => { if (!cond) fail(msg); };

  // --- The Zone class ------------------------------------------------------------------------
  const s = syntheticSurface(1);
  expect(s.w === 80 && s.d === 48 && s.h === 16 && s.blocks.length === 80 * 48 * 16, "synthetic zone has the wrong size");
  expect(s.index(79, 47, 15) === 80 * 48 * 16 - 1 && s.get(80, 0, 0) === 0 && s.get(0, 0, 16) === 0, "index/get bounds wrong at 80×48×16");
  expect(s.solid(-1, 5, 5) && s.solid(5, 5, 16) && !s.solid(5, 5, -1), "solid(): sides and top solid, below open");
  expect(!s.dirty, "a freshly sealed zone is not dirty");
  s.set(1, 1, 14, B.STONE); expect(s.dirty, "set() on a sealed zone marks it dirty"); s.set(1, 1, 14, 0);
  let standMismatch = 0;
  const legacyLevel = generateDungeonLevel(5, legacyParams(7, 5));
  for (const zone of [s, legacyLevel])
    for (const doors of ["solid", "open", "all"])
      for (let y = 0; y < zone.d; y++) for (let x = 0; x < zone.w; x++)
        if (zone.standHeight(x, y, doors) !== oldStandHeight(zone, x, y, doors)) standMismatch++;
  expect(standMismatch === 0, `standHeight differs from the parent's on ${standMismatch} columns`);
  const look = s.look[40 + 24 * s.w], wallLook = s.look[30 + 12 * s.w];
  expect(look === B.GRASS && wallLook === B.STONE, `look: grass hill → GRASS, wall → STONE (got ${look}, ${wallLook})`);
  s.dropDerived();
  expect(!s.hasDerived && s.stand === null, "dropDerived frees the derived arrays");
  s.ensureDerived();
  expect(s.hasDerived && s.stand.every((v, i) => v === standWith(s, "solid")[i]), "ensureDerived rebuilds them");
  const pond = 18 + 34 * s.w;
  expect(s.stand[pond] === -1, "deep surface water is not standable");
  expect(solidFor(s, {})(18, 34, FLOOR_Z - 1), "on the surface deep water holds any body up (solidFor)");
  const dz = generateDungeonLevel(3, legacyParams(4, 3));
  let deep = -1;
  for (let i = 0; i < dz.w * dz.d && deep < 0; i++) if (dz.get(i % dz.w, Math.floor(i / dz.w), FLOOR_Z - 1) === B.WATER_DEEP) deep = i;
  if (deep >= 0) {
    const x = deep % dz.w, y = Math.floor(deep / dz.w);
    expect(!solidFor(dz, { perks: new Set() })(x, y, FLOOR_Z - 1) && solidFor(dz, { perks: new Set(["swimmer"]) })(x, y, FLOOR_Z - 1),
      "underground deep water holds up swimmers only");
  }

  // --- Arrival: teleports and falls always land somewhere you can stand ----------------------------
  const rng = makeRng(77);
  const anchorDist = reachable(standWith(s, "open"), s.w, s.d, Math.floor(s.spawn.x), Math.floor(s.spawn.y), PLAYER_STEP_UP, PLAYER_DROP);
  let landings = 0, badLandings = 0;
  const checkLanding = (zone, at, dist, what) => {
    landings++;
    const x = Math.floor(at.x), y = Math.floor(at.y), i = x + y * zone.w;
    const ok = x >= 0 && y >= 0 && x < zone.w && y < zone.d && zone.stand[i] >= 0 && at.z === zone.stand[i] && dist[i] >= 0;
    if (!ok && badLandings++ < 5) fail(`${what} landed at (${at.x}, ${at.y}, ${at.z}): not a reachable spot to stand`);
  };
  for (let k = 0; k < 2000; k++) checkLanding(s, arrivalPoint(s, "teleport", { rng }), anchorDist, "teleport");
  for (let k = 0; k < 2000; k++)
    checkLanding(s, arrivalPoint(s, "fall", { fx: -5 + rng() * 90, fy: -5 + rng() * 58, rng }), anchorDist, "fall");
  const ld = reachable(standWith(legacyLevel, "open"), 48, 48, Math.floor(legacyLevel.spawn.x), Math.floor(legacyLevel.spawn.y), PLAYER_STEP_UP, PLAYER_DROP);
  for (let k = 0; k < 500; k++) checkLanding(legacyLevel, arrivalPoint(legacyLevel, "fall", { fx: rng() * 48, fy: rng() * 48, rng }), ld, "fall (dungeon)");
  // Walking in over an edge: within 3 of the side you enter by, ±4 along, height within 1 (or shifted).
  let edgeShifted = 0;
  for (const side of ["n", "e", "s", "w"])
    for (let along = 0; along < (side === "e" || side === "w" ? s.d : s.w); along += 3) {
      const at = arrivalPoint(s, "edge", { side, along, fromStand: FLOOR_Z + 1 });
      const x = Math.floor(at.x), y = Math.floor(at.y);
      if (at.shifted) { edgeShifted++; continue; }
      const inBand = side === "e" ? x <= 2 : side === "w" ? x >= s.w - 3 : side === "s" ? y <= 2 : y >= s.d - 3;
      const alongOk = Math.abs((side === "e" || side === "w" ? y : x) - along) <= 4;
      if (!inBand || !alongOk || Math.abs(at.z - (FLOOR_Z + 1)) > 1) fail(`edge arrival from ${side} at ${along} landed at (${x}, ${y}, ${at.z})`);
    }
  stats.arrivals = { landings, bad: badLandings, edgeShifted };

  // --- Events and the update registry -------------------------------------------------------------
  const order = [];
  const offA = on("test:order", () => order.push("a"));
  const offB = on("test:order", () => order.push("b"), { priority: 5 });
  emit(game, "test:order", {});
  offA(); offB();
  emit(game, "test:order", {});
  expect(order.join("") === "ba", `event priority/unsubscribe order wrong: ${order.join("")}`);
  let calls = 0, lastDt = 0;
  registerUpdate("test:update", (g, dt) => { calls++; lastDt = dt; }, { modes: ["map"], every: 0.5 });
  const mode = game.mode;
  game.mode = "explore"; for (let k = 0; k < 5; k++) runUpdates(game, 0.2);
  expect(calls === 0, "an update registered for the map ran in explore");
  game.mode = "map"; for (let k = 0; k < 6; k++) runUpdates(game, 0.2);
  expect(calls === 2 && Math.abs(lastDt - 0.6) < 1e-9, `every: 0.5 at dt 0.2 should run twice with dt 0.6 (ran ${calls}, dt ${lastDt})`);
  unregisterUpdate("test:update");
  game.mode = mode;

  // --- Changing zones in the real game (the legacy site) ----------------------------------------
  const log = [];
  const offs = [on("zone:enter", (g, e) => log.push(["enter", e.zone.key, e.how, e.away, e.first])),
                on("zone:leave", (g, e) => log.push(["leave", e.zone.key, e.how, e.to, e.side])),
                on("zone:prepare", (g, e) => log.push(["prepare", e.zone.key]))];
  startRun(4242);
  expect(game.zone?.key === "0,0,0" && game.zone.type === "surface" && game.zone.hasBelow, "a run starts in the temple (0,0,0), with levels below");
  expect(zoneAbove(game, game.zone) === null && zoneBelow(game, game.zone)?.key === "0,0,1", "zoneAbove/zoneBelow of the temple");
  expect(changeZone(game, "0,0,1", { how: "down" }) === true && game.zone.key === "0,0,1", "changeZone to level 1 is synchronous");
  const up1 = game.zone.upStairs, p = game.player;
  expect(up1 && Math.max(Math.abs(Math.floor(p.x) - up1.x), Math.abs(Math.floor(p.y) - up1.y)) === 1, "arriving down lands beside the stairs up");
  game.time += 7;
  const lvl1 = game.zone;
  changeZone(game, zoneKey(0, 0, 2), { how: "down" });
  game.time += 3;
  changeZone(game, "0,0,1", { how: "up" });
  expect(game.zone === lvl1 && cachedZone(game, "0,0,1") === lvl1, "a visited zone comes back from the cache, as you left it");
  const enters = log.filter((e) => e[0] === "enter"), leaves = log.filter((e) => e[0] === "leave");
  expect(enters.length === 4 && leaves.length === 3, `zone events: ${enters.length} enters, ${leaves.length} leaves (expected 4, 3)`);
  expect(enters[0][4] === true && enters[0][3] === null, "the first entry is first, with no away time");
  const back = enters[3];
  expect(back[1] === "0,0,1" && back[2] === "up" && back[4] === false && Math.abs(back[3] - 3) < 1e-9, `re-entry reports away = 3 s (got ${JSON.stringify(back)})`);
  expect(leaves[1][1] === "0,0,1" && leaves[1][3] === "0,0,2" && leaves[1][2] === "down", "zone:leave names the zone, the way and the destination");
  expect(log.findIndex((e) => e[0] === "prepare" && e[1] === "0,0,2") < log.findIndex((e) => e[0] === "enter" && e[1] === "0,0,2"), "zone:prepare comes before zone:enter");
  const logged = game.messages.length;
  expect(parseKey("3,-2,5").wy === -2 && changeZone(game, "0,0,21", { how: "down" }, "You descend the stairs...") === false && game.zone === lvl1, "nothing at 0,0,21 (below the legacy stack's last level): no change");
  expect(game.messages.length === logged, "a change that fails logs no message");
  // §5.1: walking off an edge with no tile within the rules shifts you, and says so.
  changeZone(game, "0,0,0", { how: "travel" });
  game.player.x = game.zone.w - 0.5; game.player.y = 26.5;
  const before = game.messages.length;
  expect(tryWalkOff(game, "e", 26, { fromStand: 14, keepMotion: false }) && game.arrival?.shifted &&
         game.messages.slice(before).some((m) => (m.text ?? m) === EDGE_RULES.shifted), "a shifted edge arrival logs \"The ground shifts underfoot.\"");
  // A diagonal map step off an edge goes on to the diagonal row across it.
  changeZone(game, "0,0,0", { how: "travel" });
  { const z0 = game.zone, y = 26, s0 = z0.stand[z0.w - 1 + y * z0.w];
    game.player.x = z0.w - 0.5; game.player.y = y + 0.5; game.player.z = s0;
    const want = arrivalPoint(cachedZone(game, "1,0,0"), "edge", { side: "e", along: y - 1, fromStand: s0 });
    expect(mapStep(game, 1, -1) && game.zone.key === "1,0,0" && game.player.x === want.x && game.player.y === want.y,
           `a diagonal step off the east edge lands at (${game.player.x}, ${game.player.y}), want (${want.x}, ${want.y})`); }
  changeZone(game, "0,0,1", { how: "down" });

  // --- Patches and uids ---------------------------------------------------------------------------
  PATCH_OPS.testMark = (g, zone, patch, { at }) => { zone.creatures.push({ id: -1, type: "rat", uid: patch.uid, tx: at.x, ty: at.y, testMark: true }); };
  addZonePatch(game, "0,0,3", { op: "setFlag", flag: "testFlag" });
  addZonePatch(game, "0,0,3", { op: "testMark", uid: "test:one", relativeTo: "arrival", dist: [8, 12] });
  addZonePatch(game, "0,0,3", { op: "noSuchOp" });
  changeZone(game, "0,0,3", { how: "down" });
  const z3 = game.zone, marks = () => z3.creatures.filter((m) => m.testMark);
  const mk = marks()[0];
  expect(z3.flags.testFlag === true, "a setFlag patch applied on entry");
  expect(marks().length === 1 && uidWhere(game, "test:one") === "0,0,3", "a patch with a uid claims it in that zone");
  if (mk) {
    const d = Math.hypot(mk.tx - Math.floor(p.x), mk.ty - Math.floor(p.y));
    expect(d >= 8 && d <= 12 && z3.stand[mk.tx + mk.ty * z3.w] >= 0, `relativeTo arrival placed it ${d.toFixed(1)} tiles away (want 8-12, standable)`);
  }
  expect((game.state.zonePatches["0,0,3"] || []).length === 1, "applied patches are removed; an unknown op stays pending");
  changeZone(game, "0,0,2", { how: "up" });
  changeZone(game, "0,0,3", { how: "down" });
  expect(marks().length === 1, "re-entering never applies a patch twice");
  addZonePatch(game, "0,0,4", { op: "testMark", uid: "test:one" });          // lives in 0,0,3 already
  addZonePatch(game, "0,0,4", { op: "testMark", uid: "test:dead" });
  killUid(game, "test:dead");
  changeZone(game, "0,0,4", { how: "down" });
  expect(!game.zone.creatures.some((m) => m.testMark), "a uid living elsewhere, or dead, is not spawned again");
  expect(claimUid(game, "test:two", "0,0,4") && claimUid(game, "test:two", "0,0,4") && !claimUid(game, "test:two", "0,0,3"), "claimUid: one zone per uid");
  addZonePatch(game, "0,0,3", { op: "removeUid", uid: "test:one" });
  changeZone(game, "0,0,3", { how: "up" });
  expect(marks().length === 0, "removeUid takes it out of its zone");
  addZonePatch(game, "0,0,3", { op: "setFlag", flag: "now" });
  expect(game.zone.flags.now === true, "a patch for the zone you're in applies at once");
  delete PATCH_OPS.testMark;
  // spawnCreature (0C): a creature with the patch's uid, placed as asked, the same one every time; it dies for good.
  addZonePatch(game, "0,0,5", { op: "spawnCreature", type: "goblin", uid: "test:goblin", state: "wander", relativeTo: "arrival", dist: [8, 12] });
  addZonePatch(game, "0,0,5", { op: "spawnCreature", type: "pell", uid: "test:pell", relativeTo: "entrance", talk: { state: { stock: [] } } });
  changeZone(game, "0,0,4", { how: "down" });
  changeZone(game, "0,0,5", { how: "down" });
  const z5 = game.zone, gob = z5.creatures.find((c) => c.uid === "test:goblin"), pell = z5.creatures.find((c) => c.uid === "test:pell");
  expect(gob && gob.type === "goblin" && gob.state === "wander" && gob.level === z5.level && !gob.talk && uidWhere(game, "test:goblin") === "0,0,5",
         `a spawnCreature patch spawns its creature with its uid (got ${gob ? `${gob.type} ${gob.state} level ${gob.level}` : "nothing"})`);
  expect(pell?.talk?.dialogue === "pell" && Array.isArray(pell.talk.state.stock), "a spawnCreature patch can spawn a talker with its talk state");
  if (gob) {
    const d = Math.hypot(gob.tx - Math.floor(p.x), gob.ty - Math.floor(p.y));
    expect(d >= 8 && d <= 12, `the patch's goblin is ${d.toFixed(1)} tiles from the arrival (want 8-12)`);
    const twin = { creatures: [], seed: z5.seed, level: z5.level, sealed: true }, gobId = Object.keys(z5.appliedPatches)[0];   // its patch, run again
    PATCH_OPS.spawnCreature(game, twin, { op: "spawnCreature", id: gobId, type: "goblin", uid: "test:goblin", state: "wander" },
                            { at: { x: gob.tx, y: gob.ty, z: z5.stand[gob.tx + gob.ty * z5.w] } });
    expect(twin.creatures[0] && twin.creatures[0].anim === gob.anim && twin.creatures[0].pause === gob.pause, "the same patch gives the creature the same looks");
    const was3d = game.view;
    game.view = "3d";
    damageMonster(game, gob, 9999, [255, 255, 255]);
    game.view = was3d;
    expect(!z5.creatures.includes(gob) && uidWhere(game, "test:goblin") === "dead", `a claimed uid dies with its creature (${uidWhere(game, "test:goblin")})`);
  }

  // --- Derived arrays: only the two most recent zones keep them -------------------------------------
  const withDerived = [...game.zones.values()].filter((z) => z.hasDerived).map((z) => z.key);
  expect(withDerived.length === 2 && withDerived.includes(game.zone.key), `derived arrays kept for ${withDerived.join(" ")} (want the current and previous zone)`);
  const old = game.zones.get("0,0,1");
  expect(!old.hasDerived, "an older zone drops its derived arrays");
  changeZone(game, "0,0,2", { how: "up" }); changeZone(game, "0,0,1", { how: "up" });
  expect(old.hasDerived && old.stand.every((v, i) => v === standWith(old, "solid")[i]), "re-entering rebuilds them");
  const made = game.debug.zone("0,0,9");   // made, never entered (as 0A2's prefetch will)
  expect(made?.hasDerived, "a zone made without entering it has its derived arrays");
  changeZone(game, "0,0,2", { how: "down" });
  expect(!made.hasDerived && game.zones.get("0,0,1").hasDerived, "after the next zone change it drops them like any zone outside the LRU");
  expect([...game.zones.values()].filter((z) => z.hasDerived).length === 2, "only two zones keep derived arrays");

  // --- Falls move by the surface's dungeonRect: a hole, deep water and the potion of descent alike ----
  const asked = [];
  const offFall = on("zone:prepare", (g, e) => asked.push({ key: e.zone.key, fx: e.arrival.fx, fy: e.arrival.fy }));
  const mode0 = game.mode;
  changeZone(game, "0,0,0", { how: "up" });
  const temple = game.zone, rect0 = temple.dungeonRect;
  temple.dungeonRect = { ox: 6, oy: 4 };
  const fallFrom = (how) => {
    changeZone(game, "0,0,0", { how: "up" });
    p.x = 30.5; p.y = 20.5;
    if (how === "potion") game.fallThrough(); else { p.z = -2; game.checkFloorEvents(); }
    return asked[asked.length - 1];
  };
  for (const how of ["potion", "hole"]) {
    const a = fallFrom(how);
    expect(a?.key === "0,0,1" && a.fx === 24.5 && a.fy === 16.5, `${how} from the surface at (30.5, 20.5) with dungeonRect (6, 4) asked for ${JSON.stringify(a)} (want 0,0,1 at 24.5, 16.5)`);
  }
  p.x = 30.5; p.y = 20.5; game.fallThrough();
  const a2 = asked[asked.length - 1];
  expect(a2?.key === "0,0,2" && a2.fx === 30.5 && a2.fy === 20.5, `a fall between dungeon levels keeps (x, y) (asked for ${JSON.stringify(a2)})`);
  temple.dungeonRect = rect0;
  game.mode = mode0;
  offFall();
  stats.zones = { visited: game.zones.size, events: log.length };
  for (const off of offs) off();
  // The real world: the legacy stack is the Keeper's Stair under Hollowmere (5, 16), not at (0, 0).
  startRun(42, REAL_WORLD);
  expect(game.zone?.key === "5,16,0" && game.zone.hasBelow && changeZone(game, "5,16,1", { how: "down" }) === true &&
         game.zone.siteId === "legacy" && changeZone(game, "5,16,20", { how: "down" }) === true, "the real world's Keeper's Stair leads down the legacy levels");
  return { name: "zones", ok: problems.length === 0, problems, stats };
}
