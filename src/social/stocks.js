// The surgeon's and the tinker's packs (WS5 #11, WS6b's content; content/creatures/people.js STOCKS; B3), as
// social/merchants.js stock tables: Old Ottilie's ("tinker": cells, one or two artifacts of her list, and the general
// pack beside them) and Detail C's at Benchmark ("surgeon": two or three implants of the grades its level allows, cells,
// nothing else). Implants are dear (IMPLANT_VALUE, 400-2,000 glim) and the pack is rolled once a world day, as every
// merchant's is (merchants.js restock), so a fitting stays a goal, not a habit.
import { registerStock, stockOf } from "./merchants.js";
import { STOCKS } from "../content/creatures/people.js";
import { IMPLANTS } from "../content/items/implants.js";
import { ARTIFACTS } from "../content/items/artifacts.js";
import { makeCell, makeArtifact } from "../bodymods/artifacts.js";
import { itemPrice } from "../items.js";
import { priceLevel } from "../currency.js";

const count = ([a, b], rng) => a + Math.floor(rng() * (b - a + 1));
// The highest grade a pack of this level holds: the last row of `grade` [[fromLevel, maxGrade], …] at or below it.
export const gradeCap = (rows, level) => rows.reduce((g, [lv, max]) => (level >= lv ? max : g), rows[0]?.[1] ?? 1);

function bodyPack(id) {
  const S = STOCKS[id];
  return (game, c, rng) => {
    const level = c.level || 1, out = [];
    for (const [cell, n] of S.cells || []) out.push({ item: makeCell(cell, rng, true), count: n });
    if (S.artifacts) {
      const pool = S.artifacts.from.filter((a) => ARTIFACTS[a]);
      for (let k = count(S.artifacts.count, rng); k > 0 && pool.length; k--) out.push({ item: makeArtifact(pool.splice(Math.floor(rng() * pool.length), 1)[0], rng), count: 1 });
    }
    if (S.implants) {
      const cap = gradeCap(S.implants.grade, level);
      const pool = Object.keys(IMPLANTS).filter((i) => (IMPLANTS[i].grade || 1) <= cap).sort();
      for (let k = count(S.implants.count, rng); k > 0 && pool.length; k--) out.push({ item: { kind: "implant", id: pool.splice(Math.floor(rng() * pool.length), 1)[0] }, count: 1 });
    }
    for (const s of out) s.price = Math.round(itemPrice(s.item) * priceLevel(level));
    return S.general ? [...stockOf("general")(game, c, rng), ...out] : out;
  };
}
for (const id of Object.keys(STOCKS)) registerStock(id, bodyPack(id));
