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
import { buildRun } from "../../src/world/run.js";
import { TEST_WORLD } from "../../src/content/world/test-world.js";
import { generateSurface, validateSurface, dungeonRectFor, SURFACE_RULES } from "../../src/gen/surface.js";
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
      if (planDef?.rows && !planDef.stamp && pa) {
        let notWall = 0;
        planDef.rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === "#" && z.kind[pa.x + x + (pa.y + y) * z.w] !== KIND.WALL) notWall++; }));
        expect(notWall === 0, `${at}: ${notWall} of the plan's wall cells are not walls on the map`);
      }
      if (L.id === "temple") {
        expect(z.npcs.some((n) => n.type === "maren"), `${at}: no Maren`);
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

  // Navigability on random spans.
  const navs = [], ms = [];
  let failed = 0, attempts = 0;
  const per = Math.ceil(tiles / seeds.length);
  for (const seed of seeds) {
    const run = buildRun(seed, TEST_WORLD), rng = makeRng(seed ^ 0x5a5a);
    const open = run.world.tiles.filter((t) => t.edges === "open" || t.landmark);
    for (let k = 0; k < per && navs.length < tiles; k++) {
      const t = open[Math.floor(rng() * open.length)];
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
  stats.spans = navs.length;
  stats.failed = failed;
  stats.navigability = { min: +(100 * navs[0]).toFixed(1), p5: +(100 * pct(navs, 0.05)).toFixed(1),
                         mean: +((100 * navs.reduce((s, v) => s + v, 0)) / navs.length).toFixed(1) };
  stats.attempts = { total: attempts, extra: attempts - navs.length };
  stats.ms = { p50: +pct(ms, 0.5).toFixed(1), p95: +pct(ms, 0.95).toFixed(1), max: +ms[ms.length - 1].toFixed(1) };
  return { name: "landmarks", ok: problems.length === 0, problems, stats, notes };
}
