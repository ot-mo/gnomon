// The world functions (TECH_DESIGN §5.1, §5.3; owner WS2): everything a seam needs, as pure functions of the
// run seed, the world column (gx, gy) and the fixed world.
//
//   worldFns(world, seed) → W           the world functions of one run, cached (the last few seeds)
//     W.heightAt(gx, gy) → int          ground height in blocks above the datum (stand = FLOOR_Z + height)
//     W.columnAt(gx, gy) → { height, cliff, tier, water, ground, sub, near }   the same with what made it
//     W.treeAt(cx, cy) → tree | null    the tree of 3×3-tile world cell (cx, cy): { gx, gy, base, trunk }
//     W.portsOf(wx, wy) → [port]        where roads and rivers cross the span's open edges (gen/ports.js)
//     W.channel(wx, wy, port) → rect    a port's straight approach in world coordinates
//     W.liquidOf(wx, wy) → liquid id    what the span's surface water holds: its river's, else its biome's
//   heightAt(world, seed, gx, gy), treeAt(world, seed, cx, cy)   the same, uncached
//   forgetWorldFns(world)               drop the cached ones (gen/surface.js forgetWorld)
//   SURFACE_RULES                       the numbers (gen/surface.js re-exports them)
//
// World coordinates: column x of span wx is gx = wx·80 + x (row y of span wy: gy = wy·48 + y), so two
// zones that share an edge compute the same values for every column near it. A world function is a
// pure function of (run seed, gx, gy) and the fixed world: integer hashes, + − × ÷, floor and sqrt only
// (R6), so it gives the same bits in every engine. Retries re-roll only a zone's own features
// (river bends, fords, sinkholes), never a world function.
//
// The height (heightAt), in order:
//   relief  fbm noise of wavelength 24 and 12 tiles (two octaves) times 3 × the terrains' relief, blended bilinearly between
//           the four nearest span centres. Its slope stays under 1 block per tile, so rounding never
//           makes a 2-block step between 4-neighbours: the map (where heights are invisible) stays walkable.
//   cliffs  a separate mask raises small areas by 5 (≥ 4, so even across the relief the step at a cliff's
//           foot is 4 or more and the map draws it as a wall). No cliff within 10 tiles of a port or a
//           landmark's flattened ground. Where the biome stacks them (content/biomes.js cliffTiers 2: the Rust
//           Steps' mesas) the mask's cores rise 5 more, a mesa on a mesa (`tier` 2): only inside such a span
//           (not blended into its neighbours) and only where all four neighbours are cliff too, so a stacked
//           mesa always stands on a ledge, never straight out of the plain. The map draws all ground
//           4 or more blocks up as wall (world.js computeKinds), so a cliff top is ground only in 3D, and only
//           once a builder makes a way up (a ramp, a climb); the map's navigability leaves it out
//           (gen/surface.js validateSurface).
//   rivers  a river comes in from its port straight for 8 tiles on both sides of the edge (the approach);
//           the ground within d tiles of that channel is at most d high, so its banks slope down to the
//           water, which sits at the datum on rock (it never drops you a level; every body floats on it).
//   flatten world.flatten (fixed landmark footprints): inside the rect and its 2-tile skirt the ground is
//           the landmark's datum; beyond it the height may differ from the datum by at most 1 block per
//           tile, so the natural ground comes back within the 4-tile falloff (3 blocks of relief, 3 tiles).
// Clamping with distances keeps every step at most 1 block, the property the slope rule needs. Last, no
// ground stands more than 12 blocks above the datum (DECISIONS: heights).
//
// A column is rock below the datum's layer, the biome's sub-ground (content/biomes.js `sub`: the Rust Steps'
// red clay, the Lattice's crystal) from that layer up to the ground block on top, so a cliff or a hill shows
// its biome's stuff in 3D. Both the zone and the apron build it from the span alone (columnAt `sub`).
//
// A tree's trunk is 4-5 blocks with a 3×3 canopy on top; on high ground it is shorter, so its top leaf stays
// in the zone's 16 blocks (scenery at most 14 above the datum, DECISIONS), and none grows where that leaves
// under 3. No world tile's span carries an elevation of its own (the world model's `elev`): ground 4 blocks up
// would be a map wall, so the surface's own relief is all the height the map can show.
//
// Liquids (DECISIONS: one per span, no mixing): a river carries its own (gen/ports.js, the same on both sides
// of each edge), and a span with a river holds that one everywhere; any other span the biome's.
import { B, FLOOR_Z, SURFACE } from "../world.js";
import { seedFor, hashInt, hashFloat, seededNoise, fbm, distance } from "../rng.js";
import { FLATTEN_SKIRT } from "../world/worldmodel.js";
import { biomeFor } from "../content/biomes.js";
import { portTable } from "./ports.js";

