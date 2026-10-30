// The world model and the run: world/worldmodel.js, world/run.js, world/sites.js and the two world
// fixtures (content/world/test-world.js and the bible's real world, content/world/worldmap.js).
//
//   checkWorld({ seeds, bibleText }) → { name, ok, problems, stats }    bibleText: docs/design/WORLD_BIBLE.md's text
//                                                                     (given, so the module also loads in the browser)
//
// 1. Both fixtures validate, as definitions and as compiled models; broken definitions are refused.
// 2. The real world's data equals the bible (§15.1 rows, letters, counts and tier grid; §15.3 landmarks;
//    §15.5 paths: 4-connected, on their own glyphs, covering every road and river span; §15.2 terrains).
// 3. What compiling makes of it: travel and edges per terrain, roads through shut spans, tiers and levels,
//    edge ids and open edges the same from both sides; the test world's three landmarks as 0A2 asks.
// 4. The run: buildRun → serializeRun → restoreRun deep-equal (and JSON-stable), with a spy on every
//    build step and on buildRun proving that the load path builds nothing; a save for another world is
//    refused; sites the same for the same seed and different for another; the placement rules hold.
// 5. The world map's travel (WS1): on both worlds every span you can travel onto has the data a step needs
//    (hours and a lost chance where it is "yes"; a line where it is "drop"), and every "yes" and "road" span is
//    reached from the start by legal 8-way steps (overworld/state.js canStep: roads only along road and river
//    edges, the bible's diagonal rule); "drop" spans end a journey (the Lattice's rim is reached, its inside
//    walked); no span with travel "no" is reached.
// 6. The regions (C1a): every span in a region, and in the one docs/c1.md's rules give it (landmarks by terrain,
//    roads and rivers their own, the Old Cuts, the Glass Shore round the sea); each region's tier its lowest span's,
//    its music a mood, its sky, fog, liquid (its water's), encounter rate, factions (existing) and site chances
//    (village only where it has a quota and a span to put one); creature rows on every level its spans make, holding
//    every one of §15.2's spawn keys (read from the bible); the village quotas §4.10's (read from the bible), 16 in all.
//    The Hollow Mere compiles as itself (its terrain, name, colour, edge message and tier 2), the Inkrun as ink.
// Navigability of the zones is check-edges' and check-surface's (later in 0A2).
import { compileWorld, validateWorld, levelOfTier, tierOfLevel, SIDES, SIDE_STEP, SITE_MARGIN } from "../../src/world/worldmodel.js";
import { buildRun, serializeRun, restoreRun, zoneSeed, runRng, RUN_STEPS, RUN_STATS } from "../../src/world/run.js";
import { dungeonLevelOf, SITE_KINDS } from "../../src/world/sites.js";
import { TEST_WORLD } from "../../src/content/world/test-world.js";
import { REAL_WORLD, WORLD_ROWS, TIER_ROWS, LANDMARK_INDEX, ROADS, RIVERS, TERRAIN_COUNTS, REGION_ROWS } from "../../src/content/world/worldmap.js";
import { TERRAINS } from "../../src/content/world/terrains.js";
import { REGIONS } from "../../src/content/world/regions.js";   // C1a
import { VILLAGES } from "../../src/content/villages.js";   // (integrator, C2 #1)
import { LIQUIDS } from "../../src/content/liquids.js";
import { FACTIONS } from "../../src/factions.js";
import "../../src/content/factions.js";   // (registers the fixed factions into FACTIONS)
import { biomeOf } from "../../src/content/biomes.js";
import { WILDLIFE } from "../../src/content/creatures/wildlife.js";
import { worldFns } from "../../src/gen/terrain.js";
import { moodNames } from "../../src/music.js";
import { CURRENCY } from "../../src/content/currency.js";
import { distance } from "../../src/rng.js";
import { GEN_CALLS } from "../../src/world/genstats.js";
import { SURFACE } from "../../src/world.js";
import { fixtureHistory, validateHistory } from "../../src/story/history.js";   // WS7
import { canStep } from "../../src/overworld/state.js";   // WS1

// Deep equality that understands Maps (by entries, in order) and plain data.
export function deepEqual(a, b, path = "run", out = []) {
  if (out.length > 5) return out;
  if (a === b) return out;
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map)) { out.push(`${path}: a Map on one side only`); return out; }
    if (a.size !== b.size) { out.push(`${path}: ${a.size} entries against ${b.size}`); return out; }
    const ka = [...a.keys()], kb = [...b.keys()];
    ka.forEach((k, i) => { if (k !== kb[i]) out.push(`${path}: key ${i} is ${k} against ${kb[i]}`); else deepEqual(a.get(k), b.get(k), `${path}[${k}]`, out); });
    return out;
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) { out.push(`${path}: ${JSON.stringify(a)} against ${JSON.stringify(b)}`); return out; }
  if (Array.isArray(a) !== Array.isArray(b)) { out.push(`${path}: an array on one side only`); return out; }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) deepEqual(a[k], b[k], `${path}.${k}`, out);
  return out;
}

const withWorld = (def, patch) => ({ ...def, world: { ...def.world, ...patch } });

function checkFixtures(problems) {
  for (const [name, def] of [["test world", TEST_WORLD], ["real world", REAL_WORLD]]) {
    for (const p of validateWorld(def)) problems.push(`${name}: ${p}`);
    for (const p of validateWorld(compileWorld(def))) problems.push(`${name} (compiled): ${p}`);
    if (compileWorld(def) !== compileWorld(def)) problems.push(`${name}: compileWorld doesn't cache`);
  }
  // Broken definitions must be refused, each for its own reason.
  const T = TEST_WORLD.world;
  const broken = {
    "a short row": withWorld(TEST_WORLD, { terrain: [T.terrain[0].slice(1), ...T.terrain.slice(1)] }),
    "an unknown glyph": withWorld(TEST_WORLD, { terrain: ["?" + T.terrain[0].slice(1), ...T.terrain.slice(1)] }),
    "a gap in a road": withWorld(TEST_WORLD, { roads: [{ id: "gap", path: [[1, 1], [3, 1]] }] }),
    "a missing start": withWorld(TEST_WORLD, { start: "nowhere" }),
    "too small": withWorld(TEST_WORLD, { w: 30 }),
    "a landmark off its zone": { ...TEST_WORLD, landmarks: [...TEST_WORLD.landmarks, { id: "x", name: "x", at: [5, 5], rect: { x: 70, y: 0, w: 20, d: 4 } }] },
    "two landmarks on one span": { ...TEST_WORLD, landmarks: [...TEST_WORLD.landmarks, { id: "y", name: "y", at: [0, 0] }] },
    "an unknown plan": { ...TEST_WORLD, landmarks: [...TEST_WORLD.landmarks, { id: "z", name: "z", at: [5, 5], plan: "nope" }] },
  };
  let refused = 0;
  for (const [why, def] of Object.entries(broken)) {
    if (validateWorld(def).length) refused++;
    else problems.push(`validateWorld accepts a world with ${why}`);
    let threw = false;
    try { compileWorld(def); } catch { threw = true; }
    if (!threw) problems.push(`compileWorld compiles a world with ${why}`);
  }
  return refused;
}

