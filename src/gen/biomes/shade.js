// The Shade (bible §4.4, §12.7): Noon's burnt shadow, dusk even at noon. Runes on every stone (a carved stone
// reads only in the dark), umbra pools, ash.
import { B } from "../../world.js";
import { dress } from "./common.js";

export default function shade(ctx) {
  dress(ctx);
  for (let n = ctx.rng.int(1, 3), k = 0; k < n; k++) runeStone(ctx);
}

// A standing stone 3 blocks high with a rune carved at eye height: scenery, a wall on the map.
function runeStone(ctx) {
  const { rng, zone } = ctx, W = zone.w;
  for (let k = 0; k < 15; k++) {
    const x = rng.int(4, zone.w - 5), y = rng.int(4, zone.d - 5);
    if (!ctx.freeRect(x - 1, y - 1, 3, 3)) continue;
    ctx.put(x, y, 0, B.STONE); ctx.put(x, y, 1, B.RUNE); ctx.put(x, y, 2, B.STONE);
    ctx.walls[x + y * W] = ctx.scenery[x + y * W] = ctx.planned[x + y * W] = 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) ctx.occupy(x + dx, y + dy);
    return;
  }
}
