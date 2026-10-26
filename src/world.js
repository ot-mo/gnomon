// A zone: one voxel grid you walk around in (a dungeon level, or later a world tile's surface),
// plus everything derived from it (light, where creatures can stand, what the map shows) and
// everything living in it. The same Zone feeds the map (turns.js, renderMap.js) and the 3D view
// (render3d.js, player.js). zones.js keeps track of which zones exist and moves you between them.
import { computeLight } from "./light.js";
import { BLOCKS, B, KIND } from "./blocks.js";
export { BLOCKS, B, KIND };

export const FLOOR_Z = 2;      // the datum: feet height on ordinary floor, z = 0..1 is solid ground
export const ROOM_TOP = 6;     // rooms are open from z = 2 to 5; z = 6 is the ceiling
export const CORRIDOR_TOP = 4; // corridors are two blocks tall
export const SURFACE = { w: 80, d: 48, h: 16 };   // a world tile's surface zone (0A2 on)
export const DUNGEON = { w: 48, d: 48, h: 10 };   // a dungeon level; tall rooms reach up to z = 8
export const APRON = 16;                          // tiles of the neighbour kept beyond an open edge (0A2)

// Which blocks count as air for standing, per door rule (see standHeight).
const AIR_FOR = {};
for (const mode of ["solid", "open", "all"]) {
  const t = new Uint8Array(256);
  BLOCKS.forEach((b, id) => { t[id] = id === 0 || (mode !== "solid" && b.door && (mode === "all" || !b.locked)) ? 1 : 0; });
  AIR_FOR[mode] = t;
}

export class Zone {
  // key "wx,wy,z" (z = 0: a tile's surface, 1..n: its dungeon levels); type "surface" | "dungeon".
  // level: the difficulty number every balance curve reads (it used to be the depth).
  constructor({ key, wx = 0, wy = 0, z = 0, type = z > 0 ? "dungeon" : "surface", level = 0, tier = 1, seed = 0,
                w, d, h, name = "", genVersion = 1 } = {}) {
    const size = type === "surface" ? SURFACE : DUNGEON;
    w ??= size.w; d ??= size.d; h ??= size.h;
    // identity
    this.key = key ?? `${wx},${wy},${z}`;
    this.wx = wx; this.wy = wy; this.z = z;
    this.type = type;
    this.level = level; this.tier = tier; this.seed = seed; this.genVersion = genVersion;
    this.name = name; this.siteId = null; this.landmarkId = null;
    this.w = w; this.d = d; this.h = h;
    // persistent grids
    this.blocks = new Uint8Array(w * d * h);
    this.seen = new Uint8Array(w * d);      // auto-map: 1 once your eyes have passed over a column
    this.holeSeen = new Uint8Array(w * d);  // 1 once you've looked down into a pit or chasm in 3D
    // derived (refresh() rebuilds them; dropDerived() frees them while the zone is dormant)
    this.kind = new Uint8Array(w * d);      // KIND per column
    this.stand = new Int8Array(w * d);      // standing height per column, -1 = nowhere to stand
    this.look = new Uint8Array(w * d);      // the block that sets the column's map glyph (TECH_DESIGN §6.5)
    this.skyLight = this.lampLight = this.litMask = null;
    this.navVersion = 0;                    // bumps whenever the blocks change
    this.reach = null;                      // { v, x, y, dist }: what's reachable from the anchor (zones.js)
    // outdoors (0A2 and WS2/WS3 fill these in)
    this.hasSky = false;                    // sun and sky dome in the 3D view
    this.outdoor = false;                   // apron, horizon, haze, daylight
    this.edges = { n: false, e: false, s: false, w: false };   // true: you can walk off that side
    this.apron = null;                      // { n, e, s, w, ne, nw, se, sw }: neighbour voxel bands (see apronBlock)
    this.liquid = "water";                  // what water blocks hold; liquids[column] overrides
    this.liquids = {};
    this.hasBelow = false;                  // a level exists below: holes and deep water drop you into it
    this.dungeonRect = null;                // surface only: where the 48×48 levels below sit (§5.5)
    // contents
    this.links = new Map();       // lever voxel index → { action, cells: [[x,y,z]…], group? } (interact.js)
    this.groups = new Map();      // lever group id → { need, pulled, cells }: gates that need several levers
    this.braziers = null;         // the brazier puzzle, if this zone has one (interact.js)
    this.bombs = [];              // lit bombs lying on the ground (throwing.js)
    this.secret = null;           // the secret room: { x0, y0, x1, y1, found }
    this.secretWalls = new Set(); // columns (x + y·w) of the thin walls a bomb can open into it
    this.creatures = [];          // monsters and people (and flat beings, and one talking door): creatures.js
    this.uidSeq = 0;              // uids handed out by this zone's generation (ids.js genUid)
    this.items = [];
    this.props = [];              // non-blocking sprites (shrubs, bones): WS2
    this.spikes = new Map();      // column (x + y·w) → { phase, period, up }: spike traps (traps.js)
    this.projectiles = [];        // thrown knives and potions in flight (3D)
    this.clouds = [];             // lingering poison gas
    this.markers = [];            // [{ x, y }] placed on the map
    this.sightings = new Map();   // monster id → { x, y, glyph, color, time } where you last saw it
    this.rooms = [];
    this.spawn = { x: 0, y: 0, z: FLOOR_Z, yaw: 0 };   // the zone's anchor: where you appear by default
    this.stairs = null;           // { x, y } of the stairs down
    this.upStairs = null;         // { x, y } of the stairs up
    this.entrance = null;         // surface only: the way down into the dungeon (0A2)
    this.flags = {};              // zone facts: { vaultHinted, waterHint, … }
    this.appliedPatches = {};     // zone patch ids already applied here (zones.js)
    // bookkeeping
    this.sealed = false;          // generation finished: from now on set() marks the zone dirty
    this.dirty = false;
    this.lastTime = 0;            // game time when you last left it
  }

