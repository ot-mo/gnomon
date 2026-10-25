// E: use whatever the crosshair points at — levers, doors, gates, braziers.
import { castRay, hit } from "./raycast.js";
import { BLOCKS, B, FLOOR_Z } from "./world.js";
import { EYE } from "./player.js";
import { spawnMonster, pickMonsterType } from "./monsters.js";
import { NPC_TYPES } from "./npcs.js";
import { lineOfSight } from "./raycast.js";

const REACH = 2.0;   // the rune-lever puzzle relies on this: you must step onto the trap floor to reach

export function lookTarget(game) {
  const p = game.player;
  const person = lookPerson(game);
  if (person) return person;
  const cp = Math.cos(p.pitch);
  if (!castRay(game.zone, p.x, p.y, p.z + EYE, cp * Math.cos(p.yaw), cp * Math.sin(p.yaw), Math.sin(p.pitch), REACH)) return null;
  const info = BLOCKS[hit.block];
  const target = { x: hit.x, y: hit.y, z: hit.z, block: hit.block };
  if (info.lever) return { ...target, label: info.on ? "lever (already pulled)" : "pull the lever" };
  if (info.door) return { ...target, label: info.locked ? "unlock the door" : "open the door" };
  if (info.gate) return { ...target, label: "examine the gate" };
  if (info.brazier) return { ...target, label: info.on ? "the brazier burns" : p.torch ? "light the brazier" : "a cold brazier (light your torch)" };
  return null;
}

// Someone in front of you, close enough to talk to? A flat being shows only as its shadow on
// the floor, and a ghost only with your torch out.
function lookPerson(game) {
  const p = game.player;
  const fx = Math.cos(p.yaw), fy = Math.sin(p.yaw);
  let best = null, bestD = 2.6;
  for (const n of game.zone.npcs) {
    const t = NPC_TYPES[n.type];
    if (t.ghost && p.torch) continue;
    const dx = n.x - p.x, dy = n.y - p.y, d = Math.hypot(dx, dy);
    if (d > bestD || d < 0.05 || (dx * fx + dy * fy) / d < (t.flat ? 0.7 : 0.82)) continue;
    if (t.flat && p.pitch > -0.25) continue;   // you have to be looking down at a shadow
    if (!lineOfSight(game.zone, p.x, p.y, p.z + EYE, n.x, n.y, n.z + (t.flat ? 0.05 : 1.2))) continue;
    best = n; bestD = d;
  }
  if (!best) return null;
  const t = NPC_TYPES[best.type];
  return { npc: best, label: t.flat ? "a shadow with nobody casting it" : best.type === "shrine" ? "kneel at the shrine" : `talk to ${t.name}` };
}

// 3D: use what the crosshair points at (or talk to who it points at).
export function interact(game) {
  const t = lookTarget(game);
  if (!t) return;
  if (t.npc) {
    if (NPC_TYPES[t.npc.type].flat) game.log("It's a shadow with nobody casting it, and it moves on its own. Something flat? You'd have to look from above (Tab).", [190, 170, 255]);
    else game.onTalk(t.npc);
  } else useBlock(game, t.x, t.y, t.z);
}

// Map: walking into a door, lever, gate or brazier uses it. Returns true if that took a turn.
export function useColumn(game, x, y) {
  for (const z of [FLOOR_Z + 1, FLOOR_Z, FLOOR_Z + 2]) {
    const info = BLOCKS[game.zone.get(x, y, z)];
    if (info.lever || info.door || info.gate || info.brazier) return useBlock(game, x, y, z);
  }
  return false;
}

// Use one block. Returns true if something actually happened.
function useBlock(game, x, y, z) {
  const { zone, player } = game;
  const info = BLOCKS[zone.get(x, y, z)];

  if (info.lever) {
    if (info.on) { game.log("The lever won't move back.", [170, 170, 170]); return false; }
    zone.set(x, y, z, B.LEVER_ON);
    game.log("You pull the lever. *clunk*", [220, 220, 220]);
    const link = zone.links.get(zone.index(x, y, z));
    if (link) runLink(game, link);
  } else if (info.door) {
    if (info.locked) {
      if (player.keys <= 0) { game.log("It's locked. You need a key.", [240, 200, 80]); return false; }
      player.keys--;
      game.log("You unlock the door.", [240, 200, 80]);
    } else game.log("The door creaks open.", [200, 150, 100]);
    for (let k = 0; k < zone.h; k++) if (BLOCKS[zone.get(x, y, k)].door) zone.set(x, y, k, B.AIR);
  } else if (info.gate) {
    game.log("The iron gate won't budge. There must be a mechanism somewhere.", [170, 170, 190]);
    return false;
  } else if (info.brazier) {
    if (info.on) { game.log("The brazier is already burning.", [170, 170, 170]); return false; }
    if (!player.torch) { game.log("You need a flame to light it. Your torch is out.", [255, 200, 120]); return false; }
    zone.set(x, y, z, B.BRAZIER_LIT);
    game.log("You light the brazier. Flames leap up.", [255, 190, 100]);
    brazierLit(game, x, y);
  } else return false;
  zone.refresh();
  return true;
}

