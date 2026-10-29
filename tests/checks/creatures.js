// Creatures (creatures.js, ids.js): TECH_DESIGN §2.3 and §7.4, bible §15.7, the 0C gate's creature half.
//
//   checkCreatures({ game, startRun, srcFiles }) → { name, ok, problems, stats }
//
//   1. One list: no `.monsters` or `.npcs` left in src/ (the gate's grep), and no module still names the
//      parent's MONSTER_TYPES, NPC_TYPES, spawnMonster, spawnNpc, monsterAt or npcAt.
//   2. Glyphs (bible §15.7, binding): no creature uses a glyph reserved for terrain, items and features,
//      except the people the registry keeps one for (`@` for people, `Ω` the Speaking Door, `†` a shrine);
//      every monster's letter is one of the families' (or a free one); every (glyph, colour) pair is unique.
//      Elites included: every monster type × every elite (its colour is species and elite, half and half).
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
//   6. C3's roster (checkRoster, bible §12, §15.7-§15.9): the bestiary holds the bible's 63 creatures in its order,
//      each registered or waiting (content/creatures/waiting.js) under its bible glyph, never both; the waiting ones
//      pass the art check, the required fields and the glyph registry as the registered ones do (no reserved glyph, a
//      family's letter, every (glyph, colour) pair unique, elites included); every C3 species (wildlife, people,
//      villagers, waiting) has its six attributes and dv = its AGI modifier, levels within 1-30, its AI hook
//      registered, and `needs` with its `rule`; every one of the 63 has its three registers (the Flat line a ledger's,
//      the Dark line lower case without punctuation) within §15.9's 1,300 words, and a type's info is its Deep line;
//      the real world's level table holds three kinds or more at every level 1-30, every one from level 20 on out for a
//      stranger; who is out for a Bent stranger
//      at the start (the moths friendly while your torch burns, the longback and the chime-priest not, the outrider
//      for the Bent only); the test world's villagers as before C3 (a DV term of 0, the tinker's general stock); and its
//      teeth: ten mutants each fail it. Every wildlife and waiting entry names its factions (bible §12's column). Every wildlife species' levels hold the rows its regions give it (C1a's).
//
// game/startRun: the real game (game.js). srcFiles: [{ file, text }] of every src/ module.
import { Zone, B, FLOOR_Z } from "../../src/world.js";
import { enterZone } from "../../src/zones.js";
import { mapStep } from "../../src/turns.js";
import { interact } from "../../src/interact.js";
import { updateCreatures } from "../../src/ai.js";
import { CREATURE_TYPES, ELITES, spawnCreature, addCreature, creatureAt, creatureSprite, touchable, hostilesTo, talkersIn,
         canTalk } from "../../src/creatures.js";
import { entityCounter } from "../../src/ids.js";
import { AI_HOOKS } from "../../src/ai.js";
import { attitude } from "../../src/factions.js";
import { BESTIARY } from "../../src/content/creatures/bestiary.js";
import { WILDLIFE } from "../../src/content/creatures/wildlife.js";
import { PEOPLE } from "../../src/content/creatures/people.js";
import { VILLAGERS } from "../../src/content/creatures/villagers.js";
import { CREATURES_WAITING } from "../../src/content/creatures/waiting.js";
import { LEVEL_POOL, rowsAt } from "../../src/content/creatures/levels.js";
import { REGIONS } from "../../src/content/world/regions.js";

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
  // Elites too: every monster type × every elite is drawn as its own (glyph, colour) on the map.
  let eliteLooks = 0;
  for (const [id, t] of Object.entries(CREATURE_TYPES)) {
    if (t.talks) continue;
    for (const el of Object.keys(ELITES)) {
      const c = spawnCreature(id, 1, 1, FLOOR_Z, { rng: () => 0.5, elite: el });
      const key = `${c.glyph} ${c.color.join(",")}`;
      expect(!pairs.has(key), `${c.name} and ${pairs.get(key)} share the glyph and colour ${key}`);
      pairs.set(key, c.name);
      eliteLooks++;
    }
  }
  expect(CREATURE_TYPES.archer.glyph === "g" && CREATURE_TYPES.orc.glyph === "g" && CREATURE_TYPES.flatling.glyph === "f",
         "goblin archers and orcs are Rustbacks (g), and the flatling keeps f");
  stats.glyphs = { monsters, people, eliteLooks, pairs: pairs.size };

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
    for (let k = 0; k < 120; k++) { updateCreatures(game, 1 / 30); if (goblin.nx === 12 && goblin.ny === 10) onShrine = true; }
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
  // 6. C3's roster (below).
  const roster = checkRoster(game);
  problems.push(...roster.problems);
  stats.roster = roster.stats;
  return { name: "creatures", ok: problems.length === 0, problems, stats };
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-creatures.mjs gives.
export async function run(env) {
  await env.screen();
  const { game, startRun } = await env.src("game.js");
  return checkCreatures({ game, startRun, srcFiles: await env.srcFiles() });
}

