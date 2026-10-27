// The Teeth (bible §4.4): a north-south wall of tooth-shaped crags (cliffs everywhere, tall shale outcrops), snow
// on the crags' tips, and ramps onto the ledges.
import { B } from "../../world.js";
import { dress } from "./common.js";

export default function teeth(ctx) {
  dress(ctx);
  for (let n = ctx.rng.int(1, 3), k = 0; k < n; k++) crag(ctx);
}

// A crag: a spike of shale 4-6 blocks high with snow on its tip: scenery, a wall on the map.
function crag(ctx) {
  const { rng, zone, H } = ctx, W = zone.w;
  for (let k = 0; k < 15; k++) {
    const x = rng.int(4, zone.w - 5), y = rng.int(4, zone.d - 5), i = x + y * W;
    if (!ctx.freeRect(x - 1, y - 1, 3, 3)) continue;
    const up = Math.min(rng.int(4, 6), 14 - H[i]);
    for (let dz = 0; dz < up; dz++) ctx.put(x, y, dz, dz === up - 1 ? B.SNOW : B.SHALE);
    ctx.walls[i] = ctx.scenery[i] = ctx.planned[i] = 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) ctx.occupy(x + dx, y + dy);
    return;
  }
}
