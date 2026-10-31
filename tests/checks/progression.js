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
//      an attribute point comes every attrPointEvery-th level (3, 6 … 18 since B4, the user's decision of 2026-10-31; it
//      was 4, 8 … 20) and is spent on the card first, one power a level; 3 offers (4 at
//      INT 18+), all different, none still waiting (needs) or maxed, a major first at 5, 10, 15, 20. The same seed
//      makes the same offers; another seed other ones. XP: killXp's table, Pilgrim's kills and quests.
//   4. The wizard (screens/create.js) through the real key and mouse dispatch at 100×30: a Bent and a Plumb by
//      keyboard, a name typed with å, ä and ö; by mouse (rows, [-] [+], [ Suggest ], [ Next ], [ Begin ], a step at
//      the top); refusals (points unspent, no name), Esc back a step. Beginning starts the run with exactly the
//      choices made.
//   5. Names (bible §2.3, §15.11): 10,000 suggestions for each culture, none longer than 9 letters a word, none with a
//      banned word (check-names' list).
//   6. The old game under the legacy set: the quick start's player has no origin; a level gives +3 HP with the
//      parent's line and opens the parent's card ("Choose a gift"); offerPerks draws only the parent's 25. The quick
//      start keeps P0's innate Fold Step on key 1 (4 tiles), and has no mutations.
// Part 4b (section 7, under the attribute set):
//   7.1 The table (bible §10.3, §13.5, §15.6): at least 16 physical and mental mutations, 4 defects refunding 2-3,
//       every one a name, a kind, cost 4 (a defect −2 or −3), a max of 1-10, info at every level, bonus keys the stat
//       bus knows, abilities registered as the mutation's, exclusions both ways, reputation by bible faction ids; the
//       planar ones (◆) and at least two that bridge the views.
//   7.2 Offers: 3, different, at least one planar, none you have, none excluded, no defect; the same seed and body
//       give the same offers (300 seeds), other seeds others; the sheet's offers stand until you buy one; the
//       wizard's are the same for the same seed.
//   7.3 The crease economy: 12 at creation (a defect's refund on top), 4 a mutation, 1 a level, the cap floor(level /
//       2) + 1 and at most the mutation's max; every refusal for its reason (no creases, had, excluded, a defect in
//       play, the Plumb, past the cap); a mental mutation works at its level + EGO's modifier (and Cast adds it up);
//       Spare Heart's TOU and the HP it brings; a made character has no innate ability and its hotbar holds its
//       mutations' abilities in order; bible §10.4's reputation changes, at beginRun and in play, once each.
//   7.4 Every active mutation fires through the real hotbar key in 3D (abilities.js aimTarget) and on the map
//       (requestTarget: WS8's target screen, its tile picked and Enter; the use's mapTime) with its effect (quills, flight, fire and burning, flat with the
//       map forced, sightings on the map, a 9 × 9 drawn onto the map, flat beings marked in both views, a brazier
//       lit, a fold of 4 + level tiles, EGO's level added); from the use to ready again is the same cooldown
//       seconds in both views (the WIL-scaled abilityCooldown).
//   7.5 Cast (bible §10.3): the wake chance's formula (EGO included, 75% at most); a turn of the world (the view
//       changing in one zone) rolls it, seeded; the third wake in a zone warns and sends "smoothers" 10 s later with
//       the pack's size; a flat forced map isn't a turn.
//   7.6 Defects that come and go: Dark-fear shaken (−2 to hit, −1 DV) with the torch out, Moth-kissed with it lit,
//       Lightsick 1 HP every 20 s under the open sky; Crooked Manner −50 with every faction.
//   7.7 B (abilities) and K (the sheet) at 100×30 through the real key and mouse dispatch: B's list with cooldowns,
//       1-9 and a click on a slot assign, 0 and a right click clear, the hint about keys 1-9; K's four tabs by Tab and
//       by clicks, an attribute point spent by Enter and by [+], a mutation raised and an offer bought, by keys and
//       [+1] / [+4]; nothing drawn into the last column, every row's text inside the box.
//   7.8 The wizard's mutation step with real offers: an offer taken by keys and by clicks, a defect taken and given
//       back, a defect refused while its creases are spent, the run begun with exactly those mutations.
import { findHits, DENY } from "./names.js";

const NAME = "progression";

