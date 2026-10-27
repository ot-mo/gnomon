// The Brine Flats (bible §4.4, §12.1): wet salt crust, brine pools ringed with reeds and glimseed, a commons lamp
// on a post. The safest country in the world.
import { dress } from "./common.js";

export default function flats(ctx) {
  dress(ctx);
  reedsByWater(ctx, ["reeds", "reeds", "glimseed"], 0.18);
}

// Reeds along the zone's water (its pools and a river's banks): props on dry ground beside it.
export function reedsByWater(ctx, kinds, chance) {
  const { zone, rng, water } = ctx, W = zone.w;
  for (let y = 1; y < zone.d - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = x + y * W;
      if (water[i] || !ctx.keep(x, y) || ctx.cliff[i] || ctx.scenery[i] || ctx.jump[i]) continue;
      if (!(water[i - 1] || water[i + 1] || water[i - W] || water[i + W])) continue;
      if (rng.chance(chance)) ctx.addProp(rng.pick(kinds), x, y);
    }
}