// --- 6. C3's roster ------------------------------------------------------------------------------------------
// checkRoster(game) → { problems, stats }: rosterProblems on the live tables, then its teeth (MUTANTS: each applied,
// the section run, the change undone; each must be caught, and the tables are as they were after).
const ATTR_KEYS = ["str", "agi", "tou", "int", "wil", "ego"];
const BESTIARY_WORDS = 1300;   // bible §15.9: the bestiary, 63 creatures in 3 short registers
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const RGB3 = (c) => Array.isArray(c) && c.length === 3 && c.every((v) => Number.isInteger(v) && v >= 0 && v <= 255);
const span = (r) => Array.isArray(r) && r.length === 2 && r.every(Number.isInteger) && r[0] >= 1 && r[0] <= r[1] && r[1] <= 30;
// Who is out for a Bent stranger at the start (factions.js attitude, with the factions' start reputations).
const FEELINGS = [
  ["lanternMoths", "friendly", { torch: true }], ["lanternMoths", "neutral", { torch: false }], ["longback", "neutral"], ["chimePriest", "neutral"],
  ["drownedKeeper", "neutral"], ["clatterer", "neutral"], ["draughtsman", "neutral"], ["kite", "neutral"], ["lamplessChanter", "neutral"],
  ["assizeOutrider", "hostile", { genotype: "bent" }], ["assizeOutrider", "neutral", { genotype: "plumb" }], ["saltrat", "hostile"],
  ["rustbackScav", "hostile"], ["plumbknight", "hostile", { genotype: "plumb" }], ["askewAngle", "hostile"], ["longshadow", "hostile"],
  ["barrowSkeleton", "hostile"], ["glassCrab", "hostile"], ["beatSpider", "hostile"], ["smoother", "hostile"], ["gloamWarden", "hostile"],
];