export async function checkProgression(m) {
  const { game, step, draw, rules, stats: st, chargen: C, leveling: L, levelup: LU, create: W, keys, screens, codec, factions: F,
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
    const balanced23 = { str: 23, agi: 16, tou: 16, int: 16, wil: 14, ego: 14 };   // 18 + 3 × 6 + 2 × 4 = 44: only the cap is wrong
    if (C.pointsLeft("bent", balanced23) !== 0) fail(`the balanced 23 spread leaves ${C.pointsLeft("bent", balanced23)} points`);
    const bad = {
      "an unknown genotype": [{ genotype: "pure" }, /no genotype/], "an unknown background": [{ background: "nobody" }, /no background/],
      "another genotype's background": [{ background: "archivistOfVey" }, /is a Plumb background/],
      "a point unspent": [{ attrs: { ...good.attrs, ego: good.attrs.ego - 1 } }, /not spent/],
      "a point too many": [{ attrs: { ...good.attrs, ego: good.attrs.ego + 1 } }, /overspent/],
      "23 in one (every point spent)": [{ attrs: balanced23 }, /STR 23 is outside 10-22/],
      "below the base": [{ attrs: { ...good.attrs, str: 9 } }, /STR 9 is outside/], "a fraction": [{ attrs: { ...good.attrs, str: 17.5 } }, /STR is 17\.5/],
      "no name": [{ name: "  " }, /no name/], "a 25-letter name": [{ name: "Å".repeat(25) }, /longer than 24/], "no mode": [{ mode: "pressed" }, /no run mode/],
      "a newline in the name": [{ name: "Ann\nMari" }, /control character/], "a NUL in the name": [{ name: "Ann\u0000" }, /control character/],
      "a direction mark in the name": [{ name: "Ann\u202e" }, /control character/], "a lone combining mark for a name": [{ name: "\u0301" }, /no letter/],
      "an unknown mutation": [{ mutations: ["featherScales"] }, /no mutation featherScales/],
      "a mutation taken twice": [{ mutations: ["wings", "wings"] }, /taken twice/], "two that can't share a body": [{ mutations: ["shellback", "wings"] }, /can't share a body/],
      "four mutations (16 creases)": [{ mutations: ["wings", "gills", "foldStep", "kindle"] }, /cost 16 creases/], "mutations not a list": [{ mutations: "wings" }, /must be a list/], "an implant for the Bent": [{ implant: "tallyEye" }, /take no implants/],
    };
    let refused = 0;
    for (const [what, [change, why]] of Object.entries(bad)) {
      const c = { ...good, ...change }, got = C.validateChoices(c);
      if (!got.length) { fail(`validateChoices took ${what}`); continue; }
      if (!got.some((x) => why.test(x))) fail(`${what} refused, but not for it: ${got.join("; ")}`);
      let threw = false;
      try { C.makeCharacter(c); } catch { threw = true; }
      if (!threw) fail(`makeCharacter took ${what}`); else refused++;
    }
    // A Plumb with a mutation that exists (a test entry in the table, gone after): refused for the genotype alone.
    m.mutations.MUTATIONS.testCrease = { name: "test crease", cost: 4 };
    try {
      const got = C.validateChoices({ ...choicesFor("forgehandOfOrrum", C.suggestSpread("plumb", "forgehandOfOrrum")), mutations: ["testCrease"] });
      if (got.join() !== "the Plumb take no mutations") fail(`a Plumb with a mutation: ${got.join("; ") || "taken"}`);
    } finally { delete m.mutations.MUTATIONS.testCrease; }
    // The Plumb's free implant (WS5's table, since the integrator's merge of p1-ws5): any implant costing at most 2,
    // its Level's own listed first; every Plumb background's own is in the table and costs at most 2; dearer ones,
    // unknown ids and non-strings are refused for that reason.
    const forge = choicesFor("forgehandOfOrrum", C.suggestSpread("plumb", "forgehandOfOrrum"));
    const IMPL = m.implants.IMPLANTS, max = GENOTYPES.plumb.freeImplantCost;
    const cheapIds = Object.keys(IMPL).filter((id) => C.implantCost(id) <= max), dear = Object.keys(IMPL).find((id) => C.implantCost(id) > max);
    const cheap = cheapIds.find((id) => id !== "knuckles");
    for (const [implant, ok] of [[undefined, true], [null, true], ["knuckles", true], [cheap, true], [dear, false], ["noSuchImplant", false], [42, false], ["", false]]) {
      const got = C.validateChoices({ ...forge, implant });
      if (ok === !!got.length) fail(`validateChoices with implant ${JSON.stringify(implant)}: ${got.join("; ") || "taken"}`);
      if (!ok && !got.some((x) => /free implant/.test(x))) fail(`implant ${JSON.stringify(implant)} refused for the wrong reason: ${got}`);
    }
    for (const id of m.content.backgroundsOf("plumb")) {
      const own = BACKGROUNDS[id].implant, free = C.freeImplants(id);
      if (!IMPL[own] || C.implantCost(own) > max) fail(`${id}'s own implant ${own}: ${IMPL[own] ? `costs ${C.implantCost(own)}` : "not in WS5's table"}`);
      if (free[0] !== own || free.length !== cheapIds.length || !free.every((x) => cheapIds.includes(x))) fail(`freeImplants(${id}) = ${free} (want ${own} first, then the other ${cheapIds.length - 1} costing at most ${max})`);
    }
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
        // (B4: a kit piece the spread can't meet is worn badly: −1 DV, half its armour, none of its bonus; check-combat's req)
        const badly = (it) => !!it && it.kind === "armour" && m.items.shortfall(it, (k) => st.attr(p, k)).length > 0;
        const kitWorn = Object.values(B.kit.equip).filter((it) => it.kind === "armour");
        const wantDv = 6 + Math.floor((st.attr(p, "agi") - 16) / 2) - kitWorn.filter(badly).length;
        if (st.dv(p) !== wantDv) fail(`${what}: DV ${st.dv(p)}, want ${wantDv}`);
        // The Levels (bible §10.10), written out here rather than read from the table under test: Vey +3 to examine,
        // Orrum +1 natural armour, Cassin neither.
        const LEVEL_WANT = { vey: { examine: 3, av: 0 }, orrum: { examine: 0, av: 1 }, cassin: { examine: 0, av: 0 } };
        // (C4) and the kits' worn pieces, written out too: the Archivist's examining kit, +2 (bible §10.10).
        const KIT_WANT = { archivistOfVey: { examine: 2 } };
        const want = { ...(LEVEL_WANT[B.level] || { examine: 0, av: 0 }) };
        want.examine += badly(B.kit.equip.hands) ? 0 : KIT_WANT[bg]?.examine || 0;
        // (The free implant, fitted since the WS9 merge, adds its own: WS5's table, not the one under test.)
        const own = (g === "plumb" && m.implants.IMPLANTS[B.implant]?.bonus) || {};
        const worn = { clothes: 0, leather: 1, chain: 2 }[B.kit.equip.body?.id] ?? 0, armour = badly(B.kit.equip.body) ? Math.floor(worn / 2) : worn, wantAv = armour + want.av + (own.av || 0);
        if (st.av(p) !== wantAv) fail(`${what}: AV ${st.av(p)}, want ${wantAv}`);
        if (st.bonus(p, "examine") !== want.examine + (own.examine || 0)) fail(`${what}: examine +${st.bonus(p, "examine")}, want +${want.examine + (own.examine || 0)}`);
        if ((g === "plumb") !== !!B.level) fail(`${what}: a ${g} with Level ${B.level}`);
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
        // ...and the Plumb starts with that implant fitted (no Truing Cradle at creation: found unfitted at the WS9 merge).
        const inBody = Object.values(p.body.implants || {}).filter(Boolean).map((it) => it.id);
        if (g === "plumb" && (!p.origin.fitted || JSON.stringify(inBody) !== JSON.stringify([B.implant])))
          fail(`${what}: the free implant ${B.implant} fitted ${p.origin.fitted}, in the body ${JSON.stringify(inBody)}`);
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
      // The background's change goes on top of the start by genotype, with Pilgrim's floor (factions.js baseRep,
      // WS6a; P0's stub started every faction at 0).
      for (const [f, n] of Object.entries({ ...(B.rep || {}), ...(B.villageRep ? { bentVillages: B.villageRep } : {}) })) {
        const want = Math.max(F.REP_MIN, Math.min(F.REP_MAX, F.baseRep(game, f) + n));
        if (F.repOf(game, f) !== want) fail(`${bg}: ${f} at ${F.repOf(game, f)}, want ${want} (the start ${F.baseRep(game, f)} and ${n})`);
      }
      // The purse once the run has begun: the world's start purse where it has one (the test world's 1,000, for the
      // parent's prices: game.js startRun), else the background's; the glim is the background's either way.
      const purse = game.world.startPurse || B.purse || 200;
      if (game.player.purse !== purse || game.player.funds !== B.glim) fail(`${bg}: began with ${game.player.funds} glim in a ${game.player.purse} purse, want ${B.glim} in ${purse}`);
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
    const EVERY = m.rules.RULES.progression.level.attrPointEvery;   // (B4: 3)
    for (let level = 2; level <= 20; level++) {
      const fullBefore = p.hp === st.maxHp(p), maxBefore = st.maxHp(p);
      game.messages = [];
      L.gainXp(game, L.xpToNext(p.level) - p.xp, { source: "quest" });
      // What the level gave, in the log and on its card: "+N max HP" (max(1, 3 + TOU mod)), the Bent's crease, the point.
      const hpPer = Math.max(1, 3 + Math.floor((st.attr(p, "tou") - 16) / 2));
      const gains = [`+${hpPer} max HP`, ...(g === "bent" ? ["+1 crease"] : []), ...(level % EVERY === 0 ? ["an attribute point"] : [])];
      const line = `You reach level ${level}${level % 5 === 0 ? " (a milestone!)" : ""}! (${gains.join(", ")})`;
      if (!game.messages.some((x) => x.text === line)) issues.push(`level ${level}: the log says ${JSON.stringify(game.messages.map((x) => x.text))}, want "${line}"`);
      if (p.level !== level || p.pendingLevels !== 1) { issues.push(`level ${p.level}, pending ${p.pendingLevels} (want ${level}, 1)`); break; }
      // The level's HP is yours at once: full before, full after (the HP gain is the max HP gain).
      if (!fullBefore) issues.push(`level ${level}: not at full health before the level (${p.hp}/${maxBefore})`);
      else if (p.hp !== st.maxHp(p) || st.maxHp(p) <= maxBefore) issues.push(`level ${level}: ${p.hp}/${st.maxHp(p)} after the level, ${maxBefore} before`);
      step(1 / 60);
      if (game.mode !== "levelup") { issues.push(`level ${level}: no card (in ${game.mode})`); break; }
      if (level % EVERY === 0) {
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
    const wantPoints = Math.floor(20 / EVERY);   // (B4: 6 by level 20; 5 at every 4th)
    if (pointsGot !== wantPoints || pointsSpent !== wantPoints || p.attrPoints !== 0) issues.push(`attribute points: ${pointsGot} got, ${pointsSpent} spent, ${p.attrPoints} left (want ${wantPoints}, ${wantPoints}, 0)`);
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
    // a level's own point (3 and 6 since B4; 4 and 8 before) comes with its card, and a point kept for later ("Keep it for
    // a later level") is asked about again on the next card.
    {
      const EVERY = m.rules.RULES.progression.level.attrPointEvery;
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
        const cd = LU.levelCard(game), first = POWERS[game.perkChoices[0]], own = cd.level % EVERY === 0 ? 1 : 0;
        seen.push(`${cd.level}${cd.step === "attr" ? `+${p.attrPoints}` : ""}${cd.milestone ? "!" : ""}`);
        if (cd.level !== k + 3) fail(`six levels at once: card ${k + 1} is level ${cd.level}, want ${k + 3}`);
        if (p.attrPoints !== kept + own || (cd.step === "attr") !== (kept + own > 0)) fail(`six levels at once: level ${cd.level}'s card holds ${p.attrPoints} points (want ${kept + own}) on ${cd.step}`);
        if (cd.milestone !== (cd.level === 5) || (cd.level === 5 && !first?.major)) fail(`six levels at once: level ${cd.level} milestone ${cd.milestone}, first offer ${game.perkChoices[0]}`);
        if (cd.step === "attr" && cd.level === EVERY) {   // (the first point: kept)
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
    if (L.xpReward("landmark", 2) !== 15 || L.xpReward("beat", 10) !== 758 || L.xpReward("site", 2) !== 5)   // (site: WS1 #4, at its merge)
      fail(`xpReward: landmark at 2 ${L.xpReward("landmark", 2)}, beat at 10 ${L.xpReward("beat", 10)}, site at 2 ${L.xpReward("site", 2)}`);
    // WS1's powers are offered since its merge (WS1 #3): their effects read them (encounters, travel, lost).
    const waiting = ["keenEyeSites", "pathfinder", "terrainLore", "homingSense"].filter((id) => m.content.POWERS[id]?.needs);
    if (waiting.length) fail(`WS1's powers still wait on their needs: ${waiting}`);
    out.xp = "killXp 7 cases, Pilgrim kills 0 and quests x2.2, rewards";
  }

  // --- 4. The wizard ---------------------------------------------------------------------------------------------
  function section4() {
    const steps = [];
    const at = () => W.wizard().step;
    const expect = (step, what) => { if (at() !== step) fail(`wizard: ${what}: on ${at()}, want ${step}`); else fits(what); };
    // Every step fits the screen (100×30 here): its button and the key help on the bottom rows, and nothing written into
    // the last column (text running into the edge is cut there without a word).
    const fitted = new Set();
    const fits = (what) => {
      frame();
      const step = at(), rows = Array.from({ length: capture.rows }, (_, y) => rowText(y));
      fitted.add(step);
      if (!/\[ (Next|Begin) \]/.test(rows[capture.rows - 2])) fail(`wizard: ${step} (${what}): no [ Next ] on the second row from the bottom`);
      if (!/back/.test(rows[capture.rows - 1])) fail(`wizard: ${step} (${what}): no key help on the bottom row`);
      const edge = rows.findIndex((r) => r[capture.cols - 1] !== " ");
      if (edge >= 0) fail(`wizard: ${step} (${what}): row ${edge} runs to the right edge: "${rows[edge].slice(-30)}"`);
    };
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
      if (g === "bent") {   // Enter takes the first offer (4 creases), End and Enter go on
        press("Enter");
        if (W.wizard().mutations.length !== 1) fail(`wizard: Enter on an offer took ${JSON.stringify(W.wizard().mutations)}`);
        press("End");
      }
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
      if (g === "bent" && (Object.keys(p.mutations).length !== 1 || p.creases !== 8)) fail(`wizard: the Bent began with ${JSON.stringify(p.mutations)} and ${p.creases} creases`);
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
      // Back to the backgrounds for a Lamplighter of Cassin: the untouched suggestion goes with the old background, and the
      // name step suggests a Cassin name; a typed name would stay (below).
      for (let k = 0; k < 3; k++) click("[ Back ]");
      expect("background", "[ Back ] three times");
      click("Lamplighter of Cassin"); click("Lamplighter of Cassin");
      for (let k = 0; k < 2; k++) click("[ Next ]");
      expect("name", "on to the name again (attributes, implant)");
      if (!/-Cassin$/.test(W.wizard().name)) fail(`wizard: after a new background the name is "${W.wizard().name}", want a Cassin name`);
      typeText("Ylva");
      for (let k = 0; k < 3; k++) click("[ Back ]");
      click("Forgehand of Orrum"); click("Forgehand of Orrum");
      for (let k = 0; k < 2; k++) click("[ Next ]");
      if (W.wizard().name !== "Ylva") fail(`wizard: a typed name became "${W.wizard().name}" after a new background`);
      click("[ Suggest ]");
      const again = W.wizard().name;
      if (!/-Orrum$/.test(again)) fail(`wizard: [ Suggest ] for a Forgehand gave "${again}"`);
      const suggested2 = again;
      click("[ Next ]"); expect("mode", "[ Next ] on the name");
      click("Commons Lamp"); click("Commons Lamp"); expect("begin", "two clicks on Commons Lamp");
      click("Attributes", { row: "Genotype" }); expect("attributes", "a click on the step at the top");
      click("[ Next ]"); click("[ Next ]"); click("[ Next ]"); click("[ Next ]"); expect("begin", "four clicks on [ Next ]");
      click("[ Begin ]");
      const p = game.player;
      if (p.background !== "forgehandOfOrrum" || p.name !== suggested2 || game.state.mode !== "commonsLamp" || p.attrs.tou !== C.suggestSpread("plumb", "forgehandOfOrrum").tou)   // (a new background resets the spread)
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
      for (let k = 0; k < 8 && at() !== "begin"; k++) { if (at() === "track") press("End"); press("Enter"); }
      for (let k = 0; k < 8 && at() !== "genotype"; k++) press("Escape");
      press("ArrowDown");
      let threw = null;
      try { click("Begin", { row: "Genotype" }); frame(); } catch (err) { threw = err.message; }
      if (threw || at() !== "background" || W.wizard().genotype !== "plumb") fail(`wizard: a jump to Begin after changing the genotype: ${threw || `on ${at()}, ${W.wizard().genotype}`}`);
    }
    if (fitted.size !== 7) fail(`wizard: only ${[...fitted]} checked against the screen's size`);
    out.wizard = `${steps.join(", ")} at ${capture.cols}×${capture.rows}; ${fitted.size} steps fit`;
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
    // Every word the parts can make (onset, maybe a middle, a final), and every family: none holds a banned term, as a
    // word or inside one (the generator itself rejects nothing, so its tables must be clean).
    const words = [];
    for (const c of Object.values(C.NAME_PARTS.cultures))
      for (const o of c.onsets) for (const mid of ["", ...c.middles]) for (const f of c.finals) words.push(o + mid + f);
    words.push(...C.NAME_PARTS.families);
    const lower = words.map((w) => w.toLowerCase());
    const terms = DENY.flatMap((d) => (d.qualifier === "mode" ? [] : [d.term.toLowerCase().replace(/[^a-z]/g, "")])).filter((t) => t.length >= 3);
    const inside = lower.flatMap((w) => terms.filter((t) => w.includes(t)).map((t) => `${t} in ${w}`));
    if (inside.length) fail(`name parts make banned words: ${inside.slice(0, 5).join("; ")}`);
    const asWords = findHits([{ file: "name parts", text: words.join("\n") }]).hits;
    if (asWords.length) fail(`name parts make banned words: ${asWords.slice(0, 5).map((h) => h.term).join("; ")}`);
    out.names = `${names.length} suggested, ${new Set(names).size} different, 0 banned; all ${words.length} words the parts make clean`;
  }

  // --- 6. The old game ---------------------------------------------------------------------------------------------
  function section6() {
    if (rules.RULES.stats !== "legacy") { fail("section 6 runs without the legacy set"); return; }
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
    if (!game.messages.some((x) => /^You gain a perk: /.test(x.text))) fail(`legacy: taking it said ${game.messages.slice(-1).map((x) => x.text)}`);   // the parent's word
    const seen = new Set();
    for (let k = 0; k < 300; k++) for (const id of L.offerPerks({ perks: {} }, k % 5 === 0)) seen.add(id);
    const strays = [...seen].filter((id) => !LEGACY_PERKS.includes(id));
    if (strays.length) fail(`legacy offers powers the parent didn't have: ${strays.join(", ")}`);
    if (seen.size !== 25) fail(`300 legacy offers drew ${seen.size} of the parent's 25 perks`);
    // The run seam takes a made character once, then the quick start again.
    if (JSON.stringify(p.innate) !== '["foldStep"]' || JSON.stringify(p.hotbar) !== '["foldStep"]' || p.mutations || m.abilities.abilityRange(p, "foldStep", 1) !== 4)
      fail(`the quick start's abilities: innate ${JSON.stringify(p.innate)}, hotbar ${JSON.stringify(p.hotbar)}, mutations ${JSON.stringify(p.mutations)}`);
    const q1 = m.playerMod.makePlayer(), q2 = m.playerMod.makePlayer();
    if (q1 === q2 || q1.background || JSON.stringify(m.codec.encodePlayer(q1)) !== JSON.stringify(m.codec.encodePlayer(q2))) fail("makePlayer() doesn't make the same fresh quick start twice");
    out.legacy = `level 2: +3 HP, the parent's line and card; 300 offers from ${seen.size} perks`;
  }

  // --- 7. Part 4b: mutations, abilities, the B and K screens -------------------------------------------------------
  function section7() {
    const MU = m.mutations.MUTATIONS, PM = m.pmut, A = m.abilities, T = m.turns, CR = m.creatures, WD = m.world, STS = m.status;
    const ids = Object.keys(MU), byKind = (k) => ids.filter((id) => MU[id].kind === k);
    // 7.1 The table.
    {
      const phys = byKind("physical"), ment = byKind("mental"), defects = byKind("defect");
      if (phys.length + ment.length < 16) fail(`mutations: ${phys.length} physical and ${ment.length} mental, want 16 or more`);
      if (defects.length < 4) fail(`mutations: ${defects.length} defects, want 4`);
      const bridges = ids.filter((id) => MU[id].planar && MU[id].bridge);
      if (bridges.length < 2) fail(`mutations: ${bridges.length} planar ones bridge the views, want 2 or more`);
      for (const id of ids) {
        const d = MU[id], at = `mutation ${id}`;
        if (!d.name || !["physical", "mental", "defect"].includes(d.kind)) fail(`${at}: name ${d.name}, kind ${d.kind}`);
        if (d.kind === "defect" ? ![-2, -3].includes(d.cost) : d.cost !== 4) fail(`${at}: cost ${d.cost}`);
        if (!Number.isInteger(d.max) || d.max < 1 || d.max > 10) fail(`${at}: max ${d.max}`);
        for (let l = 1; l <= 10; l++) if (typeof d.info(l) !== "string" || !d.info(l) || /undefined|NaN/.test(d.info(l))) fail(`${at}: info(${l}) = ${d.info(l)}`);
        for (let l = 1; l <= d.max; l++) for (const k of Object.keys(d.bonus?.(l, { body: { equip: {} } }) || {})) if (!st.BONUS_KEYS.includes(k)) fail(`${at}: bonus key ${k}`);
        if (d.ability && (A.ABILITIES[d.ability]?.source !== "mutation")) fail(`${at}: its ability ${d.ability} isn't a registered mutation ability`);
        // (the other may still wait: B1 made Beat-deaf live, Foresight waits)
        for (const x of d.excludes || []) { const o = MU[x] || m.mutations.MUTATIONS_WAITING?.[x]; if (!o || !o.excludes?.includes(id)) fail(`${at}: excludes ${x}, which doesn't exclude it back`); }
        for (const f of Object.keys(d.rep || {})) if (!m.mutations.BIBLE_FACTIONS.includes(f)) fail(`${at}: reputation with ${f}, no faction of bible §15.4`);
        if (d.kind === "defect" && (d.ability || d.planar)) fail(`${at}: a defect with an ability or planar`);
      }
      // Bible §10.4's table, as the bible gives it.
      const want = { wings: { kites: 400 }, shellback: { clatter: 200 }, lampskin: { moths: 200, lampless: -200 }, flatwise: { flatfolk: 200, pressed: 100, assize: -200 }, gills: { clatter: 100 } };
      for (const [id, rep] of Object.entries(want)) if (JSON.stringify(MU[id]?.rep) !== JSON.stringify(rep)) fail(`mutation ${id}: reputation ${JSON.stringify(MU[id]?.rep)}, the bible's ${JSON.stringify(rep)}`);
      out.mutations = `${phys.length} physical, ${ment.length} mental, ${defects.length} defects; ${ids.filter((id) => MU[id].planar).length} planar, ${bridges.length} bridge the views (${bridges.join(", ")})`;
    }

    // A Bent begun on legacy level 3 of seed 7's test world (as check-abilities' fresh()), with these mutations.
    function bentIn(muts, { view = "map", ego = 16, wil = 16, seed = 7, depth = 3 } = {}) {
      const attrs = C.suggestSpread("bent", "reedcutter");
      C.beginRun(game, choicesFor("reedcutter", attrs, { name: "Ilse" }), { seed });
      game.pages = null; game.pendingPages = null; game.story.cube = true; game.modeStack = [];
      const s = game.run.world.start;
      game.debug.enterZone(`${s.wx},${s.wy},${depth}`, "down");
      game.view = view; game.mode = view === "map" ? "map" : "explore"; game.paused = false;
      game.zone.creatures = game.zone.creatures.filter((c) => c.talk);
      game.zone.spikes = new Map();
      const p = game.player;
      p.attrs.ego = ego; p.attrs.wil = wil; p.maxHpGain = 999; st.invalidateStats(p); p.hp = st.maxHp(p);
      p.creases = 99;
      for (const id of muts) PM.gainMutation(game, p, id);
      game.messages = [];
      return p;
    }
    const runEast = (zone, n) => {
      const { w, d, stand } = zone;
      for (let y = 2; y < d - 2; y++)
        for (let x = 2; x < w - n - 2; x++) {
          let ok = true;
          for (let k = 0; k <= n && ok; k++) {
            const i = x + k + y * w, g = zone.get(x + k, y, WD.FLOOR_Z - 1);
            if (stand[i] !== stand[x + y * w] || stand[i] < 0 || g === WD.B.STAIRS || g === WD.B.STAIRS_UP) ok = false;
            for (const dz of [0, 1, 2]) if (zone.solid(x + k, y, stand[x + y * w] + dz)) ok = false;
            for (const dy of [-1, 1]) if (stand[x + k + (y + dy) * w] < 0) ok = false;   // floor on both sides too (the cone, quills)
          }
          if (ok) return { x, y, z: stand[x + y * w] };
        }
      return null;
    };
    const place = (p, at, yaw = 0) => Object.assign(p, { x: at.x + 0.5, y: at.y + 0.5, z: at.z, vz: 0, yaw, pitch: 0, onGround: true });
    const rat = (x, y, z, extra = {}) => Object.assign(CR.addCreature(game.zone, CR.spawnCreature("rat", x, y, z, { rng: () => 0.5, state: "idle" })), extra);
    const said = (re) => game.messages.some((x) => re.test(x.text));
    const keyFor = (p, ability) => { const k = (p.hotbar || []).indexOf(ability); return k >= 0 ? `Digit${k + 1}` : null; };

    // 7.2 Offers.
    {
      const body = { genotype: "bent", level: 1, mutations: {} };
      let same = 0, differ = 0, planar = 0, bad = [];
      const sets = new Set();
      for (let seed = 1; seed <= 300; seed++) {
        const a = PM.mutationOffers(null, body, R.makeRng(R.seedFor(seed, "check", 0)));
        const b = PM.mutationOffers(null, body, R.makeRng(R.seedFor(seed, "check", 0)));
        if (JSON.stringify(a) === JSON.stringify(b)) same++;
        sets.add([...a].sort().join());
        if (a.length !== 3 || new Set(a).size !== 3) bad.push(`seed ${seed}: ${a}`);
        if (a.some((id) => MU[id].planar)) planar++;
        if (a.some((id) => MU[id].kind === "defect")) bad.push(`seed ${seed}: a defect offered`);
      }
      if (same !== 300) fail(`offers: ${300 - same} of 300 seeds gave other offers the second time`);
      if (planar !== 300) fail(`offers: ${300 - planar} of 300 offers had no planar mutation`);
      if (sets.size < 150) fail(`offers: 300 seeds gave only ${sets.size} different sets`);
      if (bad.length) fail(`offers: ${bad.slice(0, 3).join("; ")}`);
      // With mutations had: none of them, nothing excluded; planar still there while any is left.
      const had = { genotype: "bent", level: 1, mutations: { shellback: 1, foldStep: 1, overlook: 1 } };
      for (let seed = 1; seed <= 100; seed++) {
        const a = PM.mutationOffers(null, had, R.makeRng(seed));
        if (a.some((id) => had.mutations[id] || id === "wings")) fail(`offers with ${Object.keys(had.mutations)}: ${a} (one had, or Wings, which Shellback excludes)`);
        if (!a.some((id) => MU[id].planar)) fail(`offers with three had: no planar one (${a})`);
      }
      // The sheet's offers (offerRng): the same until one is bought, then others.
      const p = bentIn([]);
      const o1 = PM.mutationOffers(game, p), o2 = PM.mutationOffers(game, p);
      if (JSON.stringify(o1) !== JSON.stringify(o2)) fail(`the sheet's offers changed with nothing bought: ${o1} / ${o2}`);
      PM.gainMutation(game, p, o1[0]);
      const o3 = PM.mutationOffers(game, p);
      if (o3.includes(o1[0]) || JSON.stringify(o3) === JSON.stringify(o1)) fail(`the sheet's offers after buying ${o1[0]}: ${o3}`);
      out.offers = `300 seeds: the same offers twice, a planar one in each, ${sets.size} different sets; the sheet's stand until one is bought`;
    }

    // 7.3 The crease economy.
    {
      const attrs = C.suggestSpread("bent", "reedcutter");
      const mk = (muts) => C.makeCharacter(choicesFor("reedcutter", attrs, { mutations: muts }));
      let p = mk([]);
      if (p.creases !== 12 || JSON.stringify(p.mutations) !== "{}" || JSON.stringify(p.innate) !== "[]" || JSON.stringify(p.hotbar) !== "[]" || A.abilitiesOf(p).length)
        fail(`a Bent with no mutations: ${p.creases} creases, ${JSON.stringify(p.mutations)}, innate ${JSON.stringify(p.innate)}, hotbar ${JSON.stringify(p.hotbar)}, ${A.abilitiesOf(p).length} abilities`);
      p = mk(["foldStep", "wings", "spareHeart"]);
      if (p.creases !== 0 || JSON.stringify(p.hotbar) !== '["foldStep","wingsUp"]') fail(`three mutations: ${p.creases} creases, hotbar ${JSON.stringify(p.hotbar)}`);
      if (A.abilitiesOf(p).map((a) => `${a.id}:${a.source}`).join() !== "foldStep:mutations,wingsUp:mutations") fail(`three mutations' abilities: ${JSON.stringify(A.abilitiesOf(p))}`);
      if (st.attr(p, "tou") !== attrs.tou + 2 + 2 || p.hp !== st.maxHp(p) || st.maxHp(p) !== attrs.tou + 4 + 4) fail(`Spare Heart: TOU ${st.attr(p, "tou")}, HP ${p.hp} of ${st.maxHp(p)} (bought TOU ${attrs.tou}, +2 Reedcutter, +2 the heart)`);
      p = mk(["darkFear", "lightsick", "wings", "gills", "foldStep", "kindle"]);   // 12 + 3 + 2 = 17 creases, 16 spent
      if (p.creases !== 1 || Object.keys(p.mutations).length !== 6) fail(`two defects and four mutations: ${p.creases} creases left, ${Object.keys(p.mutations)}`);
      if (C.validateChoices(choicesFor("reedcutter", attrs, { mutations: ["wings", "gills", "foldStep", "kindle", "lightsick"] })).length !== 1) fail("four mutations and a −2 defect (14 creases) weren't refused");
      // Raising: the cap is floor(level / 2) + 1, at most the mutation's max and 10.
      p = mk(["foldStep", "gills"]);
      p.creases = 50;
      const cap = (lvl) => { p.level = lvl; return PM.levelCap(p, "foldStep"); };
      if ([1, 2, 3, 5, 18, 19, 30].map(cap).join() !== "1,2,2,3,10,10,10") fail(`the cap at levels 1, 2, 3, 5, 18, 19, 30: ${[1, 2, 3, 5, 18, 19, 30].map(cap)}`);
      p.level = 1;
      if (!/until you're level 2/.test(PM.canRaise(p, "foldStep") || "")) fail(`raising at level 1: ${PM.canRaise(p, "foldStep")}`);
      p.level = 5;
      PM.raiseMutation(null, p, "foldStep"); PM.raiseMutation(null, p, "foldStep");
      if (p.mutations.foldStep !== 3 || p.creases !== 48) fail(`two raises at level 5: level ${p.mutations.foldStep}, ${p.creases} creases`);
      if (!/until you're level 6/.test(PM.canRaise(p, "foldStep") || "")) fail(`a fourth level at level 5: ${PM.canRaise(p, "foldStep")}`);
      if (!/as strong as it gets/.test(PM.canRaise(p, "gills") || "")) fail(`raising Gills (max 1): ${PM.canRaise(p, "gills")}`);
      p.creases = 0; p.level = 9;
      if (!/costs 1 crease/.test(PM.canRaise(p, "foldStep") || "")) fail(`raising with no creases: ${PM.canRaise(p, "foldStep")}`);
      let threw = false;
      try { PM.raiseMutation(null, p, "foldStep"); } catch (err) { threw = /^raiseMutation: /.test(err.message); }
      if (!threw || p.mutations.foldStep !== 3) fail("raiseMutation with no creases didn't throw (or raised)");
      // Gaining in play: every refusal for its reason.
      const q = bentIn(["shellback"]);
      q.creases = 3;
      const refusals = { wings: /can't share a body/, shellback: /already/, lightsick: /from the start/, nope: /no mutation/, gills: /needs 4 creases/ };
      for (const [id, re] of Object.entries(refusals)) if (!re.test(PM.canGain(game, q, id) || "")) fail(`canGain ${id}: ${PM.canGain(game, q, id)}`);
      const plumb = C.makeCharacter(choicesFor("forgehandOfOrrum", C.suggestSpread("plumb", "forgehandOfOrrum")));
      plumb.creases = 9;
      if (!/take no mutations/.test(PM.canGain(null, plumb, "gills") || "")) fail(`a Plumb gaining Gills: ${PM.canGain(null, plumb, "gills")}`);
      // A mental mutation works at its level + EGO's modifier (at least 1); a physical one at its level.
      const r = bentIn(["foldStep", "overlook", "regeneration"], { ego: 20 });   // EGO mod +2
      if (PM.mutationLevel(r, "foldStep") !== 3 || PM.mutationLevel(r, "regeneration") !== 1 || PM.castOf(r) !== 6) fail(`EGO 20: Fold Step at ${PM.mutationLevel(r, "foldStep")}, Regeneration ${PM.mutationLevel(r, "regeneration")}, Cast ${PM.castOf(r)}`);
      if (A.abilityOf(r, "foldStep").lvl !== 3 || A.abilityRange(r, "foldStep", 3) !== 7) fail(`EGO 20: Fold Step's ability at ${A.abilityOf(r, "foldStep").lvl}, range ${A.abilityRange(r, "foldStep", 3)}`);
      r.attrs.ego = 10; st.invalidateStats(r);   // mod −3
      if (PM.mutationLevel(r, "foldStep") !== 1 || PM.castOf(r) !== 2) fail(`EGO 10: Fold Step at ${PM.mutationLevel(r, "foldStep")}, Cast ${PM.castOf(r)}`);
      if (st.bonus(r, "regen") !== 1.2) fail(`Regeneration 1: regen ${st.bonus(r, "regen")}`);
      // Shellback works without body armour (clothes are none).
      const sh = bentIn(["shellback"]);
      const avBare = st.av(sh);
      sh.body.equip.body = { kind: "armour", id: "plate", ench: 0, known: true };
      Object.assign(sh.attrs, { str: 26, tou: 20 }); st.invalidateStats(sh);   // (B4: plate's requirements met, or it counts half)
      const avPlate = st.av(sh);
      if (avPlate !== m.items.ARMOURS.plate.armour) fail(`Shellback under plate: AV ${avPlate}, want the plate's ${m.items.ARMOURS.plate.armour} alone`);
      out.shellback = `AV ${avBare} bare, ${avPlate} in plate`;
      // ... and refuses body armour (B1, WS4 #19): the pack's E says why; clothes go on; without it plate goes on.
      sh.body.equip.body = null; st.invalidateStats(sh);
      const plate = { kind: "armour", id: "plate", ench: 0, known: true }, clothes = { kind: "armour", id: "clothes", ench: 0, known: true };
      const refused = m.body.canEquip(game, sh, plate, "body"), wore = m.body.canEquip(game, sh, clothes, "body"), helm = m.body.canEquip(game, sh, { kind: "armour", id: "ironHelm", ench: 0, known: true });
      sh.inv.push(plate);
      const logged0 = game.messages.length, byE = m.inventory.equip(game, plate, sh.inv.indexOf(plate), "body");
      const line = game.messages.slice(logged0).map((x) => x.text).join(" ");
      const plain = { ...sh, mutations: {}, body: m.body.makeBody("humanoid") };
      if (refused.reason !== "shell" || !wore.ok || !helm.ok || byE || !/shell/.test(line) || sh.body.equip.body || !m.body.canEquip(game, plain, plate, "body").ok)
        fail(`Shellback and body armour: plate ${JSON.stringify(refused)}, clothes ${wore.ok}, a helm ${helm.ok}; by E ${byE} ("${line}"); without the shell ${m.body.canEquip(game, plain, plate, "body").ok}`);
      sh.inv.splice(sh.inv.indexOf(plate), 1);
      // Reputation (bible §10.4): begun with Wings and Flatwise, once each; Wings gained in play. Each moves rep from
      // where the run began: the start by genotype (factions.js baseRep, WS6a) and the background's change.
      const rep = (f) => m.factions.repOf(game, f);
      C.beginRun(game, choicesFor("reedcutter", attrs, { mutations: ["wings", "flatwise"] }), { seed: 3 });
      const begun = (f) => rep(f) - m.factions.baseRep(game, f) - (BACKGROUNDS.reedcutter.rep[f] || 0);
      if (begun("kites") !== 400 || begun("flatfolk") !== 200 || begun("pressed") !== 100 || begun("assize") !== -200 || begun("clatter") !== 0) fail(`begun with Wings and Flatwise, beyond the start and the Reedcutter's: kites ${begun("kites")}, flatfolk ${begun("flatfolk")}, pressed ${begun("pressed")}, assize ${begun("assize")}, clatter ${begun("clatter")}`);
      const g = bentIn([]), clatter0 = rep("clatter");
      PM.gainMutation(game, g, "gills");
      if (rep("clatter") !== clatter0 + 100) fail(`Gills gained in play: clatter ${clatter0} → ${rep("clatter")}, want +100`);
      if (g.hotbar.includes("gills")) fail("a mutation without an ability went on the hotbar");
      // Every hotbar key taken: the new ability goes on none, and the log and the sheet say B puts it on one.
      {
        const f = bentIn(["foldStep"], { view: "map" });
        f.hotbar = ["foldStep", ...Array(8).fill("foldStep").map((x, i) => `test${i}`)];
        PM.gainMutation(game, f, "wings");
        if (f.hotbar.includes("wingsUp") || f.hotbar.length !== 9 || !said(/Every hotbar key holds something: B puts it on one/)) fail(`Wings with a full hotbar: ${JSON.stringify(f.hotbar)}, said ${game.messages.slice(-1).map((x) => x.text)}`);
      }
      // The level-up card tells the Bent the creases there are to spend, and where.
      const lv = bentIn([], { view: "map" });
      lv.creases = 3;
      L.gainXp(game, 20, { source: "quest" });
      step(1 / 60);
      frame();
      const card = Array.from({ length: capture.rows }, (_, y) => rowText(y)).join("\n");
      if (game.mode !== "levelup" || !card.includes("4 creases to spend: K, the sheet")) fail(`the level-up card doesn't tell the Bent of the 4 creases (in ${game.mode})`);
      for (let k = 0; k < 4 && game.mode === "levelup"; k++) press("Digit1");
      out.economy = "12 creases, 4 a mutation, 1 a level, the cap 1/2/3/10 at levels 1/3/5/18, refusals, EGO's levels, reputation, the card's creases";
    }

    // 7.4 Every active mutation in both views, through the real hotbar key.
    {
      const fired = {}, parity = {};
      const cases = {
        fling: { muts: ["thistlehide"], set: (p, at) => ({ r: rat(at.x + 1, at.y, at.z) }), ok: (p, s) => s.r.hp < s.hp0 || !game.zone.creatures.includes(s.r) },
        wingsUp: { muts: ["wings"], ok: (p) => STS.statusLeft(p, "flying") > 24 },
        // (a sturdy rat, so it lives to burn; its burning holds no copy of you, since a zone saves its creatures' statuses)
        bellows: { muts: ["bellowsThroat"], set: (p, at) => ({ r: rat(at.x + 2, at.y, at.z, { hp: 99, maxHp: 99 }) }),
                   ok: (p, s) => s.r.hp < s.hp0 && STS.hasStatus(s.r, "burning") && JSON.stringify(s.r.status.burning).length < 80 && s.r.status.burning.src === "player" },
        flatwise: { muts: ["flatwise"], ok: (p) => STS.statusFlag(p, "flat") && game.mode === "map" },
        echo: { muts: ["echoThroat"], set: (p, at) => { p.torch = false; return { r: rat(at.x + 6, at.y, at.z) }; },
                ok: (p, s) => game.zone.sightings.get(s.r.id)?.time === game.time },
        overlook: { muts: ["overlook"], set: () => { game.zone.seen.fill(0); return {}; }, ok: (p, s, at) => { let n = 0; for (let y = 0; y < game.zone.d; y++) for (let x = 0; x < game.zone.w; x++) if (game.zone.seen[x + y * game.zone.w] && Math.hypot(x - at.x, y - at.y) > 4) n++; return n >= 20; } },
        // (a flat rat 5 tiles off and a ghostly one at the far side of the floor: both marked, as the bible gives no reach)
        // (held still: a mark shows where it was; the far one on the standable tile farthest from you, since a ghost in your
        // light burns away, P0's rule)
        shadowsense: { muts: ["shadowsense"], set: (p, at) => {
                         const z = game.zone;
                         let far = null, fd = 0;
                         for (let y = 1; y < z.d - 1; y++) for (let x = 1; x < z.w - 1; x++) {
                           const d = Math.hypot(x - at.x, y - at.y);
                           if (z.stand[x + y * z.w] >= 0 && d > fd && !CR.creatureAt(z, x, y)) { fd = d; far = { x, y, z: z.stand[x + y * z.w] }; }
                         }
                         return { r: rat(at.x + 5, at.y, at.z, { vis: { flat: true }, speedMul: 0 }), g: rat(far.x, far.y, far.z, { vis: { flat: true }, speedMul: 0 }), fd };
                       },
                       after: () => { for (let k = 0; k < 40; k++) game.mode === "map" ? T.mapWait(game) : game.debug.step(1 / 60); },
                       ok: (p, s) => s.fd > 20 && [s.r, s.g].every((c) => game.zone.sightings.has(c.id) && game.effects.some((e) => e.kind === "damage" && e.text === c.glyph && Math.hypot(e.x - c.x, e.y - c.y) < 1.5)) },
        kindle: { muts: ["kindle"], set: (p, at) => {
                    const bx = at.x + 3, by = at.y;
                    game.zone.set(bx, by, WD.FLOOR_Z, WD.B.BRAZIER); game.zone.refresh();
                    const ex = p.x, ey = p.y, ez = p.z + 1.45, dx = bx + 0.5 - ex, dy = by + 0.5 - ey, dz = WD.FLOOR_Z + 0.5 - ez;
                    p.yaw = Math.atan2(dy, dx); p.pitch = Math.atan2(dz, Math.hypot(dx, dy));
                    game.zone.seen[bx + by * game.zone.w] = 1;
                    return { bx, by };
                  }, ok: (p, s) => game.zone.get(s.bx, s.by, WD.FLOOR_Z) === WD.B.BRAZIER_LIT },
        foldStep: { muts: ["foldStep"], ok: (p, s, at) => Math.floor(p.x) === at.x + 5 && Math.floor(p.y) === at.y },
        // (B1, C4 #8: a hostile rat 3 tiles off is lagged 6 s; one 6 tiles off isn't)
        timeLag: { muts: ["timeLag"], set: (p, at) => ({ r: rat(at.x + 3, at.y, at.z, { state: "chase" }), far: rat(at.x + 6, at.y, at.z, { state: "chase" }) }),
                   ok: (p, s) => STS.hasStatus(s.r, "lagged") && Math.abs(STS.statusLeft(s.r, "lagged") - 6) < 0.6 && !STS.hasStatus(s.far, "lagged") },
      };
      // On the map an aimed ability opens WS8's target screen (since the WS4b merge): the tile each case means, east
      // of you (Bellows: what the screen starts on, the rat).
      const mapPick = { overlook: 5, kindle: 3, foldStep: 5 };
      const actives = ids.filter((id) => MU[id].ability).map((id) => MU[id].ability);
      for (const ab of actives) if (!cases[ab]) fail(`no case for the active mutation ability ${ab}`);
      for (const [ab, c] of Object.entries(cases)) {
        for (const view of ["3d", "map"]) {
          const p = bentIn(c.muts, { view });
          const at = runEast(game.zone, 9);
          if (!at) { fail(`${ab}: no open run on legacy level 3`); continue; }
          place(p, at, view === "map" && ab !== "overlook" && ab !== "foldStep" ? Math.PI : 0);   // on the map the target decides, not the facing
          const s = c.set?.(p, at) || {};
          s.hp0 = s.r?.hp;
          if (view === "map") T.refreshView(game);
          const code = keyFor(p, ab);
          if (!code) { fail(`${ab}: not on the hotbar (${JSON.stringify(p.hotbar)})`); continue; }
          const t0 = game.time, lvl = A.abilityOf(p, ab)?.lvl, cd = A.abilityCooldown(p, ab, lvl);
          press(code, code.slice(-1));
          if (game.mode === "target") { for (let k = 0; k < (mapPick[ab] || 0); k++) press("ArrowRight"); press("Enter", "Enter"); }
          c.after?.();
          if (!c.ok(p, s, at)) fail(`${ab} in ${view}: didn't work (${game.messages.slice(-2).map((x) => x.text).join(" / ")})`);
          else fired[ab] = (fired[ab] || 0) + 1;
          const used = view === "map" ? A.ABILITIES[ab].mapTime : 0;
          if (!c.after && Math.abs(A.cooldownLeft(p, ab) - (cd - used)) > 1e-9) fail(`${ab} in ${view}: cooldown ${A.cooldownLeft(p, ab)} after the use, want ${cd - used}`);
          if (view === "map" && !c.after && Math.abs(game.time - t0 - used) > 1e-9) fail(`${ab} on the map: the use took ${game.time - t0} s, want ${used}`);
          // From the use to ready: the same seconds in both views.
          let n = 0;
          while (A.cooldownLeft(p, ab) > 0 && n++ < 20000) { if (game.mode === "map") T.mapWait(game); else game.debug.step(1 / 60); }
          const took = game.time - t0, slack = view === "map" || game.mode === "map" ? 0.5 + 1e-9 : 1 / 60 + 1e-9;
          if (Math.abs(took - cd) > slack) fail(`${ab} in ${view}: ready again after ${took.toFixed(3)} s, want ${cd}`);
          (parity[ab] ||= {})[view] = +took.toFixed(3);
          // Pressed again while it cools: refused, told.
        }
      }
      // EGO adds to a mental mutation's reach: Fold Step at EGO 18 (mod +1) is level 2, 6 tiles.
      {
        const p = bentIn(["foldStep"], { view: "3d", ego: 18 }), at = runEast(game.zone, 9);
        place(p, at, 0);
        press(keyFor(p, "foldStep"), "1");
        if (Math.floor(p.x) !== at.x + 6) fail(`Fold Step at EGO 18: landed ${Math.floor(p.x) - at.x} tiles on, want 6`);
      }
      // WS8's target screen (swapped in at the merge) answers on the map with a picked tile and no creature: the
      // abilities that aim go there, not the way you face.
      {
        const p = bentIn(["overlook", "foldStep", "kindle"], { view: "map" }), at = runEast(game.zone, 9), zone = game.zone;
        place(p, at, Math.PI);
        zone.seen.fill(0);
        const tile = { x: at.x + 8, y: at.y }, picked = (t) => ({ creature: null, tile: t, point: { x: t.x + 0.5, y: t.y + 0.5, z: at.z }, dir: [1, 0, 0] });
        rat(tile.x, tile.y, at.z, { speedMul: 0 });
        A.activate(game, p, "overlook", picked(tile));
        if (!said(/: something stands there\.$/)) fail(`Overlook over one rat said: ${game.messages.slice(-1).map((x) => x.text)}`);
        if (!zone.seen[tile.x + tile.y * zone.w] || zone.seen[at.x - 6 + at.y * zone.w]) fail("Overlook on a picked tile: the 9 × 9 isn't around it");
        const own = A.activate(game, p, "foldStep", picked({ x: at.x, y: at.y }));
        if (own || Math.floor(p.x) !== at.x || A.cooldownLeft(p, "foldStep") > 0) fail(`Fold Step onto your own tile: ${own ? "used" : "refused"}, at ${Math.floor(p.x) - at.x} east, cooldown ${A.cooldownLeft(p, "foldStep")}`);
        A.activate(game, p, "foldStep", picked({ x: at.x + 3, y: at.y }));
        if (Math.floor(p.x) !== at.x + 3 || Math.floor(p.y) !== at.y) fail(`Fold Step onto a picked tile 3 east: at (${Math.floor(p.x) - at.x}, ${Math.floor(p.y) - at.y}) from the start`);
        zone.set(at.x + 7, at.y, WD.FLOOR_Z, WD.B.BRAZIER); zone.set(at.x + 5, at.y + 1, WD.FLOOR_Z, WD.B.BRAZIER); zone.refresh();
        zone.seen.fill(1);
        A.activate(game, p, "kindle", picked({ x: at.x + 7, y: at.y }));
        if (zone.get(at.x + 7, at.y, WD.FLOOR_Z) !== WD.B.BRAZIER_LIT || zone.get(at.x + 5, at.y + 1, WD.FLOOR_Z) !== WD.B.BRAZIER) fail("Kindle on a picked tile lit the wrong brazier (or none)");
      }
      // Refused while cooling, in either view: told, nothing moves.
      {
        const p = bentIn(["wings"], { view: "map" });
        A.startCooldown(p, "wingsUp", 30);
        const t0 = game.time;
        press(keyFor(p, "wingsUp"), "1");
        if (STS.hasStatus(p, "flying") || game.time !== t0 || !said(/isn't ready yet/)) fail("Wings while cooling down wasn't refused");
      }
      out.abilities = `${Object.keys(fired).length} abilities fired in both views (${Object.entries(fired).filter(([, n]) => n === 2).length} in each); ready again after ${JSON.stringify(parity)}`;
    }

    // 7.9 The numbers, written out (verification: 24 of 62 mutants of 4b's code survived sections 7.1-7.8, which held
    // each ability to its own def and fired it at level 1 well inside its reach). Combat rolls are fixed here.
    {
      const pins = [];
      const pin = (what, got, want) => { pins.push(what); if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };
      // The defs: cooldown seconds (WIL 16: × 1) at levels 1, 5 and 12, the map's action time, the reach.
      const p = bentIn(["foldStep", "kindle"], { view: "map" });
      const want = { fling: [10, 10, 10, 0.5], wingsUp: [60, 60, 60, 0.5], bellows: [15, 15, 15, 1], flatwise: [30, 30, 30, 0.5], echo: [20, 20, 20, 0.5],
                     overlook: [30, 22, 10, 1], shadowsense: [60, 60, 60, 0.5], kindle: [5, 5, 5, 0.5], foldStep: [12, 12, 12, 0.5] };
      for (const [id, w] of Object.entries(want)) pin(`${id}'s cooldowns at 1, 5, 12 and map time`, [1, 5, 12].map((l) => A.abilityCooldown(p, id, l)).concat(A.ABILITIES[id].mapTime), w);
      pin("Fold Step's reach at levels 1, 3, 10 (the mutation)", [1, 3, 10].map((l) => A.abilityRange(p, "foldStep", l)), [5, 7, 14]);
      pin("Kindle's reach at levels 1, 4", [1, 4].map((l) => A.abilityRange(p, "kindle", l)), [6, 9]);
      pin("Overlook's reach and Bellows' cone", [A.abilityRange(p, "overlook", 3), A.abilityRange(p, "bellows", 3)], [20, 3]);
      // Level terms, fired at a level above 1 with the rolls fixed at their lowest (0) and highest (0.999).
      const roll = (v, f) => { const old = game.combatRng; game.combatRng = () => v; try { return f(); } finally { game.combatRng = old; } };
      const at3 = (muts, lvls, opts) => { const q = bentIn(muts, opts); q.level = 20; Object.assign(q.mutations, lvls); st.invalidateStats(q); return q; };
      {
        const q = at3(["thistlehide"], { thistlehide: 6 }, { view: "map" }), at = runEast(game.zone, 9);
        place(q, at, 0);
        const r = rat(at.x + 1, at.y, at.z, { hp: 99, maxHp: 99, speedMul: 0 });
        roll(0, () => A.activate(game, q, "fling"));
        pin("Fling at level 6, the lowest roll (1 + floor(6 / 2))", 99 - r.hp, 4);
      }
      for (const [v, dmg] of [[0, 3], [0.999, 12]]) {   // (in 3D, where no time passes in the use: the burning hasn't ticked yet)
        const q = at3(["bellowsThroat"], { bellowsThroat: 3 }, { view: "3d" }), at = runEast(game.zone, 9);
        place(q, at, 0);
        const r = rat(at.x + 2, at.y, at.z, { hp: 99, maxHp: 99, speedMul: 0 });
        roll(v, () => A.useAbility(game, q, "bellows"));
        pin(`Bellows at level 3, every d4 rolling ${v ? 4 : 1}`, 99 - r.hp, dmg);
      }
      {
        const q = at3(["flatwise", "wings", "shadowsense"], { flatwise: 3, wings: 3, shadowsense: 3 }, { view: "map" });
        A.activate(game, q, "wingsUp"); A.activate(game, q, "shadowsense"); A.activate(game, q, "flatwise");
        pin("Flatwise, Wings and Shadowsense at level 3 (3 + floor(3 / 2), 20 + 5 × 3, 8 + 2 × 3 s)", ["flat", "flying", "shadowsense"].map((s) => STS.statusLeft(q, s)), [4, 35, 14]);
      }
      {
        const q = at3(["echoThroat"], { echoThroat: 3 }, { view: "3d" }), at = runEast(game.zone, 11);   // (in 3D only a sighting's own work shows them)
        place(q, at, 0);
        const near = rat(at.x + 9, at.y, at.z, { speedMul: 0 }), far = rat(at.x + 10, at.y, at.z, { speedMul: 0 });
        game.zone.sightings.clear();
        A.activate(game, q, "echo");
        pin("Echo at level 3: a creature 9 tiles off on the map, one 10 off not", [game.zone.sightings.has(near.id), game.zone.sightings.has(far.id)], [true, false]);
      }
      {
        // (in 3D: on the map the view's own sight would mark tiles around you as well)
        const q = at3(["overlook"], {}, { view: "3d" }), at = runEast(game.zone, 9), zone = game.zone;
        place(q, at, Math.PI);
        zone.seen.fill(0);
        const c = { x: Math.min(zone.w - 6, at.x + 14), y: Math.max(5, Math.min(zone.d - 6, at.y)) };
        A.activate(game, q, "overlook", { creature: null, tile: c, point: { x: c.x + 0.5, y: c.y + 0.5, z: at.z }, dir: [1, 0, 0] });
        const seen = (dx, dy) => !!zone.seen[c.x + dx + (c.y + dy) * zone.w];
        pin("Overlook's 9 × 9: the corners in, a step past each edge out", [seen(4, 4), seen(-4, -4), seen(5, 0), seen(-5, 0), seen(0, 5), seen(0, -5)], [true, true, false, false, false, false]);
      }
      {
        const q = at3(["kindle"], { kindle: 4 }, { view: "map" }), at = runEast(game.zone, 11), zone = game.zone;
        place(q, at, 0);
        zone.set(at.x + 10, at.y, WD.FLOOR_Z, WD.B.BRAZIER); zone.refresh(); zone.seen.fill(1);
        const tooFar = A.activate(game, q, "kindle");
        zone.set(at.x + 9, at.y, WD.FLOOR_Z, WD.B.BRAZIER); zone.refresh();
        const lit = A.activate(game, q, "kindle") && zone.get(at.x + 9, at.y, WD.FLOOR_Z) === WD.B.BRAZIER_LIT;
        pin("Kindle at level 4: a brazier 10 tiles off out of reach, one 9 off lit", [tooFar, lit], [false, true]);
      }
      // Night Eyes' sight with the torch out (3 + level / 2) and the attribute set's jump (1.5 blocks + the jump bonus).
      {
        const q = at3(["nightEyes", "stiltLegs"], { nightEyes: 1, stiltLegs: 1 }, { view: "map" });
        q.torch = false;
        const sight = [1, 4, 10].map((l) => { q.mutations.nightEyes = l; return m.playerMod.torchRange(q); });
        pin("Night Eyes' sight at levels 1, 4, 10", sight, [3.5, 5, 8]);
        const height = (l) => { q.mutations.stiltLegs = l; st.invalidateStats(q); return +(m.playerMod.jumpSpeed(q) ** 2 / 52).toFixed(2); };
        pin("the jump at Stilt Legs 1, 3, 6 (1.5 + 0.5 × ceil(level / 2) blocks)", [1, 3, 6].map(height), [2.01, 2.51, 3.01]);
        const legacy = rules.overrideRules("stats", "legacy");
        try { pin("the legacy set's jumps (the parent's two)", [height(1), height(3)], [+(8.85 ** 2 / 52).toFixed(2), +(11.4 ** 2 / 52).toFixed(2)]); } finally { legacy(); }
      }
      // Spare Heart gained in play brings the HP it adds.
      {
        const q = bentIn([], { view: "map" });
        const max0 = st.maxHp(q);
        q.hp = max0;
        PM.gainMutation(game, q, "spareHeart");
        pin("Spare Heart in play: max HP and HP", [st.maxHp(q) - max0 > 0, q.hp === st.maxHp(q)], [true, true]);
      }
      // makeCharacter takes the defects' creases first, whatever the order chosen.
      pin("defects listed last: four mutations and Dark-fear and Lightsick", C.makeCharacter(choicesFor("reedcutter", C.suggestSpread("bent", "reedcutter"), { mutations: ["wings", "gills", "foldStep", "kindle", "darkFear", "lightsick"] })).creases, 1);
      // The offers' one seed path: (seed, "mutations", mutations gained), defects not counted.
      {
        const q = bentIn([], { view: "map" });
        const o0 = PM.mutationOffers(game, q);
        pin("the sheet's first offers by offerSeed(seed, 0)", o0, PM.mutationOffers(game, q, R.makeRng(PM.offerSeed(game.seed, 0))));
        q.mutations.lightsick = 1;
        pin("a defect doesn't redraw the offers", PM.mutationOffers(game, q), o0);
        PM.gainMutation(game, q, o0[0]);
        pin("after one gained, offerSeed(seed, 1)", PM.mutationOffers(game, q), PM.mutationOffers(game, q, R.makeRng(PM.offerSeed(game.seed, 1))));
      }
      // Cast: the third wake (not the second) calls the pack, 10 s of game time later; a pack for a zone you've left
      // doesn't come (the Smoothers are that floor's); turns before you have the cube aren't counted.
      {
        const q = bentIn(["foldStep", "overlook", "shadowsense", "kindle"], { view: "map" });
        q.mutations.kindle = 57; st.invalidateStats(q);   // Cast 60: 75%
        const key = game.zone.key, wake = () => { for (let k = 0; k < 60; k++) if (PM.turnWorld(game)) return; };
        game.state.cast = { turns: 300, wakes: { [key]: [game.time - 1] }, pack: null };
        wake();
        pin("two wakes in a zone call no pack", !!game.state.cast.pack, false);
        wake();
        pin("the third calls it, 10 s on", game.state.cast.pack && +(game.state.cast.pack.at - game.time).toFixed(6), 10);
        const sent = [], off = m.events.on("smoothers", (g, e) => sent.push(e));
        try {
          game.state.cast.pack.zone = "elsewhere"; game.state.cast.pack.at = game.time;
          step(1 / 60);
          pin("a pack for a zone you've left", [sent.length, game.state.cast.pack], [0, null]);
          game.story.cube = false; step(1 / 60); game.state.cast = null;   // (the watch reads the cube as it stood a frame ago)
          for (let k = 0; k < 6; k++) { game.view = game.view === "map" ? "3d" : "map"; game.mode = game.view === "map" ? "map" : "explore"; step(1 / 60); }
          pin("turns before you have the cube", game.state.cast?.turns ?? 0, 0);
          game.story.cube = true;
        } finally { off(); }
      }
      // K shows [+4] only when an offer can be bought.
      {
        const q = bentIn(["foldStep"], { view: "map" });
        q.creases = 3;
        press("KeyK"); press("Tab");
        const none = find("[+4]");
        q.creases = 4;
        const some = find("[+4]");
        press("Escape");
        pin("K's [+4] with 3 creases and with 4", [!!none, !!some], [false, true]);
      }
      out.pinned = `${pins.length} numbers written out (cooldowns, map times, reaches, level terms at 3-10, Cast's 3 wakes and 10 s, the offers' seed, the jump, Night Eyes, Spare Heart)`;
    }

    // 7.5 Cast and the Smoothers.
    {
      const p = bentIn(["foldStep", "overlook", "shadowsense", "kindle"], { ego: 16 });
      const chance = (cast, ego) => { p.mutations = { foldStep: 1, overlook: 1, shadowsense: 1, kindle: Math.max(1, cast - 3) }; p.attrs.ego = ego; st.invalidateStats(p); return PM.wakeChance(p); };
      // (At EGO 20 each of the four works 2 levels higher: Cast 20 bought is 28, less 2 × 2 for EGO: (28 − 14) × 2%.)
      // (At EGO 10, mod −3: Kindle 9 works at 6, the rest at 1, Cast 9; the tolerance falls by 6: (9 − 10 + 6) × 2%.)
      const table = [[12, 16, 0.04], [20, 16, 0.2], [30, 16, 0.4], [10, 16, 0], [20, 20, 0.28], [60, 16, 0.75], [12, 10, 0.1]];
      for (const [cast, ego, want] of table) { const got = chance(cast, ego); if (Math.abs(got - want) > 1e-9) fail(`Cast ${cast}, EGO ${ego}: wake chance ${got}, want ${want}`); }
      if (JSON.stringify(PM.packFor(20)) !== '{"size":2,"burnisher":false,"great":false}' || JSON.stringify(PM.packFor(45)) !== '{"size":4,"burnisher":true,"great":true}' || PM.packFor(30).size !== 3)
        fail(`packs: ${JSON.stringify([PM.packFor(20), PM.packFor(30), PM.packFor(45)])}`);
      // Turns of the world at Cast 60 (75%): Tab (toggleMap's "view:turn", B1, WS4 #16), the third wake warns and the
      // pack comes 10 s later. The view set by hand (no turn of yours) rolls nothing.
      chance(60, 16);
      const sent = [], turned = [];
      const off = m.events.on("smoothers", (g, e) => sent.push(e)), offTurn = m.events.on("view:turn", (g, e) => turned.push(e));
      try {
        game.state.cast = null; game.view = "map"; game.mode = "map";
        step(1 / 60);
        for (let k = 0; k < 6; k++) { game.view = game.view === "map" ? "3d" : "map"; game.mode = game.view === "map" ? "map" : "explore"; step(1 / 60); }
        if (game.state.cast?.turns) fail(`the view set by hand counted as ${game.state.cast.turns} turns`);
        game.view = "map"; game.mode = "map"; step(1 / 60);
        let turns = 0;
        for (; turns < 40 && !game.state.cast?.pack; turns++) {
          const was = game.view;
          m.keys.dispatchKey(game, "Tab");
          if (game.view === was) { fail(`Tab didn't turn the world (${game.mode})`); break; }
          step(1 / 60);
        }
        if (turned.length !== turns || turned.some((e, k) => e.from === e.to || (k && e.from !== turned[k - 1].to))) fail(`"view:turn" for ${turns} turns: ${JSON.stringify(turned.slice(0, 4))}`);
        if (game.state.cast?.turns !== turns) fail(`${turns} turns by Tab rolled ${game.state.cast?.turns} wakes`);
        if (!game.state.cast?.pack || !said(/smooths itself out towards you/)) fail(`40 turns at 75% left no pack (${JSON.stringify(game.state.cast)})`);
        const pack = { ...(game.state.cast?.pack || { at: -Infinity }) };   // (none: failed above)
        game.view = "map"; game.mode = "map"; step(1 / 60);
        while (game.time + 0.5 < pack.at) { T.mapWait(game); step(1 / 60); }
        if (sent.length) fail(`the Smoothers came before 10 s (at ${game.time}, due ${pack.at})`);
        T.mapWait(game); step(1 / 60);
        if (sent.length !== 1 || sent[0].size !== 4 || !sent[0].burnisher || !sent[0].great) fail(`the pack: ${JSON.stringify(sent.map((e) => ({ size: e.size, burnisher: e.burnisher, great: e.great })))}`);
        out.cast = `wake chances as bible §10.3; at Cast 60 the pack came after ${turns} turns, 10 s on`;
        // The same seed and turns give the same wakes.
        const replay = () => { game.state.cast = null; const w = []; for (let k = 0; k < 30; k++) w.push(PM.turnWorld(game)); return w.join(); };
        if (replay() !== replay()) fail("Cast's wakes differ for the same seed and turns");
        // Wakes fade after a world hour (60 s of game time, DECISIONS §1): two older than that don't count toward the third.
        const key = game.zone.key, wakeOnce = () => { for (let k = 0; k < 60; k++) if (PM.turnWorld(game)) return true; return false; };
        game.state.cast = { turns: 100, wakes: { [key]: [game.time - 61, game.time - 61] }, pack: null };
        wakeOnce();
        if (game.state.cast.pack || game.state.cast.wakes[key].length !== 1) fail(`two wakes 61 s old and a new one: ${JSON.stringify(game.state.cast)}`);
        game.state.cast = { turns: 200, wakes: { [key]: [game.time - 59, game.time - 59] }, pack: null };
        wakeOnce();
        if (!game.state.cast.pack) fail(`two wakes 59 s old and a new one called no pack: ${JSON.stringify(game.state.cast)}`);
        // Pressed flat onto the map is no turn.
        game.view = "3d"; game.mode = "explore"; step(1 / 60);
        game.state.cast = null;
        STS.addStatus(game, p, "flat", { t: 3 });
        step(1 / 60);
        if (game.state.cast?.turns) fail(`a forced flat map counted as a turn (${game.state.cast.turns})`);
      } finally { off(); offTurn(); }
    }

    // 7.55 The mutations B1 built (C4 #8): a lagged creature's blows come at 0.7 of its pace; Readhand knows an artifact
    // picked up (without it, unknown); Beat-deaf hides a spike's warning on the map; Sleepwalker drifts world-map moves a
    // span to one side about 1 in 10 (none without it).
    {
      const p = bentIn(["timeLag"], { view: "3d" }), at = runEast(game.zone, 9);
      place(p, at, 0);
      const a = rat(at.x + 7, at.y, at.z, { state: "wander", speedMul: 0 }), b = rat(at.x + 8, at.y, at.z, { state: "wander", speedMul: 0 });
      a.cd = b.cd = 5;
      STS.addStatus(game, a, "lagged", { t: 10 });
      for (let k = 0; k < 60; k++) game.debug.step(1 / 60);
      const lagged = 5 - a.cd, plain = 5 - b.cd;
      if (!(plain > 0.9) || Math.abs(lagged / plain - 0.7) > 0.02) fail(`Time Lag: a lagged rat's cooldown ran ${lagged.toFixed(3)} s in 1 s, a plain one's ${plain.toFixed(3)} (want 0.7 of it)`);
      out.timeLag = `a lagged rat's cooldown ran ${lagged.toFixed(2)} s a second, a plain one's ${plain.toFixed(2)}`;
      // Readhand: an unknown fold-knife under your feet, picked up.
      const touch = (muts) => {
        const q = bentIn(muts, { view: "map" });
        const it = { kind: "artifact", id: "foldKnife", known: false, cell: null };
        game.zone.items.push(m.items.makeItem(it, q.x, q.y, q.z));
        m.items.pickUpItems(game);
        const got = q.inv.find((x) => x.kind === "artifact" && x.id === "foldKnife");
        return got?.known;
      };
      const read = touch(["readhand"]), plainTouch = touch([]);
      if (read !== true || plainTouch === true) fail(`Readhand: a fold-knife picked up is known ${read} with it, ${plainTouch} without`);
      // ... and one bought (a trade hands onPickup a copy, then puts another in the pack).
      const buy = (muts) => {
        const q = bentIn(muts, { view: "map" }), MER = m.merchants;
        q.funds = 5000;
        const trader = { type: "villager", level: 5, talk: { state: {} }, merchant: { stock: "general" }, uid: "b1-tinker" };
        trader.talk.state.stock = [{ item: { kind: "artifact", id: "echoBell", known: false, cell: null }, count: 1, price: 10 }];
        trader.talk.state.stockedAt = game.time;
        const row = MER.tradeRows(game, trader, "theirs").find((r) => r.it?.kind === "artifact");
        MER.tradeRow(game, trader, "theirs", row);
        return q.inv.find((x) => x.kind === "artifact" && x.id === "echoBell")?.known;
      };
      const bought = buy(["readhand"]), boughtPlain = buy([]);
      if (bought !== true || boughtPlain !== false) fail(`Readhand: an echo-bell bought is known ${bought} with it, ${boughtPlain} without`);
      // Beat-deaf: a spike about to rise beside you, drawn on the map.
      const carets = (muts) => {
        const q = bentIn([], { view: "map" }), z = game.zone, tx = Math.floor(q.x) + 1, ty = Math.floor(q.y), TR = m.traps;
        for (const id of muts) q.mutations[id] = 1;   // (a defect comes only from the start: set here)
        z.kind[tx + ty * z.w] = WD.KIND.SPIKES; z.seen[tx + ty * z.w] = 1;
        z.spikes.set(tx + ty * z.w, { phase: ((Math.floor(game.time / TR.TICK) + 1) % 4 + 4) % 4, period: 4, up: 1, pattern: "test" });
        if (TR.spikeState(z, tx + ty * z.w, game.time) !== "warn") return -1;
        frame();
        return capture.chars.filter((c) => c === "^").length;
      };
      const warned = carets([]), deaf = carets(["beatDeaf"]);
      if (warned < 1 || deaf !== warned - 1) fail(`Beat-deaf: ${warned} "^" on the map without it, ${deaf} with it (want one fewer)`);
      out.senses = `Readhand: picked up known ${read}; Beat-deaf: ${warned} "^" → ${deaf}`;
    }
    {
      // Sleepwalker, on GNOMON's world: 300 moves back and forth along an open row, fast and kept on the map.
      const walk = (muts) => {
        const p = bentIn([], { view: "map" });
        for (const id of muts) p.mutations[id] = 1;   // (a defect comes only from the start: set here)
        const W = m.worldmap.REAL_WORLD;
        m.gameMod.startRun(23, W, { player: p });
        game.pages = null; game.story.cube = true;
        m.travel.enterWorldMap(game);
        let drifts = 0, moves = 0, side = 0;
        const bad = [];
        for (let k = 0; k < 300; k++) {
          const dx = k % 2 ? -1 : 1, r = m.travel.worldStep(game, dx, 0, { confirm: true, fast: true, drop: false });
          if (!r.ok) continue;
          moves++;
          if (r.drifted) {
            drifts++; if (r.to.wy !== r.from.wy) side++;
            const T = game.run.world.tileAt(r.to.wx, r.to.wy), came = game.trip?.came;
            if (came && (came.dx !== r.to.wx - r.from.wx || came.dy !== r.to.wy - r.from.wy)) bad.push(`came ${JSON.stringify(came)}`);
            if (T.tier >= m.owState.playerTier(game) + m.owState.OW().tierWarning) bad.push(`into tier ${T.tier}`);
          }
          if (game.trip?.prompt) game.trip.prompt = null;
        }
        if (bad.length) fail(`Sleepwalker's drifts: ${bad.slice(0, 3).join("; ")}`);
        return { drifts, moves, side };
      };
      const sw = walk(["sleepwalker"]), calm = walk([]);
      // Every span "beyond you" (the tier warning at -10): a sleepwalker wakes before every drift, so none happens.
      const undoWarn = m.rules.overrideRules("overworld", { ...m.rules.RULES.overworld, tierWarning: -10 });
      let wary;
      try { wary = walk(["sleepwalker"]); } finally { undoWarn(); }
      if (wary.moves < 200 || wary.drifts) fail(`Sleepwalker with every span beyond you: ${wary.drifts} drifts in ${wary.moves} moves (want none)`);
      if (sw.moves < 200 || sw.drifts < 10 || sw.drifts > 0.16 * sw.moves || sw.side !== sw.drifts || calm.drifts) fail(`Sleepwalker: ${sw.drifts} drifts in ${sw.moves} moves (${sw.side} to a side; want about 1 in 10), ${calm.drifts} without it`);
      out.sleepwalker = `${sw.drifts} drifts in ${sw.moves} moves, ${calm.drifts} without`;
    }

    // 7.6 Defects that come and go.
    {
      const p = bentIn([], { view: "map" });
      p.creases = 0;
      p.mutations = { darkFear: 1, mothKissed: 1 };
      st.invalidateStats(p);
      p.torch = false; step(1 / 60);
      if (!STS.hasStatus(p, "shaken") || st.bonus(p, "toHit") !== -2 || st.bonus(p, "dv") !== -1 || STS.hasStatus(p, "mobbed")) fail(`Dark-fear with the torch out: ${JSON.stringify(Object.keys(p.status))}, toHit ${st.bonus(p, "toHit")}, DV bonus ${st.bonus(p, "dv")}`);
      // Through a long map action (5 s at once) Dark-fear holds: no frame runs inside it.
      T.mapUseTime(game, 5);
      if (!STS.hasStatus(p, "shaken") || st.bonus(p, "toHit") !== -2) fail(`Dark-fear after a 5 s map action: ${JSON.stringify(Object.keys(p.status))}, toHit ${st.bonus(p, "toHit")}`);
      // (Moth-kissed's -0.3 on top of what the kit already gives: the Reedcutter's reed cloak, +0.1, since C4.)
      const kitStealth = st.bonus(p, "stealth");
      p.torch = true; step(1 / 60);
      if (STS.hasStatus(p, "shaken") || !STS.hasStatus(p, "mobbed") || Math.abs(st.bonus(p, "stealth") - (kitStealth - 0.3)) > 1e-9) fail(`the torch lit: ${JSON.stringify(Object.keys(p.status))}, stealth ${st.bonus(p, "stealth")}, want ${kitStealth} - 0.3`);
      if (!m.pmut.lasting(p.status.mobbed) || JSON.stringify(codec.encodePlayer(p).status.mobbed) !== JSON.stringify(p.status.mobbed)) fail(`Moth-kissed's status doesn't last or doesn't save: ${JSON.stringify(p.status.mobbed)}`);
      // Lightsick: on the surface by day, 1 HP every 20 s; underground nothing.
      p.mutations = { lightsick: 1 }; st.invalidateStats(p);
      const s = game.run.world.start;
      game.debug.enterZone(`${s.wx},${s.wy},0`, "down");
      game.view = "map"; game.mode = "map"; game.zone.creatures = game.zone.creatures.filter((c) => c.talk);
      // Somewhere under the open sky (the start may be under the temple's roof).
      let sunny = false;
      for (let y = 1; y < game.zone.d - 1 && !sunny; y++) for (let x = 1; x < game.zone.w - 1 && !sunny; x++) {
        const z = game.zone.stand[x + y * game.zone.w];
        if (z >= 0 && m.light.naturalLight(game, game.zone, x + 0.5, y + 0.5, z + 1.45) >= 0.9) { Object.assign(p, { x: x + 0.5, y: y + 0.5, z }); sunny = true; }
      }
      step(1 / 60);
      const hp0 = p.hp, t0 = game.time, noRegen = rules.overrideRules("regen", { ...rules.RULES.regen, base: 1e9 });   // (regeneration would heal it back)
      // Played out by waits, skipped, and in 1-second map actions: the same 1 HP every 20 s (bible §13.5; TECH_DESIGN §2.7: a
      // skip gives what playing the time out gives).
      const lost = {};
      try {
        for (let k = 0; k < 400 && game.time - t0 < 60; k++) { T.mapWait(game); step(1 / 60); }
        lost.waits = hp0 - p.hp;
        let h = p.hp;
        m.time.skipTime(game, 120, { interruptible: false });
        lost.skip = h - p.hp; h = p.hp;
        for (let k = 0; k < 60; k++) { T.mapUseTime(game, 1); step(1 / 60); }
        lost.actions = h - p.hp; h = p.hp;
        // 10 s in the sun, a long stretch under the temple's roof (no harm), 10 s more in the sun: the count carries over.
        const sun = { x: p.x, y: p.y, z: p.z };
        m.time.skipTime(game, 10, { interruptible: false });
        Object.assign(p, game.zone.spawn, { x: game.zone.spawn.x + 0.5, y: game.zone.spawn.y + 0.5 });
        const roofed = m.light.naturalLight(game, game.zone, p.x, p.y, p.z + 1.45) < 0.5;
        m.time.skipTime(game, 90, { interruptible: false });
        lost.shade = h - p.hp;
        Object.assign(p, sun);
        m.time.skipTime(game, 10, { interruptible: false });
        lost.carried = h - p.hp - lost.shade;
        if (roofed && lost.shade !== 0) fail(`Lightsick in the shade for 90 s: lost ${lost.shade} HP`);
        if (roofed && lost.carried !== 1) fail(`Lightsick's count over a stretch of shade: 10 s + 10 s in the sun lost ${lost.carried} HP, want 1`);
        // Under a veil (C4's salt veil, `veil: true`; integrator, C4 #3) the sun doesn't reach you; taken off, it does.
        if (sunny) {
          const veil = { kind: "armour", id: "saltVeil", count: 1 }, eq = m.body.equip(game, p, veil);
          h = p.hp; m.time.skipTime(game, 60, { interruptible: false }); lost.veiled = h - p.hp;
          m.body.unequip(game, p, Object.keys(p.body.equip).find((k) => p.body.equip[k] === veil)); h = p.hp; m.time.skipTime(game, 60, { interruptible: false }); lost.unveiled = h - p.hp;
          if (!eq.ok || lost.veiled !== 0 || lost.unveiled !== 3) fail(`Lightsick under a salt veil: worn ${eq.ok} (${eq.reason || ""}), lost ${lost.veiled} HP in 60 s; taken off, ${lost.unveiled} (want 0, then 3)`);
        }
      } finally { noRegen(); }
      if (sunny && (lost.waits !== 3 || lost.skip !== 6 || lost.actions !== 3)) fail(`Lightsick on the surface: ${JSON.stringify(lost)}, want 3 by waits (60 s), 6 by a 120 s skip, 3 by 60 actions of 1 s`);
      out.defects = `shaken / mobbed by the torch, held through a 5 s action; Lightsick on the surface: ${JSON.stringify(lost)}${sunny ? "" : " (no sky here!)"}`;
      // The wizard's kit line names each piece as the game does (integrator, C4 #11): no registry id ("markerChalk"),
      // a made piece by its material ("copper hand-axe").
      {
        const badKit = [];
        for (const bg of Object.values(m.content.BACKGROUNDS)) {
          const k = bg.kit, pieces = [...Object.values(k.equip || {}), k.belt, ...(k.pack || [])].filter((it) => it && m.items.ITEM_KINDS[it.kind]);
          m.create.kitOf(bg).forEach((line, i) => {
            const it = pieces[i];
            if (/[a-z][A-Z]/.test(line) || (it?.made && !line.toLowerCase().replace(/ /g, "").startsWith(String(it.made).toLowerCase()))) badKit.push(`${bg.name}: "${line}"`);
          });
        }
        if (badKit.length) fail(`the wizard's kit lines: ${badKit.slice(0, 4).join("; ")}`);
      }
      // Crooked Manner: −50 with every faction.
      C.beginRun(game, choicesFor("reedcutter", C.suggestSpread("bent", "reedcutter"), { mutations: ["crookedManner"] }), { seed: 4 });
      const reps = m.mutations.BIBLE_FACTIONS.map((f) => m.factions.repOf(game, f) - m.factions.baseRep(game, f) - (BACKGROUNDS.reedcutter.rep[f] || 0));
      if (reps.some((n) => n !== -50)) fail(`Crooked Manner: ${reps.join(", ")}`);
      // The hooks' content halves (WS4 #2, #6, #7, #20, at the WS4b merge): a Cassin Lamplighter's torch costs half,
      // Thrifty wick halves it, Lampskin makes it free; Steady hand +2 to hit with missile weapons; none of those four
      // and the Haggler waits for anything (needs), so a level offers them.
      {
        const tc = (who) => st.bonus(who, "torchCost");
        const lamp = C.makeCharacter(choicesFor("lamplighterOfCassin", C.suggestSpread("plumb", "lamplighterOfCassin")));
        const sk = bentIn(["lampskin"]), plain = bentIn([]);
        const ex0 = st.bonus(game.player, "examine");
        L.takePerk(game, "thriftyWick"); L.takePerk(game, "steadyHand"); L.takePerk(game, "keenFingers");
        const got = { cassin: tc(lamp), lampskin: tc(sk), thrifty: tc(game.player), steady: st.bonus(game.player, "missileAcc"), keen: st.bonus(game.player, "examine") - ex0 };
        out.hooks = JSON.stringify(got);
        if (got.cassin !== -0.5 || got.lampskin !== -1 || got.thrifty !== -0.5 || got.steady !== 2 || got.keen !== 3 || plain !== game.player)
          fail(`the torch, missile and examine hooks: ${out.hooks} (want Cassin -0.5, Lampskin -1, Thrifty wick -0.5, Steady hand 2, Keen fingers 3)`);
        const waiting = ["haggler", "steadyHand", "thriftyWick", "keenFingers", "warmHands"].filter((id) => POWERS[id].needs);
        if (waiting.length) fail(`still waiting (needs), so never offered: ${waiting.join(", ")}`);
      }
    }

    // 7.7 B and K at 100×30.
    {
      const text = () => { frame(); return Array.from({ length: capture.rows }, (_, y) => rowText(y)); };
      // The panel (over the view: the map and its messages show around it) keeps inside its box: a border on every
      // row, nothing past it, the box inside 100 columns.
      const edge = (what) => {
        const rows = text(), top = rows.findIndex((r) => /^.?\+-/.test(r)), x0 = rows[top]?.indexOf("+"), x1 = rows[top]?.lastIndexOf("+");
        if (top < 0 || x1 >= capture.cols - 1 || x1 - x0 < 60) { fail(`${what}: no box inside the screen (${rows[top]?.slice(-20)})`); return; }
        let bottom = top + 1;
        while (bottom < rows.length && rows[bottom][x0] === "|") bottom++;
        for (let y = top + 1; y < bottom; y++) if (rows[y][x1] !== "|") fail(`${what}: row ${y} runs over the box's edge: "${rows[y].slice(x1 - 20, x1 + 1)}"`);
        if (rows[bottom]?.[x0] !== "+" || bottom - top < 20) fail(`${what}: the box is ${bottom - top + 1} rows tall`);
      };
      const p = bentIn(["foldStep", "wings", "echoThroat"], { view: "map" });
      press("KeyB");
      if (game.mode !== "abilities") fail(`B on the map opened ${game.mode}`);
      let rows = text().join("\n");
      for (const want of ["ABILITIES", "Fold Step", "Wings", "Echo", "keys 1-9 use these in 3D and on the map alike", "ready", "1 Fold Ste"]) if (!rows.includes(want)) fail(`B: "${want}" isn't on screen`);
      edge("B");
      // The second row (Wings) onto key 5 by its digit: off key 2.
      press("ArrowDown"); press("Digit5", "5");
      if (p.hotbar[4] !== "wingsUp" || p.hotbar[1]) fail(`B: 5 put Wings on ${JSON.stringify(p.hotbar)}`);
      press("Digit0", "0");
      if (p.hotbar.includes("wingsUp")) fail(`B: 0 left Wings on ${JSON.stringify(p.hotbar)}`);
      press("Enter");
      if (p.hotbar.indexOf("wingsUp") !== 1) fail(`B: Enter put Wings on ${JSON.stringify(p.hotbar)} (want the first free key, 2)`);
      // A cooldown shows in the list.
      A.startCooldown(p, "echo", 17);
      if (!text().join("\n").includes("17s")) fail("B: a cooling ability doesn't show its seconds");
      // By mouse: Echo chosen, a click on slot 9 puts it there; a right click empties it.
      click("Echo", { row: "17s" });
      click("9 ", { row: "1 Fold" });
      if (p.hotbar[8] !== "echo") fail(`B: a click on slot 9 gave ${JSON.stringify(p.hotbar)}`);
      const s9 = find("9 Echo");
      if (s9) screens.dispatchMouse(game, 2, s9);
      if (p.hotbar.includes("echo")) fail(`B: a right click on slot 9 left ${JSON.stringify(p.hotbar)}`);
      click("[ Close ]");
      if (game.mode !== "map") fail(`B: [ Close ] left ${game.mode}`);
      press("KeyB"); press("Escape");
      if (game.mode !== "map") fail(`B: Esc left ${game.mode}`);
      // In 3D too.
      game.view = "3d"; game.mode = "explore"; game.paused = false;
      press("KeyB");
      if (game.mode !== "abilities") fail(`B in 3D opened ${game.mode}`);
      press("KeyB");
      game.view = "map"; game.mode = "map";

      // K: the attributes, a point spent by Enter and by [+].
      p.attrPoints = 2; p.level = 6;
      press("KeyK");
      if (game.mode !== "char") fail(`K opened ${game.mode}`);
      rows = text().join("\n");
      for (const want of ["ATTRIBUTES", "Mutations", "Powers", "Effects", "HP ", "AV ", "DV ", "MA ", "Creases", "Cast", "2 attribute points"]) if (!rows.includes(want)) fail(`K: "${want}" isn't on screen`);
      edge("K attributes");
      const str0 = p.attrs.str, tou0 = p.attrs.tou, hp0 = p.hp, max0 = st.maxHp(p);
      press("Enter");   // STR, the first row
      if (p.attrs.str !== str0 + 1 || p.attrPoints !== 1) fail(`K: Enter on STR: ${p.attrs.str} (was ${str0}), ${p.attrPoints} points left`);
      click("[+]", { row: "TOU" });
      if (p.attrs.tou !== tou0 + 1 || p.attrPoints !== 0 || st.maxHp(p) <= max0 - 1 || p.hp - hp0 !== st.maxHp(p) - max0) fail(`K: [+] on TOU: ${p.attrs.tou} (was ${tou0}), ${p.attrPoints} left, HP ${hp0} → ${p.hp}, max ${max0} → ${st.maxHp(p)}`);
      press("Enter");
      if (!/no attribute points/.test(m.charsheet.sheetView(game).msg)) fail(`K: Enter with no points: "${m.charsheet.sheetView(game).msg}"`);
      // The mutations tab by Tab: raise Fold Step by Enter, Wings by [+1]; buy an offer by Enter and one by [+4].
      press("Tab");
      if (m.charsheet.sheetView(game).tab !== "track") fail(`K: Tab went to ${m.charsheet.sheetView(game).tab}`);
      edge("K mutations");
      p.creases = 10;
      press("Enter");
      if (p.mutations.foldStep !== 2 || p.creases !== 9) fail(`K: Enter on Fold Step: level ${p.mutations.foldStep}, ${p.creases} creases`);
      click("[+1]", { row: "Wings" });
      if (p.mutations.wings !== 2 || p.creases !== 8) fail(`K: [+1] on Wings: level ${p.mutations.wings}, ${p.creases} creases`);
      const offers = m.charsheet.sheetView(game).rows.filter((r) => r.offer).map((r) => r.offer);
      if (offers.length !== 3 || JSON.stringify(offers) !== JSON.stringify(PM.mutationOffers(game, p))) fail(`K: the offers ${offers}, want ${PM.mutationOffers(game, p)}`);
      press("End"); press("Enter");
      if (!p.mutations[offers[2]] || p.creases !== 4) fail(`K: Enter on the last offer (${offers[2]}): ${JSON.stringify(p.mutations)}, ${p.creases} creases`);
      const next = m.charsheet.sheetView(game).rows.filter((r) => r.offer).map((r) => r.offer);
      click("[+4]");
      if (Object.keys(p.mutations).length !== 5 || p.creases !== 0 || !next.some((id) => p.mutations[id])) fail(`K: [+4] gave ${JSON.stringify(p.mutations)}, ${p.creases} creases`);
      press("ArrowUp"); press("Enter");
      if (!/needs 4 creases|crease; you have none/.test(m.charsheet.sheetView(game).msg)) fail(`K: spending with no creases said "${m.charsheet.sheetView(game).msg}"`);
      // The other tabs by click; Esc closes.
      click("Powers");
      if (m.charsheet.sheetView(game).tab !== "powers") fail(`K: a click on Powers went to ${m.charsheet.sheetView(game).tab}`);
      edge("K powers");
      click("Effects");
      if (m.charsheet.sheetView(game).tab !== "effects") fail(`K: a click on Effects went to ${m.charsheet.sheetView(game).tab}`);
      if (!text().join("\n").includes("WHAT ADDS UP")) fail("K: the effects tab shows no bonuses");
      STS.addStatus(game, p, "shadowsense", { t: 9 });
      if (!text().join("\n").includes("SENSE") || text().join("\n").includes("shadowsense")) fail("K: the effects tab names a status by its id, not as the HUD does");
      edge("K effects");
      press("Escape");
      if (game.mode !== "map") fail(`K: Esc left ${game.mode}`);
      // The wake chance shows whole on both tabs at 100 columns (Cast 20: 20%).
      {
        const c = bentIn(["foldStep", "overlook", "shadowsense", "kindle"], { view: "map" });
        c.mutations.kindle = 17; st.invalidateStats(c);
        const want = `${Math.round(PM.wakeChance(c) * 100)}%`;
        press("KeyK");
        const a = text().join("\n");
        press("Tab");
        const b = text().join("\n");
        press("Escape");
        if (PM.castOf(c) !== 20 || !a.includes(`Cast 20: ${want}`) || !b.includes(want)) fail(`K at Cast ${PM.castOf(c)}: the wake chance ${want} on the attributes tab ${a.includes(want)}, on the mutations tab ${b.includes(want)}`);
      }
      // The quick start's sheet and list (no genotype) draw too.
      const undo2 = rules.overrideRules("stats", "legacy");
      try {
        game.debug.startRun(31);
        for (let k = 0; k < 20 && game.mode === "story"; k++) press("Space");
        game.view = "map"; game.mode = "map";
        press("KeyK"); press("Tab"); if (!text().join("\n").includes("quick start")) fail("K: the quick start's second tab says nothing of it");
        press("Escape"); press("KeyB");
        if (!text().join("\n").includes("Fold Step")) fail("B: the quick start's Fold Step isn't listed");
        press("Escape");
      } finally { undo2(); }
      out.screens = `B and K at ${capture.cols}×${capture.rows} by keys and mouse; hotbar ${JSON.stringify(p.hotbar)}`;
    }

    // 7.8 The wizard's mutation step.
    {
      W.openCreate(game, { seed: 777 });
      press("Enter"); press("Enter"); press("Enter");   // Bent, Reedcutter, the suggested spread
      if (W.wizard().step !== "track") fail(`wizard 4b: on ${W.wizard().step}, want track`);
      const shown = () => W.trackRows(game);
      const first = shown().filter((r) => typeof r === "string");
      const want = PM.mutationOffers(null, { genotype: "bent", level: 1, mutations: {} }, R.makeRng(PM.offerSeed(777, 0)));
      if (JSON.stringify(first) !== JSON.stringify(want)) fail(`wizard 4b: offers ${first}, want ${want} (seed 777)`);
      press("Enter");
      const took = W.wizard().mutations[0];
      if (took !== first[0]) fail(`wizard 4b: Enter took ${took}, want ${first[0]}`);
      const second = shown().filter((r) => typeof r === "string");
      if (second.includes(took) || JSON.stringify(second) === JSON.stringify(first)) fail(`wizard 4b: after taking ${took} the offers are ${second}`);
      // A defect by keys, then given back by a click on it.
      const rowsNow = shown(), di = rowsNow.findIndex((r) => r.defect);
      for (let k = 0; k < di; k++) press("ArrowDown");
      const defect = rowsNow[di].defect;
      press("Enter");
      if (!W.wizard().mutations.includes(defect)) fail(`wizard 4b: Enter on the defect ${defect} didn't take it`);
      const afterDefect = shown().filter((r) => typeof r === "string");
      if (JSON.stringify(afterDefect) !== JSON.stringify(second)) fail(`wizard 4b: taking the defect ${defect} drew other offers: ${afterDefect}, were ${second}`);
      const name = MU[defect].name;
      click(`* ${name}`); if (W.wizard().mutations.includes(defect)) click(`* ${name}`);
      if (W.wizard().mutations.includes(defect)) fail(`wizard 4b: two clicks on the taken ${defect} didn't give it back`);
      // Two more offers by clicks (12 creases spent), then a defect and a fourth; the defect can't go back now.
      // A click picks a row out and a click on the row picked out chooses it (after a give-back the row below is picked).
      const take = (label, done) => { click(label); if (!done()) click(label); };
      for (let k = 0; k < 2; k++) { const o = shown().find((r) => typeof r === "string"); take(MU[o].name, () => W.wizard().mutations.includes(o)); }
      if (W.wizard().mutations.length !== 3) fail(`wizard 4b: three offers taken by clicks: ${W.wizard().mutations}`);
      const o4 = shown().find((r) => typeof r === "string");
      take(MU[o4].name, () => !!W.wizard().msg);
      if (W.wizard().mutations.includes(o4) || !/needs 4 creases/.test(W.wizard().msg)) fail(`wizard 4b: a fourth with no creases: ${W.wizard().mutations}, "${W.wizard().msg}"`);
      take("Dark-fear +3", () => W.wizard().mutations.includes("darkFear"));
      take("Lightsick +2", () => W.wizard().mutations.includes("lightsick"));
      const o5 = shown().find((r) => typeof r === "string" && r !== "nightEyes");
      take(MU[o5].name, () => W.wizard().mutations.includes(o5));
      if (!W.wizard().mutations.includes(o5)) fail(`wizard 4b: with Dark-fear's and Lightsick's 5 creases, ${o5} wasn't taken (${W.wizard().msg})`);
      click("* Dark-fear"); if (!/short/.test(W.wizard().msg)) click("* Dark-fear");
      if (!W.wizard().mutations.includes("darkFear") || !/short/.test(W.wizard().msg)) fail(`wizard 4b: Dark-fear given back with its creases spent: ${W.wizard().mutations}, "${W.wizard().msg}"`);
      click("[ Next ]");
      typeText("Ruut");
      click("[ Next ]"); click("[ Next ]");
      const chosen = W.wizard().mutations;
      click("[ Begin ]");
      const p = game.player;
      if (JSON.stringify(Object.keys(p.mutations).sort()) !== JSON.stringify([...chosen].sort()) || p.creases !== 12 + 3 + 2 - 16) fail(`wizard 4b: began with ${JSON.stringify(p.mutations)} and ${p.creases} creases, chose ${chosen}`);
      const abilities = chosen.filter((id) => MU[id].ability).map((id) => MU[id].ability);
      if (JSON.stringify(p.hotbar) !== JSON.stringify(abilities)) fail(`wizard 4b: hotbar ${JSON.stringify(p.hotbar)}, want ${JSON.stringify(abilities)}`);
      out.wizard4b = `seed 777: offers ${first.join(", ")}; began with ${chosen.join(", ")} (${p.creases} creases), hotbar ${JSON.stringify(p.hotbar)}`;
      // Creases kept in the wizard: the sheet offers the three the wizard showed last (bible §10.3: 1 of 3, not 6).
      W.openCreate(game, { seed: 555 });
      press("Enter"); press("Enter"); press("Enter"); press("Enter");   // Bent, Reedcutter, the spread, the first offer
      const lastShown = W.trackRows(game).filter((r) => typeof r === "string");
      press("End"); press("Enter"); typeText("Kept"); press("Enter"); press("Enter"); press("Enter");
      const sheetOffers = PM.mutationOffers(game, game.player);
      if (game.player.creases !== 8 || JSON.stringify(sheetOffers) !== JSON.stringify(lastShown)) fail(`creases kept in the wizard: it showed ${lastShown}, the sheet offers ${sheetOffers} (${game.player.creases} creases)`);
    }
  }

  const undo = rules.overrideRules("stats", "attributes");
  try {
    section1(); section2(); section3(); section4(); section5(); section7();
  } finally { undo(); }
  // The old game under the legacy set, which is no longer the default since the flip (p2-flip): set here.
  const undoLegacy = [rules.overrideRules("stats", "legacy"), rules.overrideRules("combat", "legacy")];
  try { section6(); } finally { while (undoLegacy.length) undoLegacy.pop()(); }
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
    codec: await src("save/codec.js"), rng: await src("rng.js"), items: await src("items.js"), playerMod: await src("player.js"), body: await src("body.js"),
    implants: await src("content/items/implants.js"), mutations: await src("content/mutations.js"),
    pmut: await src("progression/mutations.js"), abilities: await src("abilities.js"), turns: await src("turns.js"), inventory: await src("inventory.js"),
    traps: await src("traps.js"), merchants: await src("social/merchants.js"), owState: await src("overworld/state.js"), travel: await src("overworld/travel.js"), worldmap: await src("content/world/worldmap.js"), gameMod: await src("game.js"),
    creatures: await src("creatures.js"), world: await src("world.js"), status: await src("status.js"), events: await src("events.js"),
    factions: await src("factions.js"), charsheet: await src("screens/charsheet.js"), light: await src("light.js"), time: await src("time.js"),
    content: { ...genotypes, ...backgrounds, ...powers },
  });
}
