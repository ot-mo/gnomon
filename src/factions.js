// Factions, reputation and attitude (TECH_DESIGN §2.11; bible §3.5, §6.1, §15.4). The factions themselves are
// content (content/factions.js registers them); the rep events and the witnesses are social/reputation.js's.
//
//   registerFaction(id, def)       FactionDef: { id, name, temperament = "neutral", startRep = 0 | { bent, plumb },
//                                  parent?, likes: [[id, why]], hates: [[id, why]], relations: { [id]: -1|0|1 },
//                                  pilgrimFloor = true, hidden?, … }; relations are filled from likes (+1) and
//                                  hates (−1) where the def doesn't give them
//   FACTIONS                       the registry
//   REP_BANDS                      ["hated", "disliked", "indifferent", "liked", "loved"]
//   BAND_NAMES                     what the player reads: Dark, Cold, Grey, Warm, Bright (bible §3.5's light words)
//   REP_MIN, REP_MAX               −1000, +1000: addRep keeps rep between them
//   repOf(game, factionId) → n     game.state.rep[id], else baseRep
//   baseRep(game, factionId) → n   the start: the faction's startRep for the player's genotype (bible §15.4; a
//                                  player without one, the quick game's, reads as Bent), raised to 0 in a
//                                  Pilgrim run unless the faction says pilgrimFloor: false (bible §3.5, §10.1)
//   addRep(game, factionId, n, reason) → rep   emits "rep" { faction, n, from, rep, reason } when it moved
//   band(rep) → bandName           thresholds −600, −250, +250, +600
//   bandName(rep) → "Dark" | …     the light word for the band
//   membershipsOf(c) → [[id, w]]   c.faction ({ id: weight }) or the type's `factions` (a list, or { id: weight });
//                                  only registered factions with a weight above 0
//   relation(f, g) → −1 | 0 | 1    how faction f regards faction g: its own relation to g, else to the nearest of
//                                  g's parent groups it names; failing that, f's parent's
//   followsPlayer(c) → bool        c.brain.leader === "player"
//   attitude(game, a, b) → "hostile" | "wary" | "neutral" | "friendly" | "unaware"
//                                  how a feels about b (a, b: the player or a creature)
//
// A creature's brain is c.brain = { temperament, grudges: { [id]: 1 }, leader } (all optional; the player's
// id in grudges is "player"). Without memberships the parent game's rule holds: a monster is hostile to you,
// a talker neutral, and creatures leave each other alone, so the old game plays exactly as before.
import { isFlat, isGhostly, typeOf } from "./creatures.js";
import { emit } from "./events.js";

function factions() { return (factions.table ||= {}); }
export const FACTIONS = factions();
export function registerFaction(id, def) {
  if (factions()[id]) throw new Error(`registerFaction: ${id} is already registered`);
  const relations = {};
  for (const [o] of def.likes || []) relations[o] = 1;
  for (const [o] of def.hates || []) relations[o] = -1;
  factions()[id] = { id, temperament: "neutral", startRep: 0, likes: [], hates: [], ...def, relations: { ...relations, ...def.relations } };
}

export const REP_BANDS = ["hated", "disliked", "indifferent", "liked", "loved"];
export const BAND_NAMES = { hated: "Dark", disliked: "Cold", indifferent: "Grey", liked: "Warm", loved: "Bright" };
const REP_EDGES = [-600, -250, 250, 600];   // hated ≤ −600 < disliked ≤ −250 < indifferent < 250 ≤ liked < 600 ≤ loved
export const REP_MIN = -1000, REP_MAX = 1000;

export function band(rep) {
  if (rep <= REP_EDGES[0]) return "hated";
  if (rep <= REP_EDGES[1]) return "disliked";
  if (rep < REP_EDGES[2]) return "indifferent";
  if (rep < REP_EDGES[3]) return "liked";
  return "loved";
}
export const bandName = (rep) => BAND_NAMES[band(rep)];

export function baseRep(game, factionId) {
  const def = factions()[factionId];
  if (!def) return 0;
  const start = def.startRep ?? 0;
  const n = typeof start === "number" ? start : start[game.player?.genotype] ?? start.bent ?? 0;
  return game.state?.mode === "pilgrim" && def.pilgrimFloor !== false ? Math.max(0, n) : n;
}
export function repOf(game, factionId) {
  return game.state?.rep?.[factionId] ?? baseRep(game, factionId);
}
export function addRep(game, factionId, n, reason = null) {
  if (!game.state) return 0;
  const rep = (game.state.rep ||= {});
  const from = repOf(game, factionId);
  rep[factionId] = Math.max(REP_MIN, Math.min(REP_MAX, Math.round(from + n)));
  if (rep[factionId] !== from) emit(game, "rep", { faction: factionId, n: rep[factionId] - from, from, rep: rep[factionId], reason });
  return rep[factionId];
}

// band × temperament → attitude toward the player (§2.11's table).
const TOWARD_PLAYER = {
  hated:       { docile: "hostile",  neutral: "hostile",  aggressive: "hostile" },
  disliked:    { docile: "wary",     neutral: "hostile",  aggressive: "hostile" },
  indifferent: { docile: "neutral",  neutral: "neutral",  aggressive: "hostile" },
  liked:       { docile: "friendly", neutral: "friendly", aggressive: "neutral" },
  loved:       { docile: "friendly", neutral: "friendly", aggressive: "friendly" },
};

