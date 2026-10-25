// Surface zones: one world span's ground, 80×48×16 (TECH_DESIGN §5.3, the P0 stub that WS2 grows).
//
//   worldFns(world, seed) → W           the world functions of one run, cached: everything a seam needs
//     W.heightAt(gx, gy) → int          ground height in blocks above the datum (stand = FLOOR_Z + height)
//     W.columnAt(gx, gy) → { height, cliff, water, ground }   the same with what made it
//     W.treeAt(cx, cy) → tree | null    the tree of 3×3-tile world cell (cx, cy): { gx, gy, base, trunk }
//     W.portsOf(wx, wy) → [port]        where roads and rivers cross the span's open edges
//   heightAt(world, seed, gx, gy), treeAt(world, seed, cx, cy), portsOf(world, seed, wx, wy)   the same, uncached
//   generateSurface(run, wx, wy) → Zone the span's surface zone (unsealed), validated, up to 10 attempts
//   validateSurface(zone) → string[]    the §5.3 item 9 rules the stub can break (empty: fine)
//   dungeonRectFor(entrance) → rect     where the dungeon's 48×48 levels sit under the surface (§5.5)
//   SURFACE_RULES                       the numbers
//
// World coordinates: column x of span wx is gx = wx·80 + x (row y of span wy: gy = wy·48 + y), so two
// zones that share an edge compute the same values for every column near it. A world function is a
// pure function of (run seed, gx, gy) and the fixed world: integer hashes, + − × ÷, floor and sqrt only
// (R6), so it gives the same bits in every engine. Retries re-roll only the zone's own features
// (river bends, fords, sinkholes), never a world function.
//
// The height (heightAt), in order:
//   relief  fbm noise of wavelength 16 tiles times 3 × the terrains' relief, blended bilinearly between
//           the four nearest span centres. Its slope stays under 1 block per tile, so rounding never
//           makes a 2-block step between 4-neighbours: the map (where heights are invisible) stays walkable.
//   cliffs  a separate mask raises small areas by 5 (≥ 4, so even across the relief the step at a cliff's
//           foot is 4 or more and the map draws it as a wall). No cliff within 10 tiles of a port or a
//           landmark's flattened ground.
//   rivers  a river comes in from its port straight for 8 tiles on both sides of the edge (the approach);
//           the ground within d tiles of that channel is at most d high, so its banks slope down to the
//           water, which sits at the datum on rock (it never drops you a level; every body floats on it).
//   flatten world.flatten (fixed landmark footprints): inside the rect and its 2-tile skirt the ground is
//           the landmark's datum; beyond it the height may differ from the datum by at most 1 block per
//           tile, so the natural ground comes back within the 4-tile falloff (3 blocks of relief, 3 tiles).
// Clamping with distances keeps every step at most 1 block, the property the slope rule needs.
//
// A zone then adds its own features, each 2 tiles or more from an open edge except where it meets a
// port: the road from each road port to the hub (the site's door, or the zone centre), carved so that
// no step on it is over 1; the river's bends between its approaches (or a lake for a single port) with
// a ford; trees from treeAt (a canopy that crosses an edge is built whole by both zones); the landmark's
// plan or the site; the dungeon entrance (a STAIRS block, zone.entrance) and, when a dungeon lies below,
// sinkholes inside zone.dungeonRect.
import { Zone, B, FLOOR_Z, SURFACE, standWith } from "../world.js";
import { makeRng, seedFor, hashInt, hashFloat, seededNoise, fbm, distance } from "../rng.js";
import { reachable, PLAYER_STEP_UP, PLAYER_DROP } from "../pathing.js";
import { SIDES, SIDE_STEP, FLATTEN_SKIRT } from "../world/worldmodel.js";
import { SITE_BUILDERS } from "../world/sites.js";
import { zoneSeed } from "../world/run.js";
import { stampVault } from "./vaults.js";

export const SURFACE_RULES = {
  reliefWave: 16,     // tiles: the relief noise's wavelength (§5.3: at least 12)
  maxRelief: 3,       // blocks: the relief's amplitude at relief 1 (§5.3: at most 3)
  cliffRise: 5,       // blocks a cliff raises its area by
  cliffWave: 9,       // tiles: the size of the cliff mask's blobs
  cliffArea: 0.12,    // how much of the mask rises at cliffs 1 (the threshold is 1 − cliffArea × cliffs)
  cliffClear: 10,     // tiles: no cliffs this close to a port or a landmark's flattened ground
  approach: 8,        // tiles: a river runs straight in from its port this far on both sides of an edge
  treeCell: 3,        // tiles: one tree candidate per 3×3-tile world cell
  treeClear: 3,       // tiles: no tree this close to a port's channel
  edgeKeep: 2,        // tiles: zone-local features keep this far from open edges (§5.1 e)
  maxStand: 12,       // standable ground at most 12 blocks above the datum (DECISIONS: heights)
  minNav: 0.9,        // at least 90% of the ground in one piece, under the map's step rules
  maxSteps: 4,        // unplanned 2-block steps allowed
  attempts: 10,
};
const R = SURFACE_RULES;
const ZW = SURFACE.w, ZD = SURFACE.d;

// --- World functions ----------------------------------------------------------------------------
const fnCache = new WeakMap();   // world → Map(seed → W), the last few seeds only

