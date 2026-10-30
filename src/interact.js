// E: use whatever the crosshair points at — levers, doors, gates, braziers, and whatever else registers a use.
//
//   registerUse(blockOrKind, fn, { label }?)   (TECH_DESIGN §1.4; P0 API → WS10) what using a block does:
//       blockOrKind  a block id (B.X: that block only) or the name of a BLOCKS flag ("lever", "door", "gate",
//                    "brazier": every block with it); a block's own id wins over its flags, flags go in the order
//                    registered; a key registered twice throws
//       fn(game, x, y, z) → seconds | 0      0 (or false): nothing happened, no time, no refresh; else the zone
//                    refreshes, the bus says useBlock { x, y, z, block }, and on the map the use takes that many
//                    seconds (true: the usual half second, as the four legacy uses return)
//       label        the crosshair's line in 3D, (game, target) → string or a string (default "use it")
//   useIds() → [keys]                        what is registered, in order (read-only; check-content)
//   usableAt(game, x, y, { legacy = true }) → z | -1   the height in column (x, y) a use would take (as useColumn);
//                                            legacy false: only uses registered beyond the four legacy ones (the map
//                                            walks into those as it always did, by the tile's kind)
//   lookTarget(game), interact(game)         3D: what E would use or talk to, and doing it
//   useColumn(game, x, y) → seconds | false  the map: walking into a usable block
// The legacy uses (lever, door, gate, brazier) are registered here, in that order, and act as they always did.
import { castRay, hit } from "./raycast.js";
import { BLOCKS, B, FLOOR_Z } from "./world.js";
import { EYE } from "./player.js";
import { spawnCreature, addCreature, pickCreatureType, talkersIn, ghostHidden, canTalk } from "./creatures.js";
import { lineOfSight } from "./raycast.js";
import { emit, on } from "./events.js";
import { raiseMaxHp, maxHp } from "./stats.js";
import { TICK } from "./traps.js";
import { hourOf } from "./clock.js";

const REACH = 2.0;   // the rune-lever puzzle relies on this: you must step onto the trap floor to reach

const USES = new Map();   // block id or flag name → { fn, label }
export function registerUse(blockOrKind, fn, { label = null } = {}) {
  if (USES.has(blockOrKind)) throw new Error(`registerUse: ${blockOrKind} is already registered`);
  if (typeof fn !== "function") throw new Error(`registerUse: ${blockOrKind} needs a function`);
  USES.set(blockOrKind, { fn, label });
}
export const useIds = () => [...USES.keys()];
function useOf(block) {
  const own = USES.get(block);
  if (own) return own;
  const info = BLOCKS[block];
  if (!info) return null;
  for (const [key, use] of USES) if (typeof key === "string" && info[key]) return use;
  return null;
}

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
  const use = useOf(hit.block);
  if (use) return { ...target, label: (typeof use.label === "function" ? use.label(game, target) : use.label) || "use it" };
  return null;
}

// Someone in front of you, close enough to talk to? A flat being shows only as its shadow on
// the floor, and a ghost only with your torch out.
function lookPerson(game) {
  const p = game.player;
  const fx = Math.cos(p.yaw), fy = Math.sin(p.yaw);
  let best = null, bestD = 2.6;
  for (const n of talkersIn(game.zone)) {
    if (ghostHidden(game, n)) continue;
    const flat = n.vis.flat;
    const dx = n.x - p.x, dy = n.y - p.y, d = Math.hypot(dx, dy);
    if (d > bestD || d < 0.05 || (dx * fx + dy * fy) / d < (flat ? 0.7 : 0.82)) continue;
    if (flat && p.pitch > -0.25) continue;   // you have to be looking down at a shadow
    if (!lineOfSight(game.zone, p.x, p.y, p.z + EYE, n.x, n.y, n.z + (flat ? 0.05 : 1.2))) continue;
    best = n; bestD = d;
  }
  if (!best) return null;
  return { npc: best, label: best.vis.flat ? "a shadow with nobody casting it" : best.type === "shrine" ? "kneel at the shrine" : `talk to ${best.name}` };
}

// 3D: use what the crosshair points at (or talk to who it points at).
export function interact(game) {
  const t = lookTarget(game);
  if (!t) return;
  if (t.npc) {
    if (t.npc.vis.flat) game.log("It's a shadow with nobody casting it, and it moves on its own. Something flat? You'd have to look from above (Tab).", [190, 170, 255]);
    else game.onTalk(t.npc);
  } else useBlock(game, t.x, t.y, t.z);
}

