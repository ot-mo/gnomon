// Dungeon levels: every level of the legacy stack, many seeds, must pass validateDungeonLevel (as
// test.html checks in the browser), guardian levels must have their guardian and hall, and
// generation must stay fast.
//
//   checkDungeons({ seeds = 50, depths = 20, p95Budget = 40 }) → { name, ok, problems, stats }
//
// Timing: 20 levels are generated first and not counted (the JIT warming up), then the percentiles
// are over all counted levels. Budget: p95 ≤ 40 ms (TECH_DESIGN §6.7, 0A1 gate).
import { generateDungeonLevel, validateDungeonLevel, legacyParams, LEGACY_GUARDIANS, LEGACY_LEVELS } from "../../src/gen/dungeon.js";
import { stampVault, buildVault, pickVault, registerLegend, vaultById, VAULTS, GUARDIAN_HALLS, BOSS_HALLS, STAMP_DEFAULTS } from "../../src/gen/vaults.js";
import { Zone, B, FLOOR_Z } from "../../src/world.js";
import { makeRng } from "../../src/rng.js";

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
  for (const v of [...VAULTS, ...Object.values(GUARDIAN_HALLS), ...Object.values(BOSS_HALLS)]) expect(vaultById(v.id) === v, `vaultById("${v.id}")`);
  for (let s = 1; s <= 50; s++) {
    const a = pickVault(makeRng(s), { level: 12 }).id, b = makeRng(s).pick(VAULTS).id;
    if (a !== b) { problems.push(`pickVault with the default pool drew ${a}, rng.pick would draw ${b}`); break; }
  }
  expect(pickVault(makeRng(1), { final: true, bottom: { kind: "guardian", id: "warden" } }).id === "warden", "a final level's guardian bottom gets its hall");
  return { name: "vault options", ok: problems.length === 0, problems, stats: { cases: 14 } };
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
  const lich = last.monsters.findIndex((m) => m.type === "lich");
  if (lich >= 0) last.monsters.splice(lich, 1);
  test(lich >= 0 && validateDungeonLevel(last).includes("boss missing or unreachable"), "the zone's own bottom keeps the boss rule");
  const noUp = generateDungeonLevel(42, { ...legacyParams(3, 42), hasUp: false });
  test(!noUp.upStairs && validateDungeonLevel(noUp).length === 0, `a level made without stairs up validates alone (${validateDungeonLevel(noUp).join(", ")})`);
  // Parts of p that WS10 implements are refused until then, never silently ignored.
  for (const extra of [{ creatureTable: [["rat", 1]] }, { holesIn: { x0: 0, y0: 0, x1: 10, y1: 10 } },
                       { final: true, bottom: { kind: "boss", id: "lich", uid: "legend:lich" } }])
    test(throws(() => generateDungeonLevel(3, { ...legacyParams(LEGACY_LEVELS, 3), ...extra })), `p ${JSON.stringify(extra)} must throw (not supported yet)`);
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
        if (!f.guardianHall || !f.monsters.some((m) => m.guardian === f.guardianHall.type) || !f.stairs)
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
