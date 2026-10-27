// The Glass Sea's shore (bible §4.4, §12.10): half liquid, half glass crust; a wreck on the crust now and then,
// its ribs a block high (a step), bones in its hull.
import { B } from "../../world.js";
import { dress } from "./common.js";

export default function sea(ctx) {
  dress(ctx);
  if (ctx.rng.chance(0.5)) wreck(ctx);
}

function wreck(ctx) {
  const { rng, zone, H } = ctx, W = zone.w;
  for (let k = 0; k < 15; k++) {
    const w = rng.int(5, 7), d = 3, x0 = rng.int(4, zone.w - 5 - w), y0 = rng.int(4, zone.d - 5 - d);
    if (!ctx.freeRect(x0, y0, w, d, 1)) continue;
    const h = H[x0 + y0 * W];
    let flat = true;
    for (let y = y0 - 1; y <= y0 + d && flat; y++) for (let x = x0 - 1; x <= x0 + w; x++) if (H[x + y * W] !== h) { flat = false; break; }
    if (!flat) continue;
    for (let x = x0; x < x0 + w; x++) if (x % 2 === x0 % 2) { ctx.put(x, y0, 0, B.PLANK); ctx.put(x, y0 + d - 1, 0, B.PLANK); }
    ctx.addProp("bones", x0 + (w >> 1), y0 + 1);
    for (let y = y0 - 1; y <= y0 + d; y++) for (let x = x0 - 1; x <= x0 + w; x++) ctx.occupy(x, y);
    return;
  }
}
