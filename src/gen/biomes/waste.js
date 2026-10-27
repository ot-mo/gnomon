// The Salt Waste (bible §4.4, §12.3): blinding white dunes of a pressed sea. Its salt pans are mosaics (read on
// the map, faded at eye level) and a Drover well stands now and then, a ring of salt round a little water.
import { B } from "../../world.js";
import { dress } from "./common.js";
import { mosaic } from "./tessellate.js";

export default function waste(ctx) {
  dress(ctx);
  if (ctx.rng.chance(0.6)) mosaic(ctx, [B.MOSAIC_WHITE, B.MOSAIC_GOLD], ctx.rng.int(5, 8));
  if (ctx.rng.chance(0.35)) well(ctx);
}

// A well: one tile of water at the datum on level ground, a ring of 1-block salt round it with a gap to step
// through.
function well(ctx) {
  const { rng, zone, H } = ctx, W = zone.w;
  for (let k = 0; k < 20; k++) {
    const x = rng.int(6, zone.w - 7), y = rng.int(6, zone.d - 7);
    if (!ctx.freeRect(x - 3, y - 3, 7, 7)) continue;
    let flat = true;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (H[x + dx + (y + dy) * W] !== 0) flat = false;
    if (!flat) continue;
    ctx.pool(x, y, false);
    const gap = rng.int(0, 7);
    [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].forEach(([dx, dy], n) => { if (n !== gap) ctx.put(x + dx, y + dy, 0, B.SALT); });
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) ctx.occupy(x + dx, y + dy);
    return;
  }
}
