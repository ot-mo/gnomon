// Zones: which ones exist, which one you're in, and moving between them (TECH_DESIGN §2.2, §5.1).
//
// A zone's address is "wx,wy,z": world tile (wx, wy), z = 0 its surface, z = 1..n the dungeon
// levels under it. game.zones caches every zone you've been to (a Map, key → Zone) and game.zone
// is the one you're in. Moves go up and down a column (z ± 1), and at z = 0 sideways: walking off an
// open edge of a surface zone into the next span's (tryWalkOff, §5.1).
//
// Where zones come from: ZONE_GENERATORS[type](game, addr) → Zone | null, registered by whoever
// builds that kind of zone (today world/legacy.js; later the surface generator and dungeon sites).
// A zone the save holds (ZONE_LOADER.has) is read back from it instead (ZONE_LOADER.load, save/save.js),
// asynchronously: changeZone returns a promise then, and prefetch and edges read it ahead (readZone).
//
// The apron (§6.1): a surface zone you are in carries voxel bands of its neighbours beyond its open
// sides (world.js). fillApron builds them on every entry, a band is rebuilt when its neighbour arrives
// in memory later, and prefetchNeighbours (a registered update) makes the neighbours ahead of time so
// that both the band and the swap at the edge use the real zone.
//
// Persistent state lives in game.state (plain JSON): uids, zonePatches, zoneLeft.
import { B, FLOOR_Z, APRON, APRON_SIDES, standWith } from "./world.js";
import { reachable, PLAYER_STEP_UP, PLAYER_DROP } from "./pathing.js";
import { emit, registerUpdate } from "./events.js";
import { hash, distance, makeRng } from "./rng.js";
import { spawnCreature, addCreature } from "./creatures.js";

export const zoneKey = (wx, wy, z) => `${wx},${wy},${z}`;
export function parseKey(key) {
  const [wx, wy, z] = String(key).split(",").map(Number);
  return { wx, wy, z };
}
const keyOf = (addr) => (typeof addr === "string" ? addr : addr.key || zoneKey(addr.wx, addr.wy, addr.z));

// (game, { wx, wy, z, key }) → a new, unsealed Zone, or null if nothing is there.
export const ZONE_GENERATORS = { surface: null, dungeon: null };
// The same work in stages (0D1): (game, addr) → an iterator; each next() does one stage and the last
// returns { done: true, value: Zone | null }, the zone ZONE_GENERATORS would make. 3D prefetch runs one
// stage per frame (prefetchNeighbours); a kind without one is made whole.
export const ZONE_STAGED = { surface: null, dungeon: null };
// (run, zone, side, neighbour | null) → the band for zone.apron[side] (world.js; gen/surface.js
// buildApronBand, registered by world/zonegen.js).
export const APRON_BUILDERS = { surface: null };
// (run, wx, wy) → an iterator that builds and keeps the world-function bands span (wx, wy)'s apron will want, one per
// next() (gen/apron.js apronBandSteps, registered by world/zonegen.js): a neighbour read from the save gets them a
// band a frame (game.bandJobs, prefetchNeighbours), as a staged make does with its stages (WS2a #3, at the WS9 merge).
export const APRON_STEPS = { surface: null };
// The save's seam (save/save.js; WS9 keeps it):
//   has(game, key) → bool          the store holds this zone (so it is read back, never generated again)
//   load(game, key) → Promise<Zone | null>   read and decode it (not yet in game.zones)
//   canEvict(game, key) → bool     may it leave memory? (its record has committed: write-behind, §7.3)
// While has is null, or says no, zones are only generated, exactly as before saves existed.
export const ZONE_LOADER = { load: null, has: null, canEvict: null };
// Zone patch operations: op → (game, zone, patch, { at, arrival }) => void. See addZonePatch.
export const PATCH_OPS = {};
export const ZONE_RULES = {
  keepDerived: 2,       // zones that keep light/stand arrays (current + previous; the current one's neighbours too)
  prefetchNear: APRON,  // 3D: make an open side's neighbour once you are this many tiles from that edge
  walkOffPast: 0.5,     // 3D: you cross once the body's centre is this far past the edge
  keepDormant: 24,      // zones kept in memory once saved (§2.2 RULES.zones.keep); older ones are evicted (evictDormant)
};
// What a solid edge says when you try it (once per visit and side); the world's own border has no terrain.
export const EDGE_RULES = { border: "Nothing lies past this edge of the world.", shifted: "The ground shifts underfoot." };
const SIDE_STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0], ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1] };
const MIRROR = { n: "s", s: "n", e: "w", w: "e" };