export function rosterProblems(game) {
  const problems = [], stats = {};
  const fail = (m) => problems.push(m);
  // The 63, in the bible's order: registered or waiting, under the bible's glyph, with their three registers.
  const ids = Object.keys(BESTIARY);
  if (ids.length !== 63) fail(`the bestiary holds ${ids.length} creatures; bible §12 has 63`);
  let registered = 0, waiting = 0, parents = 0, total = 0;
  for (const id of ids) {
    const b = BESTIARY[id], reg = CREATURE_TYPES[id], wait = CREATURES_WAITING[id];
    total += words(b.flat) + words(b.deep) + words(b.dark);
    if (!/^[A-Z][A-Z -]*\. /.test(b.flat) || !/\.$/.test(b.flat)) fail(`${id}: the Flat line isn't a ledger's ("${b.flat}")`);
    if (!/^[A-Z].*\.$/.test(b.deep)) fail(`${id}: the Deep line isn't a sentence ("${b.deep}")`);
    if (!/^[a-z]+( [a-z]+)*(\n[a-z]+( [a-z]+)*)*$/.test(b.dark)) fail(`${id}: the Dark line isn't lower case without punctuation ("${b.dark}")`);
    if (!(Array.isArray(b.tier) && b.tier[0] >= 1 && b.tier[1] <= 8 && b.tier[0] <= b.tier[1])) fail(`${id}: tier ${JSON.stringify(b.tier)}`);
    if (reg && wait) fail(`${id} is both registered and waiting`);
    if (!reg && !wait) { fail(`${id} (bible §${b.section}) is neither registered nor waiting`); continue; }
    if (reg) registered++; else waiting++;
    if (reg && !WILDLIFE[id] && !PEOPLE[id]) parents++;
    const t = reg || wait;
    if (t.glyph !== b.glyph) fail(`${id}: glyph ${t.glyph}, the bible's ${b.glyph}`);
    if ((WILDLIFE[id] || PEOPLE[id] || wait) && (t.info !== b.deep || t.lines?.flat !== b.flat || t.lines?.dark !== b.dark))
      fail(`${id}: its info and lines aren't the bestiary's`);
  }
  if (total > BESTIARY_WORDS) fail(`the bestiary is ${total} words, bible §15.9's budget ${BESTIARY_WORDS}`);
  stats.bestiary = `${ids.length}: ${registered} registered (${parents} the parent's entries), ${waiting} waiting; ${total} words`;

  // The waiting: a creature's fields, the art check and the glyph registry, as the registered ones.
  const pairs = new Map();
  for (const [id, t] of Object.entries(CREATURE_TYPES)) {
    pairs.set(`${t.glyph} ${t.color.join(",")}`, id);
    if (!t.talks) for (const e of Object.keys(ELITES)) { const c = spawnCreature(id, 1, 1, FLOOR_Z, { rng: () => 0.5, elite: e }); pairs.set(`${c.glyph} ${c.color.join(",")}`, c.name); }
  }
  for (const [id, t] of Object.entries(CREATURES_WAITING)) {
    const at = `waiting ${id}`;
    for (const k of ["hp", "speed", "cooldown", "reach", "sight", "w", "h", "xp"]) if (!(typeof t[k] === "number" && t[k] >= 0)) fail(`${at}: ${k} ${t[k]}`);
    if (!(t.hp > 0 && t.w > 0 && t.h > 0) || !(Array.isArray(t.damage) && t.damage[0] >= 0 && t.damage[1] >= t.damage[0])) fail(`${at}: hp, size or damage`);
    if (!(typeof t.name === "string" && t.name && RGB3(t.color))) fail(`${at}: a name and an [r, g, b] colour`);
    if (!(typeof t.needs === "string" && t.needs.length > 20)) fail(`${at}: no needs`);
    if (CREATURE_TYPES[id]) fail(`${at} is registered`);
    const frames = t.frames;
    if (!Array.isArray(frames) || !frames.length || !t.palette) fail(`${at}: no frames or palette`);
    else for (const fr of frames) {
      if (fr.length !== frames[0].length) fail(`${at}: frames differ in height`);
      for (const row of fr) {
        if (row.length !== fr[0].length) fail(`${at}: ragged row "${row}"`);
        for (const ch of row) if (ch !== " " && !t.palette[ch]) fail(`${at}: no palette entry for "${ch}"`);
      }
    }
    for (const [ch, v] of Object.entries(t.palette || {})) if (!(Array.isArray(v) && RGB3(v[0]) && typeof v[1] === "number")) fail(`${at}: palette "${ch}"`);
    if (RESERVED_GLYPHS.includes(t.glyph) || !FAMILY_GLYPHS.includes(t.glyph)) fail(`${at}: glyph ${t.glyph} is reserved or no family's`);
    const keys = [`${t.glyph} ${t.color.join(",")}`, ...Object.values(ELITES).map((e) => `${t.glyph} ${t.color.map((v, k) => Math.round((v + e.color[k]) / 2)).join(",")}`)];
    for (const key of keys) { if (pairs.has(key)) fail(`${at} and ${pairs.get(key)} share the glyph and colour ${key}`); pairs.set(key, id); }
  }

  // The d20 numbers, levels, hooks and needs of every C3 species.
  let species = 0;
  for (const [table, rows] of [["wildlife", WILDLIFE], ["people", PEOPLE], ["villagers", VILLAGERS], ["waiting", CREATURES_WAITING]])
    for (const [id, t] of Object.entries(rows)) {
      species++;
      const at = `${table} ${id}`;
      if (!t.attrs || !ATTR_KEYS.every((k) => Number.isInteger(t.attrs[k]) && t.attrs[k] >= 1 && t.attrs[k] <= 30) || Object.keys(t.attrs).length !== 6)
        fail(`${at}: attributes ${JSON.stringify(t.attrs)}`);
      else if (t.dv !== Math.floor((t.attrs.agi - 16) / 2)) fail(`${at}: dv ${t.dv}, its AGI modifier ${Math.floor((t.attrs.agi - 16) / 2)}`);
      if (t.levels !== undefined && !span(t.levels)) fail(`${at}: levels ${JSON.stringify(t.levels)}`);
      if (t.depths !== undefined) fail(`${at}: depths (it would join the parent's tables)`);
      if (t.ai && !AI_HOOKS[t.ai]) fail(`${at}: AI hook ${t.ai} isn't registered`);
      if (t.rule && !(typeof t.needs === "string" && t.needs.length > 20)) fail(`${at}: a rule with nothing saying what it needs`);
      // Its factions (bible §12's column; [] for "none": out for everyone), so attitude reads what the bible says.
      if ((table === "wildlife" || table === "waiting") && !Array.isArray(t.factions)) fail(`${at}: no factions (bible §12's column; [] for none)`);
    }
  stats.species = `${species} C3 species with attributes and dv`;
  // A wildlife species' levels hold every row its regions give it (content/world/regions.js, C1a's): the type and the
  // rows agree on where it lives.
  let rowsHeld = 0;
  for (const [region, R] of Object.entries(REGIONS))
    for (const [type, , lo, hi] of R.creatures || []) {
      const t = WILDLIFE[type];
      if (!t?.levels) continue;
      rowsHeld++;
      if (lo < t.levels[0] || hi > t.levels[1]) fail(`wildlife ${type}: levels ${t.levels.join("-")} don't hold ${region}'s row ${lo}-${hi}`);
    }
  stats.regionRows = `${rowsHeld} region rows within their kind's levels`;
  // The types the test world's villages use keep what they had before C3: a DV term of 0, the tinker's general stock.
  for (const [id, t] of Object.entries(VILLAGERS)) if (t.dv !== 0) fail(`villagers ${id}: dv ${t.dv} (the test world's villages fight as before C3: 0)`);
  const tinker = VILLAGERS.villageTinker.merchant;
  if (tinker?.stock !== "general" || JSON.stringify(tinker.services) !== JSON.stringify(["identify", "uncurse"]))
    fail(`villagers villageTinker: stock ${tinker?.stock}, services ${JSON.stringify(tinker?.services)} (as before C3: general; identify, uncurse)`);

  // The real world's level table: three kinds or more at every level it makes.
  const thin = [];
  for (let L = 1; L <= 30; L++) if (rowsAt(LEVEL_POOL, L).length < 3) thin.push(`level ${L} (${rowsAt(LEVEL_POOL, L).length})`);
  if (thin.length) fail(`the real world's level table is thin at ${thin.join(", ")}`);
  stats.levelPool = `${LEVEL_POOL.length} kinds; at levels 1-30 between ${Math.min(...Array.from({ length: 30 }, (_, k) => rowsAt(LEVEL_POOL, k + 1).length))} and ${Math.max(...Array.from({ length: 30 }, (_, k) => rowsAt(LEVEL_POOL, k + 1).length))}`;

  // Who is out for a stranger at the start; and from level 20 on (the draws request 1 sends to the level table) every
  // kind of the level table is.
  const p = game.player, saved = { genotype: p.genotype, torch: p.torch, rep: game.state.rep };
  let felt = 0;
  try {
    game.state.rep = {}; p.genotype = "bent"; p.torch = true;
    const calm = new Set();
    for (let L = 20; L <= 30; L++)
      for (const [type] of rowsAt(LEVEL_POOL, L))
        if (attitude(game, spawnCreature(type, 1, 1, FLOOR_Z, { rng: () => 0.5, level: L }), p) !== "hostile") calm.add(`${type} (level ${L})`);
    if (calm.size) fail(`the level table holds kinds not out for a stranger from level 20 on: ${[...calm].slice(0, 4).join(", ")}`);
    for (const [id, want, set = {}] of FEELINGS) {
      if (!CREATURE_TYPES[id]) { fail(`feelings: ${id} isn't registered`); continue; }
      p.genotype = set.genotype || "bent"; p.torch = set.torch ?? true;
      const c = spawnCreature(id, 1, 1, FLOOR_Z, { rng: () => 0.5, level: 5 });
      const got = attitude(game, c, p);
      felt++;
      if (got !== want) fail(`feelings: a ${id} is ${got} to a ${p.genotype} stranger${set.torch === false ? " with the torch out" : ""}, want ${want}`);
    }
  } finally { Object.assign(p, { genotype: saved.genotype, torch: saved.torch }); game.state.rep = saved.rep; }
  stats.feelings = `${felt} of ${FEELINGS.length}`;
  return { problems, stats };
}

