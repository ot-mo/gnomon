// How creatures think and move (TECH_DESIGN §1.4, §3.4): moved out of monsters.js in 0C. What they are is
// creatures.js; how blows land is monsters.js (combat.js from 0C's combat step).
//
//   updateCreatures(game, dt, radius = Infinity)
//       advance every creature by dt seconds. On the map only those within `radius` tiles (or already
//       hunting you) act; the rest wait until you come closer. People stand still (their brains, the
//       `villager` hook, come with WS8).
//   AI_HOOKS / registerAIHook(id, (game, c, dt, occ) → handled)
//       a creature's own brain, run each update before the usual AI: "guardian:<id>" for the three
//       guardians (guardians.js registers them), "boss" for the Lich King's phases (here); later
//       "legend", "villager", "merchant", "follower". handled = true skips the rest of the AI this update.
//       Which hook a creature runs: c.brain.hook, else its type's `ai`, else "guardian:<id>" or "boss".
//   pickTarget(game, c) → entity | null
//       every 0.25 s of game time (perceive): you, if it's hostile to you and has noticed you (the parent's
//       torch, darkness and stealth rules, with "torch lit" read as light.js !inDark at your eyes, so
//       daylight counts outdoors); otherwise the nearest creature it is hostile to (factions.js attitude)
//       that it can see within 8 tiles, preferring a grudge and whoever just hurt it.
//   flowTo(game, target) → Int16Array | null
//       the flow field toward the player (recomputed when you change tile or the blocks change); creature
//       targets get null and are approached by greedy steps.
//
// A creature target is kept in c.brain.target (its id) while it stays within 8 tiles; out of sight for
// 3 s it is dropped, and the creature goes back to wandering. Creatures live on the tile grid: each one
// stands on a tile or is stepping to a neighbour.
import { lineOfSight } from "./raycast.js";
import { flowField, canWalk, DIRS8, UNREACHABLE, MONSTER_STEP_UP, MONSTER_DROP } from "./pathing.js";
import { fearLight } from "./guardians.js";
import { B, FLOOR_Z } from "./world.js";
import { EYE, RADIUS, bonus } from "./player.js";
import { hasStatus, statusFlag, tickStatuses, removeStatus, capStatus } from "./status.js";
import { RULES } from "./rules.js";
import { CREATURE_TYPES, spawnCreature, addCreature, isFlat, canTalk, creaturesNear, buildBuckets, dropBuckets } from "./creatures.js";
import { attitude } from "./factions.js";
import { inDark } from "./light.js";
import { distance } from "./rng.js";
import { hitPlayer, killMonster, creatureHits } from "./monsters.js";

// (Kept on a function so guardians.js can register while this module is still loading.)
function hooks() { return (hooks.table ||= {}); }
export const AI_HOOKS = hooks();
export function registerAIHook(id, fn) {
  if (typeof fn !== "function") throw new Error(`registerAIHook: ${id} needs a function`);
  hooks()[id] = fn;
}
const hookOf = (c, t) => c.brain?.hook || t.ai || (t.guardian ? `guardian:${t.guardian}` : t.boss ? "boss" : null);

const FOE_RANGE = 8;      // creature targets: picked and followed within this many tiles
const FOE_FORGET = 3;     // … and dropped after this long out of sight (s)

// The flow field toward the player, kept on game (game.flow) and re-planned when the player reaches a
// new tile we can stand on, or the level changed. Creature targets have none.
export function flowTo(game, target) {
  const { zone, player } = game;
  if (target !== player) return null;
  const { w, stand } = zone;
  const ptx = Math.floor(player.x), pty = Math.floor(player.y);
  const pTileOk = ptx >= 0 && pty >= 0 && ptx < w && pty < zone.d && stand[ptx + pty * w] >= 0;
  if (!game.flow || game.flowVersion !== zone.navVersion ||
      (pTileOk && (ptx !== game.flowX || pty !== game.flowY))) {
    game.flow = flowField(zone, ptx, pty);
    game.flowX = ptx; game.flowY = pty; game.flowVersion = zone.navVersion;
  }
  return game.flow;
}