export function zoneState(game) {
  const st = (game.state ||= {});
  st.uids ||= {};
  st.zonePatches ||= {};
  st.zoneLeft ||= {};
  return st;
}

// --- Finding zones ------------------------------------------------------------------------------
export function cachedZone(game, key) { return game.zones?.get(keyOf(key)) || null; }

// Generate a zone now (synchronously) and keep it. null if nothing is generated there.
export function makeZone(game, addr) {
  const key = keyOf(addr);
  const { wx, wy, z } = parseKey(key);
  // A staged prefetch of this zone under way (you got to the edge first): finish it now.
  const job = game.prefetchJob;
  if (job && job.key === key) {
    game.prefetchJob = null;
    if (job.run === game.run) { let r; do r = job.it.next(); while (!r.done); return r.value ? adoptZone(game, r.value, key) : null; }
  }
  const gen = ZONE_GENERATORS[z === 0 ? "surface" : "dungeon"];
  const zone = gen ? gen(game, { wx, wy, z, key }) : null;
  return zone ? adoptZone(game, zone, key) : null;
}

// A newly made zone joins game.zones: sealed, and the band of your apron it borders rebuilt from it.
// (A zone read back from the save comes sealed, with its own dirty flag: seal = false.)
function adoptZone(game, zone, key, { seal = true } = {}) {
  const { wx, wy, z } = parseKey(key);
  if (seal) zone.seal();
  (game.zones ||= new Map()).set(key, zone);
  // A neighbour of the zone you are in has just arrived in memory: its band of your apron becomes a copy.
  const cur = game.zone;
  if (cur?.apron && z === 0 && cur.z === 0 && Math.abs(wx - cur.wx) <= 1 && Math.abs(wy - cur.wy) <= 1 && zone !== cur) {
    const side = Object.keys(SIDE_STEP).find((s) => SIDE_STEP[s][0] === wx - cur.wx && SIDE_STEP[s][1] === wy - cur.wy);
    if (side && cur.apron[side]) fillApron(game, cur, [side]);
  }
  return zone;
}

// One stage of a staged make: starts game.prefetchJob for `key` if none, runs one stage, and adopts the
// zone when the last one is done. → the zone once made, else null.
function stepZone(game, key) {
  let job = game.prefetchJob;
  if (job && (job.run !== game.run || cachedZone(game, job.key))) job = game.prefetchJob = null;   // a new run, or made meanwhile
  if (!job) {
    const { wx, wy, z } = parseKey(key), staged = ZONE_STAGED[z === 0 ? "surface" : "dungeon"];
    if (!staged) return makeZone(game, key);
    job = game.prefetchJob = { key, run: game.run, it: staged(game, { wx, wy, z, key }), stages: 0 };
  }
  const r = job.it.next();
  job.stages++;
  if (!r.done) return null;
  game.prefetchJob = null;
  return r.value ? adoptZone(game, r.value, job.key) : null;
}

// Memory first, then the save (ZONE_LOADER), then generation.
export async function getZone(game, addr) {
  const key = keyOf(addr);
  const cached = cachedZone(game, key);
  if (cached) return cached;
  if (ZONE_LOADER.has?.(game, key)) {
    const stored = await readZone(game, key);
    if (stored) return stored;
  }
  return makeZone(game, key);
}

// Read a stored zone into game.zones (once: a read under way is shared). → Promise<Zone | null>; null when
// the store had none, or a new run started meanwhile.
export function readZone(game, key) {
  const reads = (game.zoneReads ||= new Map());
  if (reads.has(key)) return reads.get(key);
  const run = game.run;
  const done = Promise.resolve(ZONE_LOADER.load(game, key)).then((zone) => {
    reads.delete(key);
    if (!zone || game.run !== run) return null;
    return cachedZone(game, key) || adoptZone(game, zone, key, { seal: false });
  }, (e) => { reads.delete(key); throw e; });
  reads.set(key, done);
  return done;
}
const readAhead = (game, key) => readZone(game, key).then((zone) => {
  if (!zone || zone === game.zone || game.zone?.z !== 0 || zone.z !== 0) return;
  zone.ensureDerived();   // a neighbour: ready to cross into, its far bands built ahead (one a frame)
  if (APRON_STEPS.surface) (game.bandJobs ||= []).push({ run: game.run, key, it: APRON_STEPS.surface(game.run, zone.wx, zone.wy) });
}).catch((e) => console.error(`reading zone ${key} from the save:`, e));

