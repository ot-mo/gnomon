// Bodies and equipment slots (TECH_DESIGN §2.5): a body is a list of parts from a plan; gear goes
// on parts, implants in part sockets, and one weapon waits on the belt.
//
//   BODY_PLANS, registerBodyPlan(id, parts)   parts: [{ id, type, holds?, primary?, implant? }]
//   makeBody(planId) → Body                  { plan, parts, equip: { partId: item | null }, implants: { partId: item | null }, belt }
//   slotsFor(e, item) → partId[]             the parts it could go on (by ITEM_KINDS[kind].slot(it), a part type)
//   defaultPart(e, item) → partId | null     where E in the inventory puts it: the primary hand for weapons, else the
//                                            first part of its type (one ring at a time "as in the existing game",
//                                            bible §13.3; the second finger takes one only when asked by part id)
//   canEquip(game, e, item, partId) → { ok, reason, item?, need? }   reason: "part" | "slot" | "weak" | "cursed" | "broken" |
//                                                                   "shell" (Shellback: no body armour)
//   equip(game, e, item, partId) → { ok, removed: [], time, reason }   what it pushed off is the caller's to put away
//   unequip(game, e, partId) → { ok, item, reason }                  cursed things stick (reason "cursed")
//   worn(e) → item[]                          equipped items and implants, each once (bonus() sees implants too)
//   wielded(e) → item | null                 what the primary holding part holds
//   offhands(e) → item[]                     what the other holding parts hold (not a two-handed weapon twice)
//   wornOn(e, partId) → item | null          belt(e) → item | null
//   carried(e) → item[]                      worn, the belt, then the pack: everything you have
//   swapBelt(game, e) → { ok, time, reason } R: the weapon in hand and the one on the belt change places
//   addPart(e, part), removePart(e, partId) → item[]   extra limbs from mutations (WS4); what it held comes off
//   fittedEffect(e, effect) → bool          an implant fitted in one of e's parts names that effect (IMPLANTS[id].effect;
//                                            bodymods/implants.js implantEffect's question, for modules that load before it)
// Events: "gear" { e } after equip and unequip changed what e wears (B1: social/reputation.js syncWornRep follows it for
// worn reputation; it follows bodymods' "uninstall" too, as a part that comes off, removePart, has no game). Not sent
// without a game (character creation).
//
// A two-handed weapon (WEAPONS[id].hands === 2) takes every holding part: the primary one holds it
// and the others hold the primary's part id (a string), so no item sits in two places in a save.
// The order of a plan's parts is the order worn() lists them, which is the order bonuses are added:
// the humanoid plan starts with the parent game's four slots (weapon, armour, ring, amulet).
//
// Rules kept from the parent game: cursed gear sticks; the STR requirement of weapons and armour
// still refuses (0C turns it into a to-hit penalty with the d20 rules); equipping takes 1 s
// (RULES.body.equipTime, charged by the caller).
import { ITEM_KINDS } from "./items.js";
import { attr, invalidateStats, clampHp } from "./stats.js";
import { RULES } from "./rules.js";
import { emit } from "./events.js";
import { IMPLANTS } from "./content/items/implants.js";

export const BODY_PLANS = {};
export const fittedEffect = (e, effect) => !!e?.body?.implants && e.body.parts.some((q) => IMPLANTS[e.body.implants[q.id]?.id]?.effect === effect);
export function registerBodyPlan(id, parts) {
  if (BODY_PLANS[id]) throw new Error(`registerBodyPlan: ${id} already exists`);
  const ids = new Set();
  for (const p of parts) {
    if (!p.id || !p.type) throw new Error(`registerBodyPlan ${id}: every part needs an id and a type`);
    if (ids.has(p.id)) throw new Error(`registerBodyPlan ${id}: two parts are called ${p.id}`);
    ids.add(p.id);
  }
  if (parts.filter((p) => p.primary).length > 1) throw new Error(`registerBodyPlan ${id}: more than one primary part`);
  BODY_PLANS[id] = Object.freeze(parts.map((p) => Object.freeze({ ...p })));
}

