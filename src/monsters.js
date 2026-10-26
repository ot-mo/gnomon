// Monsters: how they think and fight. What they are (the types, spawning, sprites, who can touch whom)
// is creatures.js; the parent game's types are content/creatures/legacy.js.
// They live on the tile grid: each one stands on a tile or is stepping to a neighbour.
import { lineOfSight } from "./raycast.js";
import { flowField, canWalk, DIRS8, UNREACHABLE, MONSTER_STEP_UP, MONSTER_DROP } from "./pathing.js";
import { makeItem, randomPotion, randomScroll, randomEquipment, randomJewel, awayFromWalls, strNeeded, WEAPONS, ELEMENTS } from "./items.js";
import { guardianThink, colossusCore, fearLight } from "./guardians.js";
import { B, FLOOR_Z } from "./world.js";
import { EYE, HEIGHT, RADIUS, moveAxis, attackTime, armourValue, bonus, weaponReach } from "./player.js";
import { gainXp } from "./leveling.js";
import { sfx } from "./sfx.js";
import { attr, maxHp } from "./stats.js";
import { wielded } from "./body.js";
import { addStatus, removeStatus, capStatus, hasStatus, statusFlag, tickStatuses, cooldownLeft, startCooldown, setStatusHarm, STATUS_DEFS } from "./status.js";
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

