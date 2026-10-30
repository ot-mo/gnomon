// Dungeon levels and sites (TECH_DESIGN §8.3 "WS10"). Every level of the legacy stack, many seeds, must pass
// validateDungeonLevel (as test.html checks in the browser), guardian levels must have their guardian and hall,
// and generation must stay fast; so must 1,000 levels with random site parameters (every theme, gimmick and
// bottom); every site of both worlds validates on every level for 5 seeds, history's site requests are built,
// and a legend lives in exactly one zone.
//
//   checkVaultOptions() · checkDungeonParams()
//   checkDungeons({ seeds = 50, depths = 20, p95Budget = 40 })      the legacy stack (tools/check-dungeons.mjs)
//   checkRandomLevels({ count = 1000, p95Budget = 40 })             random site parameters (check-dungeons)
//   checkSites({ seeds })            every site × every level × the seeds, both worlds (tools/check-sites.mjs); every
//                                    sinkhole over a site's dungeon on one of its spots, a fall into it landing right
//                                    under it on level 1 (zones.js arrivalPoint "fall"; integrator, C1a #9)
//   checkHistoric({ seeds })         the fixture history's two site requests, built (check-sites)
//   checkLegends({ seeds })          a legend lives in exactly one zone; a dead one never returns (check-sites)
//   checkLandmarkBottoms({ seeds })  the landmark dungeons' bottoms, mid-floor halls and murals (check-sites; B2)
//   randomParams(i) → { seed, p }    the i-th random level (test.html draws the same ones)
//
// Timing: 20 levels are generated first and not counted (the JIT warming up), then the percentiles
// are over all counted levels. Budget: p95 ≤ 40 ms (TECH_DESIGN §6.7, 0A1 gate).
import { generateDungeonLevel, validateDungeonLevel, legacyParams, LEGACY_GUARDIANS, LEGACY_LEVELS, DUNGEON_THEMES, GIMMICKS } from "../../src/gen/dungeon.js";
import { stampVault, buildVault, pickVault, registerLegend, vaultById, VAULTS, GUARDIAN_HALLS, BOSS_HALLS, LAIR_HALLS, RELIC_HALLS, READING_HALLS, STAMP_DEFAULTS, BOTTOM_LOOT } from "../../src/gen/vaults.js";
import { Zone, B, FLOOR_Z } from "../../src/world.js";
import { makeRng, seedFor } from "../../src/rng.js";
import { canTalk, CREATURE_TYPES } from "../../src/creatures.js";
import { ITEM_KINDS } from "../../src/items.js";
import { makeLegend, dungeonParams, sinkholeSpots, legendOf, hourRelic, SITE_KINDS, SITE_BUILDERS } from "../../src/world/sites.js";
import { reachable, PLAYER_STEP_UP, PLAYER_DROP } from "../../src/pathing.js";
import { standWith } from "../../src/world.js";
import { arrivalPoint } from "../../src/zones.js";
import { buildRun, zoneSeed } from "../../src/world/run.js";
import { compileWorld, tierOfLevel } from "../../src/world/worldmodel.js";
import { generateSurface, validateSurface } from "../../src/gen/surface.js";
import { BLOCKS } from "../../src/blocks.js";
import { TEST_WORLD } from "../../src/content/world/test-world.js";
import { REAL_WORLD } from "../../src/content/world/worldmap.js";
import { DUNGEONS } from "../../src/content/dungeons.js";
import { legendLooks } from "../../src/content/creatures/legends.js";
import * as LEGENDS_MOD from "../../src/content/creatures/legends.js";
import * as CREATURES_MOD from "../../src/creatures.js";
import * as FACTIONS_MOD from "../../src/factions.js";
import { DENY } from "./names.js";

const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

// stampVault's options and the legend registry (the defaults are covered by the golden vaults).
export function checkVaultOptions() {
  const problems = [];
  const expect = (cond, msg) => { if (!cond) problems.push(msg); };
  const room = { id: "test", name: "Test Room", height: 4, wall: B.BRICK, floorBlock: B.TILE, links: [],
                 plan: ["#####", "#.X.#", "#...#", "##E##"], legend: { X: "testPillar" } };
  registerLegend("testPillar", (c) => { c.zone.set(c.x, c.y, c.z0 - 1, c.vault.floorBlock); for (let z = c.z0; z < c.top; z++) c.zone.set(c.x, c.y, z, B.COLUMN); });
  let threw = false;
  try { registerLegend("testPillar", () => {}); } catch { threw = true; }
  expect(threw, "registerLegend must refuse a duplicate id");
  const stamp = (opts) => {
    const z = new Zone({ type: "surface", w: 16, d: 16, h: 16, level: 3 });
    z.blocks.fill(B.ROCK);
    const entrance = stampVault(z, buildVault(room, makeRng(1)), 4, 4, makeRng(1), opts);
    return { z, entrance };
  };
  const rock = stamp({}), open = stamp({ roof: "none", wallHeight: 2 }), slab = stamp({ roof: "slab" }), high = stamp({ baseZ: FLOOR_Z + 3, roof: "none" });
  const top = FLOOR_Z + room.height;
  expect(rock.z.get(5, 6, top) === B.ROCK && rock.z.get(4, 4, 10) === B.ROCK, "roof rock: solid above the room and the walls");
  expect(open.z.get(5, 6, top) === B.AIR && open.z.get(5, 6, 15) === B.AIR, "roof none: open sky above the room");
  expect(open.z.get(4, 4, FLOOR_Z + 1) === B.BRICK && open.z.get(4, 4, FLOOR_Z + 2) === B.AIR, "wallHeight 2: walls two blocks tall, air above");
  expect(slab.z.get(5, 6, top) === B.BRICK && slab.z.get(5, 6, top + 1) === B.AIR && slab.z.get(4, 4, top) === B.BRICK, "roof slab: one block at the room's height, air above");
  expect(rock.z.get(6, 5, FLOOR_Z) === B.COLUMN && rock.z.get(6, 5, FLOOR_Z + 3) === B.COLUMN, "a plan's own legend letter uses its handler");
  expect(rock.entrance && rock.entrance.x === 6 && rock.entrance.y === 7 && rock.entrance.dy === 1, "the entrance and its corridor direction");
  expect(high.z.get(5, 6, FLOOR_Z + 2) === B.TILE && high.z.get(5, 6, FLOOR_Z + 3) === B.AIR && high.z.get(5, 6, FLOOR_Z + 1) === B.ROCK,
    "baseZ: the floor sits at baseZ − 1 with rock below");
  expect(STAMP_DEFAULTS.wallHeight === 4 && STAMP_DEFAULTS.roof === "rock" && STAMP_DEFAULTS.baseZ === FLOOR_Z, "defaults keep the legacy vaults");
  // Ids: every vault and hall is found by id; a pool with equal weights draws like rng.pick.
  for (const v of [...VAULTS, ...Object.values(GUARDIAN_HALLS), ...Object.values(BOSS_HALLS), ...Object.values(LAIR_HALLS), ...Object.values(RELIC_HALLS), ...Object.values(READING_HALLS)])
    expect(vaultById(v.id) === v, `vaultById("${v.id}")`);
  for (let s = 1; s <= 50; s++) {
    const a = pickVault(makeRng(s), { level: 12 }).id, b = makeRng(s).pick(VAULTS).id;
    if (a !== b) { problems.push(`pickVault with the default pool drew ${a}, rng.pick would draw ${b}`); break; }
  }
  expect(pickVault(makeRng(1), { final: true, bottom: { kind: "guardian", id: "warden" } }).id === "warden", "a final level's guardian bottom gets its hall");
  expect(pickVault(makeRng(1), { final: true, bottom: { kind: "legend", id: "beatkeeper", hall: "beat" } }).id === "lair:beat", "a legend's bottom gets its lair hall");
  expect(pickVault(makeRng(1), { final: true, bottom: { kind: "relic", id: null } }).id === "reliquary", "a relic bottom gets the reliquary");
  expect(pickVault(makeRng(1), { final: false, bottom: { kind: "relic", id: null }, level: 3 }).id !== "reliquary", "the bottom's hall only on the last level");
  // A pool's weights draw in proportion.
  let gauntlets = 0;
  for (let s = 1; s <= 400; s++) if (pickVault(makeRng(s), { level: 5, vaultPool: [["gauntlet", 3], "flatLie"] }).id === "gauntlet") gauntlets++;
  expect(gauntlets > 260 && gauntlets < 340, `a 3:1 pool drew the heavier vault ${gauntlets} times in 400`);
  // Every puzzle keeps its both-view element (gen/vaults.js:32-105): the letters that carry it are in its plan.
  const both = { runeLever: "L", mosaicHall: "_", flatLie: "~", gauntlet: "\\^", braziers: "F", speakingDoor: "Q", darkMaze: "^[^l]*$", unseenPath: "p" };
  for (const v of VAULTS) {
    const plan = buildVault(v, makeRng(3)).plan.join("");
    expect(!!both[v.id] && new RegExp(both[v.id]).test(plan), `${v.id}: its two-view letter (${both[v.id]}) is gone from its plan`);
  }
  const lever = buildVault(vaultById("runeLever"), makeRng(3)), mosaic = buildVault(vaultById("mosaicHall"), makeRng(3));
  expect(lever.leverRecord === true && mosaic.mosaics?.some(([, , b]) => b === B.MOSAIC_GOLD), "the rune lever's record and the mosaic hall's arrow");
  return { name: "vault options", ok: problems.length === 0, problems, stats: { cases: 22 + VAULTS.length } };
}

