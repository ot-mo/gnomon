// How creatures think and move (TECH_DESIGN §1.4, §3.4, §8.3 WS8): moved out of monsters.js in 0C. What they
// are is creatures.js; how blows land is combat.js.
//
//   updateCreatures(game, dt, radius = Infinity)
//       advance every creature by dt seconds. Only those within `radius` tiles (or hunting you, after a
//       creature, fleeing, or following someone) act; the rest wait until you come closer. The map passes
//       12 (turns.js); in 3D an outdoor zone (a surface zone) uses RULES.ai.outdoorRadius (32), a dungeon
//       every creature. People stand still (their brains, the `villager` hook, are WS7's).
//   AI_HOOKS / registerAIHook(id, (game, c, dt, occ) → handled)
//       a creature's own brain, run each update before the usual AI: "guardian:<id>" for the three
//       guardians (guardians.js registers them), "boss" for the Lich King's phases (here); later
//       "legend", "villager", "merchant". handled = true skips the rest of the AI this update.
//       Which hook a creature runs: c.brain.hook, else its type's `ai`, else "guardian:<id>" or "boss".
//   pickTarget(game, c) → entity | null
//       every 0.25 s of game time (perceive): you, if it's hostile to you and has noticed you (creatures.js
//       sees: the parent's torch, darkness and stealth rules, with "torch lit" read as light.js !inDark at
//       your eyes, so daylight counts outdoors); otherwise the nearest creature it is hostile to (factions.js
//       attitude) that it can see within 8 tiles, preferring a grudge and whoever just hurt it.
//   flowTo(game, target) → Int16Array | null
//       the flow field toward the player (recomputed when you change tile or the blocks change); creature
//       targets get null and are approached by greedy steps.
//   leaderOf(game, c) → the player, a creature or null      recruit(game, c, leader = game.player)   dismiss(game, c)
//       followers: c.brain.leader ("player" or a creature's id). factions.js attitude makes a follower
//       friendly to its leader and gives it its leader's side; WS6b's Kindling recruits through recruit().
//   fleeLevel(c) → the share of its health below which it runs (0: never)
//
// The states (c.state, saved): "idle" and "wander" (nothing to do), "chase" (hunting you), "flee" (running
// from c.brain.flee, "player" or a creature's id), and with c.brain (saved too):
//   target     a creature it is after, kept while it stays within 8 tiles; out of sight for 3 s it is
//              dropped, and the creature goes back to wandering
//   leader     a follower keeps within RULES.ai.follow.near..far tiles of its leader (your flow field, or
//              greedy steps after a creature leader), fights what its leader's side fights, never you,
//              and goes with you wherever you go (over an edge, by the stairs, on the world map)
//   wary       (from factions.js attitude "wary" toward you) it watches you from within RULES.ai.wary.watch
//              tiles and backs off to stay RULES.ai.wary.keep tiles away; it never strikes first
//   flee       under fleeLevel × its health it runs from what hurts it (greedy steps away), until it has
//              healed to RULES.ai.flee.recover or not seen its foe for RULES.ai.flee.forget seconds; it
//              runs RULES.ai.flee.most seconds at most, and cornered or run out it turns at bay and fights
//              for RULES.ai.flee.brave seconds before it may run again. A type's `flee` (a share) says how cowardly it is; under
//              the d20 set RULES.ai.flee.byType gives the parent's living creatures one, the legacy set none
//   arriving   seconds until it comes after you into this zone (hidden, not acting, not touchable)
// Abilities (abilities.js): a creature with any (its innate list, its gear) tries each ready one every
// RULES.ai.ability.every seconds, when def.ai.when(game, c, target) says so; target is what it fights (you
// or a creature), passed to use() as { creature, point, tile, dir } like aimTarget's (creature may be you).
//
// Zone changes (zones.js events): on zone:leave the followers within reach (over an edge, by the stairs, on
// the world map: every one of them, §5.1), and over an edge the hunters within RULES.ai.chaseEdge tiles of the
// exit, leave the zone you leave (before write-behind snapshots it); on
// zone:enter they come in at the border you crossed (the stairs: beside you), each `arriving` for as long
// as its way to you took. On zone:enter, a zone you come back to catches up on the time you were away:
// statuses run out (status.js catchUpStatuses), creatures heal (fully after RULES.ai.heal.fullAfter s),
// hunts and grudges lapse, bombs and gas burn out.
//
// Creatures live on the tile grid: each one stands on a tile or is stepping to a neighbour.
import { lineOfSight } from "./raycast.js";
import { flowField, canWalk, DIRS8, UNREACHABLE, MONSTER_STEP_UP, MONSTER_DROP } from "./pathing.js";
import { fearLight } from "./guardians.js";
import { B, FLOOR_Z } from "./world.js";
import { EYE, RADIUS } from "./player.js";
import { hasStatus, statusFlag, tickStatuses, removeStatus, capStatus, catchUpStatuses, cooldownLeft } from "./status.js";
import { RULES, extendRules } from "./rules.js";
import { CREATURE_TYPES, spawnCreature, addCreature, removeCreature, isFlat, canTalk, creaturesNear, buildBuckets, dropBuckets, sees } from "./creatures.js";
import { attitude } from "./factions.js";
import { distance } from "./rng.js";
import { killMonster } from "./monsters.js";
import { resolveAttack, naturalSpec } from "./combat.js";
import { on } from "./events.js";
import { zoneState } from "./zones.js";
import { ABILITIES, abilitiesOf, activate } from "./abilities.js";

