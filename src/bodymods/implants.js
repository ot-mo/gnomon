// Implants (TECH_DESIGN §2.5 "Implants", §2.8; §1.4 "bodymods (WS5)"; DECISIONS §1: the plumb genotype, its
// grade and true-marks; bible §10.4, §13.6, §15.6). The table is content/items/implants.js.
//
//   canInstall(game, p, item, partId) → { ok, reason }    reason: "kind" (not an implant), "genotype" (only the
//       plumb take implants), "station" (only at a Truing Cradle or with a surgeon: game.truing), "part" (no such
//       part, or one without a socket), "slot" (the implant doesn't go there), "taken" (the socket holds one),
//       "twice" (one of each, but plate grafts, up to their max), "grade" (over the grade you hold; need, have)
//   install(game, p, item, partId, { free, paid }) → { ok, reason, time, fee, item }
//       into p.body.implants[partId]: pays the fee (25 glim × its grade; reason "funds") and lies you down for
//       one world hour (skipTime: a hunt nearby refuses it, reason "hunted", and nothing is paid or fitted);
//       takes the item out of the pack; a part it adds (the folding rack) appears; invalidateStats; emits
//       "install" { e, item, partId }. free: no station, fee or hour (WS4's starting implant); paid: the fee
//       is already paid (a surgeon's service).
//   uninstall(game, p, partId) → { ok, item, reason, destroyed, dropped }
//       the curse lock: refused ("station") anywhere but a Cradle or a surgeon. Gives the grade back (it is
//       counted from what is installed, never stored); a † implant is destroyed, any other goes to the pack;
//       a part it added goes, and what that part held goes to the pack (dropped); an hour passes as for
//       fitting; emits "uninstall" { e, item, partId, destroyed }.
//   gradeOf(p), gradeUsed(p), gradeFree(p)   the grade you hold (p.license.grade; the plumb start at 2), what
//       your implants count against it, what is left
//   trueMarks(p)          true-marks held (p.credits)
//   gradeCost(p) → n      true-marks for the next grade: 1 up to grade 8, then 2 (bible §15.6)
//   raiseGrade(game, p) → { ok, reason, cost }   spends them (reason "marks", "genotype")
//   installedImplants(e) → [{ partId, item, def }]   socketsFor(e, item) → partIds it could go into
//   implantEffect(e, effect) → bool       an installed implant names that effect (IMPLANTS[id].effect)
//   fittingFee(item) → glim               IMPLANT_FEE × grade
//   grantImplant(p, id, partId) → item    a free implant put straight in (character creation, WS4)
//   withTruing(game, at, fn)              runs fn with game.truing = at ({ at: "cradle", x, y, z } or
//                                         { at: "surgeon", c }): the station or surgeon context, never saved
// The implant item kind (`implant`, { kind, id }) and the true-mark kind (`credit`, { kind, count }: walked
// over, it is counted into p.credits) are registered here; so are the implant abilities (plane-shunt,
// jump-back node, dial spine), the "implant" ability source and the "stilled" status.
import { IMPLANTS, IMPLANT_VALUE } from "../content/items/implants.js";
import { registerItemKind, takeOne } from "../items.js";
import { addPart, removePart } from "../body.js";
import { invalidateStats, clampHp, cooldownMul } from "../stats.js";
import { registerAbility, registerAbilitySource } from "../abilities.js";
import { registerStatus, addStatus } from "../status.js";
import { pay, funds, formatPrice } from "../currency.js";
import { skipTime } from "../time.js";
import { arrivalPoint } from "../zones.js";
import { emit } from "../events.js";

export const START_GRADE = 2;      // bible §15.6: grade 2 and one free implant of grade 2 or less
export const IMPLANT_FEE = 25;     // glim per grade to fit one
export const FITTING_TIME = 60;    // one world hour of game time (RULES.clock: a world minute is 1 s)
export const MAX_SAME = { plateGraft: 3 };