registerBodyPlan("humanoid", [
  { id: "hand_r", type: "hand", holds: true, primary: true }, { id: "hand_l", type: "hand", holds: true },
  { id: "body", type: "body", implant: true },
  { id: "finger_r", type: "finger" }, { id: "finger_l", type: "finger" },
  { id: "neck", type: "neck" },
  { id: "head", type: "head", implant: true }, { id: "face", type: "face", implant: true },
  { id: "back", type: "back", implant: true }, { id: "arms", type: "arm", implant: true },
  { id: "hands", type: "gloves", implant: true }, { id: "feet", type: "feet", implant: true },
]);
// Animals: nothing to hold (their bite is their weapon, 0C), but barding, a collar or a pack fit.
registerBodyPlan("beast", [
  { id: "body", type: "body", implant: true }, { id: "neck", type: "neck" },
  { id: "head", type: "head", implant: true }, { id: "back", type: "back" }, { id: "feet", type: "feet" },
]);

export function makeBody(planId) {
  const plan = BODY_PLANS[planId];
  if (!plan) throw new Error(`makeBody: no body plan ${planId}`);
  const parts = plan.map((p) => ({ ...p }));
  return {
    plan: planId, parts,
    equip: Object.fromEntries(parts.map((p) => [p.id, null])),
    implants: Object.fromEntries(parts.filter((p) => p.implant).map((p) => [p.id, null])),
    belt: null,
  };
}

// --- Reading ----------------------------------------------------------------------------------
const partOf = (e, id) => e.body?.parts.find((p) => p.id === id) || null;
const held = (e, id) => {   // the item on a part, following a two-handed weapon to the part that holds it
  const v = e.body?.equip[id];
  return typeof v === "string" ? e.body.equip[v] : v || null;
};
export const wornOn = (e, partId) => held(e, partId);
export const belt = (e) => e.body?.belt || null;

export function worn(e) {
  const b = e.body;
  if (!b) return [];
  const out = [];
  for (const p of b.parts) {
    const it = b.equip[p.id];
    if (it && typeof it !== "string") out.push(it);
  }
  for (const p of b.parts) { const it = b.implants[p.id]; if (it) out.push(it); }
  return out;
}
const primaryPart = (e) => e.body?.parts.find((p) => p.primary) || e.body?.parts.find((p) => p.holds) || null;
export function wielded(e) {
  const p = primaryPart(e);
  return p ? held(e, p.id) : null;
}
export function offhands(e) {
  const b = e.body, main = primaryPart(e);
  if (!b) return [];
  return b.parts.filter((p) => p.holds && p !== main && b.equip[p.id] && typeof b.equip[p.id] !== "string").map((p) => b.equip[p.id]);
}
export const carried = (e) => [...worn(e), ...(belt(e) ? [belt(e)] : []), ...(e.inv || [])];

// --- Where things go --------------------------------------------------------------------------
const slotType = (it) => ITEM_KINDS[it?.kind]?.slot?.(it) || null;
const handsFor = (it) => ITEM_KINDS[it.kind]?.hands?.(it) || 1;
export function slotsFor(e, it) {
  const type = slotType(it);
  if (!type || !e.body) return [];
  return e.body.parts.filter((p) => p.type === type).map((p) => p.id);
}
export function defaultPart(e, it) {
  const ids = slotsFor(e, it);
  if (!ids.length) return null;
  const main = primaryPart(e);
  return main && ids.includes(main.id) ? main.id : ids[0];
}
// The parts an item would take if put on `partId`: a two-handed weapon takes every holding part.
function partsTaken(e, it, partId) {
  const part = partOf(e, partId);
  if (part?.holds && handsFor(it) >= 2) {
    const holders = e.body.parts.filter((p) => p.holds);
    return holders.length >= 2 ? [partId, ...holders.map((p) => p.id).filter((id) => id !== partId)] : null;
  }
  return [partId];
}
// What has to come off for it to go on (each once).
const occupants = (e, ids) => [...new Set(ids.map((id) => held(e, id)).filter(Boolean))];

