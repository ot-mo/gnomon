// Surface generation (TECH_DESIGN §8.3 "WS2" acceptance, the 2a half: docs/ws2.md; owner WS2). On the real world
// (the one the game plays; check-landmarks and check-edges hold the test world and the seams):
//
// 1. Spans: `spans` random spans you can be in (500) on each of 3 seeds generate and validate (validateSurface,
//    within the retries), with the map's navigability ≥ 90%; every one twice the same. Their times are reported
//    (p50, p95, max per generateSurface); with --budget the §6.7 budget is held too (p95 ≤ 60 ms, max ≤ 150 ms):
//    run it alone for that, as check-perf holds gen.surface in run-all.
// 2. The world function itself: 10⁵ random columns a seed, no 4-neighbour step over 1 without a cliff or water
//    (the slope rule), no ground over 12 blocks up (DECISIONS), a cliff's foot 4 or more below it (a map wall), and
//    the Rust Steps' mesas stacked (tier 2 somewhere, only in their spans, never beside unraised ground); no tree's
//    top leaf above the zone's 16 blocks.
// 3. The apron: on `pairs` random neighbour pairs a seed (50; straight sides and corners), the band of span A
//    toward B built from the world functions equals a copy of B's generated blocks in every voxel of every column
//    B's own features left alone (zone.gen.local: its roads, river bends, banks, footprint, plan, sinkholes and
//    the trees that gave way to them); the share of columns left out is reported.
// 4. Liquids: every zone's liquid is its span's (its river's where one runs, else its biome's, content/biomes.js),
//    the same on both sides of every river edge sampled; the ports agree on a river's liquid from both sides, also
//    with a liquid set on one span only; and no span of the real world is where rivers of two liquids meet.
// 5. The edge-swap frame (WS3 #6): after a zone's staged make (surfaceSteps) its world-function bands are kept,
//    so building them again takes no time and gives the same band; cold and warm times reported.
// 6. Ports: edgePorts is portsOf in §1.4's shape. forgetWorld drops what is kept (world functions, ports, bands).
// 7. validateSurface catches what it must (each a mutant of a valid zone): a hole outside the dungeon's rect,
//    water with air under it, the anchor walled in, an open edge cut off, a road on a map wall; and ground 13 up
//    can't be stood on.
// 8. Roads never climb a cliff: the test world's spans where the zone centre (a road's hub) is on a cliff
//    (verification of 2a: seeds 3, 20 and 42) have their hub on plain ground and no road on a map wall.
// 9. The test world's zones all hold plain water (the real world's biome data isn't theirs).
//
// The 2b half (docs/ws2.md "2b"), on the same zones:
// 10. Dressing, zone by zone: every 3D-only plateau is out of the map's reach (no column of it reached under the
//     map's rules) and in 3D's (a walk with steps up of 1 and jumps up 1 over a tile's gap, from the anchor), its
//     reward on top; every ramp's top is a cliff top 4 or more up (a map wall) that 3D reaches; every cache too;
//     every wildlife creature stands on map ground the anchor reaches, inside the keep, 2 tiles from the edges;
//     plateaus at most SURFACE_RULES.jumpSpots. Counts by biome are reported (plateaus, ramps, caches, creatures,
//     props) with the share of cliff tops 3D now reaches.
// 11. The builders and the tables: a builder for every terrain of the real world (BIOME_BUILDERS) and the test
//     world (TEST_BUILDERS); every biome's spawn keys registered creatures; no wildlife type has `depths` (it would
//     join the dungeons' default pool and move the legacy levels); every prop kind a biome names exists, with a
//     map glyph no creature family uses; the test world holds no wildlife.
// 12. WS2's legend handlers: every one registered, and a plan with each letter stamped into a flat zone builds
//     what it says (a trunk and its canopy, a prop, shallow and deep water at the datum on rock, road and dirt
//     ground, a step of rubble, a lamp post, the plan's creature).
// 13. Sub-ground: a raised column holds its biome's sub block from the datum's layer up (the Rust Steps' clay
//     cliffs), the same in the apron (item 3 compares every voxel).
// 14. The Gnomon's foot (WS3 #10): its span's middle column is solid from the datum to 14 blocks up, on every seed.
import { buildRun } from "../../src/world/run.js";
import { REAL_WORLD } from "../../src/content/world/worldmap.js";
import { TEST_WORLD } from "../../src/content/world/test-world.js";
import { generateSurface, surfaceSteps, validateSurface, worldFns, buildApronBand, forgetWorld, SURFACE_RULES, stampPlan,
         BIOME_BUILDERS, TEST_BUILDERS } from "../../src/gen/surface.js";
import { edgePorts, portsOf, portTable } from "../../src/gen/ports.js";
import { apronBandSteps } from "../../src/gen/apron.js";
import { biomeFor, BIOMES, DEFAULT_BIOME, PROPS, SETTLED_KINDS } from "../../src/content/biomes.js";
import { WILDLIFE } from "../../src/content/creatures/wildlife.js";
import { TERRAINS } from "../../src/content/world/terrains.js";
import { TEST_TERRAINS } from "../../src/content/world/test-world.js";
import { legendHandlers } from "../../src/gen/vaults.js";
import { WS2_LEGEND } from "../../src/gen/biomes/legend.js";
import { CREATURE_TYPES } from "../../src/creatures.js";
import { reachable, PLAYER_STEP_UP, PLAYER_DROP } from "../../src/pathing.js";
import { FAMILY_GLYPHS } from "./creatures.js";
import { KIND } from "../../src/blocks.js";
import { Zone, B, FLOOR_Z, SURFACE, APRON_SIDES, standWith } from "../../src/world.js";
import { SIDE_STEP } from "../../src/world/worldmodel.js";
import { makeRng } from "../../src/rng.js";