// The real world against WORLD_BIBLE §15.
function checkBible(problems, bibleText) {
  const R = WORLD_ROWS, T = TIER_ROWS;
  if (R.length !== 21 || !R.every((r) => r.length === 42)) problems.push("bible: the map is not 21 rows of 42");
  if (T.length !== 21 || !T.every((r) => r.length === 42)) problems.push("bible: the tier grid is not 21 rows of 42");
  const letterAt = new Map();
  for (const l of LANDMARK_INDEX)
    for (const [x, y] of l.at) { letterAt.set(`${x},${y}`, l); if (R[y][x] !== l.letter) problems.push(`bible: ${l.id} at (${x}, ${y}) is "${R[y][x]}", not ${l.letter}`); }
  const counts = {}, M = compileWorld(REAL_WORLD);
  // The rows themselves, character for character against the text of WORLD_BIBLE §15.1, so a copy error
  // in worldmap.js can't hide behind a check that only compares the file with itself.
  if (typeof bibleText !== "string") { problems.push("bible: no text of WORLD_BIBLE.md given (checkWorld's bibleText)"); bibleText = ""; }
  for (const [name, rows] of [["WORLD_ROWS", R], ["TIER_ROWS", T]]) {
    const block = bibleText.split(`export const ${name} = [`)[1]?.split("];")[0];
    const want = block ? [...block.matchAll(/^\s*'(.*)',/gm)].map((m) => m[1]) : [];
    if (want.length !== 21) { problems.push(`bible: can't read ${name} out of WORLD_BIBLE.md`); continue; }
    for (let y = 0; y < 21; y++)
      for (let x = 0; x < 42; x++)
        if (rows[y]?.[x] !== want[y][x]) problems.push(`bible: ${name} at (${x}, ${y}) is "${rows[y]?.[x]}", the bible's "${want[y][x]}"`);
  }
  for (let y = 0; y < 21; y++)
    for (let x = 0; x < 42; x++) {
      const c = R[y][x], t = M.tileAt(x, y);
      if (/[A-Z]/.test(c)) {
        counts.landmarks = (counts.landmarks || 0) + 1;
        const l = letterAt.get(`${x},${y}`);
        if (!l) problems.push(`bible: letter ${c} at (${x}, ${y}) is no landmark's`);
        else if (Number(T[y][x]) !== l.tier) problems.push(`bible: ${l.id}'s tier ${l.tier} against the grid's ${T[y][x]}`);
        continue;
      }
      counts[t.terrain] = (counts[t.terrain] || 0) + 1;
      // §4.5: tier = 1 + floor(distance from Hollowmere / 5.6), +1 in the Shade, the Lattice, the Teeth and on water.
      const mod = TERRAINS[t.terrain].tierMod;
      const tier = Math.max(1, Math.min(8, 1 + Math.floor(distance(x - 5, y - 16) / 5.6) + mod));
      if (tier !== Number(T[y][x])) problems.push(`bible: tier at (${x}, ${y}) is ${T[y][x]}, the formula says ${tier}`);
      if (t.tier !== Number(T[y][x])) problems.push(`real world: tile (${x}, ${y}) has tier ${t.tier}, the grid ${T[y][x]}`);
    }
  for (const [k, n] of Object.entries(TERRAIN_COUNTS)) if (counts[k] !== n) problems.push(`bible: ${k} has ${counts[k]} spans, the legend ${n}`);
  if (Object.values(counts).reduce((a, b) => a + b, 0) !== 882) problems.push("bible: the counts don't total 882");
  // §15.5: paths on their own glyphs. Allowed elsewhere: landmarks, a river under a road (Slakebridge,
  // Inkbridge), and a river's mouth in the sea (the Inkrun's last span).
  const covered = { ":": new Set(), '"': new Set() };
  for (const [glyph, list] of [[":", ROADS], ['"', RIVERS]])
    for (const p of list)
      p.path.forEach(([x, y], i) => {
        const c = R[y][x];
        covered[glyph].add(`${x},${y}`);
        if (c === glyph || /[A-Z]/.test(c)) return;
        if (glyph === '"' && c === ":") return;
        if (glyph === '"' && c === "~" && i === p.path.length - 1) return;
        problems.push(`bible: ${p.id} crosses (${x}, ${y}) "${c}"`);
      });
  for (let y = 0; y < 21; y++)
    for (let x = 0; x < 42; x++)
      if ((R[y][x] === ":" || R[y][x] === '"') && !covered[R[y][x]].has(`${x},${y}`)) problems.push(`bible: (${x}, ${y}) "${R[y][x]}" is on no path`);
  // §15.2 terrain data (hours, lost, tiers, enter, tier mod, villages).
  const TABLE = { flats: [6, 0.05, 1, 2, "map", 0, 1], waste: [14, 0.15, 1, 3, "map", 0, 1], steps: [8, 0.08, 1, 2, "map", 0, 2],
    downs: [6, 0.04, 2, 3, "map", 0, 2], pleatwood: [12, 0.12, 2, 4, "map", 0, 2], deepPleat: [14, 0.14, 4, 6, "map", 0, 1],
    tessellate: [4, 0, 4, 5, "map", 0, 2], stacks: [10, 0.1, 5, 7, "map", 0, 2], shade: [12, 0.2, 5, 8, "map", 1, 1],
    lattice: [null, null, 7, 8, "drop", 1, 0], teeth: [null, null, 4, 5, "walk", 1, 1], sea: [null, null, 5, 7, "never", 1, 1],
    mere: [null, null, 2, 2, "never", 1, 0],   // C1a: §15.2's sea row ("Glass Sea 5-7, Mere 2"), the Mere a terrain of its own
    river: [12, 0.06, 2, 5, "map", 0, 0], road: [3, 0, 1, 6, "map", 0, 0] };
  if (TERRAIN_COUNTS.sea + TERRAIN_COUNTS.mere !== 47) problems.push("bible: the Glass Sea and the Hollow Mere don't make §15.1's 47 `~`");
  for (const [id, [hours, lost, lo, hi, enter, mod, villages]] of Object.entries(TABLE)) {
    const t = TERRAINS[id];
    if (!t) { problems.push(`bible: terrain ${id} missing`); continue; }
    const got = [t.travelHours, t.lostChance, t.tiers[0], t.tiers[1], t.enter, t.tierMod, t.villages];
    if (JSON.stringify(got) !== JSON.stringify([hours, lost, lo, hi, enter, mod, villages])) problems.push(`bible: terrain ${id} is ${JSON.stringify(got)}`);
  }
  if (Object.values(TERRAINS).reduce((a, t) => a + t.villages, 0) !== 16) problems.push("bible: the village quotas don't total 16");
  // §15.3 dungeons: floors and levels.
  const FLOORS = { hollowmere: [2, 21], kettleMesa: [2, 4], benchmark: [5, 8], molar: [8, 9], pressyard: [11, 15], unlitChoir: [15, 20],
    metronome: [17, 22], drownedLantern: [20, 24], square: [19, 21], gnomon: [23, 30], saltpage: [8, 10], foldmother: [8, 10] };
  for (const L of M.landmarks.values()) {
    const want = FLOORS[L.id], got = L.dungeon?.floors;
    if (!want ? got : !(got && got[0] === want[0] && got[got.length - 1] === want[1] && got.length === want[1] - want[0] + 1))
      problems.push(`bible: ${L.id}'s dungeon floors ${JSON.stringify(got)}`);
  }
  if (JSON.stringify(M.landmarks.get("square").dungeon.up) !== "[22,23]") problems.push("bible: the Square's two floors up");
  // §15.3's gimmick key and beats columns, read out of the bible's table.
  const table = bibleText.split("### 15.3 Landmarks")[1]?.split("**Other fixed points:**")[0] || "";
  let rows = 0;
  for (const line of table.split("\n")) {
    const c = line.split("|").slice(1, -1).map((v) => v.trim());
    if (c.length !== 11 || !/^[A-P]$/.test(c[0])) continue;
    rows++;
    const L = LANDMARK_INDEX.find((l) => l.letter === c[0]), want = c[9].split("+").map((v) => v.trim());
    if (!L || JSON.stringify(L.gimmicks) !== JSON.stringify(want) || L.beats !== c[10])
      problems.push(`bible: landmark ${c[0]}'s gimmicks/beats ${JSON.stringify([L?.gimmicks, L?.beats])}, the bible's ${JSON.stringify([want, c[10]])}`);
  }
  if (rows !== 16) problems.push(`bible: read ${rows} rows of §15.3, not 16`);
  return {};
}