export function worldFns(world, seed) {
  let bySeed = fnCache.get(world);
  if (!bySeed) fnCache.set(world, (bySeed = new Map()));
  const hit = bySeed.get(seed >>> 0);
  if (hit) return hit;
  const W = makeWorldFns(world, seed >>> 0);
  if (bySeed.size >= 4) bySeed.delete(bySeed.keys().next().value);
  bySeed.set(seed >>> 0, W);
  return W;
}
export const heightAt = (world, seed, gx, gy) => makeWorldFns(world, seed >>> 0).heightAt(gx, gy);
export const treeAt = (world, seed, cx, cy) => makeWorldFns(world, seed >>> 0).treeAt(cx, cy);
export const portsOf = (world, seed, wx, wy) => makeWorldFns(world, seed >>> 0).portsOf(wx, wy);

const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const floorDiv = (a, b) => Math.floor(a / b);

function makeWorldFns(world, seed) {
  const { w: WW, h: WH } = world;
  const sRelief = seedFor(seed, "relief") | 0, sCliff = seedFor(seed, "cliffs") | 0;
  // Per-span terrain parameters (spans off the map take the nearest one's).
  const n = WW * WH, relief = new Float64Array(n), cliffs = new Float64Array(n), trees = new Float64Array(n);
  const ground = new Uint8Array(n);
  for (const t of world.tiles) {
    const T = world.terrains[t.terrain] || {}, i = t.wx + t.wy * WW;
    relief[i] = T.relief ?? 0.3; cliffs[i] = T.cliffs ?? 0; trees[i] = T.trees ?? 0;
    ground[i] = B[T.ground] ?? B.GRASS;
  }
  const spanIndex = (tx, ty) => clampInt(tx, 0, WW - 1) + clampInt(ty, 0, WH - 1) * WW;
  // Bilinear blend of a per-span value between the four nearest span centres.
  const blend = (arr, gx, gy) => {
    const u = (gx + 0.5) / ZW - 0.5, v = (gy + 0.5) / ZD - 0.5;
    const tx = Math.floor(u), ty = Math.floor(v), fx = u - tx, fy = v - ty;
    const a = arr[spanIndex(tx, ty)], b = arr[spanIndex(tx + 1, ty)], c = arr[spanIndex(tx, ty + 1)], d = arr[spanIndex(tx + 1, ty + 1)];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };

  // Ports: for each open edge with a road or river, where it crosses (§5.3 item 3). Both spans of an
  // edge compute it from the same canonical edgeId, so they agree.
  const portCache = new Map();
  function portsOf(wx, wy) {
    const key = `${wx},${wy}`;
    if (portCache.has(key)) return portCache.get(key);
    const out = [], t = world.tileAt(wx, wy);
    if (t)
      for (const side of SIDES) {
        if (!world.edgeOpen(wx, wy, side)) continue;
        const [dx, dy] = SIDE_STEP[side], o = world.tileAt(wx + dx, wy + dy);
        const opp = { n: "s", e: "w", s: "n", w: "e" }[side];
        const edgeId = world.edgeId(wx, wy, side), length = side === "n" || side === "s" ? ZW : ZD;
        let road = null;
        if (t.road[side] && o.road[opp]) {
          const width = clampInt(Math.max(t.roadWidth, o.roadWidth) || 2, 2, 3);
          road = { side, kind: "road", edgeId, width, along: 8 + (hashInt(seed, edgeId) % (length - 16)) };
          out.push(road);
        }
        if (t.river[side] && o.river[opp]) {
          const width = clampInt(Math.max(t.riverWidth, o.riverWidth) || 3, 3, 5);
          let along = 8 + (hashInt(seed, edgeId, "river") % (length - 16));
          // A road and a river on one edge cross it apart (the same on both sides: it reads only edge data).
          if (road && along + width + 2 > road.along && along < road.along + road.width + 2)
            along = 8 + ((along - 8 + road.width + width + 4) % (length - 16));
          out.push({ side, kind: "river", edgeId, width, along });
        }
      }
    portCache.set(key, out);
    return out;
  }
  // A port's channel (rivers) or approach (roads) in world coordinates: the port's tiles along the edge,
  // `approach` tiles deep into each of the two spans. { x0, y0, x1, y1 } inclusive.
  function channel(wx, wy, p) {
    const A = R.approach, ox = wx * ZW, oy = wy * ZD;
    if (p.side === "n" || p.side === "s") {
      const ey = p.side === "n" ? oy : oy + ZD;   // the first row of the span below the edge
      return { x0: ox + p.along, x1: ox + p.along + p.width - 1, y0: ey - A, y1: ey + A - 1 };
    }
    const ex = p.side === "w" ? ox : ox + ZW;
    return { x0: ex - A, x1: ex + A - 1, y0: oy + p.along, y1: oy + p.along + p.width - 1 };
  }
  const rectDist = (r, gx, gy) => distance(Math.max(0, r.x0 - gx, gx - r.x1), Math.max(0, r.y0 - gy, gy - r.y1));

  // The landmark footprints (world.flatten) near each span, in world coordinates with their skirt.
  const flatNear = new Map();
  function flattenNear(wx, wy) {
    const key = `${wx},${wy}`;
    if (flatNear.has(key)) return flatNear.get(key);
    const out = world.flatten.filter((f) => Math.abs(f.wx - wx) <= 1 && Math.abs(f.wy - wy) <= 1).map((f) => ({
      z: f.z, x0: f.wx * ZW + f.rect.x - FLATTEN_SKIRT, y0: f.wy * ZD + f.rect.y - FLATTEN_SKIRT,
      x1: f.wx * ZW + f.rect.x + f.rect.w - 1 + FLATTEN_SKIRT, y1: f.wy * ZD + f.rect.y + f.rect.d - 1 + FLATTEN_SKIRT,
    }));
    flatNear.set(key, out);
    return out;
  }

  function columnAt(gx, gy) {
    const wx = floorDiv(gx, ZW), wy = floorDiv(gy, ZD);
    let raw = R.maxRelief * blend(relief, gx, gy) * fbm(sRelief, gx / R.reliefWave, gy / R.reliefWave, 2);
    let near = Infinity, water = 0;
    const ports = portsOf(wx, wy);
    const chans = [];
    for (const p of ports) {
      const c = channel(wx, wy, p), d = rectDist(c, gx, gy);
      near = Math.min(near, d);
      if (p.kind === "river") chans.push([p, c, d]);
    }
    const flats = flattenNear(wx, wy);
    for (const f of flats) near = Math.min(near, rectDist(f, gx, gy));
    let cliff = 0;
    if (near >= R.cliffClear) {
      const c = blend(cliffs, gx, gy);
      if (c > 0 && seededNoise(sCliff, gx / R.cliffWave, gy / R.cliffWave) > 1 - R.cliffArea * c) cliff = R.cliffRise;
    }
    raw += cliff;
    for (const [p, c, d] of chans) {
      raw = Math.min(raw, d);
      if (d === 0) {   // in the channel: shallow at its two sides, deep between
        const across = p.side === "n" || p.side === "s" ? gx - c.x0 : gy - c.y0;
        water = across === 0 || across === p.width - 1 ? 1 : 2;
      }
    }
    for (const f of flats) {
      const d = rectDist(f, gx, gy);
      raw = Math.max(f.z - d, Math.min(f.z + d, raw));
    }
    const height = Math.max(0, Math.floor(raw + 0.5));
    return { height: water ? 0 : height, cliff: cliff > 0 && height >= R.cliffRise ? 1 : 0, water,
             ground: ground[spanIndex(wx, wy)], near };
  }

  // The tree of world cell (cx, cy), or null. The trunk sits somewhere in the cell's 3×3 tiles; the
  // canopy is the 3×3 around it, so it may reach one tile into the next zone (both zones build it).
  function treeAt(cx, cy) {
    const C = R.treeCell;
    const gx = cx * C + (hashInt(seed, "treeX", cx, cy) % C), gy = cy * C + (hashInt(seed, "treeY", cx, cy) % C);
    if (!(hashFloat(seed, "tree", cx, cy) < blend(trees, gx, gy))) return null;
    const col = columnAt(gx, gy);
    if (col.cliff || col.water || col.near < R.treeClear) return null;
    for (const f of flattenNear(floorDiv(gx, ZW), floorDiv(gy, ZD))) if (rectDist(f, gx, gy) < 2) return null;
    return { gx, gy, base: FLOOR_Z + col.height, trunk: 4 + (hashInt(seed, "treeH", cx, cy) % 2) };
  }

  return { seed, world, portsOf, channel, columnAt, heightAt: (gx, gy) => columnAt(gx, gy).height, treeAt };
}