// --- The grade and true-marks -------------------------------------------------------------------------
export const isPlumb = (p) => p?.genotype === "plumb";
export const gradeOf = (p) => p?.license?.grade ?? (isPlumb(p) ? START_GRADE : 0);
export const trueMarks = (p) => p?.credits || 0;
export function installedImplants(e) {
  const b = e?.body;
  if (!b) return [];
  return b.parts.filter((q) => b.implants[q.id]).map((q) => ({ partId: q.id, item: b.implants[q.id], def: IMPLANTS[b.implants[q.id].id] || null }));
}
export const gradeUsed = (p) => installedImplants(p).reduce((s, { def }) => s + (def?.grade || 0), 0);
export const gradeFree = (p) => gradeOf(p) - gradeUsed(p);
export const gradeCost = (p) => (gradeOf(p) < 8 ? 1 : 2);
export function raiseGrade(game, p) {
  if (!isPlumb(p)) return { ok: false, reason: "genotype" };
  const cost = gradeCost(p);
  if (trueMarks(p) < cost) return { ok: false, reason: "marks", cost };
  p.credits = trueMarks(p) - cost;
  p.license = { ...(p.license || {}), grade: gradeOf(p) + 1 };
  emit(game, "grade", { e: p, grade: p.license.grade });
  return { ok: true, cost };
}

export const implantEffect = (e, effect) => installedImplants(e).some(({ def }) => def?.effect === effect);
export const fittingFee = (it) => IMPLANT_FEE * (IMPLANTS[it?.id]?.grade || 0);

export function socketsFor(e, it) {
  const def = IMPLANTS[it?.id];
  if (it?.kind !== "implant" || !def || !e?.body) return [];
  return e.body.parts.filter((q) => q.implant && def.parts.includes(q.type)).map((q) => q.id);
}

// The station or surgeon you are with while fn runs (stations.js, the surgeon services, the truing screen).
export function withTruing(game, at, fn) {
  const was = game.truing;
  game.truing = at;
  try { return fn(); } finally { game.truing = was; }
}

// --- Fitting and removing -----------------------------------------------------------------------------
export function canInstall(game, p, item, partId, { free = false } = {}) {
  const def = IMPLANTS[item?.id];
  if (item?.kind !== "implant" || !def) return { ok: false, reason: "kind" };
  if (!isPlumb(p)) return { ok: false, reason: "genotype" };
  if (!free && !game?.truing) return { ok: false, reason: "station" };
  const part = p.body?.parts.find((q) => q.id === partId);
  if (!part || !part.implant) return { ok: false, reason: "part" };
  if (!def.parts.includes(part.type)) return { ok: false, reason: "slot" };
  if (p.body.implants[partId]) return { ok: false, reason: "taken", item: p.body.implants[partId] };
  const same = installedImplants(p).filter((x) => x.item.id === item.id).length;
  if (same >= (MAX_SAME[item.id] || 1)) return { ok: false, reason: "twice" };
  if (installedImplants(p).some((x) => x.item === item)) return { ok: false, reason: "twice" };
  if (def.grade > gradeFree(p)) return { ok: false, reason: "grade", need: def.grade, have: gradeFree(p) };
  return { ok: true };
}

// One world hour on the table, in either view (the same skipTime). A hunt within reach refuses it.
function lieStill(game) {
  const r = skipTime(game, FITTING_TIME, { reason: "truing" });
  return r.elapsed > 0 || !r.interrupted;
}

