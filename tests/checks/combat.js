// Combat (combat.js): TECH_DESIGN §3 with the d20 rules of DECISIONS (bible §10.6, §15.6), the event bus
// in place of game.win / game.onGuardian* / game.questEvent (§2.12).
//
//   checkCombat({ game, startRun, srcFiles }) → { name, ok, problems, stats }
//
//   1. The move: no penetration dice and no `pv` key anywhere; monsters.js no longer lands blows; nothing
//      calls game.win, game.onGuardianWakes/Dies or game.questEvent, and the game object has none of them.
//   2. Hit-chance tables (d20): rollToHit over 10⁵ rolls per row against hitChance() (the analytic value),
//      within ±0.02, for you (AGI, accuracy, high ground (and none in mid-jump), aimed, a weapon too heavy, a widened crit range)
//      against creatures of several levels, and for creatures against your DV. Crit rates too. One row
//      also goes through the whole resolveAttack (10⁵ blows on a goblin that can't die). A natural 20
//      hits a DV no roll can beat (5% of rolls, each a natural-20 crit), through rollToHit and resolveAttack.
//   2b. Damage and soak (d20): your blade's mean (range + material + floor((STR − req)/2) + enchantment)
//      and ×crit; a creature's armour soaks 0..AV uniformly; bare hands below a dagger; a creature's blow on you (range + level
//      bonus, ×crit), and your armour's soak 0..AV, uniformly.
//   3. Both views, one resolution: a bump duel on the map and a swing duel in 3D with the same combat RNG
//      give identical result sequences (hit, crit, natural, total, DV, damage, soak).
//   4. The planes, the dark and the core: a flatling is struck on the map and never in 3D (the bump lands,
//      the swing passes through); the Gloom Warden only with the torch out; the Colossus's core only from
//      above (from the ground every landed blow does exactly 1). In both sets.
//   5. Creatures against creatures (d20): misses happen, hits land, the victim bears a grudge, a kill gives
//      you no XP. Creatures against you: your DV decides (a higher AGI is hit less often). A miss or a
//      blow soaked to nothing still wakes its target (a hunt for you, a grudge for a creature).
//   6. The bus: "kill" carries the killer; Rook's bounty, a guardian's gate and relic, and the win come from
//      it; a guardian waking emits "guardian:wake"; "attack" follows every resolution.
//
// WS8 (TECH_DESIGN §8.3: depth, AI and targeting), each its own result:
//   checkTargeting(ctx)  the target screen and L by keys and by mouse (Tab, Esc, the line, inspect), L in 3D,
//                        requestTarget in both views, the map throw on its arc (aimed, the time it takes, out of
//                        range), the interposed-creature rule (a follower too), throw and shot parity between
//                        the views (same RNG, same results), missile weapons (ammo, reload, the pin), a knife
//                        thrown over an open edge waiting in the next zone
//   checkAiDepth(ctx)    followers and hunters over an edge in both views (and not into the record of the zone
//                        left), followers down the stairs, catch-up on re-entry, pressed flat (blows, arrows,
//                        perception, moving in the Plane), wary, flee (and cornered), follow (and swap, and
//                        Shift), AI ability use, the outdoor activity radius, the d20 log format
//   checkArena(ctx)      two factions, 100 runs: every run ends, the same seeds give the same runs, a mirror
//                        match is even, the stronger side wins
//   ttkTables(ctx)       time to kill by level band (d20 with the attribute set), with sanity bounds
//   ctx = { game, startRun, inputHandlers, keys, seedRandom, restoreRandom }
//
// game/startRun: the real game (game.js). srcFiles: [{ file, text }] of every src/ module.
import { Zone, B, FLOOR_Z } from "../../src/world.js";
import { enterZone, changeZone, cachedZone, zoneState } from "../../src/zones.js";
import { spawnCreature, addCreature, CREATURE_TYPES, pickCreatureType } from "../../src/creatures.js";
import { resolveAttack, rollToHit, hitChance, toHitMod, critNat, dvOf, weaponSpec, naturalSpec, playerMelee, bumpAttack, combatLine, thrownSpec } from "../../src/combat.js";
import { guardianThink } from "../../src/guardians.js";
import { mapStep, passTime, refreshView } from "../../src/turns.js";
import { overrideRules, RULES } from "../../src/rules.js";
import { invalidateStats, mod, maxHp, av as armourValue } from "../../src/stats.js";
import { makeBody } from "../../src/body.js";
import { makeRng, distance } from "../../src/rng.js";
import { WEAPONS, ARMOURS } from "../../src/items.js";
import { on } from "../../src/events.js";
import { setDaylight } from "../../src/light.js";
import { setMode } from "../../src/screens.js";
import { updateCreatures, recruit, AI_RULES } from "../../src/ai.js";
import { registerFaction, FACTIONS } from "../../src/factions.js";
import { registerAbility, ABILITIES } from "../../src/abilities.js";
import { addStatus, hasStatus, tickStatuses } from "../../src/status.js";
import { snapshotZone } from "../../src/save/codec.js";
import { throwReady, throwAt, updateProjectiles, THROW_TIME } from "../../src/throwing.js";
import { fire, fireAt, readyLauncher } from "../../src/missiles.js";
import { requestTarget, cursorTarget, lineOfFire, targetText } from "../../src/screens/target.js";
import { mapView } from "../../src/renderMap.js";
import { MISSILES } from "../../src/content/items/missiles.js";
import { EYE, attackTime } from "../../src/player.js";

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

