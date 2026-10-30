// Creatures (TECH_DESIGN §2.3): monsters and people in one list, zone.creatures, of plain objects.
//
//   registerCreatures(table)            { typeId: CreatureType }; content/creatures/*.js call it
//   registerElites(table)               { eliteId: EliteDef }: rarer, nastier versions of ordinary monsters
//   CREATURE_TYPES, ELITES              the registries; typeOf(c) → c's CreatureType
//   spawnCreature(type, tx, ty, z, opts) → Creature
//       opts = { rng, state = "idle", level = 1, elite = null, uid = null, name, talk }
//       rng: a 0..1 function for the creature's looks (when it next blinks, flaps, shoots). Required for
//       anything that isn't a talker (talkers draw nothing): generators pass their cosmetic stream so the
//       layout stream stays untouched, runtime code passes Math.random. talk: { dialogue, state } makes
//       a talker of any type; a type with `talks` always is one.
//   addCreature(zone, c) → c            pushes it; during generation (zone not sealed yet) it also gets the
//                                       zone's next generated uid (ids.js genUid) unless it has one
//   removeCreature(zone, c)             takes it out of the list (no death, no loot: combat does those)
//   creatureAt(zone, x, y)              who stands on (or steps into) tile (x, y); a talker first
//   talkerAt(zone, x, y)                the person standing on tile (x, y)
//   creatureSprite(game, c)             its 3D sprite, or null where it isn't drawn (flat, a hidden ghost)
//   touchable(game, target, attacker = game.player, { blade = false })
//                                       can this blow reach it? (planes, ghosts; talkers never; pressed
//                                       flat, you reach only flat things)
//   touchesYou(game, attacker)          does its blow, arrow or splash reach you? (not while you're flat
//                                       and it isn't)
//   ghostHidden(game, c)                a ghostly creature drowned out by light (the one place that asks;
//                                       light.js inDark at the creature)
//   ghostOffMap(game, c)                a ghost person the map neither draws nor lets you talk to
//   hostilesTo(game, e), targetsFor(game, e), talkersIn(zone)   (through factions.js attitude)
//   creaturesNear(zone, x, y, r)        through spatial buckets during an AI update; buildBuckets, dropBuckets
//   nearestCreature, sees, witnessesOf, creaturesAlong, eyesOf, bodyMid   the spatial queries (see there)
//   isFlat(c), isGhostly(c), canTalk(c)
//   pickCreatureType(rand, level, table = null), rollElite(rand, level)
//
// A creature (§2.3): id (ids.js), uid, type, name, glyph, colour, size, position on the tile grid (tx, ty
// the tile it stands on, nx, ny the one it steps to, p the progress), x/y/z, level, hp, xp, state (the
// brain: "idle" | "wander" | "chase"), status and cooldowns (status.js), vis: { flat, ghostly, statue }
// copied from its type so a mutation can flip it, and for talkers talk: { dialogue, state, met }.
// Talkers have no health, can't be attacked and stand their ground (the AI skips them, and they hold
// their tile in its occupancy grid with their own id).
import { B, FLOOR_Z } from "./world.js";
import { hasStatus, statusFlag } from "./status.js";
import { bonus, contentLevel } from "./stats.js";
import { RULES } from "./rules.js";
import { nextEntityId, genUid } from "./ids.js";
import { distance } from "./rng.js";
import { lineOfSight } from "./raycast.js";
import { inDark } from "./light.js";
import { attitude } from "./factions.js";
import "./content/creatures/legacy.js";   // the parent game's creatures register themselves

// (Kept on functions so content modules can register while this module is still loading: the
// content imports creatures.js and creatures.js imports the content, and a function exists from the start.)
function types() { return (types.table ||= {}); }
function elites() { return (elites.table ||= {}); }
export const CREATURE_TYPES = types();
export const ELITES = elites();
export function registerCreatures(table) {
  for (const [id, t] of Object.entries(table)) {
    if (types()[id]) throw new Error(`registerCreatures: ${id} is already registered`);
    if (!t.name || !t.glyph || !t.color) throw new Error(`registerCreatures: ${id} needs a name, glyph and colour`);
    types()[id] = t;
  }
}
export function registerElites(table) { Object.assign(elites(), table); }
export const typeOf = (c) => types()[c.type];

