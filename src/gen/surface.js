// Surface zones: one world span's ground, 80×48×16 (TECH_DESIGN §5.3; owner WS2).
//
//   generateSurface(run, wx, wy) → Zone the span's surface zone (unsealed), validated, up to 10 attempts
//   surfaceSteps(run, wx, wy) → iterator   the same work in stages (0D1): each next() does one stage
//                                       (a few ms) and the last returns { done: true, value: Zone }, so
//                                       3D prefetch can spread a zone over frames; same zone, same bits.
//                                       Each stage also builds one world-function band of the zone's
//                                       apron ahead of the swap (gen/apron.js, WS3 #6)
//   validateSurface(zone) → string[]    the §5.3 item 9 rules (empty: fine)
//   dungeonRectFor(entrance) → rect     where the dungeon's 48×48 levels sit under the surface (§5.5)
//   BIOME_BUILDERS, SITE_BUILDERS       TECH_DESIGN §1.4's registries, re-exported: biome id → (ctx) => void from
//                                       gen/biomes/index.js, site kind → (ctx, site) => void from world/sites.js
//                                       (where 0A2 put it, so this file can read it)
// Re-exported from the modules they live in, so a caller can import them from here as before:
//   worldFns, heightAt, treeAt, SURFACE_RULES   gen/terrain.js (the world functions: the height, cliffs, rivers'
//                                               channels, the flatten mask, trees)
//   portsOf                                     gen/ports.js (edgePorts is there too)
//   buildApronBand                              gen/apron.js (APRON_BUILDERS.surface, registered by world/zonegen.js)
//
// A zone then adds its own features, each 2 tiles or more from an open edge except where it meets a
// port: the road from each road port to the hub (the site's door, or the zone centre), carved so that
// no step on it is over 1; the river's bends between its approaches (or a lake for a single port) with
// a ford; trees from treeAt (a canopy that crosses an edge is built whole by both zones); the landmark's
// plan or the site; the dungeon entrance (a STAIRS block, zone.entrance) and, when a dungeon lies below,
// sinkholes inside zone.dungeonRect.
import { Zone, B, FLOOR_Z, SURFACE, standWith } from "../world.js";
import { KIND } from "../blocks.js";
import { makeRng, seedFor, distance } from "../rng.js";
import { reachable, PLAYER_STEP_UP, PLAYER_DROP } from "../pathing.js";
import { SIDES, FLATTEN_SKIRT } from "../world/worldmodel.js";
import { SITE_BUILDERS, dungeonParams } from "../world/sites.js";
import { generateDungeonLevel } from "./dungeon.js";
import { zoneSeed } from "../world/run.js";
import { stampVault } from "./vaults.js";
import { worldFns, heightAt, treeAt, SURFACE_RULES } from "./terrain.js";
import { portsOf } from "./ports.js";
import { buildApronBand, apronBandSteps } from "./apron.js";
export { SITE_BUILDERS } from "../world/sites.js";
export { BIOME_BUILDERS } from "./biomes/index.js";
export { worldFns, heightAt, treeAt, SURFACE_RULES, portsOf, buildApronBand };

const R = SURFACE_RULES;
const ZW = SURFACE.w, ZD = SURFACE.d;
const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const floorDiv = (a, b) => Math.floor(a / b);

// --- Where the dungeon sits ---------------------------------------------------------------------
// Levels are 48×48 and the surface 80×48: the levels sit centred under the entrance (§5.5).
export function dungeonRectFor(entrance) {
  return { ox: clampInt(entrance.x - 24, 0, ZW - 48), oy: 0, w: 48, d: 48 };
}

// --- Generating a surface zone ------------------------------------------------------------------
const NEXT4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Offsets within 14 tiles (ground is never higher than that), nearest first: [dx, dy, distance].
const NEAR = [];
for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) if (dx || dy) NEAR.push([dx, dy, distance(dx, dy)]);
NEAR.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);

// The sites on a span: its landmark site first, then the per-run ones.
function sitesOf(run, wx, wy) {
  return (run.sitesAt.get(`${wx},${wy}`) || []).map((id) => run.sites.get(id)).filter(Boolean)
    .sort((a, b) => (a.kind === "landmark" ? 0 : 1) - (b.kind === "landmark" ? 0 : 1));
}