function arena(key, { sky = false, w = 24, d = 16, type = "surface" } = {}) {
  const z = new Zone({ key, wx: 95, wy: 95, z: type === "surface" ? 0 : 1, type, level: 3, seed: 3, w, d, h: 16, name: "Combat Test" });
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
    if (/\bgame\.(win|onGuardianWakes|onGuardianDies|questEvent)\b|\bthis\.(win|onGuardianWakes|onGuardianDies|questEvent)\s*\(/.test(text))
      problems.push(`${file}: still calls game.win/onGuardian*/questEvent (the bus replaces them)`);
  }
  const monsters = code.find((f) => f.file === "monsters.js").text;
  const left = ["attackMonster", "hitPlayer", "hurtMonster", "creatureHits", "playerAttack"].filter((n) => monsters.includes(n));
  expect(!left.length, `monsters.js still lands blows: ${left.join(", ")}`);
  expect(!["win", "onGuardianWakes", "onGuardianDies", "questEvent"].some((k) => typeof game[k] === "function"),
    "the game object still has win/onGuardianWakes/onGuardianDies/questEvent");

  startRun(41);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  const p = game.player;
  const logged = [], log = game.log;
  game.log = (text) => logged.push(text);
  const undoCombat = overrideRules("combat", "d20");
  const undoDay = setDaylight(1);
  const attacks = [];
  const offAttack = on("attack", (g, { result }) => attacks.push(result));
  const kills = [];
  const offKill = on("kill", (g, ev) => kills.push(ev));
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
    field.set(5, 5, FLOOR_Z, B.STONE);   // a block to stand on
    stand(5.5, 5.5, FLOOR_Z + 1);
    r = row("you on high ground vs goblin L8", p, gob8, sword, {});
    expect(r.m === RULES.d20.highGround, `high ground adds ${r.m}, want +${RULES.d20.highGround}`);
    field.set(5, 5, FLOOR_Z, B.AIR);
    // In mid-jump over the same floor you stand no higher: +0 (the map can't jump).
    stand(5.5, 5.5, FLOOR_Z + 1.2); p.vz = 3;
    const jumpMod = toHitMod(game, p, gob8, sword, {});
    expect(jumpMod === 0, `in mid-jump over flat ground the to-hit is ${jumpMod}, want +0 (no high ground)`);
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

    // A natural 20 hits whatever the DV: a creature far out of reach (DV 5 + 2 + 20) is hit 5% of the
    // time through rollToHit and the whole resolution, and every hit is a natural 20 and a crit.
    {
      setAgi(10);
      const far = mk("goblin", 8);
      far.innate = { dv: 20 }; invalidateStats(far);
      far.hp = far.maxHp = 1e9;
      expect(toHitMod(game, p, far, sword, {}) + 19 <= dvOf(game, far), `the out-of-reach row isn't out of reach: mod ${toHitMod(game, p, far, sword, {})}, DV ${dvOf(game, far)}`);
      const rng = makeRng(77);
      let hits = 0, odd = 0;
      for (let k = 0; k < ROLLS; k++) { const r = rollToHit(game, p, far, sword, {}, rng); if (r.hit) { hits++; if (r.nat !== 20 || !r.crit) odd++; } }
      game.combatRng = makeRng(78);
      let full = 0, fullOdd = 0;
      for (let k = 0; k < 20000; k++) {
        const res = resolveAttack(game, p, far, sword, { view: "map" });
        if (res.hit) { full++; if (res.nat !== 20 || !res.crit) fullOdd++; }
        if ((k & 1023) === 0) { game.effects.length = 0; logged.length = 0; }
      }
      expect(Math.abs(hits / ROLLS - 0.05) <= 0.005 && odd === 0, `a natural 20 against DV ${dvOf(game, far)}: hit ${hits / ROLLS} (want 0.05), ${odd} hits that weren't a natural-20 crit`);
      expect(Math.abs(full / 20000 - 0.05) <= 0.008 && fullOdd === 0, `resolveAttack against DV ${dvOf(game, far)}: hit ${full / 20000} (want 0.05), ${fullOdd} not a natural-20 crit`);
      stats.natural20 = { dv: dvOf(game, far), rollToHit: hits / ROLLS, resolveAttack: full / 20000 };
      setAgi(16);
      game.effects.length = 0;
    }

    // --- 2b. Damage and soak (d20) ------------------------------------------------------------------------
    // Your blade: range + material + floor((STR − req) / 2) + enchantment, ×crit; a creature's armour soaks
    // a random 0..AV. A creature's blow: range + its level bonus, ×crit, then your armour soaks 0..AV.
    {
      const mean = (xs) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);
      const DT = 0.05, N = 40000;
      const dummy = mk("goblin", 1);
      dummy.hp = dummy.maxHp = 1e9;
      const blade = { ...sword, dmg: [2, 5], req: 6, ench: 1, material: 1 };   // STR 10: +floor(4/2) = +2
      const wantPlain = 3.5 + 1 + 2 + 1;
      const blows = (tgt, spec, n = N) => {
        const out = [];
        for (let k = 0; k < n; k++) {
          out.push(resolveAttack(game, p, tgt, spec, { view: "map" }));
          if ((k & 1023) === 0) { game.effects.length = 0; logged.length = 0; }
        }
        return out.filter((x) => x.hit);
      };
      game.combatRng = makeRng(31);
      let landed = blows(dummy, blade);
      const plain = mean(landed.filter((x) => !x.crit).map((x) => x.dmg)), crits = mean(landed.filter((x) => x.crit).map((x) => x.dmg));
      expect(Math.abs(plain - wantPlain) <= DT, `your blade (2-5, +1 material, +1 enchantment, STR 10 over req 6): mean ${plain.toFixed(3)}, want ${wantPlain}`);
      expect(Math.abs(crits - wantPlain * RULES.d20.crit) <= DT * 4, `your crits: mean ${crits.toFixed(3)}, want ×${RULES.d20.crit} = ${wantPlain * RULES.d20.crit}`);
      expect(landed.every((x) => x.soaked === 0), "a creature with no armour soaked a blow");
      // Its armour: 0..4 at random, uniformly.
      dummy.armour = 4;
      landed = blows(dummy, blade);
      const soaks = landed.map((x) => x.soaked), counts = [0, 1, 2, 3, 4].map((v) => soaks.filter((s) => s === v).length / soaks.length);
      expect(soaks.every((s) => s >= 0 && s <= 4) && counts.every((c) => Math.abs(c - 0.2) <= 0.02) && Math.abs(mean(soaks) - 2) <= DT,
        `a creature's AV 4 soaks ${counts.map((c) => c.toFixed(3))} of 0..4 (mean ${mean(soaks).toFixed(3)}), want 0.2 each, mean 2`);
      expect(landed.every((x) => x.dmg + x.soaked >= 6), "a blow on an armoured creature lost more than its soak");
      dummy.armour = 0;
      // Bare hands never outdo a weapon: fists (1-2, STR over RULES.d20.fistReq) below the dagger.
      const heldBody = p.body;
      p.body = makeBody(p.body?.plan || "humanoid"); invalidateStats(p);
      const fistSpec = weaponSpec(p);
      p.body = heldBody; invalidateStats(p);
      const dagger = { kind: "melee", weapon: null, dmg: [...WEAPONS.dagger.dmg], ench: 0, element: null, req: WEAPONS.dagger.str, acc: 0, material: 0 };
      const fistMean = mean(blows(dummy, fistSpec, 20000).filter((x) => !x.crit).map((x) => x.dmg));
      const daggerMean = mean(blows(dummy, dagger, 20000).filter((x) => !x.crit).map((x) => x.dmg));
      expect(fistSpec.fists && fistMean < daggerMean, `bare hands mean ${fistMean.toFixed(3)} against the dagger's ${daggerMean.toFixed(3)} (want less)`);
      stats.damage = { yours: { plain: +plain.toFixed(3), crit: +crits.toFixed(3), want: wantPlain }, creatureSoak: counts.map((c) => +c.toFixed(3)),
                       fists: +fistMean.toFixed(3), dagger: +daggerMean.toFixed(3) };
      // A creature's blow on you (goblin level 5: 2-4 + 1). First with no armour, then with AV 4.
      const biter = mk("goblin", 5);
      const wantBite = 3 + 1;
      const onYou = (n = N) => {
        const out = [];
        for (let k = 0; k < n; k++) {
          p.hp = 1e6;
          out.push(resolveAttack(game, biter, p, naturalSpec(biter)));
          if ((k & 1023) === 0) { game.effects.length = 0; logged.length = 0; }
        }
        p.hp = maxHp(p);
        return out.filter((x) => x.hit);
      };
      const savedBody = p.body;
      p.body = makeBody(p.body?.plan || "humanoid");   // nothing worn: AV 0
      invalidateStats(p);
      const av0 = armourValue(p);
      game.combatRng = makeRng(32);
      let bites = onYou();
      const bPlain = mean(bites.filter((x) => !x.crit).map((x) => x.dmg)), bCrit = mean(bites.filter((x) => x.crit).map((x) => x.dmg));
      expect(av0 === 0 && bites.every((x) => x.soaked === 0), `with nothing worn your AV is ${av0} and blows were soaked`);
      expect(Math.abs(bPlain - wantBite) <= DT && Math.abs(bCrit - wantBite * RULES.d20.crit) <= DT * 4,
        `a level-5 goblin's blow on you: mean ${bPlain.toFixed(3)} (want ${wantBite}), crits ${bCrit.toFixed(3)} (want ${wantBite * RULES.d20.crit})`);
      p.innate = { armour: 4 }; invalidateStats(p);
      const av4 = armourValue(p);
      bites = onYou();
      const ySoaks = bites.map((x) => x.soaked), yCounts = [0, 1, 2, 3, 4].map((v) => ySoaks.filter((s) => s === v).length / ySoaks.length);
      expect(av4 === 4 && yCounts.every((c) => Math.abs(c - 0.2) <= 0.02),
        `your AV ${av4} soaks ${yCounts.map((c) => c.toFixed(3))} of 0..4, want 0.2 each`);
      expect(bites.every((x) => x.dmg >= 0 && x.dmg <= (x.crit ? RULES.d20.crit : 1) * 5), "a blow on you did more than its range (×crit) allows");
      delete p.innate; p.body = savedBody; invalidateStats(p);
      stats.damage.onYou = { plain: +bPlain.toFixed(3), crit: +bCrit.toFixed(3), want: wantBite, soak: yCounts.map((c) => +c.toFixed(3)) };
      game.effects.length = 0;
    }
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
      kills.length = 0;
      for (let k = 0; k < 50 && z.creatures.includes(v); k++) resolveAttack(game, a, v, naturalSpec(a));
      expect(!z.creatures.includes(v) && p.xp === xp0 && kills[0]?.src === a, `the orc's kill: dead ${!z.creatures.includes(v)}, XP ${xp0} → ${p.xp}, kill src ${kills[0]?.src?.name}`);
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
      // A miss or a blow soaked to nothing still wakes its target: a sleeping Colossus you swing at and
      // miss (a natural 1) hunts you; a goblin whose hide turns your blow hunts you; a goblin an orc
      // misses bears it a grudge.
      const woke = {};
      const col = addCreature(z, spawnCreature("colossus", 4, 2, FLOOR_Z, { rng: () => 0.5, level: 9, state: "idle" }));
      col.hp = col.maxHp = 1e6; col.cd = Infinity;
      let res0 = resolveAttack(game, p, col, weaponSpec(p), { view: "map", rng: () => 0 });
      woke.colossusMiss = { hit: res0.hit, nat: res0.nat, state: col.state };
      const hide = addCreature(z, spawnCreature("goblin", 3, 3, FLOOR_Z, { rng: () => 0.5, level: 1, state: "idle" }));
      hide.armour = 1000; hide.hp = hide.maxHp = 1e6;
      res0 = resolveAttack(game, p, hide, weaponSpec(p), { view: "map", rng: () => 0.7 });
      woke.soaked = { hit: res0.hit, dmg: res0.dmg, state: hide.state };
      const sleeper = addCreature(z, spawnCreature("goblin", 12, 8, FLOOR_Z, { rng: () => 0.5, level: 1, state: "idle" }));
      res0 = resolveAttack(game, a, sleeper, naturalSpec(a), { rng: () => 0 });
      woke.orcMiss = { hit: res0.hit, state: sleeper.state, grudge: !!sleeper.brain?.grudges?.[a.id] };
      expect(!woke.colossusMiss.hit && woke.colossusMiss.state === "chase", `a missed Colossus: ${JSON.stringify(woke.colossusMiss)} (want a miss and chase)`);
      expect(woke.soaked.hit && woke.soaked.dmg === 0 && woke.soaked.state === "chase", `a goblin whose hide turns your blow: ${JSON.stringify(woke.soaked)} (want hit, 0 damage, chase)`);
      expect(!woke.orcMiss.hit && woke.orcMiss.state === "wander" && woke.orcMiss.grudge, `a goblin the orc missed: ${JSON.stringify(woke.orcMiss)} (want a grudge, wander)`);
      for (const c of [col, hide, sleeper]) z.creatures.splice(z.creatures.indexOf(c), 1);
      stats.creatures = { orcOnGoblin: { got: rate, want }, onYou: rates, woke };
      game.effects.length = 0;
    }

    // --- 6. The bus ----------------------------------------------------------------------------------------
    {
      const z = arena("combat-bus");
      enterZone(game, z, { how: "start" });
      stand(2.5, 2.5);
      // Rook's quarry.
      const quarry = addCreature(z, spawnCreature("goblin", 8, 8, FLOOR_Z, { rng: () => 0.5, level: 3 }));
      quarry.bounty = true; quarry.hp = 1;
      logged.length = 0; kills.length = 0;
      const undoSet = overrideRules("combat", "legacy");   // (every legacy blow lands)
      resolveAttack(game, p, quarry, weaponSpec(p), { view: "map" });
      expect(quarry.killed === true && logged.some((t) => t.includes("Rook's quarry")) && kills[0]?.src === p,
        `the bounty: killed ${quarry.killed}, log ${JSON.stringify(logged.slice(0, 3))}, src ${kills[0]?.src === p ? "you" : kills[0]?.src}`);
      // A guardian wakes, then falls: the gate opens and a relic lies where it stood.
      const wakes = [];
      const offWake = on("guardian:wake", (g, { c }) => wakes.push(c.name));
      const queen = addCreature(z, spawnCreature("colossus", 12, 8, FLOOR_Z, { rng: () => 0.5, level: 9, state: "chase" }));
      z.set(15, 8, FLOOR_Z, B.STONE); z.guardianHall = { gate: [[15, 8, FLOOR_Z]] };
      guardianThink(game, queen, 0.1, new Int32Array(z.w * z.d));
      const items0 = z.items.length;
      queen.hp = 1; stand(12.5, 8.5, FLOOR_Z + 3);
      resolveAttack(game, p, queen, weaponSpec(p), { view: "3d" });
      expect(wakes.length === 1 && z.get(15, 8, FLOOR_Z) === B.AIR && z.items.length === items0 + 1,
        `the Colossus: woke ${wakes.length} (want 1), gate ${z.get(15, 8, FLOOR_Z) === B.AIR ? "open" : "shut"}, items ${items0} → ${z.items.length}`);
      offWake();
      // The Lich King: the win.
      const lich = addCreature(z, spawnCreature("lich", 6, 10, FLOOR_Z, { rng: () => 0.5, level: 20 }));
      lich.hp = 1; stand(5.5, 10.5);
      logged.length = 0;
      resolveAttack(game, p, lich, weaponSpec(p), { view: "map" });
      expect(logged.some((t) => t.includes("You have won")) && !!game.pages, `the Lich King's death didn't win the run: ${JSON.stringify(logged.slice(0, 3))}`);
      game.pages = null;
      undoSet();
      expect(attacks.length > 0 && attacks.every((x) => "hit" in x && "touched" in x), "\"attack\" events missing or malformed");
      stats.bus = { bounty: !!quarry.killed, guardianWakes: wakes.length, kills: kills.map((k) => k.c.type), won: true };
    }
  } finally {
    offAttack(); offKill(); undoCombat(); undoDay();
    game.combatRng = null;
    Object.assign(p.attrs, savedAttrs); invalidateStats(p);
    game.log = log;
  }
  return { name: "combat", ok: problems.length === 0, problems, stats };
}

