// The Pleatwood (bible §4.4, §12.5): trees that fold their branches like fans (the world function's, dense here),
// fungal groves and fallen trunks in a green dimness.
import { B } from "../../world.js";
import { dress } from "./common.js";

const NEXT4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export default function pleatwood(ctx) {
  dress(ctx);
  grove(ctx);
  for (let n = ctx.rng.int(0, 2), k = 0; k < n; k++) log(ctx);
}

// A fungal grove: 1-block fungus caps on level ground (a step), mushrooms round them.
export function grove(ctx) {
  const { rng, zone, H } = ctx, W = zone.w;
  for (let k = 0; k < 15; k++) {
    const cx = rng.int(6, zone.w - 7), cy = rng.int(6, zone.d - 7);
    if (!ctx.freeRect(cx - 3, cy - 3, 7, 7)) continue;
    for (let n = 0; n < 8; n++) {
      const x = cx + rng.int(-2, 2), y = cy + rng.int(-2, 2), i = x + y * W;
      if (!ctx.free(x, y)) continue;
      if (NEXT4.every(([dx, dy]) => H[x + dx + (y + dy) * W] === H[i]) && rng.chance(0.5)) { ctx.put(x, y, 0, B.FUNGUS); ctx.occupy(x, y); }
      else ctx.addProp("mushroom", x, y);
    }
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) ctx.occupy(cx + dx, cy + dy);
    return;
  }
}

// A fallen trunk: a line of 1-block trunk on level ground, a step to climb over.
function log(ctx) {
  const { rng, zone, H } = ctx, W = zone.w;
  for (let k = 0; k < 15; k++) {
    const len = rng.int(3, 5), across = rng.chance(0.5);
    const x0 = rng.int(4, zone.w - 5 - len), y0 = rng.int(4, zone.d - 5 - len);
    const cells = Array.from({ length: len }, (_, s) => (across ? [x0 + s, y0] : [x0, y0 + s]));
    const h = H[x0 + y0 * W];
    if (!cells.every(([x, y]) => ctx.freeRect(x - 1, y - 1, 3, 3) && [[0, 0], ...NEXT4].every(([dx, dy]) => H[x + dx + (y + dy) * W] === h))) continue;
    for (const [x, y] of cells) { ctx.put(x, y, 0, B.TRUNK); ctx.occupy(x, y); }
    return;
  }
}