  index(x, y, z) { return x + y * this.w + z * this.w * this.d; }

  get(x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.d || z >= this.h) return 0;
    return this.blocks[x + y * this.w + z * this.w * this.d];
  }

  set(x, y, z, id) {
    if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.d || z >= this.h) return;
    this.blocks[x + y * this.w + z * this.w * this.d] = id;
    if (this.sealed) this.dirty = true;
  }

  // For collision: the sides and top are solid, but below is open (that's how you fall through a
  // pit, or sink through deep water, to the level below). Beyond an open side of a surface zone the
  // apron's voxel counts instead (TECH_DESIGN §5.1, §6.1): you walk past the border onto the ground
  // of the zone you are about to enter. Beyond a solid side, or where no band is built, it is solid.
  solid(x, y, z) {
    if (z < 0) return false;
    if (z >= this.h) return true;
    let b;
    if (x < 0 || y < 0 || x >= this.w || y >= this.d) {
      b = this.apron ? apronBlock(this, x, y, z) : -1;
      if (b < 0) return true;
    } else b = this.blocks[x + y * this.w + z * this.w * this.d];
    return b !== 0 && b !== B.WATER_DEEP;   // deep water: you sink right through it, like a chasm
  }

  // The block at (x, y, z), the apron's beyond an open side; 0 anywhere else outside the grid.
  // (get() stays inside the grid: creatures, the map and the derived arrays never see the apron.)
  voxel(x, y, z) {
    if (z < 0 || z >= this.h) return 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.d) return this.blocks[x + y * this.w + z * this.w * this.d];
    const b = this.apron ? apronBlock(this, x, y, z) : -1;
    return b < 0 ? 0 : b;
  }

  // The lowest spot in column (x, y) with solid ground under it and two blocks of air above.
  // doors: "solid" (closed doors block), "open" (wooden doors count as passable),
  //        "all" (locked doors too — for checking a level can be finished).
  standHeight(x, y, doors = "solid") {
    const { w, d, h, blocks } = this;
    if (x < 0 || y < 0 || x >= w || y >= d) return -1;
    const col = x + y * w, wd = w * d;
    if (blocks[col + (FLOOR_Z - 1) * wd] === B.WATER_DEEP) return -1;   // too deep to stand in
    const air = doors === "solid" ? AIR_FOR.solid : doors === "all" ? AIR_FOR.all : AIR_FOR.open;
    for (let z = 1; z < h - 1; z++)
      if (!air[blocks[col + (z - 1) * wd]] && air[blocks[col + z * wd]] && air[blocks[col + (z + 1) * wd]]) return z;
    return -1;
  }

  // Recompute everything derived from the blocks. Call after any block changes.
  refresh() {
    const { w, d } = this;
    if (!this.stand) { this.stand = new Int8Array(w * d); this.kind = new Uint8Array(w * d); this.look = new Uint8Array(w * d); }
    computeLight(this, B.LAMP, B.BRAZIER_LIT);
    for (let y = 0; y < d; y++)
      for (let x = 0; x < w; x++) this.stand[x + y * w] = this.standHeight(x, y);
    this.computeKinds();
    this.navVersion++;
  }

  get hasDerived() { return !!(this.stand && this.skyLight); }
  ensureDerived() { if (!this.hasDerived) this.refresh(); }
  // A dormant zone keeps its blocks, map memory and contents; light, stand, kind, look and the apron
  // are rebuilt when you come back (one refresh(), and zones.js fillApron; keepDerived decides when).
  dropDerived() {
    this.skyLight = this.lampLight = this.litMask = this.sunlit = null; this.stand = this.kind = this.look = null;
    this.apron = null; this.reach = null;
  }

  // End of generation: from here on, any set() marks the zone as changed.
  seal() { this.sealed = true; this.dirty = false; return this; }

  computeKinds() {
    const { w, d } = this;
    for (let y = 0; y < d; y++) {
      for (let x = 0; x < w; x++) {
        let special = 0, allSolid = true;
        for (let z = FLOOR_Z; z < ROOM_TOP; z++) {
          const b = this.get(x, y, z);
          if (!b) { allSolid = false; continue; }
          const info = BLOCKS[b];
          if (info.door) special = info.locked ? KIND.LOCKED : KIND.DOOR;
          else if (info.gate) special = KIND.GATE;
          else if (info.lever && !special) special = KIND.LEVER;
        }
        let k;
        const ground = this.get(x, y, FLOOR_Z - 1), under = this.get(x, y, FLOOR_Z - 2);
        if (special) k = special;
        else if (allSolid || (this.planWalls?.[x + y * w] && this.get(x, y, FLOOR_Z))) k = KIND.WALL;   // a surface plan's wall, however high
        else if (ground === B.STAIRS) k = KIND.STAIRS;
        else if (ground === B.STAIRS_UP) k = KIND.STAIRS_UP;
        else if (ground === B.WATER_SHALLOW) k = KIND.SHALLOW;
        else if (ground === B.WATER_DEEP) k = KIND.DEEP;
        else if ((!ground || ground === B.GHOST) && !this.get(x, y, FLOOR_Z)) k = KIND.HOLE;   // ghost planks look like a chasm
        else if (ground === B.PLANK && under !== B.ROCK) k = KIND.BRIDGE;   // planks over air or water
        else if (BLOCKS[ground].mosaic) k = KIND.MOSAIC;
        else if (ground === B.SPIKES) k = KIND.SPIKES;
        else k = KIND.FLOOR;   // floors, ledges, crates: the map can't tell them apart
        const i = x + y * w;
        this.kind[i] = k;
        // The block the map shows: a wall's face at body height; otherwise the ground under
        // where you'd stand (a hill shows its grass, not the subsoil at the datum).
        const s = this.stand[i];
        this.look[i] = k === KIND.WALL ? this.get(x, y, FLOOR_Z + 1) : s > 0 ? this.get(x, y, s - 1) : ground;
      }
    }
  }
}

