// Edge ports (TECH_DESIGN §5.1 (b), §5.3; §1.4 gen/surface.js edgePorts; owner WS2): where roads, rivers and
// paths cross a span's open edges, the same seen from both spans. A P0 stub over the 0A2 code in gen/surface.js
// (portsOf); WS2 moves the code in.
//
//   edgePorts(run, wx, wy) → { n: Port[], e, s, w }    Port = { kind: "road" | "river" | "path", at, width, edgeId }
//                                                      at: tiles along the edge (0A2 calls it `along`)
//   portsOf(world, seed, wx, wy) → [{ side, kind, edgeId, width, along }]   0A2's flat list, re-exported
//
// edgePorts is §1.4's shape built from portsOf (nothing new is generated). Generation code only: R6.
import { portsOf } from "./surface.js";

export const STUB = "WS2";
export { portsOf };

export function edgePorts(run, wx, wy) {
  const out = { n: [], e: [], s: [], w: [] };
  for (const p of portsOf(run.world, run.seed, wx, wy)) out[p.side].push({ kind: p.kind, at: p.along, width: p.width, edgeId: p.edgeId });
  return out;
}
