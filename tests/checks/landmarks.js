// Landmark zones and surface navigability (TECH_DESIGN §5.3, §5.4, 0A2 gate) on the test world.
//
//   checkLandmarks({ seeds = [1, 7, 42, 1234, 31337], tiles = 500 }) → { name, ok, problems, stats, notes }
//
// 1. Every landmark's surface zone validates (validateSurface, first time or within its retries) on every
//    seed, twice the same (blocks, entrance, dungeonRect, anchor), with what its landmark promises:
//    the temple: Maren, the cube on the altar, the spike hall, the cube wall, the stairs at the bottom of
//    the shaft, the front door, and the legacy levels 1:1 under the parent's 48×48 frame (dungeonRect at
//    the rect's corner) with no sinkholes; the ruin: its stairs as zone.entrance, a dungeonRect centred
//    under them (§5.5) and sinkholes only inside it, each over level 1's floor (a fall lands right under it); the tower: no dungeon, its yard on the open east edge.
//    The ruin's 5 levels validate, the last one the Flat Queen's hall with no way down.
// 2. Navigability: 500 random spans you can be in (spread over the seeds) all validate, and each has at
//    least 90% of its ground in one piece reachable from the anchor under the map's step rules. The
//    numbers (lowest, mean, attempts, timing) are reported.
// 3. The real world's landmarks (WS2b; bible §15.3): every span of every landmark validates on every seed, twice
//    the same, named for its landmark, with the way down where it has a dungeon (zone.entrance a STAIRS block,
//    reachable: a key point); their plans come in C1, and until then a landmark stands on its stub footprint
//    (the Gnomon on its 14-block foot, check-surface).
// 4. Hollowmere (C1a, bible §5 A, §9.4), on every seed: the start, on its plan at the zone's corner; the parent's temple
//    at (2, 2) with Maren, the cube, its spikes and cube wall, you waking in your room, the Keeper's Stair (the 20-level
//    legacy stack) at its stairs in the parent's frame, no sinkhole outside the shaft; every house a block up on its
//    stilts but the stone crypt (plank floor, slab roof, its walls on the map, its door up there); every person's place a key point
//    (reachable); the commons lamp, the brine beds (shallow, the Flats' brine), the boardwalks, every prop; nobody but
//    Maren in it (a settlement: no wildlife); the Old Rule coming in; and its four seams on the world function, with no
//    step across them over a block but at a cliff.
import { buildRun } from "../../src/world/run.js";
import { TEST_WORLD } from "../../src/content/world/test-world.js";
import { REAL_WORLD } from "../../src/content/world/worldmap.js";
import { HOLLOWMERE_ROWS, HOLLOWMERE_HOUSES, HOLLOWMERE_PEOPLE } from "../../src/content/world/plans/hollowmere.js";   // C1a
import { TEMPLE_ROWS } from "../../src/content/world/temple.js";
import { generateSurface, validateSurface, dungeonRectFor, SURFACE_RULES, worldFns } from "../../src/gen/surface.js";
import { siteWithDungeon, dungeonParams } from "../../src/world/zonegen.js";
import { generateDungeonLevel, validateDungeonLevel } from "../../src/gen/dungeon.js";
import { zoneSeed } from "../../src/world/run.js";
import { B, FLOOR_Z } from "../../src/world.js";
import { KIND } from "../../src/blocks.js";
import { makeRng } from "../../src/rng.js";

const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
const holesOf = (z) => {
  const out = [];
  for (let y = 0; y < z.d; y++) for (let x = 0; x < z.w; x++) if (!z.get(x, y, 0) && !z.get(x, y, FLOOR_Z - 1)) out.push([x, y]);
  return out;
};
const sameZone = (a, b) => a.blocks.every((v, i) => v === b.blocks[i]) && JSON.stringify([a.entrance, a.dungeonRect, a.spawn, a.stairs])
  === JSON.stringify([b.entrance, b.dungeonRect, b.spawn, b.stairs]);