// --- Where the dungeon sits ---------------------------------------------------------------------
// Levels are 48×48 and the surface 80×48: the levels sit centred under the entrance (§5.5).
export function dungeonRectFor(entrance) {
  return { ox: clampInt(entrance.x - 24, 0, ZW - 48), oy: 0, w: 48, d: 48 };
}

// --- Generating a surface zone ------------------------------------------------------------------
const NEXT4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// The sites on a span: its landmark site first, then the per-run ones.
function sitesOf(run, wx, wy) {
  return (run.sitesAt.get(`${wx},${wy}`) || []).map((id) => run.sites.get(id)).filter(Boolean)
    .sort((a, b) => (a.kind === "landmark" ? 0 : 1) - (b.kind === "landmark" ? 0 : 1));
}

export function generateSurface(run, wx, wy) {
  const world = run.world, tile = world.tileAt(wx, wy);
  if (!tile) return null;
  const W = worldFns(world, run.seed), seed = zoneSeed(run, wx, wy, 0);
  const base = worldLayer(W, wx, wy);
  let zone = null, problems = [];
  for (let attempt = 0; attempt < R.attempts; attempt++) {
    zone = buildSurface(run, W, base, wx, wy, seed, makeRng(seedFor(seed, "surface", attempt)));
    zone.attempts = attempt + 1;
    problems = validateSurface(zone);
    if (!problems.length) break;
  }
  zone.problems = problems;   // empty unless every attempt failed (check-landmarks reports it)
  return zone;
}

// The world-function layer of one zone: heights, cliffs, channel water, ground blocks, and every tree
// whose canopy touches the zone. The same for every attempt.
function worldLayer(W, wx, wy) {
  const n = ZW * ZD, H = new Int8Array(n), cliff = new Uint8Array(n), water = new Uint8Array(n), ground = new Uint8Array(n);
  const ox = wx * ZW, oy = wy * ZD;
  for (let y = 0; y < ZD; y++)
    for (let x = 0; x < ZW; x++) {
      const c = W.columnAt(ox + x, oy + y), i = x + y * ZW;
      H[i] = c.height; cliff[i] = c.cliff; water[i] = c.water; ground[i] = c.ground;
    }
  const trees = [], C = R.treeCell;
  for (let cy = floorDiv(oy - 1, C); cy <= floorDiv(oy + ZD, C); cy++)
    for (let cx = floorDiv(ox - 1, C); cx <= floorDiv(ox + ZW, C); cx++) {
      const t = W.treeAt(cx, cy);
      if (t && t.gx >= ox - 1 && t.gx <= ox + ZW && t.gy >= oy - 1 && t.gy <= oy + ZD) trees.push({ ...t, x: t.gx - ox, y: t.gy - oy });
    }
  return { H, cliff, water, ground, trees, ports: W.portsOf(wx, wy) };
}