export const isFlat = (c) => !!c.vis?.flat && !c.risen;
export const isGhostly = (c) => !!c.vis?.ghostly;
export const canTalk = (c) => !!c.talk;

// An elite's colour on the map: its species' and its elite's, half and half, so every (glyph, colour)
// pair stays unique in a family that shares a letter (bible §15.7; goblins, archers and orcs are all
// `g`). It glows in 3D with the elite's own colour (creatureSprite).
export const eliteColor = (t, e) => t.color.map((v, k) => Math.round((v + e.color[k]) / 2));

// Tougher at higher levels: under d20 RULES.d20's creatureHp a level and creatureDmg + 1 per creatureDmgEvery levels
// (the balance phase: +18% and +3, then +2 every 3), and from RULES.d20.tier8From (tier 8) health × tier8Hp and damage
// − tier8Dmg (B1, the user's decision of 2026-10-30); under the legacy set the parent's +6% health per level and +1
// damage every four levels. Bosses and guardians keep their health; mortal villagers the parent's +6%.
// z is the ground it stands on.
export function spawnCreature(type, tx, ty, z, opts = {}) {
  const t = types()[type];
  if (!t) throw new Error(`spawnCreature: unknown type ${type}`);
  const level = opts.level ?? 1;
  const vis = { flat: !!t.flat, ghostly: !!t.ghostly, statue: !!t.statue };
  if (t.talks || opts.talk) {
    // A mortal one (WS7's villagers: the type has hp; WS6a #1) can be struck and killed like a monster: its health
    // (level-scaled as a monster's), the fields a blow reads; it neither fights back nor moves (people's brains).
    const hp = t.hp > 0 ? Math.round(t.hp * (1 + 0.06 * (level - 1))) : undefined;
    return {
      id: nextEntityId(), uid: opts.uid ?? null, type, name: opts.name ?? t.name, glyph: t.glyph, color: t.color,
      w: t.w || (t.statue ? 1.0 : 0.75), h: t.h || (t.statue ? 1.6 : 1.7),
      tx, ty, nx: tx, ny: ty, p: 0, x: tx + 0.5, y: ty + 0.5, z, level, state: "idle",
      talk: { dialogue: opts.talk?.dialogue ?? type, state: opts.talk?.state ?? {}, met: false },
      vis, status: {}, cooldowns: {},
      ...(hp ? { hp, maxHp: hp, bonus: Math.floor((level - 1) / 4), armour: t.armour || 0, xp: t.xp || 0, cd: 0, hurt: 0, lost: 0 } : {}),
    };
  }
  const rand = opts.rng;
  if (typeof rand !== "function") throw new Error(`spawnCreature: ${type} needs opts.rng (a cosmetic stream, or Math.random at runtime)`);
  const elite = opts.elite ?? null, e = elite ? elites()[elite] : null;
  const D = RULES.combat === "legacy" ? null : RULES.d20, big = t.boss || t.guardian;
  const t8 = !!D && !big && level >= D.tier8From;   // (tier 8 retuned: the user's decision of 2026-10-30; B1)
  const hp = Math.round(t.hp * (big ? 1 : 1 + (D ? D.creatureHp : 0.06) * (level - 1)) * (e?.hp || 1) * (t8 ? D.tier8Hp : 1));
  const size = e?.size || 1;
  return {
    id: nextEntityId(), uid: opts.uid ?? null, type, elite, guardian: t.guardian || null,
    name: opts.name ?? (e ? `${e.adj} ${t.name}` : t.name), glyph: t.glyph, color: e ? eliteColor(t, e) : t.color,
    w: t.w * size, h: t.h * size,
    hp, maxHp: hp, level,
    bonus: (D && !big ? D.creatureDmg + Math.floor((level - 1) / D.creatureDmgEvery) : Math.floor((level - 1) / 4)) + (e?.dmg || 0) - (t8 ? D.tier8Dmg : 0),
    speedMul: e?.speed || 1, cdMul: e?.cd || 1, armour: (e?.armour || 0) + (t.armour || 0), ward: !!e?.ward,
    venom: Math.max(t.venom || 0, e?.venom || 0), drain: !!(t.drain || e?.drain), burns: t.burns || 0,
    xp: Math.round(t.xp * (1 + 0.1 * (level - 1)) * (e ? 2.5 : 1)),   // what killing it is worth
    status: {}, cooldowns: {},             // burning, chilled, stunned, blinded, poisoned, hasted… (status.js)
    regenAcc: 0, shot: 1 + rand(), phase: 0, sees: false,
    tx, ty, nx: tx, ny: ty, p: 0,          // current tile, next tile, progress of the step
    x: tx + 0.5, y: ty + 0.5, z: z + (t.hover || 0),
    state: opts.state ?? "idle",           // "idle" | "wander" | "chase"
    cd: 0, hurt: 0, anim: rand() * 10,
    think: rand() * 0.25, lost: 0, pause: rand() * 2,
    vis,
  };
}