// The parameter contract's edges: what generateDungeonLevel, validateDungeonLevel and legacyParams
// do with a missing or not-yet-supported argument (each case was a silent trap once).
export function checkDungeonParams() {
  const problems = [];
  const expect = (cond, msg) => { if (!cond) problems.push(msg); };
  const throws = (fn) => { try { fn(); return false; } catch { return true; } };
  let cases = 0;
  const test = (cond, msg) => { cases++; expect(cond, msg); };
  test(throws(() => legacyParams(7)), "legacyParams(depth) without the run seed must throw (it planned the people of seed 0)");
  test(!throws(() => legacyParams(7, 42)) && legacyParams(7, 42).z === 7, "legacyParams(depth, runSeed) works");
  // A level validated without its p is judged by what the zone records (final, bottom, hasUp).
  for (const [seed, depth] of [[5, LEGACY_LEVELS], [7, LEGACY_LEVELS], [5, 10], [42, 3]]) {
    const p = legacyParams(depth, seed), f = generateDungeonLevel(seed, p);
    const alone = validateDungeonLevel(f).join(", "), withP = validateDungeonLevel(f, p).join(", ");
    test(alone === withP, `seed ${seed} level ${depth}: validateDungeonLevel(zone) says "${alone}", with p "${withP}"`);
  }
  const last = generateDungeonLevel(5, legacyParams(LEGACY_LEVELS, 5));
  last.stairs = { x: Math.floor(last.spawn.x), y: Math.floor(last.spawn.y) };
  test(validateDungeonLevel(last).includes("stairs down on the last floor"), "the zone's own final flag keeps the last-level rules");
  const lich = last.creatures.findIndex((m) => m.type === "lich");
  if (lich >= 0) last.creatures.splice(lich, 1);
  test(lich >= 0 && validateDungeonLevel(last).includes("boss missing or unreachable"), "the zone's own bottom keeps the boss rule");
  const noUp = generateDungeonLevel(42, { ...legacyParams(3, 42), hasUp: false });
  test(!noUp.upStairs && validateDungeonLevel(noUp).length === 0, `a level made without stairs up validates alone (${validateDungeonLevel(noUp).join(", ")})`);
  // The WS10 parts are read, never silently ignored: a table of rows sets the monsters, holesIn keeps random
  // holes inside its rect, a legend bottom brings its legend (and refuses to go without its def), an unknown
  // gimmick throws.
  const rows = generateDungeonLevel(3, { ...legacyParams(8, 3), creatureTable: [["rat", 1, 1, 30], ["bat", 1, 1, 30]] });
  const kinds = new Set(rows.creatures.filter((c) => !canTalk(c) && !c.guardian).map((c) => c.type));
  test([...kinds].every((t) => ["rat", "bat", "goblin", "skeleton", "flatling"].includes(t)) && (kinds.has("rat") || kinds.has("bat")),
    `creatureTable rows: the level's monsters are ${[...kinds].join(", ")}`);
  const ids = generateDungeonLevel(4, { ...legacyParams(15, 4), creatureTable: ["troll"] });
  test(ids.creatures.some((c) => c.type === "troll"), "creatureTable ids: trolls on a level that lists only them");
  const rect = { x0: 0, y0: 0, x1: 23, y1: 47 };
  let outside = 0;
  for (let s = 1; s <= 12; s++) outside += holesOutside(generateDungeonLevel(s, { ...legacyParams(9, s), holesIn: rect, gimmicks: ["collapsed"] }), rect);
  test(outside === 0, `holesIn: ${outside} hole columns outside the rect on 12 levels`);
  test(throws(() => generateDungeonLevel(3, { ...legacyParams(4, 3), final: true, bottom: { kind: "legend", id: "plain", uid: "legend:x" } })),
    "a legend bottom without its LegendDef must throw");
  test(throws(() => generateDungeonLevel(3, { ...legacyParams(4, 3), gimmicks: ["noSuchGimmick"] })), "an unknown gimmick must throw");
  const def = makeLegend(makeRng(5), { id: "lair:test" }, 6);
  const lair = generateDungeonLevel(5, { ...legacyParams(6, 5), final: true, forcedVault: null, bottom: { kind: "legend", id: def.template, uid: def.uid, hall: def.hall, legend: def } });
  const owner = lair.creatures.find((c) => c.uid === def.uid);
  test(!!owner && owner.flags?.legend === def.uid && owner.level === def.level && validateDungeonLevel(lair).length === 0,
    `a legend bottom: its owner (${owner?.name}) with its uid, at its level, and the level validates alone (${validateDungeonLevel(lair).join(", ")})`);
  const withAttrs = { attrs: { str: 14, agi: 12 }, color: [0, 0, 0] };
  legendLooks(withAttrs, def); legendLooks(withAttrs, def);
  test(withAttrs.attrs.str === 15 && withAttrs.attrs.agi === 13, `a legend's +1 to every attribute, once (${JSON.stringify(withAttrs.attrs)})`);
  test(!throws(() => generateDungeonLevel(3, { ...legacyParams(2, 3), creatureTable: null, holesIn: undefined })), "null or missing WS10 parts are fine");
  return { name: "dungeon params", ok: problems.length === 0, problems, stats: { cases } };
}

export function checkDungeons({ seeds = 50, depths = LEGACY_LEVELS, p95Budget = 40 } = {}) {
  const problems = [], times = [];
  let retries = 0, worstAttempts = 0, guardianLevels = 0;
  for (let k = 0; k < 20; k++) generateDungeonLevel(9000 + k, legacyParams(1 + (k % depths), 9000 + k));   // warm-up
  for (let seed = 1; seed <= seeds; seed++)
    for (let depth = 1; depth <= depths; depth++) {
      const p = legacyParams(depth, seed);
      const t0 = performance.now();
      const f = generateDungeonLevel(seed, p);
      times.push(performance.now() - t0);
      retries += f.attempts - 1;
      worstAttempts = Math.max(worstAttempts, f.attempts);
      const bad = validateDungeonLevel(f, p);
      if (bad.length) problems.push(`seed ${seed} level ${depth}: ${bad.join(", ")}`);
      if (f.w !== 48 || f.d !== 48 || f.h !== 10 || f.key !== p.key || f.level !== depth) problems.push(`seed ${seed} level ${depth}: wrong zone identity`);
      if (f.hasBelow === !!p.final) problems.push(`seed ${seed} level ${depth}: hasBelow should be ${!p.final}`);
      if (LEGACY_GUARDIANS[depth]) {
        guardianLevels++;
        if (!f.guardianHall || !f.creatures.some((m) => m.guardian === f.guardianHall.type) || !f.stairs)
          problems.push(`seed ${seed} level ${depth}: guardian hall incomplete`);
      }
    }
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = pct(sorted, 0.95);
  if (p95 > p95Budget) problems.push(`generation p95 ${p95.toFixed(1)} ms is over the ${p95Budget} ms budget`);
  const r = (n) => +n.toFixed(2);
  return {
    name: "dungeons", ok: problems.length === 0, problems,
    stats: { levels: times.length, failed: problems.length, retries, worstAttempts, guardianLevels,
             ms: { mean: r(times.reduce((a, b) => a + b, 0) / times.length), p50: r(pct(sorted, 0.5)), p95: r(p95), max: r(sorted[sorted.length - 1]) } },
  };
}


// Hole columns (a pit, a chasm, deep water) outside rect and outside the vault (whose chasms are its puzzle).
function holesOutside(f, rect) {
  let n = 0;
  const v = f.vault;
  for (let y = 0; y < f.d; y++)
    for (let x = 0; x < f.w; x++) {
      if (x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1) continue;
      if (v && x >= v.x0 && x <= v.x1 && y >= v.y0 && y <= v.y1) continue;
      const g = f.get(x, y, FLOOR_Z - 1);
      if ((!f.get(x, y, 0) && !g) || g === B.WATER_DEEP) n++;
    }
  return n;
}

// --- 1,000 random site levels ---------------------------------------------------------------------------------
const ROWS = [["rat", 2, 1, 10], ["goblin", 2, 1, 15], ["orc", 1, 7, 30], ["troll", 1, 13, 30], ["wraith", 1, 10, 30]];
// The i-th random level's seed and parameters: any theme, level 1-30, 0-3 gimmicks, any bottom on a last level,
// sometimes a creature table, holesIn, a Cradle. test.html draws the same ones (parity).
export function randomParams(i) {
  const rng = makeRng(seedFor(9091, "random level", i));
  const level = rng.int(1, 30), count = rng.int(1, 5), z = rng.int(1, count), final = z === count;
  const theme = rng.pick(Object.keys(DUNGEON_THEMES).sort());
  const gimmicks = rng.shuffle(Object.keys(GIMMICKS).sort()).slice(0, rng.int(0, 3));
  let bottom = null;
  if (final) {
    const kind = rng.pick(["none", "guardian", "legend", "legend", "relic", "relic"]);
    if (kind === "guardian") bottom = { kind, id: rng.pick(Object.keys(GUARDIAN_HALLS).sort()) };
    else if (kind === "legend") {
      const legend = makeLegend(rng, { id: `random:${i}` }, level);
      bottom = { kind, id: legend.template, uid: legend.uid, hall: legend.hall, legend };
    } else if (kind === "relic") {
      const relic = rng.chance(0.6) ? { id: `relic:random${i}`, name: "the Lens of Testing", base: { kind: "amulet", id: "sight" }, powers: [], domain: "glass" } : null;
      bottom = { kind, id: relic?.id ?? null, relic, trueMarks: [...DUNGEONS.trueMarks[tierOfLevel(level)]] };
    }
  }
  const band = DUNGEONS.vaultPools.find((b) => level >= b.levels[0] && level <= b.levels[1]);
  const x0 = rng.int(0, 16), y0 = rng.int(0, 16);
  const p = {
    key: `9,9,${z}`, wx: 9, wy: 9, z, level, tier: tierOfLevel(level), index: z, count, final, theme, hasUp: true, forcedVault: null,
    vaultPool: rng.chance(0.8) ? band.pool : null, gimmicks, bottom, encounters: [],
    creatureTable: rng.chance(0.2) ? ROWS : null, holesIn: rng.chance(0.15) ? { x0, y0, x1: x0 + rng.int(24, 31), y1: y0 + rng.int(24, 31) } : null,
    cradle: rng.chance(0.15), murals: gimmicks.includes("murals") ? [{ text: "A carved Hour lifts a lens.", map: "Tiles show a lens and two suns." }] : null,
    name: `Random level ${i}`,
  };
  return { seed: rng.int(1, 2 ** 31 - 1), p };
}

// A level's fingerprint (its blocks, who and what is where), folded into a running one: Node and the browser
// must agree on all 1,000 (test.html prints it; R6).
export function levelSig(f, h = 0x811c9dc5) {
  const mix = (v) => { h = Math.imul(h ^ (v & 0xffff), 16777619) >>> 0; };
  for (let i = 0; i < f.blocks.length; i++) h = Math.imul(h ^ f.blocks[i], 16777619) >>> 0;
  for (const c of f.creatures) { mix(c.tx); mix(c.ty); mix(c.hp); for (const ch of c.type) mix(ch.charCodeAt(0)); }
  for (const it of f.items) { mix(Math.floor(it.x * 10)); mix(Math.floor(it.y * 10)); for (const ch of it.kind) mix(ch.charCodeAt(0)); }
  mix(f.attempts);
  return h;
}

