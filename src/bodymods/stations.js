// Stations (TECH_DESIGN §8.3 "WS5"; DECISIONS §1: the Truing Cradle; bible §10.4, §13.6): the blocks where implants
// go in, used through interact.js's registerUse (§1.4), and the services a surgeon or a tinker sells through
// talk.js registerService (their trade screen is WS6b's; P0's shop already lists services).
//
//   CRADLE                         the block id: blocks.js's reserved STATION ("Truing Cradle", ¤ on the map outdoors;
//                                  set by the integrator at the WS5 merge)
//   useCradle(game, x, y, z)       E on it in 3D, walking into it on the map: the Truing Cradle screen
//                                  (screens/equipment.js) for the Plumb; anyone else is told it isn't for them
//   SERVICES                       fitImplant · removeImplant (a surgeon: the same rules, fee and hour as a Cradle),
//                                  identifyArtifact (a tinker: 10 glim × complexity, bible §13.4) · rechargeCell (a glim
//                                  cell, a glim for every 100 charge missing) · drainCell (a cell's charge into your purse,
//                                  100 charge a glim, as far as the purse holds). A merchant offers one when its
//                                  services list names it (no legacy merchant does, so nothing changes in the old game).
import { registerUse } from "../interact.js";
import { registerService } from "../talk.js";
import { B } from "../world.js";
import { itemName } from "../items.js";
import { receive, formatPrice, purseRoom } from "../currency.js";
import { IMPLANTS } from "../content/items/implants.js";
import { ARTIFACTS, CELLS } from "../content/items/artifacts.js";
import { canInstall, install, uninstall, socketsFor, installedImplants, fittingFee, withTruing, isPlumb, partWord } from "./implants.js";
import { identify, cellOf, cellMax, CHARGE_PER_GLIM } from "./artifacts.js";
import { openTruing } from "../screens/equipment.js";
import { repOf } from "../factions.js";

export const CRADLE = B.STATION;

export function useCradle(game, x, y, z) {
  if (!isPlumb(game.player)) {
    game.log("A Truing Cradle: straps, gauges and a plumb-line over a padded frame. It is cut to a Plumb's measure, not yours.", [150, 210, 230]);
    return false;
  }
  const free = squareFree(game);
  if (free) game.log("The assizer at the Cradle waves your purse away: the Rule fits its own for nothing.", [150, 210, 230]);
  openTruing(game, { at: "cradle", x, y, z, ...(free ? { waive: true } : {}) });
  return true;
}
// Truing Cradle #3, on the Square's first floor down, fits a Plumb for free at Assize Warm or better (bible §5 M: +250;
// WS5 #20's other half, B2, C1b #9).
export const squareFree = (game) => game.zone?.landmarkId === "square" && game.zone.z === 1 && repOf(game, "assize") >= REP_WARM;
const REP_WARM = 250;
registerUse(CRADLE, useCradle, { label: (game) => (isPlumb(game.player) ? "lie down in the Truing Cradle" : "a Truing Cradle") });

// --- Services -------------------------------------------------------------------------------------------------
const surgeon = (c) => ({ at: "surgeon", c });
export const SERVICES = ["fitImplant", "removeImplant", "identifyArtifact", "rechargeCell", "drainCell"];