// A dormant zone leaves memory (§2.2). Refused for the zone you are in, and unless the save says it may
// (ZONE_LOADER.canEvict: its record has committed, write-behind §7.3); with no save at all, always (nothing
// would bring it back as it was). → whether it left.
export function evictZone(game, key) {
  if (!game.zones?.has(key) || game.zone?.key === key) return false;
  if (!ZONE_LOADER.load || !ZONE_LOADER.canEvict?.(game, key)) return false;
  game.zones.delete(key);
  const k = game.zoneLru?.indexOf(key) ?? -1;
  if (k >= 0) game.zoneLru.splice(k, 1);
  return true;
}
// Keep at most `keep` dormant zones that may leave: the ones left longest ago go first; the zone you are in
// and its straight neighbours (prefetched for the edges) stay. → the keys evicted.
export function evictDormant(game, keep = ZONE_RULES.keepDormant) {
  const cur = game.zone, left = zoneState(game).zoneLeft;
  const near = (z) => cur && z.z === 0 && cur.z === 0 && Math.abs(z.wx - cur.wx) + Math.abs(z.wy - cur.wy) === 1;
  const dormant = [...(game.zones || new Map()).values()].filter((z) => z !== cur && !near(z) && ZONE_LOADER.canEvict?.(game, z.key));
  if (dormant.length <= keep) return [];
  dormant.sort((a, b) => (left[a.key] ?? -1) - (left[b.key] ?? -1));
  return dormant.slice(0, dormant.length - keep).map((z) => z.key).filter((key) => evictZone(game, key));
}

// The level under / over a zone (same world tile), or null.
export function zoneBelow(game, zone) {
  return zone.hasBelow ? { wx: zone.wx, wy: zone.wy, z: zone.z + 1, key: zoneKey(zone.wx, zone.wy, zone.z + 1) } : null;
}
export function zoneAbove(game, zone) {
  return zone.z > 0 ? { wx: zone.wx, wy: zone.wy, z: zone.z - 1, key: zoneKey(zone.wx, zone.wy, zone.z - 1) } : null;
}
// Where the 48×48 dungeon levels sit under a surface zone (§5.5): a fall at (fx, fy) on the
// surface lands at (fx − ox, fy − oy) on level 1. Zero for a surface without a dungeonRect, and
// for a dungeon level (the levels line up 1:1), so every fall can ask (game.js fallTo).
export function dungeonOffset(game, surfaceZone) {
  const r = surfaceZone?.type === "surface" ? surfaceZone.dungeonRect : null;
  return r ? { ox: r.ox, oy: r.oy } : { ox: 0, oy: 0 };
}

// --- Moving between zones -----------------------------------------------------------------------
// Go to another zone. When it's in memory (or can be generated right away) the swap happens now
// and this returns true; false if there's nothing there. A zone that has to be read back from
// storage returns a promise instead (WS9; the transition screen covers the wait from 0D1).
// arrival: { how, fx, fy, side, along, fromStand, at, rng, yaw } (see arrivalPoint).
// The message ("You descend the stairs...") is logged only once the zone is there to go to.
export function changeZone(game, addr, arrival = {}, message = "") {
  const key = keyOf(addr);
  const go = (zone) => {
    if (message) game.log(message, [255, 220, 140]);
    enterZone(game, zone, arrival);
  };
  const cached = cachedZone(game, key), stored = !cached && !!ZONE_LOADER.has?.(game, key);
  const now = cached || (stored ? null : makeZone(game, key));
  if (now) { go(now); return true; }
  if (!stored) return false;
  if (game.zoneLoading === key && game.zoneLoad) return game.zoneLoad;   // (asked again while it is read)
  const run = game.run;
  game.zoneLoading = key;
  return (game.zoneLoad = getZone(game, key).then((zone) => {
    if (game.zoneLoading === key) { game.zoneLoading = null; game.zoneLoad = null; }
    if (!zone || game.run !== run) return false;
    go(zone);
    return true;
  }));
}