// Map: walking into a door, lever, gate, brazier or a block with a registered use uses it. Returns what the use
// gave (seconds, or true for the usual time) if that took a turn, else false.
const LEGACY_USES = ["lever", "door", "gate", "brazier"];
export function usableAt(game, x, y, { legacy = true } = {}) {
  for (const z of [FLOOR_Z + 1, FLOOR_Z, FLOOR_Z + 2]) {
    const block = game.zone.get(x, y, z), use = useOf(block);
    if (use && (legacy || !LEGACY_USES.some((k) => USES.get(k) === use))) return z;
  }
  return -1;
}
export function useColumn(game, x, y) {
  const z = usableAt(game, x, y);
  return z >= 0 ? useBlock(game, x, y, z) : false;
}

// Use one block: its registered use. Returns what it gave (truthy) if something actually happened, else false.
function useBlock(game, x, y, z) {
  const block = game.zone.get(x, y, z), use = useOf(block);
  const done = use ? use.fn(game, x, y, z) : 0;
  if (!done) return false;
  game.zone.refresh();
  emit(game, "useBlock", { x, y, z, block });
  return done;
}

// The legacy uses. Each returns true when something happened (the map's usual use time), false when not.
registerUse("lever", (game, x, y, z) => {
  const { zone } = game, info = BLOCKS[zone.get(x, y, z)];
  if (info.on) { game.log("The lever won't move back.", [170, 170, 170]); return false; }
  // A press-wheel (the Square's cells, B2): it takes your weight, in 3D; from above it is only a spoked circle.
  if (zone.links.get(zone.index(x, y, z))?.action === "unpress" && game.view === "map") {
    game.log("A press-wheel, drawn as a spoked circle on the wall. It would take your weight to turn it: in 3D.", [170, 170, 190]);
    return false;
  }
  zone.set(x, y, z, B.LEVER_ON);
  game.log("You pull the lever. *clunk*", [220, 220, 220]);
  const link = zone.links.get(zone.index(x, y, z));
  if (link) runLink(game, link);
  return true;
});
registerUse("door", (game, x, y, z) => {
  const { zone, player } = game, info = BLOCKS[zone.get(x, y, z)];
  if (zone.runeDoors?.includes(x + y * zone.w) && player.torch) {   // a rune door (the Unlit Choir: dungeon.js runeDoors, B2)
    game.log("A rune is cut over this door, and it won't open to a lit torch. Put your torch out (F).", [175, 165, 230]);
    return false;
  }
  if (zone.offBeatDoors?.includes(x + y * zone.w) && !offBeat(game, zone)) {   // the Metronome's (dungeon.js offBeatDoors, B2)
    game.log("The door is held shut on the beat. It gives on the off-beat: wait for it.", [200, 190, 150]);
    return false;
  }
  if (info.locked) {
    if (player.keys <= 0) { game.log("It's locked. You need a key.", [240, 200, 80]); return false; }
    player.keys--;
    game.log("You unlock the door.", [240, 200, 80]);
  } else game.log("The door creaks open.", [200, 150, 100]);
  for (let k = 0; k < zone.h; k++) if (BLOCKS[zone.get(x, y, k)].door) zone.set(x, y, k, B.AIR);
  return true;
});
registerUse("gate", (game, x, y, z) => {
  if (game.zone.needleDoor?.cells.some(([cx, cy]) => cx === x && cy === y)) return needleDoor(game);
  game.log("The iron gate won't budge. There must be a mechanism somewhere.", [170, 170, 190]);
  return false;
});

// The Gnomon's door (bible §5 N; B2, C1b #26, #10): a truesteel gate over the stair into the Dial-works, open from 11:00 to
// 13:00 (clock.js's noon window: it opens and shuts by the hour, NEEDLE_DOOR.hours). Outside them it opens, for good, to
// the Plumb Key (a quest item, id plumbKey), to Hierarch Strade as your ally (game.state.stradeAlly: the integrator's
// beat 10), or to the Cube turned on its threshold, which takes a little of your shadow: NEEDLE_DOOR.cubeCost max HP, for
// good (use the gate again within NEEDLE_DOOR.askFor seconds of being asked). zone.needleDoor = { cells: [[x, y]], open, forGood, how }.
export const NEEDLE_DOOR = { hours: [11, 13], cubeCost: 10, plumbKey: "plumbKey", askFor: 10 };
export function setNeedleDoor(zone, open) {
  const d = zone?.needleDoor;
  if (!d || d.open === open) return;
  d.open = open;
  for (const [x, y] of d.cells) for (const z of [FLOOR_Z, FLOOR_Z + 1]) zone.set(x, y, z, open ? B.AIR : B.GATE);
  zone.refresh();
}
const needleOpenNow = (game) => { const h = hourOf(game); return h >= NEEDLE_DOOR.hours[0] && h < NEEDLE_DOOR.hours[1]; };
const followClock = (game, zone) => { if (zone?.needleDoor && !zone.needleDoor.forGood) setNeedleDoor(zone, needleOpenNow(game)); };
on("zone:prepare", (game, { zone }) => followClock(game, zone));
on("clock:hour", (game) => followClock(game, game.zone));