function buildSurface(run, W, base, wx, wy, seed, rng) {
  const world = run.world, tile = world.tileAt(wx, wy), n = ZW * ZD;
  const sites = sitesOf(run, wx, wy), site = sites[0] || null;
  const L = tile.landmark ? world.landmarks.get(tile.landmark) : null;
  const terrain = world.terrains[tile.terrain] || {};
  const zone = new Zone({ key: `${wx},${wy},0`, wx, wy, z: 0, type: "surface", level: tile.level, tier: tile.tier, seed,
                          name: L?.name || site?.name || capital(terrain.name || tile.terrain) });
  zone.siteId = site?.id || null;
  zone.landmarkId = L?.id || null;
  zone.hasSky = true;
  zone.outdoor = true;
  for (const s of SIDES) zone.edges[s] = world.edgeOpen(wx, wy, s);
  const H = Int16Array.from(base.H), water = Uint8Array.from(base.water);
  const plan = new Uint8Array(n);       // columns a plan or site builder writes
  const planSolid = new Uint8Array(n);  // the plan's columns other than plain floor (roads go round them)
  const reserved = new Uint8Array(n);   // a footprint and its skirt: no trees, roads only to the hub, no sinkholes
  const road = new Uint8Array(n);
  const inner = (x, y) => x > 0 && y > 0 && x < ZW - 1 && y < ZD - 1;   // zone-local carving never touches an edge column
  const keep = (x, y) => x >= R.edgeKeep && y >= R.edgeKeep && x < ZW - R.edgeKeep && y < ZD - R.edgeKeep;

  // 1. The footprint: a landmark's is flat already (the world function); a per-run site's is flattened
  //    here with its skirt, the ground around it pulled down to it (1 block per tile).
  const planDef = L?.plan ? world.plans?.[L.plan] : null;
  let rect = site?.surface?.rect ? { ...site.surface.rect } : null;
  const wantsSite = !!site && (planDef || site.kind !== "landmark" || site.dungeon);
  if (wantsSite && !rect) rect = { x: ZW / 2 - 4, y: ZD / 2 - 3, w: 8, d: 6 };   // a landmark without a plan yet (C1)
  const worldFlat = !!(L && L.rect && L.flatten);   // the world function flattened it already
  if (rect) {
    const sk = FLATTEN_SKIRT;
    for (let y = 0; y < ZD; y++)
      for (let x = 0; x < ZW; x++) {
        const d = distance(Math.max(0, rect.x - sk - x, x - (rect.x + rect.w - 1 + sk)), Math.max(0, rect.y - sk - y, y - (rect.y + rect.d - 1 + sk)));
        if (d === 0) reserved[x + y * ZW] = 1;
        if (!worldFlat && inner(x, y) && H[x + y * ZW] > d) H[x + y * ZW] = Math.floor(d);
      }
  }
  // The plan's cells, so roads go round them.
  let planAt = null;
  if (planDef && rect) {
    const [ax, ay] = planDef.at || [Math.floor((rect.w - planDef.rows[0].length) / 2), Math.floor((rect.d - planDef.rows.length) / 2)];
    planAt = { x: rect.x + ax, y: rect.y + ay, w: planDef.rows[0].length, d: planDef.rows.length };
    for (let y = 0; y < planAt.d; y++)
      for (let x = 0; x < planAt.w; x++) {
        plan[planAt.x + x + (planAt.y + y) * ZW] = 1;
        if (planDef.rows[y][x] !== ".") planSolid[planAt.x + x + (planAt.y + y) * ZW] = 1;
      }
  }

  // 2. The hub the roads lead to: the plan's door, the site's middle, or the zone's centre.
  let hub;
  if (planAt && planDef.hub) hub = { x: planAt.x + planDef.hub[0], y: planAt.y + planDef.hub[1] };
  else if (rect) hub = { x: rect.x + (rect.w >> 1), y: rect.y + rect.d + 1 };
  else hub = { x: ZW >> 1, y: ZD >> 1 };
  hub.x = clampInt(hub.x, R.edgeKeep, ZW - 1 - R.edgeKeep); hub.y = clampInt(hub.y, R.edgeKeep, ZD - 1 - R.edgeKeep);

  // 3. Rivers: the bends between the approaches (or a lake), then banks that slope down to the water.
  const rivers = base.ports.filter((p) => p.kind === "river");
  const zoneWater = [];   // [x, y, deep] laid by the zone itself
  const fords = [];
  if (rivers.length) {
    const ends = rivers.map((p) => approachEnd(p));
    const r = Math.max(...rivers.map((p) => p.width)) >> 1;
    const noise = new Uint8Array(n);
    for (let i = 0; i < n; i++) noise[i] = rng.int(0, 12);
    const lay = (x, y, deep) => { if (inner(x, y) && !plan[x + y * ZW]) zoneWater.push([x, y, deep]); };
    const layDisc = (cx, cy, rad) => {
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) lay(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) < rad);
    };
    if (ends.length === 1) {   // one port: the river ends in a lake
      const e = ends[0], [ix, iy] = inward(rivers[0].side), rad = rng.int(2, 4);
      const cx = clampInt(e.x + ix * (rad + 1), rad + 4, ZW - rad - 5), cy = clampInt(e.y + iy * (rad + 1), rad + 4, ZD - rad - 5);
      for (const [x, y] of line(e.x, e.y, cx, cy)) layDisc(x, y, r);
      for (let dy = -rad; dy <= rad; dy++)
        for (let dx = -rad; dx <= rad; dx++) {
          const d = distance(dx, dy);
          if (d <= rad + 0.5) lay(cx + dx, cy + dy, d < rad - 0.5);
        }
    } else {
      const cost = (x, y) => (x < 5 || y < 5 || x >= ZW - 5 || y >= ZD - 5 || plan[x + y * ZW] || reserved[x + y * ZW] ? -1 : 10 + noise[x + y * ZW]);
      for (let k = 1; k < ends.length; k++) {
        const path = cheapestPath(ends[k], [ends[0]], cost);
        if (!path) continue;
        for (const [x, y] of path) layDisc(x, y, r);
        fords.push(path[rng.int(Math.floor(path.length / 3), Math.floor((2 * path.length) / 3))]);
      }
    }
    for (const [x, y, deep] of zoneWater) water[x + y * ZW] = Math.max(water[x + y * ZW], deep ? 2 : 1);
    for (const [fx, fy] of fords)
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inner(fx + dx, fy + dy) && water[fx + dx + (fy + dy) * ZW] === 2) water[fx + dx + (fy + dy) * ZW] = 1;
    // Banks: within d tiles of the zone's water the ground is at most d high.
    if (zoneWater.length)
      for (let y = 1; y < ZD - 1; y++)
        for (let x = 1; x < ZW - 1; x++) {
          const i = x + y * ZW;
          if (water[i]) { H[i] = 0; continue; }
          if (H[i] === 0) continue;
          let d = Infinity;
          for (const [qx, qy] of zoneWater) if (Math.abs(qx - x) <= H[i] && Math.abs(qy - y) <= H[i]) d = Math.min(d, distance(qx - x, qy - y));
          if (d < H[i]) H[i] = Math.floor(d);
        }
  }

  // 4. Roads: from each road port straight in for 3 tiles, then the cheapest way to the network (the hub
  //    first), carved so that no step along it is over 1 block (it may cut into a rise or bank up a dip).
  const roads = base.ports.filter((p) => p.kind === "road");
  if (roads.length) {
    const net = [hub.x + hub.y * ZW];
    const blocked = (x, y) => !keep(x, y) || (planSolid[x + y * ZW] && !(x === hub.x && y === hub.y));
    const cost = (x, y, fx, fy) => {
      if (blocked(x, y)) return -1;
      const i = x + y * ZW, dh = Math.abs(H[i] - H[fx + fy * ZW]);
      return 10 + (dh > 1 || base.cliff[i] ? 400 * dh : 5 * dh) + (water[i] ? 80 : 0);
    };
    for (const p of roads) {
      const [ix, iy] = inward(p.side), mid = portTile(p, p.width >> 1);
      const approach = [0, 1, 2].map((k) => [mid.x + ix * k, mid.y + iy * k]);
      const from = { x: approach[2][0] + ix, y: approach[2][1] + iy };
      const rest = cheapestPath(from, net.map((i) => ({ x: i % ZW, y: Math.floor(i / ZW) })), cost) || [];
      const path = [...approach, ...rest];
      carve(H, path);
      for (const [x, y] of path) {
        const i = x + y * ZW;
        road[i] = 1;
        net.push(i);
        if (water[i]) fordAt(water, x, y, 1);
      }
      // The road's width: the tiles beside it (the whole port at the edge, for the approach).
      for (let k = 0; k < p.width; k++) for (let s = 0; s < 3; s++) { const t = portTile(p, k); road[t.x + ix * s + (t.y + iy * s) * ZW] = 1; }
      path.forEach(([x, y], k) => {
        const [nx, ny] = path[Math.min(k + 1, path.length - 1)], [px, py] = path[Math.max(k - 1, 0)];
        const dx = Math.sign(nx - px), dy = Math.sign(ny - py);
        for (let s = 1; s < p.width; s++) {
          const sx = x + (s === 1 ? -dy : dy), sy = y + (s === 1 ? dx : -dx), j = sx + sy * ZW;
          if (keep(sx, sy) && !plan[j] && !water[j] && Math.abs(H[j] - H[x + y * ZW]) <= 1) road[j] = 1;
        }
      });
    }
  }

  // 5. The ground, column by column (a plan writes its own columns later).
  for (let y = 0; y < ZD; y++)
    for (let x = 0; x < ZW; x++) {
      const i = x + y * ZW;
      if (water[i]) {
        for (let z = 0; z < FLOOR_Z - 1; z++) zone.set(x, y, z, B.ROCK);
        zone.set(x, y, FLOOR_Z - 1, water[i] === 2 ? B.WATER_DEEP : B.WATER_SHALLOW);
        continue;
      }
      const top = FLOOR_Z - 1 + H[i];
      for (let z = 0; z < top; z++) zone.set(x, y, z, B.ROCK);
      zone.set(x, y, top, road[i] ? B.ROAD : base.ground[i]);
    }

  // 6. Trees. A tree whose canopy stays inside the zone gives way to the zone's own things; one that
  //    crosses an edge never does (the world function keeps those clear of ports), so both zones have it.
  const scenery = new Uint8Array(n);   // columns whose standing spot is on scenery (a tree, a wall's top)
  for (const t of base.trees) {
    const ti = t.x + t.y * ZW, inside = t.x >= 1 && t.y >= 1 && t.x < ZW - 1 && t.y < ZD - 1;
    if (inside && (road[ti] || water[ti] || reserved[ti] || plan[ti] || (t.x === hub.x && t.y === hub.y))) continue;
    buildTree(zone, inside ? { ...t, base: FLOOR_Z + H[ti] } : t, scenery);   // (banks may have lowered an inner one's ground)
  }

  // 7. The landmark's plan, or the site (its builder, else the stub: an entrance if a dungeon lies below).
  const keyPoints = [];
  let spawn = null, entranceGated = false;
  if (planDef && planAt) {
    const prng = planDef.rng ? planDef.rng(run.seed) : makeRng(seedFor(seed, "plan"));
    let out;
    if (planDef.stamp) out = planDef.stamp(zone, planAt.x, planAt.y, prng, { roof: planDef.roof || "none" });
    else out = stampPlan(zone, planDef, planAt.x, planAt.y, prng);
    spawn = out.spawn || null;
    keyPoints.push(...out.keyPoints);
    entranceGated = !!planDef.entranceGated;
  } else if (site && wantsSite) {
    const ctx = { run, zone, rng, rect, hub, H, plan, reserved };
    if (site.kind !== "landmark" && SITE_BUILDERS[site.kind]) SITE_BUILDERS[site.kind](ctx, site);
    else stubSite(ctx, site);
  }
  if (zone.stairs) { zone.entrance = { ...zone.stairs }; if (!entranceGated) keyPoints.push({ ...zone.stairs }); }
  // Plan walls and roofs are scenery: the map draws them as walls, and nobody walks on them.
  if (planAt) {
    zone.refresh();
    for (let y = planAt.y; y < planAt.y + planAt.d; y++)
      for (let x = planAt.x; x < planAt.x + planAt.w; x++) { const i = x + y * ZW; if (zone.stand[i] > FLOOR_Z + 1) scenery[i] = 1; }
  }

  // 8. The dungeon below: where its levels sit, and sinkholes into it.
  if (site?.dungeon) {
    zone.hasBelow = true;
    const at = planDef?.dungeonAt;
    zone.dungeonRect = at && rect ? { ox: rect.x + at[0], oy: rect.y + at[1], w: 48, d: 48 }
      : dungeonRectFor(zone.entrance || hub);
    if (planDef?.sinkholes !== false) {
      const r = zone.dungeonRect, want = rng.int(1, 3);
      for (let k = 0, made = 0; k < 60 && made < want; k++) {
        const x = rng.int(Math.max(r.ox, R.edgeKeep + 1), Math.min(r.ox + r.w, ZW - R.edgeKeep - 1) - 1);
        const y = rng.int(Math.max(r.oy, R.edgeKeep + 1), Math.min(r.oy + r.d, ZD - R.edgeKeep - 1) - 1);
        const i = x + y * ZW;
        if (plan[i] || reserved[i] || road[i] || water[i] || scenery[i] || base.cliff[i] || zone.get(x, y, FLOOR_Z - 1 + H[i] + 1)) continue;
        const e = zone.entrance || hub;
        if (distance(x - e.x, y - e.y) < 5 || NEXT4.some(([dx, dy]) => water[x + dx + (y + dy) * ZW])) continue;
        for (let z = 0; z < zone.h; z++) zone.set(x, y, z, B.AIR);
        made++;
      }
    }
  }

  // 9. The anchor: the plan's own, else the reachable ground nearest the hub that reaches the most.
  zone.refresh();
  zone.spawn = spawn || pickAnchor(zone, hub, scenery);
  zone.gen = { ports: base.ports.map((p) => ({ ...p, tiles: Array.from({ length: p.width }, (_, k) => portTile(p, k)) })),
               keyPoints, scenery, cliff: base.cliff, worldWater: base.water, plan, hub, entranceGated };
  return zone;
}