// =============================================================================================================
// WS8: depth, AI and targeting.
// =============================================================================================================
// A fresh run on `seed` (d20 unless asked), with the log caught and everything put back by restore().
function fresh(ctx, seed, { d20 = true } = {}) {
  const { game, startRun } = ctx;
  startRun(seed);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  const logged = [], log = game.log, undo = [setDaylight(1)];
  game.log = (text) => logged.push(text);
  if (d20) undo.push(overrideRules("combat", "d20"));
  return { logged, restore() { game.log = log; while (undo.length) undo.pop()(); game.combatRng = null; } };
}
const resultOf = (name, problems, stats, notes = []) => ({ name, ok: problems.length === 0, problems, stats, notes });
// A creature that stands still and can't die (but can be hit): pinned for good, never striking.
function dummy(z, type, x, y, level = 3, state = "chase") {
  const c = addCreature(z, spawnCreature(type, x, y, FLOOR_Z, { rng: () => 0.5, level, state }));
  c.hp = c.maxHp = 1e9; c.cd = Infinity; c.shot = Infinity;
  c.status.pinned = { t: Infinity, mag: 1, src: null, acc: 0 };
  return c;
}
const onMap = (game) => { game.view = "map"; setMode(game, "map", null, { pointer: false }); };
const in3d = (game) => { game.view = "3d"; setMode(game, "explore", null, { pointer: false }); game.paused = false; };
const aimAt = (p, c) => { p.yaw = Math.atan2(c.y - p.y, c.x - p.x); p.pitch = Math.atan2(c.z + c.h * 0.6 - (p.z + EYE), distance(c.x - p.x, c.y - p.y)); };
const tuple = (r) => [r.touched, r.hit, r.crit, r.nat, r.total, r.dv, r.dmg, r.soaked].join(",");

// --- The target screen, L, requestTarget, throws and shots -------------------------------------------------
export function checkTargeting(ctx) {
  const { game, inputHandlers } = ctx;
  const problems = [], stats = {};
  const expect = (ok, m) => { if (!ok) problems.push(m); return ok; };
  const run = fresh(ctx, 77);
  const p = game.player;
  const inspects = [], attacks = [];
  const offs = [on("inspect", (g, e) => inspects.push(e)), on("attack", (g, { result }) => attacks.push(result))];
  const key = (code, k = "") => inputHandlers.onKeyDown(code, false, k);
  try {
    // --- 1. L on the map: keys ---------------------------------------------------------------------------
    const z = arena("ws8-look", { w: 30, d: 16 });
    enterZone(game, z, { how: "start" });
    z.seen.fill(1);
    Object.assign(p, { x: 5.5, y: 5.5, z: FLOOR_Z });
    const gob = dummy(z, "goblin", 9, 5);
    const ess = addCreature(z, spawnCreature("maren", 14, 9, FLOOR_Z, {}));
    onMap(game); refreshView(game);
    key("KeyL");
    expect(game.mode === "target" && cursorTarget(game)?.creature === gob, `L on the map: mode ${game.mode}, cursor on ${cursorTarget(game)?.creature?.name ?? "nothing"} (want the goblin, the nearest)`);
    key("Tab");
    expect(cursorTarget(game)?.creature === ess, `Tab: the cursor went to ${cursorTarget(game)?.creature?.name ?? JSON.stringify(cursorTarget(game)?.tile)} (want Maren)`);
    key("Tab");
    key("ArrowLeft"); key("ArrowLeft"); key("ArrowDown");
    const moved = cursorTarget(game)?.tile;
    expect(moved?.x === 7 && moved?.y === 6, `arrows moved the cursor to ${JSON.stringify(moved)} (want 7,6)`);
    key("Enter");
    expect(game.mode === "map" && inspects.length === 1 && inspects[0].open === true && inspects[0].x === 7 && inspects[0].y === 6,
      `Enter: mode ${game.mode}, ${inspects.length} inspect(s) ${JSON.stringify(inspects.map((e) => [e.x, e.y, e.open]))} (want one, open, at 7,6)`);
    key("KeyL"); key("Escape");
    expect(game.mode === "map" && inspects.length === 1, `Esc: mode ${game.mode}, ${inspects.length} inspects (want map, no new one)`);
    key("KeyL"); key("KeyL");   // L twice: a look at the nearest at once
    const lastLook = run.logged[run.logged.length - 1] || "";
    expect(inspects.length === 2 && inspects[1].creature === gob && /% to hit/.test(lastLook) && /level 3/.test(lastLook),
      `LL: ${inspects.length} inspects, creature ${inspects[1]?.creature?.name}, line "${lastLook}" (want the goblin, its level and your chance)`);
    stats.look = { keys: "L, Tab, arrows, Enter, Esc, LL", line: lastLook };
    // --- 2. L on the map: the mouse ------------------------------------------------------------------------
    key("KeyL");
    game.debug.draw();
    const c1 = { x: (12 - mapView.tx0) * 2 + 0.5, y: mapView.top + 7 - mapView.ty0 + 0.5 };
    inputHandlers.onHover(c1.x, c1.y);
    const hovered = cursorTarget(game)?.tile;
    inputHandlers.onMouseDown(0, c1.x, c1.y);
    expect(hovered?.x === 12 && hovered?.y === 7 && inspects.length === 3 && inspects[2].x === 12 && inspects[2].y === 7 && game.mode === "map",
      `the mouse: hover put the cursor on ${JSON.stringify(hovered)}, the click emitted ${inspects.length - 2} inspect at ${JSON.stringify(inspects[2] && [inspects[2].x, inspects[2].y])}`);
    key("KeyL");
    inputHandlers.onMouseDown(2, c1.x, c1.y);
    expect(game.mode === "map" && inspects.length === 3, `a right click cancels: mode ${game.mode}, inspects ${inspects.length}`);
    // The screen draws its header and the line under the cursor.
    key("KeyL"); key("Tab"); key("Tab");
    game.debug.draw();
    const frame = targetText(game);
    expect(/LOOK/.test(frame.top) && /Maren|goblin/.test(frame.bottom), `the look screen's rows: "${frame.top.trim().slice(0, 60)}" / "${frame.bottom.trim().slice(0, 80)}"`);
    key("Escape");
    // --- 3. L in 3D ---------------------------------------------------------------------------------------
    in3d(game); Object.assign(p, { x: 5.5, y: 5.5, z: FLOOR_Z }); aimAt(p, gob);
    key("KeyL");
    expect(inspects.length === 4 && inspects[3].creature === gob && inspects[3].open === true && game.mode === "explore",
      `L in 3D: ${inspects.length - 3} inspect, creature ${inspects[3]?.creature?.name} (want the goblin in the crosshair, open)`);
    stats.look3d = run.logged[run.logged.length - 1];
    // --- 4. requestTarget ---------------------------------------------------------------------------------
    let got = "none";
    requestTarget(game, { name: "Test", range: 8 }, (t) => { got = t; });
    expect(got !== "none" && got?.creature === gob, `requestTarget in 3D: ${got === "none" ? "no answer at once" : got?.creature?.name ?? "no creature"} (want the goblin, at once)`);
    onMap(game); refreshView(game);
    got = "none";
    requestTarget(game, { name: "Test", range: 8 }, (t) => { got = t; });
    expect(game.mode === "target" && got === "none", `requestTarget on the map: mode ${game.mode}, answered ${got === "none" ? "not yet" : "at once"} (want the screen)`);
    key("Enter");
    expect(got?.creature === gob && game.mode === "map", `requestTarget on the map: Enter gave ${got?.creature?.name ?? got}`);
    got = "none";
    requestTarget(game, { name: "Test", range: 8 }, (t) => { got = t; });
    key("Escape");
    expect(got === null, `requestTarget on the map: Esc gave ${got} (want null)`);
    // --- 5. The map throw: T, the line, the hit chance, the arc, the time -----------------------------------
    p.inv = p.inv.filter((s) => s.kind !== "knife"); p.inv.push({ kind: "knife", count: 20 });
    key("KeyT");
    game.debug.draw();
    const tf = targetText(game);
    expect(game.mode === "target" && /THROW/.test(tf.top) && /% to hit/.test(tf.bottom), `T on the map (d20): mode ${game.mode}, "${tf.top.trim().slice(0, 40)}" / "${tf.bottom.trim().slice(0, 80)}"`);
    const fire0 = lineOfFire(game, game.modeStack[game.modeStack.length - 1].data);
    expect(fire0.end === "clear" && fire0.tiles.length >= 3, `the line of fire at the goblin: ${fire0.end}, ${fire0.tiles.length} tiles`);
    const t0 = game.time;
    attacks.length = 0;
    game.combatRng = makeRng(5);
    key("KeyT");   // T twice: throw at it
    const thrown = attacks.find((a) => a.tgt === gob);
    expect(game.mode === "map" && thrown && thrown.mod === toHitMod(game, p, gob, thrownSpec(game), { aimed: true }) && game.time - t0 >= THROW_TIME - 1e-6,
      `TT: mode ${game.mode}, the knife ${thrown ? `reached the goblin with mod ${thrown.mod}` : "didn't reach it"}, ${(game.time - t0).toFixed(2)} s passed`);
    key("KeyT");
    for (let k = 0; k < 14; k++) key("ArrowRight");
    const n0 = run.logged.length;
    key("Enter");
    expect(game.mode === "target" && run.logged.slice(n0).some((t) => /tiles away/.test(t)), `a throw out of range: mode ${game.mode}, log ${JSON.stringify(run.logged.slice(n0))}`);
    key("Escape");
    // --- 6. The interposed creature (a follower too) -------------------------------------------------------
    const near = dummy(z, "orc", 7, 5);   // (a rat is short: a knife thrown at the goblin flies over it)
    refreshView(game);
    const far = { creature: gob, point: { x: gob.x, y: gob.y, z: gob.z }, tile: { x: 9, y: 5 }, dir: [1, 0, 0] };
    key("KeyT");
    const data = game.modeStack[game.modeStack.length - 1].data;
    data.cursor = { x: 9, y: 5 };
    const lf = lineOfFire(game, data);
    key("Escape");
    expect(lf.end === "interposed" && lf.hit === near, `the line of fire through the orc: ${lf.end}, first hit ${lf.hit?.name}`);
    attacks.length = 0;
    const knives = () => p.inv.find((s) => s.kind === "knife");
    let pr = throwAt(game, knives(), far);
    for (let k = 0; k < 200 && z.projectiles.includes(pr); k++) updateProjectiles(game, 1 / 60);
    expect(attacks[0]?.tgt === near && !attacks.some((a) => a.tgt === gob), `a knife thrown at the goblin with the orc in the way hit ${attacks.map((a) => a.tgt.name).join(", ") || "nothing"} (want the orc)`);
    recruit(game, near);
    attacks.length = 0;
    pr = throwAt(game, knives(), far);
    for (let k = 0; k < 200 && z.projectiles.includes(pr); k++) updateProjectiles(game, 1 / 60);
    expect(attacks[0]?.tgt === near, `your follower in the way is hit too: ${attacks.map((a) => a.tgt.name).join(", ") || "nothing"}`);
    Object.assign(near, { tx: 7, ty: 9, nx: 7, ny: 9, x: 7.5, y: 9.5 });
    attacks.length = 0;
    pr = throwAt(game, knives(), far);
    for (let k = 0; k < 200 && z.projectiles.includes(pr); k++) updateProjectiles(game, 1 / 60);
    expect(attacks[0]?.tgt === gob, `with the orc out of the way the knife hit ${attacks[0]?.tgt?.name ?? "nothing"} (want the goblin)`);
    stats.interposed = { line: lf.end, firstHit: lf.hit?.name, overARat: "flies over", follower: "hit", clear: "goblin" };
    z.creatures.splice(z.creatures.indexOf(near), 1);
    // --- 7. Parity: throws and shots, map and 3D, one RNG ---------------------------------------------------
    const parity = (kind) => {
      const out = { map: [], "3d": [] };
      for (const view of ["map", "3d"]) {
        const pz = arena(`ws8-parity-${kind}-${view}`, { w: 24, d: 12 });
        enterZone(game, pz, { how: "start" });
        pz.seen.fill(1);
        Object.assign(p, { x: 4.5, y: 5.5, z: FLOOR_Z, vz: 0 });
        const tgt = dummy(pz, "orc", 7, 5, 6);
        p.inv = p.inv.filter((s) => !["knife", "missile", "ammo"].includes(s.kind));
        p.inv.push({ kind: "knife", count: 200 }, { kind: "missile", id: "boltBow", ench: 1 }, { kind: "ammo", effect: "bolt", count: 200 });
        game.combatRng = makeRng(kind === "knife" ? 314 : 271);
        attacks.length = 0;
        if (view === "map") { onMap(game); refreshView(game); } else in3d(game);
        for (let k = 0; k < 60; k++) {
          p.cooldowns.missile = 0; p.throwCd = 0;
          tgt.status.stunned && delete tgt.status.stunned;
          if (view === "map") {
            const target = { creature: tgt, point: { x: tgt.x, y: tgt.y, z: tgt.z }, tile: { x: 7, y: 5 }, dir: [1, 0, 0] };
            const q = kind === "knife" ? throwAt(game, p.inv.find((s) => s.kind === "knife"), target) : fireAt(game, readyLauncher(p), target);
            for (let s = 0; s < 240 && pz.projectiles.includes(q); s++) updateProjectiles(game, 1 / 60);
          } else {
            aimAt(p, tgt);
            if (kind === "knife") throwReady(game, p.inv.find((s) => s.kind === "knife")); else fire(game);
            for (let s = 0; s < 240 && pz.projectiles.length; s++) updateProjectiles(game, 1 / 60);
          }
          game.effects.length = 0; run.logged.length = 0;
        }
        out[view] = attacks.filter((a) => a.tgt === tgt).map(tuple);
      }
      return out;
    };
    for (const kind of ["knife", "bolt"]) {
      const r = parity(kind);
      const diff = r.map.findIndex((s, k) => s !== r["3d"][k]);
      expect(r.map.length === 60 && r["3d"].length === 60 && diff < 0,
        `${kind} parity: ${r.map.length} on the map, ${r["3d"].length} in 3D reached the orc; first difference at ${diff}: ${r.map[diff]} vs ${r["3d"][diff]}`);
      stats[`parity_${kind}`] = { shots: r.map.length, identical: diff < 0, hits: r.map.filter((s) => s.split(",")[1] === "true").length };
    }
    // --- 8. Missile weapons: ammo, reload, the pin, no ammo ---------------------------------------------------
    {
      const mz = arena("ws8-missiles", { w: 24, d: 12 });
      enterZone(game, mz, { how: "start" }); mz.seen.fill(1);
      Object.assign(p, { x: 4.5, y: 5.5, z: FLOOR_Z, vz: 0 });
      const tgt = dummy(mz, "orc", 9, 5, 6);
      delete tgt.status.pinned;
      p.inv = p.inv.filter((s) => !["missile", "ammo"].includes(s.kind));
      p.inv.push({ kind: "missile", id: "boltBow", ench: 0 }, { kind: "ammo", effect: "bolt", count: 2 });
      in3d(game); aimAt(p, tgt); p.cooldowns.missile = 0;
      game.combatRng = () => 0.97;   // a natural 20: it hits, and the pin's roll comes through
      const first = fire(game), second = fire(game);
      for (let s = 0; s < 240 && mz.projectiles.length; s++) updateProjectiles(game, 1 / 60);
      const left = p.inv.find((s) => s.kind === "ammo")?.count;
      expect(first && !second && left === 1 && hasStatus(tgt, "pinned"), `the bolt-bow: fired ${first}, again at once ${second} (want refused: reloading), bolts left ${left} (want 1), the orc pinned ${hasStatus(tgt, "pinned")}`);
      tickStatuses(game, p, MISSILES.boltBow.reload + 0.01);
      expect(fire(game) && fire(game) === false, "after the reload it fires again, then reloads");
      tickStatuses(game, p, 2);
      const n1 = run.logged.length;
      expect(!fire(game) && run.logged.slice(n1).some((t) => /no bolts/.test(t)), `with no bolts: ${JSON.stringify(run.logged.slice(n1))}`);
      for (let s = 0; s < 240 && mz.projectiles.length; s++) updateProjectiles(game, 1 / 60);
      const dropped = mz.items.filter((it) => it.kind === "ammo").reduce((n, it) => n + (it.count || 1), 0);
      stats.missiles = { reload: MISSILES.boltBow.reload, pinned: true, boltsOnTheFloor: dropped };
      game.combatRng = null;
    }
    // --- 9. A knife over an open edge lands in the next zone ------------------------------------------------
    {
      changeZone(game, "0,0,0", { how: "travel" });
      const tz = game.zone;
      let y = -1;
      for (let yy = 4; yy < tz.d - 4 && y < 0; yy++) if (tz.stand[tz.w - 2 + yy * tz.w] >= 0 && tz.edges.e) y = yy;
      expect(y >= 0, "the temple has no open east border to throw over");
      if (y >= 0) {
        in3d(game);
        Object.assign(p, { x: tz.w - 1.5, y: y + 0.5, z: tz.stand[tz.w - 2 + y * tz.w], vz: 0, yaw: 0, pitch: 0.15, throwCd: 0 });
        p.inv = p.inv.filter((s) => s.kind !== "knife"); p.inv.push({ kind: "knife", count: 3 });
        const before = (zoneState(game).zonePatches["1,0,0"] || []).length;
        const items0 = tz.items.length;
        let landed = null;
        for (let tries = 0; tries < 12 && !landed; tries++) {   // a knife snaps 1 time in 5: throw until one lands
          p.throwCd = 0; throwReady(game, p.inv.find((s) => s.kind === "knife"));
          let maxX = 0;
          for (let s = 0; s < 300 && tz.projectiles.length; s++) { updateProjectiles(game, 1 / 60); for (const q of tz.projectiles) maxX = Math.max(maxX, q.x); }
          const patches = (zoneState(game).zonePatches["1,0,0"] || []).filter((q) => q.op === "landItem");
          if (patches.length > before) landed = { patch: patches[patches.length - 1], maxX };
          else if (tz.items.length > items0) break;
        }
        expect(landed && landed.maxX > tz.w, `no knife thrown east over the temple's border came down in 1,0,0 (${landed ? `flew to x ${landed.maxX.toFixed(1)}` : "none"})`);
        if (landed) {
          changeZone(game, "1,0,0", { how: "travel" });
          const k = game.zone.items.find((it) => it.kind === "knife" && Math.floor(it.x) <= Math.ceil(landed.patch.depth) + 1);
          expect(!!k, `entering 1,0,0: the knife isn't there (patch ${JSON.stringify(landed.patch)})`);
          stats.overTheEdge = { flewTo: +landed.maxX.toFixed(2), border: tz.w, landed: k ? [Math.floor(k.x), Math.floor(k.y)] : null };
        }
      }
    }
  } finally {
    for (const off of offs) off();
    run.restore();
  }
  return resultOf("combat: targeting, look, throws and missile weapons (WS8)", problems, stats);
}

