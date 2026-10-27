// Road spans (bible §4.4): the Deepwright Old Rule, the Assize's Straight Cut, the Glass Causeway. A milestone (a
// Survey benchmark: a signpost 2 blocks high) stands beside the road.
import { B } from "../../world.js";
import { dress } from "./common.js";

const NEXT4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export default function road(ctx) {
  dress(ctx);
  if (ctx.rng.chance(0.7)) milestone(ctx);
}

function milestone(ctx) {
  const { rng, zone, road: onRoad } = ctx, W = zone.w;
  const beside = [];
  for (let y = 4; y < zone.d - 4; y++)
    for (let x = 4; x < W - 4; x++)
      if (!onRoad[x + y * W] && ctx.free(x, y) && NEXT4.some(([dx, dy]) => onRoad[x + dx + (y + dy) * W])) beside.push([x, y]);
  if (!beside.length) return;
  const [x, y] = beside[rng.int(0, beside.length - 1)];
  ctx.put(x, y, 0, B.SIGN); ctx.put(x, y, 1, B.SIGN);
  ctx.walls[x + y * W] = ctx.scenery[x + y * W] = ctx.planned[x + y * W] = 1;
  ctx.occupy(x, y);
}