// Arrive in a zone: leave the old one, place the player, apply pending patches, and start afresh
// (no path, no route, no floating numbers). Events: zone:leave (old), zone:prepare (before you're
// placed: a gate that opens from this side, loot decided on arrival), zone:enter (after).
export function enterZone(game, zone, arrival = {}) {
  const st = zoneState(game), from = game.zone, how = arrival.how || "load";
  if (from && from !== zone) {
    from.lastTime = game.time;
    st.zoneLeft[from.key] = game.time;
    emit(game, "zone:leave", { zone: from, side: arrival.side ?? null, how, to: zone.key });
  }
  (game.zones ||= new Map()).set(zone.key, zone);
  zone.ensureDerived();
  if (zone.type === "surface" && game.run && APRON_BUILDERS.surface) fillApron(game, zone);
  game.edgeTold = null;
  const left = st.zoneLeft[zone.key];
  const away = left === undefined ? null : game.time - left;
  game.zone = zone;
  emit(game, "zone:prepare", { zone, arrival, from });
  const at = arrivalPoint(zone, how, arrival);
  game.arrival = at;   // where (and how) you were placed last
  const p = game.player;
  p.x = at.x; p.y = at.y; p.z = at.z;
  if (!arrival.keepMotion) p.vz = 0;   // over an edge in 3D you keep falling or jumping as you were
  if (!arrival.keepFacing) { p.yaw = at.yaw ?? p.yaw; p.pitch = 0; }
  applyPatches(game, zone, at);
  game.flow = null;
  game.travel = null;
  game.effects = [];          // damage numbers and splashes belong to the zone you left
  game.confirmJump = -1;
  keepDerived(game, ZONE_RULES.keepDerived);
  // (A load returns you to a zone you were in: never its first visit.)
  emit(game, "zone:enter", { zone, arrival: at, how, away, first: how !== "load" && away === null && from !== zone, from: from?.key ?? null });
}

// Only the most recent zones keep their light/stand/kind/look arrays (about 0.2 MB each for a
// dungeon level, 0.6 MB for a surface zone); older ones drop them and rebuild on re-entry. That
// includes zones made without being entered (debug.zone): they keep their arrays until the next zone
// change, then drop them unless they are in the LRU by then. The four straight neighbours of a surface
// zone you are in keep theirs too (prefetched), so crossing an edge never waits for a refresh().
export function keepDerived(game, n = 2) {
  const lru = (game.zoneLru ||= []);
  const cur = game.zone?.key;
  if (cur) { const k = lru.indexOf(cur); if (k >= 0) lru.splice(k, 1); lru.unshift(cur); }
  lru.splice(Math.max(1, n));
  const near = (z) => game.zone && z.z === 0 && game.zone.z === 0 && Math.abs(z.wx - game.zone.wx) + Math.abs(z.wy - game.zone.wy) === 1;
  for (const [key, z] of game.zones || []) if (z !== game.zone && z.hasDerived && !lru.includes(key) && !near(z)) z.dropDerived();
}

// --- Edges, the apron and prefetch (TECH_DESIGN §5.1, §6.1, §2.2) ------------------------------------
// The surface zone beyond `side` of a surface zone ("n" | "e" | "s" | "w", or a corner "ne" | "nw" |
// "se" | "sw"), as { wx, wy, z: 0, key }, or null when that way is shut. A straight side is open when
// zone.edges says so (world.edgeOpen: both spans exist and have open edges). A corner is open when both
// of its sides are and the diagonal span can be walked into from one of them.
export function neighbourAddr(game, zone, side) {
  if (!zone || zone.type !== "surface" || zone.z !== 0) return null;
  const step = SIDE_STEP[side];
  if (!step) return null;
  const [dx, dy] = step, wx = zone.wx + dx, wy = zone.wy + dy;
  if (side.length === 1) return zone.edges[side] ? { wx, wy, z: 0, key: zoneKey(wx, wy, 0) } : null;
  const ns = side[0], ew = side[1], world = game.run?.world;
  if (!zone.edges[ns] || !zone.edges[ew] || !world) return null;
  if (!world.edgeOpen(zone.wx + dx, zone.wy, ns) && !world.edgeOpen(zone.wx, zone.wy + dy, ew)) return null;
  return { wx, wy, z: 0, key: zoneKey(wx, wy, 0) };
}

// Build zone.apron (every side and corner, or only those in `sides`): each open one through
// APRON_BUILDERS.surface, from the neighbour zone when it is in memory, else from the world functions.
export function fillApron(game, zone, sides = APRON_SIDES) {
  const build = APRON_BUILDERS.surface;
  if (!build || zone.type !== "surface" || !game.run) return;
  const ap = (zone.apron ||= { n: null, e: null, s: null, w: null, ne: null, nw: null, se: null, sw: null });
  for (const side of sides) {
    const addr = neighbourAddr(game, zone, side);
    ap[side] = addr ? build(game.run, zone, side, cachedZone(game, addr.key)) : null;
  }
}