export function addCreature(zone, c) {
  if (!zone.sealed && (c.uid === null || c.uid === undefined)) c.uid = genUid(zone);
  zone.creatures.push(c);
  if (zone.buckets) zone.buckets.cells[bucketOf(zone.buckets, c.x, c.y)].push(c);
  return c;
}
export function removeCreature(zone, c) {
  const k = zone.creatures.indexOf(c);
  if (k >= 0) zone.creatures.splice(k, 1);
  if (zone.buckets) for (const cell of zone.buckets.cells) { const j = cell.indexOf(c); if (j >= 0) { cell.splice(j, 1); break; } }
}

// Who stands on (or is stepping into) tile (x, y). People stand still on their tile; a monster also
// counts on the tile it steps to and the one its body is over.
export const talkerAt = (zone, x, y) => zone.creatures.find((c) => c.talk && c.tx === x && c.ty === y) || null;
export function creatureAt(zone, x, y) {
  return talkerAt(zone, x, y) ||
    zone.creatures.find((c) => !c.talk && !(c.brain?.arriving > 0) && ((c.tx === x && c.ty === y) || (c.nx === x && c.ny === y) ||
      (Math.floor(c.x) === x && Math.floor(c.y) === y))) || null;
}

// A ghostly creature is drowned out by light: not drawn, not seen, not touched, not talked to. It shows
// only where it stands in the dark (light.js inDark: your torch out, and no daylight there). Every ghost
// rule asks here.
export const ghostHidden = (game, c) => isGhostly(c) && !inDark(game, game.zone, c.x, c.y, c.z + c.h * 0.5);
// A ghost person on the map: only once you've met it in the dark, and under the sky only while it stands
// in the dark (underground the parent game's rule: once met, always there on the map).
export const ghostOffMap = (game, c) => isGhostly(c) && (!c.talk?.met || (!!game.zone.hasSky && ghostHidden(game, c)));

// Flat beings can only be touched while you look at the world flat, on the map (unless the Flat
// Queen has risen out of the plane: then only in 3D). Ghostly things only in the dark (your torch out).
// blade: your own weapon (the Edge of the Plane cuts flat things in 3D too). People can't be attacked.
// A creature's blow (attacker not the player) reaches any creature that isn't a talker.
// Pressed flat yourself (status.js "flat", bible §10.2) you exist only in the Plane: you touch flat
// things and nothing else, and only flat things touch you (touchesYou).
// How the log names a creature: "the goblin", but a named one (a legend, c.named) by its name alone.
export const theOf = (c) => (c?.named ? c.name : `the ${c?.name}`);
export const TheOf = (c) => (c?.named ? c.name : `The ${c?.name}`);
export function touchable(game, target, attacker = game.player, { blade = false } = {}) {
  if ((canTalk(target) && !(target.hp > 0)) || target.brain?.arriving > 0) return false;   // (people: only a mortal one; arriving: still on its way in, ai.js)
  if (attacker !== game.player) return true;
  if (ghostHidden(game, target)) return false;
  if (statusFlag(attacker, "flat")) return isFlat(target);
  if (target.risen) return game.view !== "map";
  if (!target.vis?.flat || game.view === "map") return true;
  return blade && bonus(game.player, "cutsFlat") > 0;
}
// Does a blow, an arrow or a splash from `attacker` (a creature, or null for no one) reach you? Always,
// unless you are flat and it isn't.
export const touchesYou = (game, attacker) => !statusFlag(game.player, "flat") || (!!attacker && isFlat(attacker));

