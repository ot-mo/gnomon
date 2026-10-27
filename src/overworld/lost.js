// Getting lost and finding your bearings again (bible §4.9, §15.6; TECH_DESIGN §5.2 "Getting lost"; WS1). The
// status `lost` is an ordinary status (status.js), so the HUD shows it and the save carries it.
//
//   lostChance(game, to, { road, river }, { fast, learn }) → 0..1   one world-map step onto span `to`: the terrain's lostChance,
//                                    × 2 at night, × 0.25 in a terrain you have Terrain lore for, − 0.02 a point of
//                                    INT modifier, − bonus(navigation) (a compass-ring 0.05), − 0.10 flying; 0 along
//                                    a road or a river edge, onto a road span, and on fast travel. learn: a step
//                                    really taken (Terrain lore may learn the terrain); the info panel only asks
//   getLost(game, key)               you are lost, in zone `key` (the zone you were crossing into)
//   isLost(game) · findBearings(game, line)
//
// Ways back (each new surface zone you enter while lost, rolled once per zone):
//   a road span, or a span you had visited before you got lost: at once;
//   any other: 25% (50% with Homing sense);
//   bearings from height, 3D only: stand 6 blocks or more above the datum and look around (half a turn, at least
//   2 s) for a 30% roll, once per zone (the map can't do this: only height can);
//   the Gnomon in sight in 3D (render3d.gnomonDrawn, WS3's) for a 10% roll, once per zone;
//   asking anyone you can talk to ("Which way am I?"): at once.
// Otherwise the status runs out after RULES.overworld.lostFor seconds (a world day). While lost the world map
// stays shut (travel.js enterWorldMap).
import { RULES } from "../rules.js";
import { on, registerUpdate } from "../events.js";
import { registerStatus, addStatus, removeStatus, hasStatus, statusFlag } from "../status.js";
import { mod, bonus } from "../stats.js";
import { perkRank } from "../leveling.js";
import { registerTalkOptions, node, bye } from "../talk.js";
import { FLOOR_Z } from "../world.js";
import { isNight } from "../clock.js";
import * as render3d from "../render3d.js";
import { atlas, roll, spanKey, tileOf, OW } from "./state.js";

registerStatus("lost", { name: "lost", color: [210, 170, 110], kind: "bad", stack: "refresh", t: OW().lostFor, hud: () => "LOST",
                         ended: "The land starts making sense again: you have your bearings." });

export const isLost = (game) => hasStatus(game.player, "lost");
const isRoadSpan = (t) => !!t && (t.roadWidth > 0 || t.terrain === "road");

// Terrain lore covers as many terrains as its rank: each is the first lossy terrain you travel onto after
// taking it (the bible gives no way to choose; this keeps it a power you feel at once).
function hasLore(game, terrain, learn) {
  const A = atlas(game), r = perkRank(game.player, "terrainLore");
  if (!r) return false;
  if (A.lore[terrain]) return true;
  if (!learn || Object.keys(A.lore).length >= r) return false;
  A.lore[terrain] = 1;
  game.log?.(`You learn the ways of ${game.run.world.terrains[terrain]?.name || terrain}: you'll hardly get lost there now.`, [150, 220, 255]);
  return true;
}

export function lostChance(game, to, edge = {}, { fast = false, learn = false } = {}) {
  const t = tileOf(game, to.wx, to.wy), O = OW(), p = game.player;
  if (!t || fast || edge.road || edge.river || isRoadSpan(t)) return 0;
  let c = t.lostChance || 0;
  if (!(c > 0)) return 0;
  if (isNight(game)) c *= O.nightLost;
  if (hasLore(game, t.terrain, learn)) c *= 1 - O.loreLost;
  c -= O.intLost * mod(p, "int") + bonus(p, "navigation") + (statusFlag(p, "flying") ? O.flyingLost : 0);
  return Math.max(0, Math.min(1, c));
}

export function getLost(game, key) {
  const A = atlas(game);
  A.lost = { in: key, since: game.time || 0, tried: { [key]: 1 }, height: {}, gnomon: {} };
  addStatus(game, game.player, "lost", { t: OW().lostFor });
}

export function findBearings(game, line) {
  const A = atlas(game);
  A.lost = null;
  if (!isLost(game)) return false;
  removeStatus(game, game.player, "lost");
  if (line) game.log?.(line, [150, 220, 255]);
  return true;
}

// A roll that may bring you round: once per zone for each way (`kind`: "tried" | "height" | "gnomon").
function tryBearings(game, kind, chance, ok, miss) {
  const A = atlas(game), key = game.zone?.key;
  if (!A.lost || !key) return false;
  const seen = (A.lost[kind] ||= {});
  if (seen[key]) return false;
  seen[key] = 1;
  if (roll(game) < chance) return findBearings(game, ok);
  if (miss) game.log?.(miss, [170, 170, 170]);
  return false;
}

// Each new surface zone you enter while lost (before discovery.js marks it visited: a higher priority).
on("zone:enter", (game, ev) => {
  const z = ev.zone;
  if (!isLost(game)) { if (game.state?.atlas?.lost) game.state.atlas.lost = null; return; }
  const A = atlas(game);
  A.lost ||= { in: z.key, since: game.time || 0, tried: {}, height: {}, gnomon: {} };   // (lost some other way: a status from elsewhere)
  if (z.z !== 0 || z.key === A.lost.in || !game.run) return;
  const t = tileOf(game, z.wx, z.wy), seen = A.visited[spanKey(z.wx, z.wy)];
  if (isRoadSpan(t) || (seen !== undefined && seen < (A.lost.since ?? Infinity))) {   // a place you knew before you were lost
    A.lost.tried[z.key] = 1;
    findBearings(game, isRoadSpan(t) ? "A road: you know where you are again." : "You've been here before: you have your bearings again.");
    return;
  }
  const homing = perkRank(game.player, "homingSense") > 0;
  tryBearings(game, "tried", homing ? OW().recoverHoming : OW().recover, "Something about this place sets you straight: you have your bearings again.");
}, { priority: 10 });

// Bearings from height, and the Gnomon in sight: 3D only.
registerUpdate("overworldBearings", (game, dt) => {
  const A = game.state?.atlas, z = game.zone, p = game.player;
  if (!A?.lost || !isLost(game) || !z || z.z !== 0 || game.view === "map") return;
  const H = OW().height;
  if (p.z >= FLOOR_Z + H.blocks && !A.lost.height[z.key]) {
    const look = (game.bearingsLook ||= { key: z.key, t: 0, turned: 0, yaw: p.yaw });
    if (look.key !== z.key) Object.assign(look, { key: z.key, t: 0, turned: 0, yaw: p.yaw });
    let d = p.yaw - look.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    look.turned += Math.abs(d); look.yaw = p.yaw; look.t += dt;
    if (look.t >= H.look && look.turned >= H.turn)
      tryBearings(game, "height", H.chance, "From up here the land lays itself out: you have your bearings again.",
                  "You look all round from up here. Nothing you know.");
  } else game.bearingsLook = null;
  if (render3d.gnomonDrawn?.() && !A.lost.gnomon[z.key])
    tryBearings(game, "gnomon", OW().gnomon, "The Gnomon stands where it always stands: you know which way is which again.");
}, { modes: ["explore"], every: 0.1 });

// Anyone you can talk to can set you right.
registerTalkOptions("lost", (game) => (isLost(game) ? [{
  label: "Which way am I?",
  go: () => { findBearings(game, "You're told how the land lies: you have your bearings again."); return node("They point the way, patiently, twice.", [bye()]); },
}] : null));
