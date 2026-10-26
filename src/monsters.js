// Monsters: how they fight (blows, damage, death). What they are (the types, spawning, sprites, who can
// touch whom) is creatures.js, with the parent game's types in content/creatures/legacy.js; how they
// think and move is ai.js.
import { lineOfSight } from "./raycast.js";
import { DIRS8 } from "./pathing.js";
import { makeItem, randomPotion, randomScroll, randomEquipment, randomJewel, awayFromWalls, strNeeded, WEAPONS, ELEMENTS } from "./items.js";
import { colossusCore } from "./guardians.js";
import { EYE, HEIGHT, RADIUS, moveAxis, attackTime, armourValue, bonus, weaponReach } from "./player.js";
import { gainXp } from "./leveling.js";
import { sfx } from "./sfx.js";
import { attr, maxHp } from "./stats.js";
import { wielded } from "./body.js";
import { addStatus, hasStatus, statusFlag, cooldownLeft, startCooldown, setStatusHarm, STATUS_DEFS } from "./status.js";
import { RULES } from "./rules.js";
import { uidWhere, killUid } from "./zones.js";
import { CREATURE_TYPES, spawnCreature, addCreature, removeCreature, touchable, isFlat, ghostHidden, canTalk } from "./creatures.js";

// How an element fares against a monster: "resist", "weak" or null.
export function elementVs(m, el) {
  if (!el) return null;
  const t = CREATURE_TYPES[m.type];
  if (m.ward || t.resist?.includes(el)) return "resist";
  if (t.weak?.includes(el)) return "weak";
  return null;
}
// For the map's inspect line: "weak to fire, resists frost".
export function resistText(m) {
  const t = CREATURE_TYPES[m.type], parts = [];
  if (t.weak?.length) parts.push(`weak to ${t.weak.join(" and ")}`);
  if (m.ward) parts.push("elements don't touch it");
  else if (t.resist?.length) parts.push(`resists ${t.resist.join(" and ")}`);
  if (t.brittle) parts.push("brittle");
  return parts.join(", ");
}

// A blow (or arrow, or bolt) lands on you. Armour soaks up part of it; cursed armour
// below zero lets more through. Venom poisons you, and a draining monster heals.
export function hitPlayer(game, m, dmg, source, blocked, ranged = false) {
  const p = game.player;
  if (statusFlag(p, "untouchable")) { game.log(`The blow passes through you: you're still half turned out of the world.`, [200, 230, 255]); return; }
  // The warding amulet: the first blow misses, then not again for RULES.cooldown.firstBlock seconds
  // (it was once per floor; TECH_DESIGN §2.4).
  if (bonus(p, "firstBlock") > 0 && !(cooldownLeft(p, "firstBlock") > 0)) {
    startCooldown(p, "firstBlock", RULES.cooldown.firstBlock);
    game.log(`Your amulet flares, and ${blocked} misses you!`, [220, 225, 240]);
    sfx("block", { at: m });
    return;
  }
  const arm = armourValue(p);
  dmg += arm >= 0 ? -Math.floor(Math.random() * (arm + 1)) : Math.floor(Math.random() * (-arm + 1));
  if (ranged) dmg -= bonus(p, "ward");
  if (dmg <= 0) { game.log(`Your armour turns ${blocked}.`, [170, 180, 200]); sfx("block", { at: m }); return; }
  game.hurtPlayer(dmg, source);
  // Thorns: whoever hit you (up close) gets hurt back.
  const thorns = bonus(p, "thorns");
  if (thorns > 0 && !ranged && m.hp > 0 && game.zone.creatures.includes(m)) {
    hurtMonster(game, m, thorns, `${thorns}`, [150, 200, 90]);
    if (m.hp <= 0) killMonster(game, m, `The ${m.name} dies on your thorns.`);
  }
  if (m.burns) {   // a salamander's bite sets you smouldering: 1 damage a second
    // The legacy set keeps the parent's bite exactly: poison, the same stream as venom (Thick blood halves
    // it, regeneration goes on, the cause is poison). Otherwise it's burning at half rate.
    const legacy = RULES.stats === "legacy", id = legacy ? "poisoned" : "burning";
    if (!hasStatus(p, id)) game.log(`The ${m.name}'s bite burns!`, [255, 140, 60]);
    addStatus(game, p, id, legacy ? { t: m.burns, stack: "max" } : { t: m.burns, mag: 0.5, stack: "max" });
  }
  if (m.venom) {
    if (!hasStatus(p, "poisoned")) game.log(`The ${m.name}'s venom burns in your veins!`, [150, 210, 80]);
    addStatus(game, p, "poisoned", { t: m.venom, stack: "max" });
  }
  if (m.drain && m.hp > 0 && m.hp < m.maxHp) {
    m.hp = Math.min(m.maxHp, m.hp + dmg);
    game.effects.push({ kind: "damage", x: m.x, y: m.y, z: m.z + m.h + 0.15, text: `+${dmg}`, color: [235, 60, 90], time: game.time });
  }
}

