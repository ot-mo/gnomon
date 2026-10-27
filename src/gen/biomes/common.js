// What every biome builder is made of (TECH_DESIGN §5.3 item 6, §1.4 ctx; owner WS2). A builder in this folder
// is (ctx) => void; most call dress(ctx) with their content/biomes.js data and add a feature or two of their own.
//
//   withHelpers(ctx) → ctx       gen/surface.js builds ctx (§1.4's fields and the zone's working masks) and this
//                                adds the writers below
//   dress(ctx, data = ctx.biome) ponds, ramps up the cliffs (and a cache on a top one reaches), 3D-only plateaus,
//                                rocks, lamp posts and props, in that order
//   populate(ctx, dist)          the zone's wildlife (data.spawns, data.wildlife), on map ground `dist` (the
//                                anchor's reach) says can be walked to, far from the anchor
//   spawnPick(rng, spawns, level) → type   a spawn key by weight among the types whose levels hold `level`
//   ponds, rocks, ramps, plateaus, lights, props, placeTreasure   the parts of dress, for a builder's own use
//
// ctx (gen/surface.js buildSurface): run, zone, tile, site, rng (the attempt's: R6, draw from nothing else),
// level, biome (content/biomes.js data, biomeFor), ports, margin (6: per-run sites), hub, and per column (index
// x + y·80): H (height above the datum), water (0, 1 shallow, 2 deep), cliff (the world function's), base (the
// world layer: ground and sub blocks), busy (a zone feature, a road, water, a footprint, a tree or the hub
// stands there: nothing else may), local (zone.gen.local: changed from the world functions), planned (a face
// of 2 or more that is meant: validateSurface doesn't count it), jump (a plateau's top: 3D's ground alone),
// walls (zone.planWalls: a wall on the map however low), scenery (no one stands there: a trunk, a post's top),
// footprint (a site's or landmark's rect and skirt), and made: { plateaus, ramps, caches } (zone.gen keeps it).
//
// The writers keep the rules a check holds: only inside keep() (2 tiles from every edge; check-edges rule e),
// every changed column marked local (check-surface compares the rest with the neighbour's apron), water at the
// datum on rock (validateSurface), no step of 2 or more unless planned, nothing standable over 12 blocks up.
import { B, FLOOR_Z } from "../../world.js";
import { distance } from "../../rng.js";
import { spawnCreature, addCreature, CREATURE_TYPES } from "../../creatures.js";
import { makeItem, randomTreasure } from "../../items.js";
import { contentLevel } from "../../stats.js";
import { SURFACE_RULES as R } from "../terrain.js";
import { PROPS } from "../../content/biomes.js";

const NEXT4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const WALL_UP = 4;   // ground this high above the datum is a wall on the map (world.js computeKinds)
const blockOf = (key, fallback) => B[key] ?? fallback;

