// World liquids (TECH_DESIGN §2.10 "World liquids are separate from money", §2.2 zone.liquid / zone.liquids;
// DECISIONS §1: one dominant liquid per tile, no mixing; liquids are the factions' sacraments for the Kindling and
// the base of tonics; bible §13.7; owner WS6b). The data is content/liquids.js.
//
//   liquidAt(zone, x, y) → liquidId     which liquid the water blocks of column (x, y) hold: zone.liquids[x + y ×
//                                       zone.w] (WS2 sets them; a plain object, so it is JSON), else the zone's
//                                       default zone.liquid, else "water" (fresh water)
//   liquidDef(id) → def | null          the table's entry, through `sameAs` ("water" is fresh water)
//   sameLiquid(a, b) → bool             one liquid under two ids ("water" and "freshWater")
//   liquidName(id) → string
//   sacramentOf(factionId) → liquidId | "any" | null    content/factions.js `liquid` ("any, poured": the Unlit)
//   isSacrament(factionId, liquidId) → bool
//   drinkLiquid(game, e, id) → line     what drinking one vial of it does (bible §13.7, with the statuses the game
//                                       has: see below); the line is logged for you
//
// What drinking does, where the bible asks for more than the game has: brine's nausea and glim's glow are a line,
// not a status; ink makes you Flat (the core status) for 60 s − 3 s per TOU modifier; umbra gives darkSight for a
// minute ("nightEyes"); quicksilver poisons; a second sunwine within 10 s stuns you for 2 s (the "confusion");
// turnwater and clear glim do only their words until mutations (WS4b), implants (WS5) and the Plane's sight
// (WS3) take them up. No liquid is money.
import { LIQUIDS } from "../content/liquids.js";
import { FACTIONS } from "../factions.js";
import { addStatus, registerStatus } from "../status.js";
import { maxHp, mod } from "../stats.js";

export function liquidAt(zone, x, y) {
  const own = zone?.liquids?.[x + y * (zone?.w || 0)];
  return own || zone?.liquid || "water";
}

export function liquidDef(id) {
  const d = LIQUIDS[id];
  return d?.sameAs ? LIQUIDS[d.sameAs] || null : d || null;
}
const canon = (id) => LIQUIDS[id]?.sameAs || id;
export const sameLiquid = (a, b) => !!a && !!b && canon(a) === canon(b);
export const liquidName = (id) => liquidDef(id)?.name || id || "nothing";

export function sacramentOf(factionId) {
  const l = FACTIONS[factionId]?.liquid;
  if (!l) return null;
  return /^any\b/.test(l) ? "any" : l;
}
export function isSacrament(factionId, liquidId) {
  const s = sacramentOf(factionId);
  return !!liquidId && (s === "any" ? !!liquidDef(liquidId) : sameLiquid(s, liquidId));
}

registerStatus("nightEyes", { color: [150, 130, 210], kind: "good", t: 60, bonus: () => ({ darkSight: 1 }),
  hud: (s) => `NIGHT EYES ${Math.ceil(s.t)}s`, ended: "The dark closes in again." });

const heal = (e, n) => { const before = e.hp; e.hp = Math.min(maxHp(e), e.hp + n); return e.hp - before; };
const hurt = (game, e, n, source) => { if (e === game.player) game.hurtPlayer(n, source); else e.hp -= n; };

const DRINK = {
  freshWater: (game, e) => `Cool and clean. (+${heal(e, 2)} HP)`,
  glim: (game, e) => { hurt(game, e, 1, "a mouthful of glim"); return "Lamp oil. Your mouth glows and your stomach doesn't forgive you. (1 damage)"; },
  brine: (game, e) => { hurt(game, e, 1, "brine"); return "Salt. Your stomach turns over. (1 damage)"; },
  ink: (game, e) => {
    const t = Math.max(10, 60 - 3 * mod(e, "tou"));
    addStatus(game, e, "flat", { t, stack: "max" });
    return `The ink goes down like a closing book. You are Flat. (${t} s)`;
  },
  umbra: (game, e) => { addStatus(game, e, "nightEyes", { t: 60, stack: "refresh" }); return "Liquid shadow. The dark opens like an eye. (Night eyes, 60 s)"; },
  quicksilver: (game, e) => { addStatus(game, e, "poisoned", { t: 6, stack: "max" }); return "Heavy and cold. It finds the lowest place in you. (Poisoned)"; },
  sunwine: (game, e) => {
    const again = e.sunwineAt !== undefined && (game.time || 0) - e.sunwineAt < 10;
    e.sunwineAt = game.time || 0;
    const healed = heal(e, 6);
    if (again) { addStatus(game, e, "stunned", { t: 2, stack: "max" }); return `Sunwine on sunwine. The sky turns a slow wheel. (+${healed} HP, stunned)`; }
    return `It tastes of noon. (+${healed} HP)`;
  },
  turnwater: () => "Something in you turns over once, and settles. Nothing else happens. Yet.",
  clearGlim: () => "It burns clear all the way down. For a moment the floor looks very thin.",
  blood: () => "Copper and regret. Nothing good comes of it.",
  longbackMilk: (game, e) => `Sour and thick. (+${heal(e, 3)} HP)`,
  mulchWine: (game, e) => `The ground tilts and comes back. (+${heal(e, 2)} HP)`,
  sap: (game, e) => `It sticks in the throat. (+${heal(e, 1)} HP)`,
};

export function drinkLiquid(game, e, id) {
  const key = canon(id), fn = DRINK[key];
  const line = fn ? fn(game, e) : `You drink the ${liquidName(id)}. Nothing happens.`;
  if (e === game.player) game.log(line, liquidDef(id)?.color || [170, 190, 230]);
  return line;
}