const ZW = SURFACE.w, ZD = SURFACE.d, ZH = SURFACE.h;
const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const ms = (v) => Math.round(v * 100) / 100;
// The span offset of a side or corner ("n", …, "ne", …).
const stepOf = (s) => [s.includes("e") ? 1 : s.includes("w") ? -1 : 0, s.includes("s") ? 1 : s.includes("n") ? -1 : 0];

export function checkSurface({ seeds = [1, 42, 1234], spans = 500, pairs = 50, budget = false } = {}) {
  const problems = [], notes = [], stats = {};
  const fail = (msg) => { if (problems.length < 60) problems.push(msg); };
  const t0 = performance.now();
  const times = [], navs = [];
  let zones = 0, retried = 0, ground3d = 0, twice = 0;
  const slope = { columns: 0, steps: 0, over: 0, high: 0, feet: 0, tier2: 0, strayTier2: 0, sheer: 0, maxH: 0, trees: 0, tallTrees: 0 };
  const apron = { pairs: 0, columns: 0, left: 0, leftDiffer: 0, voxels: 0, corners: 0, decoys: 0, told: 0 };
  const liquids = { zones: 0, rivers: 0, byLiquid: {} };
  const swap = { cold: [], warm: [], same: 0 };
  const dressed = { byBiome: {}, plateaus: 0, ramps: 0, caches: 0, creatures: 0, props: 0, tops: 0, topsReached: 0, sub: 0, localColumns: 0, overMarked: 0 };

  for (const seed of seeds) {
    const run = buildRun(seed, REAL_WORLD), world = run.world, W = worldFns(world, run.seed);
    const rng = makeRng(seed ^ 0x5a7f);
    const enterable = world.tiles.filter((t) => t.edges === "open" || t.landmark);
    const made = new Map();
    const zoneAt = (wx, wy) => {
      const key = `${wx},${wy}`;
      if (!made.has(key)) made.set(key, generateSurface(run, wx, wy));
      return made.get(key);
    };

    // 1. Spans.
    const pick = [...enterable];
    for (let k = pick.length - 1; k > 0; k--) { const j = rng.int(0, k); [pick[k], pick[j]] = [pick[j], pick[k]]; }
    for (const t of pick.slice(0, spans)) {
      const a = performance.now(), z = generateSurface(run, t.wx, t.wy);
      times.push(performance.now() - a);
      made.set(`${t.wx},${t.wy}`, z);
      const at = `seed ${seed} (${t.wx}, ${t.wy}) ${t.terrain}`;
      if (!z) { fail(`${at}: no zone`); continue; }
      zones++;
      if (z.attempts > 1) retried++;
      if (z.problems.length) fail(`${at}: ${z.problems.slice(0, 3).join("; ")} (after ${z.attempts} attempts)`);
      else if (validateSurface(z).length) fail(`${at}: validates in generation but not again`);
      navs.push(z.navigability);
      ground3d += z.ground3d;
      dressing(z, t, dressed, fail, at, W);
      if (zones % 25 === 0) {   // twice the same, on a sample
        const again = generateSurface(run, t.wx, t.wy);
        twice++;
        if (!again.blocks.every((v, i) => v === z.blocks[i]) || JSON.stringify([again.spawn, again.entrance, again.liquid]) !== JSON.stringify([z.spawn, z.entrance, z.liquid]))
          fail(`${at}: generated twice, not the same`);
      }
      // 4. Liquids.
      liquids.zones++;
      const river = W.portsOf(t.wx, t.wy).filter((p) => p.kind === "river");
      const want = river.length ? river.map((p) => p.liquid).sort()[0] : biomeFor(world, t).liquid;
      if (z.liquid !== want) fail(`${at}: liquid ${z.liquid}, want ${want}`);
      liquids.byLiquid[z.liquid] = (liquids.byLiquid[z.liquid] || 0) + 1;
      if (river.length) liquids.rivers++;
    }

    // 2. The world function.
    for (let k = 0; k < 100000; k++) {
      const gx = rng.int(0, world.w * ZW - 2), gy = rng.int(0, world.h * ZD - 2);
      const a = W.columnAt(gx, gy);
      slope.columns++;
      if (a.height > SURFACE_RULES.maxStand) slope.high++;
      if (a.tier === 2) {
        slope.tier2++;
        const span = world.tileAt(Math.floor(gx / ZW), Math.floor(gy / ZD));
        if (biomeFor(world, span).cliffTiers < 2) { slope.strayTier2++; fail(`seed ${seed} world (${gx}, ${gy}): a stacked mesa in ${span.terrain}`); }
      }
      if (a.height > slope.maxH) slope.maxH = a.height;
      for (const b of [W.columnAt(gx + 1, gy), W.columnAt(gx, gy + 1)]) {
        slope.steps++;
        const step = Math.abs(a.height - b.height);
        if (step > 1 && !a.cliff && !b.cliff && !a.water && !b.water) {
          slope.over++;
          fail(`seed ${seed} world (${gx}, ${gy}): a step of ${step} with no cliff or water`);
        }
        // A cliff's foot: from ground that isn't a cliff to a cliff, the rise is a map wall's (4 or more).
        if (a.cliff !== b.cliff && !a.water && !b.water && step < 4) { slope.feet++; fail(`seed ${seed} world (${gx}, ${gy}): a cliff's foot only ${step} high`); }
        // A stacked mesa stands on a ledge: never next to ground no cliff raises.
        if ((a.tier === 2 && !b.cliff && !b.water) || (b.tier === 2 && !a.cliff && !a.water)) { slope.sheer++; fail(`seed ${seed} world (${gx}, ${gy}): a stacked mesa straight out of the plain`); }
      }
      if (k % 10 === 0) {
        const t = W.treeAt(Math.floor(gx / SURFACE_RULES.treeCell), Math.floor(gy / SURFACE_RULES.treeCell));
        if (t) { slope.trees++; if (t.base + t.trunk + 1 > ZH - 1) slope.tallTrees++; }
      }
    }
    if (slope.tallTrees) fail(`seed ${seed}: ${slope.tallTrees} trees reach over the zone's ${ZH} blocks`);

    // 3. The apron against the neighbour's generated band.
    const sides = (wx, wy) => APRON_SIDES.filter((s) => {
      if (s.length === 1) return world.edgeOpen(wx, wy, s);
      const ns = s[0], ew = s[1], [dx, dy] = stepOf(s);
      return world.edgeOpen(wx, wy, ns) && world.edgeOpen(wx, wy, ew) && (world.edgeOpen(wx + dx, wy, ns) || world.edgeOpen(wx, wy + dy, ew));
    });
    let toldHere = 0;
    for (let k = 0, got = 0; got < pairs && k < pairs * 40; k++) {
      const t = enterable[rng.int(0, enterable.length - 1)], open = sides(t.wx, t.wy);
      if (!open.length) continue;
      const corners = open.filter((s) => s.length === 2), straight = open.filter((s) => s.length === 1);   // every third pair a corner
      const from = got % 3 === 2 && corners.length ? corners : straight;
      if (!from.length) continue;
      const side = from[rng.int(0, from.length - 1)];
      const [dx, dy] = stepOf(side), Bz = zoneAt(t.wx + dx, t.wy + dy);
      if (!Bz) { fail(`seed ${seed}: no zone at (${t.wx + dx}, ${t.wy + dy}) beyond the open ${side} of (${t.wx}, ${t.wy})`); continue; }
      got++;
      apron.pairs++;
      if (side.length === 2) apron.corners++;
      const A = { wx: t.wx, wy: t.wy, w: ZW, d: ZD, h: ZH };
      const fromWorld = buildApronBand(run, A, side, null);
      const differ = (band, other, count) => {
        const local = other.gen.local, copy = buildApronBand(run, A, side, other), n = band.bw * band.bd;
        let bad = 0;
        for (let ly = 0; ly < band.bd; ly++)
          for (let lx = 0; lx < band.bw; lx++) {
            const x = band.x0 + lx - dx * ZW, y = band.y0 + ly - dy * ZD;   // in B's coordinates
            let same = true;
            for (let z = 0; z < ZH && same; z++) same = band.blocks[lx + ly * band.bw + z * n] === copy.blocks[lx + ly * band.bw + z * n];
            if (count) apron.columns++;
            if (local[x + y * ZW]) { if (count) { apron.left++; if (!same) apron.leftDiffer++; } continue; }
            if (count) apron.voxels += ZH;
            if (!same && bad++ < 2 && count) fail(`seed ${seed}: (${t.wx}, ${t.wy})'s ${side} band from the world functions differs from ${other.key}'s blocks at its (${x}, ${y})`);
          }
        return bad;
      };
      differ(fromWorld, Bz, true);
      // Decoys: the same span's zone of another seed differs, or the comparison proves nothing (on flat, bare
      // ground every seed's is the same, so of 6 a seed at least one, and the count is reported).
      if (got <= 6) {
        apron.decoys++;
        const decoy = generateSurface(buildRun(seed + 1, REAL_WORLD), t.wx + dx, t.wy + dy);
        if (differ(fromWorld, decoy, false)) { apron.told++; toldHere++; }
      }
    }
    if (!toldHere) fail(`seed ${seed}: no decoy (another seed's neighbour) was told apart from the real one`);

    // 5. The swap frame: a staged make keeps the zone's world-function bands (a seed no other part used, so
    // nothing kept them before), and they are the bands a fresh build gives.
    const swapRun = buildRun(seed + 7777, REAL_WORLD);
    for (const t of pick.slice(spans, spans + 20)) {
      const it = surfaceSteps(swapRun, t.wx, t.wy);
      let r;
      do r = it.next(); while (!r.done);
      if (!r.value) continue;
      const want = sides(t.wx, t.wy);
      let a = performance.now();
      const warm = want.map((s) => buildApronBand(swapRun, r.value, s, null));
      swap.warm.push(performance.now() - a);
      a = performance.now();
      const cold = want.map((s) => buildApronBand(swapRun, r.value, s, null, { fresh: true }));
      swap.cold.push(performance.now() - a);
      if (cold.every((b, k) => b.blocks.every((v, i) => v === warm[k].blocks[i]))) swap.same++;
      else fail(`seed ${seed} (${t.wx}, ${t.wy}): a kept band differs from one built fresh`);
    }

    // 6. Ports.
    for (const t of pick.slice(0, 60)) {
      const flat = portsOf(world, run.seed, t.wx, t.wy), shaped = edgePorts(run, t.wx, t.wy);
      const back = Object.entries(shaped).flatMap(([side, list]) => list.map((p) => `${side}:${p.kind}:${p.at}:${p.width}:${p.edgeId}:${p.liquid ?? ""}`)).sort();
      const want = flat.map((p) => `${p.side}:${p.kind}:${p.along}:${p.width}:${p.edgeId}:${p.liquid ?? ""}`).sort();
      if (back.join() !== want.join()) fail(`seed ${seed} (${t.wx}, ${t.wy}): edgePorts ${back} vs portsOf ${want}`);
    }
    {
      const t = pick.find((p) => sides(p.wx, p.wy).length && made.get(`${p.wx},${p.wy}`)), z = made.get(`${t.wx},${t.wy}`), side = sides(t.wx, t.wy)[0];
      const band = buildApronBand(run, z, side, null), ports = portsOf(world, run.seed, t.wx, t.wy);
      forgetWorld(world);
      if (worldFns(world, run.seed) === W || portsOf(world, run.seed, t.wx, t.wy) === ports || buildApronBand(run, z, side, null) === band)
        fail(`seed ${seed}: forgetWorld kept something`);
    }
  }

  // 4b. A river's liquid set on some spans only (a world whose rivers name one, through tile.riverLiquid):
  // both sides of every river edge still agree.
  {
    const run = buildRun(5, REAL_WORLD), world = run.world;
    const fake = Object.create(world);
    fake.tileAt = (wx, wy) => { const t = world.tileAt(wx, wy); return t && (wx + wy) % 3 === 0 ? { ...t, riverLiquid: wx % 2 ? "ink" : "brine" } : t; };
    const ports = portTable(fake, 99);
    let edges = 0;
    for (const t of world.tiles)
      for (const p of ports(t.wx, t.wy)) {
        if (p.kind !== "river") continue;
        const [dx, dy] = SIDE_STEP[p.side], other = ports(t.wx + dx, t.wy + dy).find((o) => o.kind === "river" && o.edgeId === p.edgeId);
        edges++;
        if (!other || other.liquid !== p.liquid || other.along !== p.along) fail(`river edge ${p.edgeId}: ${p.liquid} from one side, ${other?.liquid} from the other`);
      }
    liquids.mixedEdges = edges;
  }
  // 4c. One liquid per span holds only if rivers of two liquids never meet in a span: the span would hold one of
  // them (liquidOf), and the other river would change liquid at that span's edge. The world's data must keep them
  // apart (today every river is plain water; integration request 2 gives the Inkrun its ink). A span with two river
  // ports of different liquids fails here, on every seed's ports.
  {
    const run = buildRun(1, REAL_WORLD), world = run.world;
    let meet = 0;
    for (const t of world.tiles) {
      const kinds = new Set(portsOf(world, run.seed, t.wx, t.wy).filter((p) => p.kind === "river").map((p) => p.liquid));
      if (kinds.size > 1) { meet++; fail(`real world (${t.wx}, ${t.wy}): rivers of ${[...kinds].join(" and ")} meet in one span`); }
    }
    liquids.meetings = meet;
  }

  // 7. Mutants of a valid zone: validateSurface must catch each.
  {
    const run = buildRun(1, REAL_WORLD), world = run.world;
    const t = world.tiles.find((s) => s.edges === "open" && !s.landmark && world.edgeOpen(s.wx, s.wy, "n") && world.edgeOpen(s.wx, s.wy, "e") && !run.sitesAt.get(`${s.wx},${s.wy}`)?.length);
    const fresh = () => { const z = generateSurface(run, t.wx, t.wy); z.refresh(); return z; };
    const expectCaught = (what, mutate, word) => {
      const z = fresh();
      mutate(z);
      z.refresh();
      const p = validateSurface(z);
      if (!p.some((m) => m.includes(word))) fail(`validateSurface missed ${what}: ${p.join("; ") || "no problem"}`);
    };
    const z0 = fresh(), ax = Math.floor(z0.spawn.x), ay = Math.floor(z0.spawn.y);
    if (validateSurface(z0).length) fail(`the mutants' zone (${t.wx}, ${t.wy}) isn't valid to begin with`);
    expectCaught("a hole outside the dungeon's rect", (z) => { for (let k = 0; k < z.h; k++) z.set(ax + 3, ay, k, B.AIR); }, "hole");
    expectCaught("water with air under it", (z) => { z.set(ax + 4, ay + 1, FLOOR_Z - 1, B.WATER_DEEP); z.set(ax + 4, ay + 1, 0, B.AIR); }, "water");
    // Ground 13 up can't be stood on at all: standHeight wants two blocks of air under the zone's roof (16), so
    // the zone's height itself keeps standable ground at 12 at most (validateSurface counts it anyway).
    {
      const z = fresh();
      const top = (hgt) => { for (let k = 0; k < z.h; k++) z.set(ax + 5, ay + 2, k, k <= FLOOR_Z - 1 + hgt ? B.ROCK : B.AIR); return z.standHeight(ax + 5, ay + 2); };
      if (top(12) !== FLOOR_Z + 12 || top(13) !== -1) fail(`ground 12 up stands at ${top(12)}, 13 up at ${top(13)} (want ${FLOOR_Z + 12} and -1)`);
    }
    expectCaught("the anchor walled in", (z) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) for (let k = 0; k < FLOOR_Z + 6; k++) z.set(ax + dx, ay + dy, k, B.ROCK);
    }, "navigability");
    expectCaught("a road on a map wall", (z) => {
      for (let k = 0; k < FLOOR_Z + 5; k++) z.set(ax + 6, ay, k, B.ROCK);
      z.set(ax + 6, ay, FLOOR_Z + 5, B.ROAD);
    }, "road columns");
    expectCaught("the north edge cut off", (z) => { for (let x = 0; x < z.w; x++) for (let k = 0; k < FLOOR_Z + 6; k++) z.set(x, 2, k, B.ROCK); }, "the n edge");
  }

  // 9. The test world keeps plain water: its fixture "flats" isn't the real world's (biomeFor), so the legacy
  // start span (the temple, 0, 0) and every other test-world zone hold "water".
  {
    const run = buildRun(1, TEST_WORLD), W = worldFns(run.world, run.seed);
    const odd = run.world.tiles.filter((t) => (t.edges === "open" || t.landmark) && W.liquidOf(t.wx, t.wy) !== "water");
    if (odd.length) fail(`test world: ${odd.length} spans hold another liquid than water, (${odd[0].wx}, ${odd[0].wy}) ${W.liquidOf(odd[0].wx, odd[0].wy)}`);
    if (generateSurface(run, 0, 0).liquid !== "water") fail("test world: the temple's span holds another liquid than water");
  }

  // 8. Roads and cliffs.
  for (const [seed, wx, wy] of [[3, 33, 4], [20, 31, 8], [42, 27, 8]]) {
    const run = buildRun(seed, TEST_WORLD), z = generateSurface(run, wx, wy), W = worldFns(run.world, run.seed);
    const hub = z.gen.hub, c = W.columnAt(wx * ZW + hub.x, wy * ZD + hub.y);
    if (c.cliff || c.water || z.problems.length) fail(`test world seed ${seed} (${wx}, ${wy}): hub (${hub.x}, ${hub.y}) cliff ${c.cliff}, water ${c.water}; ${z.problems.join("; ")}`);
  }

  // 10b. Spans the verification of 2b found a fault in (whatever the random sample holds), item 10's rules.
  for (const [seed, wx, wy, what] of REGRESSIONS) {
    const run = buildRun(seed, REAL_WORLD), t = run.world.tileAt(wx, wy), z = generateSurface(run, wx, wy);
    for (const p of z.problems) fail(`seed ${seed} (${wx}, ${wy}) (${what}): ${p}`);
    dressing(z, t, dressed, fail, `seed ${seed} (${wx}, ${wy}) ${t.terrain} (${what})`, worldFns(run.world, run.seed));
  }

  // 10c. Every biome's features fire: over 20 or more sampled zones of a biome whose data asks for plateaus, ponds or
  // ramps, some are made (dense woods leave no free ground without their clearings).
  for (const [id, b] of Object.entries(dressed.byBiome)) {
    const data = BIOMES[id] || {};
    if (b.n < 20) continue;
    if (data.plateaus > 0 && !b.plateaus) fail(`biome ${id}: no plateau in ${b.n} zones`);
    if (data.ponds?.count?.[1] > 0 && !b.ponds) fail(`biome ${id}: no pond in ${b.n} zones`);
    if (data.ramps?.[1] > 0 && !b.ramps) fail(`biome ${id}: no ramp in ${b.n} zones`);
  }

  // 11-14.
  builders(fail, dressed);

  // Numbers.
  times.sort((a, b) => a - b);
  navs.sort((a, b) => a - b);
  const p95 = q(times, 0.95), max = times[times.length - 1];
  if (budget && p95 > 60) fail(`surface generation p95 ${ms(p95)} ms is over the 60 ms budget`);
  if (budget && max > 150) fail(`surface generation max ${ms(max)} ms is over the 150 ms budget`);
  if (!slope.tier2) fail("no stacked cliff (tier 2) anywhere: the Rust Steps' mesas are missing");
  if (apron.pairs < pairs * seeds.length) fail(`only ${apron.pairs} apron pairs found`);
  stats.spans = `${zones} zones (${spans} a seed × ${seeds.length} seeds, the real world), ${retried} needed a retry, ${twice} made twice the same`;
  stats.navigability = `map: min ${(100 * navs[0]).toFixed(1)}%, p5 ${(100 * q(navs, 0.05)).toFixed(1)}%, mean ${(100 * navs.reduce((a, b) => a + b, 0) / navs.length).toFixed(1)}%; ground the map doesn't walk (cliff tops, plateaus) ${(ground3d / zones).toFixed(0)} columns a zone, ${(100 * dressed.topsReached / Math.max(1, dressed.tops)).toFixed(0)}% of the cliff tops reached in 3D`;
  stats.dressing = `${dressed.localColumns} columns marked local away from footprints and canopies, ${dressed.overMarked} of them the world function's; ${dressed.plateaus} plateaus, ${dressed.ramps} ramps, ${dressed.caches} caches, ${dressed.creatures} creatures, ${dressed.props} props over ${zones} zones; ` +
    Object.entries(dressed.byBiome).map(([k, v]) => `${k} ${v.n}: ${v.plateaus}/${v.ramps}/${v.caches}/${v.creatures}/${v.props}`).join(", ") + " (plateaus/ramps/caches/creatures/props)";
  stats.builders = dressed.builders;
  stats.ms = `generateSurface p50 ${ms(q(times, 0.5))}, p95 ${ms(p95)}, max ${ms(max)}${budget ? " (budget held)" : " (budget: --budget, alone)"}`;
  stats.slope = `${slope.columns} columns, ${slope.steps} steps: ${slope.over} over 1 without a cliff, ${slope.feet} cliff feet under 4, ${slope.high} over 12; highest ${slope.maxH}; ${slope.tier2} on stacked mesas (${slope.strayTier2} outside a stacking biome, ${slope.sheer} beside the plain); ${slope.trees} trees, ${slope.tallTrees} too tall`;
  stats.apron = `${apron.pairs} pairs (${apron.corners} corners): ${apron.columns} band columns, ${apron.voxels} voxels equal; ${apron.left} (${(100 * apron.left / Math.max(1, apron.columns)).toFixed(2)}%) the neighbour's own features left out, ${apron.leftDiffer} of them different; ${apron.told} of ${apron.decoys} decoys (another seed's neighbour) told apart`;
  stats.liquids = `${liquids.zones} zones (${liquids.rivers} with a river): ${Object.entries(liquids.byLiquid).map(([k, v]) => `${k} ${v}`).join(", ")}; ${liquids.mixedEdges} river edges agree with liquids on some spans only`;
  swap.cold.sort((a, b) => a - b); swap.warm.sort((a, b) => a - b);
  stats.swap = `a zone's world-function bands: cold p50 ${ms(q(swap.cold, 0.5))} / p95 ${ms(q(swap.cold, 0.95))} ms, after its staged make p50 ${ms(q(swap.warm, 0.5))} / p95 ${ms(q(swap.warm, 0.95))} ms; ${swap.same} of ${swap.cold.length} the same bits`;
  stats.seconds = ((performance.now() - t0) / 1000).toFixed(1);
  return { name: "surface", ok: problems.length === 0, problems, stats, notes };
}