const capital = (s) => String(s).replace(/^the /, "").replace(/^./, (c) => c.toUpperCase());
const inward = (side) => ({ n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] })[side];
// The k-th tile of a port, on the zone's edge.
function portTile(p, k) {
  if (p.side === "n") return { x: p.along + k, y: 0 };
  if (p.side === "s") return { x: p.along + k, y: ZD - 1 };
  if (p.side === "w") return { x: 0, y: p.along + k };
  return { x: ZW - 1, y: p.along + k };
}
// The innermost tile of a river's approach, in the middle of the channel.
function approachEnd(p) {
  const t = portTile(p, p.width >> 1), [ix, iy] = inward(p.side), k = R.approach - 1;
  return { x: t.x + ix * k, y: t.y + iy * k };
}
// The tiles of a straight-ish line, 4-connected.
function line(x0, y0, x1, y1) {
  const out = [[x0, y0]];
  let x = x0, y = y0;
  while (x !== x1 || y !== y1) {
    if (Math.abs(x1 - x) >= Math.abs(y1 - y)) x += Math.sign(x1 - x); else y += Math.sign(y1 - y);
    out.push([x, y]);
  }
  return out;
}
function fordAt(water, x, y, r) {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const i = x + dx + (y + dy) * ZW;
      if (x + dx > 0 && y + dy > 0 && x + dx < ZW - 1 && y + dy < ZD - 1 && water[i] === 2) water[i] = 1;
    }
}