export const AI_RULES = extendRules("ai", {
  foeRange: 8, foeForget: 3,          // creature targets: picked and followed within 8 tiles, dropped after 3 s out of sight
  lose: 8,                            // a hunter that hasn't seen you for this long gives up (the parent's)
  outdoorRadius: 32,                  // 3D on a surface zone: creatures further away that aren't busy wait (§3.4)
  flee: { recover: 0.5, forget: 6,    // fleeing ends at half health, or after 6 s without seeing its foe,
          most: 10, brave: 15,        // or after 10 s however it goes; then it stands and fights for 15 s
          byType: { rat: 0.3, bat: 0.3, goblin: 0.2, archer: 0.3, spider: 0.2, orc: 0.12, salamander: 0.15 } },   // (d20 only)
  wary: { keep: 3, watch: 8 },
  follow: { near: 2, far: 5 },
  chaseEdge: 3,                       // hunters this close to the exit follow you over it (§5.1)
  heal: { fullAfter: 3600 },          // a zone you come back to: its creatures healed after an hour away
  ability: { every: 0.5 },
});
const FOE_RANGE = AI_RULES.foeRange;
const FOE_FORGET = AI_RULES.foeForget;

// (Kept on a function so guardians.js can register while this module is still loading.)
function hooks() { return (hooks.table ||= {}); }
export const AI_HOOKS = hooks();
export function registerAIHook(id, fn) {
  if (typeof fn !== "function") throw new Error(`registerAIHook: ${id} needs a function`);
  hooks()[id] = fn;
}
const hookOf = (c, t) => c.brain?.hook || t.ai || (t.guardian ? `guardian:${t.guardian}` : t.boss ? "boss" : null);

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
const byId = (game, id) => (id === undefined || id === null || id === "player" ? null : game.zone.creatures.find((o) => o.id === id) || null);
const foeOf = (game, c) => byId(game, c.brain?.target);

// --- Followers ------------------------------------------------------------------------------------------
export function leaderOf(game, c) {
  const l = c.brain?.leader;
  if (l === undefined || l === null) return null;
  return l === "player" ? game.player : byId(game, l);
}
export function recruit(game, c, leader = game.player) {
  const b = (c.brain ||= {});
  b.leader = leader === game.player ? "player" : leader.id;
  b.target = null;
  if (b.grudges) delete b.grudges[leader === game.player ? "player" : leader.id];
  if (c.state === "chase" || c.state === "flee") c.state = "wander";
  return c;
}
export function dismiss(game, c) {
  if (c.brain) delete c.brain.leader;
  return c;
}

// --- Fleeing ----------------------------------------------------------------------------------------------
export function fleeLevel(c, d20 = RULES.combat === "d20") {
  const t = CREATURE_TYPES[c.type] || {};
  if (c.brain?.flee !== undefined && typeof c.brain.flee === "number") return c.brain.flee;
  if (t.flee !== undefined) return t.flee;
  if (!d20 || t.guardian || t.boss) return 0;
  return AI_RULES.flee.byType[c.type] || 0;
}
let d20Now = false;   // RULES.combat === "d20", read once an update (RULES is a proxy)
// What it runs from: you, or the creature it last fought.
const threatOf = (game, c) => (c.brain?.fleeFrom === "player" ? game.player : byId(game, c.brain?.fleeFrom));