// Who is out for whom: factions.js attitude (a stub until WS6a: monsters are hostile to you and to
// nobody else, talkers to nobody).
//   hostilesTo(game, e)   the creatures hostile to e
//   targetsFor(game, e)   whom e would attack: you (if it's hostile to you) and creatures it's hostile to
export function hostilesTo(game, e) {
  return game.zone.creatures.filter((c) => c !== e && attitude(game, c, e) === "hostile");
}
export function targetsFor(game, e) {
  const out = e !== game.player && attitude(game, e, game.player) === "hostile" ? [game.player] : [];
  for (const c of game.zone.creatures) if (c !== e && attitude(game, e, c) === "hostile") out.push(c);
  return out;
}
export const talkersIn = (zone) => zone.creatures.filter(canTalk);

// Spatial buckets (8×8 tiles, TECH_DESIGN §3.4). ai.js builds them once per updateCreatures and drops
// them after it: within an update creaturesNear looks only at the buckets its circle touches (with two
// tiles to spare, for creatures that moved since), outside one at every creature. Adding or removing a
// creature mid-update keeps them right.
const BUCKET = 8, SPARE = 2;
const bucketOf = (b, x, y) => Math.min(b.cols - 1, Math.max(0, Math.floor(x / BUCKET))) +
                              Math.min(b.rows - 1, Math.max(0, Math.floor(y / BUCKET))) * b.cols;
export function buildBuckets(zone) {
  const b = { cols: Math.max(1, Math.ceil(zone.w / BUCKET)), rows: Math.max(1, Math.ceil(zone.d / BUCKET)), cells: [] };
  for (let k = 0; k < b.cols * b.rows; k++) b.cells.push([]);
  for (const c of zone.creatures) b.cells[bucketOf(b, c.x, c.y)].push(c);
  zone.buckets = b;
  return b;
}
export function dropBuckets(zone) { zone.buckets = null; }

export function creaturesNear(zone, x, y, r) {
  const b = zone.buckets;
  if (!b) return zone.creatures.filter((c) => distance(c.x - x, c.y - y) <= r);
  const reach = r + SPARE, out = [];
  const x0 = Math.max(0, Math.floor((x - reach) / BUCKET)), x1 = Math.min(b.cols - 1, Math.floor((x + reach) / BUCKET));
  const y0 = Math.max(0, Math.floor((y - reach) / BUCKET)), y1 = Math.min(b.rows - 1, Math.floor((y + reach) / BUCKET));
  for (let by = y0; by <= y1; by++)
    for (let bx = x0; bx <= x1; bx++)
      for (const c of b.cells[bx + by * b.cols]) if (distance(c.x - x, c.y - y) <= r) out.push(c);
  return out;
}