export function withHelpers(ctx) {
  const { zone } = ctx, W = zone.w, D = zone.d;
  const at = (x, y) => x + y * W;
  ctx.propAt = new Uint8Array(W * D);   // a prop stands there
  // Every writer's one way into the zone: a voxel that changes marks its column local (check-surface holds that a
  // column marked local really differs from the world function: over-marking would hide the apron's faults).
  const set = (x, y, z, b) => { if (zone.get(x, y, z) !== b && z >= 0 && z < zone.h) { zone.set(x, y, z, b); ctx.local[at(x, y)] = 1; } };
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < D;
  Object.assign(ctx, {
    inside,
    keep: (x, y) => x >= R.edgeKeep && y >= R.edgeKeep && x < W - R.edgeKeep && y < D - R.edgeKeep,
    heightAt: (x, y) => ctx.H[at(x, y)],
    groundZ: (x, y) => FLOOR_Z + ctx.H[at(x, y)],   // the feet height on it (§1.4)
    // A column nothing else uses yet: inside the keep, off cliffs, water, roads, footprints, trees and features.
    free: (x, y) => ctx.keep(x, y) && !ctx.busy[at(x, y)] && !ctx.cliff[at(x, y)],
    // Every column of a rectangle (and `pad` round it) free.
    freeRect: (x0, y0, w, d, pad = 0) => {
      for (let y = y0 - pad; y < y0 + d + pad; y++) for (let x = x0 - pad; x < x0 + w + pad; x++) if (!ctx.free(x, y)) return false;
      return true;
    },
    occupy: (x, y) => { if (inside(x, y)) ctx.busy[at(x, y)] = 1; },
    // Rewrite a column: rock under the datum's layer, `body` (the biome's sub-ground) up to height h, `top` on
    // it (the ground's own block), air above. Marks it local if that changed it.
    column: (x, y, h, { top = null, body = null } = {}) => {
      const i = at(x, y), t = FLOOR_Z - 1 + h;
      for (let z = 0; z < zone.h; z++) set(x, y, z, z < FLOOR_Z - 1 ? B.ROCK : z < t ? (body ?? ctx.base.sub[i]) : z === t ? (top ?? ctx.base.ground[i]) : B.AIR);
      ctx.H[i] = h; ctx.water[i] = 0;
    },
    // A water column: rock, the liquid at the datum (shallow or deep), air above.
    pool: (x, y, deep) => {
      const i = at(x, y);
      for (let z = 0; z < zone.h; z++) set(x, y, z, z < FLOOR_Z - 1 ? B.ROCK : z === FLOOR_Z - 1 ? (deep ? B.WATER_DEEP : B.WATER_SHALLOW) : B.AIR);
      ctx.H[i] = 0; ctx.water[i] = deep ? 2 : 1;
    },
    // A block standing on the ground (dz 0: the first layer above it).
    put: (x, y, dz, block) => set(x, y, FLOOR_Z + ctx.H[at(x, y)] + dz, block),
    // Claim a rectangle (§1.4 reserve): false if any of it is taken.
    reserve: (rect) => {
      if (!ctx.freeRect(rect.x, rect.y, rect.w, rect.d)) return false;
      for (let y = rect.y; y < rect.y + rect.d; y++) for (let x = rect.x; x < rect.x + rect.w; x++) ctx.occupy(x, y);
      return true;
    },
    reserved: (x, y) => !!ctx.busy[at(x, y)],
    // A prop on (x, y): only inside the keep, on dry ground with air at its feet, one a tile; the column is taken
    // (nothing is built over it later). False where it can't stand.
    addProp: (kind, x, y) => {
      const i = at(x, y);
      if (!ctx.keep(x, y) || ctx.propAt[i] || ctx.water[i] || zone.get(x, y, FLOOR_Z + ctx.H[i])) return false;
      zone.props.push({ x: x + 0.5, y: y + 0.5, z: FLOOR_Z + ctx.H[i], kind });
      ctx.propAt[i] = 1; ctx.busy[i] = 1;
      return true;
    },
    placeItem: (item, x, y, z = FLOOR_Z + ctx.H[at(x, y)]) => { const it = makeItem(item, x + 0.5, y + 0.5, z); zone.items.push(it); return it; },
    placeCreature: (type, x, y, opts = {}) => addCreature(zone, spawnCreature(type, x, y, opts.z ?? zone.standHeight(x, y), {
      rng: ctx.cosmetic, state: opts.state ?? "idle", level: opts.level ?? zone.level })),
    // A path of blocks on the ground (§1.4 carve): `block` as the top of each point's column, `width` wide.
    carve: (points, width = 1, block = B.DIRT) => {
      for (const [px, py] of points)
        for (let k = 0; k < width; k++) {
          const x = px + (k & 1 ? 0 : k >> 1), y = py + (k & 1 ? (k + 1) >> 1 : 0);
          if (ctx.free(x, y)) { ctx.column(x, y, ctx.H[at(x, y)], { top: block }); ctx.occupy(x, y); }
        }
    },
  });
  return ctx;
}

// --- Dressing ------------------------------------------------------------------------------------------
export function dress(ctx, data = ctx.biome) {
  ponds(ctx, data.ponds);
  ramps(ctx, data.ramps, data.caches);
  plateaus(ctx, data.plateaus, data.rocks);
  rocks(ctx, data.rocks);
  lights(ctx, data.lights);
  props(ctx, data.props);
}

