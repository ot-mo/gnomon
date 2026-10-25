// Zones: which ones exist, which one you're in, and moving between them (TECH_DESIGN §2.2, §5.1).
//
// A zone's address is "wx,wy,z": world tile (wx, wy), z = 0 its surface, z = 1..n the dungeon
// levels under it. game.zones caches every zone you've been to (a Map, key → Zone) and game.zone
// is the one you're in. Moves go up and down a column (z ± 1); walking off a surface zone's edge
// into the next tile comes in 0A2.
//
// Where zones come from: ZONE_GENERATORS[type](game, addr) → Zone | null, registered by whoever
// builds that kind of zone (today world/legacy.js; later the surface generator and dungeon sites).
// A saved zone would come from ZONE_LOADER.load (WS9) before that.
//
// Persistent state lives in game.state (plain JSON): uids, zonePatches, zoneLeft.
import { B, FLOOR_Z, standWith } from "./world.js";
import { reachable, PLAYER_STEP_UP, PLAYER_DROP } from "./pathing.js";
import { emit } from "./events.js";
import { hash, distance } from "./rng.js";

export const zoneKey = (wx, wy, z) => `${wx},${wy},${z}`;
export function parseKey(key) {
  const [wx, wy, z] = String(key).split(",").map(Number);
  return { wx, wy, z };
}
const keyOf = (addr) => (typeof addr === "string" ? addr : addr.key || zoneKey(addr.wx, addr.wy, addr.z));

// (game, { wx, wy, z, key }) → a new, unsealed Zone, or null if nothing is there.
export const ZONE_GENERATORS = { surface: null, dungeon: null };
// (run, zone, side) → fills zone.apron[side] (0A2 stub, WS2).
export const APRON_BUILDERS = { surface: null };
// WS9: async (game, key) → a stored Zone or null. While it is null, zones are only generated.
export const ZONE_LOADER = { load: null };
// Zone patch operations: op → (game, zone, patch, { at, arrival }) => void. See addZonePatch.
export const PATCH_OPS = {};
export const ZONE_RULES = { keepDerived: 2 };   // zones that keep light/stand arrays (current + previous)

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
  const gen = ZONE_GENERATORS[z === 0 ? "surface" : "dungeon"];
  const zone = gen ? gen(game, { wx, wy, z, key }) : null;
  if (!zone) return null;
  zone.seal();
  (game.zones ||= new Map()).set(key, zone);
  return zone;
}

// Memory first, then storage (WS9), then generation.
export async function getZone(game, addr) {
  const key = keyOf(addr);
  const cached = cachedZone(game, key);
  if (cached) return cached;
  if (ZONE_LOADER.load) {
    const stored = await ZONE_LOADER.load(game, key);
    if (stored) { game.zones.set(key, stored); return stored; }
  }
  return makeZone(game, key);
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
  const now = cachedZone(game, key) || (ZONE_LOADER.load ? null : makeZone(game, key));
  if (now) { go(now); return true; }
  if (!ZONE_LOADER.load) return false;
  game.zoneLoading = key;
  return getZone(game, key).then((zone) => {
    game.zoneLoading = null;
    if (zone) go(zone);
    return !!zone;
  });
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
  const left = st.zoneLeft[zone.key];
  const away = left === undefined ? null : game.time - left;
  game.zone = zone;
  emit(game, "zone:prepare", { zone, arrival, from });
  const at = arrivalPoint(zone, how, arrival);
  const p = game.player;
  p.x = at.x; p.y = at.y; p.z = at.z; p.vz = 0;
  if (!arrival.keepFacing) { p.yaw = at.yaw ?? p.yaw; p.pitch = 0; }
  applyPatches(game, zone, at);
  game.flow = null;
  game.travel = null;
  game.effects = [];          // damage numbers and splashes belong to the zone you left
  game.confirmJump = -1;
  keepDerived(game, ZONE_RULES.keepDerived);
  emit(game, "zone:enter", { zone, arrival: at, how, away, first: away === null && from !== zone });
}

// Only the most recent zones keep their light/stand/kind/look arrays (about 0.2 MB each for a
// dungeon level, 0.6 MB for a surface zone); older ones drop them and rebuild on re-entry. That
// includes zones made without being entered (debug.zone, 0A2's prefetch): they keep their arrays
// until the next zone change, then drop them unless they are in the LRU by then.
export function keepDerived(game, n = 2) {
  const lru = (game.zoneLru ||= []);
  const cur = game.zone?.key;
  if (cur) { const k = lru.indexOf(cur); if (k >= 0) lru.splice(k, 1); lru.unshift(cur); }
  lru.splice(Math.max(1, n));
  for (const [key, z] of game.zones || []) if (z !== game.zone && z.hasDerived && !lru.includes(key)) z.dropDerived();
}

