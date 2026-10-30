// The real world's level table (DECISIONS "Phase 3 content sessions": golden (b) stays held, and the real world's levels
// get tables of their own; TECH_DESIGN §8.6 "C3"; C3). The parent's tables (legacy.js, by `depths`) reach level 20 and
// stay as they are; every level the real world makes (spans 2-23, its sites' floors up to 30) has these rows instead,
// one per roaming species at its own levels and weight (wildlife.js). The regions' rows (content/world/regions.js)
// are the same species, region by region; this table is for the draws that have no region (a draw above the parent's
// level 20: integration request 1).
//
//   LEVEL_POOL               [[type, weight, lo, hi]]: every wildlife species that roams (a weight above 0) and isn't
//                            docile or harmless: what lives at a level, out for a stranger or not (below level 20 the
//                            neutral folk of the factions are among them: the clatterer, the chime-priest, the
//                            draughtsman…; from level 20 on every kind in it is out for one, check-creatures 6)
//   pickRow(rand, rows, level) → type | null   a type by weight among the rows whose levels hold `level`, registered
//                            kinds only (rand: a 0..1 function; one draw), as gen/dungeon.js pickFrom draws a region's
//                            rows; null when no registered kind's row holds the level (the caller falls back)
//   rowsAt(rows, level) → rows               the rows of registered kinds, weight above 0, that hold `level`
import { CREATURE_TYPES, setLevelPool } from "../../creatures.js";
import { WILDLIFE } from "./wildlife.js";

const roams = (t) => t.weight > 0 && t.levels && t.temperament !== "docile" && !(t.damage[1] <= 1);
export const LEVEL_POOL = Object.entries(WILDLIFE).filter(([, t]) => roams(t)).map(([id, t]) => [id, t.weight, t.levels[0], t.levels[1]]);

export const rowsAt = (rows, level) => rows.filter(([type, w, lo, hi]) => CREATURE_TYPES[type] && w > 0 && level >= lo && level <= hi);
export function pickRow(rand, rows, level) {
  const live = rowsAt(rows, level);
  if (!live.length) return null;
  let pick = rand() * live.reduce((s, r) => s + r[1], 0);
  for (const [type, w] of live) if ((pick -= w) < 0) return type;
  return live[live.length - 1][0];
}
// Above level 20 a draw with no table is this pool's (creatures.js pickCreatureType; integrator, C3 #1).
setLevelPool((rand, level) => pickRow(rand, LEVEL_POOL, level));
