// Creatures (creatures.js, ids.js): TECH_DESIGN §2.3 and §7.4, bible §15.7, the 0C gate's creature half.
//
//   checkCreatures({ game, startRun, srcFiles }) → { name, ok, problems, stats }
//
//   1. One list: no `.monsters` or `.npcs` left in src/ (the gate's grep), and no module still names the
//      parent's MONSTER_TYPES, NPC_TYPES, spawnMonster, spawnNpc, monsterAt or npcAt.
//   2. Glyphs (bible §15.7, binding): no creature uses a glyph reserved for terrain, items and features,
//      except the people the registry keeps one for (`@` for people, `Ω` the Speaking Door, `†` a shrine);
//      every monster's letter is one of the families' (or a free one); every (glyph, colour) pair is unique.
//   3. spawnCreature: anything that isn't a talker needs opts.rng, and draws its looks from it in the
//      parent's order (shot, anim, think, pause: four draws); a talker draws nothing. Level scaling: +6%
//      health per level, +1 damage per 4 levels, XP +10% per level. Ids come from one counter for
//      monsters and people alike.
//   4. Who is who: talkers can't be touched, aren't hostile and stand in the AI's occupancy grid with
//      their own id (a monster never steps onto them); creatureAt prefers the talker on a tile.
//   5. The flat and ghost talk rules, in both views, on a test zone: a ghost hidden by your torch can't be
//      seen (no sprite) or talked to in 3D, and with the torch out it can; on the map an unmet ghost is
//      a cold spot, a met one talks. A flat person is a shadow in 3D (looking down finds it, but it
//      doesn't talk), and talks when you walk into it on the map.
//
// game/startRun: the real game (game.js). srcFiles: [{ file, text }] of every src/ module.
import { Zone, B, FLOOR_Z } from "../../src/world.js";
import { enterZone } from "../../src/zones.js";
import { mapStep } from "../../src/turns.js";
import { interact } from "../../src/interact.js";
import { updateMonsters } from "../../src/monsters.js";
import { CREATURE_TYPES, spawnCreature, addCreature, creatureAt, creatureSprite, touchable, hostilesTo, talkersIn,
         canTalk } from "../../src/creatures.js";
import { entityCounter } from "../../src/ids.js";

// Bible §15.7: reserved for terrain, items and features; and the creature families' letters.
export const RESERVED_GLYPHS = ["@", "#", ".", ":", "~", "=", "+", "|", "&", ">", "<", "!", "?", "/", "0", "%", ")", "[", "\"",
  "k", "h", "S", "$", "*", "†", "█", "▲", "^", ",", "■", "Ω", ";", "-", "°"];
export const FAMILY_GLYPHS = ["r", "w", "i", "c", "f", "m", "p", "U", "g", "q", "v", "x", "Y", "I", "u", "d", "s", "K", "b", "T",
  "B", "n", "j", "y", "P", "F", "t", "G", "z", "W", "N", "e", "Z", "H", "J", "R", "C", "l", "E", "A", "Q", "V", "o", "L", "♣"];
export const FREE_GLYPHS = ["a", "D", "M", "O", "X"];
// The reserved glyphs the registry gives to talkers: people, the Speaking Door, shrines.
const TALKER_GLYPHS = { "@": null, "Ω": ["door"], "†": ["shrine"] };

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

function testZone() {
  const z = new Zone({ key: "creature-test", wx: 98, wy: 98, z: 0, type: "surface", level: 1, seed: 9, w: 24, d: 24, h: 16, name: "Creature Test" });
  for (let y = 0; y < z.d; y++)
    for (let x = 0; x < z.w; x++) for (let k = 0; k < FLOOR_Z; k++) z.set(x, y, k, k === FLOOR_Z - 1 ? B.GRASS : B.ROCK);
  z.edges = { n: null, s: null, e: null, w: null };
  z.refresh();
  z.spawn = { x: 10.5, y: 10.5, z: FLOOR_Z, yaw: 0 };
  return z.seal();
}