const roll = (rng, [lo, hi] = [0, 0]) => rng.int(lo, hi);

// A free column somewhere in the keep, or null after `tries`.
function somewhere(ctx, ok, tries = 40, pad = 0) {
  const { rng, zone } = ctx;
  for (let k = 0; k < tries; k++) {
    const x = rng.int(R.edgeKeep + pad, zone.w - 1 - R.edgeKeep - pad), y = rng.int(R.edgeKeep + pad, zone.d - 1 - R.edgeKeep - pad);
    if (ok(x, y)) return [x, y];
  }
  return null;
}

// Ponds: a disc of the zone's liquid at the datum, deep in the middle from radius 3, the ground within 3 tiles of
// it no higher than its distance (the rivers' banks), so no step is over 1. Only where nothing else is within the
// banks and no cliff within a tile of them (relief alone is at most 3, so the banks meet the ground with steps of
// 1). A clearing's middle is tried first (ctx.clearings: in dense woods the only place a pond fits).
export function ponds(ctx, spec) {
  if (!spec) return;
  const { rng, zone, H, cliff } = ctx, W = zone.w, spots = [...(ctx.clearings || [])];
  const fits = (x, y, r) => {
    for (let dy = -r - 4; dy <= r + 4; dy++)
      for (let dx = -r - 4; dx <= r + 4; dx++) {
        const d = distance(dx, dy), i = x + dx + (y + dy) * W;
        if (d > r + 4) continue;
        if (!ctx.keep(x + dx, y + dy) || cliff[i] || (d <= r + 3 && ctx.busy[i])) return false;
      }
    return true;
  };
  for (let n = roll(rng, spec.count), made = 0, k = 0; made < n && k < n * 6; k++) {
    const r = rng.int(spec.radius[0], spec.radius[1]), out = r + 3;
    const first = spots.shift();
    const spot = (first && fits(first[0], first[1], r) ? first : null) || somewhere(ctx, (x, y) => fits(x, y, r), 12);
    if (!spot) continue;
    const [cx, cy] = spot;
    let low = true;
    for (let dy = -r - 1; dy <= r + 1 && low; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) if (H[cx + dx + (cy + dy) * W] > 2) { low = false; break; }
    if (!low) continue;
    for (let dy = -out; dy <= out; dy++)
      for (let dx = -out; dx <= out; dx++) {
        const x = cx + dx, y = cy + dy, d = distance(dx, dy);
        if (d > r + 3) continue;
        if (d <= r + 0.5) ctx.pool(x, y, r >= 3 && d < r - 1.5);
        else { const cap = Math.floor(d - r); if (H[x + y * W] > cap) ctx.column(x, y, cap); }
        ctx.occupy(x, y);
      }
    ctx.made.ponds.push({ x: cx, y: cy, r });
    made++;
  }
}

// Rocks: 1-block rubble on level ground (a step up from every side), or 2-3-block outcrops (scenery: walls on the
// map, the same height as a low wall in 3D), a few tiles in a cluster.
export function rocks(ctx, spec) {
  if (!spec) return;
  const { rng, zone, H } = ctx, W = zone.w, block = blockOf(spec.block, B.ROCK);
  for (let n = roll(rng, spec.count), k = 0; k < n; k++) {
    const tall = rng.chance(spec.tall ?? 0), size = rng.int(1, tall ? 3 : 4);
    const spot = somewhere(ctx, (x, y) => ctx.freeRect(x - 1, y - 1, 3, 3, 1), 20);
    if (!spot) continue;
    let [x, y] = spot;
    for (let s = 0; s < size; s++) {
      const i = x + y * W;
      if (!ctx.free(x, y)) break;
      if (tall) {
        const up = rng.int(2, 3);
        for (let dz = 0; dz < up; dz++) ctx.put(x, y, dz, block);
        ctx.walls[i] = ctx.scenery[i] = ctx.planned[i] = 1;
      } else if (NEXT4.every(([dx, dy]) => H[x + dx + (y + dy) * W] === H[i])) ctx.put(x, y, 0, block);
      ctx.occupy(x, y);
      const [dx, dy] = rng.pick(NEXT4);
      x += dx; y += dy;
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) ctx.occupy(spot[0] + dx, spot[1] + dy);
  }
}

