// The Lattice (bible §4.4, §12.11): a crystal grid where the Pressing's creases still show. Crystal spires stand
// in it (scenery up to 8 blocks, walls on the map), and the grid's lines run through its ground in glass on the
// same world lines in every zone (every 10th column and row of the world), so the map shows the grid running on
// from span to span.
import { B } from "../../world.js";
import { dress } from "./common.js";

export default function lattice(ctx) {
  dress(ctx);
  for (let n = ctx.rng.int(1, 3), k = 0; k < n; k++) spire(ctx);
  gridLines(ctx);
}

function spire(ctx) {
  const { rng, zone, H } = ctx, W = zone.w;
  for (let k = 0; k < 15; k++) {
    const x = rng.int(4, zone.w - 5), y = rng.int(4, zone.d - 5), i = x + y * W;
    if (!ctx.freeRect(x - 1, y - 1, 3, 3)) continue;
    const up = Math.min(rng.int(4, 8), 14 - H[i]);
    for (let dz = 0; dz < up; dz++) ctx.put(x, y, dz, B.CRYSTAL);
    ctx.walls[i] = ctx.scenery[i] = ctx.planned[i] = 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) ctx.occupy(x + dx, y + dy);
    return;
  }
}

// Glass as the ground's top along every 10th world column and row, where nothing else is (heights unchanged).
function gridLines(ctx) {
  const { zone, H } = ctx, W = zone.w, ox = zone.wx * W, oy = zone.wy * zone.d;
  for (let y = 0; y < zone.d; y++)
    for (let x = 0; x < W; x++) {
      if ((ox + x) % 10 !== 0 && (oy + y) % 10 !== 0) continue;
      if (ctx.free(x, y)) ctx.column(x, y, H[x + y * W], { top: B.GLASS });
    }
}