// What each gimmick and part promises, on one generated level. → problems
export function siteLevelProblems(f, p) {
  const out = [], g = p.gimmicks || [], v = f.vault;
  const inVault = (x, y) => v && x >= v.x0 && x <= v.x1 && y >= v.y0 && y <= v.y1;
  const after = (a, b) => g.indexOf(a) > g.indexOf(b);   // a ran after b
  if (g.includes("lightless") && f.blocks.includes(B.LAMP)) out.push("lightless: a lamp is left");
  if (g.includes("haunted"))
    outer: for (let y = 0; y < f.d; y++)
      for (let x = 0; x < f.w; x++)
        if (!inVault(x, y) && f.get(x, y, FLOOR_Z - 1) === B.PLANK && !f.get(x, y, 0)) { out.push(`haunted: a plank bridge at (${x}, ${y}) isn't ghostly`); break outer; }
  if (g.includes("oneBeat")) {
    for (const [i, s] of f.spikes) {
      const x = i % f.w, y = (i - x) / f.w;
      if (!inVault(x, y) && (s.phase !== 0 || s.period !== 4)) { out.push(`oneBeat: the spike at (${x}, ${y}) keeps its own beat`); break; }
    }
    if (!f.beat) out.push("oneBeat: no zone.beat");
  }
  // The vault's puzzle is the gimmicks' to leave alone (its both-view rule): its spikes keep their own pattern,
  // and only the Unseen Path has ghost planks.
  for (const [i, sp] of f.spikes) { const x = i % f.w, y = (i - x) / f.w; if (inVault(x, y) && sp.pattern === "beat") { out.push(`a gimmick changed the vault's spikes at (${x}, ${y})`); break; } }
  if (v && v.name !== "The Unseen Path")
    outer2: for (let y = v.y0; y <= v.y1; y++) for (let x = v.x0; x <= v.x1; x++) if (f.get(x, y, FLOOR_Z - 1) === B.GHOST) { out.push(`ghost planks in ${v.name} at (${x}, ${y})`); break outer2; }
  const flats = f.creatures.filter((c) => c.vis?.flat && !canTalk(c) && !c.guardian && !c.flags?.legend);
  if (g.includes("allDeep") && !(g.includes("flatland") && after("flatland", "allDeep")) && flats.length) out.push(`allDeep: ${flats.length} flat creature(s)`);
  const buried = f.items.filter((it) => f.get(Math.floor(it.x), Math.floor(it.y), Math.floor(it.z)) !== B.AIR);
  if (buried.length) out.push(`${buried.length} item(s) inside a block (${buried.map((it) => `${it.kind} at ${Math.floor(it.x)},${Math.floor(it.y)},${it.z}`).join("; ")})`);
  if (p.holesIn && holesOutside(f, p.holesIn)) out.push(`holesIn: ${holesOutside(f, p.holesIn)} hole column(s) outside it`);
  if (p.cradle && !(f.cradle && f.get(f.cradle.x, f.cradle.y, FLOOR_Z) === B.STATION && f.get(f.cradle.x, f.cradle.y, FLOOR_Z + 1) === B.STATION))
    out.push("cradle: no Truing Cradle");
  if (p.creatureTable) {
    const allowed = new Set([...p.creatureTable.map((r) => (Array.isArray(r) ? r[0] : r)), "rat", "goblin", "skeleton", "flatling", "shade", "door"]);
    if (p.bottom?.legend) allowed.add(p.bottom.legend.species);
    if (p.vaultGuardian) allowed.add(p.vaultGuardian);   // a landmark's own guardian in its hall (B2, C1b #6)
    const odd = f.creatures.filter((c) => !canTalk(c) && !c.guardian && !allowed.has(c.type));
    if (odd.length) out.push(`creatureTable: ${odd.map((c) => c.type).join(", ")} not in the table`);
  }
  if (p.final && p.bottom?.kind === "legend") {
    const c = f.creatures.find((m) => m.uid === p.bottom.uid);
    if (!c || c.flags?.legend !== p.bottom.uid || c.level !== p.bottom.legend.level || !c.named) out.push("legend: its owner isn't made right");
    // (Its hoard: a body mod once WS5 has filled BOTTOM_LOOT.bodyMod, since the WS10 merge.)
    if (BOTTOM_LOOT.bodyMod && !(f.bottomLoot?.bodyMod && f.items.some((it) => ["artifact", "cell", "implant"].includes(it.kind)))) out.push("legend: no body mod at its bottom");
  }
  if (p.final && p.bottom?.kind === "relic") {
    const r = p.bottom.relic, loot = f.bottomLoot || {};
    if (JSON.stringify(loot.trueMarks) !== JSON.stringify(p.bottom.trueMarks)) out.push(`reliquary: true-marks ${JSON.stringify(loot.trueMarks)}, want ${JSON.stringify(p.bottom.trueMarks)}`);
    if (r) {
      const it = f.items.find((o) => o.histRelic === r.id);
      if (!it || it.uid !== r.id || !it.relicSpawn || it.relicName !== r.name || loot.relic !== r.id) out.push("reliquary: the relic isn't on its altar");
    }
  }
  return out;
}

export function checkRandomLevels({ count = 1000, p95Budget = 40, from = 0 } = {}) {
  const problems = [], times = [], tally = { themes: {}, gimmicks: {}, bottoms: {} };
  let retries = 0, worstAttempts = 0, twice = 0, sig = 0x811c9dc5;
  const effect = { murals: [0, 0], braziers: [0, 0], spikeworks: [0, 0], flooded: [0, 0], flatland: [0, 0], haunted: [0, 0] };
  for (let k = 0; k < 20; k++) { const { seed, p } = randomParams(100000 + k); generateDungeonLevel(seed, p); }   // warm-up
  for (let i = from; i < from + count; i++) {
    const { seed, p } = randomParams(i);
    const t0 = performance.now();
    const f = generateDungeonLevel(seed, p);
    times.push(performance.now() - t0);
    retries += f.attempts - 1;
    worstAttempts = Math.max(worstAttempts, f.attempts);
    sig = levelSig(f, sig);
    const bad = [...validateDungeonLevel(f, p), ...siteLevelProblems(f, p)];
    if (bad.length) problems.push(`random level ${i} (seed ${seed}, level ${p.level}, ${p.theme}, [${p.gimmicks}], ${p.bottom?.kind || "-"}): ${bad.join(", ")}`);
    tally.themes[p.theme] = (tally.themes[p.theme] || 0) + 1;
    for (const id of p.gimmicks) tally.gimmicks[id] = (tally.gimmicks[id] || 0) + 1;
    if (p.final) tally.bottoms[p.bottom?.kind || "none"] = (tally.bottoms[p.bottom?.kind || "none"] || 0) + 1;
    const did = { murals: !!f.murals?.length, braziers: f.blocks.includes(B.BRAZIER), spikeworks: f.spikes.size > 0,
                  flooded: f.blocks.includes(B.WATER_SHALLOW), flatland: f.creatures.some((c) => c.type === "flatling"),
                  haunted: f.creatures.some((c) => c.type === "shade") };
    for (const id of Object.keys(effect)) if (p.gimmicks.includes(id)) { effect[id][0]++; if (did[id]) effect[id][1]++; }
    if (i % 10 === 0) {   // the same seed and p, the same level
      const again = generateDungeonLevel(seed, p);
      twice++;
      const sig = (z) => JSON.stringify([z.attempts, z.blocks.join(""), z.creatures.map((c) => [c.type, c.tx, c.ty, c.uid]), z.items.map((it) => [it.kind, it.x, it.y])]);
      if (sig(f) !== sig(again)) problems.push(`random level ${i}: two generations differ`);
    }
  }
  for (const [id, [n, done]] of Object.entries(effect))
    if (n && done < 0.9 * n) problems.push(`gimmick ${id}: did something on ${done} of its ${n} levels (want 90%)`);
  for (const id of Object.keys(GIMMICKS)) if (!tally.gimmicks[id]) problems.push(`gimmick ${id} never drawn`);
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = pct(sorted, 0.95);
  if (p95 > p95Budget) problems.push(`generation p95 ${p95.toFixed(1)} ms is over the ${p95Budget} ms budget`);
  const r = (n) => +n.toFixed(2);
  return {
    name: "random site levels", ok: problems.length === 0, problems,
    stats: { levels: times.length, failed: problems.length, retries, worstAttempts, twice, signature: sig.toString(16), gimmicks: Object.keys(GIMMICKS).length,
             effects: Object.fromEntries(Object.entries(effect).map(([k, [n, d]]) => [k, `${d}/${n}`])), tally,
             ms: { mean: r(times.reduce((a, b) => a + b, 0) / times.length), p50: r(pct(sorted, 0.5)), p95: r(p95), max: r(sorted[sorted.length - 1]) } },
  };
}

// --- Every site of both worlds, every level, 5 seeds --------------------------------------------------------
const WORLDS = [["test", TEST_WORLD], ["real", REAL_WORLD]];
// Neither world's regions roll stations yet (C1's data will): checkSites also builds the test world with a station
// chance in every region, so the stations' builder, Cradle and rules are exercised.
const withStations = (def) => ({ ...def, regions: Object.fromEntries(Object.entries(def.regions).map(([id, r]) => [id, { ...r, sites: { ...r.sites, station: 0.05 } }])) });
const SEEDS = [1, 7, 42, 1234, 31337];

export function checkSites({ seeds = SEEDS } = {}) {
  const problems = [], stats = { sites: 0, levels: 0, surfaces: 0, kinds: {}, bottoms: {}, legends: 0, sinkholes: 0, sinkholeSpans: 0 };
  const t0 = performance.now();
  for (const [name, def] of [...WORLDS, ["test with stations", withStations(TEST_WORLD)]]) {
    const W = compileWorld(def);
    for (const seed of seeds) {
      const run = buildRun(seed, W), at = `${name} seed ${seed}`, uids = new Set();
      for (const s of run.sites.values()) {
        stats.sites++;
        stats.kinds[s.kind] = (stats.kinds[s.kind] || 0) + 1;
        const where = `${at} ${s.id}`;
        if (s.kind !== "landmark" && !SITE_KINDS.includes(s.kind)) problems.push(`${where}: kind ${s.kind}`);
        if (["ruin", "lair", "historic", "station"].includes(s.kind) && !SITE_BUILDERS[s.kind]) problems.push(`${where}: no surface builder for ${s.kind}`);
        if (s.kind === "lair" && s.dungeon) {
          const L = s.legend;
          if (!L || s.dungeon.bottom.kind !== "legend" || s.dungeon.bottom.uid !== L.uid) problems.push(`${where}: a lair without its legend at the bottom`);
          else {
            stats.legends++;
            if (uids.has(L.uid)) problems.push(`${where}: legend uid ${L.uid} twice`);
            uids.add(L.uid);
            const bottomLevel = dungeonParams(run, s, s.dungeon.levels).level;
            if (L.level !== bottomLevel + 3) problems.push(`${where}: the legend is level ${L.level}, its bottom ${bottomLevel} (want +3)`);
            if (L.mutations.length > 2 || L.opinions.length < 1 || L.opinions.length > 3) problems.push(`${where}: the legend's mutations or opinions are out of range`);
          }
        }
        if (s.kind === "station" && s.dungeon) problems.push(`${where}: a station with a dungeon`);
        let level1 = null;
        if (s.dungeon) {
          const d = s.dungeon;
          for (const g of [...(d.gimmicks || []), ...(d.floorGimmicks || []).flat()]) if (!GIMMICKS[g]) problems.push(`${where}: unknown gimmick ${g}`);
          for (let z = 1; z <= d.levels; z++) {
            const p = d.legacy ? legacyParams(z, seed) : dungeonParams(run, s, z);
            const f = generateDungeonLevel(d.legacy ? seed : zoneSeed(run, s.at.wx, s.at.wy, z), p);
            stats.levels++;
            if (z === 1) level1 = f;
            const bad = [...validateDungeonLevel(f, p), ...(d.legacy ? [] : siteLevelProblems(f, p))];
            if (bad.length) problems.push(`${where} level ${z} (level ${p.level}): ${bad.join(", ")}`);
            if (p.final && p.bottom) stats.bottoms[p.bottom.kind] = (stats.bottoms[p.bottom.kind] || 0) + 1;
            if (p.final && p.bottom?.kind === "guardian" && !f.creatures.some((c) => c.guardian === p.bottom.id)) problems.push(`${where}: the guardian ${p.bottom.id} isn't in its hall`);
          }
        }
        // Every sinkhole over a site's dungeon (landmarks' too) is on one of the span's spots, and a fall into it lands
        // right under it on level 1, by the fall's own rule (the surface no longer makes level 1 to place them).
        if (s.dungeon && !s.dungeon.legacy && level1) {
          const zone = generateSurface(run, s.at.wx, s.at.wy), r = zone?.dungeonRect, spots = sinkholeSpots(run, s);
          let here = 0;
          if (r) for (let y = 0; y < zone.d; y++) for (let x = 0; x < zone.w; x++) {
            if (zone.get(x, y, 0) || zone.get(x, y, FLOOR_Z - 1)) continue;   // (a sinkhole: open down to the bottom)
            const lx = x - r.ox, ly = y - r.oy, a = arrivalPoint(level1, "fall", { fx: lx + 0.5, fy: ly + 0.5 });
            here++;
            if (!spots.some(([sx, sy]) => sx === lx && sy === ly)) problems.push(`${where}: a sinkhole at (${x}, ${y}) off the span's spots`);
            else if (Math.floor(a.x) !== lx || Math.floor(a.y) !== ly) problems.push(`${where}: a fall into the sinkhole at (${x}, ${y}) lands at (${Math.floor(a.x)}, ${Math.floor(a.y)}) on level 1, not (${lx}, ${ly})`);
          }
          stats.sinkholes += here;
          if (here) stats.sinkholeSpans++;
        }
        // A landmark dungeon's floors draw its own inhabitants, registered ones, before the region's (integrator, C1b #19).
        if (s.kind === "landmark" && s.dungeon && !s.dungeon.legacy && s.dungeon.creatures) {
          for (let z = 1; z <= Math.min(2, s.dungeon.levels); z++) {
            const p = dungeonParams(run, s, z), c = s.dungeon.creatures, rows = (Array.isArray(c) ? c : c[z % 2 ? "odd" : "even"]).filter(([t]) => CREATURE_TYPES[t]);
            const own = new Set(rows.map(([t]) => t)), table = (p.creatureTable || []).map((r) => (Array.isArray(r) ? r[0] : r));
            stats.ownTables = (stats.ownTables || 0) + 1;
            if (rows.length && (table.length !== own.size || table.some((t) => !own.has(t)))) problems.push(`${where} floor ${z}: draws ${table.join(", ")}, not its own ${[...own].join(", ")}`);
          }
        }
        if (s.kind !== "landmark") {
          const zone = generateSurface(run, s.at.wx, s.at.wy);
          stats.surfaces++;
          const bad = validateSurface(zone);
          if (bad.length) problems.push(`${where} surface: ${bad.join(", ")}`);
          if (!!s.dungeon !== !!zone.entrance) problems.push(`${where} surface: ${s.dungeon ? "no entrance over its dungeon" : "an entrance with no dungeon"}`);
          if (s.kind === "station" && !(zone.cradle && zone.get(zone.cradle.x, zone.cradle.y, FLOOR_Z) === B.STATION)) problems.push(`${where} surface: no Truing Cradle`);
        }
      }
    }
  }
  if (!stats.kinds.station) problems.push("no station was built (the stations' world rolls none)");
  // 20,000 legends' names: none holds a term of bible §15.11 (tests/checks/names.js DENY), even inside a word.
  const terms = DENY.filter((d) => d.from === "§15.11").map((d) => d.term.toLowerCase().replace(/[^a-z]/g, "")).filter((t) => t.length >= 3);
  const nrng = makeRng(seedFor(77, "legend names")), bad = new Set();
  for (let k = 0; k < 20000; k++) { const L = makeLegend(nrng, { id: `n${k}` }, 5), low = L.name.toLowerCase(); if (terms.some((t) => low.includes(t))) bad.add(L.name); }
  stats.legendNames = `20000, ${bad.size} with a banned term`;
  if (bad.size) problems.push(`legend names with a bible §15.11 term in them: ${[...bad].slice(0, 5).join(", ")}`);
  stats.ms = Math.round(performance.now() - t0);
  return { name: "sites", ok: problems.length === 0, problems, stats };
}

