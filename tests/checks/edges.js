// Zone edges (TECH_DESIGN §5.1, §6.1, the 0A2 gate): the seam rules (a)-(e) on every open edge of every
// landmark span of the test world, plus 200 random pairs of neighbouring spans, on 3 seeds; the apron
// beside each seam; and arrival over each checked edge in both directions.
//
//   checkEdges({ seeds = [1, 42, 1234], pairs = 200, real = true }) → { name, ok, problems, stats, notes }
//
// An edge joins zone A (west or north) and B (east or south): A's last column (or row) and B's first are
// neighbouring world columns. For every tile along it, with W the run's world functions:
//   (a) both zones' ground equals the world function there (W.heightAt), so the step across the seam is
//       the function's own step. "Ground" is the top of the terrain column: trees and a plan's walls are
//       left out (a landmark's flattened footprint is part of the world function).
//   (b) every road and river port (W.portsOf) is the same from both sides (edge id, along, width), and
//       both zones lay it there: road blocks on a road port's tiles, the same water on a river's.
//   (c) no step across the seam is over PLAYER_STEP_UP unless the world function marks a cliff there.
//   (d) a tree whose canopy crosses the edge (W.treeAt) is there, whole, in both zones.
//   (e) within 2 tiles of the open edge each zone shows only the world function (its ground, water and
//       trees; road blocks only on a road's straight approach; no hole), and per-run sites keep SITE_MARGIN
//       (6) tiles from the zone's edges. Landmark plans may touch an edge (their ground is the function's).
// The apron: B's band toward A built from the world functions (A not in memory) has the same ground as
// a copy of A in the 2 tiles next to the seam, and the copy equals A's blocks.
// Arrival: from every border tile of A you can stand on (ground, reachable from A's anchor), walking off
// lands in B within ±1 of your height and not shifted (zones.js arrivalPoint "edge"); and back from B.
// The share of arrivals on the mirrored tile itself is reported. With real = true, the real world's
// landmark spans are checked too (seed 42, rules (a)-(d) and arrival; its plans are still placeholders).
import { buildRun } from "../../src/world/run.js";
import { TEST_WORLD } from "../../src/content/world/test-world.js";
import { REAL_WORLD } from "../../src/content/world/worldmap.js";
import { generateSurface, worldFns, buildApronBand, SURFACE_RULES } from "../../src/gen/surface.js";
import { arrivalPoint } from "../../src/zones.js";
import { SIDES, SIDE_STEP, OPPOSITE, SITE_MARGIN } from "../../src/world/worldmodel.js";
import { B, FLOOR_Z } from "../../src/world.js";
import { PLAYER_STEP_UP } from "../../src/pathing.js";
import { makeRng } from "../../src/rng.js";

const SCENERY = new Set([B.LEAVES, B.TRUNK]);
// The top of the terrain column: the first z that is air or scenery (water at the datum counts as ground).
function groundTop(zone, x, y) {
  let z = 0;
  while (z < zone.h && zone.get(x, y, z) && !SCENERY.has(zone.get(x, y, z))) z++;
  return z;
}
// A plan's wall (or roof) stands on this column: its "ground" isn't the terrain's.
const planWall = (zone, x, y) => !!zone.gen?.plan[x + y * zone.w] && !!zone.get(x, y, FLOOR_Z);

export function checkEdges({ seeds = [1, 42, 1234], pairs = 200, real = true } = {}) {
  const problems = [], notes = [], stats = {};
  const tally = { edges: 0, tiles: 0, crossings: 0, mirrored: 0, shifted: 0, trees: 0, ports: 0, apronTiles: 0, zones: 0 };
  const t0 = performance.now();
  for (const seed of seeds) checkWorld(TEST_WORLD, seed, { pairs, landmarks: true, near: true }, problems, tally);
  if (real) checkWorld(REAL_WORLD, 42, { pairs: 0, landmarks: true, near: false }, problems, tally);
  stats.edges = `${tally.edges} edges (${tally.tiles} seam tiles) over ${tally.zones} zones; ${tally.ports} ports, ${tally.trees} trees across an edge`;
  stats.apron = `${tally.apronTiles} apron tiles next to a seam compared`;
  stats.arrivals = `${tally.crossings} crossings, ${tally.shifted} shifted, ${(100 * tally.mirrored / Math.max(1, tally.crossings)).toFixed(1)}% on the mirrored tile`;
  stats.seconds = ((performance.now() - t0) / 1000).toFixed(1);
  return { name: "edges", ok: problems.length === 0, problems, stats, notes };
}