// The creature a creature is after (c.brain.target), if it's still here.
const foeOf = (game, c) => {
  const id = c.brain?.target;
  if (id === undefined || id === null || id === "player") return null;
  return game.zone.creatures.find((o) => o.id === id) || null;
};

export function updateCreatures(game, dt, radius = Infinity) {
  const { zone, player } = game;
  const { w, stand } = zone;
  const ptx = Math.floor(player.x), pty = Math.floor(player.y);
  flowTo(game, player);

  // Who holds which tile: a creature its tile and the one it steps to, a person (who stands their
  // ground) their own tile, each with its own id.
  const occ = new Int32Array(w * zone.d);
  for (const c of zone.creatures) { occ[c.tx + c.ty * w] = c.id; occ[c.nx + c.ny * w] = c.id; }
  buildBuckets(zone);

  try {
    for (const m of [...zone.creatures]) {
      if (canTalk(m)) continue;                     // people stand still (their brains come with WS8)
      if (!zone.creatures.includes(m)) continue;   // killed earlier this update (lightning, a split…)
      const t = CREATURE_TYPES[m.type];
      if (m.state !== "chase" && !m.brain?.target && Math.hypot(m.x - player.x, m.y - player.y) > radius) continue;
      const pace = (hasStatus(m, "chilled") ? 0.5 : 1) * (hasStatus(m, "hasted") ? RULES.haste : 1);
      m.anim += dt;
      m.hurt = Math.max(0, m.hurt - dt);
      m.cd = Math.max(0, m.cd - dt * pace);   // chilled: half as often; hasted: faster
      m.shot -= dt * pace;

      // The ground vanished (a trap opened): it falls to the floor below.
      if (stand[m.tx + m.ty * w] < 0) { killMonster(game, m, `The ${m.name} falls into the dark.`, false, false); continue; }

      // Its statuses: on fire or poisoned, 1 damage every half second (status.js; the kill goes through
      // the harm handler in monsters.js); chill, blindness, haste and stuns run down.
      const regenOk = !statusFlag(m, "noRegen");   // trolls knit back together — unless they're burning
      tickStatuses(game, m, dt);
      if (!zone.creatures.includes(m)) continue;
      if (regenOk && t.regen && m.hp < m.maxHp) {
        m.regenAcc += t.regen * dt;
        if (m.regenAcc >= 1) { m.regenAcc -= 1; m.hp++; }
      }
      const hook = hookOf(m, t);
      if (hook && AI_HOOKS[hook]?.(game, m, dt, occ)) continue;
      if (t.fearsLight && fearLight(game, m, dt)) continue;
      // Stunned (or paralysed): it can't do anything at all.
      if (statusFlag(m, "noAct")) continue;

      m.think -= dt;
      if (m.think <= 0) { m.think = 0.25; perceive(game, m, t); }

      const foe = m.state === "chase" ? null : foeOf(game, m);
      const moving = m.nx !== m.tx || m.ny !== m.ty;
      const dx = player.x - m.x, dy = player.y - m.y, dz = player.z - m.z;
      const flat = Math.hypot(dx, dy);
      const inReach = flat <= t.reach + RADIUS && dz > -1.2 && dz < 1.3;
      const r = t.ranged;

      if (moving) {
        const len = m.nx !== m.tx && m.ny !== m.ty ? Math.SQRT2 : 1;
        const wet = !t.hover && (zone.get(m.tx, m.ty, FLOOR_Z - 1) === B.WATER_SHALLOW || zone.get(m.nx, m.ny, FLOOR_Z - 1) === B.WATER_SHALLOW);
        m.p += (t.speed * m.speedMul * (m.state === "chase" || foe ? 1 : 0.45) * (wet ? 0.6 : 1) * pace * dt) / len;
        if (m.p >= 1) {
          occ[m.tx + m.ty * w] = 0;
          m.tx = m.nx; m.ty = m.ny; m.p = 0;
        }
      } else if (foe) {
        // After another creature: strike when in reach, else a greedy step its way.
        const fd = distance(foe.x - m.x, foe.y - m.y), fz = foe.z - m.z;
        if (fd <= t.reach + foe.w * 0.4 && fz > -1.2 && fz < 1.3) {
          if (m.cd <= 0 && lineOfSight(zone, m.x, m.y, m.z + m.h * 0.7, foe.x, foe.y, foe.z + foe.h * 0.6)) {
            m.cd = t.cooldown * m.cdMul;
            creatureHits(game, m, foe, t.damage[0] + Math.floor(Math.random() * (t.damage[1] - t.damage[0] + 1)) + (m.bonus || 0));
          }
        } else if (t.speed > 0) chooseStep(game, m, t, occ, ptx, pty, foe);
      } else if (m.state === "chase" && inReach) {
        if (m.cd <= 0 && lineOfSight(zone, m.x, m.y, m.z + m.h * 0.7, player.x, player.y, player.z + EYE * 0.6)) {
          m.cd = t.cooldown * m.cdMul;
          const dmg = t.damage[0] + Math.floor(Math.random() * (t.damage[1] - t.damage[0] + 1)) + (m.bonus || 0);
          if (isFlat(m) && game.view !== "map") {   // bitten by something you can't see
            hitPlayer(game, m, dmg, "something flat", "a bite from below");
            game.hint?.("flat", "Something bit you from the floor, and there's nobody there: only a moving shadow. A flat being! Look at the world from above (Tab) to fight it.");
          } else hitPlayer(game, m, dmg, `the ${m.name}`, `the ${m.name}'s blow`);
        }
      } else if (m.state === "chase" && r && m.sees && flat <= r.range && flat > 1.6) {
        // In sight and in range: shoot, and stay back once close enough.
        if (m.shot <= 0) {
          m.shot = r.cooldown * m.cdMul * (t.boss && m.phase >= 2 ? 0.6 : 1);
          shoot(game, m, r);
        }
        if (flat > r.hold) chooseStep(game, m, t, occ, ptx, pty);
      } else if (t.speed === 0) {
        // Rooted to the spot (the Colossus): it only turns to face you.
      } else if (m.state === "chase") {
        chooseStep(game, m, t, occ, ptx, pty);
      } else if (m.state === "wander") {
        m.pause -= dt;
        if (m.pause <= 0) { m.pause = 0.5 + Math.random() * 2.5; chooseStep(game, m, t, occ, ptx, pty); }
      }

      // Position: glide between tile centres; ease the height when stepping up or down.
      const za = stand[m.tx + m.ty * w], zb = stand[m.nx + m.ny * w];
      const s = m.p * m.p * (3 - 2 * m.p);
      m.x = m.tx + 0.5 + (m.nx - m.tx) * m.p;
      m.y = m.ty + 0.5 + (m.ny - m.ty) * m.p;
      m.z = (zb < 0 ? za : za + (zb - za) * s) + (t.hover || 0);
    }
  } finally {
    dropBuckets(zone);
  }
}