// Dijkstra over the zone's tiles (4 directions) from `from` to the nearest of `targets`. cost(x, y, fromX,
// fromY) → step cost, or −1 for impassable (the targets themselves are always enterable). Ties break by
// tile index, so the same inputs always give the same path. Returns [[x, y], …] from `from`, or null.
function cheapestPath(from, targets, cost) {
  const n = ZW * ZD, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  const goal = new Uint8Array(n);
  for (const t of targets) goal[t.x + t.y * ZW] = 1;
  const heap = [];   // [d, i]
  const push = (d, i) => {
    heap.push([d, i]);
    for (let k = heap.length - 1; k > 0; ) {
      const p = (k - 1) >> 1;
      if (heap[p][0] < d || (heap[p][0] === d && heap[p][1] < i)) break;
      [heap[p], heap[k]] = [heap[k], heap[p]]; k = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ; ) {
        const a = 2 * k + 1, b = a + 1;
        let m = k;
        const less = (x, y) => heap[x][0] < heap[y][0] || (heap[x][0] === heap[y][0] && heap[x][1] < heap[y][1]);
        if (a < heap.length && less(a, m)) m = a;
        if (b < heap.length && less(b, m)) m = b;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
      }
    }
    return top;
  };
  const s = from.x + from.y * ZW;
  if (from.x < 0 || from.y < 0 || from.x >= ZW || from.y >= ZD) return null;
  dist[s] = 0; push(0, s);
  while (heap.length) {
    const [d, i] = pop();
    if (d > dist[i]) continue;
    const x = i % ZW, y = (i - x) / ZW;
    if (goal[i]) {
      const path = [];
      for (let k = i; k !== -1; k = prev[k]) path.push([k % ZW, Math.floor(k / ZW)]);
      return path.reverse();
    }
    for (const [dx, dy] of NEXT4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= ZW || ny >= ZD) continue;
      const j = nx + ny * ZW;
      const c = goal[j] ? 1 : cost(nx, ny, x, y);
      if (c < 0) continue;
      if (d + c < dist[j]) { dist[j] = d + c; prev[j] = i; push(d + c, j); }
    }
  }
  return null;
}