// What compiling makes of the two worlds.
function checkCompiled(problems) {
  for (let t = 1; t <= 8; t++) {
    if (levelOfTier(t) !== 3 * t - 1) problems.push(`levelOfTier(${t})`);
    if (tierOfLevel(levelOfTier(t)) !== t) problems.push(`tierOfLevel(levelOfTier(${t}))`);
  }
  const TIER_OF = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8];   // levels 0..30 (§4.5)
  TIER_OF.forEach((t, level) => { if (level > 0 && tierOfLevel(level) !== t) problems.push(`tierOfLevel(${level}) is ${tierOfLevel(level)}, not ${t}`); });

  const R = compileWorld(REAL_WORLD);
  const want = (x, y, travel, edges) => {
    const t = R.tileAt(x, y);
    if (t.travel !== travel || t.edges !== edges) problems.push(`real world (${x}, ${y}) ${t.terrain}: travel ${t.travel}, edges ${t.edges}; want ${travel}, ${edges}`);
  };
  want(5, 16, "yes", "open");       // Hollowmere
  want(19, 4, "no", "open");        // the Teeth (the Hush Stair is night-only: WS1)
  want(20, 9, "road", "open");      // Molar, in the Teeth on the Old Rule
  want(30, 15, "no", "solid");      // the Glass Sea
  want(31, 14, "yes", "open");      // the Glass Causeway
  want(31, 16, "road", "open");     // the Drowned Lantern, at the causeway's end
  want(29, 13, "no", "solid");      // the Inkrun's mouth stays sea
  want(38, 0, "drop", "open");      // the Lattice
  if (!R.canTravel(31, 16, true) || R.canTravel(31, 16, false)) problems.push("real world: the Drowned Lantern should take travel only along the causeway");
  if (R.edgeOpen(31, 16, "e") || !R.edgeOpen(31, 16, "n")) problems.push("real world: the Drowned Lantern's edges: open to the causeway only");
  if (R.start.landmarkId !== "hollowmere" || R.start.wx !== 5 || R.start.wy !== 16) problems.push("real world: the start is not Hollowmere (5, 16)");
  const slake = R.tileAt(16, 12);
  if (!(slake.road.w && slake.road.e && slake.river.n && slake.river.s && slake.riverWidth === 5)) problems.push("real world: Slakebridge's road and river sides");

  const M = compileWorld(TEST_WORLD);
  let mountains = 0, shut = 0;
  for (const t of M.tiles) {
    if (t.terrain === "mountains") {
      const onRoad = SIDES.some((s) => t.road[s]);
      if (t.travel !== (onRoad ? "road" : "no") || t.edges !== "open") problems.push(`test world: mountain (${t.wx}, ${t.wy}) travel ${t.travel}`);
      if (!onRoad) mountains++;
    }
    if (t.terrain === "sea" && !t.landmark) { shut++; if (t.edges !== "solid" || t.travel !== "no") problems.push(`test world: sea (${t.wx}, ${t.wy}) is enterable`); }
  }
  if (!mountains) problems.push("test world: no walk-in mountains");
  const regions = new Set(M.tiles.map((t) => t.region));
  if (regions.size !== 3) problems.push(`test world: ${regions.size} regions, not 3`);
  if (M.w !== 40 || M.h !== 20) problems.push("test world: not 40×20");
  if (TEST_WORLD.world.roads.length !== 1 || TEST_WORLD.world.rivers.length !== 1) problems.push("test world: one road and one river");
  const temple = M.landmarks.get("temple"), ruin = M.landmarks.get("ruin"), tower = M.landmarks.get("tower");
  if (!temple || temple.wx !== 0 || temple.wy !== 0 || M.start.landmarkId !== "temple") problems.push("test world: the temple is not the start at (0, 0)");
  if (!temple?.dungeon?.legacy || temple.dungeon.levels !== 20) problems.push("test world: the temple's dungeon is not the 20-level legacy stack");
  if (ruin?.dungeon?.levels !== 5 || ruin.dungeon.bottom?.id !== "flatqueen") problems.push("test world: the ruin's dungeon is not 5 levels to the Flat Queen");
  const r = tower?.rect, touches = r && { w: r.x === 0, e: r.x + r.w === SURFACE.w, n: r.y === 0, s: r.y + r.d === SURFACE.d };
  if (!touches || !SIDES.some((s) => touches[s] && M.edgeOpen(tower.wx, tower.wy, s))) problems.push("test world: the tower's footprint touches no open edge");
  if (M.flatten.length !== 3) problems.push(`test world: ${M.flatten.length} flatten entries, not 3`);

  // Edge ids and open edges: the same from both spans of every edge, in both worlds.
  let edges = 0;
  for (const W of [R, M])
    for (const t of W.tiles)
      for (const s of ["e", "s"]) {
        const [dx, dy] = SIDE_STEP[s], o = W.tileAt(t.wx + dx, t.wy + dy);
        if (!o) { if (W.edgeOpen(t.wx, t.wy, s)) problems.push(`${W.id}: (${t.wx}, ${t.wy}) open off the map`); continue; }
        edges++;
        const back = s === "e" ? "w" : "n";
        if (W.edgeId(t.wx, t.wy, s) !== W.edgeId(o.wx, o.wy, back)) problems.push(`${W.id}: edge ids differ across (${t.wx}, ${t.wy}) ${s}`);
        if (W.edgeOpen(t.wx, t.wy, s) !== W.edgeOpen(o.wx, o.wy, back)) problems.push(`${W.id}: edgeOpen differs across (${t.wx}, ${t.wy}) ${s}`);
      }
  if (M.neighbours(0, 0).length !== 3 || M.neighbours(5, 5).length !== 8) problems.push("neighbours: wrong count at a corner or inside");
  if (M.landmarkAt(20, 8)?.id !== "ruin" || M.landmarkAt(1, 1)) problems.push("landmarkAt");
  if (CURRENCY.id !== "glim" || CURRENCY.glyph !== "$" || JSON.stringify(CURRENCY.purses) !== "[200,500,1000]") problems.push("currency: not the glim fixture");
  return { edges, mountains, sea: shut };
}