// What an elite leaves behind: always something, sometimes gear, a ring or an amulet.
function eliteLoot(depth, luck = 0) {
  const r = Math.random();
  return r < 0.35 ? randomPotion() : r < 0.55 ? randomScroll() : r < 0.68 && depth >= 3 ? randomJewel(Math.random, depth + 1, 0.1 + luck)
    : randomEquipment(Math.random, depth + 1, 0.2 + luck);
}

// byPlayer: you killed it (by blade, fire or lightning), so you get its XP.
// How a status hurts (status.js): you through hurtPlayer (quietly, as poison always did); a creature
// flashes, and dies with the status's own line.
setStatusHarm((game, e, n, id) => {
  const def = STATUS_DEFS[id];
  if (e === game.player) { game.hurtPlayer(n, def?.cause || id, true); return; }
  e.hp -= n;
  e.hurt = 0.1;
  if (e.hp <= 0 && game.zone?.creatures.includes(e)) killMonster(game, e, def?.killed?.(e) || `The ${e.name} dies.`);
});

export function killMonster(game, m, message, dropLoot = true, byPlayer = true) {
  const { zone } = game;
  const t = CREATURE_TYPES[m.type];
  removeCreature(zone, m);
  zone.sightings.delete(m.id);
  if (m.uid && uidWhere(game, m.uid)) killUid(game, m.uid);   // a claimed uid (a quest's, a legend's) stays dead
  if (Math.hypot(game.player.x - m.x, game.player.y - m.y) < 14) { game.log(message, [230, 230, 230]); sfx("kill", { at: m }); }
  if (byPlayer && m.xp > 0) {
    game.effects.push({ kind: "damage", x: m.x, y: m.y, z: m.z + m.h + 0.5, text: `+${m.xp} XP`, color: [160, 230, 255], time: game.time });
    gainXp(game, m.xp);
  }
  const ground = zone.stand[m.tx + m.ty * zone.w];
  const p = game.player;
  if (byPlayer) {
    const heal = bonus(p, "killHeal") + (t.undead ? bonus(p, "undeadHeal") : 0);
    if (heal > 0 && p.hp < maxHp(p)) p.hp = Math.min(maxHp(p), p.hp + heal);
    else if (heal < 0) game.hurtPlayer(-heal, "your cursed ring", true);
  }
  if (t.guardian) game.onGuardianDies?.(m);
  else if (dropLoot && ground >= 0) {
    // Lucky: twice as likely to drop something.
    const luck = p.perks.has("lucky") ? 2 : 1;
    if (m.elite || Math.random() < 0.25 * luck)
      zone.items.push(makeItem({ kind: "cash", amount: Math.round((1 + Math.floor(Math.random() * (2 + zone.level * 0.6))) * (m.elite ? 1.5 : 1)) }, ...awayFromWalls(zone, m.x + 0.15, m.y + 0.1, ground), ground));
    const [ix, iy] = awayFromWalls(zone, m.x, m.y, ground);
    if (m.elite) zone.items.push(makeItem(eliteLoot(zone.level, luck > 1 ? 0.15 : 0), ix, iy, ground));
    else if (Math.random() < 0.25 * luck) {
      const r = Math.random();
      zone.items.push(makeItem(r < 0.5 ? randomPotion() : r < 0.8 ? randomScroll() : { kind: "bomb", count: 1 }, ix, iy, ground));
    }
  }
  // A slime splits in two (into the free tiles around it).
  if (t.splits && dropLoot) {
    const spots = [[0, 0], ...DIRS8].map(([ox, oy]) => [m.tx + ox, m.ty + oy])
      .filter(([x, y]) => x >= 0 && y >= 0 && x < zone.w && y < zone.d && zone.stand[x + y * zone.w] >= 0 &&
        !zone.creatures.some((o) => !canTalk(o) && o.tx === x && o.ty === y));
    for (const [x, y] of spots.slice(0, 2)) addCreature(zone, spawnCreature(t.splits, x, y, zone.stand[x + y * zone.w], { rng: Math.random, state: "chase", level: zone.level }));
    if (spots.length) game.log(`The ${m.name} splits in two!`, m.color);
  }
  if (m.bounty) game.questEvent?.("bounty", m);
  if (t.boss) game.win();
}

