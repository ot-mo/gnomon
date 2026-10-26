// Spike traps: floor tiles whose spikes shoot up in a rhythm, one beat every TICK seconds.
// Each tile has a phase in its room's pattern (a wave sweeping across, a checkerboard, a
// ripple…) and is up for `up` beats out of every `period`.
//
// This is where the flat view earns its keep. On the map, time only moves when you do, you
// see the whole floor at once, and the tiles about to rise are marked. Near spikes, waiting
// (Space) lasts until the instant before the next beat, so crossing becomes a beat-by-beat
// puzzle: each beat, step to a tile that won't come up (not a ^), or stay put. (Moving with the beat like that, even a
// wave coming straight at you can be slipped through: step into its trough as it passes.)
// In 3D it's a test of nerve: the spikes at your feet are out of sight and the clock runs.
// (In 3D you can also jump over a row. The map can't jump.)
import { B, FLOOR_Z } from "./world.js";
import { distance } from "./rng.js";
import { damageMonster } from "./combat.js";
import { CREATURE_TYPES, canTalk } from "./creatures.js";
import { statusFlag } from "./status.js";

export const TICK = 0.5;

// "up" (spikes out: it hurts), "warn" (they come up on the next beat) or "down". null if not a trap.
export function spikeState(zone, i, time) {
  const s = zone.spikes.get(i);
  if (!s) return null;
  const k = (((Math.floor(time / TICK) - s.phase) % s.period) + s.period) % s.period;
  return k < s.up ? "up" : k === s.period - 1 ? "warn" : "down";
}

// Lay spike tiles over `cells` ([x, y] list) in one of the patterns. Returns the pattern's name.
// flip: which way a wave rolls (+1: towards larger x or y; 0: either, at random).
// Waves come in staggered rows (every other row half a cycle behind), so a wave rolling straight
// at you always leaves a safe tile beside you: you can cross any spike field just by following
// what the map shows (step on tiles that are down, get off a ^), never onto a ▲.
export function layoutSpikes(zone, cells, rng, pattern = rng.pick(["wave-x", "wave-y", "diagonal", "checker", "ripple"]), period = 0, flip = 0) {
  const xs = cells.map(([x]) => x), ys = cells.map(([, y]) => y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  period ||= pattern === "checker" ? 4 : rng.int(4, 5);
  const up = 1, half = Math.floor(period / 2);
  flip ||= rng.chance(0.5) ? -1 : 1;
  for (const [x, y] of cells) {
    const phase = pattern === "wave-x" ? x * flip + (y & 1) * half : pattern === "wave-y" ? y * flip + (x & 1) * half
      : pattern === "diagonal" ? (x + y * flip) : pattern === "checker" ? ((x + y) & 1) * 2 : Math.round(distance(x - cx, y - cy));
    zone.set(x, y, FLOOR_Z - 1, B.SPIKES);
    zone.spikes.set(x + y * zone.w, { phase, period, up, pattern });
  }
  return pattern;
}

// Anything standing on a tile when its spikes come up gets hurt, once per beat.
// (Flying, a jump in 3D, or a flat being's plane: the spikes miss.)
export function updateSpikes(game) {
  const { zone, player: p } = game;
  if (!zone.spikes.size) return;
  if (nearSpikes(game, 3)) game.hint(game.view === "map" ? "spikes-map" : "spikes-3d", game.view === "map"
    ? "Spikes keep a beat. Here, Space waits until the beat is about to change. Orange ^ come up on the beat: don't be standing on one. Red ▲ are about to drop."
    : "Spikes! At eye level you have to time them (or jump over a row). From above (Tab) you can take them beat by beat.");
  const beat = Math.floor(game.time / TICK);
  const hits = (x, y, z, last) => {
    const i = Math.floor(x) + Math.floor(y) * zone.w;
    return last !== beat && spikeState(zone, i, game.time) === "up" && z < FLOOR_Z + 0.35 && zone.stand[i] === FLOOR_Z;
  };
  if (!statusFlag(p, "flying") && p.onGround !== false && hits(p.x, p.y, p.z, p.spikeBeat)) {
    p.spikeBeat = beat;
    game.hurtPlayer(2 + Math.floor(zone.level / 3) + Math.floor(Math.random() * 3), "the spikes");
  }
  for (const m of [...zone.creatures]) {
    const t = CREATURE_TYPES[m.type];
    if (canTalk(m) || m.vis.statue || t.hover || t.flat || t.boss || !hits(m.x, m.y, m.z, m.spikeBeat)) continue;
    m.spikeBeat = beat;
    damageMonster(game, m, 3 + Math.floor(Math.random() * 3), [200, 200, 210], `The ${m.name} is skewered by the spikes.`);
  }
}

// --- 3D: spikes that are up, as little sprites standing on their tiles ----------------------
const SPIKE_ART = ["  w   w  ", " wW  wW  ", " wW w wW ", "wWWwWwWWw", "WWWWWWWWW"];
const SPIKE_PALETTE = { w: [[225, 228, 235], 0.15], W: [[150, 152, 160], 0.05] };

// Any spike trap within a few tiles? (Then waiting on the map waits for the beat.)
export function nearSpikes(game, r = 7) {
  const { zone, player: p } = game;
  for (const i of zone.spikes.keys()) {
    const x = i % zone.w, y = (i - x) / zone.w;
    if (Math.abs(x + 0.5 - p.x) <= r && Math.abs(y + 0.5 - p.y) <= r) return true;
  }
  return false;
}

export function spikeSprites(game) {
  const { zone, player: p } = game, out = [];
  for (const i of zone.spikes.keys()) {
    const x = i % zone.w, y = (i - x) / zone.w;
    if (Math.abs(x + 0.5 - p.x) > 16 || Math.abs(y + 0.5 - p.y) > 16 || spikeState(zone, i, game.time) !== "up") continue;
    out.push({ x: x + 0.5, y: y + 0.5, z: FLOOR_Z, w: 0.9, h: 0.55, art: SPIKE_ART, palette: SPIKE_PALETTE });
  }
  return out;
}