export function checkLandmarks({ seeds = [1, 7, 42, 1234, 31337], tiles = 500 } = {}) {
  const problems = [], notes = [], stats = {};
  const expect = (cond, msg) => { if (!cond) problems.push(msg); };
  let zones = 0, retried = 0, levels = 0;

  for (const seed of seeds) {
    const run = buildRun(seed, TEST_WORLD), world = run.world;
    for (const L of world.landmarks.values()) {
      const at = `seed ${seed} ${L.id}`;
      const z = generateSurface(run, L.wx, L.wy);
      zones++;
      if (z.attempts > 1) retried++;
      for (const p of z.problems) problems.push(`${at}: ${p}`);
      expect(sameZone(z, generateSurface(run, L.wx, L.wy)), `${at}: two generations differ`);
      expect(z.landmarkId === L.id && z.name === L.name, `${at}: the zone doesn't say it is ${L.name}`);
      const holes = holesOf(z);
      // Every wall cell ('#') of a plan stamped by stampVault is a wall on the map, however high it is.
      const planDef = world.plans?.[L.plan], pa = z.gen?.planAt;
      if (planDef?.rows && !planDef.stamp) {
        expect(pa, `${at}: a stamped plan with no gen.planAt, so its walls can't be checked`);
        let notWall = 0;
        if (pa) planDef.rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === "#" && z.kind[pa.x + x + (pa.y + y) * z.w] !== KIND.WALL) notWall++; }));
        expect(notWall === 0, `${at}: ${notWall} of the plan's wall cells are not walls on the map`);
      }
      if (L.id === "temple") {
        expect(z.creatures.some((n) => n.talk && n.type === "maren"), `${at}: no Maren`);
        expect(z.items.some((i) => i.kind === "cube") && z.blocks.includes(B.ALTAR), `${at}: no cube on the altar`);
        expect(z.spikes.size > 0 && z.cubeWall?.length > 0, `${at}: no spike hall or no cube wall`);
        expect(z.entrance && z.get(z.entrance.x, z.entrance.y, FLOOR_Z - 1) === B.STAIRS, `${at}: the entrance is not a STAIRS block`);
        expect(z.blocks.includes(B.DOOR) && z.edges.e && z.edges.s && !z.edges.n && !z.edges.w, `${at}: front door or edges wrong`);
        expect(z.hasBelow && z.dungeonRect?.ox === L.rect.x && z.dungeonRect?.oy === L.rect.y, `${at}: the legacy levels don't sit under the parent's frame (${JSON.stringify(z.dungeonRect)})`);
        expect(holes.every(([x, y]) => x >= 49 && x <= 57 && y >= 35 && y <= 42), `${at}: a hole outside the shaft (no sinkholes over the legacy stack)`);
        expect(world.start.landmarkId === "temple" && Math.floor(z.spawn.x) === 22 && Math.floor(z.spawn.y) === 5, `${at}: the anchor is not your room`);
      } else if (L.id === "ruin") {
        expect(z.entrance && z.get(z.entrance.x, z.entrance.y, FLOOR_Z - 1) === B.STAIRS, `${at}: the entrance is not a STAIRS block`);
        const want = z.entrance && dungeonRectFor(z.entrance);
        expect(z.hasBelow && want && z.dungeonRect.ox === want.ox && z.dungeonRect.oy === 0, `${at}: dungeonRect ${JSON.stringify(z.dungeonRect)} is not centred under the entrance`);
        const r = z.dungeonRect;
        expect(holes.length > 0, `${at}: no sinkhole`);
        expect(holes.every(([x, y]) => x >= r.ox && x < r.ox + 48 && y >= r.oy && y < r.oy + 48), `${at}: a sinkhole outside the dungeonRect`);
        const site = siteWithDungeon(run, L.wx, L.wy);
        for (let lz = 1; lz <= site.dungeon.levels; lz++) {
          const p = dungeonParams(run, site, lz), lvl = generateDungeonLevel(zoneSeed(run, L.wx, L.wy, lz), p);
          levels++;
          if (lz === 1) {   // a fall lands right under its sinkhole: floor there, not stairs
            if (!lvl.hasDerived) lvl.refresh();
            for (const [x, y] of holes) {
              const lx = x - r.ox, ly = y - r.oy, g = lvl.get(lx, ly, FLOOR_Z - 1);
              expect(lvl.stand[lx + ly * lvl.w] >= 0 && g !== B.STAIRS && g !== B.STAIRS_UP, `${at}: no floor on level 1 under the sinkhole at (${x}, ${y})`);
            }
          }
          for (const q of validateDungeonLevel(lvl, p)) problems.push(`${at} level ${lz}: ${q}`);
          if (lz === site.dungeon.levels)
            expect(lvl.final && !lvl.stairs && lvl.guardianHall?.type === "flatqueen", `${at}: the last level is not the Flat Queen's hall without a way down`);
        }
      } else if (L.id === "tower") {
        expect(!z.hasBelow && !z.entrance && holes.length === 0, `${at}: the tower has a way down`);
        expect(z.edges.e && L.rect.x + L.rect.w === z.w && z.stand.slice(0).length && z.stand[z.w - 1 + (L.rect.y + 1) * z.w] === FLOOR_Z,
               `${at}: the tower's yard doesn't reach the open east edge at the datum`);
      }
    }
  }

  // The real world's landmarks.
  let realZones = 0, realRetried = 0;
  for (const seed of seeds) {
    const run = buildRun(seed, REAL_WORLD), world = run.world;
    for (const L of world.landmarks.values())
      for (const [wx, wy] of L.spans || [[L.wx, L.wy]]) {
        const at = `real world seed ${seed} ${L.id} (${wx}, ${wy})`, z = generateSurface(run, wx, wy);
        realZones++;
        if (z.attempts > 1) realRetried++;
        for (const p of z.problems) problems.push(`${at}: ${p}`);
        expect(sameZone(z, generateSurface(run, wx, wy)), `${at}: two generations differ`);
        expect(z.landmarkId === L.id && z.name === L.name, `${at}: the zone doesn't say it is ${L.name}`);
        if (L.dungeon && wx === L.wx && wy === L.wy && !L.dungeon.legacy)
          expect(z.entrance && z.get(z.entrance.x, z.entrance.y, FLOOR_Z - 1) === B.STAIRS && z.gen.keyPoints.some((k) => k.x === z.entrance.x && k.y === z.entrance.y),
                 `${at}: no way down into ${L.dungeon.id}`);
      }
  }

  // C1a: Hollowmere on its plan (section 4 of the header), on every seed.
  stats.hollowmere = checkHollowmere(seeds, expect);

  // Navigability on random spans.
  const navs = [], ms = [];
  let failed = 0, attempts = 0;
  const per = Math.ceil(tiles / seeds.length);
  for (const seed of seeds) {
    const run = buildRun(seed, TEST_WORLD), rng = makeRng(seed ^ 0x5a5a);
    // Drawn without replacement: every sample of a seed is a different span.
    const open = rng.shuffle(run.world.tiles.filter((t) => t.edges === "open" || t.landmark));
    for (let k = 0; k < per && k < open.length && navs.length < tiles; k++) {
      const t = open[k];
      const t0 = performance.now();
      const z = generateSurface(run, t.wx, t.wy);
      ms.push(performance.now() - t0);
      attempts += z.attempts;
      const again = validateSurface(z);   // also re-checks the stored verdict
      navs.push(z.navigability);
      if (z.problems.length || again.length) {
        failed++;
        if (failed <= 8) problems.push(`seed ${seed} span (${t.wx}, ${t.wy}) ${t.terrain}: ${(z.problems.length ? z.problems : again).slice(0, 3).join("; ")}`);
      }
      if (!(z.navigability >= SURFACE_RULES.minNav)) problems.push(`seed ${seed} span (${t.wx}, ${t.wy}): navigability ${(100 * z.navigability).toFixed(1)}%`);
    }
  }
  navs.sort((a, b) => a - b); ms.sort((a, b) => a - b);
  stats.landmarkZones = `${zones} (${retried} needed a retry), ruin levels ${levels}`;
  stats.realLandmarks = `${realZones} zones (every span of ${REAL_WORLD.landmarks.length} landmarks × ${seeds.length} seeds), ${realRetried} needed a retry`;
  stats.spans = `${navs.length} (each a different span of its seed)`;
  stats.failed = failed;
  stats.navigability = { min: +(100 * navs[0]).toFixed(1), p5: +(100 * pct(navs, 0.05)).toFixed(1),
                         mean: +((100 * navs.reduce((s, v) => s + v, 0)) / navs.length).toFixed(1) };
  stats.attempts = { total: attempts, extra: attempts - navs.length };
  stats.ms = { p50: +pct(ms, 0.5).toFixed(1), p95: +pct(ms, 0.95).toFixed(1), max: +ms[ms.length - 1].toFixed(1) };
  return { name: "landmarks", ok: problems.length === 0, problems, stats, notes };
}