export function checkCreatures({ game, startRun, srcFiles }) {
  const problems = [], stats = {};
  const fail = (m) => problems.push(m);
  const expect = (ok, m) => { if (!ok) fail(m); return ok; };

  // --- 1. One list --------------------------------------------------------------------------------------
  const sites = [], oldNames = [];
  for (const { file, text } of srcFiles)
    stripComments(text).split("\n").forEach((line, k) => {
      if (/\.monsters\b|\.npcs\b/.test(line)) sites.push(`${file}:${k + 1}`);
      if (/\b(MONSTER_TYPES|NPC_TYPES|spawnMonster|spawnNpc|monsterAt|npcAt)\b/.test(line)) oldNames.push(`${file}:${k + 1}`);
    });
  // (The gate's grep reads comments too.)
  for (const { file, text } of srcFiles) text.split("\n").forEach((line, k) => { if (/\.monsters\b|\.npcs\b/.test(line) && !sites.includes(`${file}:${k + 1}`)) sites.push(`${file}:${k + 1}`); });
  expect(!sites.length, `.monsters / .npcs left in src: ${sites.join(", ")}`);
  expect(!oldNames.length, `the parent's creature API is still named in src: ${oldNames.join(", ")}`);
  stats.oneList = { sites: sites.length, oldNames: oldNames.length };

  // --- 2. Glyphs ----------------------------------------------------------------------------------------
  const pairs = new Map();
  let monsters = 0, people = 0;
  for (const [id, t] of Object.entries(CREATURE_TYPES)) {
    if (t.talks) people++; else monsters++;
    if (RESERVED_GLYPHS.includes(t.glyph)) {
      const ok = t.talks && t.glyph in TALKER_GLYPHS && (!TALKER_GLYPHS[t.glyph] || TALKER_GLYPHS[t.glyph].includes(id));
      expect(ok, `${id} uses the reserved glyph ${t.glyph}`);
    } else expect(!t.talks || t.glyph === "@", `${id} talks but isn't @ (people are @ in their colour)`);
    if (!t.talks) expect(FAMILY_GLYPHS.includes(t.glyph) || FREE_GLYPHS.includes(t.glyph), `${id}'s glyph ${t.glyph} is no family's letter`);
    const key = `${t.glyph} ${t.color.join(",")}`;
    expect(!pairs.has(key), `${id} and ${pairs.get(key)} share the glyph and colour ${key}`);
    pairs.set(key, id);
  }
  expect(CREATURE_TYPES.archer.glyph === "g" && CREATURE_TYPES.orc.glyph === "g" && CREATURE_TYPES.flatling.glyph === "f",
         "goblin archers and orcs are Rustbacks (g), and the flatling keeps f");
  stats.glyphs = { monsters, people, pairs: pairs.size };

  // --- 3. spawnCreature ---------------------------------------------------------------------------------
  let threw = false;
  try { spawnCreature("rat", 1, 1, FLOOR_Z, {}); } catch { threw = true; }
  expect(threw, "spawnCreature without opts.rng doesn't throw for a monster");
  const draws = (type, opts) => { let n = 0; const rng = () => { n++; return 0.5; }; const c = spawnCreature(type, 3, 4, FLOOR_Z, { ...opts, rng }); return [c, n]; };
  const [rat, ratDraws] = draws("rat", { level: 9, state: "wander" });
  const [pell, pellDraws] = draws("pell", { level: 9 });
  expect(ratDraws === 4 && rat.shot === 1.5 && rat.anim === 5 && rat.think === 0.125 && rat.pause === 1, `a monster's looks: ${ratDraws} draws, shot ${rat.shot} anim ${rat.anim} think ${rat.think} pause ${rat.pause}`);
  expect(pellDraws === 0 && pell.talk?.dialogue === "pell" && pell.talk.met === false && pell.level === 9 && pell.hp === undefined,
         "a talker draws nothing, talks, has a level and no health");
  const t = CREATURE_TYPES.rat;
  expect(rat.maxHp === Math.round(t.hp * (1 + 0.06 * 8)) && rat.bonus === 2 && rat.xp === Math.round(t.xp * 1.8) && rat.state === "wander",
         `level 9 rat: hp ${rat.maxHp}, damage +${rat.bonus}, xp ${rat.xp}`);
  expect(pell.id === rat.id + 1 && entityCounter() === pell.id + 1, "monsters and people draw their ids from one counter");
  const elite = spawnCreature("rat", 1, 1, FLOOR_Z, { rng: () => 0.5, level: 5, elite: "hulking" });
  expect(elite.name === "hulking rat" && elite.maxHp === Math.round(t.hp * 1.24 * 2), `a hulking rat: ${elite.name}, ${elite.maxHp} HP`);
  stats.spawn = { monsterDraws: ratDraws, talkerDraws: pellDraws };

  // --- 4 and 5: on a test zone ---------------------------------------------------------------------------
  startRun(77);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  const zone = testZone();
  enterZone(game, zone, { how: "start" });
  const p = game.player;
  Object.assign(p, { x: 10.5, y: 10.5, z: FLOOR_Z, vz: 0, yaw: 0, pitch: 0, torch: true });
  game.view = "3d"; game.mode = "explore";
  const talked = [], logged = [];
  const onTalk = game.onTalk, log = game.log;
  game.onTalk = (n) => talked.push(n);
  game.log = (text) => logged.push(text);
  try {
    // 4. Who is who.
    const shrine = addCreature(zone, spawnCreature("shrine", 12, 10, FLOOR_Z, { level: 1, talk: { state: { cost: 10 } } }));
    const goblin = addCreature(zone, spawnCreature("goblin", 14, 10, FLOOR_Z, { rng: () => 0.5, state: "chase" }));
    expect(!touchable(game, shrine) && touchable(game, goblin), "people can't be touched; monsters can");
    expect(hostilesTo(game, p).length === 1 && hostilesTo(game, p)[0] === goblin && talkersIn(zone)[0] === shrine, "hostilesTo / talkersIn split the list");
    expect(creatureAt(zone, 12, 10) === shrine && creatureAt(zone, 14, 10) === goblin && !creatureAt(zone, 13, 12), "creatureAt");
    // The goblin chases you from the east, with the shrine in the way: it never steps onto the shrine.
    Object.assign(p, { x: 10.5, y: 10.5 });
    let onShrine = false;
    for (let k = 0; k < 120; k++) { updateMonsters(game, 1 / 30); if (goblin.nx === 12 && goblin.ny === 10) onShrine = true; }
    expect(!onShrine && shrine.tx === 12 && shrine.ty === 10 && shrine.x === 12.5, "a monster steps onto a person's tile, or the person moved");
    zone.creatures.length = 0;

    // 5. The ghost (Brann) two tiles east of you.
    const ghost = addCreature(zone, spawnCreature("brann", 12, 10, FLOOR_Z, { level: 4 }));
    Object.assign(p, { x: 10.5, y: 10.5, yaw: 0, pitch: 0 });
    p.torch = true;
    const sprLit = creatureSprite(game, ghost);
    interact(game);
    const litTalk = talked.length;
    p.torch = false;
    const sprDark = creatureSprite(game, ghost);
    interact(game);
    const darkTalk = talked.length - litTalk;
    expect(!sprLit && litTalk === 0, "a ghost is seen or talked to with your torch lit");
    expect(!!sprDark && darkTalk === 1 && talked.at(-1) === ghost, "a ghost can't be seen or talked to with your torch out");
    // On the map: unmet, a cold spot; met, it talks.
    game.view = "map"; game.mode = "map";
    Object.assign(p, { x: 11.5, y: 10.5 });
    ghost.talk.met = false;
    const before = talked.length;
    mapStep(game, 1, 0);
    const cold = talked.length === before && logged.some((l) => /icy/.test(l));
    ghost.talk.met = true;
    Object.assign(p, { x: 11.5, y: 10.5 });
    mapStep(game, 1, 0);
    expect(cold && talked.length === before + 1, "on the map an unmet ghost is a cold spot, a met one talks");
    zone.creatures.length = 0;

    // The flat person (Ess) two tiles east: a shadow in 3D, a person on the map.
    const flat = addCreature(zone, spawnCreature("ess", 12, 10, FLOOR_Z, { level: 4 }));
    game.view = "3d"; game.mode = "explore";
    Object.assign(p, { x: 10.5, y: 10.5, yaw: 0, pitch: -0.6 });
    const n0 = talked.length, l0 = logged.length;
    interact(game);
    expect(!creatureSprite(game, flat) && talked.length === n0 && logged.slice(l0).some((l) => /shadow/.test(l)),
           "a flat person in 3D: no sprite, and looking down finds a shadow that doesn't talk");
    Object.assign(p, { pitch: 0 });
    const l1 = logged.length;
    interact(game);
    expect(logged.length === l1 && talked.length === n0, "a flat person's shadow is found without looking down");
    game.view = "map"; game.mode = "map";
    Object.assign(p, { x: 11.5, y: 10.5, pitch: 0 });
    mapStep(game, 1, 0);
    expect(talked.length === n0 + 1 && talked.at(-1) === flat, "walking into a flat person on the map doesn't talk");
    stats.talkRules = { ghostLit: litTalk, ghostDark: darkTalk, ghostColdSpot: cold, flat3d: talked.length - n0 - 1, flatMap: 1 };
  } finally {
    game.onTalk = onTalk; game.log = log;
    zone.creatures.length = 0;
  }
  return { name: "creatures", ok: problems.length === 0, problems, stats };
}
