// The world model and the run: world/worldmodel.js, world/run.js, world/sites.js and the two world
// fixtures (content/world/test-world.js and the bible's real world, content/world/worldmap.js).
//
//   checkWorld({ seeds }) → { name, ok, problems, stats }
//
// 1. Both fixtures validate, as definitions and as compiled models; broken definitions are refused.
// 2. The real world's data equals the bible (§15.1 rows, letters, counts and tier grid; §15.3 landmarks;
//    §15.5 paths: 4-connected, on their own glyphs, covering every road and river span; §15.2 terrains).
// 3. What compiling makes of it: travel and edges per terrain, roads through shut spans, tiers and levels,
//    edge ids and open edges the same from both sides; the test world's three landmarks as 0A2 asks.
// 4. The run: buildRun → serializeRun → restoreRun deep-equal (and JSON-stable), with a spy on every
//    build step and on buildRun proving that the load path builds nothing; a save for another world is
//    refused; sites the same for the same seed and different for another; the placement rules hold.
// Navigability of the zones is check-edges' and check-surface's (later in 0A2).
import { compileWorld, validateWorld, levelOfTier, tierOfLevel, SIDES, SIDE_STEP, SITE_MARGIN } from "../../src/world/worldmodel.js";
import { buildRun, serializeRun, restoreRun, zoneSeed, runRng, RUN_STEPS, RUN_STATS } from "../../src/world/run.js";
import { dungeonLevelOf, SITE_KINDS } from "../../src/world/sites.js";
import { TEST_WORLD } from "../../src/content/world/test-world.js";
import { REAL_WORLD, WORLD_ROWS, TIER_ROWS, LANDMARK_INDEX, ROADS, RIVERS, TERRAIN_COUNTS } from "../../src/content/world/worldmap.js";
import { TERRAINS } from "../../src/content/world/terrains.js";
import { CURRENCY } from "../../src/content/currency.js";
import { distance } from "../../src/rng.js";
import { GEN_CALLS } from "../../src/world/genstats.js";
import { readFileSync } from "node:fs";
import { SURFACE } from "../../src/world.js";

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
function checkBible(problems) {
  const R = WORLD_ROWS, T = TIER_ROWS;
  if (R.length !== 21 || !R.every((r) => r.length === 42)) problems.push("bible: the map is not 21 rows of 42");
  if (T.length !== 21 || !T.every((r) => r.length === 42)) problems.push("bible: the tier grid is not 21 rows of 42");
  const letterAt = new Map();
  for (const l of LANDMARK_INDEX)
    for (const [x, y] of l.at) { letterAt.set(`${x},${y}`, l); if (R[y][x] !== l.letter) problems.push(`bible: ${l.id} at (${x}, ${y}) is "${R[y][x]}", not ${l.letter}`); }
  const counts = {}, M = compileWorld(REAL_WORLD);
  // The rows themselves, character for character against the text of WORLD_BIBLE §15.1, so a copy error
  // in worldmap.js can't hide behind a check that only compares the file with itself.
  const bibleText = readFileSync(new URL("../../docs/design/WORLD_BIBLE.md", import.meta.url), "utf8");
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
    lattice: [null, null, 7, 8, "drop", 1, 0], teeth: [null, null, 4, 5, "walk", 1, 1], sea: [null, null, 2, 7, "never", 1, 1],
    river: [12, 0.06, 2, 5, "map", 0, 0], road: [3, 0, 1, 6, "map", 0, 0] };
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
    if (t.landmark || t.travel !== "yes" || t.edges !== "open" || t.roadWidth || t.riverWidth) out.push(`${at}: ${s.id} on a span it can't use`);
    if (!(W.regions[t.region]?.sites?.[s.kind] > 0)) out.push(`${at}: ${s.id} in a region without ${s.kind}s`);
    if (s.dungeon && dungeonLevelOf(s.dungeon, 1) !== levelOfTier(t.tier) + 1) out.push(`${at}: ${s.id}'s floor 1 is not the surface level + 1`);
    for (const o of run.sites.values())
      if (o !== s && Math.max(Math.abs(o.at.wx - s.at.wx), Math.abs(o.at.wy - s.at.wy)) <= 1) out.push(`${at}: ${s.id} has no free span between it and ${o.id}`);
  }
  for (const v of run.villages.values()) {
    if (run.sites.get(v.siteId)?.kind !== "village") out.push(`${at}: village data ${v.id} without a village site`);
    if (!run.factions.has(v.factionId)) out.push(`${at}: village ${v.id} has no faction`);
  }
  if (run.villages.size !== [...run.sites.values()].filter((s) => s.kind === "village").length) out.push(`${at}: a village site without village data`);
  if (run.history?.rulers?.length !== 2 || run.history.siteRequests.length !== 2 || run.history.relics.length !== 1) out.push(`${at}: the history is not the fixture`);
  return out;
}

export function checkWorld({ seeds = [1, 7, 42, 1234, 31337] } = {}) {
  const problems = [];
  const refused = checkFixtures(problems);
  const bible = checkBible(problems);
  const compiled = checkCompiled(problems);
  const run = checkRun(problems, seeds);
  return { name: "world", ok: problems.length === 0, problems,
           stats: { brokenWorldsRefused: refused, ...bible, ...compiled, seeds: seeds.length, ...run } };
}