export const SURFACE_RULES = {
  reliefWave: 24,     // tiles: the relief noise's base wavelength; its second octave is half that, 12 (§5.3: at least 12)
  maxRelief: 3,       // blocks: the relief's amplitude at relief 1 (§5.3: at most 3)
  cliffRise: 5,       // blocks a cliff raises its area by
  cliffWave: 9,       // tiles: the size of the cliff mask's blobs
  cliffArea: 0.12,    // how much of the mask rises at cliffs 1 (the threshold is 1 − cliffArea × cliffs)
  cliffArea2: 0.05,   // how much of it rises a second time where the biome stacks cliffs (cliffTiers 2)
  cliffClear: 10,     // tiles: no cliffs this close to a port or a landmark's flattened ground
  approach: 8,        // tiles: a river runs straight in from its port this far on both sides of an edge
  treeCell: 3,        // tiles: one tree candidate per 3×3-tile world cell
  treeClear: 3,       // tiles: no tree this close to a port's channel
  edgeKeep: 2,        // tiles: zone-local features keep this far from open edges (§5.1 e)
  siteMargin: 6,      // tiles: per-run sites keep this far from every edge (§5.4)
  jumpSpots: 2,       // at most this many 3D-only plateaus a zone (§5.3 item 8; there is no RULES.surface)
  plateauRise: 2,     // blocks a plateau stands above everything round it: the map's step (1) can't reach it
  maxStand: 12,       // standable ground at most 12 blocks above the datum (DECISIONS: heights)
  minNav: 0.9,        // at least 90% of the ground in one piece, under the map's step rules
  maxSteps: 4,        // unplanned 2-block steps allowed
  attempts: 10,
};
const R = SURFACE_RULES;
const ZW = SURFACE.w, ZD = SURFACE.d;

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
// Drop what is kept for a world (its spans changed: the Lengthening). gen/surface.js forgetWorld calls it.
export function forgetWorldFns(world) { fnCache.delete(world); }
export const heightAt = (world, seed, gx, gy) => makeWorldFns(world, seed >>> 0).heightAt(gx, gy);
export const treeAt = (world, seed, cx, cy) => makeWorldFns(world, seed >>> 0).treeAt(cx, cy);

const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const floorDiv = (a, b) => Math.floor(a / b);

function makeWorldFns(world, seed) {
  const { w: WW, h: WH } = world;
  const sRelief = seedFor(seed, "relief") | 0, sCliff = seedFor(seed, "cliffs") | 0;
  // Per-span terrain parameters (spans off the map take the nearest one's).
  const n = WW * WH, relief = new Float64Array(n), cliffs = new Float64Array(n), trees = new Float64Array(n);
  const stacked = new Float64Array(n), ground = new Uint8Array(n), sub = new Uint8Array(n);
  for (const t of world.tiles) {
    const T = world.terrains[t.terrain] || {}, i = t.wx + t.wy * WW;
    relief[i] = T.relief ?? 0.3; cliffs[i] = T.cliffs ?? 0; trees[i] = T.trees ?? 0;
    const bio = biomeFor(world, t);
    stacked[i] = bio.cliffTiers >= 2 ? cliffs[i] : 0;
    ground[i] = B[T.ground] ?? B.GRASS;
    sub[i] = B[bio.sub] ?? B.ROCK;
  }
  const spanIndex = (tx, ty) => clampInt(tx, 0, WW - 1) + clampInt(ty, 0, WH - 1) * WW;
  // Bilinear blend of a per-span value between the four nearest span centres.
  const blend = (arr, gx, gy) => {
    const u = (gx + 0.5) / ZW - 0.5, v = (gy + 0.5) / ZD - 0.5;
    const tx = Math.floor(u), ty = Math.floor(v), fx = u - tx, fy = v - ty;
    const a = arr[spanIndex(tx, ty)], b = arr[spanIndex(tx + 1, ty)], c = arr[spanIndex(tx, ty + 1)], d = arr[spanIndex(tx + 1, ty + 1)];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };

  const portsOf = portTable(world, seed);
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

  // Whether the cliff mask raises (gx, gy) at all (columnAt's first tier, alone).
  function cliffAt(gx, gy) {
    const wx = floorDiv(gx, ZW), wy = floorDiv(gy, ZD);
    for (const p of portsOf(wx, wy)) if (rectDist(channel(wx, wy, p), gx, gy) < R.cliffClear) return false;
    for (const f of flattenNear(wx, wy)) if (rectDist(f, gx, gy) < R.cliffClear) return false;
    const c = blend(cliffs, gx, gy);
    return c > 0 && seededNoise(sCliff, gx / R.cliffWave, gy / R.cliffWave) > 1 - R.cliffArea * c;
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
    let cliff = 0, tier = 0;
    if (near >= R.cliffClear) {
      const c = blend(cliffs, gx, gy);
      if (c > 0) {
        const m = seededNoise(sCliff, gx / R.cliffWave, gy / R.cliffWave);
        if (m > 1 - R.cliffArea * c) {
          tier = 1;
          const c2 = stacked[spanIndex(wx, wy)];   // the span's own: mesas stack only on the Steps
          if (c2 > 0 && m > 1 - R.cliffArea2 * c2 && cliffAt(gx + 1, gy) && cliffAt(gx - 1, gy) && cliffAt(gx, gy + 1) && cliffAt(gx, gy - 1)) tier = 2;
          cliff = tier * R.cliffRise;
        }
      }
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
    const height = Math.min(R.maxStand, Math.max(0, Math.floor(raw + 0.5)));
    const isCliff = cliff > 0 && height >= R.cliffRise;
    const si = spanIndex(wx, wy);
    return { height: water ? 0 : height, cliff: isCliff ? 1 : 0, tier: isCliff ? tier : 0, water,
             ground: ground[si], sub: sub[si], near };
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
    // The top leaf (base + trunk + 1) stays below the zone's roof, SURFACE.h.
    const trunk = Math.min(4 + (hashInt(seed, "treeH", cx, cy) % 2), SURFACE.h - 2 - FLOOR_Z - col.height);
    if (trunk < 3) return null;
    return { gx, gy, base: FLOOR_Z + col.height, trunk };
  }

  // The span's liquid: a river's (the lowest id if two rivers meet, so every caller agrees), else the biome's.
  function liquidOf(wx, wy) {
    let out = null;
    for (const p of portsOf(wx, wy)) if (p.kind === "river" && (out === null || p.liquid < out)) out = p.liquid;
    const t = world.tileAt(wx, wy);
    return out || (t ? biomeFor(world, t).liquid : "water");
  }

  return { seed, world, portsOf, channel, columnAt, heightAt: (gx, gy) => columnAt(gx, gy).height, treeAt, liquidOf };
}