// Monsters are solid: push the player out of any they overlap.
export function pushPlayerOut(game) {
  const { zone, player: p } = game;
  for (const m of zone.creatures) {
    if (canTalk(m)) continue;   // people step aside for you (as they always have)
    if (isFlat(m) || ghostHidden(game, m) || p.z > m.z + m.h || p.z + HEIGHT < m.z) continue;   // you walk right over flat things
    const dx = p.x - m.x, dy = p.y - m.y, dist = Math.hypot(dx, dy);
    const minDist = RADIUS + m.w * 0.4;
    if (dist < minDist && dist > 1e-4) {
      moveAxis(p, zone, "x", (dx / dist) * (minDist - dist));
      moveAxis(p, zone, "y", (dy / dist) * (minDist - dist));
    }
  }
}

// 3D: swing at whatever is in front of you.
export function playerAttack(game) {
  const p = game.player;
  if (p.attackCd > 0 || statusFlag(p, "noAct")) return;
  p.attackCd = attackTime(p);
  p.swingTime = p.attackCd * 0.78;   // the animation fills most of the time between swings
  p.swing = p.swingTime;
  const reach = weaponReach(p);
  sfx("swing", { heavy: WEAPONS[wielded(p).id].swing >= 0.6 });
  const cp = Math.cos(p.pitch);
  const fx = cp * Math.cos(p.yaw), fy = cp * Math.sin(p.yaw), fz = Math.sin(p.pitch);
  const ex = p.x, ey = p.y, ez = p.z + EYE;
  let best = null, bestDist = Infinity;
  for (const m of game.zone.creatures) {
    if (!touchable(game, m, p, { blade: true })) continue;   // a flat being: your blade passes through its shadow; people
    const cz = m.z + m.h * 0.5;
    const vx = m.x - ex, vy = m.y - ey, vz = cz - ez;
    const dist = Math.hypot(vx, vy, vz);
    if (dist > reach + m.w * 0.5) continue;
    if ((vx * fx + vy * fy + vz * fz) / dist < (dist < 1.2 ? 0.2 : 0.7)) continue;
    if (!lineOfSight(game.zone, ex, ey, ez, m.x, m.y, cz)) continue;
    if (dist < bestDist) { bestDist = dist; best = m; }
  }
  if (best) attackMonster(game, best);
}

// Armoured elites shrug off part of every hit (never all of it).
const soak = (m, dmg, pierce = false) => Math.max(1, dmg - (pierce ? 0 : m.armour || 0));

