// Determinism (R6): the same seed and address always generate the same zone.
//
//   checkDeterminism({ seeds, depths, sources }) → { name, ok, problems, stats }
//
// 1. Every level is generated twice and compared: blocks byte for byte, every item field, and each
//    creature's type, position, elite, uid and looks (the cosmetic stream), and each person's type,
//    position, uid and state. Ids are runtime handles from a counter and are left out.
//    The uid part has nothing to compare until 0C: legacy creatures and people carry no uid yet
//    (undefined on both sides). The stats count how many do, and a note says so while it is 0.
// 2. A static scan (comments stripped). In the generation code (sources: { path: text }; 0A1 scans
//    src/gen/, src/world/ and story.js, WS7 adds story/history.js and story/villages.js): no
//    Math.random, and no Math.hypot (its last bits differ between engines and even between
//    Chrome's JIT tiers: use rng.js distance). In the generation code and the helpers it calls
//    (helpers: { path: text }): no sort with a comparator that draws random numbers (engines sort
//    differently, so they draw a different count: use rng.js seededSort). Both were found in 0A1:
//    Chrome 152 generated about a third of the legacy levels differently from Node 20. Also no
//    Math.sin, cos, tan, exp, pow or atan2 in the generation code (0A2): engines don't promise the
//    same last bits for them, and world functions must agree to the bit across zones and engines.
//    story.js is exempt (its temple mosaic uses atan2) until 0A2 turns the temple into a plan.
import { canon } from "../lib/hash.js";
import { generateDungeonLevel, legacyParams, LEGACY_LEVELS } from "../../src/gen/dungeon.js";

const creatureFacts = (m) => ({ type: m.type, tx: m.tx, ty: m.ty, z: m.z, elite: m.elite, uid: m.uid,
  hp: m.hp, state: m.state, anim: m.anim, think: m.think, pause: m.pause, shot: m.shot });
const npcFacts = (n, monsters) => ({ type: n.type, tx: n.tx, ty: n.ty, z: n.z, uid: n.uid,
  state: n.state?.target !== undefined ? { ...n.state, target: monsters.findIndex((m) => m.id === n.state.target) } : n.state });
const layout = (f) => ({ spawn: f.spawn, stairs: f.stairs, upStairs: f.upStairs, vault: f.vault, secret: f.secret,
  secretWalls: f.secretWalls, links: f.links, groups: f.groups, spikes: f.spikes, braziers: f.braziers,
  guardianHall: f.guardianHall, attempts: f.attempts, hasBelow: f.hasBelow, level: f.level, key: f.key });

export function compareZones(a, b) {
  const out = [];
  if (a.blocks.length !== b.blocks.length || a.blocks.some((v, i) => v !== b.blocks[i])) out.push("blocks");
  if (canon(a.items) !== canon(b.items)) out.push("items");
  if (canon(a.monsters.map(creatureFacts)) !== canon(b.monsters.map(creatureFacts))) out.push("creatures");
  if (canon(a.npcs.map((n) => npcFacts(n, a.monsters))) !== canon(b.npcs.map((n) => npcFacts(n, b.monsters)))) out.push("people");
  if (canon(layout(a)) !== canon(layout(b))) out.push("layout");
  return out;
}

// Code without comments, strings left in (a string mentioning Math.random is still suspicious).
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

const RANDOM_SORT = /\.sort\(.*\b(rand|rng|random)\w*\(/;   // a sort call with a random draw later on its line

const TRANSCENDENTAL = /Math\.(sin|cos|tan|exp|pow|atan2)\b/;
export const TRANSCENDENTAL_EXEMPT = ["story.js"];

export function checkDeterminism({ seeds = [3, 77, 2024], depths = LEGACY_LEVELS, sources = {}, helpers = {} } = {}) {
  const problems = [], notes = [];
  let levels = 0, bodies = 0, withUid = 0;
  for (const seed of seeds)
    for (let depth = 1; depth <= depths; depth++) {
      const p = legacyParams(depth, seed);
      const a = generateDungeonLevel(seed, p);
      const diff = compareZones(a, generateDungeonLevel(seed, p));
      levels++;
      for (const e of [...a.monsters, ...a.npcs]) { bodies++; if (e.uid !== undefined && e.uid !== null) withUid++; }
      if (diff.length) problems.push(`seed ${seed} level ${depth}: two generations differ in ${diff.join(", ")}`);
    }
  let scanned = 0;
  const scan = (file, text, rules) => {
    scanned++;
    stripComments(text).split("\n").forEach((line, k) => {
      for (const [re, why] of rules) if (re.test(line)) problems.push(`${file}:${k + 1} ${why}`);
    });
  };
  const sortRule = [RANDOM_SORT, "sorts with a random comparator (engine-dependent draws: use rng.js seededSort)"];
  const trigRule = [TRANSCENDENTAL, "uses Math.sin/cos/tan/exp/pow/atan2 in generation code (engine-dependent bits: use + − × ÷, sqrt, floor)"];
  for (const [file, text] of Object.entries(sources))
    scan(file, text, [[/Math\.random/, "uses Math.random in generation code (R6: pass a seeded rng)"],
                      [/Math\.hypot/, "uses Math.hypot in generation code (engine-dependent bits: use rng.js distance)"], sortRule,
                      ...(TRANSCENDENTAL_EXEMPT.includes(file) ? [] : [trigRule])]);
  for (const [file, text] of Object.entries(helpers)) scan(file, text, [sortRule]);
  if (withUid === 0) notes.push(`uid comparison not exercised: none of ${bodies} creatures and people has a uid yet (0C adds them)`);
  return { name: "determinism", ok: problems.length === 0, problems, notes,
           stats: { levelsTwice: levels, filesScanned: scanned, bodies, withUid } };
}