export function updateCreatures(game, dt, radius = Infinity) {
  const { zone, player } = game;
  const { w, stand } = zone;
  const ptx = Math.floor(player.x), pty = Math.floor(player.y);
  if (radius === Infinity && zone.type === "surface" && game.view !== "map") radius = AI_RULES.outdoorRadius;   // §3.4
  d20Now = RULES.combat === "d20";
  flowTo(game, player);

  // Who holds which tile: a creature its tile and the one it steps to, a person (who stands their
  // ground) their own tile, each with its own id.
  const occ = new Int32Array(w * zone.d);
  for (const c of zone.creatures) { if (c.brain?.arriving > 0) continue; occ[c.tx + c.ty * w] = c.id; occ[c.nx + c.ny * w] = c.id; }
  buildBuckets(zone);

  try {
    for (const m of [...zone.creatures]) {
      if (canTalk(m)) continue;                     // people stand still (their brains are WS7's)
      if (!zone.creatures.includes(m)) continue;   // killed earlier this update (lightning, a split…)
      const t = CREATURE_TYPES[m.type];
      const b = m.brain;
      if (b?.arriving > 0) {                       // still on its way into this zone after you
        b.arriving -= dt;
        if (b.arriving > 0) continue;
        arrive(game, m, occ);
      }
      if (m.state !== "chase" && m.state !== "flee" && !b?.target && !b?.leader && Math.hypot(m.x - player.x, m.y - player.y) > radius) continue;
      const pace = (hasStatus(m, "chilled") ? 0.5 : 1) * (hasStatus(m, "hasted") ? RULES.haste : 1);
      m.anim += dt;
      m.hurt = Math.max(0, m.hurt - dt);
      m.cd = Math.max(0, m.cd - dt * pace);   // chilled: half as often; hasted: faster
      m.shot -= dt * pace;
      if (b?.fleeT > 0) b.fleeT -= dt;        // fleeing: time out of sight of what it fears
      if (b?.fleeLeft > 0) b.fleeLeft -= dt;  // … and how long it will run at most
      if (b?.braveT > 0) b.braveT -= dt;      // cornered: time before it thinks of running again

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
      if ((m.innate || m.body) && useAbilities(game, m, dt) && !zone.creatures.includes(m)) continue;

      const foe = m.state === "chase" ? null : foeOf(game, m);
      const leader = foe ? null : leaderOf(game, m);
      const moving = m.nx !== m.tx || m.ny !== m.ty;
      const dx = player.x - m.x, dy = player.y - m.y, dz = player.z - m.z;
      const flat = Math.hypot(dx, dy);
      const inReach = flat <= t.reach + RADIUS && dz > -1.2 && dz < 1.3;
      const r = t.ranged;
      const pinned = !moving && statusFlag(m, "noMove");   // (a step already begun is finished)

      if (moving) {
        const len = m.nx !== m.tx && m.ny !== m.ty ? Math.SQRT2 : 1;
        const wet = !t.hover && (zone.get(m.tx, m.ty, FLOOR_Z - 1) === B.WATER_SHALLOW || zone.get(m.nx, m.ny, FLOOR_Z - 1) === B.WATER_SHALLOW);
        const brisk = m.state === "chase" || foe || m.state === "flee" || (leader && distance(leader.x - m.x, leader.y - m.y) > AI_RULES.follow.far);
        m.p += (t.speed * m.speedMul * (brisk ? 1 : 0.45) * (wet ? 0.6 : 1) * pace * dt) / len;
        if (m.p >= 1) {
          occ[m.tx + m.ty * w] = 0;
          m.tx = m.nx; m.ty = m.ny; m.p = 0;
        }
      } else if (m.state === "flee") {
        // Running: a step away from what it fears; cornered, it turns on it.
        const from = threatOf(game, m);
        if (!from) m.state = "wander";
        else if (!pinned && t.speed > 0 && stepAway(game, m, occ, ptx, pty, from)) { /* away */ }
        else {
          const brain = (m.brain ||= {});
          brain.braveT = AI_RULES.flee.brave;   // cornered: it fights for a while before it thinks of running again
          delete brain.fleeFrom; delete brain.fleeT; delete brain.fleeLeft;
          if (from === player) { m.state = "chase"; m.lost = 0; } else { brain.target = from.id; m.state = "wander"; }
        }
      } else if (foe) {
        // After another creature: strike when in reach, else a greedy step its way.
        const fd = distance(foe.x - m.x, foe.y - m.y), fz = foe.z - m.z;
        if (fd <= t.reach + foe.w * 0.4 && fz > -1.2 && fz < 1.3) {
          if (m.cd <= 0 && lineOfSight(zone, m.x, m.y, m.z + m.h * 0.7, foe.x, foe.y, foe.z + foe.h * 0.6)) {
            m.cd = t.cooldown * m.cdMul;
            resolveAttack(game, m, foe, naturalSpec(m));
          }
        } else if (t.speed > 0 && !pinned) chooseStep(game, m, t, occ, ptx, pty, foe);
      } else if (m.state === "chase" && inReach) {
        if (m.cd <= 0 && lineOfSight(zone, m.x, m.y, m.z + m.h * 0.7, player.x, player.y, player.z + EYE * 0.6)) {
          m.cd = t.cooldown * m.cdMul;
          if (isFlat(m) && game.view !== "map") {   // bitten by something you can't see
            resolveAttack(game, m, player, naturalSpec(m), { source: "something flat", blocked: "a bite from below" });
            game.hint?.("flat", "Something bit you from the floor, and there's nobody there: only a moving shadow. A flat being! Look at the world from above (Tab) to fight it.");
          } else resolveAttack(game, m, player, naturalSpec(m));
        }
      } else if (m.state === "chase" && r && m.sees && flat <= r.range && flat > 1.6) {
        // In sight and in range: shoot, and stay back once close enough.
        if (m.shot <= 0) {
          m.shot = r.cooldown * m.cdMul * (t.boss && m.phase >= 2 ? 0.6 : 1);
          shoot(game, m, r);
        }
        if (flat > r.hold && !pinned) chooseStep(game, m, t, occ, ptx, pty);
      } else if (t.speed === 0 || pinned) {
        // Rooted to the spot (the Colossus, or pinned): it only turns to face you.
      } else if (m.state === "chase") {
        chooseStep(game, m, t, occ, ptx, pty);
      } else if (leader) {
        followStep(game, m, occ, ptx, pty, leader);
      } else if (m.brain?.wary) {
        if (flat < AI_RULES.wary.keep) stepAway(game, m, occ, ptx, pty, player);
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

// Can it see the player? Light makes you easier to spot (your torch, or daylight: creatures.js sees);
// sprinting is loud; pressed flat you are invisible to deep things. Then: fleeing, wariness, and
// pickTarget (you, or a creature it's hostile to).
function perceive(game, m, t) {
  const { player } = game;
  if (hasStatus(m, "blinded")) {   // blinded (darkness or shadows splashed on it): it loses track of you
    if (m.state === "chase") m.state = "wander";
    m.sees = false;
    if (m.brain?.target) m.brain.target = null;
    return;
  }
  const feel = attitude(game, m, player), hostile = feel === "hostile";
  if (feel === "friendly" && m.state === "chase") m.state = "wander";   // (nothing on your side hunts you)
  const dist = Math.hypot(player.x - m.x, player.y - m.y);
  const hidden = statusFlag(player, "hidden");   // potion of shadows
  const shadow = statusFlag(player, "flat") && !isFlat(m);   // pressed flat: a shadow with nobody casting it
  let seen = hostile && sees(game, m, player);
  m.sees = seen;
  if (hostile && !seen && !hidden && !shadow && player.sprinting && dist < 6) seen = true;
  if (m.state === "flee") { keepFleeing(game, m, seen); return; }
  if (seen) {
    if (m.state !== "chase" && dist < 14) {
      if (t.boss) game.log("The Lich King rises from its throne. \"Another one comes to die.\"", t.color);
      else if (t.guardian) { /* guardians.js announces itself */ }
      else game.log(`A${/^[aeiou]/.test(m.name) ? "n" : ""} ${m.name} notices you!`, m.color);
    }
    m.state = "chase";
    m.lost = 0;
  } else if (m.state === "chase" && !t.boss && !t.guardian) {   // bosses never forget you
    if (shadow) m.state = "wander";   // gone into the Plane: it has nothing to follow
    m.lost += 0.25;
    if (m.lost > AI_RULES.lose) m.state = "wander";
  }
  // Hurt badly enough, it runs from what it was fighting (not for a while after it was cornered).
  const fleeAt = fleeLevel(m, d20Now);
  if (fleeAt > 0 && !(m.brain?.braveT > 0) && m.hp < m.maxHp * fleeAt) {
    const from = m.state === "chase" ? player : foeOf(game, m) || byId(game, m.brain?.hurtBy);
    if (from) {
      const brain = (m.brain ||= {});
      brain.fleeFrom = from === player ? "player" : from.id;
      brain.fleeT = AI_RULES.flee.forget;
      brain.fleeLeft = AI_RULES.flee.most;
      brain.target = null;
      m.state = "flee";
      if (dist < 14 && from === player) game.log(`The ${m.name} turns and runs!`, m.color);
      return;
    }
  }
  // Wary of you (factions.js): it watches you from a distance.
  if (!hostile && feel === "wary" && m.state !== "chase" && dist < AI_RULES.wary.watch && sees(game, m, player)) (m.brain ||= {}).wary = true;
  else if (m.brain?.wary) delete m.brain.wary;
  if (m.state !== "chase") pickTarget(game, m);
  else if (m.brain?.target) m.brain.target = null;
}

// A fleeing creature: it stops once healed enough, or once it hasn't seen what it fears for a while.
function keepFleeing(game, m, seenYou) {
  const b = (m.brain ||= {}), from = threatOf(game, m);
  const seen = from === game.player ? seenYou : !!from && sees(game, m, from);
  if (seen || b.fleeT === undefined) b.fleeT = AI_RULES.flee.forget;   // (updateCreatures counts it down)
  const healed = m.hp >= m.maxHp * AI_RULES.flee.recover;
  if (!from || healed || b.fleeT <= 0 || !(b.fleeLeft > 0)) {
    m.state = "wander";
    if (!healed && from && b.fleeT > 0) b.braveT = AI_RULES.flee.brave;   // run out of running: it turns at bay
    delete b.fleeFrom; delete b.fleeT; delete b.fleeLeft;
    if (from === game.player && seenYou && (healed || b.braveT > 0)) { m.state = "chase"; m.lost = 0; }
    else if (from && from !== game.player && b.braveT > 0) b.target = from.id;
  }
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
    if (o === c || canTalk(o) || o.brain?.arriving > 0 || attitude(game, c, o) !== "hostile") continue;
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

// A step to a free neighbour that `score` likes best (lower is better; null: not that one). No dice:
// the new states draw no random numbers, so the legacy set's draws stay the parent's.
function stepBy(game, m, occ, ptx, pty, score) {
  const { zone } = game, { w, d, stand } = zone;
  let best = -1, bestScore = Infinity;
  for (const [ox, oy] of DIRS8) {
    const bx = m.tx + ox, by = m.ty + oy;
    if (bx < 0 || by < 0 || bx >= w || by >= d) continue;
    const bi = bx + by * w;
    if ((bx === ptx && by === pty) || (occ[bi] && occ[bi] !== m.id)) continue;
    if (!canWalk(stand, w, m.tx, m.ty, bx, by, MONSTER_STEP_UP, MONSTER_DROP)) continue;
    const s = score(bx, by, bi, ox && oy);
    if (s === null || s >= bestScore) continue;
    bestScore = s; best = bi;
  }
  if (best < 0) return false;
  m.nx = best % w; m.ny = (best - m.nx) / w; m.p = 0;
  occ[best] = m.id;
  return true;
}
// Away from `from` (you or a creature): the neighbour furthest from it, if that is further than here.
function stepAway(game, m, occ, ptx, pty, from) {
  const here = distance(m.tx + 0.5 - from.x, m.ty + 0.5 - from.y);
  return stepBy(game, m, occ, ptx, pty, (bx, by) => {
    const dd = distance(bx + 0.5 - from.x, by + 0.5 - from.y);
    return dd > here + 0.05 ? -dd : null;
  });
}
// After its leader: on your flow field toward you (a creature leader: greedy), until it is within
// follow.near tiles.
function followStep(game, m, occ, ptx, pty, leader) {
  const dist = distance(leader.x - m.x, leader.y - m.y);
  if (dist <= AI_RULES.follow.near) return false;
  const { zone } = game, w = zone.w, flow = leader === game.player ? game.flow : null;
  const here = m.tx + m.ty * w;
  if (flow && flow[here] !== UNREACHABLE)
    return stepBy(game, m, occ, ptx, pty, (bx, by, bi, diag) => (flow[bi] < flow[here] ? flow[bi] + (diag ? 0.4 : 0) : null));
  return stepBy(game, m, occ, ptx, pty, (bx, by) => {
    const dd = distance(bx + 0.5 - leader.x, by + 0.5 - leader.y);
    return dd < dist ? dd : null;
  });
}

// --- Abilities --------------------------------------------------------------------------------------------
// Every RULES.ai.ability.every seconds, each ready ability whose def.ai.when says so, at what it fights.
// → true when one was used (it may have moved or killed something).
function useAbilities(game, m, dt) {
  const b = (m.brain ||= {});
  b.abilityT = (b.abilityT ?? 0) - dt;
  if (b.abilityT > 0) return false;
  b.abilityT = AI_RULES.ability.every;
  const tgt = m.state === "chase" ? game.player : foeOf(game, m);
  for (const a of abilitiesOf(m)) {
    const def = ABILITIES[a.id];
    if (!def?.ai?.when || cooldownLeft(m, a.id) > 0) continue;
    if (!def.ai.when(game, m, tgt)) continue;
    const d = tgt ? distance(tgt.x - m.x, tgt.y - m.y) || 1 : 1;
    const target = tgt ? { creature: tgt, point: { x: tgt.x, y: tgt.y, z: tgt.z }, tile: { x: Math.floor(tgt.x), y: Math.floor(tgt.y) },
                           dir: [(tgt.x - m.x) / d, (tgt.y - m.y) / d, 0] } : null;
    if (activate(game, m, a.id, target)) return true;   // one a turn
  }
  return false;
}

// --- Across zone changes ----------------------------------------------------------------------------------
// Who is going with you (zone:leave takes them out, zone:enter brings them in; both inside one enterZone).
let transit = [];

on("zone:leave", (game, { zone, how }) => {
  transit = [];
  const p = game.player;
  if (!zone?.creatures || !p) return;
  const edge = how === "edge", stairs = how === "down" || how === "up" || how === "travel";   // (travel: WS1's world map)
  if (!edge && !stairs) return;
  const ex = Math.max(0, Math.min(zone.w, p.x)), ey = Math.max(0, Math.min(zone.d, p.y));   // the exit: where you left the zone's ground
  for (const c of [...zone.creatures]) {
    if (canTalk(c) || c.hp <= 0) continue;   // (one still arriving comes along again, from where it was put)
    const t = CREATURE_TYPES[c.type];
    if (t.guardian || t.boss || t.statue || !(t.speed > 0) || statusFlag(c, "noAct") || statusFlag(c, "noMove")) continue;
    const d = distance(c.x - p.x, c.y - p.y);
    const follows = leaderOf(game, c) === p;
    const chases = edge && !follows && c.state === "chase" && distance(c.x - ex, c.y - ey) <= AI_RULES.chaseEdge && attitude(game, c, p) === "hostile";
    if (!follows && !chases) continue;
    removeCreature(zone, c);
    zone.sightings?.delete(c.id);
    const speed = Math.max(0.5, t.speed * (c.speedMul || 1));
    transit.push({ c, from: zone, dx: c.x - p.x, dy: c.y - p.y, delay: Math.min(4, d / speed), follows });
  }
});

on("zone:enter", (game, { zone, arrival, how, away }) => {
  if (how !== "load" && away > 0) catchUpZone(game, zone, away);
  const movers = transit;
  transit = [];
  for (const m of movers) place(game, zone, arrival, m, how);
});

// A mover comes in: over an edge at the border you crossed, as far along it as it was beside you; by
// the stairs beside you. Hidden and still for `delay` seconds (brain.arriving). On the nearest free tile within
// 4; if every one is taken, on the nearest standable one all the same (ai.js arrive moves it off a taken tile
// when it shows); with no ground at all there, it stays in the zone it was leaving, where it stood.
function place(game, zone, at, { c, from, dx, dy, delay }, how) {
  const { w, d, stand } = zone;
  let sx = Math.floor(at.x + (how === "edge" ? dx : Math.sign(dx))), sy = Math.floor(at.y + (how === "edge" ? dy : Math.sign(dy)));
  sx = Math.max(0, Math.min(w - 1, sx)); sy = Math.max(0, Math.min(d - 1, sy));
  const ax = Math.floor(at.x), ay = Math.floor(at.y);
  const ground = (x, y) => x >= 0 && y >= 0 && x < w && y < d && stand[x + y * w] >= 0 && !(x === ax && y === ay) &&
    zone.get(x, y, stand[x + y * w] - 1) !== B.WATER_DEEP && Math.abs(stand[x + y * w] - at.z) <= 3;
  const free = (x, y) => ground(x, y) && !zone.creatures.some((o) => (o.tx === x && o.ty === y) || (o.nx === x && o.ny === y));
  const near = (ok) => {
    for (let r = 0; r <= 4; r++)
      for (let oy = -r; oy <= r; oy++)
        for (let ox = -r; ox <= r; ox++) if (Math.max(Math.abs(ox), Math.abs(oy)) === r && ok(sx + ox, sy + oy)) return [sx + ox, sy + oy];
    return null;
  };
  const spot = near(free) || near(ground);
  if (!spot) { if (from && !from.creatures.includes(c)) addCreature(from, c); return; }   // no way in: it stays where it was
  const t = CREATURE_TYPES[c.type];
  Object.assign(c, { tx: spot[0], ty: spot[1], nx: spot[0], ny: spot[1], p: 0, x: spot[0] + 0.5, y: spot[1] + 0.5, z: stand[spot[0] + spot[1] * w] + (t.hover || 0) });
  const b = (c.brain ||= {});
  b.arriving = delay;
  b.target = null;
  addCreature(zone, c);
  if (c.uid && zoneState(game).uids[c.uid] !== undefined && zoneState(game).uids[c.uid] !== "dead") zoneState(game).uids[c.uid] = zone.key;
}

// It has caught up with you: it shows, and a hunter takes up the hunt where it left it.
function arrive(game, m, occ) {
  delete m.brain.arriving;
  // While it was on its way you (or someone) may have stepped onto its tile: it comes in beside it instead.
  const zone = game.zone, { w, d, stand } = zone, p = game.player;
  const taken = (x, y) => (x === Math.floor(p.x) && y === Math.floor(p.y)) || (occ[x + y * w] && occ[x + y * w] !== m.id);
  if (taken(m.tx, m.ty)) {
    let spot = null;
    for (let r = 1; r <= 3 && !spot; r++)
      for (let oy = -r; oy <= r && !spot; oy++)
        for (let ox = -r; ox <= r && !spot; ox++) {
          const x = m.tx + ox, y = m.ty + oy;
          if (Math.max(Math.abs(ox), Math.abs(oy)) === r && x >= 0 && y >= 0 && x < w && y < d && stand[x + y * w] >= 0 && !taken(x, y)) spot = [x, y];
        }
    if (spot) Object.assign(m, { tx: spot[0], ty: spot[1], nx: spot[0], ny: spot[1], p: 0, x: spot[0] + 0.5, y: spot[1] + 0.5, z: stand[spot[0] + spot[1] * w] + (CREATURE_TYPES[m.type].hover || 0) });
  }
  occ[m.tx + m.ty * w] = m.id;
  if (m.state === "chase") { m.lost = 0; if (distance(game.player.x - m.x, game.player.y - m.y) < 14) game.log(`The ${m.name} comes after you!`, m.color); }
}

// A zone you come back to after `away` seconds: the time passes for it all at once.
function catchUpZone(game, zone, away) {
  for (const c of [...zone.creatures]) {
    if (canTalk(c)) continue;
    catchUpStatuses(game, c, away);
    if (!zone.creatures.includes(c) || c.hp <= 0) continue;
    if (c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + Math.floor((c.maxHp * away) / AI_RULES.heal.fullAfter));
    c.hurt = 0;
    if (away > 2) c.cd = 0;
    if (c.state === "chase" && away > AI_RULES.lose) c.state = "wander";
    if (c.state === "flee") c.state = "wander";
    const b = c.brain;
    if (b) {
      if (away > FOE_FORGET) b.target = null;
      if (b.arriving > 0) b.arriving = Math.max(0, b.arriving - away);
      delete b.fleeFrom; delete b.fleeT; delete b.fleeLeft; delete b.wary; delete b.braveT;
    }
  }
  zone.bombs = (zone.bombs || []).filter((bomb) => (bomb.fuse -= away) > 0);   // went off while you were away
  zone.clouds = (zone.clouds || []).filter((cl) => (cl.time -= away) > 0);
  zone.projectiles = [];
}