const MUTANTS = [
  ["a waiting creature's ragged art row", () => { const f = CREATURES_WAITING.glowfin.frames[0], old = f[1]; f[1] = old + "f"; return () => { f[1] = old; }; }, /waiting glowfin: ragged row/],
  ["a dv that isn't the AGI modifier", () => { WILDLIFE.saltrat.dv += 1; return () => { WILDLIFE.saltrat.dv -= 1; }; }, /wildlife saltrat: dv/],
  ["a Dark line punctuated", () => { const old = BESTIARY.kite.dark; BESTIARY.kite.dark = "kree."; return () => { BESTIARY.kite.dark = old; }; }, /kite: the Dark line/],
  ["a waiting creature in another's colour", () => { const t = CREATURES_WAITING.mirrorEel, old = t.color; t.color = CREATURES_WAITING.umbralEel.color; return () => { t.color = old; }; }, /share the glyph and colour/],
  ["the level table short at the top", () => { const out = LEVEL_POOL.filter(([id]) => id === "askewAngle" || id === "fold"); for (const r of out) LEVEL_POOL.splice(LEVEL_POOL.indexOf(r), 1);
    return () => LEVEL_POOL.push(...out); }, /thin at .*level 30/],
  ["a neutral kind in the level table above 20", () => { LEVEL_POOL.push(["chimePriest", 1, 9, 24]); return () => LEVEL_POOL.pop(); }, /not out for a stranger from level 20 on: chimePriest/],
  ["a waiting boss without its faction", () => { const t = CREATURES_WAITING.escapement, old = t.factions; delete t.factions; return () => { t.factions = old; }; }, /waiting escapement: no factions/],
  ["a species narrower than its rows", () => { const t = WILDLIFE.saltrat, old = t.levels; t.levels = [1, 3]; return () => { t.levels = old; }; }, /wildlife saltrat: levels 1-3 don't hold/],
  ["a villager quicker than before C3", () => { const t = VILLAGERS.villager; t.attrs.agi = 18; t.dv = 1; return () => { t.attrs.agi = 16; t.dv = 0; }; }, /villagers villager: dv 1/],
  ["a creature of the 63 gone", () => { const v = CREATURES_WAITING.vesper; delete CREATURES_WAITING.vesper; return () => { CREATURES_WAITING.vesper = v; }; }, /vesper .*neither registered nor waiting/],
];

export function checkRoster(game) {
  const out = rosterProblems(game);
  let caught = 0;
  for (const [what, apply, want] of MUTANTS) {
    const undo = apply();
    let r;
    try { r = rosterProblems(game); } finally { undo(); }
    if (r.problems.some((p) => want.test(p))) caught++;
    else out.problems.push(`roster mutant "${what}" not caught (${r.problems.slice(0, 2).join(" | ") || "no problem found"})`);
  }
  if (rosterProblems(game).problems.length !== out.problems.filter((p) => !p.startsWith("roster mutant")).length) out.problems.push("the roster's tables aren't as they were after the mutants");
  out.stats.mutants = `${caught} of ${MUTANTS.length} caught`;
  return out;
}
