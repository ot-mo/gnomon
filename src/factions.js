// Factions, reputation and attitude (TECH_DESIGN §2.11). A Phase 0 stub: no faction is registered yet,
// so monsters are hostile to you and to nobody else, and people are neutral. WS6a brings the factions
// (content/factions.js), the rep events and the witnesses; the shape of the API stays.
//
//   registerFaction(id, def)       FactionDef: { id, name, temperament = "neutral", startRep = 0, relations: { [id]: -1|0|1 }, … }
//   FACTIONS                       the registry
//   REP_BANDS                      ["hated", "disliked", "indifferent", "liked", "loved"]
//   repOf(game, factionId) → n     game.state.rep[id], else the faction's startRep (0)
//   addRep(game, factionId, n, reason)
//   band(rep) → bandName           thresholds −600, −250, +250, +600
//   attitude(game, a, b) → "hostile" | "wary" | "neutral" | "friendly" | "unaware"
//                                  how a feels about b (a, b: the player or a creature)
//
// A creature's memberships are c.faction = { [factionId]: weight } (optional); c.brain = { temperament,
// grudges: { [id]: 1 }, leader } (optional). Without memberships the parent game's rule holds: a monster
// is hostile to you, a talker neutral, and creatures leave each other alone.
import { isFlat, isGhostly } from "./creatures.js";

function factions() { return (factions.table ||= {}); }
export const FACTIONS = factions();
export function registerFaction(id, def) {
  if (factions()[id]) throw new Error(`registerFaction: ${id} is already registered`);
  factions()[id] = { id, temperament: "neutral", startRep: 0, relations: {}, ...def };
}

export const REP_BANDS = ["hated", "disliked", "indifferent", "liked", "loved"];
const REP_EDGES = [-600, -250, 250, 600];   // hated ≤ −600 < disliked ≤ −250 < indifferent < 250 ≤ liked < 600 ≤ loved

export function band(rep) {
  if (rep <= REP_EDGES[0]) return "hated";
  if (rep <= REP_EDGES[1]) return "disliked";
  if (rep < REP_EDGES[2]) return "indifferent";
  if (rep < REP_EDGES[3]) return "liked";
  return "loved";
}

export function repOf(game, factionId) {
  const r = game.state?.rep?.[factionId];
  return r ?? factions()[factionId]?.startRep ?? 0;
}
export function addRep(game, factionId, n, reason = null) {
  if (!game.state) return 0;
  const rep = (game.state.rep ||= {});
  rep[factionId] = repOf(game, factionId) + n;
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

const memberships = (c) => Object.entries(c.faction || {}).filter(([id, w]) => w > 0 && factions()[id]);
const idOf = (game, e) => (e === game.player ? "player" : e.id);
const leaderOf = (game, c) => {
  const l = c.brain?.leader;
  if (l === undefined || l === null) return null;
  return l === "player" ? game.player : game.zone?.creatures.find((o) => o.id === l) || null;
};

export function attitude(game, a, b) {
  const player = game.player;
  if (a === b) return "friendly";
  // A follower shares its leader's attitudes (and is friendly to its leader).
  if (a !== player) {
    const leader = leaderOf(game, a);
    if (leader === b) return "friendly";
    if (leader === player) return attitude(game, b, player) === "hostile" ? "hostile" : "neutral";   // your side
    if (leader && leader !== a) return attitude(game, leader, b);
  }
  // You: hostile to whatever is hostile to you, otherwise neutral.
  if (a === player) return attitude(game, b, player) === "hostile" ? "hostile" : "neutral";
  // The house rule: the plane and the dark are things only the player crosses.
  if (b !== player && (isFlat(a) !== isFlat(b) || isGhostly(a) !== isGhostly(b))) return "unaware";
  if (a.brain?.grudges?.[idOf(game, b)]) return "hostile";
  if (a.talk) return "neutral";   // people never start a fight (until WS6a gives them factions and tempers)

  const mine = memberships(a);
  if (b === player) {
    if (!mine.length) return "hostile";   // the parent game: every monster is out for you
    const temper = a.brain?.temperament || factions()[mine[0][0]].temperament || "neutral";
    let name;
    if (mine.some(([id, w]) => w >= 0.25 && band(repOf(game, id)) === "hated")) name = "hated";
    else {
      const total = mine.reduce((s, [, w]) => s + w, 0);
      name = band(mine.reduce((s, [id, w]) => s + repOf(game, id) * w, 0) / total);
    }
    return TOWARD_PLAYER[name][temper] || "neutral";
  }
  // Creature against creature: a shared faction is friendly; otherwise the relations decide.
  const theirs = memberships(b);
  if (mine.some(([id]) => theirs.some(([o]) => o === id))) return "friendly";
  const rels = mine.flatMap(([id]) => theirs.map(([o]) => factions()[id].relations?.[o] ?? 0));
  return rels.includes(-1) ? "hostile" : rels.includes(1) ? "friendly" : "neutral";
}