export function generateSurface(run, wx, wy) {
  const it = zoneSteps(run, wx, wy);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

// The staged make (3D prefetch): the zone's stages, each also building one of the world-function bands its
// apron will want (gen/apron.js apronBandSteps), so the frame that swaps into it finds them made (WS3 #6);
// bands left over when the zone is done take a stage each. The zone is generateSurface's, bit for bit.
export function* surfaceSteps(run, wx, wy) {
  const inner = zoneSteps(run, wx, wy);
  let r = inner.next();
  if (r.done) return r.value;
  const bands = apronBandSteps(run, wx, wy);
  for (; !r.done; r = inner.next()) { bands.next(); yield r.value; }
  for (const side of bands) yield `apron ${side}`;
  return r.value;
}

// The stages: the world layer, then buildSurface's (yields between its numbered steps), then validation.
function* zoneSteps(run, wx, wy) {
  const world = run.world, tile = world.tileAt(wx, wy);
  if (!tile) return null;
  const W = worldFns(world, run.seed), seed = zoneSeed(run, wx, wy, 0);
  const base = worldLayer(W, wx, wy);
  yield "layer";
  let zone = null, problems = [];
  for (let attempt = 0; attempt < R.attempts; attempt++) {
    zone = yield* buildSurface(run, W, base, wx, wy, seed, makeRng(seedFor(seed, "surface", attempt)));
    yield "built";
    zone.attempts = attempt + 1;
    problems = validateSurface(zone);
    if (!problems.length) break;
    yield "retry";
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

function* buildSurface(run, W, base, wx, wy, seed, rng) {
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
  zone.liquid = W.liquidOf(wx, wy);   // one liquid per span: its river's, else its biome's
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
          for (const [dx, dy, d] of NEAR) {   // nearest first: the first water found sets the bank's height
            if (d >= H[i]) break;
            const qx = x + dx, qy = y + dy;
            if (qx >= 0 && qy >= 0 && qx < ZW && qy < ZD && water[qx + qy * ZW]) { H[i] = Math.floor(d); break; }
          }
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

  yield "roads";

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

  yield "trees";

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
  // Plan walls and roofs are scenery: nobody walks on them, and the map draws them as walls
  // (zone.planWalls: also a wall lower than a dungeon room's, which computeKinds alone would call floor).
  if (planAt) {
    zone.refresh();
    zone.planWalls = new Uint8Array(n);
    for (let y = planAt.y; y < planAt.y + planAt.d; y++)
      for (let x = planAt.x; x < planAt.x + planAt.w; x++) { const i = x + y * ZW; if (zone.stand[i] > FLOOR_Z + 1) scenery[i] = zone.planWalls[i] = 1; }
    zone.computeKinds();
  }

  yield "plan";

  // 8. The dungeon below: where its levels sit, and sinkholes into it.
  if (site?.dungeon) {
    zone.hasBelow = true;
    const at = planDef?.dungeonAt;
    zone.dungeonRect = at && rect ? { ox: rect.x + at[0], oy: rect.y + at[1], w: 48, d: 48 }
      : dungeonRectFor(zone.entrance || hub);
    if (planDef?.sinkholes !== false) {
      // A fall lands on level 1 at (x − ox, y − oy), on the nearest floor reachable from its anchor
      // (zones.js landing). So a sinkhole opens only over such floor, and you land right under it:
      // level 1 is generated here to know where (its own seed, so the same level you'll walk into).
      const r = zone.dungeonRect, want = rng.int(1, 3), below = landingFloor(run, site, wx, wy);
      for (let k = 0, made = 0; k < 200 && made < want; k++) {
        const x = rng.int(Math.max(r.ox, R.edgeKeep + 1), Math.min(r.ox + r.w, ZW - R.edgeKeep - 1) - 1);
        const y = rng.int(Math.max(r.oy, R.edgeKeep + 1), Math.min(r.oy + r.d, ZD - R.edgeKeep - 1) - 1);
        const i = x + y * ZW;
        if (plan[i] || reserved[i] || road[i] || water[i] || scenery[i] || base.cliff[i] || zone.get(x, y, FLOOR_Z - 1 + H[i] + 1)) continue;
        const e = zone.entrance || hub;
        if (distance(x - e.x, y - e.y) < 5 || NEXT4.some(([dx, dy]) => water[x + dx + (y + dy) * ZW])) continue;
        if (below && !below(x - r.ox, y - r.oy)) continue;
        for (let z = 0; z < zone.h; z++) zone.set(x, y, z, B.AIR);
        made++;
      }
    }
  }

  yield "dungeon";

  // 9. The anchor: the plan's own, else the reachable ground nearest the hub that reaches the most.
  zone.refresh();
  yield "refresh";
  zone.spawn = spawn || pickAnchor(zone, hub, scenery);
  zone.gen = { ports: base.ports.map((p) => ({ ...p, tiles: Array.from({ length: p.width }, (_, k) => portTile(p, k)) })),
               keyPoints, scenery, cliff: base.cliff, worldWater: base.water, plan, planAt, hub, entranceGated };
  return zone;
}

// Where a fall into level 1 of the site's dungeon lands on the spot itself: (lx, ly) → bool, true on
// floor (not stairs) reachable from the level's anchor under the map's step rules. Null for the legacy
// stack (its plan has no sinkholes) or a level that can't be generated.
function landingFloor(run, site, wx, wy) {
  if (site.dungeon.legacy) return null;
  const lvl = generateDungeonLevel(zoneSeed(run, wx, wy, 1), dungeonParams(run, site, 1));
  if (!lvl?.blocks) return null;
  if (!lvl.hasDerived) lvl.refresh();
  const { w, d, stand } = lvl, a = lvl.spawn;
  const dist = reachable(standWith(lvl, "open"), w, d, Math.floor(a.x), Math.floor(a.y), PLAYER_STEP_UP, PLAYER_DROP);
  return (lx, ly) => {
    if (lx < 0 || ly < 0 || lx >= w || ly >= d) return false;
    const i = lx + ly * w, g = lvl.get(lx, ly, FLOOR_Z - 1);
    return stand[i] >= 0 && dist[i] >= 0 && g !== B.STAIRS && g !== B.STAIRS_UP;
  };
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

// --- Validation (§5.3 item 9) -----------------------------------------------------------------------
// Needs zone.gen (what generation knew); a zone without it is checked for holes, heights, water and
// navigability only.
//
// Navigability is the map's (§5.3: "under the map's step rules", pathing.js): the ground is every column
// you can stand on that the map doesn't draw as a wall, and it is reached from the anchor with the map's
// steps, never across a wall. The map draws ground 4 or more blocks up as wall (world.js computeKinds), so
// cliff tops are 3D-only ground: counted apart (zone.ground3d), never against the zone. zone.navigability
// is the share reached.
// Water: every column holding water holds it at the datum, with rock under it (it never drops you a level).
export function validateSurface(zone) {
  const problems = [], { w, d } = zone, g = zone.gen;
  if (!zone.hasDerived) zone.refresh();
  const stand = zone.stand, kind = zone.kind, open = standWith(zone, "open");
  for (let i = 0; i < w * d; i++) if (kind[i] === KIND.WALL) open[i] = -1;   // the map never walks on a wall
  const ax = Math.floor(zone.spawn.x), ay = Math.floor(zone.spawn.y);
  const dist = reachable(open, w, d, ax, ay, PLAYER_STEP_UP, PLAYER_DROP);
  const scenery = g?.scenery || new Uint8Array(w * d);
  const ground = (i) => stand[i] >= 0 && !scenery[i] && kind[i] !== KIND.WALL;
  const reach = (x, y) => x >= 0 && y >= 0 && x < w && y < d && dist[x + y * w] >= 0;
  if (stand[ax + ay * w] < 0) problems.push("the anchor is not on standable ground");

  // Holes only over a dungeon, inside its rect; no standable ground above 12.
  const r = zone.dungeonRect;
  let total = 0, reached = 0, ground3d = 0, high = 0, badWater = 0;
  const blocks = zone.blocks, layer = w * d;
  for (let i = 0; i < w * d; i++) {
    const x = i % w, y = (i - x) / w;
    if (!blocks[i] && !blocks[i + (FLOOR_Z - 1) * layer]) {
      if (!zone.hasBelow || !r || x < r.ox || y < r.oy || x >= r.ox + r.w || y >= r.oy + r.d) { problems.push(`a hole at (${x}, ${y}) outside the dungeon's rect`); break; }
    }
    for (let z = 0; z < zone.h; z++) {
      const b = blocks[i + z * layer];
      if ((b === B.WATER_SHALLOW || b === B.WATER_DEEP) && z !== FLOOR_Z - 1) { badWater++; break; }
      if (z === FLOOR_Z - 1 && (b === B.WATER_SHALLOW || b === B.WATER_DEEP))
        for (let u = 0; u < z; u++) if (blocks[i + u * layer] !== B.ROCK) { badWater++; break; }
    }
    if (stand[i] >= 0 && !scenery[i] && stand[i] > FLOOR_Z + R.maxStand) high++;
    if (!ground(i)) { if (stand[i] >= 0 && !scenery[i]) ground3d++; continue; }
    total++;
    if (dist[i] >= 0) reached++;
  }
  if (high) problems.push(`${high} columns of standable ground more than ${R.maxStand} blocks up`);
  if (badWater) problems.push(`${badWater} columns of water off the datum or without rock under it`);
  const nav = total ? reached / total : 0;
  zone.navigability = nav;
  zone.ground3d = ground3d;
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