// --- History's site requests (the P0 fixture: two Hours, two requests, one relic) ---------------------------
export function checkHistoric({ seeds = SEEDS } = {}) {
  const problems = [], stats = { built: 0, floors: 0, named: 0, relics: 0, trueMarks: 0, trueMarkItems: 0, murals: 0 };
  // While WS5's "credit" kind isn't registered here, a stand-in for one level shows the piles are laid when it is.
  if (!ITEM_KINDS.credit) {
    ITEM_KINDS.credit = { name: () => "true-mark", glyph: () => ["¶", [255, 255, 255]] };
    try {
      const f = generateDungeonLevel(5, { ...legacyParams(4, 5), final: true, forcedVault: null, bottom: { kind: "relic", id: null, relic: null, trueMarks: [3, 3, 2] } });
      const piles = f.items.filter((o) => o.kind === "credit").map((o) => o.count);
      stats.standIn = `piles ${JSON.stringify(piles)} with a credit kind registered`;
      if (JSON.stringify(piles) !== "[3,3,2]") problems.push(`with a credit kind, the reliquary's true-mark piles are ${JSON.stringify(piles)}, want [3,3,2]`);
    } finally { delete ITEM_KINDS.credit; }
  }
  for (const [name, def] of WORLDS) {
    const W = compileWorld(def);
    for (const seed of seeds) {
      const run = buildRun(seed, W);
      for (const req of run.history.siteRequests) {
        const s = run.sites.get(req.id), at = `${name} seed ${seed} ${req.id}`;
        if (!s) { problems.push(`${at}: not placed`); continue; }
        stats.built++;
        const t = W.tileAt(s.at.wx, s.at.wy), ruler = run.history.rulers.find((r) => r.id === req.rulerId);
        if (s.kind !== "historic" || s.name !== req.name || s.historyRef?.eventId !== req.eventId) problems.push(`${at}: not the request's site`);
        if (t.tier !== req.tier) problems.push(`${at}: on a tier-${t.tier} span, asked for ${req.tier}`);
        if (name === "test" && !req.regionPrefs.includes(t.region)) problems.push(`${at}: in ${t.region}, not one of ${req.regionPrefs}`);
        const d = s.dungeon;
        if (d.levels !== req.floors || d.named?.length !== d.levels) problems.push(`${at}: ${d.levels} floors (asked ${req.floors}), ${d.named?.length} names`);
        const leaning = DUNGEONS.leanings[DUNGEONS.domains[ruler.domains[0]]];
        if (d.theme !== leaning.theme) problems.push(`${at}: theme ${d.theme}, its Hour's leaning says ${leaning.theme}`);
        for (let z = 1; z <= d.levels; z++) {
          const p = dungeonParams(run, s, z), f = generateDungeonLevel(zoneSeed(run, s.at.wx, s.at.wy, z), p);
          stats.floors++;
          if (p.level !== 3 * t.tier - 1 + z) problems.push(`${at} floor ${z}: level ${p.level}, want the surface level + ${z}`);
          if (JSON.stringify(p.gimmicks) !== JSON.stringify(z % 2 ? leaning.odd : leaning.even)) problems.push(`${at} floor ${z}: gimmicks ${p.gimmicks}`);
          if (!/^the /.test(f.name) && !f.name.startsWith(req.name)) problems.push(`${at} floor ${z}: name "${f.name}"`);
          if (/^the /.test(f.name)) stats.named++;
          if (p.gimmicks.includes("murals") && f.murals?.length) {
            stats.murals++;
            const texts = new Set(ruler.events.flatMap((e) => [e.text.inscription, e.text.gospel, e.text.hostile]));
            if (!f.murals.every((m) => texts.has(m.text))) problems.push(`${at} floor ${z}: a mural that isn't the Hour's account`);
            // All three accounts (bible §8.5, since the WS7a merge): the relief in 3D, the tablet on the map, the Dark Gloss.
            const views = new Set(f.murals.map((m) => m.view));
            if (!views.has("dark") || ![...f.murals].some((m) => m.view === "dark" && ruler.events.some((e) => e.text.hostile === m.text) && f.get(m.x, m.y, m.z) === B.RUNE))
              problems.push(`${at} floor ${z}: no Dark Gloss among its murals (${[...views].join(", ")})`);
            else stats.glosses = (stats.glosses || 0) + 1;
          }
          if (z === d.levels) {
            const loot = f.bottomLoot || {};
            const marks = DUNGEONS.trueMarks[t.tier];
            if (f.vault.name !== "The Reliquary" || JSON.stringify(loot.trueMarks) !== JSON.stringify(marks)) problems.push(`${at}: the bottom isn't a reliquary with ${JSON.stringify(marks)} true-marks`);
            else stats.trueMarks += marks.reduce((a, b) => a + b, 0);
            // The true-marks themselves lie there once WS5's "credit" kind is registered (BOTTOM_LOOT.trueMark).
            const piles = f.items.filter((o) => o.kind === "credit").map((o) => o.count);
            if (ITEM_KINDS.credit ? JSON.stringify(piles) !== JSON.stringify(marks) : piles.length) problems.push(`${at}: true-mark piles ${JSON.stringify(piles)}, want ${ITEM_KINDS.credit ? JSON.stringify(marks) : "none (no credit kind)"}`);
            stats.trueMarkItems += piles.reduce((a, b) => a + b, 0);
            if (req.relicId) {
              const relic = run.history.relics.find((r) => r.id === req.relicId), it = f.items.find((o) => o.histRelic === req.relicId);
              if (!it || it.relicName !== relic.name || it.kind !== relic.base.kind) problems.push(`${at}: the relic ${req.relicId} isn't on the altar`);
              else stats.relics++;
            } else if (loot.relic) problems.push(`${at}: a relic where history placed none`);
          }
        }
        const zone = generateSurface(run, s.at.wx, s.at.wy), ev = ruler.events.find((e) => e.id === req.eventId);
        if (!zone.murals?.some((m) => m.view === "3d" && m.text === ev.text.inscription) || !zone.murals?.some((m) => m.view === "map" && m.text === ev.text.gospel))
          problems.push(`${at}: the surface doesn't carry the event's inscription (3D) and gospel (map)`);
      }
    }
  }
  return { name: "historic sites", ok: problems.length === 0, problems, stats };
}