// Fire an arrow or a bolt at the player. Arrows arc (aimed to allow for the drop) and
// scatter a little, so in 3D you can sidestep them.
function shoot(game, m, r) {
  const p = game.player;
  const sx = m.x, sy = m.y, sz = m.z + m.h * 0.7;
  const dx = p.x - sx, dy = p.y - sy, dz = p.z + 1.1 - sz;
  const flat = Math.hypot(dx, dy), time = Math.hypot(flat, dz) / r.speed;
  const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.08;
  game.zone.projectiles.push({
    kind: r.kind, hostile: true, from: m,
    dmg: r.damage[0] + Math.floor(Math.random() * (r.damage[1] - r.damage[0] + 1)) + (m.bonus || 0),
    x: sx, y: sy, z: sz,
    vx: (Math.cos(ang) * flat) / time, vy: (Math.sin(ang) * flat) / time, vz: dz / time + 0.5 * r.gravity * time,
    g: r.gravity, life: 3, spin: 0,
  });
}

// The "boss" hook: the Lich King shrugs most statuses off, and its fight has three phases: at two thirds
// of its health it raises skeletons, at one third wraiths, and from then on it casts faster.
registerAIHook("boss", (game, m, dt, occ) => {
  removeStatus(game, m, "blinded");
  capStatus(m, "stunned", 1.5);
  bossPhase(game, m, occ);
  return false;
});