// [seed, wx, wy, what was wrong there] (docs/sessions/ws2.md, Part 2b §4).
const REGRESSIONS = [
  [42, 20, 9, "a ramp up a cliff a site's skirt had pulled down to 3"],
  [1, 14, 10, "a shrub buried in a barrow"], [42, 31, 6, "a sinkhole under a prop"], [1, 34, 6, "a Stacks floor plan's stone outline on stone, marked local"], [1, 20, 15, "bones inside a crag"], [42, 10, 9, "a cache's scrap by the edge"],
];

// --- 10. Dressing, zone by zone ---------------------------------------------------------------------------
// Where 3D reaches from the anchor, column by column: a step up of at most 1 (a jump is 1.5 blocks), any drop,
// and a jump straight over one tile to a column at most 1 above, the tile between no higher than the take-off + 1
// (the parent's climb rooms: 2-tile gaps, +1 a jump). Columns with nowhere to stand are never entered.
export function reach3d(zone) {
  const { w, d } = zone, stand = standWith(zone, "open"), dist = new Int16Array(w * d).fill(-1);
  const a = Math.floor(zone.spawn.x) + Math.floor(zone.spawn.y) * w, q = [a];
  if (stand[a] < 0) return dist;
  dist[a] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % w, y = (i - x) / w, s = stand[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (const k of [1, 2]) {
        const nx = x + dx * k, ny = y + dy * k;
        if (nx < 0 || ny < 0 || nx >= w || ny >= d) break;
        const j = nx + ny * w;
        if (k === 2) { const m = stand[x + dx + (y + dy) * w]; if (m < 0 || m > s + 1) break; }
        if (stand[j] >= 0 && stand[j] - s <= 1 && dist[j] < 0) { dist[j] = dist[i] + 1; q.push(j); }
      }
    }
  }
  return dist;
}