// Lamp posts: a post 2 blocks high with a lamp on top (an outdoor light that burns by night), scenery and a map wall.
export function lights(ctx, spec) {
  if (!spec) return;
  const { rng } = ctx, post = blockOf(spec.post, B.STONE);
  for (let n = roll(rng, spec.count), k = 0; k < n; k++) {
    const spot = somewhere(ctx, (x, y) => ctx.freeRect(x - 1, y - 1, 3, 3), 20);
    if (!spot) continue;
    const [x, y] = spot, i = x + y * ctx.zone.w;
    ctx.put(x, y, 0, post); ctx.put(x, y, 1, post); ctx.put(x, y, 2, B.LAMP);
    ctx.walls[i] = ctx.scenery[i] = ctx.planned[i] = 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) ctx.occupy(x + dx, y + dy);
  }
}

// Props: non-blocking sprites on free ground (not in water, not on a feature), zone.props.
export function props(ctx, spec) {
  if (!spec?.kinds?.length) return;
  const { rng } = ctx, total = spec.kinds.reduce((s, [, w]) => s + w, 0);
  for (let n = roll(rng, spec.count), k = 0; k < n; k++) {
    const spot = somewhere(ctx, (x, y) => ctx.free(x, y), 10);
    if (!spot) continue;
    let pick = rng() * total, kind = spec.kinds[0][0];
    for (const [id, w] of spec.kinds) if ((pick -= w) < 0) { kind = id; break; }
    if (PROPS[kind]) ctx.addProp(kind, spot[0], spot[1]);
  }
}

// A reward: the parent's treasure table (gear, a scroll, now and then a crystal; never a pile of glim) at the
// zone's level.
export function placeTreasure(ctx, x, y) {
  return ctx.placeItem(randomTreasure(ctx.rng, contentLevel(ctx.level)), x, y);
}

// --- Plateaus (§5.3 item 8): the outdoor climb room -------------------------------------------------------
// A block of ground R.plateauRise (2) above everything round it, with a reward on top. A stepping stone 1 below
// its top stands one tile's gap away: from the stone you jump up 1 across the gap in 3D; on the map no
// neighbour of the plateau is within a step (1) of it, so the map shows the reward and can't reach it. The
// stone stands on ground the map walks to. The plateau's columns are zone.gen.jump (3D's ground alone), its
// faces and the stone's planned. At most R.jumpSpots a zone: `chance` for the first, the same again for a second.
export function plateaus(ctx, chance, rocksSpec) {
  const { rng, zone, H } = ctx, W = zone.w;
  const body = blockOf(rocksSpec?.block, B.ROCK);
  for (let made = 0; made < R.jumpSpots && rng.chance(chance ?? 0); ) {
    let done = false;
    for (let k = 0; k < 12 && !done; k++) {
      const pw = rng.int(2, 3), pd = rng.int(2, 3);
      const spot = somewhere(ctx, (x, y) => ctx.freeRect(x - 3, y - 3, pw + 6, pd + 6), 8, 3);
      if (!spot) break;
      const [x0, y0] = spot;
      // The ground round it: its top stands plateauRise above the highest of it.
      let hi = -1, lo = 99;
      for (let y = y0 - 1; y <= y0 + pd; y++) for (let x = x0 - 1; x <= x0 + pw; x++) { hi = Math.max(hi, H[x + y * W]); lo = Math.min(lo, H[x + y * W]); }
      if (hi - lo > 1) continue;
      const top = hi + R.plateauRise;
      // The stone: on one side, a tile's gap from the plateau, beside ground the map can stand on within a step.
      const sides = rng.shuffle([["n", 0, -1], ["s", 0, 1], ["w", -1, 0], ["e", 1, 0]]);
      let stone = null;
      for (const [, dx, dy] of sides) {
        const sx = dx ? (dx < 0 ? x0 - 2 : x0 + pw + 1) : x0 + (pw >> 1), sy = dy ? (dy < 0 ? y0 - 2 : y0 + pd + 1) : y0 + (pd >> 1);
        const back = [sx + dx, sy + dy];
        if (H[back[0] + back[1] * W] >= top - 2 && H[sx + sy * W] <= top - 1) { stone = [sx, sy]; break; }
      }
      if (!stone) continue;
      for (let y = y0; y < y0 + pd; y++)
        for (let x = x0; x < x0 + pw; x++) {
          ctx.column(x, y, top, { body, top: body });
          ctx.jump[x + y * W] = ctx.planned[x + y * W] = 1;
        }
      const [sx, sy] = stone;
      ctx.column(sx, sy, top - 1, { body, top: body });
      ctx.planned[sx + sy * W] = 1;
      const cx = x0 + (pw >> 1), cy = y0 + (pd >> 1);
      placeTreasure(ctx, cx, cy);
      ctx.made.plateaus.push({ x: x0, y: y0, w: pw, d: pd, z: FLOOR_Z + top, stone: { x: sx, y: sy }, reward: { x: cx, y: cy } });
      for (let y = y0 - 3; y < y0 + pd + 3; y++) for (let x = x0 - 3; x < x0 + pw + 3; x++) ctx.occupy(x, y);
      made++;
      done = true;
    }
    if (!done) break;
  }
}

