// The real world's level table (DECISIONS "Phase 3 content sessions": golden (b) stays held, and the real world's levels
// get tables of their own; TECH_DESIGN §8.6 "C3"; C3). The parent's tables (legacy.js, by `depths`) reach level 20 and
// stay as they are; every level the real world makes (spans 2-23, its sites' floors up to 30) has these rows instead,
// one per roaming species at its own levels and weight (wildlife.js). The regions' rows (content/world/regions.js)
// are the same species, region by region; this table is for the draws that have no region (a legend's species where its
// region has no list, the time-to-kill tables, a draw above the parent's level 20).
//
//   LEVEL_POOL               [[type, weight, lo, hi]]: every wildlife species that roams (weight > 0) and isn't docile
//   pickRow(rand, rows, level) → type | null   a type by weight among the rows whose levels hold `level` (rand: a
//                            0..1 function; one draw), as gen/dungeon.js pickFrom draws a region's rows
//   rowsAt(rows, level) → rows               the rows that hold `level`
import { WILDLIFE } from "./wildlife.js";

const roams = (t) => t.weight > 0 && t.levels && t.temperament !== "docile" && !(t.damage[1] <= 1);
export const LEVEL_POOL = Object.entries(WILDLIFE).filter(([, t]) => roams(t)).map(([id, t]) => [id, t.weight, t.levels[0], t.levels[1]]);

export const rowsAt = (rows, level) => rows.filter(([, w, lo, hi]) => w > 0 && level >= lo && level <= hi);
export function pickRow(rand, rows, level) {
  const live = rowsAt(rows, level);
  if (!live.length) return null;
  let pick = rand() * live.reduce((s, r) => s + r[1], 0);
  for (const [type, w] of live) if ((pick -= w) < 0) return type;
  return live[live.length - 1][0];
}