function dressing(z, t, out, fail, at, W) {
  const g = z.gen, { w, d } = z, R = SURFACE_RULES;
  const b = (out.byBiome[t.biome] ||= { n: 0, plateaus: 0, ramps: 0, caches: 0, creatures: 0, props: 0, ponds: 0 });
  b.n++;
  b.ponds += g.ponds.length;
  const open = standWith(z, "open");
  for (let i = 0; i < w * d; i++) if (z.kind[i] === KIND.WALL) open[i] = -1;
  const map = reachable(open, w, d, Math.floor(z.spawn.x), Math.floor(z.spawn.y), PLAYER_STEP_UP, PLAYER_DROP), deep = reach3d(z);
  const onMap = (x, y) => map[x + y * w] >= 0, in3d = (x, y) => deep[x + y * w] >= 0;
  if (g.plateaus.length > R.jumpSpots) fail(`${at}: ${g.plateaus.length} plateaus`);
  for (const p of g.plateaus) {
    out.plateaus++; b.plateaus++;
    for (let y = p.y; y < p.y + p.d; y++)
      for (let x = p.x; x < p.x + p.w; x++) {
        if (onMap(x, y)) fail(`${at}: the plateau at (${p.x}, ${p.y}) is walked onto on the map at (${x}, ${y})`);
        if (!in3d(x, y)) fail(`${at}: the plateau at (${p.x}, ${p.y}) can't be reached in 3D at (${x}, ${y})`);
      }
    if (!z.items.some((it) => Math.floor(it.x) === p.reward.x && Math.floor(it.y) === p.reward.y && it.z === p.z)) fail(`${at}: the plateau at (${p.x}, ${p.y}) has no reward`);
  }
  for (const r of g.ramps) {
    out.ramps++; b.ramps++;
    if (r.top.z < FLOOR_Z + 4 || onMap(r.top.x, r.top.y)) fail(`${at}: a ramp's top (${r.top.x}, ${r.top.y}) at ${r.top.z} isn't a map wall`);
    if (!in3d(r.top.x, r.top.y) && in3d(r.foot.x, r.foot.y)) fail(`${at}: the ramp from (${r.foot.x}, ${r.foot.y}) doesn't reach its top (${r.top.x}, ${r.top.y}) in 3D`);
  }
  for (const c of g.caches) {
    out.caches++; b.caches++;
    if (onMap(c.x, c.y)) fail(`${at}: the cache at (${c.x}, ${c.y}) is on map ground`);
    if (!z.items.some((it) => Math.floor(it.x) === c.x && Math.floor(it.y) === c.y)) fail(`${at}: the cache at (${c.x}, ${c.y}) holds nothing`);
  }
  for (const c of z.creatures) {
    if (!WILDLIFE[c.type] && !(biomeFor({ terrains: TERRAINS }, t).spawns || []).some(([id]) => id === c.type)) continue;
    out.creatures++; b.creatures++;
    if (!onMap(c.tx, c.ty) || c.tx < R.edgeKeep || c.ty < R.edgeKeep || c.tx >= w - R.edgeKeep || c.ty >= d - R.edgeKeep)
      fail(`${at}: the ${c.type} at (${c.tx}, ${c.ty}) stands where the map doesn't reach, or by an edge`);
  }
  const propTiles = new Set();
  for (const p of z.props) {
    out.props++; b.props++;
    const x = Math.floor(p.x), y = Math.floor(p.y);
    if (!PROPS[p.kind]) fail(`${at}: an unknown prop ${p.kind}`);
    // On the ground, in air, inside the keep, one a tile.
    if (z.get(x, y, p.z) || !z.get(x, y, p.z - 1) || x < R.edgeKeep || y < R.edgeKeep || x >= w - R.edgeKeep || y >= d - R.edgeKeep || propTiles.has(x + y * w))
      fail(`${at}: the ${p.kind} at (${x}, ${y}, ${p.z}) is inside ${z.get(x, y, p.z)}, floats, sits by an edge or shares its tile`);
    propTiles.add(x + y * w);
  }
  // Over-marking: a column marked local really differs from the world function's (rock, sub-ground, ground, water),
  // away from a site's footprint (marked whole by 2a) and from tree canopies (columnAt doesn't build trees).
  const ox = z.wx * w, oy = z.wy * d, C = R.treeCell, treeNear = (x, y) => {
    for (let cy = Math.floor((oy + y - 1) / C); cy <= Math.floor((oy + y + 1) / C); cy++)
      for (let cx = Math.floor((ox + x - 1) / C); cx <= Math.floor((ox + x + 1) / C); cx++) {
        const tr = W.treeAt(cx, cy);
        if (tr && Math.abs(tr.gx - ox - x) <= 1 && Math.abs(tr.gy - oy - y) <= 1) return true;
      }
    return false;
  };
  for (let i = 0; i < w * d; i++) {
    if (!g.local[i] || g.footprint[i] || g.plan[i]) continue;
    const x = i % w, y = (i - x) / w;
    if (treeNear(x, y)) continue;
    const c = W.columnAt(ox + x, oy + y), top = FLOOR_Z - 1 + c.height;
    let same = true;
    for (let k = 0; k < z.h && same; k++) {
      const want = c.water ? (k < FLOOR_Z - 1 ? B.ROCK : k === FLOOR_Z - 1 ? (c.water === 2 ? B.WATER_DEEP : B.WATER_SHALLOW) : 0)
        : k < FLOOR_Z - 1 ? B.ROCK : k < top ? c.sub : k === top ? c.ground : 0;
      same = z.get(x, y, k) === want;
    }
    out.localColumns++;
    if (same) { out.overMarked++; fail(`${at}: (${x}, ${y}) is marked local but is the world function's column`); break; }
  }
  // Cliff tops (ground the map draws as wall): how many 3D reaches.
  for (let i = 0; i < w * d; i++) if (g.cliff[i] && open[i] < 0 && z.stand[i] >= 0) { out.tops++; if (deep[i] >= 0) out.topsReached++; }
  // 13. Sub-ground: a raised plain column (no feature of the zone's own) holds the biome's sub from the datum's layer up.
  const sub = B[biomeFor({ terrains: TERRAINS }, t).sub] ?? B.ROCK;
  for (let i = 0; i < w * d; i += 97) {
    if (g.local[i] || z.stand[i] < FLOOR_Z + 2 || g.worldWater[i] || g.scenery[i]) continue;
    const x = i % w, y = (i - x) / w;
    if (z.get(x, y, FLOOR_Z - 1) !== sub || z.get(x, y, 0) !== B.ROCK) { fail(`${at}: (${x}, ${y}) is ${z.get(x, y, FLOOR_Z - 1)} at the datum's layer, want the sub-ground ${sub}`); break; }
    out.sub++;
  }
}