// --- Spatial queries (WS8; WS6a's witnesses, the AI, targeting) ---------------------------------------
// nearestCreature(zone, x, y, r, ok = () => true) → the closest creature within r tiles that ok() accepts
//     (ties: the lower id), or null.
// eyesOf(e) → z of its eyes (yours, or a creature's 0.8 of its height); bodyMid(e) → z of its middle.
// sees(game, c, e) → bool   can creature c see e (the player or a creature) now? Within its type's sight
//     (people: 10 tiles) and in line of sight from its eyes; for you the parent's rules on top (your
//     torch or daylight, the shadows potion, stealth, darkness; light.js inDark), and pressed flat you are
//     a shadow with nobody casting it to anything that isn't flat itself. Ghosts the light drowns out and
//     things across the plane or the dark (factions.js "unaware") are never seen.
// witnessesOf(game, e, r = 12) → every creature, people included, within r tiles that sees e: who saw it.
// creaturesAlong(zone, x0, y0, z0, x1, y1, z1, { pad = 0.15, skip }) → [{ c, t }]: the creatures whose
//     bodies the segment passes through, nearest first (t: 0..1 along it). skip(c) → true leaves one out.
//     What stands on a straight line (a beam, a charge, who is between two people). (A thrown or fired thing
//     falls on an arc: throwing.js flightOf follows that, and the target screen draws it.)
export function nearestCreature(zone, x, y, r, ok = () => true) {
  let best = null, bestD = Infinity;
  for (const c of creaturesNear(zone, x, y, r)) {
    const d = distance(c.x - x, c.y - y);
    if ((d < bestD || (d === bestD && c.id < best.id)) && ok(c)) { best = c; bestD = d; }
  }
  return best;
}
const EYE_PLAYER = 1.45;   // (player.js EYE; creatures.js may not import player.js: it loads first)
export const eyesOf = (e) => e.z + (e.attrs || e.inv ? EYE_PLAYER : (e.h || 1.7) * 0.8);
export const bodyMid = (e) => e.z + (e.attrs || e.inv ? EYE_PLAYER * 0.6 : (e.h || 1.7) * 0.6);
const PEOPLE_SIGHT = 10;

export function sees(game, c, e) {
  const { zone, player } = game, t = types()[c.type] || {};
  if (e === c) return true;
  if (e !== player && (ghostHidden(game, e) || attitude(game, c, e) === "unaware")) return false;
  if (e === player && statusFlag(player, "flat") && !isFlat(c)) return false;
  let range = t.sight ?? PEOPLE_SIGHT;
  if (e === player) {
    const lit = !inDark(game, zone, player.x, player.y, player.z + EYE_PLAYER);
    range *= (lit || t.darkSight ? 1 : 0.55) * (statusFlag(player, "hidden") ? 0.35 : 1) *
      (hasStatus(player, "darkened") && !t.darkSight ? 0.7 : 1) * Math.max(0.3, 1 - bonus(player, "stealth"));
  }
  if (Math.hypot(e.x - c.x, e.y - c.y) >= range) return false;   // (hypot, as the parent measured it)
  return lineOfSight(zone, c.x, c.y, eyesOf(c), e.x, e.y, e === player ? eyesOf(e) : bodyMid(e));
}
export const witnessesOf = (game, e, r = 12) => creaturesNear(game.zone, e.x, e.y, r).filter((c) => c !== e && sees(game, c, e));

export function creaturesAlong(zone, x0, y0, z0, x1, y1, z1, { pad = 0.15, skip = null } = {}) {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, len2 = dx * dx + dy * dy || 1e-9, out = [];
  for (const c of creaturesNear(zone, (x0 + x1) / 2, (y0 + y1) / 2, Math.sqrt(len2) / 2 + 2)) {
    if (skip?.(c)) continue;
    const t = Math.max(0, Math.min(1, ((c.x - x0) * dx + (c.y - y0) * dy) / len2));
    const px = x0 + dx * t, py = y0 + dy * t, pz = z0 + dz * t;
    if (distance(px - c.x, py - c.y) < (c.w || 0.75) * 0.45 + pad && pz > c.z - 0.1 && pz < c.z + (c.h || 1.7) + 0.1) out.push({ c, t });
  }
  return out.sort((a, b) => a.t - b.t || a.c.id - b.c.id);
}