// The run: round trip, the load-path spy, determinism and the placement rules.
function checkRun(problems, seeds) {
  let roundTrips = 0, sites = 0, buildMs = 0, builds = 0;
  const kinds = {};
  // The spy: every build step counts its calls.
  const calls = {}, originals = RUN_STEPS.map((s) => s.run);
  RUN_STEPS.forEach((s, i) => { calls[s.id] = 0; s.run = (run) => { calls[s.id]++; return originals[i](run); }; });
  try {
    for (const [name, def] of [["test world", TEST_WORLD], ["real world", REAL_WORLD]]) {
      const world = compileWorld(def);
      for (const seed of seeds) {
        const t0 = performance.now();
        const run = buildRun(seed, world);
        buildMs = Math.max(buildMs, performance.now() - t0); builds++;
        const data = serializeRun(run), text = JSON.stringify(data);
        if (JSON.stringify(JSON.parse(text)) !== text) problems.push(`${name} seed ${seed}: the saved run isn't plain JSON`);
        const before = { ...calls }, b0 = RUN_STATS.builds, g0 = JSON.stringify(GEN_CALLS);
        const back = restoreRun(JSON.parse(text), world);
        if (RUN_STATS.builds !== b0) problems.push(`${name} seed ${seed}: restoreRun called buildRun`);
        if (JSON.stringify(GEN_CALLS) !== g0) problems.push(`${name} seed ${seed}: restoreRun ran a generator (${g0} → ${JSON.stringify(GEN_CALLS)})`);
        for (const id of Object.keys(calls)) if (calls[id] !== before[id]) problems.push(`${name} seed ${seed}: restoreRun ran the build step ${id}`);
        for (const d of deepEqual(run, back)) problems.push(`${name} seed ${seed}: restored run differs at ${d}`);
        if (back.world !== world) problems.push(`${name} seed ${seed}: the restored run has another world`);
        if (JSON.stringify(serializeRun(back)) !== text) problems.push(`${name} seed ${seed}: saving the restored run gives other data`);
        roundTrips++;
        // Same seed, same run; the run is independent of what was built before it.
        if (JSON.stringify(serializeRun(buildRun(seed, world))) !== text) problems.push(`${name} seed ${seed}: two builds differ`);
        problems.push(...siteRules(name, seed, run));
        sites += run.sites.size;
        for (const s of run.sites.values()) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
      }
    }
  } finally {
    RUN_STEPS.forEach((s, i) => { s.run = originals[i]; });
  }
  for (const id of Object.keys(calls)) if (calls[id] !== builds * 2) problems.push(`build step ${id} ran ${calls[id]} times in ${builds * 2} builds`);
  for (const id of ["history", "sites", "villages"]) if (!GEN_CALLS[id]) problems.push(`the spy never saw the generator ${id} run`);
  // Different seeds place different sites (on the test world, whose regions have site rules).
  const a = compileWorld(TEST_WORLD);
  const placements = new Set(seeds.map((s) => JSON.stringify([...buildRun(s, a).sites.keys()])));
  if (placements.size < Math.min(seeds.length, 2)) problems.push("every seed places the same sites");
  // A save for another world, or of another version, is refused.
  const data = serializeRun(buildRun(seeds[0], a));
  for (const [why, d, w] of [["another world", data, REAL_WORLD], ["another run version", { ...data, version: 99 }, TEST_WORLD]]) {
    let threw = false;
    try { restoreRun(d, w); } catch { threw = true; }
    if (!threw) problems.push(`restoreRun accepts a save of ${why}`);
  }
  // Seeds and streams.
  const run = buildRun(seeds[0], a);
  if (zoneSeed(run, 1, 2, 0) !== zoneSeed(run, 1, 2, 0) || zoneSeed(run, 1, 2, 0) === zoneSeed(run, 2, 1, 0) || zoneSeed(run, 1, 2, 0) === zoneSeed(run, 1, 2, 1))
    problems.push("zoneSeed: not one stable seed per address");
  if (runRng(run, "sites")() !== runRng(run, "sites")() || runRng(run, "sites")() === runRng(run, "history")()) problems.push("runRng: not one stable stream per purpose");
  return { roundTrips, sites, kinds, buildMsMax: Number(buildMs.toFixed(1)) };
}