// Hit a monster (3D swing or bumping into it on the map).
// Damage: your weapon's roll, + its enchantment (cursed weapons hit softer), + 1 per 2 points
// of strength beyond what it needs; then everything your gear and perks add (crits, crushing,
// executioner…). Then its element, if it has one, unless the monster resists it:
//   fire – sets it burning · frost – slows it · storm – lightning arcs to another monster
//   holy – double damage against the undead
export function attackMonster(game, m) {
  const t = CREATURE_TYPES[m.type];
  const p = game.player, weapon = wielded(p), w = WEAPONS[weapon.id];
  if (!touchable(game, m, p, { blade: true })) {   // on the map, bumping into something that isn't in the plane
    game.log(m.risen ? `Your blow passes under the ${m.name}: she has risen out of the plane! Turn the world (Tab) to strike her.`
                     : t.ghostly ? `Your blow passes through empty air. Something cold is here, but your torchlight hides it.`
                     : `You can't touch the ${m.name} from here.`, [200, 190, 255]);
    return;
  }
  const crit = Math.random() < 0.12 + bonus(p, "crit");
  const hi = w.dmg[1] + bonus(p, "maxDmg");
  const roll = w.dmg[0] + Math.floor(Math.random() * (hi - w.dmg[0] + 1));
  let dmg = Math.max(1, roll + weapon.ench + Math.max(0, Math.floor((attr(p, "str") - strNeeded(weapon)) / 2)));
  const el = weapon.element, vs = elementVs(m, el);
  if (el === "holy" && t.undead && vs !== "resist") dmg *= 2;
  if (vs === "weak") dmg = Math.ceil(dmg * 1.5);
  if (vs === "resist") dmg = Math.max(1, Math.round(dmg * 0.6));
  if (t.brittle && bonus(p, "crush") > 0) dmg *= 2;
  if (hasStatus(m, "burning") && bonus(p, "burnBonus") > 0) dmg = Math.ceil(dmg * (1 + bonus(p, "burnBonus")));
  if (m.hp < m.maxHp * 0.25 && p.perks.has("executioner")) dmg = Math.ceil(dmg * 1.5);
  if ((m.elite || t.guardian || t.boss) && p.perks.has("giantSlayer")) dmg = Math.ceil(dmg * 1.3);
  const sunder = crit && bonus(p, "sunder") > 0;
  if (crit) dmg *= sunder ? 3 : 2;
  if (isFlat(m) && game.view !== "map") dmg = Math.max(1, Math.floor(dmg / 2));   // the Edge of the Plane, in 3D
  // The Colossus: only its glowing core (up on its head) really feels a blow.
  const core = t.guardian === "colossus" ? colossusCore(game, m) : true;
  if (!core) dmg = 1;
  dmg = soak(m, dmg, sunder);
  const color = el ? ELEMENTS[el].color : crit ? [255, 220, 80] : [255, 255, 255];
  hurtMonster(game, m, dmg, crit ? `${dmg}!` : `${dmg}`, color);
  game.effects.push({ kind: "spark", time: game.time, crit, color });
  if (bonus(p, "leech") > 0 && p.hp < maxHp(p) && Math.random() < bonus(p, "leech")) p.hp++;

  if (m.hp <= 0) killMonster(game, m, `You slay the ${m.name}.`);
  else {
    if (!core) game.log(`Your blow glances off its stone legs. Its core glows far above you: get up high!`, [255, 200, 120]);
    else game.log(`You ${crit ? "smash" : "hit"} the ${m.name} (${dmg}).${vs === "weak" ? " It's weak to that!" : ""}`, [230, 230, 230]);
    if (vs === "resist") game.log(`The ${m.name} shrugs off the ${{ fire: "flames", frost: "frost", shock: "lightning", holy: "light" }[el]}.`, [170, 170, 190]);
    else {
      if (el === "fire") { if (!hasStatus(m, "burning")) game.log(`The ${m.name} catches fire!`, ELEMENTS.fire.color); addStatus(game, m, "burning", { t: 3, stack: "refresh" }); }
      if (el === "frost") addStatus(game, m, "chilled", { t: 3, stack: "refresh" });
    }
    const poison = bonus(p, "poisonHit");
    if (poison > 0) addStatus(game, m, "poisoned", { t: poison, mag: 2, stack: "max" });
  }
  if (el === "shock" && vs !== "resist") {
    // Lightning jumps to the nearest other monster within 3 tiles that you can see.
    const other = game.zone.creatures
      .filter((o) => o !== m && touchable(game, o) && elementVs(o, "shock") !== "resist" && Math.hypot(o.x - m.x, o.y - m.y) < 3 &&
        lineOfSight(game.zone, m.x, m.y, m.z + 0.5, o.x, o.y, o.z + 0.5))
      .sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
    if (other) {
      const arc = soak(other, Math.max(1, Math.ceil(dmg / 2)));
      hurtMonster(game, other, arc, `${arc}`, ELEMENTS.shock.color);
      game.log(`Lightning arcs to the ${other.name} (${arc}).`, ELEMENTS.shock.color);
      if (other.hp <= 0) killMonster(game, other, `The ${other.name} is struck down.`);
    }
  }
}

// One creature's blow on another (ai.js): no XP, no loot from you. The victim bears a grudge against
// whoever hit it (factions.js attitude), and remembers who it was (ai.js pickTarget prefers them).
export function creatureHits(game, m, target, dmg) {
  if (!touchable(game, target, m)) return 0;
  dmg = soak(target, dmg);
  const state = target.state, lost = target.lost;
  hurtMonster(game, target, dmg, `${dmg}`, [255, 150, 150]);
  target.state = state === "idle" ? "wander" : state; target.lost = lost;   // (hurtMonster would set it hunting you)
  const brain = (target.brain ||= {});
  brain.hurtBy = m.id;
  (brain.grudges ||= {})[m.id] = 1;
  if (target.hp <= 0) killMonster(game, target, `The ${m.name} kills the ${target.name}.`, true, false);
  return dmg;
}

// Damage from something other than your weapon (a thrown knife). Kills give XP as usual.
// Returns the damage actually done (after an armoured elite's soak).
export function damageMonster(game, m, dmg, color, deathText) {
  if (!touchable(game, m)) return 0;
  if (CREATURE_TYPES[m.type].guardian === "colossus" && !colossusCore(game, m)) dmg = Math.min(dmg, 2);
  dmg = soak(m, dmg);
  hurtMonster(game, m, dmg, `${dmg}`, color);
  if (m.hp <= 0) killMonster(game, m, deathText || `You slay the ${m.name}.`);
  return dmg;
}

function hurtMonster(game, m, dmg, label, color) {
  sfx("hit", { at: m, crit: label.endsWith("!") });
  m.hp -= dmg;
  m.hurt = 0.2;
  m.cd = Math.max(m.cd, 0.4);
  m.state = "chase";
  m.lost = 0;
  game.effects.push({ kind: "damage", x: m.x, y: m.y, z: m.z + m.h + 0.15, text: label, color, time: game.time });
}