// Heights along a road so that no step is over 1 block, its first tile (the port, a world height) and
// its last (where it joins the network) kept: forward smoothing, then clamped into the band both ends allow.
function carve(H, path) {
  const m = path.length - 1;
  if (m < 1) return;
  const h = path.map(([x, y]) => H[x + y * ZW]);
  const s = [h[0]];
  for (let k = 1; k <= m; k++) s.push(Math.max(s[k - 1] - 1, Math.min(s[k - 1] + 1, h[k])));
  const a = h[0], b = h[m];
  if (Math.abs(a - b) > m) return;   // can't happen on these sizes: keep the ground as it is
  path.forEach(([x, y], k) => {
    const lo = Math.max(a - k, b - (m - k)), hi = Math.min(a + k, b + (m - k));
    H[x + y * ZW] = Math.max(lo, Math.min(hi, s[k]));
  });
}

// A tree: a trunk of 4-5 blocks and a 3×3 canopy on top, one block higher in the middle.
function buildTree(zone, t, scenery) {
  const { x, y, base, trunk } = t;
  const put = (px, py, z, b) => { if (px >= 0 && py >= 0 && px < zone.w && py < zone.d && z < zone.h && !zone.get(px, py, z)) zone.set(px, py, z, b); };
  const top = base + trunk;   // the first layer above the trunk
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) { put(x + dx, y + dy, top - 1, B.LEAVES); put(x + dx, y + dy, top, B.LEAVES); }
  put(x, y, top + 1, B.LEAVES);
  if (x >= 0 && y >= 0 && x < zone.w && y < zone.d) {
    for (let z = base; z < top - 1; z++) zone.set(x, y, z, B.TRUNK);
    zone.set(x, y, top - 1, B.TRUNK);
    scenery[x + y * zone.w] = 1;
  }
}

// A plan without its own stamp function: stampVault with the plan's roof and wall height. Returns
// { spawn, keyPoints } (its key letters' first cells, and its spawn letter's cell if it has one).
function stampPlan(zone, plan, ox, oy, rng) {
  const rows = plan.rows;
  stampVault(zone, { name: plan.name || plan.id, plan: rows, height: plan.height ?? 4, wall: plan.wall ?? B.STONE,
                     floorBlock: plan.floorBlock ?? B.TILE, links: plan.links || [], legend: plan.legend },
             ox, oy, rng, { roof: plan.roof || "none", wallHeight: plan.wallHeight });
  const find = (ch) => {
    for (let y = 0; y < rows.length; y++) { const x = rows[y].indexOf(ch); if (x >= 0) return { x: ox + x, y: oy + y }; }
    return null;
  };
  const keyPoints = (plan.keys || []).map(find).filter(Boolean);
  const s = plan.spawn ? find(plan.spawn) : null;
  return { spawn: s ? { x: s.x + 0.5, y: s.y + 0.5, z: FLOOR_Z, yaw: 0 } : null, keyPoints };
}

// A site no builder has claimed yet (P0): its footprint stays flat, and if a dungeon lies below, its
// entrance is a STAIRS block in the middle, with a ring of stones round it.
function stubSite({ zone, rect }, site) {
  if (!site.dungeon || !rect) return;
  const cx = rect.x + (rect.w >> 1), cy = rect.y + (rect.d >> 1);
  for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) zone.set(cx + dx, cy + dy, FLOOR_Z, B.STONE);
  zone.set(cx, cy, FLOOR_Z - 1, B.STAIRS);
  zone.stairs = { x: cx, y: cy };
}

