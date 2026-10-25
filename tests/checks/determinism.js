// Determinism (R6): the same seed and address always generate the same zone.
//
//   checkDeterminism({ seeds, depths, sources }) → { name, ok, problems, stats }
//
// 1. Every level is generated twice and compared: blocks byte for byte, every item field, and each
//    creature's type, position, elite, uid and looks (the cosmetic stream), and each person's type,
//    position, uid and state. Ids are runtime handles from a counter and are left out.
//    The uid part has nothing to compare until 0C: legacy creatures and people carry no uid yet
//    (undefined on both sides). The stats count how many do, and a note says so while it is 0.
// 2. A static scan (comments stripped). In the generation code (sources: { path: text }; 0A1 scans
//    src/gen/, src/world/, src/story/, src/content/world/ and content/currency.js): no
//    Math.random, and no Math.hypot (its last bits differ between engines and even between
//    Chrome's JIT tiers: use rng.js distance). In the generation code and the helpers it calls
//    (helpers: { path: text }): no sort with a comparator that draws random numbers (engines sort
//    differently, so they draw a different count: use rng.js seededSort). Both were found in 0A1:
//    Chrome 152 generated about a third of the legacy levels differently from Node 20. Also no
//    Math.sin, cos, tan, exp, pow or atan2 in the generation code (0A2): engines don't promise the
//    same last bits for them, and world functions must agree to the bit across zones and engines.
//    (story.js was exempt for its temple mosaic's atan2 until 0A2 turned the temple into a plan.)
// 3. The run (0A2): buildRun twice on each seed and both worlds, the second time on a world compiled
//    afresh (a shallow copy of the definition, so no cache is shared), and the two serialized runs equal.
// 4. Surfaces (0A2): every landmark span of both worlds and `spans` random spans of the test world are
//    generated on each run and compared as in 1, plus the entrance, dungeonRect, edges, landmark and
//    what generation knew (zone.gen); every apron band built from the world functions is equal on both
//    runs; the world functions agree with their uncached forms (heightAt, treeAt, portsOf) on sample
//    points; and the site dungeons' levels (the ruin's 5) are generated twice the same.
import { canon } from "../lib/hash.js";
import { generateDungeonLevel, legacyParams, LEGACY_LEVELS } from "../../src/gen/dungeon.js";
import { buildRun, serializeRun, zoneSeed } from "../../src/world/run.js";
import { compileWorld } from "../../src/world/worldmodel.js";
import { generateSurface, buildApronBand, worldFns, heightAt, treeAt, portsOf } from "../../src/gen/surface.js";
import { siteWithDungeon, dungeonParams } from "../../src/world/zonegen.js";
import { APRON_SIDES } from "../../src/world.js";
import { TEST_WORLD } from "../../src/content/world/test-world.js";
import { REAL_WORLD } from "../../src/content/world/worldmap.js";
import { makeRng } from "../../src/rng.js";

const creatureFacts = (m) => ({ type: m.type, tx: m.tx, ty: m.ty, z: m.z, elite: m.elite, uid: m.uid,
  hp: m.hp, state: m.state, anim: m.anim, think: m.think, pause: m.pause, shot: m.shot });
const npcFacts = (n, monsters) => ({ type: n.type, tx: n.tx, ty: n.ty, z: n.z, uid: n.uid,
  state: n.state?.target !== undefined ? { ...n.state, target: monsters.findIndex((m) => m.id === n.state.target) } : n.state });
const layout = (f) => ({ spawn: f.spawn, stairs: f.stairs, upStairs: f.upStairs, vault: f.vault, secret: f.secret,
  secretWalls: f.secretWalls, links: f.links, groups: f.groups, spikes: f.spikes, braziers: f.braziers,
  guardianHall: f.guardianHall, attempts: f.attempts, hasBelow: f.hasBelow, level: f.level, key: f.key });

export function compareZones(a, b) {
  const out = [];
  if (a.blocks.length !== b.blocks.length || a.blocks.some((v, i) => v !== b.blocks[i])) out.push("blocks");
  if (canon(a.items) !== canon(b.items)) out.push("items");
  if (canon(a.monsters.map(creatureFacts)) !== canon(b.monsters.map(creatureFacts))) out.push("creatures");
  if (canon(a.npcs.map((n) => npcFacts(n, a.monsters))) !== canon(b.npcs.map((n) => npcFacts(n, b.monsters)))) out.push("people");
  if (canon(layout(a)) !== canon(layout(b))) out.push("layout");
  return out;
}

// Code without comments, strings left in (a string mentioning Math.random is still suspicious).
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