function siteRules(name, seed, run) {
  const out = [], W = run.world, at = `${name} seed ${seed}`;
  for (const L of W.landmarks.values())
    if (!run.sites.has(`landmark:${L.id}`)) out.push(`${at}: landmark ${L.id} has no site`);
  const kinds = new Set(["landmark", ...SITE_KINDS]);
  for (const s of run.sites.values()) {
    const t = W.tileAt(s.at.wx, s.at.wy);
    if (!kinds.has(s.kind)) out.push(`${at}: site ${s.id} of kind ${s.kind}`);
    if (!run.sitesAt.get(`${s.at.wx},${s.at.wy}`)?.includes(s.id)) out.push(`${at}: ${s.id} missing from sitesAt`);
    if (s.dungeon) {
      const d = s.dungeon;
      if (!(d.levels >= 1)) out.push(`${at}: ${s.id}'s dungeon has ${d.levels} levels`);
      for (let z = 1; z <= d.levels; z++) if (!Number.isInteger(dungeonLevelOf(d, z)) || dungeonLevelOf(d, z) < 1) out.push(`${at}: ${s.id} floor ${z} has level ${dungeonLevelOf(d, z)}`);
    }
    if (s.kind === "landmark") continue;
    const r = s.surface.rect;
    if (r.x < SITE_MARGIN || r.y < SITE_MARGIN || r.x + r.w > SURFACE.w - SITE_MARGIN || r.y + r.d > SURFACE.d - SITE_MARGIN)
      out.push(`${at}: ${s.id}'s footprint ${JSON.stringify(r)} is within ${SITE_MARGIN} tiles of an edge`);
    // A village placed by its region's quota (integrator, C1a #1, #2) may stand on a walk-in span with open edges.
    const byQuota = s.kind === "village" && W.regions[t.region]?.villages > 0;
    if (t.landmark || (t.travel !== "yes" && !(byQuota && t.travel === "no")) || t.edges !== "open" || t.roadWidth || t.riverWidth) out.push(`${at}: ${s.id} on a span it can't use`);
    if (s.kind === "historic") out.push(...historicRule(at, run, s, t));   // WS10: placed by tier, not a region's chance
    else if (!byQuota && !(W.regions[t.region]?.sites?.[s.kind] > 0)) out.push(`${at}: ${s.id} in a region without ${s.kind}s`);
    if (s.dungeon && dungeonLevelOf(s.dungeon, 1) !== levelOfTier(t.tier) + 1) out.push(`${at}: ${s.id}'s floor 1 is not the surface level + 1`);
    for (const o of run.sites.values())
      if (o !== s && Math.max(Math.abs(o.at.wx - s.at.wx), Math.abs(o.at.wy - s.at.wy)) <= 1) out.push(`${at}: ${s.id} has no free span between it and ${o.id}`);
  }
  for (const v of run.villages.values()) {
    if (run.sites.get(v.siteId)?.kind !== "village") out.push(`${at}: village data ${v.id} without a village site`);
    if (!run.factions.has(v.factionId)) out.push(`${at}: village ${v.id} has no faction`);
  }
  if (run.villages.size !== [...run.sites.values()].filter((s) => s.kind === "village").length) out.push(`${at}: a village site without village data`);
  if (run.world.id === "test" ? run.history?.rulers?.length !== 2 || run.history.siteRequests.length !== 2 || run.history.relics.length !== 1 || JSON.stringify(run.history) !== JSON.stringify(fixtureHistory()) : validateHistory(run.history, { world: run.world }).length) out.push(`${at}: ${run.world.id === "test" ? "the history is not the fixture" : `the history fails validateHistory: ${validateHistory(run.history, { world: run.world })[0]}`}`);   // WS7: the fixture on the test world, the generator's validated History elsewhere
  // WS10: every site request of the history is placed, once, as a historic site (bible §8.7).
  for (const req of run.history?.siteRequests || []) {
    const n = [...run.sites.values()].filter((o) => o.kind === "historic" && o.id === req.id).length;
    if (n !== 1) out.push(`${at}: site request ${req.id} placed ${n} times`);
  }
  return out;
}

// WS10: a historic site comes from exactly one of the history's site requests and sits on a span of the requested
// tier, or of the nearest tier a usable span has (bible §4.10, §8.7: Hour sites go by tier band, not by a region's
// chance, so they skip the region rule; every other rule applies to them as to any site).
function historicRule(at, run, s, t) {
  const out = [], reqs = (run.history?.siteRequests || []).filter((r) => r.id === s.id);
  if (reqs.length !== 1) return [`${at}: historic site ${s.id} matches ${reqs.length} site requests`];
  const want = reqs[0].tier;
  const usable = run.world.tiles.filter((u) => !u.landmark && u.travel === "yes" && u.edges === "open" && !u.roadWidth && !u.riverWidth);
  const best = Math.min(...usable.map((u) => Math.abs(u.tier - want)));
  if (Math.abs(t.tier - want) !== best) out.push(`${at}: historic site ${s.id} on a tier-${t.tier} span, asked for tier ${want}`);
  return out;
}

export function checkWorld({ seeds = [1, 7, 42, 1234, 31337], bibleText } = {}) {
  const problems = [];
  const refused = checkFixtures(problems);
  const bible = checkBible(problems, bibleText);
  const compiled = checkCompiled(problems);
  const run = checkRun(problems, seeds);
  const travel = checkTravel(problems);   // WS1
  const regions = checkRegions(problems, bibleText || "", seeds);   // C1a
  return { name: "world", ok: problems.length === 0, problems,
           stats: { brokenWorldsRefused: refused, ...bible, ...compiled, seeds: seeds.length, ...run, travel, regions } };
}