// attitude() runs for every pair of creatures the AI looks at, so a creature with no faction (every legacy one)
// costs one lookup and no allocation; a type's memberships are worked out once.
const NONE = Object.freeze([]);
const byType = new WeakMap();
const entries = (f) => Object.entries(Array.isArray(f) ? Object.fromEntries(f.map((id) => [id, 1])) : f)
  .filter(([id, w]) => w > 0 && factions()[id]);
export function membershipsOf(c) {
  if (c.faction) return entries(c.faction);
  const t = typeOf(c);
  if (!t?.factions) return NONE;
  let m = byType.get(t);
  if (!m || m.size !== Object.keys(factions()).length) byType.set(t, (m = { list: entries(t.factions), size: Object.keys(factions()).length }));
  return m.list;
}

export function relation(f, g, depth = 0) {
  const F = factions()[f];
  if (!F || depth > 8) return 0;   // (a cycle of parents in bad content ends here)
  for (let o = g, n = 0; o && n < 8; o = factions()[o]?.parent, n++) if (F.relations?.[o] !== undefined) return F.relations[o];
  return F.parent && F.parent !== f ? relation(F.parent, g, depth + 1) : 0;
}

const idOf = (game, e) => (e === game.player ? "player" : e.id);
export const followsPlayer = (c) => c?.brain?.leader === "player";
const leaderOf = (game, c) => {
  const l = c.brain?.leader;
  if (l === undefined || l === null) return null;
  return l === "player" ? game.player : game.zone?.creatures.find((o) => o.id === l) || null;
};
// Sees in the dark: perceives a ghost (bible §15.4, "Perception rules for faction fights"); ghosts do too.
const darkSight = (c) => isGhostly(c) || !!(c.darkSight || typeOf(c)?.darkSight);
// A talker without health can't be struck, by you or by anything else (creatures.js touchable).
const unstrikable = (c) => !!c.talk && !(c.hp > 0);
const temperOf = (c, mine) => c.brain?.temperament || typeOf(c)?.temperament || factions()[mine[0][0]].temperament || "neutral";

// How a's factions (weighted) regard you: any membership of weight ≥ 0.25 whose band is hated makes it
// hated; otherwise the weighted mean rep picks the band.
export function bandToward(game, c) {
  const mine = membershipsOf(c);
  if (!mine.length) return null;
  if (mine.some(([id, w]) => w >= 0.25 && band(repOf(game, id)) === "hated")) return "hated";
  const total = mine.reduce((s, [, w]) => s + w, 0);
  return band(mine.reduce((s, [id, w]) => s + repOf(game, id) * w, 0) / total);
}

// depth: how many leaders deep the question has gone; a chain longer than MAX_DEPTH (a cycle of leaders, which
// only a bug makes) answers neutral instead of recursing for ever.
const MAX_DEPTH = 6;
export function attitude(game, a, b, depth = 0) {
  const player = game.player;
  if (a === b) return "friendly";
  if (depth > MAX_DEPTH) return "neutral";
  // You: hostile to whatever is hostile to you; your followers are yours.
  if (a === player) return followsPlayer(b) ? "friendly" : attitude(game, b, player, depth + 1) === "hostile" ? "hostile" : "neutral";
  // A follower is friendly to its leader and to the rest of its side.
  const leader = leaderOf(game, a);
  if (leader && leader !== a && (leader === b || (b !== player && b.brain?.leader === a.brain.leader))) return "friendly";
  // The house rule: the plane and the dark are things only the player crosses (followers included).
  if (b !== player) {
    if (isFlat(a) !== isFlat(b)) return "unaware";
    if (isGhostly(a) !== isGhostly(b) && !(darkSight(a) && darkSight(b))) return "unaware";
  }
  // Otherwise a follower shares its leader's attitudes.
  if (leader && leader !== a) {
    if (a.brain?.grudges?.[idOf(game, b)]) return "hostile";
    if (leader === player) return attitude(game, b, player, depth + 1) === "hostile" ? "hostile" : "neutral";   // your side
    return attitude(game, leader, b, depth + 1);
  }
  if (a.brain?.grudges?.[idOf(game, b)]) return unstrikable(a) ? "wary" : "hostile";
  // Whatever is out for you is out for your followers too (WS8's request 2).
  if (followsPlayer(b) && attitude(game, a, player, depth + 1) === "hostile") return "hostile";

  const mine = membershipsOf(a);
  if (b === player) {
    if (!mine.length) return a.talk ? "neutral" : "hostile";   // the parent game: people are neutral, every monster is out for you
    const said = TOWARD_PLAYER[bandToward(game, a)][temperOf(a, mine)] || "neutral";
    return said === "hostile" && unstrikable(a) ? "wary" : said;   // people who can't fight keep away instead
  }
  // Creature against creature: a shared faction is friendly; otherwise the relations decide.
  if (!mine.length) return "neutral";
  const theirs = membershipsOf(b);
  if (!theirs.length) return "neutral";
  if (mine.some(([id]) => theirs.some(([o]) => o === id))) return "friendly";
  const rels = mine.flatMap(([id]) => theirs.map(([o]) => relation(id, o)));
  if (rels.includes(-1)) return unstrikable(b) || unstrikable(a) ? "neutral" : "hostile";
  return rels.includes(1) ? "friendly" : "neutral";
}
