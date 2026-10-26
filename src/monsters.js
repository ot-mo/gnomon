// Monsters: how they die (XP, loot, splitting, the "kill" event), how they stay solid, and how a status
// hurts them. What they are (the types, spawning, sprites, who can touch whom) is creatures.js, with the
// parent game's types in content/creatures/legacy.js; how they think and move is ai.js; how blows land
// (both views, the legacy and d20 sets) is combat.js.
//
//   killMonster(game, c, message, dropLoot = true, byPlayer = true, src) → emits "kill" { c, src, uid,
//       factions } (events.js) last: content/legacy/encounters.js logs Rook's quarry and story/quests.js
//       routes it to his quest, game.js opens a guardian's gate and wins the run when the boss falls. src: the killer (the player when byPlayer, else a creature or null).
import { DIRS8 } from "./pathing.js";
import { makeItem, randomPotion, randomScroll, randomEquipment, randomJewel, awayFromWalls } from "./items.js";
import { HEIGHT, RADIUS, moveAxis, bonus } from "./player.js";
import { gainXp } from "./leveling.js";
import { sfx } from "./sfx.js";
import { maxHp } from "./stats.js";
import { setStatusHarm, STATUS_DEFS } from "./status.js";
import { uidWhere, killUid } from "./zones.js";
import { emit } from "./events.js";
import { CREATURE_TYPES, spawnCreature, addCreature, removeCreature, isFlat, ghostHidden, canTalk } from "./creatures.js";
import { hasKey } from "./keyset.js";

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

export function killMonster(game, m, message, dropLoot = true, byPlayer = true, src = byPlayer ? game.player : null) {
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
  if (!t.guardian && dropLoot && ground >= 0) {   // (a guardian leaves a relic: game.js, on "kill")
    // Lucky: twice as likely to drop something.
    const luck = hasKey(p.perks, "lucky") ? 2 : 1;
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
  emit(game, "kill", { c: m, src, uid: m.uid ?? null, factions: m.factions || [] });
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