// C1a: the real world's regions against the bible, as checkBible holds the map (section 6 of the header).
const REGION_OF_TERRAIN = { flats: "flats", waste: "waste", steps: "steps", downs: "downs", pleatwood: "pleatwood", deepPleat: "deepPleat",
  tessellate: "tessellate", stacks: "stacks", shade: "shade", lattice: "lattice", teeth: "teeth", sea: "glassSea", mere: "hollowMere" };
const ROAD_REGION = { oldRule: "oldRule", oldRuleNorth: "oldRule", oldRuleSouth: "oldRule", straightCut: "straightCut", glassCauseway: "glassCauseway" };
const SKIES = ["clear", "haze", "glare", "canopy", "ashen", "crystal"];
// §4.10's village row and §9.3's region names, as ids.
const BIBLE_REGION = { "Flats": "flats", "Waste": "waste", "Steps": "steps", "Downs": "downs", "Pleatwood": "pleatwood", "Deep Pleat": "deepPleat",
  "Tessellate": "tessellate", "Shade": "shade", "Stacks": "stacks", "Glass shore": "glassShore", "Teeth": "teeth" };
// §15.2's spawn keys, by the key's name, and the regions that must name every one of them.
const SPAWN_REGIONS = { flats: ["flats"], waste: ["waste"], steps: ["steps"], downs: ["downs"], pleatwood: ["pleatwood"], deepPleat: ["deepPleat"],
  tessellate: ["tessellate"], stacks: ["stacks"], shade: ["shade"], lattice: ["lattice"], teeth: ["teeth"], "sea shore": ["glassShore"],
  river: ["slake", "inkrun"] };