// Walk off `side` of the surface zone you are in, `along` tiles along that edge (x for n and s, y for e
// and w), standing at opts.fromStand (default: where you stand). An open edge takes you into the
// neighbour at once, without the transition screen (the HUD toasts its name on zone:enter); returns
// true. A solid edge or the world's border stays shut and says why, once per visit and side (the
// neighbour terrain's edgeMessage); returns false. opts.exact = { x, y, z }: your exact point in the
// neighbour's coordinates (3D), kept when it is within the rules (arrivalPoint "edge"); facing and
// vertical speed are kept (opts.keepMotion, default true).
export function tryWalkOff(game, side, along, opts = {}) {
  const zone = game.zone, p = game.player;
  if (!zone || zone.type !== "surface" || !MIRROR[side]) return false;
  const addr = neighbourAddr(game, zone, side);
  // A neighbour the save holds is read first (a moment, asynchronously; prefetch usually has by now): until
  // it is in memory you stay this side, and the next step or frame crosses.
  if (addr && !cachedZone(game, addr.key) && ZONE_LOADER.has?.(game, addr.key)) { readAhead(game, addr.key); return false; }
  const target = addr && (cachedZone(game, addr.key) || makeZone(game, addr.key));
  if (!target) {
    const told = `${zone.key}:${side}`;
    if (game.edgeTold !== told) {
      game.edgeTold = told;
      const [dx, dy] = SIDE_STEP[side], t = game.run?.world.tileAt(zone.wx + dx, zone.wy + dy);
      const T = t && game.run.world.terrains[t.terrain];
      game.log(t ? T?.edgeMessage || `You can't go on into ${T?.name || t.terrain} from here.` : EDGE_RULES.border, [170, 170, 170]);
    }
    return false;
  }
  const fromStand = opts.fromStand ?? Math.round(p.z);
  const ok = changeZone(game, addr.key, { how: "edge", side, along, fromStand, exact: opts.exact || null,
                                          keepFacing: true, keepMotion: opts.keepMotion !== false });
  if (ok === true) {
    if (game.arrival?.shifted) game.log(EDGE_RULES.shifted, [170, 170, 170]);   // §5.1: no tile within the rules
  }
  return ok === true;
}

// Make the neighbours you may walk into next before you reach them, so the swap at the edge happens in
// the same frame and the apron shows their real ground. On the map (time stands still between actions)
// every missing open neighbour at once; in 3D only sides within ZONE_RULES.prefetchNear tiles, one zone at
// a time and one stage of it per frame (ZONE_STAGED: 0D1 measured 12-38 ms for a whole surface zone in
// headless Chromium; 0-8.5 ms per stage). Never in the frame that swapped zones (0D1: arriving beside
// another edge made that neighbour in the swap's own frame, 70-220 ms in headless Chromium): the first call after a swap only
// notes the new zone (game.prefetchSeen), and making starts on the next frame. Registered as an update below.
export function prefetchNeighbours(game) {
  const zone = game.zone;
  if (!zone || zone.type !== "surface" || !game.run || game.zoneLoading) return 0;
  if (game.prefetchSeen !== zone) { game.prefetchSeen = zone; return 0; }
  const p = game.player, near = ZONE_RULES.prefetchNear, map = game.mode === "map";
  if (!map && game.prefetchJob && game.prefetchJob.run === game.run && !cachedZone(game, game.prefetchJob.key))
    return stepZone(game, game.prefetchJob.key) ? 1 : 0;   // the zone under way first
  if (!map && game.bandJobs?.length) {   // then the far bands of a neighbour read from the save, one a frame
    const job = game.bandJobs[0];
    if (job.run !== game.run || job.it.next().done) game.bandJobs.shift();
    return 0;
  }
  let made = 0;
  for (const side of ["n", "e", "s", "w"]) {
    const addr = neighbourAddr(game, zone, side);
    if (!addr || cachedZone(game, addr.key)) continue;
    const gap = side === "n" ? p.y : side === "s" ? zone.d - p.y : side === "w" ? p.x : zone.w - p.x;
    if (ZONE_LOADER.has?.(game, addr.key)) { readAhead(game, addr.key); continue; }   // the save holds it: read it, never make it
    if (!map && gap > near) continue;
    if (map) { if (makeZone(game, addr.key)) made++; continue; }
    if (stepZone(game, addr.key)) made++;
    break;
  }
  return made;
}
registerUpdate("prefetchNeighbours", (game) => { prefetchNeighbours(game); }, { modes: ["explore", "map"] });