// --- The apron (TECH_DESIGN §6.1) -----------------------------------------------------------------
// zone.apron holds one voxel band per open side and open corner of a surface zone, APRON tiles deep:
//   n: x 0..w−1, y −APRON..−1     s: x 0..w−1, y d..d+APRON−1     (the zone's own w long)
//   w: x −APRON..−1, y 0..d−1     e: x w..w+APRON−1, y 0..d−1     (its own d long)
//   nw, ne, sw, se: APRON × APRON, in the matching corner
// A band is { x0, y0, bw, bd, blocks: Uint8Array(bw·bd·h), from: "zone" | "world" }, indexed
// (x − x0) + (y − y0)·bw + z·bw·bd in the zone's own coordinates; a side or corner that isn't open has
// none (null). zones.js fillApron builds the bands through APRON_BUILDERS.surface: a copy of the
// neighbour's edge band when it is in memory, else the world functions. Dungeons have no apron.
export const APRON_SIDES = ["n", "e", "s", "w", "ne", "nw", "se", "sw"];
export function apronRect(zone, side) {
  const { w, d } = zone, A = APRON;
  const x0 = side.includes("w") ? -A : side.includes("e") ? w : 0;
  const y0 = side.includes("n") ? -A : side.includes("s") ? d : 0;
  const bw = side.includes("w") || side.includes("e") ? A : w, bd = side.includes("n") || side.includes("s") ? A : d;
  return { x0, y0, bw, bd };
}
// The apron's block at (x, y, z) outside the grid (0 ≤ z < h), or −1 where no band covers it.
export function apronBlock(zone, x, y, z) {
  const ap = zone.apron;
  const sy = y < 0 ? "n" : y >= zone.d ? "s" : "", sx = x < 0 ? "w" : x >= zone.w ? "e" : "";
  const band = ap[sy + sx];
  if (!band) return -1;
  const lx = x - band.x0, ly = y - band.y0;
  if (lx < 0 || ly < 0 || lx >= band.bw || ly >= band.bd) return -1;
  return band.blocks[lx + ly * band.bw + z * band.bw * band.bd];
}

// Every column's standing height under one door rule (a fresh array; zone.stand is "solid").
export function standWith(zone, doors) {
  const { w, d } = zone, stand = new Int8Array(w * d);
  for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) stand[x + y * w] = zone.standHeight(x, y, doors);
  return stand;
}

// Whether a body floats on deep water instead of sinking: swimmers (the Swimmer perk; 0B reads
// bonus(e, "swim") instead), and on the surface every body (surface water has a rock bottom and
// never drops you a level, TECH_DESIGN §5.3; non-swimmers drown there from 0B).
export const floatsOn = (zone, e) => zone.type === "surface" || !!e?.perks?.has?.("swimmer");

// What's solid for this body: the zone's blocks, plus deep water if it floats there.
// One rule for both views (player.js collision, turns.js standing heights).
export function solidFor(zone, e) {
  if (!floatsOn(zone, e)) return (x, y, z) => zone.solid(x, y, z);
  return (x, y, z) => zone.solid(x, y, z) || zone.voxel(x, y, z) === B.WATER_DEEP;   // the apron's water too
}
