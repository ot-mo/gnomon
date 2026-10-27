// WS4's check (TECH_DESIGN §8.3 "WS4" acceptance; owner WS4): character creation and progression. Part 4a:
// creation, stats and leveling (docs/ws4.md "4a / 4b"); 4b adds mutations and abilities.
//
//   run(env) → { name, ok, problems, stats }        (tests/checks/index.js's contract; tools/check-progression.mjs)
//
// Everything new runs under RULES.stats = "attributes" (overrideRules, undone at the end); section 6 under "legacy".
//   1. Point-buy (bible §10.3, §15.6): 1 point per +1 up to 18, then 2; at most 22; the Bent's 44 points from 10,
//      the Plumb's 38 from 12; validateChoices refuses every way of getting it wrong, and makeCharacter throws for each.
//   2. Every genotype × background makes a valid player: the suggested spread, both extremes and seeded random
//      spreads (every point spent): base attributes as bought, the background's bonus through the stat bus, HP =
//      TOU + 4 (and full), DV = 6 + AGI mod, AV from the kit (+1 for Orrum), the kit and its glim in its purse, open
//      trees, creases 12 or grade 2 with the Level's free implant, plain JSON through the save codec (encodePlayer /
//      decodePlayer give it back whole). Each background's run begins (beginRun): its mode and reputation changes,
//      and it takes a step on the map and walks in 3D.
//   3. Levels 1 → 20 for every background, each card answered through the real keys: max HP follows TOU + 4 +
//      (level − 1) × max(1, 3 + TOU mod) at every level (and you stay at full health), the Bent gain a crease a level,
//      an attribute point comes at 4, 8, 12, 16, 20 and is spent on the card first, one power a level; 3 offers (4 at
//      INT 18+), all different, none still waiting (needs) or maxed, a major first at 5, 10, 15, 20. The same seed
//      makes the same offers; another seed other ones. XP: killXp's table, Pilgrim's kills and quests.
//   4. The wizard (screens/create.js) through the real key and mouse dispatch at 100×30: a Bent and a Plumb by
//      keyboard, a name typed with å, ä and ö; by mouse (rows, [-] [+], [ Suggest ], [ Next ], [ Begin ], a step at
//      the top); refusals (points unspent, no name), Esc back a step. Beginning starts the run with exactly the
//      choices made.
//   5. Names (bible §2.3, §15.11): 10,000 suggestions for each culture, none longer than 9 letters a word, none with a
//      banned word (check-names' list).
//   6. The old game under the legacy set: the quick start's player has no origin; a level gives +3 HP with the
//      parent's line and opens the parent's card ("Choose a gift"); offerPerks draws only the parent's 25.
import { findHits } from "./names.js";

const NAME = "progression";