function bossPhase(game, m, occ) {
  const next = m.phase === 0 && m.hp <= m.maxHp * 0.66 ? ["skeleton", 3] : m.phase === 1 && m.hp <= m.maxHp * 0.33 ? ["wraith", 2] : null;
  if (!next) return;
  m.phase++;
  const [type, n] = next;
  const { zone } = game, { w, stand } = zone;
  const spots = [];
  for (let oy = -3; oy <= 3; oy++)
    for (let ox = -3; ox <= 3; ox++) {
      const x = m.tx + ox, y = m.ty + oy;
      if (Math.max(Math.abs(ox), Math.abs(oy)) < 2 || x < 0 || y < 0 || x >= w || y >= zone.d) continue;
      if (stand[x + y * w] >= 0 && !occ[x + y * w]) spots.push([x, y]);
    }
  for (let k = 0; k < n && spots.length; k++) {
    const [x, y] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    const o = addCreature(zone, spawnCreature(type, x, y, stand[x + y * w], { rng: Math.random, state: "chase", level: zone.level }));
    occ[x + y * w] = o.id;
  }
  game.log(m.phase === 1 ? "The Lich King raises its staff. The dead rise around it!" :
                           "The Lich King shrieks, and wraiths pour out of the walls!", [140, 255, 170]);
}

// Can it see the player? Light makes you easier to spot (your torch, or daylight: light.js); sprinting
// is loud. Then pickTarget: you, or a creature it's hostile to.
function perceive(game, m, t) {
  const { zone, player } = game;
  if (hasStatus(m, "blinded")) {   // blinded (darkness or shadows splashed on it): it loses track of you
    if (m.state === "chase") m.state = "wander";
    m.sees = false;
    if (m.brain?.target) m.brain.target = null;
    return;
  }
  const hostile = attitude(game, m, player) === "hostile";
  const dist = Math.hypot(player.x - m.x, player.y - m.y);
  const hidden = statusFlag(player, "hidden");   // potion of shadows
  const lit = !inDark(game, zone, player.x, player.y, player.z + EYE);
  const range = t.sight * (lit || t.darkSight ? 1 : 0.55) * (hidden ? 0.35 : 1) *
    (hasStatus(player, "darkened") && !t.darkSight ? 0.7 : 1) * Math.max(0.3, 1 - bonus(player, "stealth"));
  let sees = hostile && dist < range &&
    lineOfSight(zone, m.x, m.y, m.z + m.h * 0.8, player.x, player.y, player.z + EYE);
  m.sees = sees;
  if (hostile && !sees && !hidden && player.sprinting && dist < 6) sees = true;
  if (sees) {
    if (m.state !== "chase" && dist < 14) {
      if (t.boss) game.log("The Lich King rises from its throne. \"Another one comes to die.\"", t.color);
      else if (t.guardian) { /* guardians.js announces itself */ }
      else game.log(`A${/^[aeiou]/.test(m.name) ? "n" : ""} ${m.name} notices you!`, m.color);
    }
    m.state = "chase";
    m.lost = 0;
  } else if (m.state === "chase" && !t.boss && !t.guardian) {   // bosses never forget you
    m.lost += 0.25;
    if (m.lost > 8) m.state = "wander";
  }
  if (m.state !== "chase") pickTarget(game, m);
  else if (m.brain?.target) m.brain.target = null;
}