// --- Followers and hunters, catch-up, the Plane, wary, flee, follow, abilities, the radius, the log ---------
export function checkAiDepth(ctx) {
  const { game } = ctx;
  const problems = [], stats = {};
  const expect = (ok, m) => { if (!ok) problems.push(m); return ok; };
  const attacks = [];
  const off = on("attack", (g, { result }) => attacks.push(result));
  let run = null;
  const added = { factions: [], abilities: [] };
  try {
    // --- 1. Over an edge, in both views; by the stairs ----------------------------------------------------------
    const edge = {};
    for (const view of ["map", "3d"]) {
      run = fresh(ctx, 4242);
      const p = game.player;
      changeZone(game, "0,0,0", { how: "travel" });
      const z0 = game.zone;
      // A row with level ground under the east border and the 12 tiles before it.
      let y = -1;
      for (let yy = 4; yy < z0.d - 4 && y < 0; yy++) {
        let ok = !!z0.edges.e;
        for (let x = z0.w - 13; x < z0.w && ok; x++) if (z0.stand[x + yy * z0.w] < 0 || Math.abs(z0.stand[x + yy * z0.w] - z0.stand[z0.w - 1 + yy * z0.w]) > 1) ok = false;
        if (ok) y = yy;
      }
      if (!expect(y >= 0, "no level run of 13 tiles up to the temple's east border")) { run.restore(); run = null; break; }
      const s = (x) => z0.stand[x + y * z0.w];
      z0.creatures = z0.creatures.filter((c) => c.talk);
      Object.assign(p, { x: z0.w - 0.5, y: y + 0.5, z: s(z0.w - 1), vz: 0, yaw: 0, pitch: 0 });
      const mk = (type, x, state) => addCreature(z0, spawnCreature(type, x, y, s(x), { rng: () => 0.5, level: 2, state }));
      const follower = recruit(game, mk("goblin", z0.w - 3, "wander"));
      const hunter = mk("rat", z0.w - 5, "chase");
      const farHunter = mk("rat", z0.w - 12, "chase");
      for (const c of [hunter, farHunter]) c.cd = Infinity;
      if (view === "map") { onMap(game); mapStep(game, 1, 0, { force: false }); }
      else { in3d(game); p.x = z0.w + 0.6; game.debug.update(1 / 60); }
      const z1 = game.zone;
      const there = (c) => z1.creatures.includes(c), left = (c) => z0.creatures.includes(c);
      expect(z1.key === "1,0,0" && there(follower) && there(hunter) && !there(farHunter) && !left(follower) && !left(hunter) && left(farHunter),
        `${view}: over the edge into ${z1.key}: follower there ${there(follower)} (left behind ${left(follower)}), hunter at 4 tiles there ${there(hunter)}, hunter at 11 tiles there ${there(farHunter)}`);
      expect(follower.brain?.arriving > 0 && hunter.brain?.arriving > 0 && follower.tx <= 2 && hunter.tx <= 2,
        `${view}: they come in at the west border, a moment later: arriving ${follower.brain?.arriving?.toFixed(2)} / ${hunter.brain?.arriving?.toFixed(2)}, at x ${follower.tx} / ${hunter.tx}`);
      const rec = JSON.parse(snapshotZone(z0, {}).json);
      expect(!rec.creatures.some((c) => c.id === follower.id || c.id === hunter.id), `${view}: the record of the zone you left still holds the creatures that went with you`);
      // They arrive, and get on with it.
      if (view === "map") passTime(game, 3); else for (let k = 0; k < 180; k++) game.debug.update(1 / 60);
      expect(!follower.brain.arriving && !hunter.brain.arriving && distance(follower.x - p.x, follower.y - p.y) <= AI_RULES.follow.far + 1.5,
        `${view}: after 3 s: arriving ${follower.brain.arriving}/${hunter.brain.arriving}, follower ${distance(follower.x - p.x, follower.y - p.y).toFixed(1)} tiles from you`);
      edge[view] = { follower: "came", hunterAt4: "came", hunterAt11: "stayed", arrivedIn: "< 3 s" };
      run.restore(); run = null;
    }
    stats.edge = edge;
    {
      run = fresh(ctx, 4242);
      const p = game.player;
      changeZone(game, "0,0,1", { how: "down" });
      const z = game.zone;
      const spot = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]].map(([ox, oy]) => [Math.floor(p.x) + ox, Math.floor(p.y) + oy])
        .find(([x, y]) => z.stand[x + y * z.w] >= 0 && !z.creatures.some((c) => c.tx === x && c.ty === y));
      const sz = z.stand[spot[0] + spot[1] * z.w];
      const f = recruit(game, addCreature(z, spawnCreature("goblin", spot[0], spot[1], sz, { rng: () => 0.5, level: 2 })));
      const h = addCreature(z, spawnCreature("rat", spot[0], spot[1], sz, { rng: () => 0.5, level: 2, state: "chase" }));
      changeZone(game, "0,0,2", { how: "down" });
      expect(game.zone.creatures.includes(f) && !game.zone.creatures.includes(h), `down the stairs: the follower came ${game.zone.creatures.includes(f)}, the hunter came ${game.zone.creatures.includes(h)} (want only the follower)`);
      stats.stairs = { follower: game.zone.creatures.includes(f), hunter: game.zone.creatures.includes(h) };
      run.restore(); run = null;
    }

    // --- 2. Catch-up on re-entry ---------------------------------------------------------------------------------
    {
      run = fresh(ctx, 4242);
      changeZone(game, "0,0,1", { how: "down" });
      const z = game.zone, p = game.player;
      const gs = z.creatures.filter((c) => !c.talk && c.maxHp >= 4 && distance(c.x - p.x, c.y - p.y) > AI_RULES.follow.edge).slice(0, 2);
      if (expect(gs.length === 2, "level 1 has no two creatures to leave behind")) {
        const [a, b] = gs;
        a.hp = 2; addStatus(game, a, "chilled", { t: 5 }); a.state = "chase";
        b.maxHp = 60; b.hp = 2; b.state = "chase";   // (60: 600 s heals a sixth, 10)
        changeZone(game, "0,0,2", { how: "down" });
        game.time += 600;
        changeZone(game, "0,0,1", { how: "up" });
        const partB = b.hp;
        expect(partB === Math.min(b.maxHp, 2 + Math.floor((b.maxHp * 600) / AI_RULES.heal.fullAfter)) && b.state !== "chase" && !hasStatus(a, "chilled"),
          `600 s away: hp 2 → ${partB} of ${b.maxHp} (want +${Math.floor((b.maxHp * 600) / 3600)}), still hunting ${b.state === "chase"}, still chilled ${hasStatus(a, "chilled")}`);
        changeZone(game, "0,0,2", { how: "down" });
        game.time += 3600;
        changeZone(game, "0,0,1", { how: "up" });
        expect(a.hp === a.maxHp && b.hp === b.maxHp, `an hour away: hp ${a.hp}/${a.maxHp}, ${b.hp}/${b.maxHp} (want full)`);
        stats.catchUp = { after600s: `${partB}/${b.maxHp}`, after3600s: "full", chilled: "gone", hunt: "lapsed" };
      }
      run.restore(); run = null;
    }

    // --- 3. Pressed flat -------------------------------------------------------------------------------------------
    {
      run = fresh(ctx, 91);
      const p = game.player;
      const z = arena("ws8-flat", { w: 24, d: 14 });
      // A hole at 8,5; a closed door at 10,5; a wall at 12,4; a 2-block ledge at 7,8; a 3-block one at 7,10; a lever at 4,8.
      for (let k = 0; k < FLOOR_Z; k++) z.set(8, 5, k, B.AIR);
      z.set(10, 5, FLOOR_Z, B.DOOR); z.set(10, 5, FLOOR_Z + 1, B.DOOR);
      for (let k = FLOOR_Z; k < FLOOR_Z + 3; k++) z.set(12, 4, k, B.STONE);
      z.set(7, 8, FLOOR_Z, B.STONE); z.set(7, 8, FLOOR_Z + 1, B.STONE);
      for (let k = FLOOR_Z; k < FLOOR_Z + 3; k++) z.set(7, 10, k, B.STONE);
      z.set(4, 8, FLOOR_Z, B.LEVER);
      z.refresh();
      enterZone(game, z, { how: "start" }); z.seen.fill(1);
      Object.assign(p, { x: 6.5, y: 5.5, z: FLOOR_Z, vz: 0 });
      onMap(game);
      const deep = addCreature(z, spawnCreature("goblin", 5, 4, FLOOR_Z, { rng: () => 0.5, level: 3, state: "chase" }));
      const flatling = addCreature(z, spawnCreature("flatling", 6, 4, FLOOR_Z, { rng: () => 0.5, level: 3, state: "chase" }));
      for (const c of [deep, flatling]) { c.hp = c.maxHp = 1e9; c.cd = Infinity; }
      addStatus(game, p, "flat", { t: 1e6 });
      const touched = (att, tgt) => { let n = 0; for (let k = 0; k < 40; k++) { p.hp = 1e6; if (resolveAttack(game, att, tgt, att === p ? weaponSpec(p) : naturalSpec(att), { view: "map" }).touched) n++; } return n; };
      const t = { deepOnYou: touched(deep, p), flatOnYou: touched(flatling, p), youOnDeep: touched(p, deep), youOnFlat: touched(p, flatling) };
      p.hp = maxHp(p);
      expect(t.deepOnYou === 0 && t.youOnDeep === 0 && t.flatOnYou === 40 && t.youOnFlat === 40, `flat: blows touching ${JSON.stringify(t)} (want deep 0 both ways, flat 40 both ways)`);
      // A deep creature's arrow passes through you.
      const hp0 = p.hp; attacks.length = 0;
      z.projectiles.push({ kind: "arrow", hostile: true, from: deep, dmg: 5, x: 3.5, y: 5.5, z: FLOOR_Z + 1, vx: 10, vy: 0, vz: 0, g: 0, life: 2, spin: 0 });
      for (let k = 0; k < 120 && z.projectiles.length; k++) updateProjectiles(game, 1 / 60);
      expect(p.hp === hp0 && !attacks.some((a) => a.tgt === p), `flat: a goblin's arrow ${p.hp === hp0 ? "passed" : "hurt you"}`);
      // A deep hunter loses you; the flatling doesn't.
      deep.think = 0; flatling.think = 0;
      updateCreatures(game, 0.05, Infinity);
      expect(deep.state !== "chase" && flatling.state === "chase", `flat: the deep goblin ${deep.state}, the flatling ${flatling.state} (want wander, chase)`);
      z.creatures.length = 0;
      // Moving in the Plane.
      const steps = [];
      const step = (dx, dy) => { const ok = mapStep(game, dx, dy, { force: false }); steps.push(`${ok}:${Math.floor(p.x)},${Math.floor(p.y)}@${p.z}`); return ok; };
      step(1, 0);   // 7,5
      step(1, 0);   // 8,5: over the hole
      const overHole = game.zone === z && Math.floor(p.x) === 8 && p.z === FLOOR_Z;
      step(1, 0);   // 9,5
      step(1, 0);   // 10,5: under the door
      const underDoor = Math.floor(p.x) === 10;
      Object.assign(p, { x: 11.5, y: 5.5, z: FLOOR_Z });
      const intoWall = step(1, -1);   // 12,4: a wall
      Object.assign(p, { x: 6.5, y: 8.5, z: FLOOR_Z });
      const up2 = step(1, 0) && p.z === FLOOR_Z + 2;
      Object.assign(p, { x: 6.5, y: 10.5, z: FLOOR_Z });
      const up3 = step(1, 0);
      Object.assign(p, { x: 5.5, y: 8.5, z: FLOOR_Z });
      const lever = step(-1, 0);
      expect(overHole && underDoor && !intoWall && up2 && !up3 && !lever && game.zone === z,
        `the Plane: over the hole ${overHole}, under the door ${underDoor}, into a wall ${intoWall}, up 2 ${up2}, up 3 ${up3}, a lever ${lever} (want true, true, false, true, false, false) ${JSON.stringify(steps)}`);
      // Talk: Ess (a Flatlander) yes, Maren no.
      const talked = [];
      const onTalk = game.onTalk; game.onTalk = (c) => talked.push(c.name);
      Object.assign(p, { x: 15.5, y: 10.5, z: FLOOR_Z });
      addCreature(z, spawnCreature("maren", 16, 10, FLOOR_Z, {}));
      const essC = addCreature(z, spawnCreature("ess", 15, 11, FLOOR_Z, {}));
      mapStep(game, 1, 0, { force: false }); mapStep(game, 0, 1, { force: false });
      game.onTalk = onTalk;
      expect(talked.length === 1 && talked[0] === essC.name, `flat, walking into people: talked to ${JSON.stringify(talked)} (want only Ess)`);
      stats.flat = { blows: t, arrow: "passed", hunterLost: true, plane: { overHole, underDoor, wall: !intoWall, up2, up3: !up3, lever: !lever }, talks: talked };
      run.restore(); run = null;
    }

    // --- 4. Wary, flee, follow --------------------------------------------------------------------------------------
    {
      run = fresh(ctx, 92);
      const p = game.player;
      const z = arena("ws8-states", { w: 32, d: 18 });
      enterZone(game, z, { how: "start" }); z.seen.fill(1);
      onMap(game);
      Object.assign(p, { x: 10.5, y: 9.5, z: FLOOR_Z });
      // Wary: a docile faction that dislikes you.
      if (!FACTIONS.ws8Shy) { registerFaction("ws8Shy", { name: "Shy", temperament: "docile", startRep: -300 }); added.factions.push("ws8Shy"); }
      const shy = addCreature(z, spawnCreature("goblin", 11, 9, FLOOR_Z, { rng: () => 0.5, level: 3 }));
      shy.faction = { ws8Shy: 1 };
      attacks.length = 0;
      for (let k = 0; k < 120; k++) updateCreatures(game, 1 / 20, Infinity);
      const shyD = distance(shy.x - p.x, shy.y - p.y);
      expect(shyD >= AI_RULES.wary.keep - 0.5 && !attacks.some((a) => a.att === shy), `wary: after 6 s it stands ${shyD.toFixed(1)} tiles off (want ≥ ${AI_RULES.wary.keep - 0.5}), struck you ${attacks.filter((a) => a.att === shy).length} times (want 0)`);
      resolveAttack(game, p, shy, weaponSpec(p), { view: "map", rng: () => 0.5 });
      for (let k = 0; k < 40; k++) updateCreatures(game, 1 / 20, Infinity);
      expect(shy.state === "chase", `wary, then struck: ${shy.state} (want chase)`);
      z.creatures.length = 0;
      stats.wary = { keptAway: +shyD.toFixed(1), struckFirst: 0, afterYourBlow: "chase" };
      // Flee: a goblin at 15% runs, and stops when it no longer sees you.
      const coward = addCreature(z, spawnCreature("goblin", 12, 9, FLOOR_Z, { rng: () => 0.5, level: 3, state: "chase" }));
      coward.hp = Math.max(1, Math.floor(coward.maxHp * 0.15)); coward.cd = Infinity; coward.think = 0;
      const d0 = distance(coward.x - p.x, coward.y - p.y);
      for (let k = 0; k < 20; k++) updateCreatures(game, 1 / 20, Infinity);
      const d1 = distance(coward.x - p.x, coward.y - p.y), fled = coward.state === "flee";
      expect(fled && d1 > d0 + 1 && run.logged.some((t) => /turns and runs/.test(t)), `flee: state ${coward.state}, distance ${d0.toFixed(1)} → ${d1.toFixed(1)}`);
      // Out of sight (a wall of stone around you) for the forget time: it gives up.
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]])
        for (let k = FLOOR_Z; k < FLOOR_Z + 3; k++) z.set(10 + ox, 9 + oy, k, B.STONE);
      z.refresh();
      for (let k = 0; k < (AI_RULES.flee.forget + 1) * 20; k++) updateCreatures(game, 1 / 20, Infinity);
      expect(coward.state === "wander", `flee: out of sight for ${AI_RULES.flee.forget + 1} s it is ${coward.state} (want wander)`);
      // Cornered: walls on three sides, you on the fourth: it turns on you.
      const box = arena("ws8-corner", { w: 16, d: 9 });
      for (let y = 3; y <= 5; y++) for (const x of [1, 3]) for (let k = FLOOR_Z; k < FLOOR_Z + 3; k++) box.set(x, y, k, B.STONE);
      for (let k = FLOOR_Z; k < FLOOR_Z + 3; k++) box.set(2, 3, k, B.STONE);
      box.refresh();
      enterZone(game, box, { how: "start" }); onMap(game);
      Object.assign(p, { x: 2.5, y: 5.5, z: FLOOR_Z });
      const cornered = addCreature(box, spawnCreature("goblin", 2, 4, FLOOR_Z, { rng: () => 0.5, level: 3, state: "chase" }));
      cornered.hp = 1; cornered.think = 0;
      for (let k = 0; k < 20; k++) updateCreatures(game, 1 / 20, Infinity);
      expect(cornered.state === "chase" && cornered.brain?.braveT > 0, `cornered: ${cornered.state}, brave ${cornered.brain?.braveT} (want chase, brave for a while)`);
      stats.flee = { from: +d0.toFixed(1), to: +d1.toFixed(1), outOfSight: "wander", cornered: "fights" };
      // Under the legacy set nothing flees.
      const undoLegacy = overrideRules("combat", "legacy");
      cornered.state = "chase"; delete cornered.brain.braveT; cornered.think = 0;
      for (let k = 0; k < 10; k++) updateCreatures(game, 1 / 20, Infinity);
      undoLegacy();
      expect(cornered.state === "chase", `legacy set: a goblin at 1 HP ${cornered.state} (want chase: nothing flees)`);
      // Follow: it keeps up, fights what's out for you, never you; a bump swaps; Shift + direction strikes it.
      const fz = arena("ws8-follow", { w: 40, d: 12 });
      enterZone(game, fz, { how: "start" }); fz.seen.fill(1); onMap(game);
      Object.assign(p, { x: 4.5, y: 5.5, z: FLOOR_Z });
      const pal = recruit(game, addCreature(fz, spawnCreature("orc", 3, 5, FLOOR_Z, { rng: () => 0.5, level: 6 })));
      pal.hp = pal.maxHp = 500;
      attacks.length = 0;
      for (let k = 0; k < 12; k++) mapStep(game, 1, 0, { force: false });
      const walking = distance(pal.x - p.x, pal.y - p.y);   // (an orc walks 2.2 tiles a second, you 4.2: it falls behind)
      passTime(game, 4);
      const lag = distance(pal.x - p.x, pal.y - p.y);
      expect(walking > lag && lag <= AI_RULES.follow.near + 1 && !attacks.some((a) => a.att === pal && a.tgt === p), `follow: 12 steps on it is ${walking.toFixed(1)} tiles behind, 4 s later ${lag.toFixed(1)} (want ≤ ${AI_RULES.follow.near + 1}); it struck you ${attacks.filter((a) => a.tgt === p).length} times`);
      const foe = addCreature(fz, spawnCreature("rat", Math.floor(p.x) + 3, 7, FLOOR_Z, { rng: () => 0.5, level: 1, state: "wander" }));
      foe.hp = foe.maxHp = 1e6; foe.cd = Infinity;
      for (let k = 0; k < 8; k++) passTime(game, 0.5);
      expect(attacks.some((a) => a.att === pal && a.tgt === foe), `follow: it didn't go for the rat that's out for you (${attacks.filter((a) => a.att === pal).length} blows)`);
      fz.creatures.splice(fz.creatures.indexOf(foe), 1);
      // Swap: put it beside you and walk into it.
      const beside = () => Object.assign(pal, { tx: Math.floor(p.x) + 1, ty: Math.floor(p.y), nx: Math.floor(p.x) + 1, ny: Math.floor(p.y), p: 0, x: Math.floor(p.x) + 1.5, y: p.y });
      beside();
      const before = [Math.floor(p.x), pal.tx];
      const swapped = mapStep(game, 1, 0, { force: false }) && Math.floor(p.x) === before[1] && pal.tx === before[0];
      attacks.length = 0;
      beside();
      mapStep(game, 1, 0, { force: true });
      expect(swapped && attacks.some((a) => a.att === p && a.tgt === pal), `follow: a bump swaps places ${swapped}; Shift + direction struck it ${attacks.some((a) => a.att === p && a.tgt === pal)}`);
      stats.follow = { whileWalking: +walking.toFixed(1), after4s: +lag.toFixed(1), foughtYourFoe: true, swap: swapped, shiftStrikes: true };
      run.restore(); run = null;
    }

    // --- 5. AI ability use -----------------------------------------------------------------------------------------
    {
      run = fresh(ctx, 93);
      const p = game.player;
      const z = arena("ws8-ability", { w: 24, d: 12 });
      enterZone(game, z, { how: "start" }); onMap(game);
      Object.assign(p, { x: 4.5, y: 5.5, z: FLOOR_Z });
      const used = [];
      if (!ABILITIES.ws8Spit) {
        registerAbility("ws8Spit", { name: "Spit", target: "creature", range: 6, cooldown: () => 3,
          use: (g, e, lvl, t) => { used.push({ e, t, time: g.time }); return true; },
          ai: { when: (g, c, t) => !!t && distance(t.x - c.x, t.y - c.y) <= 6 } });
        added.abilities.push("ws8Spit");
      }
      const spitter = addCreature(z, spawnCreature("goblin", 8, 5, FLOOR_Z, { rng: () => 0.5, level: 3, state: "chase" }));
      spitter.innate = ["ws8Spit"]; spitter.cd = Infinity;
      spitter.status.pinned = { t: Infinity, mag: 1, src: null, acc: 0 };
      const t0 = game.time;
      for (let k = 0; k < 7 * 20; k++) { game.time += 1 / 20; updateCreatures(game, 1 / 20, Infinity); }
      const times = used.map((u) => +(u.time - t0).toFixed(2));
      expect(used.length >= 2 && used.length <= 3 && used.every((u) => u.e === spitter && u.t?.creature === p) && times[1] - times[0] >= 3 - 0.01,
        `AI abilities: used at ${JSON.stringify(times)} s on ${used.map((u) => (u.t?.creature === p ? "you" : "?")).join(", ")} (want every 3 s or more, at you)`);
      stats.abilities = { usedAt: times };
      run.restore(); run = null;
    }

    // --- 6. The outdoor activity radius in 3D ------------------------------------------------------------------------
    {
      run = fresh(ctx, 94);
      const p = game.player;
      const radius = {};
      for (const type of ["surface", "dungeon"]) {
        const z = arena(`ws8-radius-${type}`, { w: 80, d: 12, type });
        enterZone(game, z, { how: "start" }); in3d(game);
        Object.assign(p, { x: 2.5, y: 5.5, z: FLOOR_Z });
        const near = addCreature(z, spawnCreature("rat", 22, 5, FLOOR_Z, { rng: () => 0.5, level: 1, state: "wander" }));
        const far = addCreature(z, spawnCreature("rat", 42, 5, FLOOR_Z, { rng: () => 0.5, level: 1, state: "wander" }));
        const a0 = [near.anim, far.anim];
        for (let k = 0; k < 30; k++) updateCreatures(game, 1 / 30);
        radius[type] = { near20: near.anim !== a0[0], far40: far.anim !== a0[1] };
      }
      expect(radius.surface.near20 && !radius.surface.far40 && radius.dungeon.near20 && radius.dungeon.far40,
        `the activity radius in 3D: ${JSON.stringify(radius)} (want outdoors only the near one to act, underground both)`);
      stats.radius = { outdoor: AI_RULES.outdoorRadius, ...radius };
      run.restore(); run = null;
    }

    // --- 7. The d20 log ---------------------------------------------------------------------------------------------
    {
      run = fresh(ctx, 95);
      const p = game.player;
      const z = arena("ws8-log", { w: 24, d: 12 });
      enterZone(game, z, { how: "start" }); onMap(game);
      Object.assign(p, { x: 4.5, y: 5.5, z: FLOOR_Z });
      const g = dummy(z, "goblin", 5, 5);
      const o = dummy(z, "orc", 6, 6);
      const lines = [];
      const say = (att, tgt, roll) => {
        const n = run.logged.length;
        p.hp = 1e6;
        resolveAttack(game, att, tgt, att === p ? weaponSpec(p) : naturalSpec(att), { view: "map", rng: roll });
        lines.push(run.logged.slice(n).join(" | "));
      };
      const NAT1 = () => 0, NAT20 = () => 0.999;
      say(p, g, NAT1); say(p, g, NAT20); say(g, p, NAT1); say(g, p, NAT20); say(o, g, NAT1); say(o, g, NAT20);
      p.hp = maxHp(p);
      const want = [/^You miss the goblin\.$/, /^You hit the goblin \(x2\) for \d+\./, /^The goblin misses you\.$/, /^The goblin hits you \(x2\) for \d+\.$|^Your armour turns/, /^The orc misses the goblin\.$/, /^The orc hits the goblin \(x2\) for \d+\.$/];
      const bad = want.map((re, k) => (re.test(lines[k]) ? null : `${k}: "${lines[k]}"`)).filter(Boolean);
      expect(!bad.length, `the d20 log format: ${bad.join("; ")}`);
      g.hp = 1;
      const n = run.logged.length;
      resolveAttack(game, p, g, weaponSpec(p), { view: "map", rng: NAT20 });
      expect(/^You slay the goblin \(x2, \d+\)\.$/.test(run.logged[n] || ""), `a killing crit is told as "${run.logged[n]}"`);
      stats.log = [...lines, run.logged[n]];
      run.restore(); run = null;
    }
  } finally {
    off();
    run?.restore();
    for (const f of added.factions) delete FACTIONS[f];
    for (const a of added.abilities) delete ABILITIES[a];
  }
  return resultOf("combat: AI depth, followers, the Plane (WS8)", problems, stats);
}