const RANDOM_SORT = /\.sort\(.*\b(rand|rng|random)\w*\(/;   // a sort call with a random draw later on its line

const TRANSCENDENTAL = /Math\.(sin|cos|tan|exp|pow|atan2)\b/;
export const TRANSCENDENTAL_EXEMPT = [];

const surfaceFacts = (z) => ({ entrance: z.entrance, dungeonRect: z.dungeonRect, edges: z.edges, landmarkId: z.landmarkId,
  siteId: z.siteId, name: z.name, hasBelow: z.hasBelow, attempts: z.attempts, navigability: z.navigability, gen: z.gen });

// The run and surface parts (3 and 4 above). Pushes into problems; returns its counts.
function checkWorldParts(seeds, spans, problems) {
  const stats = { runsTwice: 0, surfacesTwice: 0, apronBands: 0, worldFnPoints: 0, siteLevelsTwice: 0 };
  for (const def of [TEST_WORLD, REAL_WORLD]) {
    const fresh = { ...def };   // compiled on its own: no compile or world-function cache shared with def
    for (const seed of seeds) {
      const at = `${def.world.id} seed ${seed}`;
      const runA = buildRun(seed, def), runB = buildRun(seed, compileWorld(fresh));
      stats.runsTwice++;
      if (canon(serializeRun(runA)) !== canon(serializeRun(runB))) problems.push(`${at}: two buildRun calls differ`);
      const world = runA.world, picks = [...world.landmarks.values()].map((L) => [L.wx, L.wy]);
      if (def === TEST_WORLD) {
        const open = world.tiles.filter((t) => t.edges === "open"), rng = makeRng(seed ^ 0x3c3c);
        for (let k = 0; k < spans; k++) { const t = open[Math.floor(rng() * open.length)]; picks.push([t.wx, t.wy]); }
      }
      for (const [wx, wy] of picks) {
        const a = generateSurface(runA, wx, wy), b = generateSurface(runB, wx, wy);
        stats.surfacesTwice++;
        const diff = compareZones(a, b);
        if (canon(surfaceFacts(a)) !== canon(surfaceFacts(b))) diff.push("entrance/edges/gen");
        if (diff.length) problems.push(`${at} span (${wx}, ${wy}): two generations differ in ${diff.join(", ")}`);
        for (const side of APRON_SIDES) {
          if (side.length === 1 ? !a.edges?.[side] : !(a.edges?.[side[0]] && a.edges?.[side[1]])) continue;
          stats.apronBands++;
          const ba = buildApronBand(runA, a, side), bb = buildApronBand(runB, b, side);
          if (ba.blocks.some((v, i) => v !== bb.blocks[i])) problems.push(`${at} span (${wx}, ${wy}): apron band ${side} differs`);
        }
      }
      // World functions: the cached instance and a fresh one for every call agree, at points across the map.
      const W = worldFns(world, seed), rng = makeRng(seed ^ 0x7e7e);
      for (let k = 0; k < 60; k++) {
        const gx = Math.floor(rng() * world.w * 80), gy = Math.floor(rng() * world.h * 48);
        const cx = gx >> 3, cy = gy >> 3, wx = Math.floor(gx / 80), wy = Math.floor(gy / 48);
        stats.worldFnPoints++;
        if (W.heightAt(gx, gy) !== heightAt(world, seed, gx, gy) || canon(W.treeAt(cx, cy)) !== canon(treeAt(world, seed, cx, cy))
            || canon(W.portsOf(wx, wy)) !== canon(portsOf(world, seed, wx, wy)))
          problems.push(`${at}: the world functions at (${gx}, ${gy}) differ between the cached and a fresh instance`);
      }
      // Site dungeons (not the legacy stack, which part 1 covers).
      if (def === TEST_WORLD)
        for (const L of world.landmarks.values()) {
          const site = siteWithDungeon(runA, L.wx, L.wy);
          if (!site?.dungeon || site.dungeon.legacy || L.id === "temple") continue;
          for (let z = 1; z <= site.dungeon.levels; z++) {
            const p = dungeonParams(runA, site, z), s1 = zoneSeed(runA, L.wx, L.wy, z);
            const diff = compareZones(generateDungeonLevel(s1, p), generateDungeonLevel(zoneSeed(runB, L.wx, L.wy, z), dungeonParams(runB, siteWithDungeon(runB, L.wx, L.wy), z)));
            stats.siteLevelsTwice++;
            if (diff.length) problems.push(`${at} ${L.id} level ${z}: two generations differ in ${diff.join(", ")}`);
          }
        }
    }
  }
  return stats;
}

export function checkDeterminism({ seeds = [3, 77, 2024], depths = LEGACY_LEVELS, sources = {}, helpers = {}, spans = 12 } = {}) {
  const problems = [], notes = [];
  let levels = 0, bodies = 0, withUid = 0;
  for (const seed of seeds)
    for (let depth = 1; depth <= depths; depth++) {
      const p = legacyParams(depth, seed);
      const a = generateDungeonLevel(seed, p);
      const diff = compareZones(a, generateDungeonLevel(seed, p));
      levels++;
      for (const e of [...a.monsters, ...a.npcs]) { bodies++; if (e.uid !== undefined && e.uid !== null) withUid++; }
      if (diff.length) problems.push(`seed ${seed} level ${depth}: two generations differ in ${diff.join(", ")}`);
    }
  let scanned = 0;
  const scan = (file, text, rules) => {
    scanned++;
    stripComments(text).split("\n").forEach((line, k) => {
      for (const [re, why] of rules) if (re.test(line)) problems.push(`${file}:${k + 1} ${why}`);
    });
  };
  const sortRule = [RANDOM_SORT, "sorts with a random comparator (engine-dependent draws: use rng.js seededSort)"];
  const trigRule = [TRANSCENDENTAL, "uses Math.sin/cos/tan/exp/pow/atan2 in generation code (engine-dependent bits: use + − × ÷, sqrt, floor)"];
  for (const [file, text] of Object.entries(sources))
    scan(file, text, [[/Math\.random/, "uses Math.random in generation code (R6: pass a seeded rng)"],
                      [/Math\.hypot/, "uses Math.hypot in generation code (engine-dependent bits: use rng.js distance)"], sortRule,
                      ...(TRANSCENDENTAL_EXEMPT.includes(file) ? [] : [trigRule])]);
  for (const [file, text] of Object.entries(helpers)) scan(file, text, [sortRule]);
  const world = checkWorldParts(seeds, spans, problems);
  if (withUid === 0) notes.push(`uid comparison not exercised: none of ${bodies} creatures and people has a uid yet (0C adds them)`);
  return { name: "determinism", ok: problems.length === 0, problems, notes,
           stats: { levelsTwice: levels, filesScanned: scanned, bodies, withUid, ...world } };
}
