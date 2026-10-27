// The stat bus (stats.js) and RULES (rules.js): TECH_DESIGN §2.6 and the 0B gate.
//
//   checkStats({ game, startRun, inventory, mechanics, gate }) → { name, ok, problems, stats }
//
//   1. RULES is frozen; extendRules adds a namespace once; overrideRules undoes.
//   2. In both formula sets: putting on and taking off every piece of gear (every weapon, armour, ring,
//      amulet and property, enchantments −2, 0, +2, and every relic) leaves every derived number
//      consistent: the cached bonus table equals a fresh sum over the sources, STR / max HP / armour
//      equal the formulas worked out here from the raw tables, and taking it off restores the numbers
//      before. Statuses through status.js (a test status with bonuses, then every registered one, added
//      and removed with addStatus / removeStatus under STATS_DEBUG.verify) and every perk the same.
//   3. No base-field writes: the real inventory code (equip, swap) runs on a player behind
//      guardBaseFields; any write to attrs, maxHpGain or level is a problem.
//   4. The attribute formulas at their reference points (TOU 16 gives the parent's 20 + 3 per level…).
//   5. `mechanics`: a function that replays golden (a) and returns { mismatched, writes } with
//      STATS_DEBUG.verify on (every bonus() checks the cache) and the player guarded; the only base
//      writes allowed are the permanent ones (potions and crystals of strength, heart crystals, perks).
//   6. Through body.js as play does it, in both formula sets: every piece of gear equipped (body.equip) on
//      every part it fits and taken off again (body.unequip) under STATS_DEBUG.verify; the numbers are
//      consistent while it's on and exactly the same after (cursed pieces are uncursed to come off).
//   7. `gate`: the rest of the 0B gate, run by tools/check-stats.mjs and only reported here: golden (a)
//      replayed by the bot through the map's and the 3D view's controls ({ map, "3d" }: { mismatched,
//      steps }), skipTime(600) against 1/60 s stepping and drowning on the map and in 3D (check-status's
//      numbers), and golden (b), the frames ({ frames, mismatched }).
//
// game/startRun/inventory: the real modules, so equipping runs exactly as in play.
import { RULES, extendRules, overrideRules } from "../../src/rules.js";
import * as St from "../../src/stats.js";
import { WEAPONS, ARMOURS, RINGS, AMULETS, RELICS, PROPERTIES, itemBonuses, makeRelic } from "../../src/items.js";
import { PERKS, perkRank, takePerk } from "../../src/leveling.js";
import { registerStatus, addStatus, removeStatus, STATUS_DEFS } from "../../src/status.js";
import * as Bd from "../../src/body.js";

// Where the parent game's four slots are on a humanoid body (the gear catalog puts each piece there).
const PART = { weapon: "hand_r", armour: "body", ring: "finger_r", amulet: "neck" };
// What's on the body, read straight from body.equip (not through body.js worn()).
const onBody = (e) => Object.values(e.body?.equip || {}).filter((it) => it && typeof it === "object");

const SETS = ["legacy", "attributes"];