// Whom it's after now. You (when it's hunting you: perceive decides that), or the nearest creature it's
// hostile to and can see within FOE_RANGE tiles, a grudge or whoever just hurt it first. Sets
// c.brain.target (a creature's id) and returns the target.
export function pickTarget(game, c) {
  const { zone, player } = game;
  if (c.state === "chase") return player;
  const t = CREATURE_TYPES[c.type];
  const eyes = c.z + c.h * 0.8;
  const visible = (o) => lineOfSight(zone, c.x, c.y, eyes, o.x, o.y, o.z + o.h * 0.6);
  // Keep the one it has while it's near; forget it after FOE_FORGET seconds out of sight.
  const kept = foeOf(game, c);
  if (kept) {
    if (distance(kept.x - c.x, kept.y - c.y) <= FOE_RANGE) {
      if (visible(kept)) { c.brain.lost = 0; return kept; }
      if ((c.brain.lost = (c.brain.lost || 0) + 0.25) < FOE_FORGET) return kept;
    }
    c.brain.target = null;
    if (c.state === "idle") c.state = "wander";
  }
  let best = null, bestScore = Infinity;
  for (const o of creaturesNear(zone, c.x, c.y, Math.min(t.sight, FOE_RANGE))) {
    if (o === c || canTalk(o) || attitude(game, c, o) !== "hostile") continue;
    const d = distance(o.x - c.x, o.y - c.y);
    const score = d - (c.brain?.grudges?.[o.id] ? FOE_RANGE : 0) - (c.brain?.hurtBy === o.id ? FOE_RANGE * 2 : 0);
    if (score >= bestScore || !visible(o)) continue;
    best = o; bestScore = score;
  }
  if (!best) { if (c.brain?.target) c.brain.target = null; return null; }
  (c.brain ||= {}).target = best.id;
  c.brain.lost = 0;
  return best;
}

// Pick the next tile: downhill on the flow field when chasing you, a greedy step toward a creature
// target, a random neighbour when wandering (or now and then for erratic flyers like bats).
function chooseStep(game, m, t, occ, ptx, pty, foe = null) {
  const { zone, player } = game;
  const flow = foe ? null : game.flow;
  const { w, d, stand } = zone;
  const here = m.tx + m.ty * w;
  const chasing = (m.state === "chase" || foe) && !(t.erratic && Math.random() < t.erratic);
  const goal = foe || player;
  const hereDist = Math.hypot(m.tx + 0.5 - goal.x, m.ty + 0.5 - goal.y);
  let best = -1, bestScore = Infinity;
  for (const [ox, oy] of DIRS8) {
    const bx = m.tx + ox, by = m.ty + oy;
    if (bx < 0 || by < 0 || bx >= w || by >= d) continue;
    const bi = bx + by * w;
    if ((bx === ptx && by === pty) || (occ[bi] && occ[bi] !== m.id)) continue;
    if (!canWalk(stand, w, m.tx, m.ty, bx, by, MONSTER_STEP_UP, MONSTER_DROP)) continue;
    let score;
    if (!chasing) score = Math.random();
    else if (flow && flow[here] !== UNREACHABLE) {
      if (flow[bi] >= flow[here]) continue;
      score = flow[bi] + (ox && oy ? 0.4 : 0);
    } else {
      // A creature target, or the player somewhere we can't walk to (a ledge?): just get as close as possible.
      score = Math.hypot(bx + 0.5 - goal.x, by + 0.5 - goal.y);
      if (score >= hereDist) continue;
    }
    if (score < bestScore) { bestScore = score; best = bi; }
  }
  if (best >= 0) {
    m.nx = best % w; m.ny = (best - m.nx) / w; m.p = 0;
    occ[best] = m.id;
  }
}