// --- Ramps up the cliffs ---------------------------------------------------------------------------------
// A cliff top (5 up; the Steps' stacked mesas 10) has no way up of its own. A ramp is a stair of 1-block steps
// built out from the cliff's face, each a step below the last, until it meets ground within a step: the map
// walks up it as far as the map can (ground 4 or more up is a wall on the map), 3D the rest of the way onto the
// top. A ramp may stand on a lower cliff (a stacked mesa's ledge). Its sides are planned faces. `caches`: the
// chance of a reward on the top it reaches (a Rustback heap: scrap and a find), 3 or more tiles from the ramp.
export function ramps(ctx, count, caches = 0) {
  const { rng, zone, H, cliff } = ctx, W = zone.w;
  const n = roll(rng, count);
  if (!n) return;
  // A top is a cliff column still a map wall's height (a site's skirt may have pulled a cliff down, the cliff mask
  // kept) and still free (an earlier ramp or cache may have taken it since the list was made).
  const top = (i) => cliff[i] && H[i] >= WALL_UP && !ctx.busy[i];
  const tops = [];
  for (let i = 0; i < W * zone.d; i++) if (top(i) && ctx.keep(i % W, (i - (i % W)) / W)) tops.push(i);
  if (!tops.length) return;
  for (let made = 0, k = 0; made < n && k < n * 30; k++) {
    const c = tops[rng.int(0, tops.length - 1)], cx = c % W, cy = (c - cx) / W, T = H[c];
    if (!top(c)) continue;
    for (const [dx, dy] of rng.shuffle([...NEXT4])) {
      const steps = [];
      let ok = false;
      for (let s = 1; s <= 12; s++) {
        const x = cx + dx * s, y = cy + dy * s, i = x + y * W, want = T - s;   // the height step s needs
        if (!ctx.keep(x, y) || ctx.busy[i] || ctx.water[i]) break;
        // Ground at least as high as this step meets the ramp: from it onto the last step is a step of 1 at most
        // (higher than that, it's another cliff's face).
        if (H[i] >= want) { ok = steps.length > 0 && H[i] <= want + 1; break; }
        steps.push([x, y, want]);
      }
      if (!ok) continue;
      for (const [x, y, h] of steps) {
        const i = x + y * W;
        ctx.column(x, y, h, { top: ctx.base.ground[i] });
        ctx.planned[i] = 1;
        ctx.occupy(x, y);
      }
      ctx.planned[c] = 1;
      ctx.made.ramps.push({ top: { x: cx, y: cy, z: FLOOR_Z + T }, foot: { x: steps[steps.length - 1][0], y: steps[steps.length - 1][1] }, steps: steps.length });
      made++;
      if (rng.chance(caches)) cache(ctx, cx, cy, T);
      break;
    }
  }
}