// --- The landmark dungeons' bottoms, halls and murals (B2: C1b #5, #6, #7) -----------------------------------------
// On the real world, every seed: each landmark dungeon's last floor holds what the bible puts there (C1b's planned.bottom)
// where the code builds it: the Grub Mother (a legend from the data, her species, name and level, in her lair, never
// roaming), the Press-hall (its spot, three pistons on gantries 3, 4 and 5 up, each struck from its gantry's top), Noon's
// floor (lampless, the shadowless woman in mosaic), the Noonglass's reliquary (the altar; the artifact named, laid once its
// kind is in), the Under-Page's founding relic (the Second Hour's, which no Hour site holds) with that Hour's three
// accounts, the Noon Socket (twelve hour platforms 1-3 up, all reachable), the Datum stone (its plinth 2 up, reachable,
// the stone at eye height there); the Metronome keeps the Colossus's hall until the Escapement's kind is in. Halls on a
// floor that isn't the last: Kettle Mesa's 2 the Flat Lie, the Under-Page's 2 the Speaking Door, the Unlit Choir's 4 the
// Gloam Warden's hall (C3's Gloam Warden in it, its gate opening when it dies), and no other floor of theirs forced. The
// Datum's floors carry its own mural. In a game: the Grub Mother lives in one zone; the Gloam Warden's death opens its gate.
export async function checkLandmarkBottoms({ seeds = SEEDS } = {}) {
  const problems = [], stats = { bottoms: {}, halls: 0, murals: 0, pistons: 0, hours: 0 };
  const expect = (ok, what) => { if (!ok) problems.push(what); };
  const W = compileWorld(REAL_WORLD);
  const reach = (f) => reachable(standWith(f, "all"), f.w, f.d, Math.floor(f.spawn.x), Math.floor(f.spawn.y), PLAYER_STEP_UP, PLAYER_DROP);
  const WANT = { kettleMesa: "legend", datum: "reading", press: "boss", unlitChoir: "boss", metronome: "guardian", drownedLantern: "relic", dialWorks: "boss", underPage: "relic" };
  const HALLS = { kettleMesa: { 2: "The Flat Lie" }, underPage: { 2: "The Speaking Door" }, unlitChoir: { 4: "The Gloom Warden's Hall" } };
  for (const seed of seeds) {
    const run = buildRun(seed, W);
    for (const s of run.sites.values()) {
      if (s.kind !== "landmark" || !s.dungeon || s.dungeon.legacy) continue;
      const d = s.dungeon, id = d.id, at = `real world seed ${seed} ${id}`, n = d.levels;
      const level = (z) => { const p = dungeonParams(run, s, z); return { p, f: generateDungeonLevel(zoneSeed(run, s.at.wx, s.at.wy, z), p) }; };
      // Halls on the floors above the last.
      for (let z = 1; z < n; z++) {
        const p = dungeonParams(run, s, z), want = HALLS[id]?.[z] || null;
        expect(!!p.forcedVault === !!want, `${at} floor ${z}: forced vault ${p.forcedVault}, want ${want}`);
        if (!want) continue;
        const { f } = level(z);
        stats.halls++;
        expect(f.vault.name === want && !validateDungeonLevel(f, p).length, `${at} floor ${z}: its hall is ${f.vault.name} (${validateDungeonLevel(f, p)}), want ${want}`);
        if (id === "unlitChoir") expect(f.guardianHall?.type === "gloamWarden" && f.creatures.some((c) => c.type === "gloamWarden") && !f.creatures.some((c) => c.type === "warden") && f.guardianHall.gate.length,
          `${at} floor ${z}: the Gloam Warden isn't in its hall behind a gate (${f.guardianHall?.type})`);
      }
      if (id === "datum") for (let z = 1; z <= n; z++) {
        const { f } = level(z);
        stats.murals++;
        expect(f.murals?.some((m) => m.text === "THIS SILL IS 3 BLOCKS UP.") && f.murals.some((m) => m.text === "A brass plate set in the floor, numbered 3."), `${at} floor ${z}: not the Datum's own murals (${(f.murals || []).map((m) => m.text)})`);
      }
      // The bottom.
      const { p, f } = level(n), dist = reach(f), on = (x, y) => dist[x + y * f.w] >= 0, kind = p.bottom?.kind;
      stats.bottoms[kind] = (stats.bottoms[kind] || 0) + 1;
      expect(kind === (WANT[id] || undefined) || (!WANT[id] && !p.bottom), `${at}: its bottom is ${kind}, want ${WANT[id]}`);
      expect(!validateDungeonLevel(f, p).length, `${at} bottom: ${validateDungeonLevel(f, p)}`);
      if (id === "kettleMesa") {
        const L = s.legend, c = f.creatures.find((o) => o.uid === L?.uid);
        expect(L && L.species === "brineGrub" && L.name === "the Grub Mother" && L.level === p.level + 3 && c?.name === "the Grub Mother" && c.type === "brineGrub" && c.flags?.legend,
          `${at}: the Grub Mother (${JSON.stringify(L && { species: L.species, name: L.name, level: L.level })}, ${c?.name})`);
        expect(!run.legends.has(L?.uid) && legendOf(run, L?.uid) === L, `${at}: the Grub Mother roams (run.legends) or can't be found (legendOf)`);
      }
      if (id === "press") {
        const ps = f.pistons || [];
        stats.pistons += ps.length;
        expect(f.bossSpot?.id === "pressMaster" && on(f.bossSpot.x, f.bossSpot.y), `${at}: the Press-Master's spot ${JSON.stringify(f.bossSpot)}`);
        expect(JSON.stringify(ps.map((q) => q.gantry).sort()) === "[3,4,5]" && ps.every((q) => f.get(q.x, q.y, q.z) === B.METAL && f.get(q.x, q.y, q.z + 1) === B.METAL
          && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => f.stand[q.x + dx + (q.y + dy) * f.w] === q.z && on(q.x + dx, q.y + dy))), `${at}: the pistons ${JSON.stringify(ps)}`);
        expect(f.vault.name === "The Press-hall" && f.vault.y1 - f.vault.y0 >= 14, `${at}: not the Press-hall`);
      }
      if (id === "unlitChoir") {
        const v = f.vault, gold = (() => { let k = 0; for (let y = v.y0; y <= v.y1; y++) for (let x = v.x0; x <= v.x1; x++) if (f.get(x, y, FLOOR_Z - 1) === B.MOSAIC_GOLD) k++; return k; })();
        let lamps = 0;
        for (let y = v.y0 - 1; y <= v.y1 + 1; y++) for (let x = v.x0 - 1; x <= v.x1 + 1; x++) for (let z = 0; z < f.h; z++) if (f.get(x, y, z) === B.LAMP) lamps++;
        expect(f.bossSpot?.id === "noon" && on(f.bossSpot.x, f.bossSpot.y) && gold >= 20 && !lamps && !BOSS_HALLS.noon.plan.join("").includes("l"),
          `${at}: Noon's floor (spot ${JSON.stringify(f.bossSpot)}, ${gold} gold tiles, ${lamps} lamps; the hall's own plan lampless)`);
      }
      if (id === "dialWorks") {
        const plats = (f.hours || []).map((h) => f.stand[h.x + h.y * f.w] === h.z && on(h.x, h.y));
        stats.hours += plats.filter(Boolean).length;
        expect(f.bossSpot?.id === "vesper" && on(f.bossSpot.x, f.bossSpot.y) && plats.length === 12 && plats.every(Boolean), `${at}: the Noon Socket (spot ${JSON.stringify(f.bossSpot)}, ${plats.filter(Boolean).length} of ${plats.length} hours reachable)`);
      }
      if (id === "drownedLantern") {
        const loot = f.bottomLoot || {}, laid = f.items.find((o) => o.kind === "artifact" && o.id === "noonglass");
        expect(loot.artifact?.id === "noonglass" && loot.artifact.laid === !!laid && f.items.some((o) => f.get(Math.floor(o.x), Math.floor(o.y), FLOOR_Z) === B.ALTAR), `${at}: the Noonglass's altar (${JSON.stringify(loot.artifact)})`);
      }
      if (id === "underPage") {
        const ruler = run.history.rulers[1], held = new Set(run.history.siteRequests.map((r) => r.relicId)), it = f.items.find((o) => o.histRelic);
        const relic = run.history.relics.find((r) => r.id === it?.histRelic);
        expect(relic && relic.rulerId === ruler.id && !held.has(relic.id) && f.bottomLoot?.relic === relic.id, `${at}: the founding relic ${it?.histRelic} (the Second Hour is ${ruler.id})`);
        const texts = new Set(ruler.events.flatMap((e) => [e.text.inscription, e.text.gospel, e.text.hostile]));
        expect(f.murals?.length && f.murals.every((m) => texts.has(m.text)) && new Set(f.murals.map((m) => m.view)).size === 3, `${at}: the Second-Hour stele's accounts (${(f.murals || []).map((m) => m.view)})`);
      }
      if (id === "datum") {
        const st = f.datumStone;
        expect(st && f.stand[st.x + st.y * f.w] === FLOOR_Z + 2 && on(st.x, st.y) && f.get(...st.stone) === B.MURAL && st.stone[2] === st.z + 1, `${at}: the Datum stone ${JSON.stringify(st)}`);
      }
      if (id === "metronome") expect(f.creatures.some((c) => c.guardian === "colossus"), `${at}: the Colossus's hall (the Escapement waits for its kind)`);
      // Its places (C1b #20, #22, #24): the clue's fresh tunnel, the captive's spot, the Square's identical rooms and prisoners,
      // the Root Canals' far mouth.
      if (id === "kettleMesa") {
        const { f: f3 } = level(3), c = f3.clue, d3 = reach(f3), t = c?.tunnel || [];
        const open4 = ([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => f3.stand[x + dx + (y + dy) * f3.w] >= 0).length;
        stats.clues = (stats.clues || 0) + (c ? 1 : 0);
        expect(c && /plumb-seal/.test(c.what) && t.length >= 5 && t.length <= 7 && t.every(([x, y]) => f3.get(x, y, FLOOR_Z - 1) === B.DIRT && d3[x + y * f3.w] >= 0)
          && c.x === t[t.length - 1][0] && c.y === t[t.length - 1][1] && open4([c.x, c.y]) === 1, `${at} floor 3: the sapper tunnel and its clue ${JSON.stringify(c && { x: c.x, y: c.y, len: t.length })}`);
      }
      if (id === "press") {
        const { f: f3 } = level(3), d3 = reach(f3), c = f3.captive;
        expect(c?.who === "toviHallen" && d3[c.x + c.y * f3.w] >= 0 && f3.stand[c.x + c.y * f3.w] === FLOOR_Z, `${at} floor 3: Tovi Hallen's place ${JSON.stringify(c)}`);
        for (const z of [1, 2, 4, 5]) expect(!level(z).f.captive, `${at} floor ${z}: a captive's place on the wrong floor`);
      }
      if (id === "square") for (let z = 1; z <= n; z++) {
        const { f: fz } = z === n ? { f } : level(z), marks = fz.roomMarks || [], dz = reach(fz);
        stats.squareRooms = (stats.squareRooms || 0) + fz.rooms.length;
        expect(new Set(fz.rooms.map((r) => `${r.theme.wall},${r.theme.floor}`)).size === 1 && marks.length >= fz.rooms.length - 1 && new Set(marks.map((m) => m.mark.join())).size === marks.length
          && marks.every((m) => m.mark.every((c, d) => BLOCKS[fz.get(m.x + d, m.y, FLOOR_Z - 1)]?.mosaic)), `${at} floor ${z}: ${fz.rooms.length} rooms, ${marks.length} marks, materials ${new Set(fz.rooms.map((r) => `${r.theme.wall},${r.theme.floor}`)).size}`);
        const pr = fz.prisoners || [];
        stats.prisoners = (stats.prisoners || 0) + pr.length;
        expect(z === 1 ? !pr.length : pr.length === 2 && pr.every((q) => dz[q.x + q.y * fz.w] >= 0 && fz.get(...q.wheel) === B.LEVER && fz.links.get(fz.index(...q.wheel))?.action === "unpress"),
          `${at} floor ${z}: prisoners ${JSON.stringify(pr)}`);
      }
      if (id === "rootCanals") {
        const e = f.exit, surf = generateSurface(run, s.at.wx, s.at.wy), sr = reach(surf);
        expect(e && f.get(e.x, e.y, FLOOR_Z - 1) === B.STAIRS_UP && on(e.x, e.y) && e.key === `${s.at.wx},${s.at.wy},0` && surf.get(e.at[0], e.at[1], FLOOR_Z - 1) === B.METAL
          && sr[e.at[0] + e.at[1] * surf.w] >= 0 && e.at[0] > surf.gen.planAt.x + 57, `${at} floor 2: the far mouth ${JSON.stringify(e)} (out on the grate east of the checkpoint)`);
        expect(!level(1).f.exit, `${at} floor 1: a far mouth on the wrong floor`);
      }
    }
  }
  // The founding relic is one no Hour site holds, the mask first (a made-up history where the mask is a site's).
  const fake = { history: { rulers: [{ id: "h1" }, { id: "h2" }], siteRequests: [{ relicId: "mask" }],
    relics: [{ id: "lost", rulerId: "h2", lostAt: {} }, { id: "free", rulerId: "h2" }, { id: "mask", rulerId: "h2", mask: true }, { id: "other", rulerId: "h1", mask: true }] } };
  expect(hourRelic(fake, 2)?.id === "free" && hourRelic({ history: { ...fake.history, siteRequests: [] } }, 2)?.id === "mask" && hourRelic(fake, 3) === null,
    `the founding relic's rule: ${hourRelic(fake, 2)?.id}, ${hourRelic({ history: { ...fake.history, siteRequests: [] } }, 2)?.id}`);
  // In a game: the Grub Mother claimed by her lair, once; the Gloam Warden's death opens its hall's gate.
  const { game, startRun } = await import("../../src/game.js");
  const { uidWhere } = await import("../../src/zones.js");
  const { killMonster } = await import("../../src/monsters.js");
  startRun(seeds[0], REAL_WORLD);
  const km = [...game.run.sites.values()].find((s) => s.landmarkId === "kettleMesa"), deep = `${km.at.wx},${km.at.wy},${km.dungeon.levels}`;
  game.debug.enterZone(deep);
  const gm = game.zone.creatures.filter((c) => km.legend && c.uid === km.legend.uid);
  expect(game.zone.key === deep && gm.length === 1 && uidWhere(game, km.legend?.uid) === deep, `in a game: the Grub Mother ${gm.length} in ${game.zone.key}, claimed by ${uidWhere(game, km.legend?.uid)}`);
  const uc = [...game.run.sites.values()].find((s) => s.landmarkId === "unlitChoir"), hallKey = `${uc.at.wx},${uc.at.wy},4`;
  game.debug.enterZone(hallKey);
  const hall = game.zone.guardianHall, warden = game.zone.creatures.find((c) => c.type === "gloamWarden");
  if (hall && warden) {
    const shut = hall.gate.filter(([x, y, z]) => game.zone.get(x, y, z) === B.GATE).length;
    killMonster(game, warden, "", true, true);
    const open = hall.gate.every(([x, y, z]) => game.zone.get(x, y, z) === B.AIR);
    stats.wardenGate = `${shut} gate blocks shut, ${open ? "open" : "still shut"} after its death`;
    expect(shut > 0 && open, `in a game: the Gloam Warden's gate (${stats.wardenGate})`);
  } else problems.push(`in a game: no Gloam Warden's hall on ${hallKey}`);
  // In a game: a press-wheel turns only in 3D, and frees its prisoner (C1b #20); the far mouth comes out on Molar's grate (#22).
  const { useColumn } = await import("../../src/interact.js"), { on } = await import("../../src/events.js"), { checkFloorEvents } = await import("../../src/screens/play.js");
  const sq = [...game.run.sites.values()].find((s) => s.landmarkId === "square");
  game.debug.enterZone(`${sq.at.wx},${sq.at.wy},2`);
  const q = game.zone.prisoners?.[0], freed = [];
  const off = on("prisoner:freed", (g, ev) => freed.push(ev.k));
  if (q) {
    game.view = "map";
    const onMap = useColumn(game, q.wheel[0], q.wheel[1]);
    const mapFreed = q.freed;
    game.view = "3d";
    const in3d = useColumn(game, q.wheel[0], q.wheel[1]);
    stats.wheel = `map: ${onMap ? "turned" : "refused"}, 3D: ${in3d ? "turned" : "refused"}, freed ${q.freed}, events ${freed}`;
    expect(!onMap && !mapFreed && in3d && q.freed && freed.join() === "0" && game.zone.get(...q.wheel) === B.LEVER_ON, `in a game: the press-wheel (${stats.wheel})`);
  } else problems.push("in a game: no prisoner on the Square's floor 2");
  off?.();
  const mo = [...game.run.sites.values()].find((s) => s.landmarkId === "molar");
  game.debug.enterZone(`${mo.at.wx},${mo.at.wy},2`);
  const ex = game.zone.exit, pl = game.player;
  if (ex) {
    Object.assign(pl, { x: ex.x + 0.5, y: ex.y + 0.5, z: FLOOR_Z, onGround: true, vz: 0 });
    checkFloorEvents(game);
    stats.farMouth = `${game.zone.key} at (${Math.floor(pl.x)}, ${Math.floor(pl.y)}), the grate (${ex.at})`;
    expect(game.zone.key === ex.key && Math.abs(pl.x - ex.at[0] - 0.5) + Math.abs(pl.y - ex.at[1] - 0.5) <= 2, `in a game: up the far mouth to ${stats.farMouth}`);
  } else problems.push("in a game: no far mouth on the Root Canals' floor 2");
  // In a game: Folio's drawn door on the map takes you into the archive and back out; a drawn wall holds you (C1b #12).
  const { mapStep } = await import("../../src/turns.js");
  const fo = game.run.world.landmarks.get("folio");
  game.debug.enterZone(`${fo.wx},${fo.wy},0`);
  game.view = "map";
  const fd = game.zone.drawnDoors?.[0];
  if (fd) {
    const put = ([x, y]) => Object.assign(pl, { x: x + 0.5, y: y + 0.5, z: game.zone.stand[x + y * game.zone.w], onGround: true });
    const dir = (a, b) => [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
    put(fd.outside);
    const inOk = mapStep(game, ...dir(fd.outside, fd.wall)) && Math.floor(pl.x) === fd.inside[0] && Math.floor(pl.y) === fd.inside[1];
    const outOk = mapStep(game, ...dir(fd.inside, fd.wall)) && Math.floor(pl.x) === fd.outside[0] && Math.floor(pl.y) === fd.outside[1];
    const w = game.zone.mapWalls[0], wx = w % game.zone.w, wy = Math.floor(w / game.zone.w);
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => game.zone.stand[wx + dx + (wy + dy) * game.zone.w] >= 0 && !game.zone.mapWalls.includes(wx + dx + (wy + dy) * game.zone.w));
    put([wx + nb[0], wy + nb[1]]);
    const held = !mapStep(game, -nb[0], -nb[1]) && Math.floor(pl.x) === wx + nb[0];
    stats.drawnDoor = `in ${inOk}, out ${outOk}, a drawn wall holds ${held}`;
    expect(inOk && outOk && held, `in a game: Folio's drawn door (${stats.drawnDoor})`);
  } else problems.push("in a game: Folio has no drawn door");
  // In a game: the Unlit Choir's rune doors (C1b #26) open only with your torch out, on the map and in 3D; its floors have
  // them, every door a rune door with its rune over it.
  const choir = game.run.world.landmarks.get("unlitChoir");
  game.debug.enterZone(`${choir.wx},${choir.wy},1`);
  const cz = game.zone, rd = cz.runeDoors || [];
  const doorsAll = []; for (let i = 0; i < cz.w * cz.d; i++) if (cz.get(i % cz.w, Math.floor(i / cz.w), FLOOR_Z) === B.DOOR) doorsAll.push(i);
  if (rd.length) {
    const i = rd[0], x = i % cz.w, y = Math.floor(i / cz.w);
    const tries = [];
    for (const [view, torch] of [["map", true], ["3d", true], ["map", false]]) {
      game.view = view; pl.torch = torch;
      if (cz.get(x, y, FLOOR_Z) !== B.DOOR) { cz.set(x, y, FLOOR_Z, B.DOOR); cz.set(x, y, FLOOR_Z + 1, B.DOOR); }
      tries.push(!!useColumn(game, x, y) && cz.get(x, y, FLOOR_Z) === B.AIR);
    }
    pl.torch = true;
    stats.runeDoors = `${rd.length} rune doors of ${doorsAll.length} doors on floor 1; lit on the map ${tries[0]}, lit in 3D ${tries[1]}, dark ${tries[2]}`;
    expect(doorsAll.every((k) => rd.includes(k)) && rd.every((k) => cz.get(k % cz.w, Math.floor(k / cz.w), FLOOR_Z + 2) === B.RUNE) && JSON.stringify(tries) === "[false,false,true]",
      `in a game: the rune doors (${stats.runeDoors})`);
  } else problems.push("in a game: no rune doors on the Unlit Choir's floor 1");
  // The Gnomon's door (C1b #26, #10): shut over the stair at 09:00 and 14:00, open from 11:00 to 13:00 (by the clock while
  // you stand there); outside them the Cube turned on the threshold opens it for good for 10 max HP (asked first), the
  // Plumb Key opens it for nothing, and with neither it stays shut.
  const { maxHp } = await import("../../src/stats.js"), { catchUp } = await import("../../src/clock.js");
  const gn = game.run.world.landmarks.get("gnomon"), gk = `${gn.wx},${gn.wy},0`;
  const atHour = (h) => { game.time = (h - 6) * 60 + 24 * 60 * Math.floor((game.time + 1) / (24 * 60)); };
  const gnomonDoor = (h, setup) => {
    startRun(seeds[0], REAL_WORLD); game.story.cube = false; atHour(h); setup?.();
    game.debug.enterZone(gk);
    return game.zone.needleDoor;
  };
  const shut = (d) => d && d.cells.every(([x, y]) => game.zone.get(x, y, FLOOR_Z) === B.GATE);
  const g9 = shut(gnomonDoor(9)), g12 = !shut(gnomonDoor(12)), g14 = shut(gnomonDoor(14));
  // the clock turning while you stand there
  const d = gnomonDoor(10);
  const before = shut(d);
  game.clockSeen = game.time; game.time += 60 + 1; catchUp(game);   // past 11:00
  const opened = !shut(d);
  game.time += 2 * 60; catchUp(game);   // past 13:00
  const closed = shut(d);
  // its keys, at 14:00
  const dc = gnomonDoor(14, () => { game.story.cube = true; }), hp0 = maxHp(game.player), [cx, cy] = dc.cells[0];
  game.view = "map";
  const ask = useColumn(game, cx, cy), asked = shut(dc) && maxHp(game.player) === hp0;
  game.time += 1; useColumn(game, cx, cy);
  const cube = !shut(dc) && dc.forGood && dc.how === "cube" && maxHp(game.player) === hp0 - 10;
  const dk = gnomonDoor(14, () => { game.player.inv.push({ kind: "quest", id: "plumbKey", name: "the Plumb Key" }); }), hk = maxHp(game.player);
  useColumn(game, ...dk.cells[0]);
  const key = !shut(dk) && dk.how === "plumbKey" && maxHp(game.player) === hk;
  const dn = gnomonDoor(14);
  useColumn(game, ...dn.cells[0]); useColumn(game, ...dn.cells[0]);
  const none = shut(dn);
  stats.gnomonDoor = { g9, g12, g14, clock: before && opened && closed, asked: !ask && asked, cube, key, none };
  expect(Object.values(stats.gnomonDoor).every(Boolean), `in a game: the Gnomon's door ${JSON.stringify(stats.gnomonDoor)}`);
  return { name: "landmark bottoms", ok: problems.length === 0, problems, stats };
}