function checkWorld(def, seed, { pairs, landmarks, near }, problems, tally) {
  const run = buildRun(seed, def), world = run.world, W = worldFns(world, run.seed);
  const zones = new Map();
  const zoneAt = (wx, wy) => {
    const key = `${wx},${wy}`;
    if (!zones.has(key)) {
      const z = generateSurface(run, wx, wy);
      if (z) { z.refresh(); tally.zones++; }
      zones.set(key, z);
    }
    return zones.get(key);
  };
  // Canonical edges: (wx, wy, "e" | "s"), joining (wx, wy) to its east or south neighbour.
  const edges = new Map();
  const add = (wx, wy, side) => {
    if (!world.edgeOpen(wx, wy, side)) return;
    const [dx, dy] = SIDE_STEP[side];
    const e = side === "e" || side === "s" ? [wx, wy, side] : [wx + dx, wy + dy, OPPOSITE[side]];
    edges.set(e.join(","), e);
  };
  if (landmarks) for (const L of world.landmarks.values()) for (const s of SIDES) add(L.wx, L.wy, s);
  if (pairs) {
    const all = [];
    for (const t of world.tiles) for (const s of ["e", "s"]) if (world.edgeOpen(t.wx, t.wy, s)) all.push([t.wx, t.wy, s]);
    const rng = makeRng(seed ^ 0xed9e);
    for (let k = 0, got = 0; got < pairs && k < pairs * 20; k++) {
      const e = all[rng.int(0, all.length - 1)], id = e.join(",");
      if (!edges.has(id)) { edges.set(id, e); got++; }
    }
  }
  for (const [wx, wy, side] of edges.values()) {
    const [dx, dy] = SIDE_STEP[side];
    const A = zoneAt(wx, wy), Bz = zoneAt(wx + dx, wy + dy);
    const at = `${world.id} seed ${seed} edge ${wx},${wy},${side}`;
    if (!A || !Bz) { problems.push(`${at}: a zone is missing on an open edge`); continue; }
    checkSeam(run, W, A, Bz, side, at, near, problems, tally);
  }
  // Per-run sites keep SITE_MARGIN from every zone edge (only landmarks may touch one).
  if (near)
    for (const s of run.sites.values()) {
      const r = s.surface?.rect;
      if (s.kind === "landmark" || !r) continue;
      if (r.x < SITE_MARGIN || r.y < SITE_MARGIN || r.x + r.w > 80 - SITE_MARGIN || r.y + r.d > 48 - SITE_MARGIN)
        problems.push(`${world.id} seed ${seed}: site ${s.id} at (${s.at.wx}, ${s.at.wy}) is within ${SITE_MARGIN} tiles of an edge`);
    }
}