// --- Where you appear ---------------------------------------------------------------------------
//   "down"     came down the stairs: beside this level's stairs up
//   "up"       came up the stairs: beside this zone's stairs down (or its entrance); the temple's
//              returnPoint (in front of Maren) where it has one
//   "fall"     fell through a pit or deep water at (fx, fy) above: the nearest spot to that, out of
//              the places reachable from the zone's anchor (never sealed in a locked room)
//   "teleport" like a fall, at (fx, fy) or, if not given, a random point drawn from opts.rng
//              (opts.anchor: reachable from there instead of the zone's anchor; opts.ok(x, y): a tile the
//              caller can't use, a creature's, is skipped; opts.strict: null when no reachable tile will do,
//              instead of any floor at all)
//   "edge"     walked off the neighbour's `side` at `along` (tryWalkOff): the mirrored tile, or your
//              exact point (opts.exact) when it is that tile
//   "travel" | "start" | "load"   the anchor (spawn), or opts.at
// The facing for "fall" and "teleport" comes from the caller (opts.yaw, or opts.rng), so
// generation never needs Math.random.
export function arrivalPoint(zone, how, opts = {}) {
  if (opts.at) return { ...opts.at };
  if (how === "down" && zone.upStairs) return beside(zone, zone.upStairs);
  if (how === "up" && zone.returnPoint) return { ...zone.returnPoint };   // the temple: by Maren
  if (how === "up" && (zone.stairs || zone.entrance)) return beside(zone, zone.stairs || zone.entrance);
  if (how === "fall") return landing(zone, opts.fx ?? zone.spawn.x, opts.fy ?? zone.spawn.y, opts);
  if (how === "teleport") {
    const fx = opts.fx ?? 2 + opts.rng() * (zone.w - 4);
    const fy = opts.fy ?? 2 + opts.rng() * (zone.d - 4);
    return landing(zone, fx, fy, opts);
  }
  if (how === "edge") return edgeArrival(zone, opts);
  return { ...zone.spawn };
}

const isStairs = (zone, x, y) => { const g = zone.get(x, y, FLOOR_Z - 1); return g === B.STAIRS || g === B.STAIRS_UP; };
const NEXT_TO = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

// A free spot next to stairs, facing away from them: plain floor at the datum first (as the
// dungeon generator always leaves one), else any spot within a block of the stairs' own height.
function beside(zone, s) {
  const { w, d, stand } = zone;
  const ok = (x, y) => x >= 0 && y >= 0 && x < w && y < d && !isStairs(zone, x, y);
  for (const [ox, oy] of NEXT_TO) {
    const x = s.x + ox, y = s.y + oy;
    if (ok(x, y) && stand[x + y * w] === FLOOR_Z) return { x: x + 0.5, y: y + 0.5, z: FLOOR_Z, yaw: Math.atan2(oy, ox) };
  }
  const sz = stand[s.x + s.y * w] >= 0 ? stand[s.x + s.y * w] : FLOOR_Z;
  for (const [ox, oy] of NEXT_TO) {
    const x = s.x + ox, y = s.y + oy, z = ok(x, y) ? stand[x + y * w] : -1;
    if (z >= 0 && Math.abs(z - sz) <= 1) return { x: x + 0.5, y: y + 0.5, z, yaw: Math.atan2(oy, ox) };
  }
  return { ...zone.spawn };
}

// The nearest spot to (fx, fy) you can stand on and walk to from the zone's anchor.
function landing(zone, fx, fy, opts = {}) {
  const { w, d, stand } = zone;
  const anchor = opts.anchor || zone.spawn;
  const dist = reachable(standWith(zone, "open"), w, d, Math.floor(anchor.x), Math.floor(anchor.y), PLAYER_STEP_UP, PLAYER_DROP);
  const nearest = (reachableOnly) => {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < w * d; i++) {
      if ((reachableOnly && dist[i] < 0) || stand[i] < 0) continue;
      const x = i % w, y = (i - x) / w;
      if (isStairs(zone, x, y) || (opts.ok && !opts.ok(x, y))) continue;
      const dd = distance(x + 0.5 - fx, y + 0.5 - fy);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    return best;
  };
  let best = nearest(true);
  if (best < 0 && opts.strict) return null;
  if (best < 0) best = nearest(false);   // an anchor walled in (never in a valid level): any floor at all
  if (best < 0) return { ...zone.spawn };
  const x = best % w, y = (best - x) / w;
  const yaw = opts.yaw ?? (opts.rng ? opts.rng() * Math.PI * 2 : 0);
  return { x: x + 0.5, y: y + 0.5, z: stand[best], yaw };
}