// --- Arena: two factions, many runs -----------------------------------------------------------------------------
// Four of each side (goblin, orc, spider, rat), placed as mirror images six to eight tiles apart in an open
// field, under the d20 set, you far off and neutral to both. Which side is added first (and so acts first in
// each update) alternates with the seed. A run ends when one side is gone, or when the two sides have parted
// (TECH_DESIGN §3.4: a creature drops a foe more than 8 tiles off: no two foes within ARENA_APART tiles for
// ARENA_QUIET s), or after ARENA_LIMIT s: a fight still going then never settles, and fails.
const ARENA_TEAM = ["goblin", "orc", "spider", "rat"], ARENA_LIMIT = 120, ARENA_APART = 10, ARENA_QUIET = 15;
export function checkArena(ctx, { runs = 100 } = {}) {
  const { game, seedRandom, restoreRandom } = ctx;
  const problems = [], stats = {};
  const expect = (ok, m) => { if (!ok) problems.push(m); return ok; };
  const run = fresh(ctx, 96);
  const added = [];
  for (const [id, foe] of [["ws8Red", "ws8Blue"], ["ws8Blue", "ws8Red"]])
    if (!FACTIONS[id]) { registerFaction(id, { name: id, relations: { [foe]: -1 } }); added.push(id); }
  const p = game.player;
  const battle = (seed, { red = 3, blue = 3 } = {}) => {
    seedRandom(seed);
    game.combatRng = makeRng(seed);
    const z = arena(`ws8-arena-${seed}-${red}-${blue}`, { w: 32, d: 16 });
    enterZone(game, z, { how: "start" }); onMap(game);
    Object.assign(p, { x: 1.5, y: 1.5, z: FLOOR_Z });
    const side = (faction, level, x, dir) => ARENA_TEAM.map((type, k) => {
      const c = addCreature(z, spawnCreature(type, x + dir * (k & 1), 6 + k, FLOOR_Z, { rng: Math.random, level, state: "wander" }));
      c.faction = { [faction]: 1 };
      return c;
    });
    let R, Bl;
    if (seed & 1) { Bl = side("ws8Blue", blue, 17, -1); R = side("ws8Red", red, 9, 1); }
    else { R = side("ws8Red", red, 9, 1); Bl = side("ws8Blue", blue, 17, -1); }
    const alive = (team) => team.filter((c) => z.creatures.includes(c));
    const near = () => alive(R).some((a) => alive(Bl).some((b) => distance(a.x - b.x, a.y - b.y) <= ARENA_APART));
    let t = 0, quiet = 0;
    for (; t < ARENA_LIMIT && alive(R).length && alive(Bl).length && quiet < ARENA_QUIET; t += 0.05) {
      game.time += 0.05; updateCreatures(game, 0.05, Infinity);
      quiet = near() ? 0 : quiet + 0.05;
    }
    const bad = z.creatures.filter((c) => !Number.isFinite(c.x + c.y + c.z) || z.stand[c.tx + c.ty * z.w] < 0).length;
    const winner = alive(R).length && !alive(Bl).length ? "red" : alive(Bl).length && !alive(R).length ? "blue" : quiet >= ARENA_QUIET ? "parted" : "stuck";
    game.effects.length = 0; run.logged.length = 0;
    return { winner, t: +t.toFixed(2), kills: { red: 4 - alive(Bl).length, blue: 4 - alive(R).length }, left: [...alive(R), ...alive(Bl)].map((c) => c.hp).join(","), bad };
  };
  try {
    const mirror = [];
    for (let k = 0; k < runs; k++) mirror.push(battle(5000 + k));
    const count = (rs, w) => rs.filter((r) => r.winner === w).length, sum = (rs, k) => rs.reduce((a, r) => a + r.kills[k], 0);
    const ended = runs - count(mirror, "parted") - count(mirror, "stuck"), red = count(mirror, "red");
    const redKills = sum(mirror, "red"), blueKills = sum(mirror, "blue");
    expect(count(mirror, "stuck") === 0, `the mirror arena: ${count(mirror, "stuck")} fights still going after ${ARENA_LIMIT} s`);
    expect(ended >= runs * 0.7, `the mirror arena: only ${ended} of ${runs} runs ended with one side gone (${count(mirror, "parted")} parted)`);
    expect(red >= ended * 0.3 && red <= ended * 0.7 && redKills >= (redKills + blueKills) * 0.35 && redKills <= (redKills + blueKills) * 0.65,
      `the mirror arena: red won ${red} of ${ended} and made ${redKills} of ${redKills + blueKills} kills (want 30-70% and 35-65%: the same teams)`);
    expect(mirror.every((r) => r.bad === 0), `the arena: ${mirror.filter((r) => r.bad).length} runs left a creature at a bad place`);
    const again = [];
    for (let k = 0; k < 20; k++) again.push(battle(5000 + k));
    const diff = again.findIndex((r, k) => JSON.stringify(r) !== JSON.stringify(mirror[k]));
    expect(diff < 0, `the same seed gave another run: ${diff >= 0 ? `${JSON.stringify(mirror[diff])} then ${JSON.stringify(again[diff])}` : ""}`);
    const strong = [];
    for (let k = 0; k < runs; k++) strong.push(battle(7000 + k, { red: 3, blue: 9 }));
    const blue = count(strong, "blue");
    expect(count(strong, "stuck") === 0, `level 9 against level 3: ${count(strong, "stuck")} fights still going after ${ARENA_LIMIT} s`);
    expect(blue >= runs * 0.85, `level 9 against level 3: blue won ${blue} of ${runs} (want 85% or more)`);
    const mean = (xs) => +(xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length)).toFixed(1);
    stats.mirror = { runs, ended, parted: count(mirror, "parted"), stuck: count(mirror, "stuck"), redWins: red, blueWins: ended - red, kills: { red: redKills, blue: blueKills },
                     meanSeconds: mean(mirror.filter((r) => r.winner === "red" || r.winner === "blue").map((r) => r.t)) };
    stats.repeat = { runs: 20, identical: diff < 0 };
    stats.stronger = { runs, blueL9Wins: blue, parted: count(strong, "parted"), stuck: count(strong, "stuck"), kills: { red: sum(strong, "red"), blue: sum(strong, "blue") }, meanSeconds: mean(strong.map((r) => r.t)) };
  } finally {
    restoreRandom?.();
    for (const id of added) delete FACTIONS[id];
    run.restore();
  }
  return resultOf("combat: arena of two factions (WS8)", problems, stats);
}