// paid: the fee is already paid (a surgeon's service: the shop takes the price before it runs).
export function install(game, p, item, partId, { free = false, paid = false } = {}) {
  const check = canInstall(game, p, item, partId, { free });
  if (!check.ok) return { ok: false, reason: check.reason, need: check.need, have: check.have, time: 0, fee: 0 };
  const fee = free || paid ? 0 : fittingFee(item);
  if (fee > funds(p)) return { ok: false, reason: "funds", fee, time: 0 };
  const t0 = game?.time ?? 0;
  if (!free && !lieStill(game)) return { ok: false, reason: "hunted", time: 0, fee: 0 };
  if (fee) pay(game, p, fee);
  if (p.inv?.includes(item)) takeOne(p, item);
  p.body.implants[partId] = item;
  const def = IMPLANTS[item.id];
  if (def.addsPart && !p.body.parts.some((q) => q.id === def.addsPart.id)) addPart(p, def.addsPart);
  invalidateStats(p);
  clampHp(p);
  if (game) emit(game, "install", { e: p, item, partId });
  return { ok: true, time: (game?.time ?? 0) - t0, fee, item };
}

export function uninstall(game, p, partId) {
  const item = p?.body?.implants?.[partId];
  if (!item) return { ok: false, item: null, reason: "empty" };
  if (!game?.truing) return { ok: false, item, reason: "station" };
  if (!lieStill(game)) return { ok: false, item, reason: "hunted" };
  const def = IMPLANTS[item.id] || {};
  p.body.implants[partId] = null;
  let dropped = [];
  if (def.addsPart && !installedImplants(p).some((x) => IMPLANTS[x.item.id]?.addsPart?.id === def.addsPart.id))
    dropped = removePart(p, def.addsPart.id) || [];
  for (const d of dropped) (p.inv ||= []).push(d);
  const destroyed = !!def.destroyOnRemove;
  if (!destroyed) (p.inv ||= []).push(item);   // (the item itself: it was never on the floor)
  invalidateStats(p);
  clampHp(p);
  emit(game, "uninstall", { e: p, item, partId, destroyed });
  return { ok: true, item, destroyed, dropped };
}

// A free implant put straight in: WS4's character creation (bible §15.6: grade 2 and one implant of grade ≤ 2).
export function grantImplant(p, id, partId = null) {
  const item = { kind: "implant", id };
  const part = partId || socketsFor(p, item).find((q) => !p.body.implants[q]);
  return install(null, p, item, part, { free: true }).ok ? item : null;
}

// --- The item kinds ----------------------------------------------------------------------------------
const STEEL = [[150, 175, 195], 0.15], GLOW = [[120, 230, 255], 0.7];
registerItemKind("implant", {
  stack: false, weight: () => 1,
  name: (game, it) => IMPLANTS[it.id]?.name || "implant",
  glyph: () => ["♦", [120, 210, 235]],
  info: (game, it) => {
    const d = IMPLANTS[it.id];
    return d ? `${d.info} Grade ${d.grade}; goes in: ${d.parts.map(partWord).join(", ")}.` : "";
  },
  details: (game, it) => {
    const d = IMPLANTS[it.id];
    if (!d) return [];
    return [d.info, `Grade ${d.grade} (you hold ${gradeOf(game?.player)}, ${gradeFree(game?.player)} free).`,
      `Goes in: ${d.parts.map(partWord).join(", ")}. Fitting costs ${formatPrice(fittingFee(it))} and a world hour.`,
      d.destroyOnRemove ? "Taking it out destroys it." : "Taking it out gives the grade back."];
  },
  price: (it) => IMPLANT_VALUE(IMPLANTS[it.id]?.grade || 1),
  bonuses: (it) => ({ ...(IMPLANTS[it.id]?.bonus || {}) }),
  use(game, e, it) {   // E in the pack: where it goes in
    game.log(isPlumb(e) ? `The ${IMPLANTS[it.id]?.name || "implant"} goes in at a Truing Cradle, or by a surgeon's hand.`
                        : "Implants are cut for the Plumb: no Cradle will fit one into you.", [150, 210, 230]);
    return 0;
  },
  art: { w: 0.3, h: 0.3, art: [" sss ", "sgGgs", "sGGGs", "sgGgs", " sss "] },
  palette: () => ({ s: STEEL, g: [[80, 150, 180], 0.4], G: GLOW }),
});
registerItemKind("credit", {   // a true-mark (bible §10.4): the Plumb's grade grows with them
  stack: true, weight: () => 0, price: () => 0, sound: "crystal",
  name: (game, it) => ((it.count || 1) > 1 ? "true-marks" : "true-mark"),
  glyph: () => ["¶", [235, 235, 210]],
  info: () => "A brass plumb-mark stamped with a line. The Plumb raise their grade with these at a Truing Cradle.",
  art: { w: 0.24, h: 0.34, art: ["  y  ", " yYy ", "  y  ", "  y  ", " yYy ", "yyyyy"] },
  palette: () => ({ y: [[210, 180, 110], 0.3], Y: [[255, 240, 190], 0.7] }),
  onPickup(game, e, it) {
    const n = it.count || 1;
    e.credits = (e.credits || 0) + n;
    game.log(n > 1 ? `You pick up ${n} true-marks.` : "You pick up a true-mark.", [235, 235, 210]);
    return true;
  },
});
const PART_WORDS = { gloves: "hands", arm: "arms" };
export const partWord = (type) => PART_WORDS[type] || type;