// Hollowmere (C1a; bible §5 A, §9.4): the start stands on its plan, generates the same twice (above, with every
// landmark), and seams with its four neighbours.
function checkHollowmere(seeds, expect) {
  const P = REAL_WORLD.plans.hollowmere, rows = HOLLOWMERE_ROWS;
  const cells = (ch) => rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === ch ? [[x, y]] : [])));
  const tcell = (ch) => { for (let y = 0; y < TEMPLE_ROWS.length; y++) { const x = TEMPLE_ROWS[y].indexOf(ch); if (x >= 0) return [x + 2, y + 2]; } return null; };
  let houses = 0, people = 0, seams = 0, seamTiles = 0, beds = 0, props = 0;
  for (const seed of seeds) {
    const run = buildRun(seed, REAL_WORLD), W = run.world, L = W.landmarks.get("hollowmere"), at = `real world seed ${seed} hollowmere`;
    expect(W.start.landmarkId === "hollowmere" && L.plan === "hollowmere" && L.wx === 5 && L.wy === 16, `${at}: not the start on its plan`);
    const z = generateSurface(run, 5, 16), pa = z.gen?.planAt;
    expect(pa && pa.x === 0 && pa.y === 0 && pa.w === 78 && pa.d === 48, `${at}: the plan isn't stamped at the zone's corner (${JSON.stringify(pa)})`);
    if (!pa) continue;
    // The temple, the parent's, at (2, 2), with the Keeper's Stair (the legacy stack) under it in the parent's frame.
    const [mx, my] = tcell("M"), [sx, sy] = tcell(">"), [ax, ay] = tcell("@");
    expect(z.creatures.some((c) => c.type === "maren" && c.tx === mx && c.ty === my), `${at}: no Maren at her place in the temple`);
    expect(z.items.some((i) => i.kind === "cube") && z.blocks.includes(B.ALTAR) && z.spikes.size > 0 && z.cubeWall?.length > 0, `${at}: the temple's altar, cube, spikes or cube wall missing`);
    expect(z.entrance && z.entrance.x === sx && z.entrance.y === sy && z.get(sx, sy, FLOOR_Z - 1) === B.STAIRS, `${at}: the Keeper's Stair isn't at the temple's stairs`);
    expect(z.hasBelow && z.dungeonRect?.ox === 0 && z.dungeonRect?.oy === 0 && holesOf(z).every(([x, y]) => x >= 31 + 2 && x <= 41 + 2 && y >= 33 + 2 && y <= 40 + 2),
           `${at}: the legacy levels' frame ${JSON.stringify(z.dungeonRect)} or a sinkhole outside the shaft`);
    expect(Math.floor(z.spawn.x) === ax && Math.floor(z.spawn.y) === ay, `${at}: you don't wake in your room (${z.spawn.x}, ${z.spawn.y})`);
    expect(siteWithDungeon(run, 5, 16)?.dungeon?.legacy && siteWithDungeon(run, 5, 16).dungeon.levels === 20, `${at}: the Keeper's Stair isn't the 20-level legacy stack`);
    // The village: houses on stilts a block up, their doors there, thatch walls on the map, a slab roof.
    for (const h of HOLLOWMERE_HOUSES) {
      const inner = [], doors = [], up = h.ground ? 0 : 1;   // (the crypt stands on the ground)
      for (let y = h.y; y < h.y + h.d; y++) for (let x = h.x; x < h.x + h.w; x++) {
        const c = rows[y][x], i = x + y * z.w;
        if (c === "D") doors.push([x, y]);
        else if (c === "#" || c === "U") expect(z.kind[i] === KIND.WALL && z.get(x, y, FLOOR_Z + 1) === h.wall, `${at}: ${h.id}'s wall at (${x}, ${y})`);
        else { inner.push([x, y]); expect(z.stand[i] === FLOOR_Z + up && z.get(x, y, FLOOR_Z - 1 + up) === B.PLANK && z.get(x, y, FLOOR_Z + 4 + up) === h.wall, `${at}: ${h.id}'s floor or roof at (${x}, ${y})`); }
      }
      expect(doors.length === 1 && z.get(doors[0][0], doors[0][1], FLOOR_Z + up) === B.DOOR, `${at}: ${h.id}'s door`);
      expect(inner.length > 0, `${at}: ${h.id} has no inside`);
      houses++;
    }
    // Who stands where (C5's people): each a key point (validateSurface: reachable from your room).
    for (const ch of HOLLOWMERE_PEOPLE) {
      const [[x, y]] = cells(ch);
      expect(z.gen.keyPoints.some((k) => k.x === x && k.y === y), `${at}: ${ch}'s place isn't a key point`);
      people++;
    }
    // The commons lamp, the brine beds (shallow brine at the datum), the boardwalks, the props, the Old Rule to the porch.
    const [[lx, ly]] = cells("L");
    expect(z.get(lx, ly, FLOOR_Z + 2) === B.LAMP, `${at}: no commons lamp`);
    for (const [x, y] of cells("~")) { beds++; expect(z.get(x, y, FLOOR_Z - 1) === B.WATER_SHALLOW && z.kind[x + y * z.w] === KIND.SHALLOW, `${at}: the bed at (${x}, ${y}) isn't shallow water`); }
    expect(z.liquid === "brine", `${at}: the zone's liquid is ${z.liquid}, not the Flats' brine`);
    for (const [x, y] of cells(",")) expect(z.get(x, y, FLOOR_Z - 1) === B.PLANK && z.kind[x + y * z.w] === KIND.FLOOR, `${at}: the boardwalk at (${x}, ${y})`);
    const want = ["r", "g", "s"].reduce((n, ch) => n + cells(ch).length, 0);
    expect(z.props.length === want, `${at}: ${z.props.length} props, the plan has ${want}`);
    props += z.props.length;
    expect(z.creatures.every((c) => c.type === "maren"), `${at}: wildlife or someone else in the start village (${z.creatures.map((c) => c.type)})`);
    // (the road is laid over the plan's open ground, which the plan keeps: it reaches the temple's porch, the H cells,
    // whatever the plan calls its hub)
    const [hx, hy] = tcell("H");
    let roadAtPorch = false;
    for (let y = hy - 2; y <= hy + 2; y++) for (let x = hx + 2; x <= hx + 4; x++) if (z.get(x, y, FLOOR_Z - 1) === B.ROAD) roadAtPorch = true;
    expect(roadAtPorch && z.gen.ports.some((p) => p.kind === "road" && p.side === "e"), `${at}: the Old Rule doesn't come in from the east to the porch`);
    // Seams with the four neighbours (check-edges' rules (a) and (c)): the ground on both sides of every edge tile is
    // the world function's, and no step across is over a block unless it's a cliff.
    const Wf = worldFns(W, run.seed);
    for (const side of ["n", "e", "s", "w"]) {
      const [dx, dy] = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[side], nb = generateSurface(run, 5 + dx, 16 + dy);
      if (!W.edgeOpen(5, 16, side)) continue;
      seams++;
      const len = side === "n" || side === "s" ? z.w : z.d;
      for (let k = 0; k < len; k++) {
        const [ax2, ay2] = side === "n" ? [k, 0] : side === "s" ? [k, z.d - 1] : side === "w" ? [0, k] : [z.w - 1, k];
        const [bx, by] = side === "n" ? [k, nb.d - 1] : side === "s" ? [k, 0] : side === "w" ? [nb.w - 1, k] : [0, k];
        const ga = groundOf(z, ax2, ay2, rows), gb = groundOf(nb, bx, by);
        const fa = FLOOR_Z + Wf.heightAt(5 * z.w + ax2, 16 * z.d + ay2), fb = FLOOR_Z + Wf.heightAt((5 + dx) * nb.w + bx, (16 + dy) * nb.d + by);
        seamTiles++;
        if (ga !== null && ga !== fa) expect(false, `${at}: its ${side} edge at ${k} stands ${ga}, the world function ${fa}`);
        if (gb !== null && gb !== fb) expect(false, `${at}: the ${side} neighbour's edge at ${k} stands ${gb}, the world function ${fb}`);
        if (ga !== null && gb !== null && Math.abs(ga - gb) > 1 && !Wf.columnAt(5 * z.w + ax2, 16 * z.d + ay2).cliff) expect(false, `${at}: a ${Math.abs(ga - gb)}-block step across its ${side} edge at ${k}`);
      }
    }
  }
  return `on ${seeds.length} seeds: the temple with Maren, the cube and the Keeper's Stair in the parent's frame, you in your room; ` +
    `${houses} houses on their stilts, ${people} people's places reachable, the commons lamp, ${beds} brine-bed tiles, ${props} props; ` +
    `${seams} seams (${seamTiles} tiles) on the world function`;
}
const GROUND_SKIP = new Set([B.LEAVES, B.TRUNK]);
// The ground a seam rule compares: the top of the terrain column (water at the datum counts), or null where a plan
// builds (a cell of `rows` that isn't its open ground "."; without rows, any plan cell with a block on it, as
// check-edges has it) or a tree stands.
function groundOf(zone, x, y, rows = null) {
  if (rows ? rows[y]?.[x] !== undefined && rows[y][x] !== "." : zone.gen?.plan?.[x + y * zone.w] && zone.get(x, y, FLOOR_Z)) return null;
  let z = 0;
  while (z < zone.h && zone.get(x, y, z) && !GROUND_SKIP.has(zone.get(x, y, z))) z++;
  return GROUND_SKIP.has(zone.get(x, y, z)) ? null : z;
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-landmarks.mjs gives.
export async function run(env) {
  await env.screen();
  return checkLandmarks({ tiles: Number(env.args.tiles) || 500 });
}