export function canEquip(game, e, it, partId = defaultPart(e, it)) {
  const part = partOf(e, partId);
  if (!part) return { ok: false, reason: "part" };
  if (slotType(it) !== part.type) return { ok: false, reason: "slot" };
  if (held(e, partId) !== it && worn(e).includes(it)) return { ok: false, reason: "worn" };   // one item, one place (else its bonuses count twice)
  if (it.broken) return { ok: false, reason: "broken" };   // (a snapped bone weapon, B1: mended first, items.js mendItem)
  // Shellback (bible §13.5 "no body armour"; B1, WS4 #19): the shell takes nothing heavier than clothes on the body.
  if (e.mutations?.shellback && part.type === "body" && it.kind === "armour" && it.id !== "clothes") return { ok: false, reason: "shell" };
  const ids = partsTaken(e, it, partId);
  if (!ids) return { ok: false, reason: "slot" };   // two-handed, one hand
  const need = ITEM_KINDS[it.kind]?.req?.(it)?.str;
  if (need !== undefined && attr(e, "str") < need) return { ok: false, reason: "weak", need };
  const stuck = occupants(e, ids).find((o) => o.ench < 0);
  if (stuck) return { ok: false, reason: "cursed", item: stuck };
  return { ok: true };
}

// Puts it on and returns what came off (in part order). Doesn't touch the pack or the belt.
export function equip(game, e, it, partId = defaultPart(e, it)) {
  const check = canEquip(game, e, it, partId);
  if (!check.ok) return { ok: false, removed: [], time: 0, reason: check.reason, item: check.item, need: check.need };
  const ids = partsTaken(e, it, partId);
  const removed = occupants(e, ids);
  for (const r of removed) clearItem(e, r);
  e.body.equip[ids[0]] = it;
  for (const id of ids.slice(1)) e.body.equip[id] = ids[0];
  invalidateStats(e);   // STR, max HP and armour follow your gear (stats.js)
  clampHp(e);
  if (game) emit(game, "gear", { e });
  return { ok: true, removed, time: RULES.body.equipTime };
}
function clearItem(e, it) {
  const eq = e.body.equip;
  const at = Object.keys(eq).find((id) => eq[id] === it);
  if (!at) return;
  for (const id in eq) if (id === at || eq[id] === at) eq[id] = null;
}

export function unequip(game, e, partId) {
  const it = held(e, partId);
  if (!it) return { ok: false, item: null, reason: "empty" };
  if (it.ench < 0) return { ok: false, item: it, reason: "cursed" };
  clearItem(e, it);
  invalidateStats(e);
  clampHp(e);
  if (game) emit(game, "gear", { e });
  return { ok: true, item: it };
}

// R: the weapon in your hand and the one on your belt change places. (The caller says why not.)
export function swapBelt(game, e) {
  const b = e.body, main = primaryPart(e);
  if (!b || !main) return { ok: false, time: 0, reason: "part" };
  if (!b.belt) return { ok: false, time: 0, reason: "empty" };
  const inHand = held(e, main.id);
  if (inHand && inHand.ench < 0) return { ok: false, time: 0, reason: "cursed", item: inHand };
  const next = b.belt;
  const check = canEquip(game, e, next, main.id);
  if (!check.ok && check.reason !== "cursed") return { ok: false, time: 0, reason: check.reason, need: check.need };
  if (check.reason === "cursed") return { ok: false, time: 0, reason: "cursed", item: check.item };   // an off-hand that sticks
  const { removed } = equip(game, e, next, main.id);
  b.belt = removed.find((r) => r === inHand) || null;
  for (const r of removed) if (r !== inHand) (e.inv ||= []).push(r);   // a second weapon pushed out of the off hand
  return { ok: true, time: RULES.body.beltSwap };
}

// --- Extra limbs (mutations, WS4) -----------------------------------------------------------
export function addPart(e, part) {
  if (!e.body || !part?.id || !part.type) throw new Error("addPart: needs a body and a part with an id and a type");
  if (partOf(e, part.id)) throw new Error(`addPart: ${part.id} already exists`);
  e.body.parts.push({ ...part });
  e.body.equip[part.id] = null;
  if (part.implant) e.body.implants[part.id] = null;
  invalidateStats(e);
}
// Whatever it held comes off (curses don't help a limb that's gone) and is returned for the caller.
export function removePart(e, partId) {
  if (!partOf(e, partId)) return null;
  const it = held(e, partId), implant = e.body.implants[partId] || null;
  if (it) clearItem(e, it);
  e.body.parts = e.body.parts.filter((p) => p.id !== partId);
  delete e.body.equip[partId];
  delete e.body.implants[partId];
  invalidateStats(e);
  clampHp(e);
  return [it, implant].filter(Boolean);
}