// --- A legend lives in exactly one zone (zones.js claimUid; guardians.js on zone:prepare) ---------------------
export async function checkLegends({ seed = 7 } = {}) {
  const problems = [], stats = {};
  const { game, startRun } = await import("../../src/game.js");
  const { addZonePatch, uidWhere, killUid } = await import("../../src/zones.js");
  const count = (uid) => { let n = 0; for (const z of game.zones.values()) n += z.creatures.filter((c) => c.uid === uid).length; return n; };
  const go = (key) => { game.debug.enterZone(key); if (game.zone.key !== key) problems.push(`couldn't enter ${key}`); };
  startRun(seed, TEST_WORLD);
  const lair = [...game.run.sites.values()].find((s) => s.kind === "lair" && s.legend && s.dungeon.levels > 1);
  if (!lair) return { name: "legends", ok: false, problems: [`seed ${seed}: no lair of two floors or more on the test world`], stats };
  const L = lair.legend, deep = `${lair.at.wx},${lair.at.wy},${lair.dungeon.levels}`, top = `${lair.at.wx},${lair.at.wy},${lair.dungeon.levels - 1}`;
  const surface = `${lair.at.wx},${lair.at.wy},0`;
  stats.legend = `${L.name} ${L.epithet} (${L.template}, ${L.species}, level ${L.level}) in ${lair.name}`;
  // The run knows every lair's owner by uid (world/run.js's legends step, since the WS10 merge).
  const owners = [...game.run.sites.values()].filter((s) => s.legend);
  if (owners.some((s) => game.run.legends.get(s.legend.uid) !== s.legend) || game.run.legends.size !== owners.length) problems.push(`run.legends: ${game.run.legends.size} of ${owners.length} lairs' owners`);
  // 1. In its lair: there, once, claimed by the lair, in its looks.
  go(deep);
  const c = game.zone.creatures.find((o) => o.uid === L.uid);
  if (!c || uidWhere(game, L.uid) !== deep || count(L.uid) !== 1) problems.push(`in its lair: present ${!!c}, claimed by ${uidWhere(game, L.uid)}, ${count(L.uid)} in memory`);
  if (c && JSON.stringify(c.color) !== JSON.stringify([235, 90, 235])) problems.push("in its lair: not in the legends' magenta");
  // The log names it without an article (WS10 #12, at the merge): "You hit Zhadran the Beatkeeper", a goblin still "the goblin".
  if (c) {
    const { combatLine } = await import("../../src/combat.js"), { STATUS_DEFS } = await import("../../src/status.js");
    const gob = { name: "goblin" }, spec = { kind: "melee" };
    const lines = [combatLine(game, { att: game.player, tgt: c, hit: true, dmg: 3, mult: 1 }, spec), combatLine(game, { att: c, tgt: gob, hit: false }, { kind: "natural" }),
                   STATUS_DEFS.burning.killed(c), combatLine(game, { att: game.player, tgt: gob, hit: true, dmg: 3, mult: 1 }, spec)];
    stats.namedLines = lines.join(" | ");
    if (lines[0] !== `You hit ${c.name} for 3.` || lines[1] !== `${c.name} misses the goblin.` || lines[2] !== `${c.name} burns to ashes.` || lines[3] !== "You hit the goblin for 3.") problems.push(`the log's names: ${stats.namedLines}`);
  }
  // 2. Up and back: still one.
  go(top); go(deep);
  if (count(L.uid) !== 1 || uidWhere(game, L.uid) !== deep) problems.push(`after leaving and coming back: ${count(L.uid)} of it, claimed by ${uidWhere(game, L.uid)}`);
  // 3. Killed: gone for good.
  killUid(game, L.uid);
  game.zone.creatures = game.zone.creatures.filter((o) => o.uid !== L.uid);
  go(top); go(deep);
  if (count(L.uid) !== 0) problems.push(`a dead legend came back (${count(L.uid)})`);
  // 4. Met on the road first (a patch claims it elsewhere): the lair's bottom is empty of it.
  startRun(seed, TEST_WORLD);
  const road = game.zone.key;
  addZonePatch(game, road, { op: "spawnCreature", type: L.species, uid: L.uid, level: L.level, relativeTo: "arrival", dist: [3, 6] });
  go(surface); go(road);
  const met = uidWhere(game, L.uid);
  go(deep);
  const inLair = game.zone.creatures.some((o) => o.uid === L.uid);
  if (met !== road || count(L.uid) !== 1 || inLair) problems.push(`met on the road first: claimed by ${met}, ${count(L.uid)} in memory, in the lair ${inLair}`);
  // 5. A follower takes its home along (WS8's zone:leave brings it, since the WS10 merge: the check used to move it by
  // hand): one of it wherever you go, claimed where it is; back down with you it is the follower, not a second one;
  // left behind upstairs, the lair makes none.
  startRun(seed, TEST_WORLD);
  go(deep);
  const f = game.zone.creatures.find((o) => o.uid === L.uid);
  if (f) {
    f.brain = { ...(f.brain || {}), leader: "player" };
    go(top); go(surface); go(top);
    if (uidWhere(game, L.uid) !== top || count(L.uid) !== 1 || !game.zone.creatures.includes(f)) problems.push(`a following legend: claimed by ${uidWhere(game, L.uid)}, ${count(L.uid)} in memory`);
    go(deep);
    const here = game.zone.creatures.filter((o) => o.uid === L.uid);
    if (count(L.uid) !== 1 || here.length !== 1 || here[0] !== f || uidWhere(game, L.uid) !== deep) problems.push(`back in its lair with you: ${here.length} of it there (the follower ${here[0] === f}), ${count(L.uid)} in memory, claimed by ${uidWhere(game, L.uid)}`);
    go(top);
    f.brain.leader = undefined;   // it stays upstairs
    go(deep);
    if (game.zone.creatures.some((o) => o.uid === L.uid) || count(L.uid) !== 1 || uidWhere(game, L.uid) !== top) problems.push(`a legend left upstairs is also back in its lair (${count(L.uid)} in memory, claimed by ${uidWhere(game, L.uid)})`);
  } else problems.push("no legend to follow you");
  // 6. A Lampless Saint burnt away by a lit brazier is as dead as a slain legend.
  const { AI_HOOKS } = await import("../../src/ai.js");
  const { spawnLegend } = await import("../../src/gen/vaults.js");
  const { claimUid } = await import("../../src/zones.js");
  startRun(seed, TEST_WORLD);
  go(`0,0,1`);
  let saint = null;
  for (let s = 1; s < 200 && !saint; s++) { const d = makeLegend(makeRng(s), { id: "saint" }, 3); if (d.template === "lamplessSaint") saint = d; }
  const z = game.zone, sx = Math.floor(game.player.x) + 1, sy = Math.floor(game.player.y);
  const sc = spawnLegend(z, saint, sx, sy, FLOOR_Z, Math.random);
  claimUid(game, saint.uid, z.key);
  z.set(sx, sy + 1, FLOOR_Z, B.BRAZIER_LIT);
  z.refresh();
  let ticks = 0;
  const xp0 = game.player.xp, xpOwed = sc.xp;
  while (z.creatures.includes(sc) && ticks < 600) { AI_HOOKS["legend:lamplessSaint"](game, sc, 0.1, new Int32Array(z.w * z.d)); ticks++; }
  stats.saint = `burnt away after ${(ticks / 10).toFixed(1)} s by a lit brazier; uid ${uidWhere(game, saint.uid)}; XP ${xp0} → ${game.player.xp} (owed ${xpOwed})`;
  if (z.creatures.includes(sc) || uidWhere(game, saint.uid) !== "dead") problems.push(`a Lampless Saint by a lit brazier: still there ${z.creatures.includes(sc)}, uid ${uidWhere(game, saint.uid)}`);
  if (!(game.player.xp > xp0 || game.player.level > 1)) problems.push(`a Lampless Saint burnt away gave no experience (${xp0} → ${game.player.xp})`);
  // 7. Its mutations and looks: on once, not stacking over re-entries, and back on after a save and a load (none
  //    of armour, venom, damage or colour is a saved creature field).
  const { encodeZone, decodeZone } = await import("../../src/save/codec.js");
  startRun(seed, TEST_WORLD);
  const L7 = [...game.run.sites.values()].find((s) => s.id === lair.id).legend;
  L7.mutations = ["heavyBlows", "venomous", "thickHide"];
  go(deep);
  const look = (c) => c && { bonus: c.bonus, venom: c.venom, armour: c.armour, color: JSON.stringify(c.color) };
  const first = look(game.zone.creatures.find((o) => o.uid === L7.uid));
  for (let k = 0; k < 3; k++) { go(top); go(deep); }
  const again = look(game.zone.creatures.find((o) => o.uid === L7.uid));
  const base = 3 + Math.floor((L7.level - 1) / 1.5);   // d20's creature damage (the balance decision of 2026-10-30)
  if (!first || first.bonus !== base + 2 || first.venom !== 3 || first.armour < 2 || first.color !== "[235,90,235]") problems.push(`mutations on first entry: ${JSON.stringify(first)}`);
  if (JSON.stringify(again) !== JSON.stringify(first)) problems.push(`mutations after three re-entries: ${JSON.stringify(again)} (first ${JSON.stringify(first)})`);
  go(top);
  game.zones.set(deep, await decodeZone(await encodeZone(game.zones.get(deep), { slot: null })));
  go(deep);
  const loaded = look(game.zone.creatures.find((o) => o.uid === L7.uid));
  if (JSON.stringify(loaded) !== JSON.stringify(first)) problems.push(`mutations after a save and a load: ${JSON.stringify(loaded)} (before ${JSON.stringify(first)})`);
  stats.mutations = `${JSON.stringify(first)}; the same after 3 re-entries and after a save and a load`;
  // 8. A history relic lies in one zone: claimed where it was laid; one claimed elsewhere first isn't there too;
  //    carried off and dropped in another zone, it stays where it was dropped.
  startRun(seed, TEST_WORLD);
  const hist = [...game.run.sites.values()].find((s) => s.kind === "historic" && s.historyRef.relicId);
  if (hist) {
    const rid = hist.historyRef.relicId, hDeep = `${hist.at.wx},${hist.at.wy},${hist.dungeon.levels}`, hTop = `${hist.at.wx},${hist.at.wy},${hist.dungeon.levels - 1}`;
    const relicIn = (key) => (game.zones.get(key)?.items || []).filter((it) => it.histRelic === rid).length;
    go(hDeep);
    const laid = relicIn(hDeep), claimedBy = uidWhere(game, rid);
    const it = game.zone.items.find((o) => o.histRelic === rid);
    game.zone.items = game.zone.items.filter((o) => o !== it);   // picked up…
    go(hTop);
    game.zone.items.push({ ...it, x: game.player.x, y: game.player.y });   // …and dropped a level up
    go(hDeep); go(hTop);
    const dropped = relicIn(hTop);
    startRun(seed, TEST_WORLD);
    claimUid(game, rid, "elsewhere");
    go(hDeep);
    const twice = relicIn(hDeep);
    stats.relic = `laid ${laid} (claimed by ${claimedBy}); dropped a level up: ${dropped} there; claimed elsewhere first: ${twice} in the reliquary`;
    if (laid !== 1 || claimedBy !== hDeep || dropped !== 1 || twice !== 0) problems.push(`a history relic: ${stats.relic}`);
  } else problems.push("no historic site with a relic");
  stats.cases = 8;
  // 9. C3's legend data (content/creatures/legends.js): the real world's lair owners by region, the reasons, the
  //    waiting templates.
  const data = legendDataProblems(game);
  problems.push(...data.problems);
  stats.c3 = data.stats;
  return { name: "legends", ok: problems.length === 0, problems, stats };
}

