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
// 5. The other 15 landmarks (C1b, bible §5, §15.3), on every seed: each on its plan at its anchor (Halfnight's West Ward;
//    its Middle and East Wards on theirs in a world where each ward is a span of its own, as the spanPlans request will
//    make them), the same twice (section 3), every open seam on the world function wherever the plan leaves the ground
//    as it was, every person's place a key point (reachable on the map) but the Tall Table's top, which a 3D walk
//    reaches; its dungeon's floors at the bible's levels with their names, gimmicks (each landmark's the union of its
//    §15.3 keys' in GIMMICK_KEYS), cradles and bottom; its holy place a faction; and what its own plan promises (below,
//    PROMISES). The 3D walk (reach3d): steps up of one block, drops, and jumps across up to 2 open tiles walking or 4
//    sprinting at the same height or lower, orthogonally; ghost planks underfoot or not.
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
import { reachable, PLAYER_STEP_UP, PLAYER_DROP } from "../../src/pathing.js";
import { standWith } from "../../src/world.js";
import { BLOCKS } from "../../src/blocks.js";
import { GIMMICKS } from "../../src/gen/dungeon.js";
import { FACTIONS } from "../../src/content/factions.js";
import { LANDMARK_INDEX, GIMMICK_KEYS } from "../../src/content/world/worldmap.js";   // C1b
import { TOP as TABLE_TOP } from "../../src/content/world/plans/tallTable.js";
import { RINGS } from "../../src/content/world/plans/foldmother.js";
import { PRESSYARD_HOUSES } from "../../src/content/world/plans/pressyard.js";
import { TOLL_GATE } from "../../src/content/world/plans/molar.js";

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
  // C1b: the other 15 (section 5).
  Object.assign(stats, checkC1b(seeds, expect));

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

