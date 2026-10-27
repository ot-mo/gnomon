// The Stacks (bible §4.4, §12.9): Deepwright cities, girders and automata. On the surface: metal outcrops and
// lamp posts, ramps up the cliffs, and old floor plans laid out in the ground, stone walls round tiled rooms (the
// map reads them by colour).
import { B } from "../../world.js";
import { dress } from "./common.js";

export default function stacks(ctx) {
  dress(ctx);
  for (let n = ctx.rng.int(1, 2), k = 0; k < n; k++) floorPlan(ctx);
}

// A floor plan: a room's outline in stone and its floor in tile, flush with level ground.
function floorPlan(ctx) {
  const { rng, zone, H } = ctx, W = zone.w;
  for (let k = 0; k < 15; k++) {
    const w = rng.int(5, 9), d = rng.int(4, 7), x0 = rng.int(4, zone.w - 5 - w), y0 = rng.int(4, zone.d - 5 - d);
    if (!ctx.freeRect(x0, y0, w, d, 1)) continue;
    const h = H[x0 + y0 * W];
    let flat = true;
    for (let y = y0; y < y0 + d && flat; y++) for (let x = x0; x < x0 + w; x++) if (H[x + y * W] !== h) { flat = false; break; }
    if (!flat) continue;
    for (let y = y0; y < y0 + d; y++)
      for (let x = x0; x < x0 + w; x++) ctx.column(x, y, h, { top: x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + d - 1 ? B.STONE : B.TILE });
    for (let y = y0 - 1; y <= y0 + d; y++) for (let x = x0 - 1; x <= x0 + w; x++) ctx.occupy(x, y);
    return;
  }
}