// --- 11, 12, 14. The builders, the tables, the legend, the Gnomon's foot ---------------------------------
function builders(fail, out) {
  const lacking = [...Object.entries(TERRAINS).filter(([id, T]) => !BIOME_BUILDERS[T.biome || id]).map(([id]) => id),
                   ...Object.keys(TEST_TERRAINS).filter((id) => !TEST_BUILDERS[id]).map((id) => `test ${id}`)];
  if (lacking.length) fail(`no builder for ${lacking.join(", ")}`);
  for (const [id, bio] of Object.entries(BIOMES))
    for (const [type] of bio.spawns || []) if (!CREATURE_TYPES[type]) fail(`biome ${id}: spawn key ${type} is no creature`);
  // Every span you can be in has a species of its own level in its biome's table (no fallback to the nearest).
  {
    const world = buildRun(1, REAL_WORLD).world, gaps = new Map();
    for (const t of world.tiles.filter((s) => s.edges === "open" || s.landmark)) {
      const spawns = biomeFor(world, t).spawns || [];
      if (!spawns.length) continue;
      const ok = spawns.some(([type]) => { const T = CREATURE_TYPES[type], [lo, hi] = T?.levels || T?.depths || [1, 99]; return T && lo <= t.level && t.level <= hi; });
      if (!ok) gaps.set(`${t.biome} level ${t.level}`, (gaps.get(`${t.biome} level ${t.level}`) || 0) + 1);
    }
    for (const [k, v] of gaps) fail(`no wildlife of ${k} (${v} spans)`);
    out.levelSpans = world.tiles.length;
  }
  for (const [id, t] of Object.entries(WILDLIFE)) {
    if (t.depths) fail(`wildlife ${id} has depths (it would join the dungeons' default pool)`);
    if (!t.levels) fail(`wildlife ${id} has no levels`);
  }
  for (const [id, bio] of [...Object.entries(BIOMES), ["(default)", DEFAULT_BIOME]])
    for (const [kind] of bio.props?.kinds || []) if (!PROPS[kind]) fail(`biome ${id}: prop ${kind} doesn't exist`);
  for (const [id, p] of Object.entries(PROPS)) if (FAMILY_GLYPHS.includes(p.glyph)) fail(`prop ${id}'s glyph ${p.glyph} is a creature family's`);
  // The test world: no wildlife.
  {
    const run = buildRun(7, TEST_WORLD);
    let wild = 0, zones = 0;
    for (const t of run.world.tiles.filter((s) => s.edges === "open").slice(0, 400).filter((_, k) => k % 10 === 0)) {
      zones++;
      wild += generateSurface(run, t.wx, t.wy).creatures.filter((c) => WILDLIFE[c.type]).length;
    }
    if (wild) fail(`the test world holds ${wild} wildlife over ${zones} zones`);
  }
  // 12. The legend.
  const missing = WS2_LEGEND.filter((id) => !legendHandlers().includes(id));
  if (missing.length) fail(`legend handlers not registered: ${missing.join(", ")}`);
  {
    const z = new Zone({ key: "0,0,0", wx: 0, wy: 0, z: 0, type: "surface", level: 4, tier: 2, seed: 99, ...SURFACE });
    for (let y = 0; y < z.d; y++) for (let x = 0; x < z.w; x++) { z.set(x, y, 0, B.ROCK); z.set(x, y, FLOOR_Z - 1, B.GRASS); }
    const plan = { id: "legendTest", rows: ["T.p.s.d.r.a.u.l.c"], legend: { T: "tree", p: "prop", s: "shallow", d: "deep", r: "road", a: "path", u: "rubble", l: "station", c: "creature" },
                   props: { p: "bones" }, creatures: { c: "saltrat" }, wall: B.STONE };
    stampPlan(z, plan, 10, 10, makeRng(5));
    const col = (x, dz) => z.get(10 + x, 10, FLOOR_Z + dz);
    const want = [
      ["tree", col(0, 0) === B.TRUNK && col(0, 3) === B.TRUNK && z.get(11, 11, FLOOR_Z + 4) === B.LEAVES],
      ["prop", z.props.some((p) => p.kind === "bones" && Math.floor(p.x) === 12)],
      ["shallow", z.get(14, 10, FLOOR_Z - 1) === B.WATER_SHALLOW && z.get(14, 10, 0) === B.ROCK && !col(4, 0)],
      ["deep", z.get(16, 10, FLOOR_Z - 1) === B.WATER_DEEP && z.get(16, 10, 0) === B.ROCK],
      ["road", z.get(18, 10, FLOOR_Z - 1) === B.ROAD && !col(8, 0)],
      ["path", z.get(20, 10, FLOOR_Z - 1) === B.DIRT],
      ["rubble", col(12, 0) === B.ROCK && !col(12, 1)],
      ["station", col(14, 0) === B.STONE && col(14, 1) === B.STONE && col(14, 2) === B.LAMP],
      ["creature", z.creatures.some((c) => c.type === "saltrat" && c.tx === 26 && c.ty === 10)],
    ];
    for (const [id, ok] of want) if (!ok) fail(`legend "${id}" didn't build what it says`);
    out.legend = want.length;
  }
  // Settlements hold no wildlife: every span of a settled landmark, on 5 seeds.
  {
    let spans = 0;
    for (const seed of [1, 7, 42, 1234, 31337]) {
      const run = buildRun(seed, REAL_WORLD);
      for (const L of run.world.landmarks.values()) {
        if (!SETTLED_KINDS.includes(L.kind)) continue;
        for (const [wx, wy] of L.spans || [[L.wx, L.wy]]) {
          spans++;
          const wild = generateSurface(run, wx, wy).creatures.filter((c) => WILDLIFE[c.type]);
          if (wild.length) fail(`seed ${seed}: ${L.name} (${wx}, ${wy}) holds ${wild.length} wildlife (${wild[0].type})`);
        }
      }
    }
    out.settled = spans;
  }
  // 14. The Gnomon's foot.
  let feet = 0;
  for (const seed of [1, 7, 42, 1234, 31337]) {
    const run = buildRun(seed, REAL_WORLD), L = run.world.landmarks.get("gnomon"), z = generateSurface(run, L.wx, L.wy);
    const cx = z.w >> 1, cy = z.d >> 1;
    let solid = 0;
    for (let k = FLOOR_Z; k < FLOOR_Z + 14; k++) if (z.get(cx, cy, k)) solid++;
    if (solid !== 14 || z.problems.length) fail(`seed ${seed}: the Gnomon's foot is ${solid} blocks (want 14)${z.problems.length ? `; ${z.problems.join("; ")}` : ""}`);
    else feet++;
  }
  out.builders = `${Object.keys(BIOME_BUILDERS).length} real biome builders, ${Object.keys(TEST_BUILDERS).length} test; ${Object.keys(WILDLIFE).length} wildlife types; ` +
    `${WS2_LEGEND.length} legend handlers, ${out.legend} built right; the Gnomon's 14-block foot on ${feet} seeds; no wildlife in ${out.settled} settlement spans; ${out.sub} raised columns of their sub-ground`;
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser).
export async function run(env) {
  const a = env.args || {};
  return checkSurface({
    seeds: a.seeds ? String(a.seeds).split(",").map(Number) : undefined,
    spans: a.spans !== undefined ? Number(a.spans) : 500,
    pairs: a.pairs !== undefined ? Number(a.pairs) : 50,
    budget: !!a.budget && a.budget !== "false",
  });
}