function checkSeam(run, W, A, Bz, side, at, near, problems, tally) {
  tally.edges++;
  const east = side === "e", len = east ? A.d : A.w;
  // Tile k of the seam at depth `depth` into a zone (0 = its border column), in that zone's coordinates.
  const tileA = (k, depth = 0) => (east ? [A.w - 1 - depth, k] : [k, A.d - 1 - depth]);
  const tileB = (k, depth = 0) => (east ? [depth, k] : [k, depth]);
  const gxy = (zone, x, y) => [zone.wx * zone.w + x, zone.wy * zone.d + y];
  const fails = [];
  const fail = (rule, msg) => { if (fails.length < 4) fails.push(`(${rule}) ${msg}`); };

  // (b) Ports, as both sides see them, and laid by both zones.
  const portsA = W.portsOf(A.wx, A.wy).filter((p) => p.side === side);
  const portsB = W.portsOf(Bz.wx, Bz.wy).filter((p) => p.side === OPPOSITE[side]);
  const sig = (list) => list.map((p) => `${p.kind}:${p.edgeId}:${p.along}:${p.width}`).sort().join(" ");
  if (sig(portsA) !== sig(portsB)) fail("b", `ports differ: ${sig(portsA)} | ${sig(portsB)}`);
  const approach = new Set();   // seam positions k on a road port (their tiles may be carved, ±1)
  for (const p of portsA) {
    tally.ports++;
    for (let k = p.along; k < p.along + p.width; k++) {
      const [ax, ay] = tileA(k), [bx, by] = tileB(k);
      const topA = A.get(ax, ay, groundTop(A, ax, ay) - 1), topB = Bz.get(bx, by, groundTop(Bz, bx, by) - 1);
      if (p.kind === "road") {
        approach.add(k);
        if (topA !== B.ROAD || topB !== B.ROAD) fail("b", `road port tile ${k}: blocks ${topA} | ${topB}, not road`);
      } else if (topA !== topB || (topA !== B.WATER_DEEP && topA !== B.WATER_SHALLOW)) fail("b", `river port tile ${k}: blocks ${topA} | ${topB}`);
    }
  }

  // (a), (c) along the seam; (e) 2 tiles deep into both zones.
  for (let k = 0; k < len; k++) {
    tally.tiles++;
    for (const [zone, tile] of [[A, tileA], [Bz, tileB]])
      for (let depth = 0; depth < (near ? SURFACE_RULES.edgeKeep : 1); depth++) {
        const [x, y] = tile(k, depth);
        if (planWall(zone, x, y)) continue;
        const [gx, gy] = gxy(zone, x, y), c = W.columnAt(gx, gy), top = groundTop(zone, x, y);
        const rule = depth === 0 ? "a" : "e";
        const onRoad = zone.gen?.ports.some((p) => p.kind === "road" && p.tiles.some((t) => Math.abs(t.x - x) + Math.abs(t.y - y) <= 2 &&
          (p.side === "e" || p.side === "w" ? t.y === y : t.x === x)));
        if (top === 0) { fail("e", `${zone.key} (${x}, ${y}): a hole by the edge`); continue; }
        if (top - FLOOR_Z !== c.height && !(onRoad && Math.abs(top - FLOOR_Z - c.height) <= 1))
          fail(rule, `${zone.key} (${x}, ${y}): ground ${top - FLOOR_Z}, the world function says ${c.height}`);
        const block = zone.get(x, y, top - 1);
        const want = c.water ? (c.water === 2 ? B.WATER_DEEP : B.WATER_SHALLOW) : c.ground;
        if (block !== want && !(onRoad && block === B.ROAD) && !(c.water && block === B.WATER_SHALLOW))   // (a road's ford)
          if (!zone.gen?.plan[x + y * zone.w]) fail("e", `${zone.key} (${x}, ${y}): block ${block} where the world has ${want}`);
      }
    const [ax, ay] = tileA(k), [bx, by] = tileB(k);
    if (planWall(A, ax, ay) || planWall(Bz, bx, by)) continue;
    const step = Math.abs(groundTop(A, ax, ay) - groundTop(Bz, bx, by));
    const cliff = W.columnAt(...gxy(A, ax, ay)).cliff || W.columnAt(...gxy(Bz, bx, by)).cliff;
    if (step > PLAYER_STEP_UP && !cliff) fail("c", `seam tile ${k}: a step of ${step} with no cliff`);
  }

  // (d) Trees whose canopy crosses the edge: whole in both zones.
  const C = SURFACE_RULES.treeCell;
  const [g0x, g0y] = gxy(Bz, 0, 0);   // the first world column (or row) of B
  const cells = [];
  if (east) for (let cy = Math.floor((g0y - 1) / C); cy <= Math.floor((g0y + len) / C); cy++) for (let cx = Math.floor((g0x - 2) / C); cx <= Math.floor((g0x + 1) / C); cx++) cells.push([cx, cy]);
  else for (let cx = Math.floor((g0x - 1) / C); cx <= Math.floor((g0x + len) / C); cx++) for (let cy = Math.floor((g0y - 2) / C); cy <= Math.floor((g0y + 1) / C); cy++) cells.push([cx, cy]);
  for (const [cx, cy] of cells) {
    const t = W.treeAt(cx, cy);
    if (!t) continue;
    const crosses = east ? t.gx - 1 <= g0x - 1 && t.gx + 1 >= g0x : t.gy - 1 <= g0y - 1 && t.gy + 1 >= g0y;
    const along = east ? t.gy - g0y : t.gx - g0x;
    if (!crosses || along < -1 || along > len) continue;
    tally.trees++;
    const top = t.base + t.trunk;
    for (const zone of [A, Bz]) {
      const lx = (gx) => gx - zone.wx * zone.w, ly = (gy) => gy - zone.wy * zone.d;
      const inZone = (x, y) => x >= 0 && y >= 0 && x < zone.w && y < zone.d;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const x = lx(t.gx + ox), y = ly(t.gy + oy);
          if (!inZone(x, y)) continue;
          for (const z of ox || oy ? [top - 1, top] : [top - 1, top, top + 1])
            if (!SCENERY.has(zone.get(x, y, z))) fail("d", `${zone.key}: the tree at world (${t.gx}, ${t.gy}) lacks (${x}, ${y}, ${z})`);
        }
      const x = lx(t.gx), y = ly(t.gy);
      if (inZone(x, y)) for (let z = t.base; z < top; z++) if (zone.get(x, y, z) !== B.TRUNK) { fail("d", `${zone.key}: the tree at world (${t.gx}, ${t.gy}) has no trunk at z ${z}`); break; }
    }
  }

  // The apron: B's band toward A from the world functions vs a copy of A, in the 2 tiles next to the seam.
  const bandSide = east ? "w" : "n";
  const fromWorld = buildApronBand(run, Bz, bandSide, null), copy = buildApronBand(run, Bz, bandSide, A);
  const bandTop = (band, x, y) => {
    let z = 0;
    const at = (zz) => band.blocks[x - band.x0 + (y - band.y0) * band.bw + zz * band.bw * band.bd];
    while (z < Bz.h && at(z) && !SCENERY.has(at(z))) z++;
    return z;
  };
  for (let k = 0; k < len; k++)
    for (let depth = 0; depth < 2; depth++) {
      const x = east ? -1 - depth : k, y = east ? k : -1 - depth;
      const [ax, ay] = tileA(k, depth);
      if (bandTop(copy, x, y) !== groundTop(A, ax, ay)) { fail("apron", `the copy of ${A.key} differs at (${ax}, ${ay})`); continue; }
      tally.apronTiles++;
      if (planWall(A, ax, ay) || approach.has(k)) continue;
      if (bandTop(fromWorld, x, y) !== bandTop(copy, x, y)) fail("apron", `${Bz.key}'s band from the world functions has ground ${bandTop(fromWorld, x, y) - FLOOR_Z} at (${x}, ${y}), ${A.key} has ${bandTop(copy, x, y) - FLOOR_Z}`);
    }

  // Arrival, both ways.
  for (const [from, to, fromTile, toTile, leave] of [[A, Bz, tileA, tileB, side], [Bz, A, tileB, tileA, OPPOSITE[side]]]) {
    const reach = reachOf(from);
    for (let k = 0; k < len; k++) {
      const [x, y] = fromTile(k), i = x + y * from.w, s = from.stand[i];
      if (s < 0 || reach[i] < 0 || from.gen?.scenery[i]) continue;
      const arr = arrivalPoint(to, "edge", { side: leave, along: k, fromStand: s });
      tally.crossings++;
      const [mx, my] = toTile(k);
      if (Math.floor(arr.x) === mx && Math.floor(arr.y) === my) tally.mirrored++;
      if (arr.shifted) { tally.shifted++; fail("arrival", `${from.key} → ${to.key} at ${k}: shifted to (${Math.floor(arr.x)}, ${Math.floor(arr.y)})`); }
      else if (Math.abs(arr.z - s) > 1) fail("arrival", `${from.key} → ${to.key} at ${k}: height ${arr.z} from ${s}`);
    }
  }
  for (const f of fails) problems.push(`${at}: ${f}`);
}

// What's reachable from a zone's anchor, as arrivalPoint sees it (its cache, filled by one call).
function reachOf(zone) {
  arrivalPoint(zone, "edge", { side: "e", along: 0, fromStand: FLOOR_Z });
  return zone.reach.dist;
}