// ---------------------------------------------------------------------------
// Advance every monster by dt seconds. On the map only monsters within `radius`
// tiles (or already hunting you) act; the rest wait until you come closer.
export function updateMonsters(game, dt, radius = Infinity) {
  const { zone, player } = game;
  const { w, stand } = zone;
  const ptx = Math.floor(player.x), pty = Math.floor(player.y);

  // Re-plan routes when the player reaches a new tile we can stand on, or the level changed.
  const pTileOk = ptx >= 0 && pty >= 0 && ptx < w && pty < zone.d && stand[ptx + pty * w] >= 0;
  if (!game.flow || game.flowVersion !== zone.navVersion ||
      (pTileOk && (ptx !== game.flowX || pty !== game.flowY))) {
    game.flow = flowField(zone, ptx, pty);
    game.flowX = ptx; game.flowY = pty; game.flowVersion = zone.navVersion;
  }

  // Who holds which tile: a monster its tile and the one it steps to, a person (who stands their
  // ground) their own tile, each with its own id.
  const occ = new Int32Array(w * zone.d);
  for (const c of zone.creatures) { occ[c.tx + c.ty * w] = c.id; occ[c.nx + c.ny * w] = c.id; }

  for (const m of [...zone.creatures]) {
    if (canTalk(m)) continue;                     // people stand still (their brains come with ai.js)
    if (!zone.creatures.includes(m)) continue;   // killed earlier this update (lightning, a split…)
    const t = CREATURE_TYPES[m.type];
    if (m.state !== "chase" && Math.hypot(m.x - player.x, m.y - player.y) > radius) continue;
    const pace = (hasStatus(m, "chilled") ? 0.5 : 1) * (hasStatus(m, "hasted") ? RULES.haste : 1);
    m.anim += dt;
    m.hurt = Math.max(0, m.hurt - dt);
    m.cd = Math.max(0, m.cd - dt * pace);   // chilled: half as often; hasted: faster
    m.shot -= dt * pace;

    // The ground vanished (a trap opened): it falls to the floor below.
    if (stand[m.tx + m.ty * w] < 0) { killMonster(game, m, `The ${m.name} falls into the dark.`, false, false); continue; }

    // Its statuses: on fire or poisoned, 1 damage every half second (status.js; the kill goes through
    // the harm handler below); chill, blindness, haste and stuns run down.
    const regenOk = !statusFlag(m, "noRegen");   // trolls knit back together — unless they're burning
    tickStatuses(game, m, dt);
    if (!zone.creatures.includes(m)) continue;
    if (regenOk && t.regen && m.hp < m.maxHp) {
      m.regenAcc += t.regen * dt;
      if (m.regenAcc >= 1) { m.regenAcc -= 1; m.hp++; }
    }
    if (t.boss) { removeStatus(game, m, "blinded"); capStatus(m, "stunned", 1.5); bossPhase(game, m, occ); }   // shrugs most of it off
    if (t.guardian) { removeStatus(game, m, "blinded"); capStatus(m, "stunned", 1); if (guardianThink(game, m, dt, occ)) continue; }
    if (t.fearsLight && fearLight(game, m, dt)) continue;
    // Stunned (or paralysed): it can't do anything at all.
    if (statusFlag(m, "noAct")) continue;

    m.think -= dt;
    if (m.think <= 0) { m.think = 0.25; perceive(game, m, t); }

    const moving = m.nx !== m.tx || m.ny !== m.ty;
    const dx = player.x - m.x, dy = player.y - m.y, dz = player.z - m.z;
    const flat = Math.hypot(dx, dy);
    const inReach = flat <= t.reach + RADIUS && dz > -1.2 && dz < 1.3;
    const r = t.ranged;

    if (moving) {
      const len = m.nx !== m.tx && m.ny !== m.ty ? Math.SQRT2 : 1;
      const wet = !t.hover && (zone.get(m.tx, m.ty, FLOOR_Z - 1) === B.WATER_SHALLOW || zone.get(m.nx, m.ny, FLOOR_Z - 1) === B.WATER_SHALLOW);
      m.p += (t.speed * m.speedMul * (m.state === "chase" ? 1 : 0.45) * (wet ? 0.6 : 1) * pace * dt) / len;
      if (m.p >= 1) {
        occ[m.tx + m.ty * w] = 0;
        m.tx = m.nx; m.ty = m.ny; m.p = 0;
      }
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

// The Lich King's fight has three phases: at two thirds of its health it raises
// skeletons, at one third wraiths, and from then on it casts faster.
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

// Can it see the player? Torchlight makes you easier to spot; sprinting is loud.
function perceive(game, m, t) {
  const { zone, player } = game;
  if (hasStatus(m, "blinded")) {   // blinded (darkness or shadows splashed on it): it loses track of you
    if (m.state === "chase") m.state = "wander";
    m.sees = false;
    return;
  }
  const dist = Math.hypot(player.x - m.x, player.y - m.y);
  const hidden = statusFlag(player, "hidden");   // potion of shadows
  const range = t.sight * (player.torch || t.darkSight ? 1 : 0.55) * (hidden ? 0.35 : 1) *
    (hasStatus(player, "darkened") && !t.darkSight ? 0.7 : 1) * Math.max(0.3, 1 - bonus(player, "stealth"));
  let sees = dist < range &&
    lineOfSight(zone, m.x, m.y, m.z + m.h * 0.8, player.x, player.y, player.z + EYE);
  m.sees = sees;
  if (!sees && !hidden && player.sprinting && dist < 6) sees = true;
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
}

// Pick the next tile: downhill on the flow field when chasing, a random neighbour when
// wandering (or now and then for erratic flyers like bats).
function chooseStep(game, m, t, occ, ptx, pty) {
  const { zone, player, flow } = game;
  const { w, d, stand } = zone;
  const here = m.tx + m.ty * w;
  const chasing = m.state === "chase" && !(t.erratic && Math.random() < t.erratic);
  const hereDist = Math.hypot(m.tx + 0.5 - player.x, m.ty + 0.5 - player.y);
  let best = -1, bestScore = Infinity;
  for (const [ox, oy] of DIRS8) {
    const bx = m.tx + ox, by = m.ty + oy;
    if (bx < 0 || by < 0 || bx >= w || by >= d) continue;
    const bi = bx + by * w;
    if ((bx === ptx && by === pty) || (occ[bi] && occ[bi] !== m.id)) continue;
    if (!canWalk(stand, w, m.tx, m.ty, bx, by, MONSTER_STEP_UP, MONSTER_DROP)) continue;
    let score;
    if (!chasing) score = Math.random();
    else if (flow[here] !== UNREACHABLE) {
      if (flow[bi] >= flow[here]) continue;
      score = flow[bi] + (ox && oy ? 0.4 : 0);
    } else {
      // The player is somewhere we can't walk to (a ledge?): just get as close as possible.
      score = Math.hypot(bx + 0.5 - player.x, by + 0.5 - player.y);
      if (score >= hereDist) continue;
    }
    if (score < bestScore) { bestScore = score; best = bi; }
  }
  if (best >= 0) {
    m.nx = best % w; m.ny = (best - m.nx) / w; m.p = 0;
    occ[best] = m.id;
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

function killMonster(game, m, message, dropLoot = true, byPlayer = true) {
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