// Walking in over an edge: you left the neighbour by opts.side ("n" | "e" | "s" | "w") at
// opts.along, standing at opts.fromStand. The mirrored tile on this side, or the nearest tile
// within 3 of the edge and ±4 along whose height is within 1 of where you were, reachable from
// the anchor (the mirrored tile need not be); else the nearest reachable spot at all (shifted: true).
// Deep water on a surface counts as standing at the datum (every body floats there), so a swimmer
// crosses a river's channel straight. With opts.exact (your point in this zone's coordinates, from
// the 3D view), that point itself whenever you are no more than a block below the mirrored column's
// ground (above it you are in the air, and keep flying or falling where you were), so the camera
// doesn't move. Past the far border along the edge (crossing near an open corner) the point is kept
// as it is: the corner's apron is there, and the next crossing takes you on into the diagonal span.
function edgeArrival(zone, { side, along = 0, fromStand = FLOOR_Z, yaw, exact } = {}) {
  const { w, d, stand } = zone;
  const dist = reachFromAnchor(zone);
  const a = Math.floor(along);
  const tx = side === "e" ? 0 : side === "w" ? w - 1 : Math.max(0, Math.min(w - 1, a));
  const ty = side === "s" ? 0 : side === "n" ? d - 1 : Math.max(0, Math.min(d - 1, a));
  const inBand = (x, y) => (side === "e" ? x <= 2 : side === "w" ? x >= w - 3 : side === "s" ? y <= 2 : y >= d - 3) &&
    Math.abs((side === "e" || side === "w" ? y : x) - a) <= 4;
  const floats = zone.type === "surface";
  const standAt = (i) => stand[i] >= 0 ? stand[i]
    : floats && zone.blocks[i + (FLOOR_Z - 1) * w * d] === B.WATER_DEEP ? FLOOR_Z : -1;
  // The mirrored tile counts even when the anchor can't reach it: you can always step back the way you came.
  const mirror = tx + ty * w;
  if (exact && standAt(mirror) >= 0 && !isStairs(zone, tx, ty) && exact.z >= standAt(mirror) - 1) {
    const acrossX = side === "e" || side === "w";
    const ex = acrossX ? Math.min(w - 1e-3, Math.max(0, exact.x)) : exact.x;
    const ey = acrossX ? exact.y : Math.min(d - 1e-3, Math.max(0, exact.y));
    return { x: ex, y: ey, z: exact.z, yaw: yaw ?? zone.spawn.yaw, shifted: false, exact: true };
  }
  let best = -1, bestD = Infinity, any = -1, anyD = Infinity;
  for (let i = 0; i < w * d; i++) {
    const si = standAt(i);
    if ((dist[i] < 0 && i !== mirror) || si < 0) continue;
    const x = i % w, y = (i - x) / w;
    if (isStairs(zone, x, y)) continue;
    const dd = distance(x - tx, y - ty);
    if (dd < anyD && dist[i] >= 0) { anyD = dd; any = i; }
    if (inBand(x, y) && Math.abs(si - fromStand) <= 1 && dd < bestD) { bestD = dd; best = i; }
  }
  const i = best >= 0 ? best : any;
  if (i < 0) return { ...zone.spawn, shifted: true };
  const x = i % w, y = (i - x) / w;
  return { x: x + 0.5, y: y + 0.5, z: standAt(i), yaw: yaw ?? zone.spawn.yaw, shifted: best < 0 };
}

// What's reachable from the zone's anchor (pathing.reachable over the "open" door rule), kept on the
// zone until its blocks change (navVersion) or it drops its derived arrays.
function reachFromAnchor(zone) {
  const ax = Math.floor(zone.spawn.x), ay = Math.floor(zone.spawn.y), r = zone.reach;
  if (r && r.v === zone.navVersion && r.x === ax && r.y === ay) return r.dist;
  const dist = reachable(standWith(zone, "open"), zone.w, zone.d, ax, ay, PLAYER_STEP_UP, PLAYER_DROP);
  zone.reach = { v: zone.navVersion, x: ax, y: ay, dist };
  return dist;
}

// --- Zone patches -------------------------------------------------------------------------------
// Quests, encounters and followers put things into zones, visited or not:
//   addZonePatch(game, "3,4,1", { op: "spawnCreature", type: "goblin", uid: "legend:h3",
//                                 relativeTo: "arrival", dist: [8, 12] })
// A patch waits in game.state.zonePatches until you next enter that zone (or applies at once if
// you're in it), then runs PATCH_OPS[op] and is removed. Ids already in zone.appliedPatches are
// skipped, so a patch never applies twice. A patch with a uid first claims it (claimUid): a uid
// that lives in another zone or is dead is not spawned again.
// Position: { x, y } as given; or relativeTo "arrival" (a reachable spot dist[0]..dist[1] tiles
// from where you arrive, default 8-12) or "entrance" (1-3 tiles from the stairs or entrance).
export function addZonePatch(game, key, patch) {
  const st = zoneState(game);
  st.patchSeq = (st.patchSeq || 0) + 1;
  const p = { ...patch, id: patch.id || `p${st.patchSeq}` };
  (st.zonePatches[key] ||= []).push(p);
  const zone = game.zone;
  if (zone && zone.key === key) {
    const pl = game.player;
    applyPatches(game, zone, { x: pl.x, y: pl.y, z: pl.z });
  }
  return p.id;
}