// Every derived number of an entity, as plain data.
export function derived(game, e) {
  return {
    attrs: Object.fromEntries(St.ATTRS.map((k) => [k, St.attr(e, k)])),
    mods: Object.fromEntries(St.ATTRS.map((k) => [k, St.mod(e, k)])),
    maxHp: St.maxHp(e), av: St.av(e), dv: St.dv(e), ma: St.ma(e), speed: St.speedMul(e), cooldown: St.cooldownMul(e),
    carry: St.carryCap(e), price: St.priceMul(game, e), regen: St.regenEvery(e), mental: St.mentalLevel(e),
    examine: St.examineScore(e), swim: St.canSwim(e),
    bonus: Object.fromEntries(St.BONUS_KEYS.map((k) => [k, St.bonus(e, k)])),
  };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const diff = (a, b) => Object.keys(a).filter((k) => !same(a[k], b[k])).join(", ");

// The bonuses worked out by hand from the raw tables (not through stats.js).
function expectedBonus(e, statusBonus) {
  const out = {};
  const add = (b) => { for (const k in b) out[k] = (out[k] || 0) + b[k]; };
  for (const it of onBody(e)) add(itemBonuses(it));
  for (const k of e.perks instanceof Set ? e.perks : Object.keys(e.perks || {})) if (PERKS[k].bonus) add(PERKS[k].bonus(perkRank(e, k)));
  for (const id in e.status || {}) add(statusBonus(id, e.status[id]) || {});
  return out;
}
function expectedCore(e, b) {
  const g = (k) => b[k] || 0, legacy = RULES.stats === "legacy";
  const str = (legacy ? e.attrs.str - 16 + 10 : e.attrs.str) + g("str");
  const tou = e.attrs.tou + g("tou"), touMod = Math.floor((tou - 16) / 2);
  const maxHp = legacy ? Math.max(1, 20 + 3 * (e.level - 1) + e.maxHpGain + g("maxHp"))
                       : Math.max(1, tou + 4 + (e.level - 1) * Math.max(1, 3 + touMod) + e.maxHpGain + g("maxHp"));
  const body = onBody(e).filter((it) => it.kind === "armour").reduce((s, it) => s + ARMOURS[it.id].armour + it.ench, 0);
  const av = legacy ? body + g("armour") : body + g("armour") + g("av");
  return { str, maxHp, av };
}

// Every piece of gear there is (a shared list, so each test makes fresh copies).
export function gearCatalog() {
  const out = [];
  for (const ench of [-2, 0, 2]) {
    for (const id in WEAPONS) out.push({ kind: "weapon", id, ench, known: true });
    for (const id in ARMOURS) out.push({ kind: "armour", id, ench, known: true });
    for (const id in RINGS) out.push({ kind: "ring", id, ench: RINGS[id].fixed ? 1 : ench, known: true });
    for (const id in AMULETS) out.push({ kind: "amulet", id, ench: AMULETS[id].fixed ? 1 : ench, known: true });
  }
  for (const k in PROPERTIES) {
    const slot = PROPERTIES[k].slot;
    out.push({ kind: slot, id: slot === "weapon" ? "longsword" : "chain", ench: 1, known: true, props: [k] });
  }
  for (const key in RELICS) out.push(makeRelic(key));
  return out;
}

export function checkStats({ game, startRun, inventory, mechanics, gate = null }) {
  const problems = [], stats = {};
  const t0 = Date.now();

  // --- 1. RULES ---------------------------------------------------------------------------
  const throws = (fn) => { try { fn(); return false; } catch { return true; } };
  if (!throws(() => { RULES.stats = "attributes"; })) problems.push("RULES.stats can be assigned");
  if (!throws(() => { RULES.attr.base = 10; })) problems.push("RULES.attr.base can be assigned");
  if (!throws(() => { delete RULES.legacy; })) problems.push("RULES.legacy can be deleted");
  const ns = `checkStats${Date.now()}`;
  extendRules(ns, { a: { b: 1 } });
  if (RULES[ns]?.a?.b !== 1) problems.push("extendRules did not add its namespace");
  if (!throws(() => { RULES[ns].a.b = 2; })) problems.push("an extended namespace is not frozen");
  if (!throws(() => extendRules(ns, {}))) problems.push("extendRules replaced an existing namespace");
  if (!throws(() => extendRules("stats", {}))) problems.push("extendRules replaced a core namespace");
  const undo = overrideRules("stats", "attributes");
  if (RULES.stats !== "attributes") problems.push("overrideRules did not switch RULES.stats");
  undo();
  if (RULES.stats !== "attributes" || RULES.combat !== "d20") problems.push(`RULES.stats is ${RULES.stats}, RULES.combat ${RULES.combat} after undo: not the defaults since the flip (attributes, d20)`);
  if (St.contentLevel(25) !== 20 || St.contentLevel(7) !== 7) problems.push(`contentLevel: 25 → ${St.contentLevel(25)}, 7 → ${St.contentLevel(7)}`);

  // --- 2. Gear, statuses and perks in both formula sets -----------------------------------------
  // Statuses go through status.js (its registry feeds the "statuses" source): a test status with bonuses.
  if (!STATUS_DEFS.checkMight) registerStatus("checkMight", { t: 10, bonus: (s) => ({ str: s.mag, maxHp: 4 * s.mag, av: 1, dv: 2 }) });
  const statusBonus = (id, s) => STATUS_DEFS[id]?.bonus?.(s) || null;
  const gear = gearCatalog();
  let changes = 0, statusesChecked = 0;
  for (const set of SETS) {
    const undoSet = overrideRules("stats", set);
    startRun(1234);
    const p = game.player;
    const consistent = (what) => {
      const b = expectedBonus(p, statusBonus), table = St.bonusTable(p), fresh = St.bonusTableUncached(p);
      if (!same(Object.entries(table).sort(), Object.entries(fresh).sort()))
        problems.push(`${set}, ${what}: the cached bonuses differ from the sources`);
      for (const k of new Set([...Object.keys(b), ...Object.keys(table)]))
        if (Math.abs((b[k] || 0) - (table[k] || 0)) > 1e-9) { problems.push(`${set}, ${what}: bonus(${k}) is ${table[k] || 0}, expected ${b[k] || 0}`); break; }
      const want = expectedCore(p, b), got = { str: St.attr(p, "str"), maxHp: St.maxHp(p), av: St.av(p) };
      if (!same(want, got)) problems.push(`${set}, ${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
    };
    const before0 = derived(game, p);
    if (set === "legacy" && (before0.attrs.str !== 10 || before0.maxHp !== 20)) problems.push(`legacy start: STR ${before0.attrs.str}, max HP ${before0.maxHp} (want 10, 20)`);
    if (set === "attributes" && (before0.attrs.str !== 16 || before0.maxHp !== 20)) problems.push(`attribute start: STR ${before0.attrs.str}, max HP ${before0.maxHp} (want 16, 20)`);
    for (const proto of gear) {
      const it = { ...proto, props: proto.props && [...proto.props] }, slot = it.kind, part = PART[slot];
      const before = derived(game, p), old = p.body.equip[part];
      p.body.equip[part] = it; St.invalidateStats(p); changes++;
      consistent(`wearing ${slot} ${it.relic || it.id} ${it.ench}${it.props ? " " + it.props : ""}`);
      p.body.equip[part] = old; St.invalidateStats(p);
      const after = derived(game, p);
      if (!same(before, after)) problems.push(`${set}: taking off ${slot} ${it.relic || it.id} ${it.ench} changed ${diff(before, after)}`);
    }
    // Statuses through the "statuses" source: addStatus / removeStatus drop the cache themselves (no
    // invalidateStats here, so a status that forgot to would show as a stale cache).
    const before = derived(game, p);
    St.STATS_DEBUG.verify = true;
    try {
      addStatus(game, p, "checkMight", { t: 10, mag: 2 });
      consistent("with a status");
      if (St.attr(p, "str") !== before.attrs.str + 2) problems.push(`${set}: a +2 STR status gives STR ${St.attr(p, "str")}`);
      removeStatus(game, p, "checkMight");
      if (!same(before, derived(game, p))) problems.push(`${set}: removing the status changed ${diff(before, derived(game, p))}`);
      // Every registered status, on and off: the derived numbers come back exactly.
      for (const id in STATUS_DEFS) {
        const view = [game.view, game.mode];   // (flat forces the map view: put the view back after)
        addStatus(game, p, id, { t: 5 }); consistent(`status ${id}`); removeStatus(game, p, id);
        [game.view, game.mode] = view;
        if (!same(before, derived(game, p))) problems.push(`${set}: status ${id} on and off changed ${diff(before, derived(game, p))}`);
        statusesChecked++;
      }
    } catch (err) { problems.push(`${set}: statuses: ${err.message}`); }
    St.STATS_DEBUG.verify = false;
    // Every perk, every rank, through takePerk.
    for (const k in PERKS) for (let r = 0; r < (PERKS[k].max || 1); r++) { takePerk(game, k); consistent(`perk ${k} ${r + 1}`); }
    // A stale cache is caught (the check itself works).
    St.STATS_DEBUG.verify = true;
    p.body.equip.finger_r = { kind: "ring", id: "strength", ench: 3, known: true };   // no invalidateStats on purpose
    if (!throws(() => St.bonus(p, "str"))) problems.push(`${set}: STATS_DEBUG.verify missed a stale cache`);
    St.STATS_DEBUG.verify = false;
    St.invalidateStats(p);
    undoSet();
  }
  stats.gear = { items: gear.length, changes, sets: SETS.length, statusesOnOff: statusesChecked };

  // --- 3. No base-field writes from the inventory code ---------------------------------------
  {
    startRun(1234);
    const writes = [];
    St.raiseAttr(game.player, "str", 20);   // strong enough for everything (a permanent change, before the guard)
    const real = game.player;
    game.player = St.guardBaseFields(real, (path) => writes.push(path));
    const p = game.player;
    let equips = 0;
    for (const proto of gear) {
      if (proto.ench < 0) continue;   // cursed gear sticks: it would block the next item
      const it = { ...proto, props: proto.props && [...proto.props] };
      p.inv.push(it);
      const ok = inventory.equip(game, it, p.inv.length - 1);
      if (!ok) { problems.push(`inventory.equip refused ${it.kind} ${it.relic || it.id}`); continue; }
      equips++;
      if (St.maxHp(p) < p.hp) problems.push(`after equipping ${it.id}, HP ${p.hp} is above max HP ${St.maxHp(p)}`);
      if (it.kind === "weapon" && p.body.belt) { inventory.swapWeapons(game); inventory.swapWeapons(game); equips += 2; }
    }
    game.player = real;
    stats.inventory = { equips, baseWrites: writes.length };
    if (writes.length) problems.push(`the inventory code wrote base fields: ${[...new Set(writes)].join(", ")}`);
  }

  // --- 4. Attribute formulas at their reference points ---------------------------------------
  {
    const undoSet = overrideRules("stats", "attributes");
    const e = { attrs: St.makeAttrs(), level: 1, maxHpGain: 0, perks: new Set() };
    const at = (fn) => fn(e);
    const expect = (what, got, want) => { if (Math.abs(got - want) > 1e-9) problems.push(`attributes: ${what} is ${got}, expected ${want}`); };
    expect("max HP at TOU 16, level 1", at(St.maxHp), 20);
    e.level = 5; expect("max HP at TOU 16, level 5", at(St.maxHp), 32);
    e.attrs.tou = 20; expect("max HP at TOU 20, level 5", at(St.maxHp), 24 + 4 * 5);
    e.attrs.tou = 6; expect("max HP at TOU 6, level 5", at(St.maxHp), 10 + 4 * 1);
    e.attrs.tou = 16; e.level = 1;
    expect("DV at AGI 16", at(St.dv), 6); expect("MA at WIL 16", at(St.ma), 4);
    expect("DV while unable to act", St.dv(e, { unable: true }), 0);
    e.attrs.agi = 19; expect("DV at AGI 19", at(St.dv), 7);
    e.attrs.wil = 20; expect("cooldown at WIL 20", at(St.cooldownMul), 0.8); expect("MA at WIL 20", at(St.ma), 6);
    e.attrs.wil = 40; expect("cooldown at WIL 40 (floor)", at(St.cooldownMul), 0.2);
    expect("buy at EGO 16", St.priceMul(game, e).buy, 1.5); expect("sell at EGO 16", St.priceMul(game, e).sell, 0.3);
    e.attrs.ego = 20; expect("buy at EGO 20", St.priceMul(game, e).buy, 1.3); expect("sell at EGO 20", St.priceMul(game, e).sell, 0.4);
    // The Haggler (WS4's integration request 7): a fifth off buying, never under what the trader pays you.
    {
      const perks = e.perks;
      e.perks = { haggler: 1 }; St.invalidateStats(e);
      expect("the Haggler's buy at EGO 20", St.priceMul(game, e).buy, 1.3 * 0.8); expect("the Haggler's sell at EGO 20", St.priceMul(game, e).sell, 0.4);
      e.attrs.ego = 40; expect("the Haggler's buy at EGO 40 (the sell price)", St.priceMul(game, e).buy, St.priceMul(game, e).sell);
      e.attrs.ego = 20; e.perks = perks; St.invalidateStats(e);
    }
    expect("mental level at EGO 20, level 1", at(St.mentalLevel), 3);
    // The examine score (bible §13.4, WS5's request 14): INT's modifier plus bonus examine (the caller adds a d20).
    e.attrs.int = 20; expect("examine at INT 20", at(St.examineScore), 2);
    e.bonuses = { examine: 3 }; St.invalidateStats(e); expect("examine at INT 20 with +3", at(St.examineScore), 5);
    delete e.bonuses; St.invalidateStats(e); e.attrs.int = 16; expect("examine at INT 16", at(St.examineScore), 0);
    expect("carry at STR 16", at(St.carryCap), 240);
    undoSet();
  }

  // --- 5. Golden (a) with the cache verified and base writes watched -------------------------
  if (mechanics) {
    const r = mechanics();
    stats.goldenA = { steps: r.steps, mismatched: r.mismatched, baseWrites: r.writes.length };
    if (r.mismatched) problems.push(`golden (a) with the stat cache verified: ${r.mismatched} steps differ`);
    // The permanent changes in the scenario: 2 potions of strength, 1 strength crystal and Mighty (STR);
    // 2 heart crystals and Tough twice (max HP). Nothing else may touch a base field.
    const count = (path) => r.writes.filter((w) => w === path).length;
    if (count("attrs.str") !== 4) problems.push(`golden (a): ${count("attrs.str")} STR writes, expected 4`);
    if (count("maxHpGain") !== 4) problems.push(`golden (a): ${count("maxHpGain")} max HP writes, expected 4`);
    const other = r.writes.filter((w) => w !== "attrs.str" && w !== "maxHpGain");
    if (other.length) problems.push(`golden (a) wrote other base fields: ${[...new Set(other)].join(", ")}`);
  }

  // --- 6. Every item on every part through body.js, both formula sets -------------------------------
  {
    let fits = 0;
    for (const set of SETS) {
      const undoSet = overrideRules("stats", set);
      startRun(1234);
      const p = game.player;
      St.raiseAttr(p, "str", 20);   // strong enough for everything
      for (const part of Object.keys(p.body.equip)) if (p.body.equip[part]) Bd.unequip(game, p, part);
      if (p.body.belt) p.body.belt = null;
      St.invalidateStats(p);
      const bare = derived(game, p);
      St.STATS_DEBUG.verify = true;
      try {
        for (const proto of gear)
          for (const part of Bd.slotsFor(p, proto)) {
            const it = { ...proto, props: proto.props && [...proto.props] };
            const on = Bd.equip(game, p, it, part);
            if (!on.ok) { problems.push(`${set}: body.equip refused ${it.kind} ${it.relic || it.id} on ${part}: ${on.reason}`); continue; }
            fits++;
            const b = expectedBonus(p, statusBonus), table = St.bonusTable(p);
            for (const k of new Set([...Object.keys(b), ...Object.keys(table)]))
              if (Math.abs((b[k] || 0) - (table[k] || 0)) > 1e-9) { problems.push(`${set}: ${it.kind} ${it.relic || it.id} on ${part}: bonus(${k}) ${table[k] || 0}, expected ${b[k] || 0}`); break; }
            const want = expectedCore(p, b), got = { str: St.attr(p, "str"), maxHp: St.maxHp(p), av: St.av(p) };
            if (!same(want, got)) problems.push(`${set}: ${it.kind} ${it.relic || it.id} on ${part}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
            if (it.ench < 0) it.ench = 0;   // a curse holds it on: lift it to take it off
            const off = Bd.unequip(game, p, Bd.wornOn(p, part) === it ? part : Object.keys(p.body.equip).find((k) => p.body.equip[k] === it));
            if (!off.ok) problems.push(`${set}: body.unequip of ${it.kind} ${it.relic || it.id} from ${part}: ${off.reason}`);
            const now = derived(game, p);
            if (!same(bare, now)) problems.push(`${set}: ${it.kind} ${it.relic || it.id} on and off ${part} changed ${diff(bare, now)}`);
          }
      } catch (err) { problems.push(`${set}: body.equip/unequip: ${err.message}`); }
      St.STATS_DEBUG.verify = false;
      undoSet();
    }
    stats.bodyEquips = fits;
  }

  // --- 7. The rest of the 0B gate --------------------------------------------------------------------
  if (gate) {
    for (const view of ["map", "3d"]) {
      const g = gate.goldenA?.[view];
      if (!g || g.mismatched || g.steps !== 86) problems.push(`golden (a) through the ${view} controls: ${g ? `${g.mismatched} of ${g.steps} steps differ` : "not run"}`);
      for (const q of g?.problems || []) problems.push(`golden (a) ${view}: ${q}`);
    }
    const sk = gate.status?.skipTime600 || {};
    for (const [k, v] of Object.entries(sk))
      if (v.dHp !== undefined && (Math.abs(v.dHp) > 1 || Math.abs(v.dT) > 0.1)) problems.push(`skipTime(600), ${k}: ${v.dHp} HP, ${v.dT} s from stepping`);
    if (!Object.keys(sk).length) problems.push("skipTime(600): not run");
    const dr = gate.status?.drowning;
    if (!dr || dr.map.damage !== dr["3d"].damage || dr.map.exitTile !== dr["3d"].exitTile || dr.map.hits.length !== dr["3d"].hits.length
        || dr.map.hits.some((t, k) => Math.abs(t - dr["3d"].hits[k]) > 0.1)) problems.push(`drowning differs between the views: ${JSON.stringify(dr)}`);
    for (const q of gate.status?.problems || []) problems.push(`check-status: ${q}`);
    const fr = gate.frames;
    if (!fr || fr.mismatched || fr.frames !== 27) problems.push(`golden (b): ${fr ? `${fr.mismatched} of ${fr.frames} frames differ` : "not run"}`);
    stats.gate = {
      goldenA: Object.fromEntries(["map", "3d"].map((v) => [v, gate.goldenA?.[v] && `${gate.goldenA[v].steps - gate.goldenA[v].mismatched}/${gate.goldenA[v].steps} (${gate.goldenA[v].keys} keys, ${gate.goldenA[v].mapSteps} map steps, ${gate.goldenA[v].frames} frames)`])),
      skipTime600: Object.fromEntries(Object.entries(sk).map(([k, v]) => [k, v.dHp !== undefined ? `${v.dHp} HP, ${v.dT} s` : `killed ${v.killed}`])),
      drowning: dr && { map: dr.map.hits, "3d": dr["3d"].hits, damage: [dr.map.damage, dr["3d"].damage], exitTile: [dr.map.exitTile, dr["3d"].exitTile] },
      goldenB: fr && `${fr.frames - fr.mismatched}/${fr.frames} frames`,
    };
  }

  stats.ms = Date.now() - t0;
  return { name: "stats", ok: problems.length === 0, problems, stats };
}