// The real world's legends (C3): LEGENDS.regions names real regions, every region whose spans may hold a lair has an
// entry; its species are registered kinds out for a Bent stranger (a lair's owner is), its herds among them, its
// factions registered and each with reasons; LEGENDS.reasons covers the 21 fixed factions, two loves
// and two hates each, short, lower case and unpunctuated as a clause; the waiting templates have a name, three
// epithets, a hall and what they need, and none is pickable yet (makeLegend's draws stay as they were); no lair owner
// that doesn't roam (the Gloam Warden, the Cast hunters), every herd among its region's species. Four mutants.
const FIXED_FACTIONS = ["hollowmere", "noonVigil", "survey", "assize", "horary", "pressed", "lampless", "drovers", "chandlers", "rustbacks",
  "flatfolk", "unlit", "askew", "plan", "moths", "kites", "clatter", "saltbeasts", "sporeMoot", "pleatwood", "errata"];
function legendData(game, LEGENDS, CREATURE_TYPES, FACTIONS, attitude, spawnCreature) {
  const out = [], R = REAL_WORLD.regions;
  for (const [r, e] of Object.entries(LEGENDS.regions)) {
    if (!R[r]) { out.push(`legends: ${r} isn't a real-world region`); continue; }
    if (!e.species?.length) out.push(`legends: ${r} has no species`);
    for (const [type, w] of e.species || []) {
      const T = CREATURE_TYPES[type];
      if (!T || T.talks || !(w > 0)) { out.push(`legends: ${r}'s species ${type} (${w})`); continue; }
      const feel = attitude(game, spawnCreature(type, 1, 1, FLOOR_Z, { rng: () => 0.5, level: 9 }), game.player);
      if (feel !== "hostile") out.push(`legends: ${r}'s ${type} isn't out for a stranger (${feel})`);
      if (T.levels && !(T.weight > 0)) out.push(`legends: ${r}'s ${type} doesn't roam (a boss or a Cast hunter owns no lair)`);
    }
    for (const h of e.herds || []) {
      if (!CREATURE_TYPES[h] || CREATURE_TYPES[h].talks) out.push(`legends: ${r}'s herd ${h}`);
      if (!(e.species || []).some(([s]) => s === h)) out.push(`legends: ${r}'s herd ${h} isn't among its species`);
    }
    for (const f of e.factions || []) if (!FACTIONS[f] || !LEGENDS.reasons[f]) out.push(`legends: ${r}'s faction ${f} unknown or without reasons`);
    if (!e.factions?.length) out.push(`legends: ${r} has no factions`);
  }
  for (const [r, def] of Object.entries(R)) if (def.sites?.lair > 0 && !LEGENDS.regions[r]) out.push(`legends: ${r} holds lairs and no entry`);
  const clause = (s) => typeof s === "string" && /^[a-z0-9][A-Za-z0-9 ',-]*[a-z0-9]$/.test(s) && s.split(" ").length <= 9;
  for (const f of FIXED_FACTIONS) {
    const e = LEGENDS.reasons[f];
    if (!e || !(e.loves?.length >= 2 && e.hates?.length >= 2)) { out.push(`legends: reasons for ${f}`); continue; }
    for (const s of [...e.loves, ...e.hates]) if (!clause(s)) out.push(`legends: ${f}'s reason "${s}"`);
  }
  for (const [id, t] of Object.entries(LEGENDS.waiting)) {
    if (!(t.name && t.epithets?.length >= 3 && t.hall && typeof t.needs === "string" && t.needs.length > 20 && t.info)) out.push(`legends: waiting template ${id}`);
    if (LEGENDS.templates[id]) out.push(`legends: ${id} is waiting and pickable`);
  }
  return out;
}
function legendDataProblems(game) {
  const problems = [], stats = {};
  const L = LEGENDS_MOD.LEGENDS, C = CREATURES_MOD, F = FACTIONS_MOD;
  const p = game.player, saved = { genotype: p.genotype, rep: game.state.rep };
  try {
    p.genotype = "bent"; game.state.rep = {};
    const run = () => legendData(game, L, C.CREATURE_TYPES, F.FACTIONS, F.attitude, C.spawnCreature);
    problems.push(...run());
    // The real world's lairs draw by region (integrator, C3 #4): on 5 seeds, every lair's owner of its region's species
    // (a Herdmother's of its herds), every opinion about one of its factions, with a reason for that feeling.
    {
      const off = [];
      let lairs = 0;
      for (const seed of [1, 7, 42, 1234, 31337]) {
        const r = buildRun(seed, compileWorld(REAL_WORLD));
        for (const s of r.sites.values()) {
          if (!s.legend || s.kind !== "lair") continue;
          const reg = r.world.tileAt(s.at.wx, s.at.wy).region, e = L.regions[reg], g = s.legend;
          if (!e) continue;
          lairs++;
          const kinds = g.template === "herdmother" ? e.herds : e.species.map(([t]) => t);
          if (!kinds.includes(g.species)) off.push(`${s.id} (${reg}): ${g.template} ${g.species}`);
          for (const o of g.opinions) if (!e.factions.includes(o.faction) || !L.reasons[o.faction]?.[o.feeling]?.includes(o.reason)) off.push(`${s.id}: ${o.faction} ${o.feeling} "${o.reason}"`);
        }
      }
      if (!lairs || off.length) problems.push(`real-world legends not by region: ${off.slice(0, 4).join("; ") || "no lair"}`);
      stats.byRegion = `${lairs} real-world lairs on 5 seeds, each owner and opinion from its region`;
    }
    const mutants = [
      ["a docile owner", () => { const s = L.regions.waste.species; s.push(["longback", 1]); return () => s.pop(); }, /waste's longback isn't out for a stranger/],
      ["a faction without reasons", () => { const old = L.reasons.drovers; delete L.reasons.drovers; return () => { L.reasons.drovers = old; }; }, /reasons for drovers|faction drovers unknown or without reasons/],
      ["the Gloam Warden owning a lair", () => { const s = L.regions.shade.species; s.push(["gloamWarden", 1]); return () => s.pop(); }, /shade's gloamWarden doesn't roam/],
      ["a herd from elsewhere", () => { const h = L.regions.flats.herds; h.push("askewAngle"); return () => h.pop(); }, /flats's herd askewAngle isn't among its species/],
    ];
    let caught = 0;
    for (const [what, apply, re] of mutants) {
      const undo = apply();
      let o;
      try { o = run(); } finally { undo(); }
      if (o.some((x) => re.test(x))) caught++; else problems.push(`legend data: the mutant "${what}" isn't caught`);
    }
    stats.regions = Object.keys(L.regions).length;
    stats.reasons = `${Object.keys(L.reasons).length} factions, ${Object.values(L.reasons).reduce((a, e) => a + e.loves.length + e.hates.length, 0)} reasons`;
    stats.waiting = Object.keys(L.waiting).join(", ");
    stats.mutants = `${caught} of ${mutants.length}`;
  } finally { p.genotype = saved.genotype; game.state.rep = saved.rep; }
  return { problems, stats };
}

// --- Spikes: a flat you is spared (WS8 #3), a creature's spike wound is nobody's (WS6a #2) ------------------
export async function checkTraps() {
  const problems = [], stats = {};
  const { game, startRun } = await import("../../src/game.js");
  const { updateSpikes, spikeState, TICK, BEAT_SIGHT, spikeSprites } = await import("../../src/traps.js");
  const { addStatus, removeStatus } = await import("../../src/status.js");
  const { on } = await import("../../src/events.js");
  const { spawnCreature, addCreature } = await import("../../src/creatures.js");
  startRun(1234, TEST_WORLD);
  game.debug.enterZone("0,0,1");
  const zone = game.zone, p = game.player;
  const tx = Math.floor(p.x), ty = Math.floor(p.y), period = 4;
  const upHere = (x, y) => zone.spikes.set(x + y * zone.w, { phase: ((Math.floor(game.time / TICK) % period) + period) % period, period, up: 1, pattern: "test" });
  upHere(tx, ty);
  if (spikeState(zone, tx + ty * zone.w, game.time) !== "up") problems.push("the test spike isn't up");
  Object.assign(p, { z: FLOOR_Z, onGround: true, spikeBeat: undefined });
  const hp0 = p.hp;
  addStatus(game, p, "flat");
  updateSpikes(game);
  stats.flat = `${hp0} → ${p.hp}`;
  if (p.hp !== hp0) problems.push(`flat: the spikes hurt you (${hp0} → ${p.hp})`);
  removeStatus(game, p, "flat");
  p.spikeBeat = undefined;
  updateSpikes(game);
  stats.deep = `${hp0} → ${p.hp}`;
  if (!(p.hp < hp0)) problems.push("deep: the spikes didn't hurt you");
  // A goblin on a spike beside you: hurt by nobody (no grudge, no rep), its death nobody's kill for the "kill" event,
  // but its experience yours, as in the parent (the integrator's call on WS10 #10 at the merge).
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [tx + dx, ty + dy]).find(([x, y]) => zone.stand[x + y * zone.w] === FLOOR_Z);
  if (spot) {
    const m = addCreature(zone, spawnCreature("goblin", spot[0], spot[1], FLOOR_Z, { rng: Math.random, state: "idle", level: 1 }));
    upHere(spot[0], spot[1]);
    const srcs = [];
    const off = on("hurt", (g, e) => { if (e.tgt === m) srcs.push(e.src ?? null); });
    m.hp = 1;
    const xp0 = p.xp;
    updateSpikes(game);
    off?.();
    stats.goblin = { dead: !zone.creatures.includes(m), srcs: srcs.map((x) => (x === null ? "nobody" : x === game.player ? "you" : String(x?.type))), xp: `${xp0} → ${p.xp}` };
    if (zone.creatures.includes(m)) problems.push("the goblin on a spike didn't die");
    if (!srcs.length || srcs.some((s) => s !== null)) problems.push(`a spike's wound came from [${srcs}] (want one wound from nobody)`);
    if (!(p.xp > xp0)) problems.push(`a spike kill gave you no experience (${xp0} → ${p.xp}; the parent gave it)`);
  } else problems.push("no floor beside you for the goblin");
  // The beat in 3D: with BEAT_SIGHT on, a spike about to rise shows; off, it doesn't.
  zone.spikes.set(tx + ty * zone.w, { phase: ((Math.floor(game.time / TICK) + 1) % period + period) % period, period, up: 1, pattern: "test" });
  if (spikeState(zone, tx + ty * zone.w, game.time) !== "warn") problems.push("the test spike isn't about to rise");
  const off3d = spikeSprites(game).length, has = BEAT_SIGHT.has;
  BEAT_SIGHT.has = () => true;
  const on3d = spikeSprites(game).length;
  BEAT_SIGHT.has = has;
  stats.beatSight = `${off3d} sprites without, ${on3d} with`;
  if (on3d <= off3d) problems.push("beat sight shows no warning sprite");
  return { name: "traps", ok: problems.length === 0, problems, stats };
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-dungeons.mjs and tools/check-sites.mjs give.
export async function run(env) {
  await env.screen();
  const seeds = env.args.siteSeeds ? String(env.args.siteSeeds).split(",").map(Number) : SEEDS;
  return [checkVaultOptions(), checkDungeonParams(),
    checkDungeons({ seeds: Number(env.args.seeds) || 50, p95Budget: Number(env.args.budget) || 40 }),
    checkRandomLevels({ count: Number(env.args.random) || 1000, p95Budget: Number(env.args.budget) || 40 }),
    checkSites({ seeds }), checkHistoric({ seeds }), await checkLegends(), await checkTraps(), await checkLandmarkBottoms({ seeds })];
}