function applyPatches(game, zone, arrival) {
  const st = zoneState(game), list = st.zonePatches[zone.key];
  if (!list?.length) return;
  for (const p of list) {
    if (zone.appliedPatches[p.id]) continue;
    const op = PATCH_OPS[p.op];
    if (!op) continue;   // nobody handles it yet: it stays pending
    zone.appliedPatches[p.id] = 1;
    if (p.uid && p.op !== "removeUid" && !claimUid(game, p.uid, zone.key)) continue;
    op(game, zone, p, { at: patchSpot(zone, p, arrival), arrival });
  }
  const left = list.filter((p) => !zone.appliedPatches[p.id]);
  if (left.length) st.zonePatches[zone.key] = left;
  else delete st.zonePatches[zone.key];
}

function patchSpot(zone, p, arrival) {
  const { w, d, stand } = zone;
  if (!p.relativeTo) {
    if (p.x === undefined) return null;
    const s = stand[Math.floor(p.x) + Math.floor(p.y) * w];
    return { x: Math.floor(p.x), y: Math.floor(p.y), z: p.z ?? (s >= 0 ? s : FLOOR_Z) };
  }
  const o = p.relativeTo === "arrival" ? arrival : zone.entrance || zone.stairs || zone.spawn;
  const [lo, hi] = p.dist || (p.relativeTo === "arrival" ? [8, 12] : [1, 3]);
  const ox = Math.floor(o.x), oy = Math.floor(o.y);
  const dist = reachable(stand, w, d, ox, oy, PLAYER_STEP_UP, PLAYER_DROP);
  const inRange = [], all = [];
  for (let i = 0; i < w * d; i++) {
    if (dist[i] < 0 || stand[i] < 0) continue;
    const x = i % w, y = (i - x) / w, r = distance(x - ox, y - oy);
    if (isStairs(zone, x, y) || r < 1) continue;
    all.push([i, Math.abs(r - (lo + hi) / 2)]);
    if (r >= lo && r <= hi) inRange.push(i);
  }
  // The same patch always picks the same spot: a hash of its id chooses among the candidates.
  const salt = patchSalt(p);
  const pick = inRange.length ? inRange[Math.floor(hash(salt, inRange.length, 11) * inRange.length)]
    : all.sort((a, b) => a[1] - b[1])[0]?.[0];
  if (pick === undefined) return { x: ox, y: oy, z: Math.max(0, stand[ox + oy * w]) };
  return { x: pick % w, y: Math.floor(pick / w), z: stand[pick] };
}

const patchSalt = (p) => [...String(p.id)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

PATCH_OPS.setFlag = (game, zone, p) => { zone.flags[p.flag] = p.value ?? true; };
// { op: "spawnCreature", type, uid?, state?, level? (the zone's), elite?, name?, talk?: { dialogue, state }, position }
// Its looks come from a stream seeded by the zone and the patch id, so the same patch spawns the same creature.
PATCH_OPS.spawnCreature = (game, zone, p, { at }) => {
  if (!at) return;
  const rng = makeRng((zone.seed ^ patchSalt(p)) >>> 0);
  addCreature(zone, spawnCreature(p.type, at.x, at.y, at.z, { rng, uid: p.uid ?? null, state: p.state, level: p.level ?? zone.level,
                                                             elite: p.elite ?? null, name: p.name, talk: p.talk }));
};
PATCH_OPS.removeUid = (game, zone, p) => {
  zone.creatures = zone.creatures.filter((c) => c.uid !== p.uid);
  zone.items = zone.items.filter((it) => it.uid !== p.uid);
};

// --- Unique ids ---------------------------------------------------------------------------------
// state.uids: uid → the zone key it lives in, or "dead". A uid lives in at most one zone.
export function claimUid(game, uid, key) {
  const where = zoneState(game).uids[uid];
  if (where === undefined || where === key) { zoneState(game).uids[uid] = key; return true; }
  return false;
}
export function uidWhere(game, uid) { return zoneState(game).uids[uid] ?? null; }
export function killUid(game, uid) { zoneState(game).uids[uid] = "dead"; }