function needleDoor(game) {
  const { zone, player: p } = game, d = zone.needleDoor;
  const forGood = (how, line) => { d.forGood = true; d.how = how; setNeedleDoor(zone, true); game.log(line, [255, 230, 140]); return true; };
  if (p.inv?.some((it) => it.kind === "quest" && it.id === NEEDLE_DOOR.plumbKey))
    return forGood("plumbKey", "The Plumb Key goes into the square hole as if it had always been there. The door opens, and stays open.");
  if (game.state?.stradeAlly) return forGood("strade", "Hierarch Strade lays her palm on the truesteel. The door knows her, and opens.");
  if (game.story?.cube) {
    if (!(game.time - (d.cubeAsked ?? -Infinity) <= NEEDLE_DOOR.askFor)) {   // (asked, and used again within askFor seconds: done)
      d.cubeAsked = game.time;
      game.log(`The door is shut until 11:00. You could turn the Cube on its threshold: it would take a little of your shadow, ${NEEDLE_DOOR.cubeCost} max HP, for good. (Use the door again to do it.)`, [255, 200, 140]);
      return false;
    }
    raiseMaxHp(p, -NEEDLE_DOOR.cubeCost);
    if (p.hp > maxHp(p)) p.hp = maxHp(p);
    return forGood("cube", "You turn the Cube on the threshold. Something of your shadow goes into it, and the door swings open.");
  }
  game.log("The door is shut. It opens from 11:00 to 13:00.", [200, 190, 160]);
  return false;
}
registerUse("brazier", (game, x, y, z) => {
  const { zone, player } = game, info = BLOCKS[zone.get(x, y, z)];
  if (info.on) { game.log("The brazier is already burning.", [170, 170, 170]); return false; }
  if (!player.torch) { game.log("You need a flame to light it. Your torch is out.", [255, 200, 120]); return false; }
  zone.set(x, y, z, B.BRAZIER_LIT);
  game.log("You light the brazier. Flames leap up.", [255, 190, 100]);
  brazierLit(game, x, y);
  return true;
});

// The off half of a level's one beat (zone.beat { period, phase }: traps.js's ticks): an off-beat door opens then.
export function offBeat(game, zone) {
  const b = zone.beat;
  if (!b) return true;
  const k = (((Math.floor((game.time || 0) / TICK) - b.phase) % b.period) + b.period) % b.period;
  return k >= b.period / 2;
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
    const lio = talkersIn(zone).find((n) => n.type === "lio");
    if (lio) lio.talk.state.free = true;
    game.log("Somewhere on this floor, bars grind down into the stone. A distant voice: \"Yes! YES!\"", [160, 220, 255]);
  } else if (link.action === "unpress") {   // a press-wheel (the Square's cells: gen/dungeon.js placeLandmarkParts, B2)
    const q = zone.prisoners?.[link.prisoner];
    if (q) q.freed = true;
    game.log("The wheel turns with a long groan. On the floor of the cell, something drawn takes a breath and starts to stand up.", [160, 220, 255]);
    emit(game, "prisoner:freed", { zone, prisoner: q, k: link.prisoner });
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
    const spots = link.cells.filter(([x, y]) => zone.stand[x + y * zone.w] >= 0 && !zone.creatures.some((m) => !canTalk(m) && m.tx === x && m.ty === y));
    for (let k = 0; k < 3 && spots.length; k++) {
      const [x, y] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      addCreature(zone, spawnCreature(pickCreatureType(Math.random, game.zone.level), x, y, zone.stand[x + y * zone.w], { rng: Math.random, state: "chase", level: game.zone.level }));
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
    addCreature(zone, spawnCreature(pickCreatureType(Math.random, game.zone.level), sx, sy, zone.stand[sx + sy * zone.w], { rng: Math.random, state: "chase", level: game.zone.level }));
  }
}