// --- C1b: the other 15 landmarks (section 5 of the header) -----------------------------------------------------------
const SIDES4 = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const at4 = (side, k, w, d) => (side === "n" ? [k, 0] : side === "s" ? [k, d - 1] : side === "w" ? [0, k] : [w - 1, k]);
// The world with Halfnight's other wards as spans of their own (landmarks.js spanPlans: what the integration request
// will make of them), so their plans can be checked before the code stamps them.
export function wardsWorld(def = REAL_WORLD) {
  const H = def.landmarks.find((l) => l.id === "halfnight");
  return { ...def, landmarks: [...def.landmarks.map((l) => (l.id === "halfnight" ? { ...l, spans: [l.at] } : l)),
    ...Object.entries(H.spanPlans).map(([k, plan]) => { const s = k.split(",").map(Number); return { ...H, id: plan, at: s, spans: [s], plan, spanPlans: undefined }; })] };
}
// Standing heights in one column: every z with something solid under it and two of air above (ghost planks solid or not).
function levelsAt(zone, x, y, ghosts) {
  const solid = (z) => { const b = zone.get(x, y, z); return b && !(b === B.GHOST && !ghosts) && b !== B.WATER_DEEP; };
  const out = [];
  for (let z = 1; z < zone.h - 1; z++) if (solid(z - 1) && !solid(z) && !solid(z + 1)) out.push(z);
  return out;
}
// The 3D walk (header, section 5) from the anchor: → Set of "x,y,z" stood on.
export function reach3d(zone, { sprint = true, ghosts = true } = {}) {
  const { w, d } = zone, lv = new Map(), open = (x, y, z0, z1) => { for (let z = z0; z <= z1; z++) { const b = zone.get(x, y, z); if (b && !(b === B.GHOST && !ghosts)) return false; } return true; };
  const L = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= d) return []; const k = x + y * w; if (!lv.has(k)) lv.set(k, levelsAt(zone, x, y, ghosts)); return lv.get(k); };
  const sx = Math.floor(zone.spawn.x), sy = Math.floor(zone.spawn.y), s0 = L(sx, sy)[0];
  const seen = new Set([`${sx},${sy},${s0}`]), queue = [[sx, sy, s0]], gap = sprint ? 4 : 2;
  while (queue.length) {
    const [x, y, z] = queue.pop();
    for (const [dx, dy] of Object.values(SIDES4)) {
      const add = (nx, ny, nz) => { const k = `${nx},${ny},${nz}`; if (!seen.has(k)) { seen.add(k); queue.push([nx, ny, nz]); } };
      for (const z2 of L(x + dx, y + dy)) {
        if (z2 === z + 1 && open(x, y, z + 2, z + 2) && open(x + dx, y + dy, z2, z2 + 1)) add(x + dx, y + dy, z2);   // a jump up a block
        else if (z2 <= z && z - z2 <= PLAYER_DROP && open(x + dx, y + dy, z2, z + 1)) add(x + dx, y + dy, z2);       // a step, or a drop
      }
      // A jump across k open tiles, landing as high or lower: nothing to stand on in between at or above the landing.
      for (let k = 1; k <= gap; k++) {
        const mx = x + dx * k, my = y + dy * k;
        if (mx < 0 || my < 0 || mx >= w || my >= d || !open(mx, my, z, z + 1)) break;
        const tx = mx + dx, ty = my + dy;
        for (const z2 of L(tx, ty)) if (z2 <= z && z - z2 <= 3 && open(tx, ty, z2, z + 1) && !L(mx, my).some((m) => m >= z2)) add(tx, ty, z2);
      }
    }
  }
  return seen;
}
const mapReach = (z) => {
  const open = standWith(z, "open");
  for (let i = 0; i < z.w * z.d; i++) if (z.kind[i] === KIND.WALL) open[i] = -1;
  return reachable(open, z.w, z.d, Math.floor(z.spawn.x), Math.floor(z.spawn.y), PLAYER_STEP_UP, PLAYER_DROP);
};
// The bible's own figures, never the plans': the Gnomon's foot (§4.11, §4.12: 14 blocks) and the floors §5 names.
const NEEDLE = 14;
const BIBLE_FLOORS = { press: { 5: /Press-hall/ }, dialWorks: { 8: /Noon Socket/ }, underPage: { 2: /Speaking Door/ }, unlitChoir: { 4: /Warden/, 6: /Noon/ } };
// What each plan promises beyond the rest (bible §5); c = { z, pa, cell(ch) → zone cells, plan, run, L, dungeon }.
const solidUp = (z, x, y, from, to) => { for (let k = from; k < to; k++) if (!z.get(x, y, k)) return false; return true; };
const anyIn = (z, x0, y0, x1, y1, test) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (test(x, y)) return true; return false; };
const noLamp = (z, x0, y0, x1, y1) => !anyIn(z, x0, y0, x1, y1, (x, y) => { for (let k = 0; k < z.h; k++) if (z.get(x, y, k) === B.LAMP) return true; return false; });
const road = (z, x, y) => z.stand[x + y * z.w] > 0 && z.get(x, y, z.stand[x + y * z.w] - 1) === B.ROAD;
const PROMISES = {
  dialFloor: ({ z, cell }) => {
    const m = Object.fromEntries((z.murals || []).map((u) => [u.view, u]));
    return [
      [m.map && BLOCKS[z.get(m.map.x, m.map.y, m.map.z)]?.mosaic, "the Flat Account isn't on a mosaic tile"],
      [m["3d"] && z.get(m["3d"].x, m["3d"].y, m["3d"].z) === B.MURAL, "the Deep Inscription isn't on a carved panel"],
      [m.dark && z.get(m.dark.x, m.dark.y, m.dark.z) === B.RUNE, "the Dark Gloss isn't on a rune"],
      [cell("a").every(([x, y]) => z.get(x, y, FLOOR_Z - 1) === B.MOSAIC_GOLD) && cell("w").length === 5 && cell("w").every(([x, y]) => z.get(x, y, FLOOR_Z - 1) === B.MOSAIC_WHITE),
        "the arrow isn't gold or the pips aren't five white tiles"],
      [cell("P").every(([x, y]) => solidUp(z, x, y, FLOOR_Z, FLOOR_Z + 4)), "the pin isn't 4 high"]];
  },
  kettleMesa: ({ z, cell, reach }) => [
    [cell("#").every(([x, y]) => z.stand[x + y * z.w] === FLOOR_Z + 10 && z.kind[x + y * z.w] === KIND.WALL), "the mesa's wall isn't 10 high and a wall on the map"],
    [cell(",").every(([x, y]) => reach[x + y * z.w] >= 0), "the hollow isn't all walked to through the spout"]],
  benchmark: ({ z, cell, pa }) => [
    [cell("Q").every(([x, y]) => solidUp(z, x, y, FLOOR_Z, FLOOR_Z + 9)) && cell("T").length === 24 && cell("T").every(([x, y]) => z.get(x, y, FLOOR_Z + 8) === B.GLASS),
      "the pillar isn't 9 high or the six towers lack their lenses"],
    [z.cradle && z.get(z.cradle.x, z.cradle.y, FLOOR_Z) === B.STATION && z.get(z.cradle.x, z.cradle.y, FLOOR_Z + 1) === B.STATION, "no Truing Cradle #1"],
    [(z.murals || []).some((u) => u.view === "3d" && z.get(u.x, u.y, u.z) === B.MURAL), "the Mark has no carving"],
    [anyIn(z, pa.x + 2, pa.y + 17, pa.x + 2, pa.y + 20, (x, y) => road(z, x, y)) && anyIn(z, pa.x + 61, pa.y + 17, pa.x + 61, pa.y + 20, (x, y) => road(z, x, y)),
      "the Old Rule doesn't come in at the west gate and leave by the east"]],
  tallTable: ({ z, cell }) => {
    const top = [...cell("K"), ...cell("T"), ...cell("O")], full = reach3d(z), walk = reach3d(z, { sprint: false }), dark = reach3d(z, { ghosts: false });
    const on = (r) => top.every(([x, y]) => r.has(`${x},${y},${FLOOR_Z + TABLE_TOP}`));
    const nests = z.perches?.length === 4 && z.perches.every((p) => z.props.some((q) => Math.floor(q.x) === p.x && Math.floor(q.y) === p.y && q.z === p.z && q.kind === "nest") && p.z >= FLOOR_Z + 3 && p.z <= FLOOR_Z + 5);
    return [[cell("M").every(([x, y]) => z.stand[x + y * z.w] === FLOOR_Z + TABLE_TOP && z.kind[x + y * z.w] === KIND.WALL), "the mesa's top isn't 12 up, or the map doesn't draw it as one wall"],
      [on(full), "the climb doesn't reach the top people in 3D"], [!on(walk), "the top is reached without a sprinting jump"],
      [!on(dark), "the top is reached without the ghost planks"], [nests, "the perches (3-5 up) don't hold their nests"]];
  },
  molar: ({ z, cell, reach, pa }) => [
    [cell("R").every(([x, y]) => z.stand[x + y * z.w] === FLOOR_Z + 12 && z.kind[x + y * z.w] === KIND.WALL), "the crag isn't 12 high"],
    [cell("H").every(([x, y]) => z.get(x, y, FLOOR_Z + 4) === B.ROCK), "a hall has no rock over it"], [cell("H").every(([x, y]) => reach[x + y * z.w] >= 0), "a hall can't be walked to"],
    [anyIn(z, pa.x, pa.y + 17, pa.x + 1, pa.y + 21, (x, y) => road(z, x, y)) && anyIn(z, pa.x + 62, pa.y + 17, pa.x + 63, pa.y + 21, (x, y) => road(z, x, y)),
      "the Old Rule doesn't run through the gullet's two mouths"],
    [z.get(pa.x + 63, pa.y + 26, FLOOR_Z - 1) === B.METAL && reach[pa.x + 63 + (pa.y + 26) * z.w] >= 0, "the Root Canals' far mouth east of the checkpoint"],
    [[17, 18, 19, 20, 21].every((y) => z.get(pa.x + TOLL_GATE, pa.y + y, FLOOR_Z + 4) === B.STONE && z.stand[pa.x + TOLL_GATE + (pa.y + y) * z.w] === FLOOR_Z), "the toll gate's arch over the gullet, the way under it open"]],
  folio: ({ z, pa, plan, cell }) => {
    let walls = 0, mosaic = 0;
    plan.rows.forEach((r, y) => [...r].forEach((ch, x) => { const k = z.kind[pa.x + x + (pa.y + y) * z.w]; if (k === KIND.WALL && ch !== "A") walls++; if (k === KIND.MOSAIC) mosaic++; }));
    return [[walls === 0, `${walls} walls on the map that aren't the archive (Folio's walls are drawn)`], [mosaic > 400, `only ${mosaic} mosaic tiles`],
      [cell("A").every(([x, y]) => z.kind[x + y * z.w] === KIND.WALL) && cell("d").every(([x, y]) => z.get(x, y, FLOOR_Z - 1) === B.MOSAIC_GOLD), "the archive or its drawn door"]];
  },
  halfnightWest: (c) => [...ward(c), [c.cell("B").length === 9 && c.z.get(c.pa.x + 34, c.pa.y + 37, FLOOR_Z + 11) === B.METAL, "the Noon Bell's tower"],
    [(c.z.murals || []).some((u) => u.view === "3d" && u.text === "LAMPS STAY LIT. THE HOURS ARE WATCHING."), "the Hour-house's sign"]],
  halfnightMiddle: (c) => ward(c),
  halfnightEast: (c) => [...ward(c), [c.cell("k").every(([x, y]) => c.z.get(x, y, FLOOR_Z) === B.GHOST), "the ghost market's stalls aren't ghost planks"],
    [(c.z.murals || []).some((u) => u.view === "dark" && c.z.get(u.x, u.y, u.z) === B.RUNE), "the Hush's rune"]],
  pressyard: ({ z, cell, plan }) => [
    [cell("w").length === 300 && cell("w").every(([x, y]) => z.get(x, y, FLOOR_Z - 1) === B.MOSAIC_WHITE), `${cell("w").length} figures, not 300`],
    [PRESSYARD_HOUSES.length === 41 && ["r", "b", "g"].reduce((n, ch) => n + cell(ch).length, 0) === 41 * 9, "not 41 houses of 3 × 3"],
    [z.entrance && plan.rows[z.entrance.y - z.gen.planAt.y][z.entrance.x - z.gen.planAt.x] === ">" && cell("u").length > 0, "the stair isn't in the well"]],
  unlitChoir: ({ z, pa, plan, cell }) => [
    [noLamp(z, pa.x, pa.y, pa.x + plan.rows[0].length - 1, pa.y + plan.rows.length - 1), "a lamp in the Unlit Choir (Lamps 0)"],
    [cell("f").length === 8 && cell("f").every(([x, y]) => z.get(x, y, FLOOR_Z) === B.BRAZIER), "the nave's eight cold braziers"],
    [cell("P").every(([x, y]) => solidUp(z, x, y, FLOOR_Z, FLOOR_Z + 14)), "the spires aren't 14 high"],
    [(z.murals || []).some((u) => u.view === "dark" && z.get(u.x, u.y, u.z) === B.RUNE), "the rune circle's gloss"]],
  metronome: ({ z, cell, pa }) => [
    [anyIn(z, pa.x, pa.y + 17, pa.x + 1, pa.y + 21, (x, y) => road(z, x, y)), "the Old Rule's spur doesn't come in at the yard's gate"],
    [cell("T").every(([x, y]) => solidUp(z, x, y, FLOOR_Z, FLOOR_Z + 14)), "the tower isn't 14 high"],
    [cell("O").every(([x, y]) => !z.get(x, y, FLOOR_Z) && solidUp(z, x, y, FLOOR_Z + 1, FLOOR_Z + 6)), "the pendulum's bob and rod"]],
  drownedLantern: ({ z, cell, pa }) => [
    [cell("#").every(([x, y]) => solidUp(z, x, y, FLOOR_Z, FLOOR_Z + 14) && z.get(x, y, FLOOR_Z + 12) === B.GLASS), "the lighthouse isn't 14 high with its glass"],
    [cell("~").every(([x, y]) => z.get(x, y, FLOOR_Z - 1) === B.WATER_DEEP), "the sea round the island isn't deep"],
    [anyIn(z, pa.x + 39, pa.y, pa.x + 41, pa.y + 13, (x, y) => road(z, x, y)), "the causeway doesn't come onto the island"]],
  square: ({ z, cell, plan, pa }) => {
    const C = cell("C"), xs = C.map(([x]) => x), ys = C.map(([, y]) => y), [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const face = C.filter(([x, y]) => x === x0 || x === x1 || y === y0 || y === y1);
    return [[plan.rows.length === plan.rows[0].length, "the clearing isn't square"], [x1 - x0 === 15 && y1 - y0 === 15 && C.every(([x, y]) => solidUp(z, x, y, FLOOR_Z, FLOOR_Z + 12)), "the cube isn't 16 × 16 × 12"],
      [face.length === 58 && cell("D").every(([x, y]) => z.get(x, y, FLOOR_Z) === B.DOOR), "the cube has a window, or its gate isn't a door"],
      [cell("s").every(([x, y]) => z.get(x, y, FLOOR_Z) === B.TRUNK), "the stumps"], [holesOf(z).length === 0, "a sinkhole into the cells, past the gate"],
      [anyIn(z, pa.x + 16, pa.y + 28, pa.x + 27, pa.y + 34, (x, y) => road(z, x, y)), "the Straight Cut doesn't reach the forecourt"]];
  },
  gnomon: ({ z }) => {
    const cx = z.w >> 1, cy = z.d >> 1;
    return [[solidUp(z, cx, cy, FLOOR_Z, FLOOR_Z + NEEDLE) && z.get(cx, cy, FLOOR_Z + NEEDLE - 1) === B.SHALE, "the needle's foot isn't 14 high at the span's middle"],
      [z.stand[cx + 2 + cy * z.w] === FLOOR_Z + 1 && z.stand[cx + 1 + cy * z.w] === FLOOR_Z + 3, "the plinth (1) and the base (3)"],
      [z.entrance && z.entrance.x === cx && z.entrance.y > cy + 2, "the door isn't south of the plinth"],
      [holesOf(z).length === 0, "a sinkhole into the Dial-works, past its door"]];
  },
  saltpage: ({ z, cell }) => [
    [["w", "r", "g", "u"].reduce((n, ch) => n + cell(ch).length, 0) === 27 * 27 && ["w", "r", "g", "u"].every((ch) => cell(ch).every(([x, y]) => BLOCKS[z.get(x, y, FLOOR_Z - 1)]?.mosaic)), "the Page isn't 27 × 27 of mosaic"],
    [cell("#").every(([x, y]) => z.get(x, y, FLOOR_Z + 3) === B.SALT && !z.get(x, y, FLOOR_Z + 5)), "the monastery isn't one storey of salt"]],
  foldmother: ({ z, cell }) => {
    const r = reach3d(z, { sprint: false }), P = cell("P");
    return [[cell("T").every(([x, y]) => solidUp(z, x, y, FLOOR_Z, FLOOR_Z + 12)), "the trunk"],
      [P.every(([x, y]) => RINGS.every((h) => z.get(x, y, FLOOR_Z + h - 1) === B.PLANK)), "the platforms at 3, 6, 9 and 12"],
      [RINGS.every((h) => P.some(([x, y]) => r.has(`${x},${y},${FLOOR_Z + h}`))), "a ring the root-steps don't reach in 3D (walking)"]];
  },
};
// Every ward: the Line in brass, the road on the street, no lamp in the north row (the Lampless quarter).
function ward({ z, pa, plan, cell }) {
  const [s0, s1] = plan.street;
  return [[cell("=").every(([x, y]) => z.get(x, y, FLOOR_Z - 1) === B.METAL), "the Line isn't brass"],
    [anyIn(z, pa.x, pa.y + s0, pa.x + 67, pa.y + s1, (x, y) => road(z, x, y)) && !cell(",").some(([x, y]) => road(z, x, y)), "the road doesn't keep to the street"],
    [noLamp(z, pa.x, pa.y, pa.x + 67, pa.y + s0 - 1), "a lamp in the Lampless quarter"]];
}

function checkC1b(seeds, expect) {
  const ids = LANDMARK_INDEX.map((l) => l.id).filter((id) => id !== "hollowmere");
  const tally = { zones: 0, seams: 0, seamTiles: 0, keys: 0, floors: 0, promises: 0, climbs: 0 };
  for (const seed of seeds) {
    const runs = { real: buildRun(seed, REAL_WORLD), wards: buildRun(seed, wardsWorld()) }, cache = new Map();
    const surface = (run, wx, wy) => { const k = `${run === runs.real ? "r" : "w"}${wx},${wy}`; if (!cache.has(k)) cache.set(k, generateSurface(run, wx, wy)); return cache.get(k); };
    const targets = [...ids.map((id) => ({ run: runs.real, id, plan: runs.real.world.landmarks.get(id).plan })),
      { run: runs.wards, id: "halfnightMiddle", plan: "halfnightMiddle" }, { run: runs.wards, id: "halfnightEast", plan: "halfnightEast" }];
    for (const t of targets) {
      const W = t.run.world, L = W.landmarks.get(t.id), plan = W.plans[t.plan], at = `real world seed ${seed} ${t.id}`;
      const z = surface(t.run, L.wx, L.wy), pa = z.gen?.planAt, def = REAL_WORLD.landmarks.find((l) => l.id === (t.id.startsWith("halfnight") ? "halfnight" : t.id));
      tally.zones++;
      for (const p of z.problems) expect(false, `${at}: ${p}`);
      expect(pa && pa.x === def.anchor[0] && pa.y === def.anchor[1] && pa.w === plan.rows[0].length && pa.d === plan.rows.length, `${at}: not on its plan at its anchor (${JSON.stringify(pa)})`);
      if (!pa) continue;
      if (t.run === runs.wards) expect(sameZone(z, generateSurface(t.run, L.wx, L.wy)), `${at}: two generations differ`);
      const cell = (ch) => plan.rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === ch ? [[pa.x + x, pa.y + y]] : [])));
      // Seams: the ground on both sides of every open edge is the world function's where the plan leaves it as it was.
      const Wf = worldFns(W, t.run.seed), built = (x, y) => x >= pa.x && y >= pa.y && x < pa.x + pa.w && y < pa.y + pa.d && plan.rows[y - pa.y][x - pa.x] !== ".";
      for (const [side, [dx, dy]] of Object.entries(SIDES4)) {
        if (!W.edgeOpen(L.wx, L.wy, side)) continue;
        const nb = surface(t.run, L.wx + dx, L.wy + dy), len = side === "n" || side === "s" ? z.w : z.d;
        tally.seams++;
        for (let k = 0; k < len; k++) {
          const [ax, ay] = at4(side, k, z.w, z.d), [bx, by] = at4({ n: "s", s: "n", e: "w", w: "e" }[side], k, nb.w, nb.d);
          const ga = built(ax, ay) ? null : groundOf(z, ax, ay), gb = groundOf(nb, bx, by);
          const fa = FLOOR_Z + Wf.heightAt(L.wx * z.w + ax, L.wy * z.d + ay), fb = FLOOR_Z + Wf.heightAt((L.wx + dx) * nb.w + bx, (L.wy + dy) * nb.d + by);
          tally.seamTiles++;
          if (ga !== null && ga !== fa) expect(false, `${at}: its ${side} edge at ${k} stands ${ga}, the world function ${fa}`);
          if (gb !== null && gb !== fb) expect(false, `${at}: the ${side} neighbour's edge at ${k} stands ${gb}, the world function ${fb}`);
          const cliff = Wf.columnAt(L.wx * z.w + ax, L.wy * z.d + ay).cliff || Wf.columnAt((L.wx + dx) * nb.w + bx, (L.wy + dy) * nb.d + by).cliff;   // (check-edges' rule c)
          if (ga !== null && gb !== null && Math.abs(ga - gb) > 1 && !cliff) expect(false, `${at}: a ${Math.abs(ga - gb)}-block step across its ${side} edge at ${k}`);
        }
      }
      // Its people: each place a key point (the Tall Table's top excepted: its promise walks there in 3D).
      for (const ch of Object.keys(def.letters || {})) {
        const places = cell(ch);
        if (t.id === "halfnight" || t.id.startsWith("halfnight")) { if (!places.length) continue; }   // (each ward holds some of the city's people)
        else expect(places.length > 0, `${at}: nobody stands on letter ${ch} (${def.letters[ch].name})`);
        if (t.id === "tallTable") continue;
        for (const [x, y] of places) { tally.keys++; expect(z.gen.keyPoints.some((k) => k.x === x && k.y === y), `${at}: ${def.letters[ch].name}'s place isn't a key point`); }
      }
      // What its plan promises.
      const reach = mapReach(z);
      for (const [ok, what] of PROMISES[t.plan]({ z, pa, plan, cell, run: t.run, L, reach })) { tally.promises++; expect(ok, `${at}: ${what}`); }
      if (t.id === "tallTable" || t.id === "foldmother") tally.climbs++;
      // Its dial-steles: a carving where each stands, with its carved hour (the Horary pray there within the hour).
      for (const st of plan.steles || []) { tally.promises++; expect(z.get(pa.x + st.at[0], pa.y + st.at[1], FLOOR_Z + (st.z ?? 1)) === B.MURAL && st.hour >= 0 && st.hour < 24, `${at}: its dial-stele at ${st.at}`); }
      // Its dungeon: the bible's levels, its names, gimmicks (its keys' union), cradles and bottom.
      const site = siteWithDungeon(t.run, L.wx, L.wy), want = LANDMARK_INDEX.find((l) => l.id === t.id)?.dungeon;
      if (!want || t.run === runs.wards) { expect(!site || t.run === runs.wards, `${at}: a dungeon it shouldn't have`); continue; }
      expect(site && JSON.stringify(site.dungeon.floorLevels) === JSON.stringify(want.floors), `${at}: its dungeon's levels ${JSON.stringify(site?.dungeon.floorLevels)}`);
      if (!site) continue;
      const keys = LANDMARK_INDEX.find((l) => l.id === t.id).gimmicks, union = new Set(keys.flatMap((k) => GIMMICK_KEYS[k]?.gimmicks || []));
      expect(keys.every((k) => GIMMICK_KEYS[k]), `${at}: a gimmick key (${keys}) GIMMICK_KEYS doesn't map`);
      const used = new Set();
      for (let lz = 1; lz <= site.dungeon.levels; lz++) {
        const p = dungeonParams(t.run, site, lz);
        tally.floors++;
        p.gimmicks.forEach((g) => used.add(g));
        const named = BIBLE_FLOORS[want.id]?.[lz];
        expect(!named || named.test(p.name), `${at} floor ${lz}: "${p.name}", where the bible names it ${named}`);
        expect(p.level === want.floors[lz - 1] && p.name === want.named?.[lz - 1] && p.gimmicks.every((g) => GIMMICKS[g]) && p.cradle === !!want.cradle?.includes(lz),
          `${at} floor ${lz}: level ${p.level}, name "${p.name}", gimmicks ${p.gimmicks}, cradle ${p.cradle}`);
        if (lz === site.dungeon.levels && want.bottom) {
          const f = generateDungeonLevel(zoneSeed(t.run, L.wx, L.wy, lz), p);
          expect(p.bottom?.kind === want.bottom.kind && (want.bottom.kind !== "guardian" || f.creatures.some((c) => c.guardian === want.bottom.id)), `${at}: its bottom ${JSON.stringify(p.bottom)}`);
        }
      }
      const cast = new Set(want.cast || []);   // (gimmicks that place its inhabitants, beyond its keys: Kettle Mesa's first flatlings)
      expect([...union].every((g) => used.has(g)) && [...used].every((g) => union.has(g) || cast.has(g)), `${at}: its floors play ${[...used]}, its keys (${keys}) map onto ${[...union]}${cast.size ? `, its cast ${[...cast]}` : ""}`);
    }
  }
  // Holy places (C2 #5): each names a faction.
  const holy = REAL_WORLD.landmarks.flatMap((l) => [...(l.holy ? (typeof l.holy === "string" ? [[l.id, l.holy]] : Object.entries(l.holy).map(([k, f]) => [`${l.id} ${k}`, f])) : []),
    ...Object.entries(l.holyFloors || {}).map(([k, f]) => [`${l.id} floor ${k}`, f])]);
  for (const [where, f] of holy) expect(FACTIONS[f], `${where}: holy to ${f}, which is no faction`);
  return {
    c1b: `${ids.length} landmarks and Halfnight's 2 other wards on ${seeds.length} seeds: ${tally.zones} zones on their plans; ${tally.seams} seams (${tally.seamTiles} tiles) on the world function; ` +
      `${tally.keys} people's places reachable; ${tally.promises} promises held, ${tally.climbs} climbs walked in 3D; ${tally.floors} dungeon floors at the bible's levels with their names, gimmicks and cradles`,
    holy: holy.map(([w, f]) => `${w}: ${f}`).join(", "),
  };
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-landmarks.mjs gives.
export async function run(env) {
  await env.screen();
  return checkLandmarks({ tiles: Number(env.args.tiles) || 500 });
}
