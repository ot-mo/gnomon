// The Tessellate (bible §4.4, §12.6): a dead-flat plain paved with the mosaics of pressed towns. A mosaic is vivid
// from above and faded at eye level (blocks.js mosaic), so its pictures are read on the map.
import { B } from "../../world.js";
import { dress } from "./common.js";

export default function tessellate(ctx) {
  dress(ctx);
  for (let n = ctx.rng.int(1, 3), k = 0; k < n; k++) mosaic(ctx, [B.MOSAIC_RED, B.MOSAIC_BLUE, B.MOSAIC_GOLD, B.MOSAIC_WHITE], ctx.rng.int(5, 9));
}

// A mosaic: an n × n picture, mirrored both ways (a pressed town's seal), laid as the ground's top block on level
// ground; no height changes.
export function mosaic(ctx, colours, n) {
  const { rng, zone, H } = ctx, W = zone.w;
  for (let k = 0; k < 15; k++) {
    const x0 = rng.int(4, zone.w - 5 - n), y0 = rng.int(4, zone.d - 5 - n);
    if (!ctx.freeRect(x0, y0, n, n, 1)) continue;
    const h = H[x0 + y0 * W];
    let flat = true;
    for (let y = y0; y < y0 + n && flat; y++) for (let x = x0; x < x0 + n; x++) if (H[x + y * W] !== h) { flat = false; break; }
    if (!flat) continue;
    const half = (n + 1) >> 1, pick = Array.from({ length: half * half }, () => rng.int(-1, colours.length - 1));
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const fx = Math.min(x, n - 1 - x), fy = Math.min(y, n - 1 - y), c = pick[Math.min(fx, fy) + Math.max(fx, fy) * half];
        if (c >= 0) ctx.column(x0 + x, y0 + y, h, { top: colours[c] });
      }
    for (let y = y0 - 1; y <= y0 + n; y++) for (let x = x0 - 1; x <= x0 + n; x++) ctx.occupy(x, y);
    return;
  }
}