function checkRegions(problems, bibleText, seeds) {
  const out = {}, M = compileWorld(REAL_WORLD), R = REGIONS, ids = Object.keys(R);
  const bad = (m) => problems.push(`regions: ${m}`);
  if (REAL_WORLD.regions !== REGIONS) bad("REAL_WORLD doesn't carry regions.js's REGIONS");
  if (REGION_ROWS.length !== 21 || !REGION_ROWS.every((r) => r.length === 42)) bad("REGION_ROWS is not 21 rows of 42");
  // Every span in a region, and in the one the rules (docs/c1.md "Region ids") give it.
  const roadOf = new Map(), riverOf = new Map();
  for (const r of ROADS) for (const [x, y] of r.path) if (!roadOf.has(`${x},${y}`)) roadOf.set(`${x},${y}`, ROAD_REGION[r.id]);
  for (const r of RIVERS) for (const [x, y] of r.path) riverOf.set(`${x},${y}`, r.id);
  const glass = (x, y) => M.tileAt(x, y)?.terrain === "sea";
  const spans = Object.fromEntries(ids.map((id) => [id, []]));
  let wrong = 0;
  for (const t of M.tiles) {
    const k = `${t.wx},${t.wy}`, c = WORLD_ROWS[t.wy][t.wx];
    let want;
    if (t.landmark) want = REGION_OF_TERRAIN[t.terrain];
    else if (c === ":") want = roadOf.get(k);
    else if (c === '"') want = riverOf.get(k);
    else if (t.wy === 14 && (t.wx === 12 || t.wx === 13)) want = "oldCuts";   // §15.3: the Old Cuts (tier-2 Stacks)
    else if (t.terrain !== "sea" && t.terrain !== "mere" && [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => glass(t.wx + dx, t.wy + dy)))) want = "glassShore";
    else want = REGION_OF_TERRAIN[t.terrain];
    if (!R[t.region]) { bad(`(${t.wx}, ${t.wy}) is in no region ("${t.region}")`); continue; }
    if (t.region !== want && ++wrong <= 5) bad(`(${t.wx}, ${t.wy}) ${t.terrain} is in ${t.region}, the rules say ${want}`);
    spans[t.region].push(t);
  }
  if (wrong > 5) bad(`${wrong} spans in the wrong region in all`);
  out.spans = Object.fromEntries(ids.map((id) => [id, spans[id].length]));
  if (Object.values(out.spans).reduce((a, b) => a + b, 0) !== 882) bad("the regions don't hold the 882 spans");
  // Each region's fields.
  const moods = moodNames();
  const tiered = {};
  for (const id of ids) {
    const r = R[id], at = `region ${id}`, sp = spans[id];
    if (!sp.length) { bad(`${at} has no span`); continue; }
    const tiers = sp.map((t) => t.tier), lo = Math.min(...tiers), hi = Math.max(...tiers);
    tiered[id] = lo === hi ? `${lo}` : `${lo}-${hi}`;
    if (typeof r.name !== "string" || !/^the [A-Z]/.test(r.name)) bad(`${at}: name ${JSON.stringify(r.name)}`);
    if (r.tier !== lo) bad(`${at}: tier ${r.tier}, its lowest span's ${lo}`);
    if (!moods.includes(r.music)) bad(`${at}: music "${r.music}" is no mood of music.js`);
    if (!SKIES.includes(r.sky)) bad(`${at}: sky "${r.sky}"`);
    if (!(typeof r.fog === "number" && r.fog >= 0 && r.fog <= 0.03)) bad(`${at}: fog ${r.fog}`);
    if (!LIQUIDS[r.liquid]) bad(`${at}: liquid "${r.liquid}" is no liquid`);
    if (!(r.encounterRate >= 0 && r.encounterRate <= 0.2)) bad(`${at}: encounter rate ${r.encounterRate}`);
    if (!(Number.isInteger(r.villages) && r.villages >= 0)) bad(`${at}: villages ${r.villages}`);
    if (typeof r.line !== "string" || r.line.split(/[.;:]\s+[A-Z]/).length > 1 || !/[.]$/.test(r.line)) bad(`${at}: its world-map line isn't one sentence`);
    for (const f of r.factions || []) if (!FACTIONS[f]) bad(`${at}: faction "${f}" doesn't exist`);
    if (!r.factions?.length) bad(`${at}: no faction`);
    const S = r.sites || {};
    if (JSON.stringify(Object.keys(S).sort()) !== JSON.stringify(["historic", "lair", "ruin", "station", "village"])) bad(`${at}: site kinds ${Object.keys(S)}`);
    for (const [k, v] of Object.entries(S)) if (!(v >= 0 && v < 0.5)) bad(`${at}: ${k} chance ${v}`);
    if (S.historic !== 0) bad(`${at}: a historic chance (Hour sites go by tier)`);
    const eligible = sp.filter((t) => t.travel === "yes" && t.edges === "open" && !t.landmark && !t.roadWidth && !t.riverWidth).length;
    if (S.village !== 0) bad(`${at}: village chance ${S.village}: villages come by quota (world/sites.js placeSites; integrator, C1a #1)`);
    if (!eligible && Object.values(S).some((v) => v > 0)) bad(`${at}: site chances with no span to put a site on`);
    // Creatures: [type, weight, lo, hi], levels 1-30, every level its spans make covered by one row or more.
    if (!Array.isArray(r.creatures) || !r.creatures.length) { bad(`${at}: no creatures`); continue; }
    for (const row of r.creatures)
      if (!(Array.isArray(row) && row.length === 4 && typeof row[0] === "string" && /^[a-z][A-Za-z]+$/.test(row[0]) && row[1] > 0
            && Number.isInteger(row[2]) && Number.isInteger(row[3]) && row[2] >= 1 && row[2] <= row[3] && row[3] <= 30)) bad(`${at}: creature row ${JSON.stringify(row)}`);
    for (const t of sp) if (!r.creatures.some(([, , a, b]) => t.level >= a && t.level <= b)) { bad(`${at}: nothing lives at level ${t.level}`); break; }
    // A registered kind's factions (WS2's wildlife; C3 adds the rest) live there too.
    for (const [type] of r.creatures) for (const f of WILDLIFE[type]?.factions || []) if (!r.factions?.includes(f)) bad(`${at}: ${type} is ${f}'s, which isn't among its factions`);
  }
  out.tiers = tiered;
  // §4.10's village quotas, read out of the bible's Village row; 16 in all.
  const vrow = bibleText.match(/\| Village \| 16 \| per region: ([^|]+)\|/);
  if (!vrow) bad("can't read §4.10's village quotas out of WORLD_BIBLE.md");
  else {
    const want = {};
    for (const part of vrow[1].split(",")) {
      const m = part.trim().match(/^([A-Za-z ]+?) (\d+)/);
      if (!m || !BIBLE_REGION[m[1]]) { bad(`§4.10: can't read "${part.trim()}"`); continue; }
      want[BIBLE_REGION[m[1]]] = Number(m[2]);
    }
    for (const id of ids) if ((R[id].villages || 0) !== (want[id] || 0)) bad(`region ${id}: ${R[id].villages} villages, §4.10 says ${want[id] || 0}`);
    if (ids.reduce((a, id) => a + R[id].villages, 0) !== 16) bad("the village quotas don't total 16");
    out.quotas = Object.entries(want).map(([k, v]) => `${k} ${v}`).join(", ");
    // Placed by quota (integrator, C1a #1 and #2): every seed's run has exactly each region's villages, 16 in all, the
    // Teeth's on one of its walk-in spans.
    const off = [];
    for (const seed of seeds) {
      const run = buildRun(seed, REAL_WORLD), got = {};
      for (const s of run.sites.values()) if (s.kind === "village") { const t = run.world.tileAt(s.at.wx, s.at.wy); got[t.region] = (got[t.region] || 0) + 1; }
      for (const id of ids) if ((got[id] || 0) !== (R[id].villages || 0)) off.push(`seed ${seed} ${id}: ${got[id] || 0} of ${R[id].villages}`);
    }
    if (off.length) bad(`villages by quota: ${off.slice(0, 4).join("; ")}`);
    // A village's people by its region first (integrator, C2 #1, C1a #8): a Glass Shore village on Tessellate or
    // Stacks ground is the Clatter's or the Errata's, as content/villages.js keys the Glass Shore.
    const wrong = [];
    for (const seed of seeds) {
      const run = buildRun(seed, REAL_WORLD);
      for (const v of run.villages.values()) {
        const s = run.sites.get(v.siteId), t = run.world.tileAt(s.at.wx, s.at.wy), e = VILLAGES.byTerrain[t.region];
        if (e && !e.peoples.includes(v.people)) wrong.push(`seed ${seed} ${v.name} (${t.region}): ${v.people}`);
      }
    }
    if (wrong.length) bad(`villages' peoples not their region's: ${wrong.slice(0, 3).join("; ")}`);
    out.villagesPlaced = `${seeds.length} seeds × 16, each region its quota`;
  }
  // §15.2's spawn keys: every key's creatures in its regions' rows (C3 adds the species; the ids are the bible's).
  const keys = bibleText.split("**Spawn keys**")[1]?.split("### 15.3")[0] || "";
  let named = 0;
  for (const m of keys.matchAll(/^- \*\*([a-zA-Z ]+):\*\* (.+)$/gm)) {
    const regions = SPAWN_REGIONS[m[1]];
    if (!regions) { bad(`§15.2: spawn key "${m[1]}" has no region here`); continue; }
    for (const raw of m[2].split(",")) {
      const type = raw.trim().replace(/\.$/, "").replace(/ \(.*\)$/, "");
      const only = /the Inkrun only/.test(raw) ? ["inkrun"] : regions;
      // In the region's rows (its dungeons) or its biome's surface spawns: the surface folk (the longback, the moths, the
      // Tessellate's wanderers and pilgrims) live on the surface, not underground (integrator, C3 #12, #15).
      for (const id of only) if (!R[id].creatures.some(([t]) => t === type) && !(biomeOf(R[id].biome || id).spawns || []).some(([t]) => t === type)) bad(`region ${id}: no ${type} (§15.2's ${m[1]} key)`);
      named++;
    }
  }
  if (named < 60) bad(`read ${named} of §15.2's spawn keys, not the 60 or more it lists`);
  out.spawnKeys = named;
  // The Hollow Mere compiles as itself; the Inkrun is ink, the Slake plain water.
  const mere = M.tileAt(5, 18), sea = M.tileAt(30, 15), T = M.terrains;
  if (!(mere.terrain === "mere" && mere.region === "hollowMere" && mere.tier === 2 && T.mere.name === "the Hollow Mere"
        && JSON.stringify(T.mere.color) === "[70,112,124]" && /Hollow Mere/.test(T.mere.edgeMessage) && R.hollowMere.name === "the Hollow Mere"))
    bad(`the Hollow Mere compiles as ${JSON.stringify({ terrain: mere.terrain, region: mere.region, tier: mere.tier, name: T[mere.terrain]?.name })}`);
  if (!(sea.terrain === "sea" && sea.region === "glassSea" && T.sea.name === "the Glass Sea")) bad("the Glass Sea isn't itself at (30, 15)");
  for (const [x, y] of RIVERS.find((r) => r.id === "inkrun").path) if (M.tileAt(x, y).riverLiquid !== "ink") bad(`the Inkrun at (${x}, ${y}) isn't ink`);
  for (const [x, y] of RIVERS.find((r) => r.id === "slake").path) if (M.tileAt(x, y).riverLiquid) bad(`the Slake at (${x}, ${y}) holds ${M.tileAt(x, y).riverLiquid}`);
  // A region's liquid is its water's: its river's on a river, its biome's elsewhere (the Glass Shore: the sea's, its
  // shore biome's, docs/c1.md's integration request; the Mere and the Glass Sea: the sea biome's).
  const W = worldFns(M, seeds[0]);
  for (const id of ids) {
    const t = spans[id].find((u) => !u.landmark), want = id === "slake" ? "water" : id === "inkrun" ? "ink"
      : ["glassShore", "glassSea", "hollowMere"].includes(id) ? biomeOf("sea").liquid : t ? W.liquidOf(t.wx, t.wy) : null;
    if (want && R[id].liquid !== (want === "water" ? "water" : want)) bad(`region ${id}: liquid ${R[id].liquid}, its spans hold ${want}`);
  }
  // A region's biome wins over its terrain's (integrator, C1a #3): the Glass Shore's spans dress as the sea's shore,
  // every other span as its terrain says.
  const shoreOff = M.tiles.filter((t) => t.region === "glassShore" && t.biome !== "sea").length;
  const otherOff = M.tiles.filter((t) => t.region !== "glassShore" && !R[t.region]?.biome && t.biome !== (T[t.terrain].biome || t.terrain)).length;
  if (shoreOff || otherOff) bad(`biomes: ${shoreOff} Glass Shore spans not the sea's, ${otherOff} other spans not their terrain's`);
  out.shoreBiome = `${M.tiles.filter((t) => t.region === "glassShore").length} Glass Shore spans dress as the sea's shore`;
  // What a landmark carries reaches the run's world (integrator, C1b #2): its lines, letters, inhabitants below, holy
  // places and span plans, as worldmap.js's LANDMARKS give them; and each span plan's span is flattened (C1b #1).
  {
    const off = [];
    for (const l of REAL_WORLD.landmarks) {
      const L = M.landmarks.get(l.id);
      for (const k of ["lines", "letters", "below", "holy", "holyFloors", "spanPlans"])
        if (l[k] !== undefined && JSON.stringify(L?.[k]) !== JSON.stringify(l[k])) off.push(`${l.id}.${k}`);
      for (const span of Object.keys(l.spanPlans || {})) if (!M.flatten.some((f) => `${f.wx},${f.wy}` === span)) off.push(`${l.id}: ${span} not flattened`);
    }
    if (off.length) bad(`landmarks' data not on the compiled world: ${off.slice(0, 5).join(", ")}`);
  }
  // Music and fog reach the game: clock.js and music.js read them off the span's region.
  out.music = [...new Set(ids.map((id) => R[id].music))].join(", ");
  return out;
}