// --- Where you appear ---------------------------------------------------------------------------
//   "down"     came down the stairs: beside this level's stairs up
//   "up"       came up the stairs: beside this zone's stairs down (or its entrance)
//   "fall"     fell through a pit or deep water at (fx, fy) above: the nearest spot to that, out of
//              the places reachable from the zone's anchor (never sealed in a locked room)
//   "teleport" like a fall, at (fx, fy) or, if not given, a random point drawn from opts.rng
//   "edge"     walked off the neighbour's `side` at `along` (0A2 uses it): the mirrored tile
//   "travel" | "start" | "load"   the anchor (spawn), or opts.at
// The facing for "fall" and "teleport" comes from the caller (opts.yaw, or opts.rng), so
// generation never needs Math.random.
export function arrivalPoint(zone, how, opts = {}) {
  if (opts.at) return { ...opts.at };
  if (how === "down" && zone.upStairs) return beside(zone, zone.upStairs);
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
      if (isStairs(zone, x, y)) continue;
      const dd = distance(x + 0.5 - fx, y + 0.5 - fy);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    return best;
  };
  let best = nearest(true);
  if (best < 0) best = nearest(false);   // an anchor walled in (never in a valid level): any floor at all
  if (best < 0) return { ...zone.spawn };
  const x = best % w, y = (best - x) / w;
  const yaw = opts.yaw ?? (opts.rng ? opts.rng() * Math.PI * 2 : 0);
  return { x: x + 0.5, y: y + 0.5, z: stand[best], yaw };
}

// Walking in over an edge: you left the neighbour by opts.side ("n" | "e" | "s" | "w") at
// opts.along, standing at opts.fromStand. The mirrored tile on this side, or the nearest tile
// within 3 of the edge and ±4 along whose height is within 1 of where you were, reachable from
// the anchor; else the nearest reachable spot at all (shifted: true).
function edgeArrival(zone, { side, along = 0, fromStand = FLOOR_Z, yaw } = {}) {
  const { w, d, stand } = zone;
  const dist = reachable(standWith(zone, "open"), w, d, Math.floor(zone.spawn.x), Math.floor(zone.spawn.y), PLAYER_STEP_UP, PLAYER_DROP);
  const a = Math.floor(along);
  const tx = side === "e" ? 0 : side === "w" ? w - 1 : Math.max(0, Math.min(w - 1, a));
  const ty = side === "s" ? 0 : side === "n" ? d - 1 : Math.max(0, Math.min(d - 1, a));
  const inBand = (x, y) => (side === "e" ? x <= 2 : side === "w" ? x >= w - 3 : side === "s" ? y <= 2 : y >= d - 3) &&
    Math.abs((side === "e" || side === "w" ? y : x) - a) <= 4;
  let best = -1, bestD = Infinity, any = -1, anyD = Infinity;
  for (let i = 0; i < w * d; i++) {
    if (dist[i] < 0 || stand[i] < 0) continue;
    const x = i % w, y = (i - x) / w;
    if (isStairs(zone, x, y)) continue;
    const dd = distance(x - tx, y - ty);
    if (dd < anyD) { anyD = dd; any = i; }
    if (inBand(x, y) && Math.abs(stand[i] - fromStand) <= 1 && dd < bestD) { bestD = dd; best = i; }
  }
  const i = best >= 0 ? best : any;
  if (i < 0) return { ...zone.spawn, shifted: true };
  const x = i % w, y = (i - x) / w;
  return { x: x + 0.5, y: y + 0.5, z: stand[i], yaw: yaw ?? zone.spawn.yaw, shifted: best < 0 };
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
  const salt = [...String(p.id)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  const pick = inRange.length ? inRange[Math.floor(hash(salt, inRange.length, 11) * inRange.length)]
    : all.sort((a, b) => a[1] - b[1])[0]?.[0];
  if (pick === undefined) return { x: ox, y: oy, z: Math.max(0, stand[ox + oy * w]) };
  return { x: pick % w, y: Math.floor(pick / w), z: stand[pick] };
}

PATCH_OPS.setFlag = (game, zone, p) => { zone.flags[p.flag] = p.value ?? true; };
PATCH_OPS.removeUid = (game, zone, p) => {
  zone.monsters = zone.monsters.filter((m) => m.uid !== p.uid);
  zone.npcs = zone.npcs.filter((n) => n.uid !== p.uid);
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