// What a lever does:
//   open   – removes the gate (or whatever) at `cells`
//   part   – one of several levers in a group; the group's gate opens once all are pulled
//   pit    – the floor at `cells` drops away
//   summon – monsters appear on `cells`
//   gas    – poison gas fills the room around `cells`
function runLink(game, link) {
  const { zone } = game;
  if (link.action === "open") {
    for (const [x, y, z] of link.cells) zone.set(x, y, z, B.AIR);
    game.log("Somewhere close, iron grinds against stone.", [160, 220, 255]);
  } else if (link.action === "free") {   // Lio's cell
    for (const [x, y, z] of link.cells) zone.set(x, y, z, B.AIR);
    const lio = zone.npcs.find((n) => n.type === "lio");
    if (lio) lio.state.free = true;
    game.log("Somewhere on this floor, bars grind down into the stone. A distant voice: \"Yes! YES!\"", [160, 220, 255]);
  } else if (link.action === "dud") {
    game.log(link.msg || "The lever clanks. Nothing happens.", [170, 170, 170]);
  } else if (link.action === "part") {
    const g = zone.groups.get(link.group);
    g.pulled++;
    if (g.pulled >= g.need) {
      for (const [x, y, z] of g.cells) zone.set(x, y, z, B.AIR);
      game.log("The last mechanism engages. Iron grinds against stone!", [160, 220, 255]);
    } else game.log("Something clicks inside the wall... but nothing else happens. Yet.", [160, 200, 230]);
  } else if (link.action === "pit") {
    for (const [x, y] of link.cells) for (let z = 0; z < FLOOR_Z; z++) zone.set(x, y, z, B.AIR);
    game.log("The floor gives way beneath you!", [255, 120, 100]);
  } else if (link.action === "summon") {
    const spots = link.cells.filter(([x, y]) => zone.stand[x + y * zone.w] >= 0 && !zone.monsters.some((m) => m.tx === x && m.ty === y));
    for (let k = 0; k < 3 && spots.length; k++) {
      const [x, y] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      zone.monsters.push(spawnMonster(pickMonsterType(Math.random, game.zone.level), x, y, zone.stand[x + y * zone.w], "chase", game.zone.level));
    }
    game.log("Hidden doors slam open in the walls. Monsters pour out!", [255, 120, 100]);
  } else if (link.action === "gas") {
    const [cx, cy] = link.cells.reduce(([ax, ay], [x, y]) => [ax + x / link.cells.length, ay + y / link.cells.length], [0, 0]);
    zone.clouds.push({ x: cx + 0.5, y: cy + 0.5, z: FLOOR_Z + 1, r: 3, time: 8, kind: "poison" });
    game.log("Green gas hisses out of the walls!", [150, 210, 80]);
  }
}

// The brazier puzzle: light them in the order of the numerals carved behind them.
// The wrong one snuffs them all out — and wakes something.
function brazierLit(game, x, y) {
  const { zone } = game, puzzle = zone.braziers;
  if (!puzzle || puzzle.solved) return;
  const b = puzzle.list.find((o) => o.x === x && o.y === y);
  if (!b) return;
  if (b.n === puzzle.next) {
    puzzle.next++;
    if (puzzle.next > puzzle.list.length) {
      puzzle.solved = true;
      for (const [gx, gy, gz] of puzzle.gate) zone.set(gx, gy, gz, B.AIR);
      game.log("All the flames roar up together. Somewhere, iron grinds against stone!", [255, 220, 120]);
    }
    return;
  }
  for (const o of puzzle.list) zone.set(o.x, o.y, o.z, B.BRAZIER);
  puzzle.next = 1;
  game.log("The flames gutter and die. A cold wind howls through the room...", [170, 190, 255]);
  const spots = puzzle.list.map((o) => [o.x, o.y + 2]).filter(([sx, sy]) => zone.stand[sx + sy * zone.w] >= 0);
  if (spots.length) {
    const [sx, sy] = spots[Math.floor(Math.random() * spots.length)];
    zone.monsters.push(spawnMonster(pickMonsterType(Math.random, game.zone.level), sx, sy, zone.stand[sx + sy * zone.w], "chase", game.zone.level));
  }
}
