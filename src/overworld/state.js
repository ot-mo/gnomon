// What every part of the overworld shares (WS1; TECH_DESIGN §5.2, bible §4.1, §4.6, §4.9, §15.6): its rules, the
// saved atlas, the journey under way, and a seeded stream for the rolls.
//
//   RULES.overworld                 the numbers (below)
//   atlas(game) → A                 game.state.atlas, made on first use (JSON only, saved with the slot):
//                                     visited  { "wx,wy": time }   spans whose zone you have been in
//                                     revealed { "wx,wy": time }   spans you know: their sites show on the world map
//                                     found    { siteId: how }      sites you know of ("visit", "reveal", "road", "rumour", "pin")
//                                     paid     { siteId: 1 }        sites whose discovery XP is given
//                                     pins     { id: { wx, wy, label, secretId, at } }
//                                     lore     { terrain: 1 }       Terrain lore's terrains
//                                     lost     null | { in, since, tried: { key: 1 }, height: { key: 1 }, gnomon: { key: 1 } }
//                                     n                             how many rolls the stream has given
//                                   (state.world is the world's { id, version }, so the TECH_DESIGN §2.17 fields live here)
//   roll(game) → 0..1               the next number of the run's travel stream: hashFloat(seed, "travel", n), so a
//                                   save and its load roll the same, and Node checks are repeatable (R6 style)
//   spanKey(wx, wy) · tileOf(game, wx, wy) · hourSeconds() · playerTier(game)
//   edgeBetween(world, a, b) → { road, river }   the straight move a → b follows a road or a river edge
//   canStep(world, from, dx, dy) → reason | null   null when the 8-way step is allowed (travel rules and the
//                                   bible's "a diagonal may not cut between two impassable spans")
//   game.trip                       the journey (runtime): { wx, wy, came: { dx, dy } | null, moved, fromKey, view,
//                                   viewOnly, cursor: { wx, wy } | null, prompt, path, tint }
import { RULES, extendRules } from "../rules.js";
import { hashFloat } from "../rng.js";
import { tierOfLevel, SIDES, SIDE_STEP } from "../world/worldmodel.js";

extendRules("overworld", {
  hostileRadius: 12,        // O and Z need no hostile awake this near (bible §4.1, §4.6: 12 tiles)
  roadHours: 3,             // a step along a road edge, whatever the span (bible §4.4, §15.5: roads stay roads)
  nightHours: 1.25,         // +25% hours at night, not on roads (bible §4.9)
  dropHours: 0.5,           // onto a "drop" span (the Lattice): half the span you leave, then you are in its zone
  nightLost: 2,             // the lost chance at night (bible §4.9, §15.6)
  intLost: 0.02,            // − 0.02 a point of INT modifier (TECH_DESIGN §5.2)
  flyingLost: 0.10,         // flying: −10 points (bible §15.6); a compass-ring is bonus(navigation) 0.05
  loreLost: 0.75,           // Terrain lore: −75% of the chance in its terrain
  lostFor: 24 * 60,         // seconds: the longest you stay lost (a world day), if no roll brings you round first
  recover: 0.25, recoverHoming: 0.5,                 // each new zone while lost (bible §15.6); Homing sense
  height: { chance: 0.3, blocks: 6, look: 2, turn: Math.PI },   // bearings from height: 3D, once per zone
  gnomon: 0.1,              // the Gnomon in sight, once per zone (render3d.gnomonDrawn, when WS3 has it)
  nightEncounter: 1.5,      // TECH_DESIGN §5.2
  fastEncounter: 0.25,      // fast travel: encounters × 0.25, never lost
  restEncounter: 0.5,       // resting: one roll per world hour at half the travel rate
  restMax: 8,               // world hours: a rest "until healed" stops here (TECH_DESIGN RULES.rest.max)
  waitMax: 24,              // world hours: the longest wait the Z menu offers
  bandDist: [8, 12],        // tiles from where you arrive
  tierWarning: 2,           // entering a span this many tiers above yours asks first (bible §15.6)
  hiddenSite: 0.1, hiddenSiteKeen: 0.2,             // per undiscovered site in the span you enter (bible §4.9)
  // Discovery XP, × one level's XP at the site's surface level (bible §4.9, §15.6): a landmark 0.3; any other
  // site but a village (whose first visit pays its own, story/village-site.js) "site". The progression table
  // (RULES.progression.xp.rewards, WS4) wins where it names the kind.
  xp: { landmark: 0.3, site: 0.1 },
});

export const OW = () => RULES.overworld;

export function atlas(game) {
  const st = (game.state ||= {});
  return (st.atlas ||= { visited: {}, revealed: {}, found: {}, paid: {}, pins: {}, lore: {}, lost: null, n: 0 });
}

export function roll(game) {
  const A = atlas(game);
  return hashFloat(game.state.seed ?? game.seed ?? 0, "travel", A.n++);
}

export const spanKey = (wx, wy) => `${wx},${wy}`;
export const tileOf = (game, wx, wy) => game.run?.world?.tileAt(wx, wy) || null;
export const hourSeconds = () => 60 * RULES.clock.secondsPerMinute;
export const playerTier = (game) => tierOfLevel(game.player?.level || 1);

// The side of a that faces b, for a straight step.
const sideTo = (dx, dy) => SIDES.find((s) => SIDE_STEP[s][0] === dx && SIDE_STEP[s][1] === dy) || null;

export function edgeBetween(world, a, b) {
  const side = sideTo(b.wx - a.wx, b.wy - a.wy), t = world.tileAt(a.wx, a.wy);
  return { road: !!(side && t?.road[side]), river: !!(side && t?.river[side]) };
}

// Can you take the world-map step (dx, dy) from `from`? null if so, else why not ("edge" | "travel" | "diagonal").
export function canStep(world, from, dx, dy) {
  if ((!dx && !dy) || Math.abs(dx) > 1 || Math.abs(dy) > 1) return "step";
  const to = { wx: from.wx + dx, wy: from.wy + dy };
  if (!world.inBounds(to.wx, to.wy)) return "edge";
  const via = edgeBetween(world, from, to);
  if (!world.canTravel(to.wx, to.wy, via.road || via.river)) return "travel";
  // A diagonal may not cut between two spans you can't travel onto (bible §4.1).
  if (dx && dy && !world.canTravel(from.wx + dx, from.wy) && !world.canTravel(from.wx, from.wy + dy)) return "diagonal";
  return null;
}