// --- Abilities and the status they use ----------------------------------------------------------------
registerAbilitySource("implant", (e) => installedImplants(e).filter(({ def }) => def?.ability).map(({ item, def }) => ({ id: def.ability, lvl: 1, item })));

registerStatus("stilled", { color: [200, 210, 230], kind: "bad", t: 5, stack: "max", flags: { noAct: true, noMove: true },
  hud: (s) => `STILL ${Math.ceil(s.t)}s` });

registerAbility("planeShunt", {
  name: "Plane-shunt", source: "implant", target: "self", cooldown: () => 40, mapTime: 0.5,
  info: () => "Fold yourself down into the Plane: Flat for 4 s.",
  use(game, e) { addStatus(game, e, "flat", { t: 4 }); if (e === game.player) game.log("The shunt clicks. The world folds flat around you.", [220, 220, 230]); return true; },
});
registerAbility("jumpBack", {
  name: "Jump-back node", source: "implant", target: "self", cooldown: () => 100, mapTime: 0.5,
  info: () => "Back to somewhere you have been on this floor.",
  use(game, e) {
    const zone = game.zone, seen = [];
    for (let i = 0; i < zone.w * zone.d; i++) if (zone.seen[i] && zone.stand[i] >= 0) seen.push(i);
    if (!seen.length) return false;
    const i = seen[Math.floor(Math.random() * seen.length)];
    const at = arrivalPoint(zone, "teleport", { fx: (i % zone.w) + 0.5, fy: Math.floor(i / zone.w) + 0.5, yaw: e.yaw,
      anchor: { x: e.x, y: e.y }, strict: true, ok: (x, y) => !zone.creatures.some((c) => c.tx === x && c.ty === y) });
    if (!at) return false;
    Object.assign(e, { x: at.x, y: at.y, z: at.z, vz: 0 });
    if (e === game.player) { game.travel = null; game.log("The node tugs. You are somewhere you have been before.", [200, 160, 255]); }
    return true;
  },
});
registerAbility("dialSpine", {
  // Once a world day whatever your WIL (abilities.js scales every cooldown by cooldownMul: this one divides it out).
  name: "Dial spine", source: "implant", target: "self", cooldown: (lvl, e) => (24 * FITTING_TIME) / cooldownMul(e), mapTime: 0.5,
  info: () => "Once a world day: everything but you stands still for 5 s.",
  use(game, e) {
    for (const c of game.zone.creatures) if (c !== e) addStatus(game, c, "stilled", { t: 5 });
    if (e === game.player) game.log("The dial in your spine turns once. Everything else stops.", [200, 210, 230]);
    return true;
  },
});