// WS1: the world map's travel graph on both worlds (section 5 of the header).
function checkTravel(problems) {
  const out = {};
  for (const [name, def] of [["test", TEST_WORLD], ["real", REAL_WORLD]]) {
    const W = compileWorld(def), at = `${name} world travel`;
    for (const t of W.tiles) {
      const T = W.terrains[t.terrain];
      if (t.travel === "yes" && !(t.travelHours > 0 && t.lostChance >= 0 && t.lostChance <= 1))
        problems.push(`${at}: (${t.wx}, ${t.wy}) ${t.terrain} can be travelled onto with hours ${t.travelHours}, lost chance ${t.lostChance}`);
      if (t.travel === "road" && !(t.travelHours > 0)) problems.push(`${at}: road span (${t.wx}, ${t.wy}) has no hours`);
      if (t.travel === "drop" && !T?.edgeMessage) problems.push(`${at}: drop span (${t.wx}, ${t.wy}) says nothing when you walk onto it`);
      if (!(t.encounterRate >= 0 && t.encounterRate <= 1)) problems.push(`${at}: (${t.wx}, ${t.wy}) encounter rate ${t.encounterRate}`);
    }
    const start = { wx: W.start.wx, wy: W.start.wy }, seen = new Set([`${start.wx},${start.wy}`]), q = [start];
    while (q.length) {
      const a = q.shift();
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (canStep(W, a, dx, dy)) continue;
          const b = { wx: a.wx + dx, wy: a.wy + dy }, k = `${b.wx},${b.wy}`;
          if (seen.has(k)) continue;
          seen.add(k);
          if (W.tileAt(b.wx, b.wy).travel !== "drop") q.push(b);   // a drop span ends the journey: you walk on from its zone
        }
    }
    // Every "yes" and "road" span; a "drop" span only where it borders the rest (its inside is walked, bible §4.7).
    const want = W.tiles.filter((t) => t.travel === "yes" || t.travel === "road"), missed = want.filter((t) => !seen.has(`${t.wx},${t.wy}`));
    const drops = W.tiles.filter((t) => t.travel === "drop"), dropsReached = drops.filter((t) => seen.has(`${t.wx},${t.wy}`)).length;
    if (drops.length && !dropsReached) problems.push(`${at}: no "drop" span can be reached from the start`);
    const wrong = W.tiles.filter((t) => t.travel === "no" && seen.has(`${t.wx},${t.wy}`));
    if (missed.length) problems.push(`${at}: ${missed.length} spans you could travel onto can't be reached from the start, the first (${missed[0].wx}, ${missed[0].wy}) ${missed[0].terrain}`);
    if (wrong.length) problems.push(`${at}: ${wrong.length} travel "no" spans reached, the first (${wrong[0].wx}, ${wrong[0].wy})`);
    out[name] = { reached: seen.size, travellable: want.length, drops: `${dropsReached} of ${drops.length}`, walkInOnly: W.tiles.filter((t) => t.travel === "no").length };
  }
  return out;
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-world.mjs gives.
export async function run(env) {
  return checkWorld({ bibleText: await env.text("docs/design/WORLD_BIBLE.md") });
}
