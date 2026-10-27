// What a landmark without a plan of its own gets (gen/surface.js, until C1 brings the plans): LANDMARK_BUILDERS[id]
// (ctx) => void in place of the stub site (a stairs block in its footprint's middle), with ctx as a biome
// builder's plus rect (the footprint) and site.
//
//   gnomon   WS3 #10: the Gnomon's 14-block voxel foot at its span's middle (bible §4.11, §4.12: the billboard
//            continues the needle above it; render3d starts the needle on whatever stands there). A plinth a block
//            high (5 × 5, a step), a 3 × 3 base 3 blocks high, and the needle itself, one column 14 blocks high:
//            scenery's ceiling (DECISIONS: heights). The way down into the Dial-works is south of the plinth.
import { B, FLOOR_Z } from "../../world.js";

export const LANDMARK_BUILDERS = {
  gnomon(ctx) {
    const { zone, rect } = ctx, W = zone.w;
    const cx = zone.w >> 1, cy = zone.d >> 1;   // the span's middle (render3d: zone.w / 2, zone.d / 2)
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx, y = cy + dy, i = x + y * W, core = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
        ctx.column(x, y, 0);
        if (dx === 0 && dy === 0) for (let dz = 0; dz < 14; dz++) ctx.put(x, y, dz, dz < 3 ? B.ROCK : B.SHALE);
        else if (core) for (let dz = 0; dz < 3; dz++) ctx.put(x, y, dz, B.ROCK);
        else ctx.put(x, y, 0, B.ROCK);
        ctx.planned[i] = 1;
        if (core) ctx.walls[i] = ctx.scenery[i] = 1;
      }
    if (ctx.site?.dungeon) {
      const sx = cx, sy = Math.min(cy + 3, rect ? rect.y + rect.d + 1 : cy + 3);
      ctx.column(sx, sy, 0);
      zone.set(sx, sy, FLOOR_Z - 1, B.STAIRS);
      zone.stairs = { x: sx, y: sy };
    }
  },
};