// The 3D picture. Monsters: two frames (standing / mid-step), flyers flap, the boss's orb pulses, a
// wader sinks a little; statuses tint it and elites glow. People: one picture, a ghost bobbing.
// Nothing for flat beings (render3d draws their shadow) or for a ghost hidden by the light.
export function creatureSprite(game, c) {
  if (isFlat(c) || ghostHidden(game, c) || c.brain?.arriving > 0) return null;
  const t = typeOf(c);
  if (c.talk) {
    const bob = c.vis.ghostly ? 0.25 + Math.sin(game.time * 2 + c.id) * 0.08 : 0;
    return { x: c.x, y: c.y, z: c.z + bob, w: c.w, h: c.h, art: t.art, palette: t.palette };
  }
  const zone = game.zone;
  const moving = c.nx !== c.tx || c.ny !== c.ty;
  const frame = moving || t.hover || t.boss ? Math.floor(c.anim * (t.hover ? 9 : 6)) % 2 : 0;
  // Wading: sink it a little and the water surface hides its feet (depth buffer does the rest).
  const wet = !t.hover && zone.get(Math.floor(c.x), Math.floor(c.y), FLOOR_Z - 1) === B.WATER_SHALLOW;
  const bob = t.hover ? Math.sin(c.anim * 3) * 0.08 : 0;
  // Burning monsters flicker orange; chilled ones go pale blue.
  const flicker = 0.8 + 0.2 * Math.sin(c.anim * 25);
  const has = (id) => hasStatus(c, id);
  const tint = has("burning") ? [1.5, 0.9, 0.5] : has("chilled") ? [0.7, 1.0, 1.6] : has("stunned") ? [1.2, 0.7, 1.6] :
               has("poisoned") ? [0.7, 1.5, 0.6] : has("blinded") ? [0.5, 0.5, 0.6] : null;
  let emit = has("burning") ? [0.9 * flicker, 0.4 * flicker, 0.1] : null;   // flames light it up even in the dark
  if (c.elite) {   // elites glow with a slow pulse of their colour
    const k = (0.18 + 0.08 * Math.sin(c.anim * 4)) / 255, col = elites()[c.elite]?.color || c.color;
    emit = [(emit?.[0] || 0) + col[0] * k, (emit?.[1] || 0) + col[1] * k, (emit?.[2] || 0) + col[2] * k];
  }
  return { x: c.x, y: c.y, z: c.z - (wet ? 0.3 : 0) + bob, w: c.w, h: c.h, art: t.frames[frame], palette: t.palette,
           flash: c.hurt > 0, tint, emit, monster: c };
}

// Which creature turns up at this level (rand: a 0–1 random function). table: the type ids to draw
// from (default: every registered type with `depths`). Levels past the content's read as its deepest.
// Above the parent's levels (its tables, by `depths`, end at 20: golden) a draw with no table comes from the real
// world's level pool, which content/creatures/levels.js registers here, as its kinds import this file; one draw, and
// the parent's pick when no kind of the pool holds the level (integrator, C3 #1).
const LEGACY_TOP = 20;
let levelPool = null;
export function setLevelPool(pick) { levelPool = pick; }
export function pickCreatureType(rand, level, table = null) {
  if (!table && level > LEGACY_TOP && levelPool) { const t = levelPool(rand, level); if (t) return t; }
  const lv = contentLevel(level);
  const ids = table || Object.keys(types()).filter((id) => types()[id].depths);
  const weights = ids.map((type) => {
    const t = types()[type];
    if (!t.depths || lv < t.depths[0] || lv > t.depths[1]) return [type, 0];
    // Fade in over the first level of its range and out over the last.
    return [type, t.weight * Math.min(1, (lv - t.depths[0] + 1) / 2, (t.depths[1] - lv + 1) / 2)];
  });
  let pick = rand() * weights.reduce((a, [, w]) => a + w, 0);
  for (const [type, w] of weights) if ((pick -= w) < 0) return type;
  return "goblin";
}

// Elites start at level 3 and get commoner deeper: about 1 in 25 there, 1 in 5 by level 18.
export function rollElite(rand, level) {
  if (level < 3 || rand() >= Math.min(0.22, 0.012 * level)) return null;
  const keys = Object.keys(elites()).filter((k) => level >= (elites()[k].depth || 0));
  return keys[Math.floor(rand() * keys.length)];
}
