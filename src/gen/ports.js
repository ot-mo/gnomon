// Edge ports (TECH_DESIGN §5.1 (b), §5.3 item 3; owner WS2): where roads and rivers cross a span's open
// edges, the same seen from both spans.
//
//   edgePorts(run, wx, wy) → { n: Port[], e, s, w }    Port = { kind: "road" | "river", at, width, edgeId, liquid? }
//                                                      at: tiles along the edge (portsOf calls it `along`)
//   portsOf(world, seed, wx, wy) → [{ side, kind, edgeId, width, along, liquid? }]   the flat list, cached per run
//   portTable(world, seed) → (wx, wy) → [port]           the same function, for the world functions (gen/terrain.js)
//
// A crossing point is 8 + hashInt(seed, edgeId) mod (length − 16) along the edge, the width the wider of the two
// spans' (road 2-3, river 3-5). Both spans compute it from the same canonical edgeId and the edge's data alone,
// so they agree. A river port carries its liquid (the river's, tile.riverLiquid, or plain water), the same from
// both sides. Generation code only: R6.
import { hashInt } from "../rng.js";
import { SIDES, SIDE_STEP, OPPOSITE } from "../world/worldmodel.js";
import { SURFACE } from "../world.js";

const ZW = SURFACE.w, ZD = SURFACE.d;
const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const tables = new WeakMap();   // world → Map(seed → portsOf), the last few seeds only

export function portTable(world, seed) {
  seed >>>= 0;
  let bySeed = tables.get(world);
  if (!bySeed) tables.set(world, (bySeed = new Map()));
  let fn = bySeed.get(seed);
  if (!fn) {
    fn = makePortTable(world, seed);
    if (bySeed.size >= 4) bySeed.delete(bySeed.keys().next().value);
    bySeed.set(seed, fn);
  }
  return fn;
}

export function forgetPorts(world) { tables.delete(world); }   // gen/surface.js forgetWorld
export const portsOf = (world, seed, wx, wy) => portTable(world, seed)(wx, wy);

export function edgePorts(run, wx, wy) {
  const out = { n: [], e: [], s: [], w: [] };
  for (const p of portsOf(run.world, run.seed, wx, wy)) {
    const port = { kind: p.kind, at: p.along, width: p.width, edgeId: p.edgeId };
    if (p.liquid) port.liquid = p.liquid;
    out[p.side].push(port);
  }
  return out;
}

function makePortTable(world, seed) {
  const cache = new Map();
  return function portsAt(wx, wy) {
    const key = `${wx},${wy}`;
    let out = cache.get(key);
    if (out) return out;
    out = [];
    const t = world.tileAt(wx, wy);
    if (t)
      for (const side of SIDES) {
        if (!world.edgeOpen(wx, wy, side)) continue;
        const [dx, dy] = SIDE_STEP[side], o = world.tileAt(wx + dx, wy + dy), opp = OPPOSITE[side];
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
          out.push({ side, kind: "river", edgeId, width, along, liquid: riverLiquid(t, o) });
        }
      }
    cache.set(key, out);
    return out;
  };
}

// The liquid a river carries over an edge: what either span says its river holds (compileWorld's
// tile.riverLiquid, from the world's rivers[].liquid), the same whichever side asks; else plain water.
function riverLiquid(a, b) {
  const la = a.riverLiquid || null, lb = b.riverLiquid || null;
  if (la && lb) return la < lb ? la : lb;
  return la || lb || "water";
}