// The anchor: of the ground columns nearest the hub, the one from which the most ground is reachable.
function pickAnchor(zone, hub, scenery) {
  const { w, d, stand } = zone, open = standWith(zone, "open");
  const ok = (i) => stand[i] >= 0 && stand[i] <= FLOOR_Z + R.maxRelief && !scenery[i] && !isStairs(zone, i);
  const order = [];
  for (let i = 0; i < w * d; i++) if (ok(i)) order.push([distance((i % w) - hub.x, Math.floor(i / w) - hub.y), i]);
  order.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let best = order[0]?.[1] ?? hub.x + hub.y * w, bestN = -1;
  const tried = [];
  for (const [, i] of order) {
    if (tried.length >= 6) break;
    if (tried.some((dist) => dist[i] >= 0)) continue;   // already inside a piece we measured
    const dist = reachable(open, w, d, i % w, Math.floor(i / w), PLAYER_STEP_UP, PLAYER_DROP);
    tried.push(dist);
    let cnt = 0;
    for (let k = 0; k < w * d; k++) if (dist[k] >= 0) cnt++;
    if (cnt > bestN) { bestN = cnt; best = i; }
    if (cnt > 0.6 * w * d) break;
  }
  const x = best % w, y = Math.floor(best / w);
  return { x: x + 0.5, y: y + 0.5, z: Math.max(0, stand[best]), yaw: 0 };
}
const isStairs = (zone, i) => { const g = zone.blocks[i + (FLOOR_Z - 1) * zone.w * zone.d]; return g === B.STAIRS || g === B.STAIRS_UP; };

// --- Validation (§5.3 item 9, the rules the stub can break) ----------------------------------------
// Needs zone.gen (what generation knew); a zone without it is checked for holes and heights only.
export function validateSurface(zone) {
  const problems = [], { w, d } = zone, g = zone.gen;
  if (!zone.hasDerived) zone.refresh();
  const stand = zone.stand, open = standWith(zone, "open");
  const ax = Math.floor(zone.spawn.x), ay = Math.floor(zone.spawn.y);
  const dist = reachable(open, w, d, ax, ay, PLAYER_STEP_UP, PLAYER_DROP);
  const scenery = g?.scenery || new Uint8Array(w * d);
  const ground = (i) => stand[i] >= 0 && !scenery[i];
  const reach = (x, y) => x >= 0 && y >= 0 && x < w && y < d && dist[x + y * w] >= 0;
  if (stand[ax + ay * w] < 0) problems.push("the anchor is not on standable ground");

  // Holes only over a dungeon, inside its rect; no standable ground above 12.
  const r = zone.dungeonRect;
  let total = 0, reached = 0;
  for (let i = 0; i < w * d; i++) {
    const x = i % w, y = (i - x) / w;
    if (!zone.get(x, y, 0) && !zone.get(x, y, FLOOR_Z - 1)) {
      if (!zone.hasBelow || !r || x < r.ox || y < r.oy || x >= r.ox + r.w || y >= r.oy + r.d) { problems.push(`a hole at (${x}, ${y}) outside the dungeon's rect`); break; }
    }
    if (!ground(i)) continue;
    if (stand[i] > FLOOR_Z + R.maxStand) problems.push(`standable ground at (${x}, ${y}) is ${stand[i] - FLOOR_Z} blocks up`);
    total++;
    if (dist[i] >= 0) reached++;
  }
  const nav = total ? reached / total : 0;
  zone.navigability = nav;
  if (nav < R.minNav) problems.push(`navigability ${(100 * nav).toFixed(1)}% (want ${100 * R.minNav}%)`);
  if (!g) return problems;

  // Open edges: at least half of each one's border (leaving out the world function's water and cliffs)
  // is ground you can walk to.
  for (const side of SIDES) {
    if (!zone.edges[side]) continue;
    let can = 0, ok = 0;
    const len = side === "n" || side === "s" ? w : d;
    for (let k = 0; k < len; k++) {
      const x = side === "w" ? 0 : side === "e" ? w - 1 : k, y = side === "n" ? 0 : side === "s" ? d - 1 : k, i = x + y * w;
      if (g.worldWater[i] || g.cliff[i] || g.plan[i]) continue;
      can++;
      if (reach(x, y)) ok++;
    }
    if (can && ok * 2 < can) problems.push(`the ${side} edge: ${ok} of ${can} border tiles reachable`);
  }
  // Ports: a road port's tiles, or a river's banks (the tiles beside its channel), can be walked to.
  for (const p of g.ports) {
    const tiles = p.kind === "road" ? p.tiles : [-1, p.width].map((k) => portTile(p, k));
    if (!tiles.some((t) => reach(t.x, t.y))) problems.push(`the ${p.kind} port on the ${p.side} edge is unreachable`);
  }
  for (const k of g.keyPoints) if (!reach(k.x, k.y)) problems.push(`key point (${k.x}, ${k.y}) is unreachable`);
  // Stairs on dry ground.
  const e = zone.entrance;
  if (e)
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const x = e.x + ox, y = e.y + oy, top = stand[x + y * w] - 1;
        const b = top >= 0 ? zone.get(x, y, top) : 0;
        if (b === B.WATER_SHALLOW || b === B.WATER_DEEP || (stand[x + y * w] < 0 && !zone.get(x, y, FLOOR_Z))) problems.push("the entrance is in or next to water or a drop");
      }
  // Unplanned 2-block steps (a cliff's foot and a plan's walls are planned).
  let steps = 0;
  for (let y = 0; y < d; y++)
    for (let x = 0; x < w; x++) {
      const i = x + y * w;
      if (!ground(i) || g.cliff[i] || g.plan[i]) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const j = x + dx + (y + dy) * w;
        if (x + dx >= w || y + dy >= d || !ground(j) || g.cliff[j] || g.plan[j]) continue;
        if (Math.abs(stand[i] - stand[j]) >= 2) steps++;
      }
    }
  zone.unplannedSteps = steps;
  if (steps > R.maxSteps) problems.push(`${steps} unplanned steps of 2 blocks or more (at most ${R.maxSteps})`);
  return problems;
}
