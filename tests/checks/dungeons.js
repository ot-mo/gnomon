// Dungeon levels and sites (TECH_DESIGN §8.3 "WS10"). Every level of the legacy stack, many seeds, must pass
// validateDungeonLevel (as test.html checks in the browser), guardian levels must have their guardian and hall,
// and generation must stay fast; so must 1,000 levels with random site parameters (every theme, gimmick and
// bottom); every site of both worlds validates on every level for 5 seeds, history's site requests are built,
// and a legend lives in exactly one zone.
//
//   checkVaultOptions() · checkDungeonParams()
//   checkDungeons({ seeds = 50, depths = 20, p95Budget = 40 })      the legacy stack (tools/check-dungeons.mjs)
//   checkRandomLevels({ count = 1000, p95Budget = 40 })             random site parameters (check-dungeons)
//   checkSites({ seeds })            every site × every level × the seeds, both worlds (tools/check-sites.mjs)
//   checkHistoric({ seeds })         the fixture history's two site requests, built (check-sites)
//   checkLegends({ seeds })          a legend lives in exactly one zone; a dead one never returns (check-sites)
//   randomParams(i) → { seed, p }    the i-th random level (test.html draws the same ones)
//
// Timing: 20 levels are generated first and not counted (the JIT warming up), then the percentiles
// are over all counted levels. Budget: p95 ≤ 40 ms (TECH_DESIGN §6.7, 0A1 gate).
import { generateDungeonLevel, validateDungeonLevel, legacyParams, LEGACY_GUARDIANS, LEGACY_LEVELS, DUNGEON_THEMES, GIMMICKS } from "../../src/gen/dungeon.js";
import { stampVault, buildVault, pickVault, registerLegend, vaultById, VAULTS, GUARDIAN_HALLS, BOSS_HALLS, LAIR_HALLS, RELIC_HALLS, STAMP_DEFAULTS } from "../../src/gen/vaults.js";
import { Zone, B, FLOOR_Z } from "../../src/world.js";
import { makeRng, seedFor } from "../../src/rng.js";
import { canTalk } from "../../src/creatures.js";
import { makeLegend, dungeonParams, SITE_KINDS, SITE_BUILDERS } from "../../src/world/sites.js";
import { buildRun, zoneSeed } from "../../src/world/run.js";
import { compileWorld, tierOfLevel } from "../../src/world/worldmodel.js";
import { generateSurface, validateSurface } from "../../src/gen/surface.js";
import { TEST_WORLD } from "../../src/content/world/test-world.js";
import { REAL_WORLD } from "../../src/content/world/worldmap.js";
import { DUNGEONS } from "../../src/content/dungeons.js";

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
  for (const v of [...VAULTS, ...Object.values(GUARDIAN_HALLS), ...Object.values(BOSS_HALLS), ...Object.values(LAIR_HALLS), ...Object.values(RELIC_HALLS)])
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
  const flats = f.creatures.filter((c) => c.vis?.flat && !canTalk(c) && !c.guardian && !c.flags?.legend);
  if (g.includes("allDeep") && !(g.includes("flatland") && after("flatland", "allDeep")) && flats.length) out.push(`allDeep: ${flats.length} flat creature(s)`);
  if (p.holesIn && holesOutside(f, p.holesIn)) out.push(`holesIn: ${holesOutside(f, p.holesIn)} hole column(s) outside it`);
  if (p.cradle && !(f.cradle && f.get(f.cradle.x, f.cradle.y, FLOOR_Z) === B.STATION && f.get(f.cradle.x, f.cradle.y, FLOOR_Z + 1) === B.STATION))
    out.push("cradle: no Truing Cradle");
  if (p.creatureTable) {
    const allowed = new Set([...p.creatureTable.map((r) => (Array.isArray(r) ? r[0] : r)), "rat", "goblin", "skeleton", "flatling", "shade", "door"]);
    if (p.bottom?.legend) allowed.add(p.bottom.legend.species);
    const odd = f.creatures.filter((c) => !canTalk(c) && !c.guardian && !allowed.has(c.type));
    if (odd.length) out.push(`creatureTable: ${odd.map((c) => c.type).join(", ")} not in the table`);
  }
  if (p.final && p.bottom?.kind === "legend") {
    const c = f.creatures.find((m) => m.uid === p.bottom.uid);
    if (!c || c.flags?.legend !== p.bottom.uid || c.level !== p.bottom.legend.level || !c.named) out.push("legend: its owner isn't made right");
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
const SEEDS = [1, 7, 42, 1234, 31337];

export function checkSites({ seeds = SEEDS } = {}) {
  const problems = [], stats = { sites: 0, levels: 0, surfaces: 0, kinds: {}, bottoms: {}, legends: 0 };
  const t0 = performance.now();
  for (const [name, def] of WORLDS) {
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
        if (s.dungeon) {
          const d = s.dungeon;
          for (const g of [...(d.gimmicks || []), ...(d.floorGimmicks || []).flat()]) if (!GIMMICKS[g]) problems.push(`${where}: unknown gimmick ${g}`);
          for (let z = 1; z <= d.levels; z++) {
            const p = d.legacy ? legacyParams(z, seed) : dungeonParams(run, s, z);
            const f = generateDungeonLevel(d.legacy ? seed : zoneSeed(run, s.at.wx, s.at.wy, z), p);
            stats.levels++;
            const bad = [...validateDungeonLevel(f, p), ...(d.legacy ? [] : siteLevelProblems(f, p))];
            if (bad.length) problems.push(`${where} level ${z} (level ${p.level}): ${bad.join(", ")}`);
            if (p.final && p.bottom) stats.bottoms[p.bottom.kind] = (stats.bottoms[p.bottom.kind] || 0) + 1;
            if (p.final && p.bottom?.kind === "guardian" && !f.creatures.some((c) => c.guardian === p.bottom.id)) problems.push(`${where}: the guardian ${p.bottom.id} isn't in its hall`);
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
  stats.ms = Math.round(performance.now() - t0);
  return { name: "sites", ok: problems.length === 0, problems, stats };
}

// --- History's site requests (the P0 fixture: two Hours, two requests, one relic) ---------------------------
export function checkHistoric({ seeds = SEEDS } = {}) {
  const problems = [], stats = { built: 0, floors: 0, named: 0, relics: 0, trueMarks: 0, murals: 0 };
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
            const texts = new Set(ruler.events.flatMap((e) => [e.text.inscription, e.text.gospel]));
            if (!f.murals.every((m) => texts.has(m.text))) problems.push(`${at} floor ${z}: a mural that isn't the Hour's account`);
          }
          if (z === d.levels) {
            const loot = f.bottomLoot || {};
            const marks = DUNGEONS.trueMarks[t.tier];
            if (f.vault.name !== "The Reliquary" || JSON.stringify(loot.trueMarks) !== JSON.stringify(marks)) problems.push(`${at}: the bottom isn't a reliquary with ${JSON.stringify(marks)} true-marks`);
            else stats.trueMarks += marks.reduce((a, b) => a + b, 0);
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
  // 1. In its lair: there, once, claimed by the lair, in its looks.
  go(deep);
  const c = game.zone.creatures.find((o) => o.uid === L.uid);
  if (!c || uidWhere(game, L.uid) !== deep || count(L.uid) !== 1) problems.push(`in its lair: present ${!!c}, claimed by ${uidWhere(game, L.uid)}, ${count(L.uid)} in memory`);
  if (c && JSON.stringify(c.color) !== JSON.stringify([235, 90, 235])) problems.push("in its lair: not in the legends' magenta");
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
  // 5. A follower takes its home along.
  startRun(seed, TEST_WORLD);
  go(deep);
  const f = game.zone.creatures.find((o) => o.uid === L.uid);
  if (f) {
    f.brain = { ...(f.brain || {}), leader: "player" };
    const lairZone = game.zone;
    go(top);
    lairZone.creatures = lairZone.creatures.filter((o) => o !== f);
    game.zone.creatures.push(f);   // (as WS8's zone:leave takes a follower along)
    go(surface); go(top);
    if (uidWhere(game, L.uid) !== top || count(L.uid) !== 1 || !game.zone.creatures.includes(f)) problems.push(`a following legend: claimed by ${uidWhere(game, L.uid)}, ${count(L.uid)} in memory`);
    go(deep);
    if (game.zone.creatures.some((o) => o.uid === L.uid)) problems.push("a following legend is also back in its lair");
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
  while (z.creatures.includes(sc) && ticks < 600) { AI_HOOKS["legend:lamplessSaint"](game, sc, 0.1, new Int32Array(z.w * z.d)); ticks++; }
  stats.saint = `burnt away after ${(ticks / 10).toFixed(1)} s by a lit brazier; uid ${uidWhere(game, saint.uid)}`;
  if (z.creatures.includes(sc) || uidWhere(game, saint.uid) !== "dead") problems.push(`a Lampless Saint by a lit brazier: still there ${z.creatures.includes(sc)}, uid ${uidWhere(game, saint.uid)}`);
  stats.cases = 6;
  return { name: "legends", ok: problems.length === 0, problems, stats };
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
  // A goblin on a spike beside you: hurt by nobody, and its death is nobody's kill.
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
    if (p.xp !== xp0) problems.push(`a spike kill gave you experience (${xp0} → ${p.xp})`);
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
    checkSites({ seeds }), checkHistoric({ seeds }), await checkLegends(), await checkTraps()];
}
