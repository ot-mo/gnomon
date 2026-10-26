// Combat (combat.js): TECH_DESIGN §3 with the d20 rules of DECISIONS (bible §10.6, §15.6).
//
//   checkCombat({ game, startRun, srcFiles }) → { name, ok, problems, stats }
//
//   1. The move: no penetration dice and no `pv` key anywhere; monsters.js no longer lands blows.
//   2. Hit-chance tables (d20): rollToHit over 10⁵ rolls per row against hitChance() (the analytic value),
//      within ±0.02, for you (AGI, accuracy, high ground, aimed, a weapon too heavy, a widened crit range)
//      against creatures of several levels, and for creatures against your DV. Crit rates too. One row
//      also goes through the whole resolveAttack (10⁵ blows on a goblin that can't die).
//   3. Both views, one resolution: a bump duel on the map and a swing duel in 3D with the same combat RNG
//      give identical result sequences (hit, crit, natural, total, DV, damage, soak).
//   4. The planes, the dark and the core: a flatling is struck on the map and never in 3D (the bump lands,
//      the swing passes through); the Gloom Warden only with the torch out; the Colossus's core only from
//      above (from the ground every landed blow does exactly 1). In both sets.
//   5. Creatures against creatures (d20): misses happen, hits land, the victim bears a grudge, a kill gives
//      you no XP. Creatures against you: your DV decides (a higher AGI is hit less often).
//
// game/startRun: the real game (game.js). srcFiles: [{ file, text }] of every src/ module.
import { Zone, B, FLOOR_Z } from "../../src/world.js";
import { enterZone } from "../../src/zones.js";
import { spawnCreature, addCreature } from "../../src/creatures.js";
import { resolveAttack, rollToHit, hitChance, toHitMod, critNat, dvOf, weaponSpec, naturalSpec, playerMelee, bumpAttack } from "../../src/combat.js";
import { mapStep } from "../../src/turns.js";
import { overrideRules, RULES } from "../../src/rules.js";
import { invalidateStats, mod } from "../../src/stats.js";
import { makeRng } from "../../src/rng.js";
import { on } from "../../src/events.js";
import { setDaylight } from "../../src/light.js";

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

function arena(key, { sky = false, w = 24, d = 16 } = {}) {
  const z = new Zone({ key, wx: 95, wy: 95, z: 0, type: "surface", level: 3, seed: 3, w, d, h: 16, name: "Combat Test" });
  for (let y = 0; y < z.d; y++)
    for (let x = 0; x < z.w; x++) for (let k = 0; k < FLOOR_Z; k++) z.set(x, y, k, k === FLOOR_Z - 1 ? B.GRASS : B.ROCK);
  z.hasSky = sky;
  z.edges = { n: null, s: null, e: null, w: null };
  z.refresh();
  z.spawn = { x: 5.5, y: 5.5, z: FLOOR_Z, yaw: 0 };
  return z.seal();
}

const ROLLS = 100000, TOL = 0.02;

