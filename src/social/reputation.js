// Reputation events (TECH_DESIGN §2.11 "Reputation events"; bible §3.5 "What changes it"; owner WS6a). Subscribed
// to the bus when this file loads (social/index.js imports it).
//
//   RULES.rep = { witnessRange 12, attackPenalty −10, killPenalty −5, namedKillPenalty −50, implant 25, implantMax 100 }
//   witnessesOf(game, by, victim) → c[]   the victim's fellows (a shared faction) within witnessRange tiles of `by`
//                                         who perceive `by`: WS8's creatures.witnessesOf when it is there, else
//                                         line of sight from their eyes, by the §2.11 house rule (no fellow across
//                                         the plane or the dark sees it, unless `by` is you)
//   offender(game, e) → bool              you, or a follower of yours: only these move rep (an explicit source;
//                                         a kill or a blow with no source moves nothing)
//   offend(game, by, victim) → { witnesses, rep }   what an attack on a member did (the handlers call it)
//   killed(game, by, victim) → { [factionId]: n }   what a kill did
//
// "hurt" { tgt, src } and "attack" { att, tgt, result } (a blow, landed or not): an attack by you or your follower
// on a creature of a faction, that wasn't already out for you, gives the victim and every witness a grudge
// against you (and the follower), and when anyone but the victim saw it, its factions attackPenalty × the
// membership's weight. The grudge is what makes the next blow free: the victim is hostile now, and fighting
// what is out for you costs nothing. "kill" { c, src }: killPenalty (namedKillPenalty for a named member:
// c.named, its type's named, or anyone who talks) with each of the victim's factions × weight; every other
// faction that hates one of them gains half of it, rounded toward zero (bible: "Factions that hate it gain
// half that"); a creature's (or its type's) repOnKill { factionId: n } adds its own (legendaries, bible ±100 to
// ±200). A kill is not hidden by a lack of witnesses.
// "install" { e } (bodymods/implants.js, an implant fitted in play; WS5 #20, bible §10.4): the Plan +implant for
// you, the first implantMax / implant fittings only (game.state.planFittings counts them); taking one out gives
// nothing back, and the starting implant (fitted before the run, with no game) counts for nothing.
import { on } from "../events.js";
import { extendRules } from "../rules.js";
import * as creatures from "../creatures.js";
import { lineOfSight } from "../raycast.js";
import { FACTIONS, addRep, attitude, membershipsOf, relation, followsPlayer } from "../factions.js";

export const REP_RULES = extendRules("rep", { witnessRange: 12, attackPenalty: -10, killPenalty: -5, namedKillPenalty: -50, implant: 25, implantMax: 100 });

export const offender = (game, e) => !!e && (e === game.player || followsPlayer(e));

const eyes = (game, e) => e.z + (e === game.player ? 1.5 : (e.h || 1.7) * 0.8);
const shares = (a, b) => { const mine = membershipsOf(a).map(([id]) => id); return membershipsOf(b).some(([id]) => mine.includes(id)); };

export function witnessesOf(game, by, victim) {
  const r = REP_RULES.witnessRange;
  const seen = typeof creatures.witnessesOf === "function"   // WS8's (sight, the dark, a flat you): used once merged
    ? creatures.witnessesOf(game, by, r)
    : creatures.creaturesNear(game.zone, by.x, by.y, r).filter((c) => c !== by &&
        (by === game.player || attitude(game, c, by) !== "unaware") && !(creatures.isGhostly(by) && creatures.ghostHidden(game, by)) &&
        lineOfSight(game.zone, c.x, c.y, eyes(game, c), by.x, by.y, eyes(game, by)));
  return seen.filter((c) => c !== victim && c !== by && c !== game.player && shares(c, victim));
}

function grudge(game, c, by) {
  const g = ((c.brain ||= {}).grudges ||= {});
  g.player = 1;
  if (by !== game.player) g[by.id] = 1;
}

export function offend(game, by, victim) {
  const out = { witnesses: [], rep: {} };
  const p = game.player;
  if (!offender(game, by) || victim === p || followsPlayer(victim)) return out;
  const mine = membershipsOf(victim);
  if (!mine.length || attitude(game, victim, p) === "hostile") return out;
  out.witnesses = witnessesOf(game, by, victim);
  grudge(game, victim, by);
  for (const w of out.witnesses) grudge(game, w, by);
  if (out.witnesses.length) {
    for (const [id, w] of mine) out.rep[id] = addRep(game, id, REP_RULES.attackPenalty * w, "attack");
    const names = mine.map(([id]) => FACTIONS[id].name);
    game.log?.(`${cap(names.join(" and "))} saw you strike the ${victim.name}.`, [230, 150, 120]);
  }
  return out;
}

export function killed(game, by, victim) {
  const out = {};
  if (!offender(game, by) || followsPlayer(victim)) return out;   // (your own follower's death is no offence)
  const t = creatures.typeOf(victim);
  const mine = membershipsOf(victim);
  const pen = victim.named || t?.named || victim.talk ? REP_RULES.namedKillPenalty : REP_RULES.killPenalty;
  const add = (id, n) => { if (n) out[id] = addRep(game, id, n, "kill"); };
  for (const [id, w] of mine) add(id, pen * w);
  if (mine.length) for (const f of Object.values(FACTIONS)) {
    if (f.group || mine.some(([id]) => id === f.id)) continue;
    const w = Math.max(0, ...mine.filter(([id]) => relation(f.id, id) === -1).map(([, w]) => w));
    if (w > 0) add(f.id, Math.trunc((-pen * w) / 2));
  }
  for (const [id, n] of Object.entries(victim.repOnKill || t?.repOnKill || {})) if (FACTIONS[id]) add(id, n);
  return out;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

on("hurt", (game, { tgt, src }) => { if (src && tgt && tgt !== game.player) offend(game, src, tgt); });
on("attack", (game, { att, tgt, result }) => { if (result?.touched && tgt && tgt !== game.player) offend(game, att, tgt); });
on("kill", (game, { c, src }) => { if (c) killed(game, src, c); });
on("install", (game, { e }) => {
  if (e !== game.player || !game.state) return;
  const n = (game.state.planFittings = (game.state.planFittings || 0) + 1);
  if (n * REP_RULES.implant <= REP_RULES.implantMax) addRep(game, "plan", REP_RULES.implant, "body");
});
