// The Downs (bible §4.4, §12.4): rolling grass and barrow mounds under open sky, cairns on the rises.
import { B } from "../../world.js";
import { dress } from "./common.js";

export default function downs(ctx) {
  dress(ctx);
  for (let n = ctx.rng.int(0, 2), k = 0; k < n; k++) barrow(ctx);
}

// A barrow: a mound on level ground, 1 block at its rim and 2 in its middle (steps of 1 all round), standing
// stones at its corners and bones on top.
function barrow(ctx) {
  const { rng, zone, H } = ctx, W = zone.w;
  for (let k = 0; k < 20; k++) {
    const x0 = rng.int(4, zone.w - 10), y0 = rng.int(4, zone.d - 10);
    if (!ctx.freeRect(x0 - 1, y0 - 1, 7, 7)) continue;
    const h = H[x0 + y0 * W];
    let flat = true;
    for (let y = y0 - 1; y < y0 + 6 && flat; y++) for (let x = x0 - 1; x < x0 + 6; x++) if (H[x + y * W] !== h) { flat = false; break; }
    if (!flat || h + 2 > 3) continue;
    for (let y = y0; y < y0 + 5; y++)
      for (let x = x0; x < x0 + 5; x++) {
        const rim = x === x0 || y === y0 || x === x0 + 4 || y === y0 + 4;
        ctx.column(x, y, h + (rim ? 1 : 2));
      }
    for (const [x, y] of [[x0, y0], [x0 + 4, y0], [x0, y0 + 4], [x0 + 4, y0 + 4]]) {
      ctx.put(x, y, 0, B.STONE); ctx.put(x, y, 1, B.STONE);
      ctx.walls[x + y * W] = ctx.scenery[x + y * W] = ctx.planned[x + y * W] = 1;
    }
    ctx.addProp("bones", x0 + 2, y0 + 2);
    for (let y = y0 - 1; y < y0 + 6; y++) for (let x = x0 - 1; x < x0 + 6; x++) ctx.occupy(x, y);
    return;
  }
}