export async function checkProgression(m) {
  const { game, step, draw, rules, stats: st, chargen: C, leveling: L, levelup: LU, create: W, keys, screens, codec,
          content: { GENOTYPES, BACKGROUNDS, LEVELS, POWERS, LEGACY_PERKS }, rng: R, capture } = m;
  const problems = [], out = {};
  const fail = (msg) => problems.push(msg);

  // --- helpers ---------------------------------------------------------------------------------------------------
  function frame() { draw(); return capture; }
  function rowText(y) { return capture.chars.slice(y * capture.cols, (y + 1) * capture.cols).join(""); }
  function find(label, { row = null, after = 0 } = {}) {
    frame();
    for (let y = 0; y < capture.rows; y++) {
      const line = rowText(y);
      if (row && !line.includes(row)) continue;
      const x = line.indexOf(label, after);
      if (x >= 0) return { x, y };
    }
    return null;
  }
  function click(label, opts) {
    const at = find(label, opts);
    if (!at) { fail(`wizard: "${label}" isn't on screen (step ${W.wizard().step})`); return false; }
    screens.dispatchMouse(game, 0, at);
    return true;
  }
  const press = (code, key = "") => keys.dispatchKey(game, code, false, key);
  // As a browser types: a capital comes after a keydown of Shift itself (ShiftLeft, "Shift").
  const typeText = (text) => {
    for (const ch of text) {
      if (ch !== ch.toLowerCase()) press("ShiftLeft", "Shift");
      press(ch === " " ? "Space" : ch === "-" ? "Minus" : `Key${ch.toUpperCase()}`, ch);
    }
  };
  // A run begun and on its feet: past the intro, on the map.
  function begun(choices, seed) {
    C.beginRun(game, choices, { seed });
    for (let k = 0; k < 20 && game.mode === "story"; k++) press("Space");
    game.messages = [];
    return game.player;
  }
  const choicesFor = (bg, attrs, extra = {}) => ({ genotype: BACKGROUNDS[bg].genotype, background: bg, attrs, name: "Test", mode: "oneWick", ...extra });

  // --- 1. Point-buy and validation ---------------------------------------------------------------------------------
  function section1() {
    const want = [["bent", 10, 0], ["bent", 18, 8], ["bent", 19, 10], ["bent", 22, 16], ["plumb", 12, 0], ["plumb", 18, 6], ["plumb", 22, 14]];
    for (const [g, s, c] of want) if (C.pointCost(g, s) !== c) fail(`pointCost(${g}, ${s}) = ${C.pointCost(g, s)}, want ${c}`);
    if (GENOTYPES.bent.points !== 44 || GENOTYPES.plumb.points !== 38) fail("the genotypes' points aren't 44 and 38");
    const a = C.baseAttrs("bent");
    a.str = 22; if (C.canRaise("bent", a, "str")) fail("canRaise past 22");
    a.str = 10; if (C.canLower("bent", a, "str")) fail("canLower below the base");
    Object.assign(a, { str: 18, agi: 22, tou: 22, int: 10, wil: 10, ego: 10 });   // 8 + 16 + 16 = 40 of 44: 4 left
    if (C.pointsLeft("bent", a) !== 4) fail(`pointsLeft = ${C.pointsLeft("bent", a)}, want 4`);
    Object.assign(a, { int: 13 });   // 1 left: a step from 18 costs 2
    if (C.canRaise("bent", a, "str")) fail("canRaise from 18 with 1 point left");
    if (!C.canRaise("bent", a, "wil")) fail("can't raise from 10 with 1 point left");
    // Every way of getting the choices wrong is refused, and makeCharacter throws for it.
    const good = choicesFor("reedcutter", C.suggestSpread("bent", "reedcutter"));
    if (C.validateChoices(good).length) fail(`the suggested reedcutter is refused: ${C.validateChoices(good).join("; ")}`);
    const bad = {
      "an unknown genotype": { genotype: "pure" }, "an unknown background": { background: "nobody" },
      "another genotype's background": { background: "archivistOfVey" }, "a point unspent": { attrs: { ...good.attrs, ego: good.attrs.ego - 1 } },
      "a point too many": { attrs: { ...good.attrs, ego: good.attrs.ego + 1 } }, "23 in one": { attrs: { ...good.attrs, str: 23 } },
      "below the base": { attrs: { ...good.attrs, str: 9 } }, "a fraction": { attrs: { ...good.attrs, str: 17.5 } },
      "no name": { name: "  " }, "a 25-letter name": { name: "Å".repeat(25) }, "no mode": { mode: "pressed" },
      "a newline in the name": { name: "Ann\nMari" }, "a NUL in the name": { name: "Ann\u0000" },
      "a direction mark in the name": { name: "Ann\u202e" }, "a lone combining mark for a name": { name: "\u0301" },
      "an unknown mutation": { mutations: ["wings"] }, "an implant for the Bent": { implant: "tallyEye" },
    };
    for (const name of ["Åsa Öberg-Ärla", "Zé", "Ess", "7", "Aurel Strade-Orrum", "Å".repeat(24)])
      if (C.validateChoices({ ...good, name }).length) fail(`validateChoices refused the name ${JSON.stringify(name)}: ${C.validateChoices({ ...good, name })}`);
    let refused = 0;
    for (const [what, change] of Object.entries(bad)) {
      const c = { ...good, ...change };
      if (!C.validateChoices(c).length) { fail(`validateChoices took ${what}`); continue; }
      let threw = false;
      try { C.makeCharacter(c); } catch { threw = true; }
      if (!threw) fail(`makeCharacter took ${what}`); else refused++;
    }
    const plumb = { ...choicesFor("forgehandOfOrrum", C.suggestSpread("plumb", "forgehandOfOrrum")), mutations: ["x"] };
    if (!C.validateChoices(plumb).length) fail("validateChoices gave the Plumb a mutation");
    // The Plumb's free implant: its Level's own (or none named: the same); nothing else while WS5's table is empty; with
    // implants in the table, any costing at most 2, the background's own listed first.
    const forge = choicesFor("forgehandOfOrrum", C.suggestSpread("plumb", "forgehandOfOrrum"));
    for (const [implant, ok] of [[undefined, true], [null, true], ["truesteelKnuckles", true], ["tallyEye", false], ["noSuchImplant", false], [42, false], ["", false]]) {
      const got = C.validateChoices({ ...forge, implant });
      if (ok === !!got.length) fail(`validateChoices with implant ${JSON.stringify(implant)}: ${got.join("; ") || "taken"}`);
      if (!ok && !got.some((x) => /free implant/.test(x))) fail(`implant ${JSON.stringify(implant)} refused for the wrong reason: ${got}`);
    }
    const IMPL = m.implants.IMPLANTS;
    Object.assign(IMPL, { testEye: { name: "test eye", grade: 2, parts: ["face"] }, testHeavy: { name: "test heavy", grade: 3, parts: ["body"] },
                          truesteelKnuckles: { name: "truesteel knuckles", grade: 1, parts: ["hands"] } });
    try {
      const free = C.freeImplants("forgehandOfOrrum");
      if (free.join() !== "truesteelKnuckles,testEye") fail(`freeImplants with implants in the table: ${free}`);
      if (C.validateChoices({ ...forge, implant: "testEye" }).length || !C.validateChoices({ ...forge, implant: "testHeavy" }).length)
        fail("with implants in the table: a cost-2 implant refused, or a cost-3 one taken free");
      if (C.freeImplants("archivistOfVey")[0] !== "tallyEye") fail(`an Archivist's free implants start ${C.freeImplants("archivistOfVey")[0]} (its own isn't in the table yet)`);
    } finally { for (const id of ["testEye", "testHeavy", "truesteelKnuckles"]) delete IMPL[id]; }
    out.pointBuy = `${want.length} costs, ${refused + 1} wrong choices refused`;
  }

  // --- 2. Every genotype × background ------------------------------------------------------------------------------
  function spreads(g, bg, rng) {
    const list = [["suggested", C.suggestSpread(g, bg)]];
    // The extremes: everything into the first attributes (22, 22, …), or into the last.
    for (const [label, order] of [["first-heavy", st.ATTRS], ["last-heavy", [...st.ATTRS].reverse()]]) {
      const a = C.baseAttrs(g);
      for (const k of order) while (C.canRaise(g, a, k)) a[k]++;
      for (const k of st.ATTRS) while (C.canRaise(g, a, k)) a[k]++;   // (a point a steep step couldn't take)
      list.push([label, a]);
    }
    for (let n = 0; n < 4; n++) {
      const a = C.baseAttrs(g);
      for (let guard = 0; guard < 500 && C.pointsLeft(g, a) > 0; guard++) { const k = rng.pick(st.ATTRS); if (C.canRaise(g, a, k)) a[k]++; else if (!st.ATTRS.some((x) => C.canRaise(g, a, x))) break; }
      list.push([`random ${n + 1}`, a]);
    }
    return list;
  }

  function section2() {
    const rng = R.makeRng(20261027);
    let made = 0, runs = 0;
    for (const [bg, B] of Object.entries(BACKGROUNDS)) {
      const g = B.genotype, G = GENOTYPES[g];
      for (const [label, attrs] of spreads(g, bg, rng)) {
        const what = `${bg} (${label} ${JSON.stringify(attrs)})`;
        if (C.pointsLeft(g, attrs) !== 0) { fail(`${what}: ${C.pointsLeft(g, attrs)} points left by the spread`); continue; }
        let p;
        try { p = C.makeCharacter(choicesFor(bg, attrs, { name: "Ylva Ärlig", mode: "commonsLamp" })); }
        catch (err) { fail(`${what}: ${err.message}`); continue; }
        made++;
        for (const k of st.ATTRS) {
          if (p.attrs[k] !== attrs[k]) fail(`${what}: base ${k} ${p.attrs[k]}, bought ${attrs[k]}`);
          if (attrs[k] < G.base || attrs[k] > G.maxAtCreation) fail(`${what}: ${k} ${attrs[k]} outside ${G.base}-${G.maxAtCreation}`);
          const want = attrs[k] + (B.bonus[k] || 0);
          if (st.attr(p, k) !== want) fail(`${what}: ${k} reads ${st.attr(p, k)}, want ${want}`);
        }
        const tou = st.attr(p, "tou");
        if (st.maxHp(p) !== tou + 4 || p.hp !== st.maxHp(p)) fail(`${what}: HP ${p.hp}/${st.maxHp(p)}, want ${tou + 4}`);
        const wantDv = 6 + Math.floor((st.attr(p, "agi") - 16) / 2);
        if (st.dv(p) !== wantDv) fail(`${what}: DV ${st.dv(p)}, want ${wantDv}`);
        const armour = { clothes: 0, leather: 1, chain: 2 }[B.kit.equip.body?.id] ?? 0, wantAv = armour + (LEVELS[B.level]?.bonus?.av || 0);
        if (st.av(p) !== wantAv) fail(`${what}: AV ${st.av(p)}, want ${wantAv}`);
        if (p.level !== 1 || p.xp !== 0 || p.maxHpGain !== 0 || p.attrPoints !== 0) fail(`${what}: level ${p.level}, xp ${p.xp}, gains ${p.maxHpGain}, points ${p.attrPoints}`);
        if (p.funds !== B.glim || p.funds > (p.purse || 200) || (B.purse && p.purse !== B.purse)) fail(`${what}: ${p.funds} glim in a ${p.purse} purse, want ${B.glim}`);
        if (JSON.stringify(p.trees) !== JSON.stringify(B.trees)) fail(`${what}: trees ${p.trees}`);
        for (const t of p.trees) if (!m.content.TREES[t]) fail(`${what}: no tree ${t}`);
        if (p.body.equip.hand_r?.kind !== "weapon" || !m.items.WEAPONS[p.body.equip.hand_r.id]) fail(`${what}: holds no weapon (${JSON.stringify(p.body.equip.hand_r)})`);
        for (const [part, it] of Object.entries(B.kit.equip)) if (m.items.ITEM_KINDS[it.kind] && p.body.equip[part]?.id !== it.id) fail(`${what}: ${part} holds ${JSON.stringify(p.body.equip[part])}`);
        if (B.kit.belt && p.body.belt?.id !== B.kit.belt.id) fail(`${what}: the belt holds ${JSON.stringify(p.body.belt)}`);
        for (const it of p.inv) if (!m.items.ITEM_KINDS[it.kind]) fail(`${what}: an unknown kind in the pack: ${it.kind}`);
        const packWant = (B.kit.pack || []).filter((it) => m.items.ITEM_KINDS[it.kind]).length;
        if (p.inv.length !== packWant) fail(`${what}: ${p.inv.length} stacks in the pack, want ${packWant}`);
        if (g === "bent" ? p.creases !== 12 || "grade" in p : p.grade !== 2 || "creases" in p || p.origin.implant !== B.implant)
          fail(`${what}: creases ${p.creases}, grade ${p.grade}, implant ${p.origin?.implant}`);
        if (p.name !== "Ylva Ärlig" || p.genotype !== g || p.background !== bg) fail(`${what}: ${p.name}, ${p.genotype}, ${p.background}`);
        const jp = codec.jsonProblems(p);
        if (jp.length) fail(`${what}: not plain JSON: ${jp.slice(0, 3).join("; ")}`);
        const back = codec.decodePlayer(codec.encodePlayer(p));
        if (codec.canonicalJson(codec.encodePlayer(back)) !== codec.canonicalJson(codec.encodePlayer(p))) fail(`${what}: the save codec doesn't give it back whole`);
        for (const k of st.ATTRS) if (st.attr(back, k) !== st.attr(p, k)) fail(`${what}: ${k} ${st.attr(back, k)} after a load`);
        if (st.maxHp(back) !== st.maxHp(p)) fail(`${what}: max HP ${st.maxHp(back)} after a load`);
      }
      // The run: begun, its mode and standing, a step on the map and a walk in 3D.
      const p = begun(choicesFor(bg, C.suggestSpread(g, bg), { name: "Åke", mode: "pilgrim" }), 900 + runs);
      runs++;
      if (game.player.background !== bg || game.state.mode !== "pilgrim" || game.mode !== "map") fail(`${bg}: the run began as ${game.player.background}, mode ${game.state.mode}, in ${game.mode}`);
      for (const [f, n] of Object.entries(B.rep || {})) if (game.state.rep?.[f] !== n) fail(`${bg}: ${f} at ${game.state.rep?.[f]}, want ${n}`);
      const t0 = game.time, x0 = p.x, y0 = p.y;
      for (const code of ["KeyS", "KeyD", "KeyW", "KeyA", "KeyS", "KeyD"]) { press(code); if (p.x !== x0 || p.y !== y0) break; }
      if (p.x === x0 && p.y === y0) fail(`${bg}: no step on the map moved`);
      if (!(game.time > t0)) fail(`${bg}: a step on the map passed no time`);
      game.story.cube = true;
      game.view = "3d"; game.mode = "explore"; game.paused = false;
      const keySet = new Set(["KeyW"]);
      for (let k = 0; k < 30; k++) { m.playerMod.updatePlayer(p, game.zone, keySet, 1 / 60); p.yaw += 0.2; }
      if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) fail(`${bg}: lost in 3D`);
      game.mode = "map"; game.view = "map";
    }
    out.characters = `${made} made (12 backgrounds × 7 spreads), ${runs} runs begun`;
  }

  // --- 3. Levels 1 → 20 --------------------------------------------------------------------------------------------
  function climb(bg, seed, { pick = R.makeRng(seed) } = {}) {
    const B = BACKGROUNDS[bg], g = B.genotype;
    const p = begun(choicesFor(bg, C.suggestSpread(g, bg)), seed);
    const offers = [], issues = [];
    let pointsGot = 0, pointsSpent = 0, majors = 0;
    for (let level = 2; level <= 20; level++) {
      const fullBefore = p.hp === st.maxHp(p), maxBefore = st.maxHp(p);
      game.messages = [];
      L.gainXp(game, L.xpToNext(p.level) - p.xp, { source: "quest" });
      // What the level gave, in the log and on its card: "+N max HP" (max(1, 3 + TOU mod)), the Bent's crease, the point.
      const hpPer = Math.max(1, 3 + Math.floor((st.attr(p, "tou") - 16) / 2));
      const gains = [`+${hpPer} max HP`, ...(g === "bent" ? ["+1 crease"] : []), ...(level % 4 === 0 ? ["an attribute point"] : [])];
      const line = `You reach level ${level}${level % 5 === 0 ? " (a milestone!)" : ""}! (${gains.join(", ")})`;
      if (!game.messages.some((x) => x.text === line)) issues.push(`level ${level}: the log says ${JSON.stringify(game.messages.map((x) => x.text))}, want "${line}"`);
      if (p.level !== level || p.pendingLevels !== 1) { issues.push(`level ${p.level}, pending ${p.pendingLevels} (want ${level}, 1)`); break; }
      // The level's HP is yours at once: full before, full after (the HP gain is the max HP gain).
      if (!fullBefore) issues.push(`level ${level}: not at full health before the level (${p.hp}/${maxBefore})`);
      else if (p.hp !== st.maxHp(p) || st.maxHp(p) <= maxBefore) issues.push(`level ${level}: ${p.hp}/${st.maxHp(p)} after the level, ${maxBefore} before`);
      step(1 / 60);
      if (game.mode !== "levelup") { issues.push(`level ${level}: no card (in ${game.mode})`); break; }
      if (level % 4 === 0) {
        pointsGot++;
        if (LU.levelCard(game).step !== "attr") issues.push(`level ${level}: the card asks for no attribute point first`);
        const k = pick.pick(st.ATTRS), before = st.attr(p, k), full = p.hp === st.maxHp(p);
        press(`Digit${st.ATTRS.indexOf(k) + 1}`);
        if (st.attr(p, k) !== before + 1) issues.push(`level ${level}: the point didn't raise ${k}`); else pointsSpent++;
        if (full && p.hp !== st.maxHp(p)) issues.push(`level ${level}: ${k} up left you at ${p.hp}/${st.maxHp(p)}`);
      }
      const card = LU.levelCard(game), ids = [...game.perkChoices];
      offers.push(`${level}:${ids.join(",")}`);
      if (card.gains.join(" · ") !== gains.join(" · ")) issues.push(`level ${level}: the card's gains are "${card.gains.join(" · ")}", want "${gains.join(" · ")}"`);
      else { frame(); if (!Array.from({ length: capture.rows }, (_, y) => rowText(y)).some((r) => r.includes(gains.join(" · ")))) issues.push(`level ${level}: the card doesn't show "${gains.join(" · ")}"`); }
      // Offers come from the open trees and the general pool first (bible §10.8); only when those can't fill the card do
      // the other trees come in.
      const mine = Object.keys(POWERS).filter((id) => !POWERS[id].needs && !POWERS[id].major && L.perkRank(p, id) < (POWERS[id].max || 1) &&
        (POWERS[id].general || p.trees.includes(POWERS[id].tree)));
      const minor = ids.filter((id) => !POWERS[id]?.major);
      if (minor.length && (mine.length >= minor.length ? minor.some((id) => !mine.includes(id)) : mine.some((id) => !ids.includes(id))))
        issues.push(`level ${level}: offers ${ids} pass over the open trees and the general pool (${mine})`);
      const n = st.attr(p, "int") >= 18 ? 4 : 3;
      if (card.step !== "power") issues.push(`level ${level}: the card is on ${card.step}`);
      if (ids.length !== n) issues.push(`level ${level}: ${ids.length} offers at INT ${st.attr(p, "int")}, want ${n}`);
      if (new Set(ids).size !== ids.length) issues.push(`level ${level}: an offer twice (${ids})`);
      for (const id of ids) {
        if (!POWERS[id]) issues.push(`level ${level}: no power ${id}`);
        else if (POWERS[id].needs) issues.push(`level ${level}: ${id} offered, still waiting for ${POWERS[id].needs}`);
        else if (L.perkRank(p, id) >= (POWERS[id].max || 1)) issues.push(`level ${level}: ${id} offered at its last rank`);
        else if (POWERS[id].major && !(level % 5 === 0 && id === ids[0])) issues.push(`level ${level}: the major ${id} offered off a milestone`);
      }
      if (level % 5 === 0) { if (POWERS[ids[0]]?.major) majors++; else issues.push(`level ${level}: no major first at a milestone (${ids})`); }
      const k = pick.int(0, ids.length - 1), id = ids[k], rank = L.perkRank(p, id), full = p.hp === st.maxHp(p);
      press(`Digit${k + 1}`);
      if (L.perkRank(p, id) !== rank + 1) issues.push(`level ${level}: taking ${id} left it at rank ${L.perkRank(p, id)}`);
      if (game.mode === "levelup") issues.push(`level ${level}: the card stays open`);
      if (full && p.hp !== st.maxHp(p)) issues.push(`level ${level}: not at full health after the card (${p.hp}/${st.maxHp(p)})`);
      const tou = st.attr(p, "tou"), per = Math.max(1, 3 + Math.floor((tou - 16) / 2));
      const want = tou + 4 + (level - 1) * per + p.maxHpGain + st.bonus(p, "maxHp");
      if (st.maxHp(p) !== want) issues.push(`level ${level}: max HP ${st.maxHp(p)}, want ${want} (TOU ${tou})`);
      if (g === "bent" && p.creases !== 12 + level - 1) issues.push(`level ${level}: ${p.creases} creases, want ${11 + level}`);
    }
    const ranks = Object.keys(p.perks).reduce((n, id) => n + L.perkRank(p, id), 0);
    if (ranks !== 19) issues.push(`19 levels gave ${ranks} power ranks`);
    if (pointsGot !== 5 || pointsSpent !== 5 || p.attrPoints !== 0) issues.push(`attribute points: ${pointsGot} got, ${pointsSpent} spent, ${p.attrPoints} left (want 5, 5, 0)`);
    if (majors !== 4) issues.push(`${majors} majors at levels 5-20, want 4`);
    return { offers, issues, p };
  }

  function section3() {
    let levels = 0, fourOffers = 0;
    for (const bg of Object.keys(BACKGROUNDS)) {
      const { offers, issues, p } = climb(bg, 3100 + bg.length);
      for (const i of issues) fail(`${bg}: ${i}`);
      levels += offers.length;
      if (st.attr(p, "int") >= 18) fourOffers++;
    }
    out.levels = `${levels} level-ups through the card (12 backgrounds × 19), ${fourOffers} of the 12 at INT 18+ by level 20`;
    // The same seed, the same offers; another seed, other ones. (The choices are drawn from their own seeded stream.)
    const a = climb("hushNovice", 77, { pick: R.makeRng(5) }).offers, b = climb("hushNovice", 77, { pick: R.makeRng(5) }).offers;
    const c = climb("hushNovice", 78, { pick: R.makeRng(5) }).offers;
    if (a.join(" ") !== b.join(" ")) fail(`the same seed made other offers: ${a.find((x, k) => x !== b[k])} / ${b.find((x, k) => x !== a[k])}`);
    if (a.join(" ") === c.join(" ")) fail("seeds 77 and 78 made the same 19 offers");
    out.sameSeed = `seed 77 twice: ${a.length} offers the same; seed 78: ${a.filter((x, k) => x !== c[k]).length} of ${a.length} differ`;
    // Levels 3 to 8 in one gain: six cards in order, each with its level, its milestone (5 only) and the major first there;
    // a level's own point (4 and 8) comes with its card, and a point kept for later ("Keep it for a later level") is
    // asked about again on the next card.
    {
      const p = begun(choicesFor("droversChild", C.suggestSpread("bent", "droversChild")), 41);
      L.gainXp(game, L.xpToNext(1), { source: "quest" }); step(1 / 60); press("Digit1");   // level 2, out of the way
      let xp = 0;
      for (let l = 2; l < 8; l++) xp += L.xpToNext(l);
      L.gainXp(game, xp - p.xp, { source: "quest" });
      const seen = [];
      let kept = 0;
      if (p.level !== 8 || p.pendingLevels !== 6 || p.attrPoints !== 0) fail(`six levels at once: level ${p.level}, pending ${p.pendingLevels}, points ${p.attrPoints}`);
      for (let k = 0; k < 6; k++) {
        step(1 / 60);
        const cd = LU.levelCard(game), first = POWERS[game.perkChoices[0]], own = cd.level % 4 === 0 ? 1 : 0;
        seen.push(`${cd.level}${cd.step === "attr" ? `+${p.attrPoints}` : ""}${cd.milestone ? "!" : ""}`);
        if (cd.level !== k + 3) fail(`six levels at once: card ${k + 1} is level ${cd.level}, want ${k + 3}`);
        if (p.attrPoints !== kept + own || (cd.step === "attr") !== (kept + own > 0)) fail(`six levels at once: level ${cd.level}'s card holds ${p.attrPoints} points (want ${kept + own}) on ${cd.step}`);
        if (cd.milestone !== (cd.level === 5) || (cd.level === 5 && !first?.major)) fail(`six levels at once: level ${cd.level} milestone ${cd.milestone}, first offer ${game.perkChoices[0]}`);
        if (cd.step === "attr" && cd.level === 4) {
          press("Digit7");
          kept = 1;
          if (p.attrPoints !== 1 || LU.levelCard(game).step !== "power") fail(`"Keep it for a later level": ${p.attrPoints} points kept, on ${LU.levelCard(game).step}`);
        } else if (cd.step === "attr") {
          for (let n = p.attrPoints; n > 0; n--) { const before = st.attr(p, "tou"); press("Digit3"); if (st.attr(p, "tou") !== before + 1) fail(`six levels at once: a point didn't raise TOU at level ${cd.level}`); }
          kept = 0;
        }
        press("Digit1");
        if (game.mode === "levelup") fail(`six levels at once: level ${cd.level}'s card stays open`);
      }
      if (p.attrPoints !== 0) fail(`six levels at once: ${p.attrPoints} points left`);
      // Two gifts at level 10 (a teacher's trick: bonusPerks): no milestone and no major, a draw each, other offers.
      L.gainXp(game, L.xpToNext(8) + L.xpToNext(9) - p.xp, { source: "quest" });
      for (let k = 0; k < 4 && p.pendingLevels > 0; k++) { step(1 / 60); if (LU.levelCard(game).step === "attr") press("Digit3"); press("Digit1"); }
      p.bonusPerks = 2;
      const gifts = [];
      for (let k = 0; k < 2; k++) {
        step(1 / 60);
        const cd = LU.levelCard(game);
        gifts.push([...game.perkChoices]);
        // Each gift draws on its own (draw 1, 2…), never the level's own offers (draw 0).
        const own = L.offerPowers(game, p, { level: 10, milestone: false, draw: k + 1 }), level0 = L.offerPowers(game, p, { level: 10, milestone: false, draw: 0 });
        if (game.perkChoices.join() !== own.join() || game.perkChoices.join() === level0.join()) fail(`gift ${k + 1}: offers ${game.perkChoices}, its draw ${own}, the level's ${level0}`);
        if (game.mode !== "levelup" || !cd.gift || cd.milestone || cd.level !== 10 || game.perkChoices.some((id) => POWERS[id].major)) fail(`gift ${k + 1} at level ${p.level}: ${JSON.stringify({ mode: game.mode, gift: cd.gift, milestone: cd.milestone, level: cd.level, offers: game.perkChoices })}`);
        press("Digit1");
      }
      if (p.bonusPerks !== 0 || p.giftDraws !== 2 || gifts[0].join() === gifts[1].join()) fail(`two gifts: ${p.bonusPerks} left, draws ${p.giftDraws}, offers ${gifts.map((o) => o.join(",")).join(" / ")}`);
      out.together = `levels 3-8 in one gain: cards ${seen.join(" ")}, a point kept for later; two gifts at 10: ${gifts.map((o) => o.join(",")).join(" / ")}`;
    }
    // XP (bible §10.7, §15.6).
    const p = begun(choicesFor("reedcutter", C.suggestSpread("bent", "reedcutter")), 5);
    const kx = (c, opts) => L.killXp(game, c, opts);
    const table = [[{ level: 1 }, 1, 1], [{ level: 10 }, 1, 10], [{ level: 10, elite: "x" }, 1, 25], [{ level: 10 }, 1, 100, { legendary: true }],
                   [{ level: 4 }, 10, 1], [{ level: 1 }, 10, 0], [{ level: 5 }, 5, 3]];
    for (const [c, pl, want, opts] of table) { p.level = pl; const got = kx(c, opts); if (got !== want) fail(`killXp(level ${c.level}${c.elite ? " elite" : ""}${opts ? " legendary" : ""}) at level ${pl} = ${got}, want ${want}`); }
    p.level = 1; p.xp = 0;
    game.state.mode = "pilgrim";
    L.gainXp(game, 10); const afterKill = p.xp;
    L.gainXp(game, 5, { source: "quest" }); const afterQuest = p.xp;
    if (afterKill !== 0 || afterQuest !== 11) fail(`Pilgrim: a kill of 10 gave ${afterKill}, a quest of 5 then ${afterQuest - afterKill} (want 0 and 11)`);
    game.state.mode = "oneWick"; p.xp = 0;
    L.gainXp(game, 10);
    if (p.xp !== 10) fail(`One Wick: a kill of 10 gave ${p.xp}`);
    if (L.xpReward("landmark", 2) !== 15 || L.xpReward("beat", 10) !== 758) fail(`xpReward: landmark at 2 ${L.xpReward("landmark", 2)}, beat at 10 ${L.xpReward("beat", 10)}`);
    out.xp = "killXp 7 cases, Pilgrim kills 0 and quests x2.2, rewards";
  }

  // --- 4. The wizard ---------------------------------------------------------------------------------------------
  function section4() {
    const steps = [];
    const at = () => W.wizard().step;
    const expect = (step, what) => { if (at() !== step) fail(`wizard: ${what}: on ${at()}, want ${step}`); };
    // By keyboard: a Bent (the third background), points moved about, a name with å, ä, ö; then a Plumb.
    for (const [g, bgIndex, name, mode] of [["bent", 2, "Åsa Öberg-Ärla", "commonsLamp"], ["plumb", 4, "Märta Dell-Cassin", "oneWick"]]) {
      W.openCreate(game, { seed: 4242, mode: "pilgrim" });
      expect("genotype", "opened");
      if (g === "plumb") press("ArrowDown");
      press("Enter"); expect("background", "Enter on the genotype");
      press("Escape"); expect("genotype", "Esc on the background");
      press("Enter");
      for (let k = 0; k < bgIndex; k++) press("ArrowDown");
      press("Enter"); expect("attributes", "Enter on the background");
      const bg = W.wizard().background;
      if (BACKGROUNDS[bg]?.genotype !== g) fail(`wizard: chose ${bg} for ${g}`);
      press("ArrowDown"); press("ArrowLeft"); press("ArrowLeft");   // AGI down 2: 2 points loose
      press("Enter");
      expect("attributes", "Enter with points unspent");
      if (!/Spend every point/.test(W.wizard().msg)) fail(`wizard: no word about the unspent points (${W.wizard().msg})`);
      press("ArrowUp"); press("ArrowUp"); press("ArrowRight"); press("ArrowUp"); press("ArrowRight");   // EGO and WIL up
      const attrs = W.wizard().attrs;
      if (C.pointsLeft(g, attrs) !== 0) fail(`wizard: ${C.pointsLeft(g, attrs)} points left after moving two (${JSON.stringify(attrs)})`);
      press("Enter"); expect("track", "Enter on the attributes");
      press("Enter"); expect("name", "Enter on the second track");
      if (!W.wizard().name) fail("wizard: no name suggested");
      press("Tab"); const second = W.wizard().name;
      if (!second) fail("wizard: Tab suggested nothing");
      typeText(name);   // over the suggestion, which the first letter (after its Shift) replaces whole
      if (W.wizard().name !== name) fail(`wizard: typed "${name}", the field holds "${W.wizard().name}"`);
      press("KeyM", "m"); press("Backspace");   // M types here (no music toggle)
      if (game.messages.some((x) => /^Music/.test(x.text))) fail("wizard: M on the name toggled the music");
      press("Enter"); expect("mode", "Enter on the name");
      const modeRow = W.wizard().mode === "pilgrim" ? 2 : 0, wantRow = ["oneWick", "commonsLamp", "pilgrim"].indexOf(mode);
      for (let k = modeRow; k < wantRow; k++) press("ArrowDown");
      for (let k = modeRow; k > wantRow; k--) press("ArrowUp");
      press("Enter"); expect("begin", "Enter on the mode");
      frame();
      if (!rowText(4).includes(name)) fail(`wizard: the summary doesn't show "${name}"`);
      press("Enter");
      const p = game.player;
      if (game.mode !== "story" && game.mode !== "map") fail(`wizard: Enter on Begin left ${game.mode}`);
      if (p.name !== name || p.genotype !== g || p.background !== bg || game.state.mode !== mode || game.seed !== 4242)
        fail(`wizard: began ${p.name}, ${p.genotype}, ${p.background}, ${game.state.mode}, seed ${game.seed}`);
      for (const k of st.ATTRS) if (p.attrs[k] !== attrs[k]) fail(`wizard: ${k} began at ${p.attrs[k]}, chose ${attrs[k]}`);
      if (g === "plumb" && p.origin.implant !== BACKGROUNDS[bg].implant) fail(`wizard: the Plumb's implant is ${p.origin.implant}`);
      steps.push(`${g} by keys`);
    }
    // By mouse: a Plumb (Forgehand of Orrum), [-] [+], a suggested name, Commons Lamp, a step at the top to go back.
    {
      W.openCreate(game, { seed: 99 });
      click("Plumb"); click("Plumb"); expect("background", "two clicks on Plumb");
      click("Forgehand of Orrum"); click("Forgehand of Orrum"); expect("attributes", "two clicks on a background");
      const before = W.wizard().attrs;
      click("[-]", { row: "INT" }); click("[-]", { row: "INT" }); click("[+]", { row: "TOU" });   // 2 points back, a step past 18 costs 2
      const after = W.wizard().attrs;
      if (after.int !== before.int - 2 || after.tou !== before.tou + 1 || C.pointsLeft("plumb", after) !== 0) fail(`wizard: [-] [-] INT and [+] TOU gave ${JSON.stringify(after)} from ${JSON.stringify(before)}`);
      click("[ Next ]"); expect("track", "[ Next ] on the attributes");
      click("[ Next ]"); expect("name", "[ Next ] on the implant");
      click("[ Suggest ]");
      const suggested = W.wizard().name;
      if (!/-Orrum$/.test(suggested)) fail(`wizard: a Forgehand of Orrum's name is "${suggested}"`);
      click("[ Next ]"); expect("mode", "[ Next ] on the name");
      click("Commons Lamp"); click("Commons Lamp"); expect("begin", "two clicks on Commons Lamp");
      click("Attributes", { row: "Genotype" }); expect("attributes", "a click on the step at the top");
      click("[ Next ]"); click("[ Next ]"); click("[ Next ]"); click("[ Next ]"); expect("begin", "four clicks on [ Next ]");
      click("[ Begin ]");
      const p = game.player;
      if (p.background !== "forgehandOfOrrum" || p.name !== suggested || game.state.mode !== "commonsLamp" || p.attrs.tou !== after.tou)
        fail(`wizard: the mouse began ${p.background}, "${p.name}", ${game.state.mode}, TOU ${p.attrs.tou}`);
      steps.push("plumb by mouse");
    }
    // By mouse: a Bent, the [ Back ] button, and refusing an empty name.
    {
      W.openCreate(game, { seed: 5 });
      click("[ Next ]"); click("[ Next ]"); expect("attributes", "[ Next ] twice from the start");
      click("[ Back ]"); expect("background", "[ Back ]");
      click("[ Next ]"); click("[ Next ]"); click("[ Next ]");
      expect("name", "on to the name");
      for (let k = 0; k < 30; k++) press("Backspace");
      click("[ Next ]");
      expect("name", "[ Next ] with no name");
      if (!/name/.test(W.wizard().msg)) fail(`wizard: no word about the missing name (${W.wizard().msg})`);
      press("Escape"); expect("track", "Esc on the name");
      steps.push("bent by mouse (refusals)");
      // Every step reached, back to the start, the cursor moved to the other genotype, and a click on Begin at the top:
      // the new genotype forgets the rest, so it goes to the backgrounds (it once drew the summary with no background).
      for (let k = 0; k < 8 && at() !== "begin"; k++) press("Enter");
      for (let k = 0; k < 8 && at() !== "genotype"; k++) press("Escape");
      press("ArrowDown");
      let threw = null;
      try { click("Begin", { row: "Genotype" }); frame(); } catch (err) { threw = err.message; }
      if (threw || at() !== "background" || W.wizard().genotype !== "plumb") fail(`wizard: a jump to Begin after changing the genotype: ${threw || `on ${at()}, ${W.wizard().genotype}`}`);
    }
    // Every step fits 100×30: the buttons and the key help are on screen.
    out.wizard = `${steps.join(", ")} at ${capture.cols}×${capture.rows}`;
  }

  // --- 5. Names ------------------------------------------------------------------------------------------------
  function section5() {
    const rng = R.makeRng(1012);
    const sets = [["bent", "reedcutter"], ["bent", "droversChild"], ["plumb", "lamplighterOfCassin"]];
    const names = [];
    let long = 0;
    for (const [g, bg] of sets)
      for (let k = 0; k < 10000; k++) {
        const name = C.suggestName(g, bg, rng);
        names.push(name);
        const words = name.split(/[ -]/);
        if (words.some((w) => w.length > 9 && !LEVELS_NAMES.has(w)) || [...name].length > C.NAME_MAX) long++;
      }
    if (long) fail(`${long} suggested names have a word over 9 letters or pass ${C.NAME_MAX}`);
    const { hits } = findHits([{ file: "names", text: names.join("\n") }]);
    if (hits.length) fail(`suggested names with banned words: ${hits.slice(0, 5).map((h) => `${h.term} in "${h.text}"`).join("; ")}`);
    out.names = `${names.length} suggested, ${new Set(names).size} different, 0 banned`;
  }

  // --- 6. The old game ---------------------------------------------------------------------------------------------
  function section6() {
    if (rules.RULES.stats !== "legacy") { fail("the legacy set isn't the default"); return; }
    game.debug.startRun(31);
    for (let k = 0; k < 20 && game.mode === "story"; k++) press("Space");
    const p = game.player;
    if (p.background || p.genotype || [...C.originBonuses(p)].length) fail("the quick start's player has an origin");
    if (st.maxHp(p) !== 20 || st.attr(p, "str") !== 10) fail(`the quick start reads max HP ${st.maxHp(p)}, STR ${st.attr(p, "str")}`);
    const hp0 = p.hp;
    game.messages = [];
    L.gainXp(game, 20);
    if (p.level !== 2 || p.hp !== hp0 + 3 || p.pendingLevels !== 1) fail(`legacy level 2: level ${p.level}, HP +${p.hp - hp0}, pending ${p.pendingLevels}`);
    if (!game.messages.some((x) => x.text === "You reach level 2! (+3 max HP)")) fail(`legacy level 2 said: ${game.messages.map((x) => x.text).join(" / ")}`);
    step(1 / 60);
    if (game.mode !== "levelup") fail(`legacy: no card (in ${game.mode})`);
    frame();
    const text = Array.from({ length: capture.rows }, (_, y) => rowText(y)).join("\n");
    if (!text.includes("LEVEL 2! Choose a gift:") || text.includes("Choose a power")) fail("legacy: the card isn't the parent's");
    press("Digit1");
    if (game.mode === "levelup") fail("legacy: 1 didn't take a perk");
    const seen = new Set();
    for (let k = 0; k < 300; k++) for (const id of L.offerPerks({ perks: {} }, k % 5 === 0)) seen.add(id);
    const strays = [...seen].filter((id) => !LEGACY_PERKS.includes(id));
    if (strays.length) fail(`legacy offers powers the parent didn't have: ${strays.join(", ")}`);
    if (seen.size !== 25) fail(`300 legacy offers drew ${seen.size} of the parent's 25 perks`);
    // The run seam takes a made character once, then the quick start again.
    const q1 = m.playerMod.makePlayer(), q2 = m.playerMod.makePlayer();
    if (q1 === q2 || q1.background || JSON.stringify(m.codec.encodePlayer(q1)) !== JSON.stringify(m.codec.encodePlayer(q2))) fail("makePlayer() doesn't make the same fresh quick start twice");
    out.legacy = `level 2: +3 HP, the parent's line and card; 300 offers from ${seen.size} perks`;
  }

  const undo = rules.overrideRules("stats", "attributes");
  try {
    section1(); section2(); section3(); section4(); section5();
  } finally { undo(); }
  section6();
  return { name: NAME, ok: problems.length === 0, problems: problems.slice(0, 60).concat(problems.length > 60 ? [`… and ${problems.length - 60} more`] : []), stats: out };
}

const LEVELS_NAMES = new Set(["Vey", "Orrum", "Cassin"]);

export async function run(env) {
  const { capture } = await env.screen({ cols: 100, rows: 30 });
  const src = (p) => env.src(p);
  const { game, step, draw } = await src("game.js");
  const [genotypes, backgrounds, powers] = await Promise.all([src("content/genotypes.js"), src("content/backgrounds.js"), src("content/powers.js")]);
  return checkProgression({
    game, step, draw, capture,
    rules: await src("rules.js"), stats: await src("stats.js"), chargen: await src("progression/chargen.js"), leveling: await src("leveling.js"),
    levelup: await src("screens/levelup.js"), create: await src("screens/create.js"), keys: await src("keys.js"), screens: await src("screens.js"),
    codec: await src("save/codec.js"), rng: await src("rng.js"), items: await src("items.js"), playerMod: await src("player.js"),
    implants: await src("content/items/implants.js"),
    content: { ...genotypes, ...backgrounds, ...powers },
  });
}
