// The Deep Pleat (bible §4.4, §12.5): the Pleatwood, older and darker; paper-wasp nests hang in it.
import { dress } from "./common.js";
import { grove } from "./pleatwood.js";

export default function deepPleat(ctx) {
  dress(ctx);
  grove(ctx);
  if (ctx.rng.chance(0.5)) grove(ctx);
}