registerService("fitImplant", {
  available: (game, c) => {
    const p = game.player, out = [];
    for (const item of p.inv) if (item.kind === "implant")
      for (const partId of socketsFor(p, item)) if (withTruing(game, surgeon(c), () => canInstall(game, p, item, partId).ok)) out.push({ item, partId });
    return out;
  },
  label: (game, c, t) => `Fit the ${itemName(game, t.item)} (${partWord(game.player.body.parts.find((q) => q.id === t.partId).type)})`,
  price: (game, c, t) => fittingFee(t.item),
  info: (game, c, t) => `${IMPLANTS[t.item.id].info} Grade ${IMPLANTS[t.item.id].grade}; a world hour on the table.`,
  run(game, c, t) {
    const r = withTruing(game, surgeon(c), () => install(game, game.player, t.item, t.partId, { paid: true }));
    if (!r.ok) { receive(game, game.player, fittingFee(t.item)); t.failed = r.reason; }
  },
  done: (game, c, t, price) => (t.failed ? `${c.name} won't fit it now (${t.failed === "hunted" ? "not with something hunting you" : "it won't go in"}). Your ${formatPrice(price)} comes back.`
                                         : `${c.name} fits the ${itemName(game, t.item)}. An hour passes. (${formatPrice(price)})`),
});
registerService("removeImplant", {
  available: (game, c) => (isPlumb(game.player) ? installedImplants(game.player).map(({ partId, item }) => ({ partId, item })) : []),
  label: (game, c, t) => `Take out the ${itemName(game, t.item)}${IMPLANTS[t.item.id]?.destroyOnRemove ? " (it will be destroyed)" : ""}`,
  price: () => 0,
  info: () => "The grade comes back. A world hour on the table.",
  run(game, c, t) { const r = withTruing(game, surgeon(c), () => uninstall(game, game.player, t.partId)); t.failed = r.ok ? null : r.reason; t.destroyed = r.destroyed; },
  done: (game, c, t) => (t.failed ? `${c.name} can't take it out now.` : `${c.name} takes out the ${itemName(game, t.item)}${t.destroyed ? ", which crumbles" : ""}. An hour passes.`),
});
registerService("identifyArtifact", {
  available: (game) => game.player.inv.filter((it) => it.kind === "artifact" && it.known !== true && !it.broken),
  label: (game, c, it) => `Examine the ${itemName(game, it)}`,
  price: (game, c, it) => 10 * (ARTIFACTS[it.id]?.complexity || 1),
  info: () => "A tinker works out what it is, and nothing breaks.",
  run: (game, c, it) => { identify(game, it); },
  done: (game, c, it, price) => `${c.name} turns it over: it's a ${ARTIFACTS[it.id].name}. (${formatPrice(price)})`,
});
registerService("rechargeCell", {
  // Glim cells only (bible §13.4: a tinker, or 25 glim); sun and dark cells fill themselves, a heart cell never.
  available: (game) => game.player.inv.filter((it) => { const cell = cellOf(it), d = CELLS[cell?.id]; return d?.recharge === "glim" && cell.charge < d.charge; }),
  label: (game, c, it) => `Recharge the ${itemName(game, it)}${it.kind === "artifact" ? "'s cell" : ""}`,
  price: (game, c, it) => Math.max(1, Math.ceil((cellMax(cellOf(it)) - cellOf(it).charge) / CHARGE_PER_GLIM)),
  info: () => "A glim for every 100 charge.",
  run: (game, c, it) => { const cell = cellOf(it); cell.charge = cellMax(cell); },
  done: (game, c, it, price) => `${c.name} fills it to the brim. (${formatPrice(price)})`,
});
// Draining a cell into your purse (bible §3.1: glim is "drained from Deepwright cells", 100 charge a glim): the tinker
// pays out what your purse has room for, and the cell is left with the rest.
registerService("drainCell", {
  available: (game) => game.player.inv.filter((it) => it.kind === "cell" && Math.floor(it.charge / CHARGE_PER_GLIM) > 0),
  label: (game, c, it) => `Drain the ${itemName(game, it)} into your purse (${formatPrice(Math.floor(it.charge / CHARGE_PER_GLIM))})`,
  price: () => 0,
  info: () => "100 charge a glim, up to what your purse holds.",
  run(game, c, it) {
    const glim = Math.min(Math.floor(it.charge / CHARGE_PER_GLIM), purseRoom(game.player));
    receive(game, game.player, glim);
    it.charge -= glim * CHARGE_PER_GLIM;
    it.drained = glim;
  },
  done: (game, c, it) => (it.drained ? `${c.name} drains the cell: ${formatPrice(it.drained)} into your purse.` : "Your purse is full."),
});
