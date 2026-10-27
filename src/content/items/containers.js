// Containers (TECH_DESIGN §2.10; WS6b). DECISIONS §1 rules out a liquid backing: glim is a counter, so nothing here
// holds or backs money. What is here is the one container the Kindling needs: a vial, for carrying one unit of a
// faction's sacrament to pour in the rite (bible §3.3: "+20 with the creature's own faction"), or for drinking.
//
//   CONTAINERS[id] = { name, holds, price }     holds: units of one liquid (no mixing: DECISIONS)
//
// The item kind "vial": { kind: "vial", effect: liquidId | "" } (the liquid is `effect`, so vials of one liquid
// stack, and empty ones stack apart). Using a full vial drinks it (social/liquids.js drinkLiquid) and keeps the
// empty vial; using an empty one fills it from water at your feet or beside you (whatever liquid that water is:
// social/liquids.js liquidAt). Its price is the vial's plus its liquid's value.
import { registerItemKind, addToInventory, takeOne } from "../../items.js";
import { LIQUIDS } from "../liquids.js";
import { liquidAt, liquidDef, liquidName, drinkLiquid } from "../../social/liquids.js";
import { B } from "../../world.js";
import { RULES } from "../../rules.js";

export const CONTAINERS = {
  vial: { name: "vial", holds: 1, price: 3 },
};

const EMPTY_GLASS = [190, 205, 215];
const liquidColor = (id) => liquidDef(id)?.color || EMPTY_GLASS;

// Water within one tile of e, from a block below its feet to its knees (not a pool at the foot of a cliff, nor a
// tank on the roof): [x, y] of the nearest column, or null.
function waterBeside(zone, e) {
  const x0 = Math.floor(e.x), y0 = Math.floor(e.y);
  let best = null;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || y < 0 || x >= zone.w || y >= zone.d) continue;
      const feet = Math.floor(e.z);
      for (let z = Math.max(0, feet - 1); z <= Math.min(zone.h - 1, feet); z++) {
        const b = zone.get(x, y, z);
        if (b === B.WATER_SHALLOW || b === B.WATER_DEEP) { if (!best || Math.abs(dx) + Math.abs(dy) < best.d) best = { x, y, d: Math.abs(dx) + Math.abs(dy) }; break; }
      }
    }
  return best && [best.x, best.y];
}

registerItemKind("vial", {
  stack: true, weight: () => 0.2,
  name: (game, it) => (it.effect ? `vial of ${liquidName(it.effect)}` : "empty vial"),
  glyph: (game, it) => ["!", liquidColor(it.effect)],
  info: (game, it) => {
    if (!it.effect) return "Glass, stoppered. Use it beside water to fill it.";
    const d = liquidDef(it.effect);
    return d ? `Drink: ${d.drink}. Poured in the Kindling, it is the sacrament of whoever holds it holy.` : "Something wet.";
  },
  price: (it) => CONTAINERS.vial.price + (it.effect ? liquidDef(it.effect)?.value || 0 : 0),
  art: { w: 0.22, h: 0.36, art: [" c ", " g ", "grg", "grg", "ggg"] },
  palette: (game, it) => ({ c: [[140, 95, 55], 0], g: [EMPTY_GLASS, 0], r: [liquidColor(it.effect), it.effect ? 0.4 : 0] }),
  use(game, e, it) {
    if (it.effect) {
      const id = it.effect;
      takeOne(e, it);
      addToInventory(e, { kind: "vial", effect: "" });
      drinkLiquid(game, e, id);
      return RULES.body.drinkTime;
    }
    const at = waterBeside(game.zone, e);
    if (!at) { if (e === game.player) game.log("There's no water beside you to fill it from.", [170, 170, 170]); return 0; }
    const id = liquidAt(game.zone, at[0], at[1]);
    takeOne(e, it);
    addToInventory(e, { kind: "vial", effect: LIQUIDS[id]?.sameAs || id });
    if (e === game.player) game.log(`You fill a vial with ${liquidName(id)}.`, liquidColor(id));
    return RULES.body.drinkTime;
  },
});