// A cache on the cliff top a ramp reaches: the top's columns of the same height, 3 or more tiles from where the
// ramp lands, scrap round a find.
function cache(ctx, cx, cy, T) {
  const { zone, H, cliff, rng } = ctx, W = zone.w, seen = new Set([cx + cy * W]), q = [cx + cy * W], far = [];
  for (let h = 0; h < q.length && q.length < 400; h++) {
    const i = q[h], x = i % W, y = (i - x) / W;
    if (distance(x - cx, y - cy) >= 3 && ctx.keep(x, y) && !ctx.busy[i]) far.push(i);
    for (const [dx, dy] of NEXT4) {
      const j = x + dx + (y + dy) * W;
      if (ctx.inside(x + dx, y + dy) && !seen.has(j) && cliff[j] && H[j] === T) { seen.add(j); q.push(j); }
    }
  }
  if (!far.length) return;
  const i = far[rng.int(0, far.length - 1)], x = i % W, y = (i - x) / W;
  placeTreasure(ctx, x, y);
  for (const [dx, dy] of NEXT4) if (ctx.inside(x + dx, y + dy) && cliff[x + dx + (y + dy) * W] && rng.chance(0.6)) ctx.addProp("scrap", x + dx, y + dy);
  ctx.occupy(x, y);
  ctx.made.caches.push({ x, y, z: FLOOR_Z + T });
}

// --- Wildlife ---------------------------------------------------------------------------------------------
const levelsOf = (t) => t.levels || t.depths || [1, 99];
export function spawnPick(rng, spawns, level) {
  let list = spawns.filter(([id]) => CREATURE_TYPES[id] && levelsOf(CREATURE_TYPES[id])[0] <= level && level <= levelsOf(CREATURE_TYPES[id])[1]);
  if (!list.length) {   // nothing of this level here: the nearest in level
    const gap = ([id]) => { const [lo, hi] = levelsOf(CREATURE_TYPES[id]); return level < lo ? lo - level : level - hi; };
    const known = spawns.filter(([id]) => CREATURE_TYPES[id]);
    if (!known.length) return null;
    const best = Math.min(...known.map(gap));
    list = known.filter((s) => gap(s) === best);
  }
  let pick = rng() * list.reduce((s, [, w]) => s + w, 0);
  for (const [id, w] of list) if ((pick -= w) < 0) return id;
  return list[list.length - 1][0];
}

// The zone's wildlife: data.wildlife creatures or packs, each on map ground the anchor reaches (dist ≥ 0), 12 or
// more tiles from it, off water, footprints and features, inside the keep; a pack's members within 2 tiles.
export function populate(ctx, dist, data = ctx.biome) {
  const { rng, zone } = ctx, W = zone.w, ax = Math.floor(zone.spawn.x), ay = Math.floor(zone.spawn.y);
  if (!data.spawns?.length) return;
  const ok = (x, y) => {
    const i = x + y * W;
    return ctx.keep(x, y) && dist[i] >= 0 && !ctx.water[i] && !ctx.footprint[i] && !ctx.scenery[i] && !ctx.jump[i] &&
      !zone.creatures.some((c) => c.tx === x && c.ty === y);
  };
  for (let n = roll(rng, data.wildlife), k = 0; k < n; k++) {
    const type = spawnPick(rng, data.spawns, zone.level);
    if (!type) return;
    const spot = somewhere(ctx, (x, y) => ok(x, y) && distance(x - ax, y - ay) >= 12, 30);
    if (!spot) continue;
    const t = CREATURE_TYPES[type], size = t.group ? roll(rng, t.group) : 1;
    for (let m = 0; m < size; m++) {
      const [x, y] = m === 0 ? spot : [spot[0] + rng.int(-2, 2), spot[1] + rng.int(-2, 2)];
      if (m > 0 && !ok(x, y)) continue;
      ctx.placeCreature(type, x, y, { state: rng.chance(0.5) ? "wander" : "idle" });
    }
  }
}