// --- Time to kill, by level band -----------------------------------------------------------------------------------
// The d20 set with the attribute stats (DECISIONS; the integrator's flip, §8.5), at each tier's surface level
// (3 × tier − 1): a fighter (STR 18, AGI 17, TOU 16 at creation, +1 attribute every 4 levels into STR and AGI by
// turns) with the tier's weapon and armour (the legacy tables: maxTierAt) at +floor(level / 6) and +floor(level / 8),
// against the creatures that level brings (pickCreatureType's weights, level-scaled: +6% HP a level, +1 damage
// per 4). For each: your seconds to kill it (blows × your swing), its seconds to kill you (blows × its cooldown),
// and the share of your health one kill costs (its damage per second × your time to kill). Means are weighted by
// how often each creature turns up. Melee only (archers' arrows, venom, regeneration and elites left out).
// The same table under the legacy sets (the parent game: every blow lands, STR 10) is the balance reference.
const BANDS = [1, 2, 3, 4, 5, 6, 7, 8].map((tier) => ({ tier, level: 3 * tier - 1 }));
const GEAR = { 1: ["mace", "leather"], 2: ["longsword", "chain"], 3: ["waraxe", "scale"], 4: ["greatsword", "plate"] };
export function ttkTables(ctx, { blows = 1500 } = {}) {
  const { game } = ctx;
  const problems = [], stats = {};
  const expect = (ok, m) => { if (!ok) problems.push(m); return ok; };
  const run = fresh(ctx, 97);
  const p = game.player;
  const z = arena("ws8-ttk", { w: 16, d: 10 });
  enterZone(game, z, { how: "start" }); onMap(game);
  Object.assign(p, { x: 4.5, y: 5.5, z: FLOOR_Z });
  const saved = { attrs: { ...p.attrs }, level: p.level, body: p.body, perks: p.perks };
  const table = {};
  const sets = [["d20", "attributes"], ["legacy", "legacy"]];
  try {
    for (const [combat, statsSet] of sets) {
      const undo = [overrideRules("combat", combat), overrideRules("stats", statsSet)];
      const rows = [];
      for (const { tier, level } of BANDS) {
        const k = Math.floor(level / 4);
        p.level = level; p.perks = {};
        p.attrs = { ...saved.attrs, str: 18 + Math.ceil(k / 2), agi: 17 + Math.floor(k / 2), tou: 16 };
        const gt = level >= 12 ? 4 : level >= 8 ? 3 : level >= 4 ? 2 : 1;
        p.body = makeBody("humanoid");
        p.body.equip.hand_r = { kind: "weapon", id: GEAR[gt][0], ench: Math.floor(level / 6), known: true };
        p.body.equip.body = { kind: "armour", id: GEAR[gt][1], ench: Math.floor(level / 8), known: true };
        invalidateStats(p);
        const hpMax = maxHp(p), swing = attackTime(p);
        // Which creatures this level brings, and how often.
        const pick = makeRng(level * 31 + 7), counts = {};
        for (let n = 0; n < 2000; n++) { const id = pickCreatureType(pick, level); counts[id] = (counts[id] || 0) + 1; }
        game.combatRng = makeRng(level * 97 + (combat === "d20" ? 1 : 2));
        const per = [];
        for (const [type, n] of Object.entries(counts)) {
          const c = addCreature(z, spawnCreature(type, 5, 5, FLOOR_Z, { rng: () => 0.5, level, state: "chase" }));
          const itsHp = c.maxHp, T = CREATURE_TYPES[type];
          c.hp = c.maxHp = 1e12; c.cd = Infinity;
          const yours = [], theirs = [];
          for (let b = 0; b < blows; b++) {
            yours.push(resolveAttack(game, p, c, weaponSpec(p), { view: "map" }).dmg);
            p.hp = 1e9;
            theirs.push(resolveAttack(game, c, p, naturalSpec(c)).dmg);
            if ((b & 255) === 0) { game.effects.length = 0; run.logged.length = 0; }
          }
          z.creatures.splice(z.creatures.indexOf(c), 1);
          // Blows to bring hp down, drawing blows in turn from the sampled ones (a fixed walk through them).
          const toKill = (dmgs, hp) => { let sum = 0, nb = 0, total = 0, fights = 0; for (const d of dmgs) { sum += d; nb++; if (sum >= hp) { total += nb; fights++; sum = 0; nb = 0; } } return fights ? total / fights : Infinity; };
          const yourBlows = toKill(yours, itsHp), itsBlows = toKill(theirs, hpMax);
          const yourTtk = yourBlows * swing, itsTtk = itsBlows * T.cooldown;
          const itsDps = theirs.reduce((a, d) => a + d, 0) / theirs.length / T.cooldown;
          per.push({ type, w: n / 2000, yourTtk, itsTtk, cost: (itsDps * yourTtk) / hpMax });
        }
        const wmean = (f) => per.reduce((a, r) => a + r.w * f(r), 0);
        const worst = per.reduce((a, r) => (r.cost > a.cost ? r : a), per[0]);
        rows.push({ tier, level, hp: hpMax, dv: dvOf(game, p), av: armourValue(p), weapon: GEAR[gt][0],
                    youKill: +wmean((r) => r.yourTtk).toFixed(2), itKills: +wmean((r) => r.itsTtk).toFixed(1),
                    costPct: +(100 * wmean((r) => r.cost)).toFixed(1), worst: `${worst.type} ${(100 * worst.cost).toFixed(0)}%`,
                    types: per.length });
      }
      while (undo.length) undo.pop()();
      table[combat] = rows;
    }
    // Bounds that hold the formulas, not a verdict on the balance (that is the table itself): you win a fight
    // with a creature of your level at every band; the first four tiers stay near the parent game's numbers.
    table.legacy.forEach((L, k) => {
      const r = table.d20[k];
      expect(r.youKill >= 0.5 && r.youKill <= 12, `d20 tier ${r.tier} (level ${r.level}): you kill a creature of your level in ${r.youKill} s on average (want 0.5-12)`);
      expect(r.itKills >= 1.5 * r.youKill && r.costPct <= 75, `d20 tier ${r.tier}: it kills you in ${r.itKills} s, you it in ${r.youKill} s, a kill costs ${r.costPct}% (want it 1.5× slower and at most 75%)`);
      if (r.tier <= 4) expect(r.costPct <= 1.5 * L.costPct + 3 && r.youKill <= 1.5 * L.youKill + 0.5, `d20 tier ${r.tier}: a kill costs ${r.costPct}% in ${r.youKill} s against the legacy set's ${L.costPct}% in ${L.youKill} s (want within 1.5×)`);
    });
    stats.d20 = table.d20.map((r) => `tier ${r.tier} L${r.level} (${r.weapon}, HP ${r.hp}, DV ${r.dv}, AV ${r.av}): you kill in ${r.youKill} s, it kills you in ${r.itKills} s, a kill costs ${r.costPct}% (worst ${r.worst}; ${r.types} kinds)`);
    stats.legacy = table.legacy.map((r) => `tier ${r.tier} L${r.level}: you kill in ${r.youKill} s, it kills you in ${r.itKills} s, a kill costs ${r.costPct}%`);
    stats.table = table;
  } finally {
    Object.assign(p, { attrs: saved.attrs, level: saved.level, body: saved.body, perks: saved.perks });
    invalidateStats(p);
    run.restore();
  }
  return resultOf("combat: time to kill by level band (WS8)", problems, stats);
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-combat.mjs gives.
export async function run(env) {
  await env.screen();
  const { game, startRun, inputHandlers } = await env.src("game.js");
  const { keys } = await env.src("input.js");
  const ctx = { game, startRun, inputHandlers, keys, seedRandom: env.seedRandom, restoreRandom: env.restoreRandom };
  return [checkCombat({ game, startRun, srcFiles: await env.srcFiles() }), checkTargeting(ctx), checkAiDepth(ctx), checkArena(ctx), ttkTables(ctx)];
}

// --- passTime with 60 creatures (Node only: tools/check-combat.mjs --perf) ----------------------------------------
// TECH_DESIGN §3.4: one simulated second on the map costs at most 12 ms with 60 creatures in the active radius.
// Three ways, each on the open surface zone 1,0,0 with 60 creatures of the level-5 kinds within 11 tiles of you:
// hunting you under the legacy set (check-perf's), hunting you under d20, and in two factions fighting each
// other around you under d20 (§3.4's arena; you're neutral to both). For each tree in `trees` (this one, and
// another's src), alternately: `seconds` timed simulated seconds each, the creatures put back every 5.
export async function measureWs8Perf(trees, { seconds = 40, installNodeEnv, seedRandom }) {
  const loaded = [];
  for (const tree of trees) {
    await installNodeEnv({ srcDir: tree.src });
    const { pathToFileURL } = await import("node:url");
    const L = (f) => import(pathToFileURL(`${tree.src}/${f}`).href);
    const m = { game: await L("game.js"), zones: await L("zones.js"), creatures: await L("creatures.js"), turns: await L("turns.js"),
                rules: await L("rules.js"), factions: await L("factions.js") };
    loaded.push({ ...tree, m, samples: {} });
  }
  const scenarios = [["hunting, legacy", "legacy", false], ["hunting, d20", "d20", false], ["two factions, d20", "d20", true]];
  const lines = [];
  for (const t of loaded) {
    const { game, startRun } = t.m.game;
    seedRandom(4242);
    startRun(4242);
    game.pages = null; game.pendingPages = null; game.story.cube = true; game.log = () => {};
    for (const id of ["ws8PerfA", "ws8PerfB"]) if (!t.m.factions.FACTIONS[id]) t.m.factions.registerFaction(id, { name: id, relations: { [id === "ws8PerfA" ? "ws8PerfB" : "ws8PerfA"]: -1 } });
    t.m.zones.changeZone(game, "1,0,0", { how: "start", rng: Math.random });
  }
  const setup = (t, factions) => {
    const { game } = t.m.game, C = t.m.creatures, zone = game.zone, p = game.player;
    const hx = zone.w >> 1, hy = zone.d >> 1;
    let here = null;
    for (let r = 0; r < 10 && !here; r++) for (let dy = -r; dy <= r && !here; dy++) for (let dx = -r; dx <= r && !here; dx++) if (zone.stand[hx + dx + (hy + dy) * zone.w] >= 0) here = [hx + dx, hy + dy];
    Object.assign(p, { x: here[0] + 0.5, y: here[1] + 0.5, z: zone.stand[here[0] + here[1] * zone.w], hp: 1e9, vz: 0 });
    const types = Object.keys(C.CREATURE_TYPES).filter((id) => { const ty = C.CREATURE_TYPES[id]; return ty.depths && ty.depths[0] <= 5 && ty.depths[1] >= 5; });
    const spots = [];
    for (let y = here[1] - 11; y <= here[1] + 11; y++)
      for (let x = here[0] - 11; x <= here[0] + 11; x++) {
        if (x < 1 || y < 1 || x >= zone.w - 1 || y >= zone.d - 1 || (x === here[0] && y === here[1])) continue;
        if (zone.stand[x + y * zone.w] >= 0 && Math.abs(x - here[0]) + Math.abs(y - here[1]) >= 3 && (x * 7 + y * 13) % 5 === 0) spots.push([x, y]);
      }
    zone.creatures = zone.creatures.filter((c) => c.talk);
    for (let k = 0; k < 60 && k < spots.length; k++) {
      const [x, y] = spots[(k * 11) % spots.length];
      const c = C.addCreature(zone, C.spawnCreature(types[k % types.length], x, y, zone.stand[x + y * zone.w], { rng: Math.random, state: factions ? "wander" : "chase", level: 5 }));
      if (factions) c.faction = { [k & 1 ? "ws8PerfA" : "ws8PerfB"]: 1 };
    }
    game.view = "map"; game.mode = "map"; game.paused = false;
    return zone.creatures.filter((c) => !c.talk).length;
  };
  const counts = {};
  for (let k = -2; k < seconds; k++)
    for (const t of loaded)
      for (const [name, set, factions] of scenarios) {
        const { game } = t.m.game, undo = t.m.rules.overrideRules("combat", set);
        if (k % 5 === 0 || k === -2) counts[name] = setup(t, factions);
        game.player.hp = 1e9;
        const t0 = performance.now();
        t.m.turns.passTime(game, 1);
        const ms = performance.now() - t0;
        undo();
        if (k >= 0) (t.samples[name] ||= []).push(ms);
      }
  const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
  lines.push(`passTime per simulated second, 60 creatures within 11 tiles on 1,0,0 (${seconds} samples each, trees alternating; budget 12 ms):`);
  for (const [name] of scenarios)
    for (const t of loaded) {
      const xs = t.samples[name];
      lines.push(`  ${name.padEnd(18)} ${t.name.padEnd(12)} p50 ${q(xs, 0.5).toFixed(2)} ms, p95 ${q(xs, 0.95).toFixed(2)}, max ${Math.max(...xs).toFixed(2)} (${counts[name]} creatures at each start)`);
    }
  return lines;
}