export function checkCombat({ game, startRun, srcFiles }) {
  const problems = [], stats = {};
  const expect = (ok, m) => { if (!ok) problems.push(m); return ok; };

  // --- 1. The move --------------------------------------------------------------------------------------
  const code = srcFiles.map((f) => ({ file: f.file, text: stripComments(f.text) }));
  for (const { file, text } of code) {
    if (/penetrations\s*\(/.test(text)) problems.push(`${file}: penetration dice (DECISIONS: none)`);
    if (/["'`]pv["'`]|\bpv\s*:/.test(text)) problems.push(`${file}: a pv key (DECISIONS: none)`);
  }
  const monsters = code.find((f) => f.file === "monsters.js").text;
  const left = ["attackMonster", "hitPlayer", "hurtMonster", "creatureHits", "playerAttack"].filter((n) => monsters.includes(n));
  expect(!left.length, `monsters.js still lands blows: ${left.join(", ")}`);

  startRun(41);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  const p = game.player;
  const logged = [], log = game.log;
  game.log = (text) => logged.push(text);
  const undoCombat = overrideRules("combat", "d20");
  const undoDay = setDaylight(1);
  const attacks = [];
  const offAttack = on("attack", (g, { result }) => attacks.push(result));
  const savedAttrs = { ...p.attrs };
  const setAgi = (v) => { p.attrs.agi = v; invalidateStats(p); };
  const stand = (x, y, z = FLOOR_Z, yaw = 0, pitch = 0) => Object.assign(p, { x, y, z, vz: 0, yaw, pitch, attackCd: 0 });
  try {
    const field = arena("combat-field");
    enterZone(game, field, { how: "start" });
    p.torch = true;

    // --- 2. Hit-chance tables -----------------------------------------------------------------------------
    const table = [];
    const row = (label, att, tgt, spec, ctx) => {
      const rng = makeRng(1000 + table.length);
      const m = toHitMod(game, att, tgt, spec, ctx), dv = dvOf(game, tgt), cn = critNat(att);
      let hits = 0, crits = 0;
      for (let k = 0; k < ROLLS; k++) { const r = rollToHit(game, att, tgt, spec, ctx, rng); if (r.hit) hits++; if (r.crit) crits++; }
      const want = hitChance(m, dv, cn), wantCrit = (21 - cn) / 20;
      const got = hits / ROLLS, gotCrit = crits / ROLLS;
      table.push({ label, mod: m, dv, critNat: cn, want: +want.toFixed(3), got: +got.toFixed(4), crit: +gotCrit.toFixed(4) });
      expect(Math.abs(got - want) <= TOL, `${label}: hit rate ${got.toFixed(4)}, analytic ${want.toFixed(4)}`);
      expect(Math.abs(gotCrit - wantCrit) <= TOL, `${label}: crit rate ${gotCrit.toFixed(4)}, analytic ${wantCrit.toFixed(4)}`);
      return { m, dv };
    };
    const mk = (type, level, at = [8, 5]) => addCreature(field, spawnCreature(type, at[0], at[1], FLOOR_Z, { rng: () => 0.5, level, state: "chase" }));
    const gob1 = mk("goblin", 1), gob8 = mk("goblin", 8), troll12 = mk("troll", 12), lvl20 = mk("goblin", 20);
    const sword = weaponSpec(p);
    stand(5.5, 5.5);
    setAgi(16);
    let r = row("you AGI 16 vs goblin L1", p, gob1, sword, {});
    expect(r.m === 0 && r.dv === 5, `AGI 16 vs a level-1 goblin: mod ${r.m} (want 0), DV ${r.dv} (want 5 + floor(1/4) = 5)`);
    r = row("you AGI 16 vs goblin L8", p, gob8, sword, {});
    expect(r.dv === 7, `a level-8 goblin's DV is ${r.dv}, want 5 + floor(8/4) = 7`);
    setAgi(20);
    r = row("you AGI 20 vs troll L12", p, troll12, sword, {});
    expect(r.m === 2 && critNat(p) === 19, `AGI 20: mod ${r.m} (want +2), crit from ${critNat(p)} (want 19: +2% per point, 20 − round(0.8))`);
    setAgi(26);
    r = row("you AGI 26 vs goblin L1 (a natural 1 still misses)", p, gob1, sword, {});
    expect(r.m === 5 && critNat(p) === 18, `AGI 26: mod ${r.m} (want +5), crit from ${critNat(p)} (want 18)`);
    setAgi(10);
    r = row("you AGI 10 vs goblin L20", p, lvl20, sword, {});
    expect(r.m === -3 && r.dv === 10, `AGI 10 vs level 20: mod ${r.m} (want −3), DV ${r.dv} (want 10)`);
    setAgi(16);
    r = row("you aimed knife vs goblin L8", p, gob8, { kind: "thrown", dmg: [2, 4] }, { aimed: true });
    expect(r.m === RULES.d20.aimed, `an aimed throw adds ${r.m}, want +${RULES.d20.aimed}`);
    stand(5.5, 5.5, FLOOR_Z + 1);
    r = row("you on high ground vs goblin L8", p, gob8, sword, {});
    expect(r.m === RULES.d20.highGround, `high ground adds ${r.m}, want +${RULES.d20.highGround}`);
    stand(5.5, 5.5);
    r = row("you, weapon 2 STR too heavy", p, gob8, { ...sword, req: 12 }, {});   // STR reads 10 in the legacy stat set
    expect(r.m === -4, `a weapon 2 STR too heavy gives ${r.m}, want −4`);
    p.innate = { crit: 0.1 }; invalidateStats(p);
    r = row("you with +10% crit vs goblin L8", p, gob8, sword, {});
    expect(critNat(p) === 18, `a +10% crit bonus crits from ${critNat(p)}, want 18`);
    delete p.innate; invalidateStats(p);
    for (const [lv, agi] of [[1, 16], [6, 16], [12, 14], [20, 18], [20, 8]]) {
      setAgi(agi);
      const c = mk("goblin", lv);
      r = row(`goblin L${lv} vs you AGI ${agi}`, c, p, naturalSpec(c), {});
      expect(r.m === Math.floor(lv / 3) && r.dv === 6 + mod(p, "agi"), `goblin L${lv} vs you: mod ${r.m} (want ${Math.floor(lv / 3)}), DV ${r.dv} (want ${6 + mod(p, "agi")})`);
    }
    setAgi(16);
    // The analytic table itself.
    expect(hitChance(0, 10) === 0.5 && hitChance(30, 0) === 0.95 && hitChance(-30, 30) === 0.05 && hitChance(-30, 30, 18) === 0.15,
      `hitChance: ${hitChance(0, 10)}, ${hitChance(30, 0)}, ${hitChance(-30, 30)}, ${hitChance(-30, 30, 18)} (want 0.5, 0.95, 0.05, 0.15)`);
    // The whole resolution, 10⁵ blows.
    gob8.hp = gob8.maxHp = 1e9;
    game.combatRng = makeRng(5);
    let landed = 0;
    for (let k = 0; k < ROLLS; k++) {
      const res = resolveAttack(game, p, gob8, sword, { view: "map" });
      if (res.hit) landed++;
      if ((k & 1023) === 0) { game.effects.length = 0; logged.length = 0; }
    }
    const wantFull = hitChance(toHitMod(game, p, gob8, sword, {}), dvOf(game, gob8), critNat(p));
    expect(Math.abs(landed / ROLLS - wantFull) <= TOL, `resolveAttack: ${landed / ROLLS} of blows landed, analytic ${wantFull}`);
    stats.table = table.map((t) => `${t.label}: mod ${t.mod} DV ${t.dv} crit≥${t.critNat} → ${t.got} (want ${t.want}), crit ${t.crit}`);
    stats.resolveAttack = { blows: ROLLS, landed: landed / ROLLS, want: wantFull };
    game.effects.length = 0;
    field.creatures.length = 0;

    // --- 3. Both views ------------------------------------------------------------------------------------
    const duel = (view) => {
      const z = arena(`combat-duel-${view}`);
      enterZone(game, z, { how: "start" });
      stand(5.5, 5.5);
      const foe = addCreature(z, spawnCreature("orc", 6, 5, FLOOR_Z, { rng: () => 0.5, level: 6, state: "chase" }));
      foe.hp = foe.maxHp = 1e6; foe.cd = Infinity;   // it never strikes back, so the combat RNG is the duel's alone
      game.combatRng = makeRng(2024);
      attacks.length = 0;
      game.mode = view === "map" ? "map" : "explore"; game.view = view;
      for (let k = 0; k < 300; k++) {
        if (view === "map") mapStep(game, 1, 0);
        else { stand(5.5, 5.5); playerMelee(game); }
        game.effects.length = 0;
      }
      return attacks.filter((a) => a.tgt === foe).map((a) => [a.hit, a.crit, a.nat, a.total, a.dv, a.dmg, a.soaked].join(","));
    };
    const onMap = duel("map"), in3d = duel("3d");
    const firstDiff = onMap.findIndex((s, k) => s !== in3d[k]);
    expect(onMap.length === 300 && in3d.length === 300, `duels: ${onMap.length} blows on the map, ${in3d.length} in 3D (want 300 each)`);
    expect(firstDiff < 0, `the map and 3D duels differ at blow ${firstDiff}: ${onMap[firstDiff]} vs ${in3d[firstDiff]}`);
    const misses = onMap.filter((s) => s.startsWith("false")).length, critsN = onMap.filter((s) => s.startsWith("true,true")).length;
    expect(misses > 0 && critsN > 0, `the duel should have misses and crits: ${misses} misses, ${critsN} crits`);
    stats.parity = { blows: onMap.length, identical: firstDiff < 0, misses, crits: critsN, first: onMap.slice(0, 3) };

    // --- 4. The planes, the dark, the core (both sets) --------------------------------------------------
    const planes = {};
    for (const set of ["d20", "legacy"]) {
      const undoSet = overrideRules("combat", set);
      const z = arena(`combat-planes-${set}`);
      enterZone(game, z, { how: "start" });
      game.combatRng = makeRng(7);
      // The flatling: bumped on the map, swung at in 3D.
      const flat = addCreature(z, spawnCreature("flatling", 6, 5, FLOOR_Z, { rng: () => 0.5, level: 5, state: "chase" }));
      flat.hp = flat.maxHp = 1e6; flat.cd = Infinity;
      game.mode = "map"; game.view = "map";
      let mapHits = 0, mapTouched = 0;
      for (let k = 0; k < 60; k++) { stand(5.5, 5.5); const res = bumpAttack(game, flat); if (res.touched) mapTouched++; if (res.hit && res.dmg > 0) mapHits++; }
      game.mode = "explore"; game.view = "3d";
      const hpBefore = flat.hp;
      let swings = 0, direct3d = 0;
      for (let k = 0; k < 60; k++) { stand(5.5, 5.5); if (playerMelee(game)) swings++; if (resolveAttack(game, p, flat, weaponSpec(p), { view: "3d" }).touched) direct3d++; }
      expect(mapTouched === 60 && mapHits > 0, `${set}: a flatling on the map: touched ${mapTouched} of 60, hurt ${mapHits} times`);
      expect(swings === 0 && direct3d === 0 && flat.hp === hpBefore, `${set}: a flatling in 3D was struck (${swings} swings found it, ${direct3d} blows touched it)`);
      z.creatures.length = 0;
      // The Gloom Warden: underground, only with the torch out.
      const warden = addCreature(z, spawnCreature("warden", 6, 5, FLOOR_Z, { rng: () => 0.5, level: 10, state: "chase" }));
      warden.hp = warden.maxHp = 1e6; warden.cd = Infinity; warden.g = { t: 0, summon: 1e9, snuff: 1e9 };
      const lit = [], dark = [];
      for (const torch of [true, false]) {
        p.torch = torch;
        for (let k = 0; k < 40; k++) {
          stand(5.5, 5.5);
          const res = resolveAttack(game, p, warden, weaponSpec(p), { view: k & 1 ? "3d" : "map" });
          (torch ? lit : dark).push(res);
        }
      }
      p.torch = true;
      expect(lit.every((x) => !x.touched && x.dmg === 0) && dark.every((x) => x.touched) && dark.some((x) => x.dmg > 0),
        `${set}: the Gloom Warden: torch lit ${lit.filter((x) => x.touched).length} of 40 touched, torch out ${dark.filter((x) => x.touched).length} of 40 touched`);
      z.creatures.length = 0;
      // The Colossus: its core only from above.
      const col = addCreature(z, spawnCreature("colossus", 7, 5, FLOOR_Z, { rng: () => 0.5, level: 9, state: "idle" }));
      col.hp = col.maxHp = 1e6; col.cd = Infinity;
      const below = [], above = [];
      for (const hi of [false, true]) for (let k = 0; k < 100; k++) {
        stand(5.5, 5.5, hi ? FLOOR_Z + 2 : FLOOR_Z);
        (hi ? above : below).push(resolveAttack(game, p, col, weaponSpec(p), { view: k & 1 ? "3d" : "map" }));
      }
      const landedBelow = below.filter((x) => x.hit), landedAbove = above.filter((x) => x.hit);
      expect(landedBelow.length > 0 && landedBelow.every((x) => x.dmg === 1), `${set}: the Colossus from the ground: ${landedBelow.length} blows landed, damage ${[...new Set(landedBelow.map((x) => x.dmg))]} (want only 1)`);
      expect(landedAbove.filter((x) => x.dmg > 1).length >= landedAbove.length * 0.5, `${set}: the Colossus from above: only ${landedAbove.filter((x) => x.dmg > 1).length} of ${landedAbove.length} blows did more than 1`);
      planes[set] = { flatlingMap: `${mapHits}/60 hurt`, flatling3d: `${swings + direct3d} touched`, wardenLit: lit.filter((x) => x.touched).length,
                      wardenDark: dark.filter((x) => x.touched).length, colossusBelow: [...new Set(landedBelow.map((x) => x.dmg))],
                      colossusAboveMean: +(landedAbove.reduce((a, x) => a + x.dmg, 0) / Math.max(1, landedAbove.length)).toFixed(2) };
      z.creatures.length = 0;
      undoSet();
    }
    stats.planes = planes;
    game.effects.length = 0;

    // --- 5. Creatures against creatures, and against you (d20) -------------------------------------------
    {
      const z = arena("combat-cvc");
      enterZone(game, z, { how: "start" });
      stand(2.5, 2.5);
      game.combatRng = makeRng(11);
      const a = addCreature(z, spawnCreature("orc", 10, 8, FLOOR_Z, { rng: () => 0.5, level: 6, state: "wander" }));
      const v = addCreature(z, spawnCreature("goblin", 11, 8, FLOOR_Z, { rng: () => 0.5, level: 3, state: "idle" }));
      v.hp = v.maxHp = 1e6;
      const res = [];
      for (let k = 0; k < 400; k++) res.push(resolveAttack(game, a, v, naturalSpec(a)));
      const rate = res.filter((x) => x.hit).length / res.length;
      const want = hitChance(Math.floor(6 / 3), dvOf(game, v), 20);
      expect(Math.abs(rate - want) < 0.07, `an orc on a goblin: ${rate} landed, analytic ${want}`);
      expect(v.brain?.grudges?.[a.id] && v.brain.hurtBy === a.id && v.state === "wander", `the goblin hit by the orc: grudge ${JSON.stringify(v.brain)}, state ${v.state} (want a grudge, wander)`);
      v.hp = 1; v.maxHp = 10;
      const xp0 = p.xp;
      for (let k = 0; k < 50 && z.creatures.includes(v); k++) resolveAttack(game, a, v, naturalSpec(a));
      expect(!z.creatures.includes(v) && p.xp === xp0, `the orc's kill: dead ${!z.creatures.includes(v)}, XP ${xp0} → ${p.xp}`);
      // On you: a higher AGI is hit less often.
      const rates = {};
      for (const agi of [12, 24]) {
        setAgi(agi);
        let hit = 0;
        const hp0 = p.hp;
        for (let k = 0; k < 2000; k++) { p.hp = 1e6; if (resolveAttack(game, a, p, naturalSpec(a)).hit) hit++; }
        p.hp = hp0;
        rates[agi] = { got: hit / 2000, want: hitChance(2, dvOf(game, p), 20) };
      }
      setAgi(16);
      expect(rates[12].got > rates[24].got && Math.abs(rates[12].got - rates[12].want) < 0.04 && Math.abs(rates[24].got - rates[24].want) < 0.04,
        `an orc on you: AGI 12 hit ${rates[12].got} (want ${rates[12].want}), AGI 24 hit ${rates[24].got} (want ${rates[24].want})`);
      stats.creatures = { orcOnGoblin: { got: rate, want }, onYou: rates };
      game.effects.length = 0;
    }

  } finally {
    offAttack(); undoCombat(); undoDay();
    game.combatRng = null;
    Object.assign(p.attrs, savedAttrs); invalidateStats(p);
    game.log = log;
  }
  return { name: "combat", ok: problems.length === 0, problems, stats };
}
