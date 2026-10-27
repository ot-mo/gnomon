// WS5's check (TECH_DESIGN §8.3 "WS5" acceptance; owner WS5): body mods, items and the equipment UI.
//
//   checkItems(m) → { name, ok, problems, stats }      m: the modules (run(env) loads them), S, capture, resize
//
//   1. The equip/unequip matrix: every piece of gear (the parent's, the pieces for every other part, rings and
//      amulets, a two-hander) against every part of every plan (humanoid, beast, a humanoid with an extra hand and
//      the folding rack's second back): it goes on exactly the parts of its slot type (a two-hander only where two
//      holding parts are free of curses), worn() lists it once, unequip gives it back and every derived number
//      comes back exactly (R3, the stat cache verified); a cursed one refuses to come off or be covered. Every
//      part type of every plan has real gear that fits. The STR requirement refuses. Through the inventory: E
//      equips from the pack, the Equipment tab takes off into the pack (the main hand's weapon stays; cursed things
//      stick; the belt goes to the pack); no base field is written.
//   2. Implants: canInstall's every refusal (kind, genotype, station, part, slot, taken, twice, grade, funds,
//      hunted); install pays 25 glim × grade, takes a world hour (the same in the map and in 3D), moves the item
//      out of the pack, gives its bonuses and abilities (source "implant"); uninstall needs the station (the curse
//      lock), gives the grade back, destroys a † one, and takes the folding rack's part (what it held to the pack);
//      grade costs 1 true-mark a grade up to 8, then 2; true-marks walked over are counted; grantImplant; the
//      Truing Cradle block opens the Cradle screen by walking into it (map) and by E (3D), and the screen fits and
//      removes by keys; the surgeon's services; a save round trip keeps it all.
//   3. Identify odds: examineArtifact over 20,000 tries for each complexity and examine bonus lands within ±2% of
//      the formula (d20 + INT mod + bonus(examine) against 8 + 2 × complexity; partly known by a miss of 1-5,
//      broken by 6 or more unless sturdy), worked out here independently; identifyChance is exact; the tinker's
//      service identifies without risk.
//   4. Examine from an inspect event: open: true from the map's tile payload opens it (creature and item, Tab
//      between them), open: false doesn't; a 3D-style payload with a block opens it; a level-eye shows exact
//      numbers; L in the inventory opens it over the pack and Esc goes back.
//   5. Artifacts and cells, both views: each effect does what it says on the map (abilities.js requestTarget) and in
//      3D (the crosshair); charge is paid, cells load from the pack, glim cells fill from the purse, sun and dark
//      cells recharge exactly over skipTime; the lantern-mote runs, lends its light and goes out when empty.
//   6. The pack screen: 60 things scroll at 100×30 and 180×56 (the selection stays on screen, PgDn pages), the
//      filter shows one kind, Tab shows the Equipment tab, "I close" is on screen; the parent's keys still answer
//      as before (0, null, "throw", seconds).
//   7. The consumable effects table: every parent potion, scroll and splash is an entry; registerEffect.
//   8. The inventory in check-screen-frames' 8 states (no longer compared there): the pack, header, tabs and I close.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function checkItems(m) {
  const problems = [], stats = {};
  const fail = (msg) => problems.push(msg);
  const { game, startRun } = m.game, I = m.items, Bd = m.body, St = m.stats, IM = m.implants, AR = m.artifacts;
  const section = (name, fn) => { try { fn(); } catch (err) { fail(`${name}: threw ${err.stack?.split("\n").slice(0, 3).join(" / ") || err}`); } };
  const fresh = ({ seed = 7, view = "map", depth = 3, plumb = true } = {}) => {
    startRun(seed);
    game.pages = null; game.pendingPages = null; game.story.cube = true; game.modeStack = [];
    const s = game.run.world.start;
    game.debug.enterZone(`${s.wx},${s.wy},${depth}`, "down");
    game.view = view; game.mode = view === "map" ? "map" : "explore"; game.paused = false;
    game.zone.creatures = game.zone.creatures.filter((c) => c.talk);
    const p = game.player;
    if (plumb) p.genotype = "plumb";
    p.funds = 1000; p.purse = 1000;
    game.messages = [];
    St.invalidateStats(p);
    return p;
  };
  const said = (re) => game.messages.some((x) => re.test(x.text));

  // --- 1. The equip/unequip matrix -------------------------------------------------------------------------------
  section("matrix", () => {
    if (!I.ITEM_KINDS.checkWs5Twohander)
      I.registerItemKind("checkWs5Twohander", { stack: false, slot: () => "hand", hands: () => 2, name: () => "check two-hander", glyph: () => ["}", [200, 200, 200]],
        price: () => 0, weight: () => 0, art: I.ITEM_KINDS.weapon.art, palette: I.ITEM_KINDS.weapon.palette, bonuses: () => ({ reach: 1 }) });
    const gear = [];
    for (const ench of [-1, 0, 2]) {
      for (const id in I.WEAPONS) gear.push({ kind: "weapon", id, ench, known: true });
      for (const id in I.ARMOURS) gear.push({ kind: "armour", id, ench, known: true });
      for (const id in I.RINGS) gear.push({ kind: "ring", id, ench: I.RINGS[id].fixed ? 1 : ench, known: true });
      for (const id in I.AMULETS) gear.push({ kind: "amulet", id, ench: I.AMULETS[id].fixed ? 1 : ench, known: true });
      gear.push({ kind: "checkWs5Twohander", id: "x", ench, known: true });
    }
    const plans = {
      humanoid: () => Bd.makeBody("humanoid"),
      beast: () => Bd.makeBody("beast"),
      extras: () => { const b = Bd.makeBody("humanoid"); b.parts.push({ id: "hand_x", type: "hand", holds: true }, { id: "back_2", type: "back" }); b.equip.hand_x = null; b.equip.back_2 = null; return b; },
    };
    const entity = (plan) => ({ body: plans[plan](), inv: [], attrs: St.makeAttrs(30), level: 1, maxHpGain: 0, hp: 20, perks: {}, status: {} });
    const snap = (e) => JSON.stringify({ hp: St.maxHp(e), av: St.av(e), dv: St.dv(e), attrs: St.ATTRS.map((k) => St.attr(e, k)), b: St.bonusTable(e) });
    const matrix = {};
    let fits = 0, refusals = 0, cursedHeld = 0;
    St.STATS_DEBUG.verify = true;
    try {
      for (const plan of Object.keys(plans)) {
        const types = [...new Set(plans[plan]().parts.map((q) => q.type))];
        const real = new Set();
        for (const proto of gear) {
          const type = I.ITEM_KINDS[proto.kind].slot(proto), twoHanded = (I.ITEM_KINDS[proto.kind].hands?.(proto) || 1) >= 2;
          for (const part of plans[plan]().parts) {
            const e = entity(plan), it = structuredClone(proto), before = snap(e);
            const holders = e.body.parts.filter((q) => q.holds).length;
            const want = part.type === type && (!twoHanded || holders >= 2);
            const r = Bd.equip(game, e, it, part.id);
            if (r.ok !== want) { fail(`${plan}: ${it.kind} ${it.id} on ${part.id} (${part.type}): ${r.ok ? "accepted" : `refused (${r.reason})`}, want ${want ? "accepted" : "refused"}`); continue; }
            if (!r.ok) { refusals++; continue; }
            fits++;
            (matrix[plan] ||= {})[part.type] = (matrix[plan][part.type] || 0) + 1;
            if (!it.kind.startsWith("check")) real.add(part.type);
            if (Bd.worn(e).filter((x) => x === it).length !== 1) fail(`${plan}: ${it.kind} ${it.id} on ${part.id} not worn exactly once`);
            if (twoHanded && e.body.parts.filter((q) => q.holds).some((q) => Bd.wornOn(e, q.id) !== it)) fail(`${plan}: the two-hander doesn't fill every holding part`);
            if (it.ench < 0) {
              const u = Bd.unequip(game, e, part.id), cover = Bd.equip(game, e, { ...structuredClone(proto), ench: 1 }, part.id);
              if (u.ok || u.reason !== "cursed" || cover.ok || cover.reason !== "cursed") fail(`${plan}: cursed ${it.kind} ${it.id} on ${part.id} came off (${u.reason}) or was covered (${cover.reason})`);
              else cursedHeld++;
              it.ench = 0; St.invalidateStats(e);
            }
            const off = Bd.unequip(game, e, part.id);
            if (!off.ok || off.item !== it) fail(`${plan}: ${it.kind} ${it.id} off ${part.id}: ${off.reason}`);
            if (it.ench === proto.ench && snap(e) !== before) fail(`${plan}: ${it.kind} ${it.id} on and off ${part.id} changed the derived numbers`);
            else if (it.ench !== proto.ench && snap(e) !== before) fail(`${plan}: lifted ${it.kind} ${it.id} on and off ${part.id} changed the derived numbers`);
          }
        }
        for (const t of types) if (!real.has(t)) fail(`${plan}: no real gear fits a ${t} part`);
      }
    } finally { St.STATS_DEBUG.verify = false; }
    stats.matrix = { fits, refusals, cursedHeld, byPlan: matrix };

    // The STR requirement still refuses; a weak entity is told why.
    {
      const e = entity("humanoid"); e.attrs = St.makeAttrs(6);
      const r = Bd.canEquip(game, e, { kind: "armour", id: "ironHelm", ench: 0, known: true }, "head");
      if (r.ok || r.reason !== "weak") fail(`an iron helm at STR ${St.attr(e, "str")}: ${r.ok ? "accepted" : r.reason}, want weak`);
    }

    // Through the inventory, with base fields watched.
    const p = fresh(), writes = [];
    St.raiseAttr(p, "str", 20);
    const real = game.player;
    game.player = St.guardBaseFields(real, (path) => writes.push(path));
    try {
      const g = game.player, cap = { kind: "armour", id: "copperCap", ench: 0, known: false }, boots = { kind: "armour", id: "boots", ench: -1, known: false };
      g.inv.push(cap, boots);
      if (!m.inventory.equip(game, cap, g.inv.indexOf(cap)) || Bd.wornOn(g, "head") !== cap || g.inv.includes(cap)) fail("E didn't put the copper cap on the head");
      m.inventory.equip(game, boots, g.inv.indexOf(boots));
      if (Bd.wornOn(g, "feet") !== boots || !said(/cursed/)) fail("cursed boots: not on the feet, or nobody said they're cursed");
      const t1 = m.inventory.unequipPart(game, "head");
      if (t1 !== RULES().body.equipTime || Bd.wornOn(g, "head") || !g.inv.includes(cap)) fail(`taking the cap off: ${t1} s, still worn ${!!Bd.wornOn(g, "head")}, in the pack ${g.inv.includes(cap)}`);
      if (m.inventory.unequipPart(game, "feet") !== 0 || Bd.wornOn(g, "feet") !== boots) fail("cursed boots came off from the Equipment tab");
      const sword = Bd.wielded(g);
      if (m.inventory.unequipPart(game, "hand_r") !== 0 || Bd.wielded(g) !== sword) fail("the weapon in the main hand came off with nothing to replace it");
      const dagger = { kind: "weapon", id: "dagger", ench: 0, known: true };
      g.inv.push(dagger);
      m.inventory.equip(game, dagger, g.inv.indexOf(dagger));
      game.invTab = "equipment"; game.eqSel = m.inventory.bodyRows(game).findIndex((r) => r.belt);
      const tb = m.inventory.inventoryKey(game, "Enter");
      if (Bd.belt(g) || !g.inv.includes(sword) || !(tb > 0)) fail(`the belt's sword to the pack: belt ${!!Bd.belt(g)}, in the pack ${g.inv.includes(sword)}, ${tb} s`);
      game.invTab = "pack";
    } finally { game.player = real; }
    if (writes.length) fail(`the inventory wrote base fields: ${[...new Set(writes)].join(", ")}`);
    stats.inventoryBaseWrites = writes.length;

    // The second finger and the folding rack's second back, filled from the Equipment tab: Enter on the empty part shows
    // the pack "for" it, and E there puts the thing on that part (E from the pack alone keeps the parent's one ring).
    {
      const q = fresh();
      q.license = { grade: 6 };
      IM.grantImplant(q, "foldingRack");
      const ra = { kind: "ring", id: "strength", ench: 1, known: true }, rb = { kind: "ring", id: "protection", ench: 1, known: true };
      const ca = { kind: "armour", id: "cloak", ench: 0, known: true }, cb = { kind: "armour", id: "cloak", ench: 0, known: true };
      q.inv.push(ra, rb, ca, cb);
      m.inventory.equip(game, ra, q.inv.indexOf(ra));
      m.inventory.equip(game, ca, q.inv.indexOf(ca));
      const putOn = (partId, it) => {
        game.invTab = "equipment"; game.eqSel = m.inventory.bodyRows(game).findIndex((r) => r.part?.id === partId);
        m.inventory.inventoryKey(game, "Enter");
        const chosen = game.invTab === "pack" && game.invFilter === "for" && q.inv[game.invSel] === it;
        const t = m.inventory.inventoryKey(game, "Enter");
        return chosen && t === RULES().body.equipTime && Bd.wornOn(q, partId) === it && game.invFilter === "all";
      };
      if (!putOn("finger_l", rb) || Bd.wornOn(q, "finger_r") !== ra) fail("the left finger can't be filled from the Equipment tab (or it pushed the right finger's ring off)");
      if (!putOn("back_2", cb) || Bd.wornOn(q, "back") !== ca) fail("the folding rack's second back can't be filled from the Equipment tab");
      game.invTab = "equipment"; game.eqSel = m.inventory.bodyRows(game).findIndex((r) => r.part?.id === "neck");
      game.messages = [];
      if (m.inventory.inventoryKey(game, "Enter") !== 0 || game.invTab !== "equipment" || !said(/Nothing in your pack goes on your neck/)) fail("Enter on an empty neck with no amulet in the pack wasn't told so");
      game.invTab = "pack";
    }
  });

  // --- 2. Implants ------------------------------------------------------------------------------------------------
  section("implants", () => {
    const at = { at: "cradle" };
    const withC = (fn) => IM.withTruing(game, at, fn);
    const reasons = {};
    const want = (what, got, reason) => { reasons[what] = got.reason || (got.ok ? "ok" : "?"); if ((got.reason || "ok") !== reason) fail(`implants, ${what}: ${got.reason || "ok"}, want ${reason}`); };
    let p = fresh();
    const crown = { kind: "implant", id: "lampCrown" };
    p.inv.push(crown);
    want("a ring", withC(() => IM.canInstall(game, p, { kind: "ring", id: "haste", ench: 1 }, "head")), "kind");
    want("no station", IM.canInstall(game, p, crown, "head"), "station");
    want("no socket (a finger)", withC(() => IM.canInstall(game, p, crown, "finger_r")), "part");
    want("the wrong part (feet)", withC(() => IM.canInstall(game, p, crown, "feet")), "slot");
    want("over the grade (plane-shunt, 6)", withC(() => IM.canInstall(game, p, { kind: "implant", id: "planeShunt" }, "head")), "grade");
    p.genotype = "bent";
    want("a Bent", withC(() => IM.canInstall(game, p, crown, "head")), "genotype");
    p.genotype = "plumb";
    // Fitting: the fee, the hour, out of the pack, the bonus; the same in both views.
    const fit = {};
    for (const view of ["map", "3d"]) {
      p = fresh({ view });
      const it = { kind: "implant", id: "lampCrown" };
      p.inv.push(it);
      const t0 = game.time, f0 = p.funds, torch0 = St.bonus(p, "torch");
      let seen = null;
      const off = m.events.on("install", (g, e) => { seen = e; });
      const r = withC(() => IM.install(game, p, it, "head"));
      off();
      fit[view] = { ok: r.ok, dt: game.time - t0, fee: f0 - p.funds, torch: +(St.bonus(p, "torch") - torch0).toFixed(3) };
      if (!r.ok || p.body.implants.head !== it || p.inv.includes(it) || !Bd.worn(p).includes(it)) fail(`${view}: install didn't put the lamp crown in (${r.reason})`);
      if (seen?.item !== it || seen?.partId !== "head") fail(`${view}: no install event`);
      if (IM.gradeUsed(p) !== 2 || IM.gradeFree(p) !== 0) fail(`${view}: grade ${IM.gradeUsed(p)} used, ${IM.gradeFree(p)} free (want 2, 0)`);
      want(`${view}: a second implant over the grade`, withC(() => IM.canInstall(game, p, { kind: "implant", id: "tallyEye" }, "face")), "grade");
    }
    if (!same(fit.map, fit["3d"]) || fit.map.dt !== IM.FITTING_TIME || fit.map.fee !== 50 || fit.map.torch !== 0.3) fail(`fitting: map ${JSON.stringify(fit.map)}, 3D ${JSON.stringify(fit["3d"])} (want 60 s, 50 glim, torch +0.3 in both)`);
    stats.fitting = fit;
    // Refusals that cost nothing: no purse, a hunt.
    p = fresh();
    const eye = { kind: "implant", id: "tallyEye" };
    p.inv.push(eye); p.funds = 10;
    const t0 = game.time;
    want("an empty purse", withC(() => IM.install(game, p, eye, "face")), "funds");
    p.funds = 500;
    const goblin = m.creatures.spawnCreature("goblin", Math.floor(p.x) + 2, Math.floor(p.y), p.z, { rng: () => 0.5, state: "chase", level: 3 });
    m.creatures.addCreature(game.zone, goblin);
    want("a hunt within reach", withC(() => IM.install(game, p, eye, "face")), "hunted");
    if (game.time !== t0 || p.funds !== 500 || !p.inv.includes(eye) || p.body.implants.face) fail("a refused fitting took time, glim or the implant");
    game.zone.creatures = game.zone.creatures.filter((c) => c !== goblin);
    // Taking out: the curse lock, the grade back, † destroyed, the folding rack's part.
    p = fresh();
    p.license = { grade: 12 };
    const heart = { kind: "implant", id: "glimHeart" }, rack = { kind: "implant", id: "foldingRack" }, eye2 = { kind: "implant", id: "levelEye" };
    p.inv.push(heart, rack, eye2);
    const hp0 = St.maxHp(p);
    withC(() => { IM.install(game, p, heart, "body"); IM.install(game, p, rack, "back"); IM.install(game, p, eye2, "face"); });
    if (St.maxHp(p) !== hp0 - 5) fail(`the glim heart: max HP ${St.maxHp(p)}, want ${hp0 - 5}`);
    if (!p.body.parts.some((q) => q.id === "back_2")) fail("the folding rack gave no second back");
    const cloak = { kind: "armour", id: "cloak", ench: 0, known: true };
    if (!Bd.equip(game, p, cloak, "back_2").ok) fail("no cloak on the second back");
    want("taking out without a station", IM.uninstall(game, p, "face"), "station");
    if (p.body.implants.face !== eye2) fail("the level-eye came out without a station");
    const u1 = withC(() => IM.uninstall(game, p, "face"));
    if (!u1.ok || u1.destroyed || !p.inv.includes(eye2) || IM.gradeUsed(p) !== 8) fail(`taking out the level-eye: ${JSON.stringify({ ok: u1.ok, destroyed: u1.destroyed })}, grade used ${IM.gradeUsed(p)} (want 8)`);
    const u2 = withC(() => IM.uninstall(game, p, "body"));
    if (!u2.ok || !u2.destroyed || p.inv.includes(heart) || St.maxHp(p) !== hp0) fail("the glim heart wasn't destroyed on removal, or max HP didn't come back");
    const u3 = withC(() => IM.uninstall(game, p, "back"));
    if (!u3.ok || p.body.parts.some((q) => q.id === "back_2") || !p.inv.includes(cloak) || !p.inv.includes(rack)) fail("taking out the folding rack: the part, the cloak or the rack went astray");
    // Plate grafts: three, one per part; a fourth refused even with a socket.
    p = fresh(); p.license = { grade: 20 };
    const grafts = [0, 1, 2, 3].map(() => ({ kind: "implant", id: "plateGraft" }));
    const rack2 = { kind: "implant", id: "foldingRack" };
    p.inv.push(...grafts, rack2);
    const av0 = St.av(p);
    withC(() => { IM.install(game, p, rack2, "back"); IM.install(game, p, grafts[0], "body"); IM.install(game, p, grafts[1], "head"); });
    want("a graft where the rack is", withC(() => IM.canInstall(game, p, grafts[2], "back")), "taken");
    withC(() => IM.uninstall(game, p, "back"));
    withC(() => IM.install(game, p, grafts[2], "back"));
    if (St.av(p) !== av0 + 3) fail(`three plate grafts: AV ${St.av(p)}, want ${av0 + 3}`);
    p.body.parts.push({ id: "head_2", type: "head", implant: true }); p.body.implants.head_2 = null;
    want("a fourth plate graft", withC(() => IM.canInstall(game, p, grafts[3], "head_2")), "twice");
    // The grade: 1 true-mark a grade up to 8, then 2.
    p = fresh(); p.credits = 12;
    const grades = [];
    while (IM.raiseGrade(game, p).ok) grades.push(`${IM.gradeOf(p)}:${p.credits}`);
    if (IM.gradeOf(p) !== 11 || p.credits !== 0) fail(`12 true-marks from grade 2: grade ${IM.gradeOf(p)}, ${p.credits} left (want 11, 0): ${grades.join(" ")}`);
    stats.grades = grades.join(" ");
    p.genotype = "bent";
    if (IM.raiseGrade(game, p).reason !== "genotype") fail("a Bent raised a grade");
    // True-marks on the floor; the starting implant.
    p = fresh();
    game.zone.items.push(I.makeItem({ kind: "credit", count: 2 }, p.x, p.y, p.z));
    I.pickUpItems(game);
    if (p.credits !== 2 || p.inv.some((x) => x.kind === "credit")) fail(`walking over 2 true-marks: ${p.credits} counted`);
    const t1 = game.time, f1 = p.funds;
    const granted = IM.grantImplant(p, "springTendons");
    if (!granted || p.body.implants.feet !== granted || game.time !== t1 || p.funds !== f1 || St.bonus(p, "jump") !== 1) fail("grantImplant: not free, not instant, or no +1 jump");
    // Abilities from implants.
    p = fresh(); p.license = { grade: 10 };
    const shunt = { kind: "implant", id: "planeShunt" };
    p.inv.push(shunt);
    withC(() => IM.install(game, p, shunt, "head"));
    const ab = m.abilities.abilitiesOf(p).find((a) => a.id === "planeShunt");
    if (ab?.source !== "implant" || ab.item !== shunt) fail(`the plane-shunt's ability: ${JSON.stringify(ab)}`);
    if (!m.abilities.activate(game, p, "planeShunt", null) || !m.status.hasStatus(p, "flat")) fail("the plane-shunt didn't make you Flat");
    // The Truing Cradle block: walking into it on the map, E in 3D; the screen fits and takes out by keys.
    for (const view of ["map", "3d"]) {
      p = fresh({ view });
      const zone = game.zone, tx = Math.floor(p.x), ty = Math.floor(p.y);
      const spot = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([dx, dy]) => !zone.solid(tx + dx, ty + dy, p.z) && zone.stand[tx + dx + (ty + dy) * zone.w] === p.z);
      if (!spot) { fail(`${view}: no floor next to the start for a Cradle`); continue; }
      const [cx, cy] = [tx + spot[0], ty + spot[1]];
      zone.set(cx, cy, p.z, m.stations.CRADLE); zone.set(cx, cy, p.z + 1, m.stations.CRADLE); zone.refresh();
      Object.assign(p, { x: tx + 0.5, y: ty + 0.5, yaw: Math.atan2(spot[1], spot[0]), pitch: -0.15 });
      const it = { kind: "implant", id: "darkLens" };
      p.inv.push(it);
      const t2 = game.time;
      if (view === "map") m.interact.useColumn(game, cx, cy); else m.interact.interact(game);
      if (game.mode !== "truing") { fail(`${view}: the Cradle opened ${game.mode}, not the Cradle screen`); continue; }
      const rows = m.equipment.truingRows(game), k = rows.findIndex((r) => r.kind === "pack" && r.item === it);
      const data = m.screens.modeData(game);
      data.list.sel = k;
      m.keys.dispatchKey(game, "Enter", false, "");
      if (p.body.implants.face !== it || game.time - t2 < IM.FITTING_TIME) fail(`${view}: Enter on the dark lens in the Cradle: ${p.body.implants.face ? "in" : "not in"}, ${game.time - t2} s`);
      data.list.sel = m.equipment.truingRows(game).findIndex((r) => r.kind === "socket" && r.part.id === "face");
      m.keys.dispatchKey(game, "Enter", false, "");
      if (p.body.implants.face || !p.inv.includes(it)) fail(`${view}: Enter on the face socket didn't take the dark lens out`);
      m.keys.dispatchKey(game, "Escape", false, "");
      if (game.mode !== (view === "map" ? "map" : "explore")) fail(`${view}: Esc left the Cradle for ${game.mode}`);
      p.genotype = "bent";
      game.messages = [];
      if (m.interact.useColumn(game, cx, cy) || game.mode === "truing" || !said(/Plumb/)) fail(`${view}: a Bent at the Cradle wasn't turned away`);
    }
    // A surgeon: the services as the shop runs them (pay, run, done).
    p = fresh();
    const surgeon = { name: "Detail C", merchant: { services: m.stations.SERVICES } };
    const leg = { kind: "implant", id: "springTendons" };
    p.inv.push(leg);
    const rows = m.talk.servicesFor(game, surgeon);
    const fitRow = rows.find((r) => r.id === "fitImplant" && r.target.item === leg);
    if (!fitRow) fail(`the surgeon offers no fitting of the spring tendons (${rows.map((r) => r.id).join(", ")})`);
    else {
      const s = m.talk.serviceDef("fitImplant"), price = s.price(game, surgeon, fitRow.target), f0 = p.funds;
      m.currency.pay(game, p, price); s.run(game, surgeon, fitRow.target);
      if (price !== 50 || p.body.implants.feet !== leg || p.funds !== f0 - 50) fail(`the surgeon's fitting: ${price} glim, fitted ${!!p.body.implants.feet}, paid ${f0 - p.funds}`);
      const out = m.talk.servicesFor(game, surgeon).find((r) => r.id === "removeImplant" && r.target.partId === "feet");
      m.talk.serviceDef("removeImplant").run(game, surgeon, out.target);
      if (p.body.implants.feet || !p.inv.includes(leg)) fail("the surgeon didn't take the tendons out");
    }
    // A save round trip.
    p = fresh(); p.license = { grade: 8 }; p.credits = 3;
    const r1 = { kind: "implant", id: "foldingRack" }, r2 = { kind: "implant", id: "levelEye" };
    p.inv.push(r1, r2, AR.makeArtifact("echoBell", () => 0.5));
    withC(() => { IM.install(game, p, r1, "back"); IM.install(game, p, r2, "face"); });
    const back = m.codec.decodePlayer(JSON.parse(JSON.stringify(m.codec.encodePlayer(p))));
    const problemsJson = m.codec.jsonProblems(m.codec.encodePlayer(p), "player");
    if (problemsJson.length || back.body.implants.face?.id !== "levelEye" || !back.body.parts.some((q) => q.id === "back_2") || IM.gradeOf(back) !== 8
        || back.credits !== 3 || IM.gradeUsed(back) !== 5 || back.inv.find((x) => x.kind === "artifact")?.cell?.charge !== p.inv.find((x) => x.kind === "artifact").cell.charge)
      fail(`a save round trip lost implants, grade, true-marks or a cell (${problemsJson.join("; ")})`);
    stats.implants = { implants: Object.keys(m.implantTable).length, refusals: reasons };
  });

  // --- 3. Identify odds ------------------------------------------------------------------------------------------
  section("identify", () => {
    const p = fresh();
    const N = 20000, rows = [];
    let worst = 0;
    // A bonus to examine through the stat bus (as a tally-eye or a monocle would give): a status of the check's own.
    if (!m.status.STATUS_DEFS.checkWs5Examine) m.status.registerStatus("checkWs5Examine", { t: 10, bonus: (s) => ({ examine: s.mag }) });
    for (const [int, extra] of [[10, 0], [16, 0], [16, 2], [22, 3]]) {
      p.attrs.int = int;
      m.status.removeStatus(game, p, "checkWs5Examine");
      if (extra) m.status.addStatus(game, p, "checkWs5Examine", { t: 1e9, mag: extra });
      St.invalidateStats(p);
      const b = Math.floor((int - 16) / 2) + extra;
      if (AR.examineBonus(p) !== b) fail(`examine bonus at INT ${int} +${extra}: ${AR.examineBonus(p)}, want ${b}`);
      for (const id of Object.keys(m.artifactTable)) {
        const def = m.artifactTable[id], dc = 8 + 2 * def.complexity;
        // The formula, worked out here: each face of the d20.
        let wk = 0, wp = 0, wb = 0;
        for (let nat = 1; nat <= 20; nat++) { const miss = dc - nat - b; if (miss <= 0) wk++; else if (miss <= 5 || def.sturdy) wp++; else wb++; }
        const exp = { known: wk / 20, partial: wp / 20, broke: wb / 20 };
        const tally = { known: 0, partial: 0, broke: 0 };
        const rng = m.rng.makeRng(1000 + def.complexity * 31 + int);
        for (let k = 0; k < N; k++) {
          const it = { kind: "artifact", id, known: false, cell: null };
          const r = AR.examineArtifact(game, p, it, rng);
          if (r.broke) tally.broke++; else if (r.known === true) tally.known++; else if (r.known === "class") tally.partial++;
        }
        const got = { known: tally.known / N, partial: tally.partial / N, broke: tally.broke / N };
        for (const k of ["known", "partial", "broke"]) {
          const d = Math.abs(got[k] - exp[k]);
          worst = Math.max(worst, d);
          if (d > 0.02) fail(`identify ${id} (complexity ${def.complexity}) at INT ${int} +${extra}: ${k} ${got[k].toFixed(4)}, formula ${exp[k].toFixed(4)}`);
        }
        const ex = AR.identifyChance(p, { id });
        if (!same(ex, exp)) fail(`identifyChance(${id}, INT ${int} +${extra}) = ${JSON.stringify(ex)}, the formula ${JSON.stringify(exp)}`);
        if (def.sturdy && tally.broke) fail(`${id} is sturdy but broke ${tally.broke} times`);
        if (int === 16 && extra === 0) rows.push(`${id} c${def.complexity}: ${(got.known * 100).toFixed(1)}/${(got.partial * 100).toFixed(1)}/${(got.broke * 100).toFixed(1)}% (formula ${(exp.known * 100).toFixed(0)}/${(exp.partial * 100).toFixed(0)}/${(exp.broke * 100).toFixed(0)})`);
      }
    }
    stats.identify = { tries: N, worstDiff: +worst.toFixed(4), int16: rows };
    // A broken one stays broken; a known one is known; the tinker's service has no risk.
    const it = { kind: "artifact", id: "stillDial", known: false, cell: null };
    AR.examineArtifact(game, p, it, () => 0);   // a natural 1 on complexity 7
    if (!it.broken || AR.examineArtifact(game, p, it, () => 0.99).ok) fail("a broken still-dial could be identified");
    const tinker = { name: "Old Ottilie", merchant: { services: m.stations.SERVICES } };
    const art = { kind: "artifact", id: "lancet", known: false, cell: null };
    p.inv.push(art);
    const row = m.talk.servicesFor(game, tinker).find((r) => r.id === "identifyArtifact" && r.target === art);
    const price = row && m.talk.serviceDef("identifyArtifact").price(game, tinker, art);
    if (!row || price !== 50) fail(`the tinker's identification of a lancet: ${row ? price : "not offered"} (want 50 glim)`);
    else { m.talk.serviceDef("identifyArtifact").run(game, tinker, art); if (art.known !== true || art.broken) fail("the tinker's identification didn't identify"); }
  });

  // --- 4. Examine from an inspect event --------------------------------------------------------------------------
  section("examine", () => {
    const p = fresh();
    const zone = game.zone, tx = Math.floor(p.x) + 1, ty = Math.floor(p.y);
    const goblin = m.creatures.spawnCreature("goblin", tx, ty, p.z, { rng: () => 0.5, state: "idle", level: 4 });
    m.creatures.addCreature(zone, goblin);
    zone.seen[tx + ty * zone.w] = 1;
    zone.sightings.set(goblin.id, { x: goblin.x, y: goblin.y, glyph: goblin.glyph, color: goblin.color, name: goblin.name, time: game.time });
    zone.items.push(I.makeItem({ kind: "ring", id: "protection", ench: 1, known: true }, tx + 0.5, ty + 0.5, p.z));
    m.events.emit(game, "inspect", m.renderMap.inspectAt(game, { x: tx, y: ty }, false));
    if (game.mode !== "map") fail(`inspect with open: false opened ${game.mode}`);
    m.events.emit(game, "inspect", m.renderMap.inspectAt(game, { x: tx, y: ty }, true));
    const data = m.screens.modeData(game);
    if (game.mode !== "examine" || data?.subjects?.length !== 2) fail(`inspect with open: true: ${game.mode}, ${data?.subjects?.length} subjects (want examine, 2)`);
    const text = () => { m.capture.chars = []; game.debug.draw(); return m.capture.chars.join(""); };
    const t1 = text();
    if (!/goblin, level 4/i.test(t1) || !/(unhurt|scratched|hurt)/.test(t1)) fail("the examine screen doesn't name the goblin, its level and its health band");
    if (/Health \d+ of \d+/.test(t1)) fail("exact numbers without a level-eye");
    m.keys.dispatchKey(game, "Tab", false, "");
    if (!/ring of protection/i.test(text()) || !/armour/i.test(text())) fail("Tab didn't show the ring and its bonus");
    m.keys.dispatchKey(game, "Escape", false, "");
    if (game.mode !== "map") fail(`Esc left examine for ${game.mode}`);
    // A level-eye reads the numbers.
    p.body.implants.face = { kind: "implant", id: "levelEye" }; St.invalidateStats(p);
    m.events.emit(game, "inspect", m.renderMap.inspectAt(game, { x: tx, y: ty }, true));
    if (!/Health \d+ of \d+ · AV \d+ · DV \d+/.test(text())) fail("a level-eye doesn't show exact health, AV and DV");
    m.keys.dispatchKey(game, "Escape", false, "");
    // A 3D-style payload (WS8's look): a block in the crosshair.
    game.mode = "explore"; game.view = "3d";
    m.events.emit(game, "inspect", { zone, x: tx, y: ty, z: p.z, block: m.world.B.STONE, open: true });
    if (game.mode !== "examine" || !/stone wall/i.test(text())) fail(`a 3D payload with a block: ${game.mode}`);
    m.keys.dispatchKey(game, "Escape", false, "");
    if (game.mode !== "explore") fail(`Esc after a 3D look left for ${game.mode}`);
    // L in the inventory.
    game.mode = "map"; game.view = "map"; game.modeStack = [];
    game.debug.openInv();
    game.invSel = 0;
    m.keys.dispatchKey(game, "KeyL", false, "l");
    if (game.mode !== "examine" || !/Worth about \d+ glim/.test(text())) fail(`L in the pack: ${game.mode}, or the examine screen is empty (no price line)`);
    m.keys.dispatchKey(game, "Escape", false, "");
    if (game.mode !== "inventory") fail(`Esc from examine went to ${game.mode}, not back to the inventory`);
    m.keys.dispatchKey(game, "Escape", false, "");
    stats.examine = "map tile (creature, item), 3D block, a level-eye, L from the pack";
  });

  // --- 5. Artifacts and cells in both views ---------------------------------------------------------------------
  section("artifacts", () => {
    const out = {};
    const known = (id, charge = 2500) => ({ kind: "artifact", id, known: true, cell: charge === null ? null : { id: "glim", charge } });
    // A hole near the player (carved, as a potion of descent's splash does) for the finders.
    const carveHole = (p) => {
      const zone = game.zone, tx = Math.floor(p.x) + 2, ty = Math.floor(p.y);
      zone.set(tx, ty, 0, m.world.B.AIR); zone.set(tx, ty, m.world.FLOOR_Z - 1, m.world.B.AIR); zone.refresh();
      zone.holeSeen[tx + ty * zone.w] = 0;
      return tx + ty * zone.w;
    };
    const hostileAhead = (p, d = 3) => {
      const c = m.creatures.spawnCreature("goblin", Math.floor(p.x + Math.cos(p.yaw) * d), Math.floor(p.y + Math.sin(p.yaw) * d), p.z, { rng: () => 0.5, state: "idle", level: 2 });
      m.creatures.addCreature(game.zone, c);
      // In 3D the crosshair is put on it, as a player would (the eye is above its middle).
      if (game.view !== "map") p.pitch = Math.atan2(c.z + (c.h || 1) * 0.6 - (p.z + m.player.EYE), Math.hypot(c.x - p.x, c.y - p.y));
      game.zone.sightings.set(c.id, { x: c.x, y: c.y, glyph: c.glyph, color: c.color, name: c.name, time: game.time });
      return c;
    };
    const lineEast = (p) => {   // stand where 6 tiles east are open floor at the same height
      const zone = game.zone;
      for (let y = 2; y < zone.d - 2; y++)
        for (let x = 2; x < zone.w - 9; x++) {
          let ok = true;
          for (let k = 0; k <= 6 && ok; k++) { const i = x + k + y * zone.w; if (zone.stand[i] !== zone.stand[x + y * zone.w] || zone.stand[i] < 0 || zone.solid(x + k, y, zone.stand[i] + 1)) ok = false; }
          if (ok) { Object.assign(p, { x: x + 0.5, y: y + 0.5, z: zone.stand[x + y * zone.w], yaw: 0, pitch: 0, vz: 0 }); return true; }
        }
      return false;
    };
    for (const view of ["map", "3d"]) {
      const r = (out[view] = {});
      const use = (it) => {   // E in the pack, then the target as the screen would ask for it
        const p = game.player;
        p.inv.push(it);
        const t = AR.useArtifact(game, p, it);
        if (t && typeof t === "object" && t.aim) { AR.aimArtifact(game, p, t.aim); return "aimed"; }
        return t;
      };
      // Finders and the bell.
      let p = fresh({ view, depth: 4 });
      const hole = carveHole(p);
      use(known("plumbBob", null));
      r.plumbBob = game.zone.holeSeen[hole] === 1;
      p = fresh({ view, depth: 4 });
      const hole2 = carveHole(p), qs = known("quicksilverLevel", null);
      use(qs);
      r.quicksilver = game.zone.holeSeen[hole2] === 1 && !p.inv.includes(qs);
      p = fresh({ view, depth: 4 });
      const seen0 = game.zone.seen.reduce((s, v) => s + v, 0), bell = known("echoBell", 500);
      use(bell);
      r.echoBell = { revealed: game.zone.seen.reduce((s, v) => s + v, 0) - seen0, charge: bell.cell.charge };
      // Aimed ones: a goblin ahead (the map's requestTarget picks the nearest hostile in sight; 3D aims the crosshair).
      p = fresh({ view, depth: 4 });
      if (!lineEast(p)) { fail(`${view}: no straight run of floor for the aimed artifacts`); continue; }
      const g1 = hostileAhead(p), hp1 = g1.hp, f1 = p.funds;
      use(known("glimgun", null));
      r.glimgun = { hurt: hp1 - g1.hp, paid: f1 - p.funds };
      p = fresh({ view, depth: 4 }); lineEast(p);
      const g2 = hostileAhead(p, 2), g3 = hostileAhead(p, 5), lance = known("lancet");
      const h2 = g2.hp, h3 = g3.hp;
      use(lance);
      r.lancet = { hit: (h2 > g2.hp) + (h3 > g3.hp), charge: lance.cell.charge };
      p = fresh({ view, depth: 4 }); lineEast(p);
      const g5 = hostileAhead(p, 4), h5 = g5.hp, wx = Math.floor(p.x) + 2, wy = Math.floor(p.y);
      game.zone.set(wx, wy, p.z, m.world.B.STONE); game.zone.set(wx, wy, p.z + 1, m.world.B.STONE); game.zone.refresh();
      use(known("lancet"));
      r.lancetWall = g5.hp === h5;   // a wall between: the beam stops at it
      p = fresh({ view, depth: 4 }); lineEast(p);
      hostileAhead(p, 6);   // (something to aim at, beyond the knife's 4 tiles: on the map, abilities.js's P0 stub aims at it)
      const x0 = p.x, knife = known("foldKnife");
      use(knife);
      r.foldKnife = { moved: +(p.x - x0).toFixed(2), charge: knife.cell.charge };
      // Nothing in sight on the map: an aimed artifact is lowered, nothing paid (in 3D the crosshair always gives a point).
      if (view === "map") {
        p = fresh({ view, depth: 4 }); lineEast(p);
        const f0 = p.funds, gun = known("glimgun", null), lc = known("lancet");
        use(gun); use(lc);
        r.noTarget = p.funds === f0 && lc.cell.charge === 2500;
      } else r.noTarget = true;
      p = fresh({ view, depth: 4 }); lineEast(p);
      const bead = known("recallBead"), home = [p.x, p.y];
      use(bead);
      p.inv.splice(p.inv.indexOf(bead), 1);
      p.x += 3;
      use(bead);
      r.recallBead = { back: Math.hypot(p.x - home[0], p.y - home[1]) < 1.5, charge: bead.cell.charge };
      p = fresh({ view, depth: 4 }); lineEast(p);
      const g4 = hostileAhead(p);
      use(known("stillDial"));
      r.stillDial = m.status.hasStatus(g4, "stilled");
      // The lantern-mote: on, its light, the drain, out when empty.
      p = fresh({ view, depth: 4 });
      const mote = known("lanternMote", 100), torch0 = St.bonus(p, "torch");
      use(mote);
      const lit = +(St.bonus(p, "torch") - torch0).toFixed(3);
      m.time.skipTime(game, 300, { interruptible: false });
      const left = mote.cell.charge;
      m.time.skipTime(game, 400, { interruptible: false });
      r.lanternMote = { lit, after300s: +left.toFixed(1), outWhenEmpty: !mote.on && St.bonus(p, "torch") === torch0 };
    }
    const w = (v, ok) => (ok ? null : v);
    for (const view of ["map", "3d"]) {
      const r = out[view];
      const bad = [
        w("plumb-bob", r.plumbBob), w("quicksilver level", r.quicksilver), w("echo-bell", r.echoBell.revealed > 0 && r.echoBell.charge === 400),
        w("glimgun", r.glimgun.hurt > 0 && r.glimgun.paid === 1), w("lancet", r.lancet.hit === 2 && r.lancet.charge === 2250), w("lancet (stopped by a wall)", r.lancetWall),
        w("fold-knife", r.foldKnife.moved > 2 && r.foldKnife.moved <= 4.6 && r.foldKnife.charge === 2200), w("recall bead", r.recallBead.back && r.recallBead.charge === 1500),
        w("still-dial", r.stillDial), w("no target: nothing paid", r.noTarget), w("lantern-mote", r.lanternMote.lit === 0.4 && r.lanternMote.after300s === 50 && r.lanternMote.outWhenEmpty),
      ].filter(Boolean);
      if (bad.length) fail(`${view}: ${bad.join(", ")} didn't do what it says: ${JSON.stringify(r)}`);
    }
    stats.artifacts = out;
    // A running lantern-mote that leaves the pack takes its light with it: dropped (X), at once; gone another way
    // (sold, say), by the next tick of the clock. A save of the player with it running is plain JSON.
    {
      const p = fresh({ depth: 4 });
      const mote = known("lanternMote", 500), torch0 = St.bonus(p, "torch");
      p.inv.push(mote);
      AR.useArtifact(game, p, mote);
      if (m.codec.jsonProblems(m.codec.encodePlayer(p), "player").length) fail("a player with a lantern-mote running doesn't save as JSON");
      try {   // (the stat cache unverified here: a stale one shows as the old bonus)
        St.bonus(p, "torch");
        game.debug.openInv(); game.invSel = p.inv.indexOf(mote);
        m.inventory.inventoryKey(game, "KeyX");
        const dropped = game.zone.items.find((x) => x.kind === "artifact" && x.id === "lanternMote");
        if (St.bonus(p, "torch") !== torch0 || dropped?.on) fail(`a dropped lantern-mote: torch bonus ${St.bonus(p, "torch")} (want ${torch0}), on the floor ${dropped?.on ? "still on" : "off"}`);
        m.keys.dispatchKey(game, "Escape", false, "");
        const mote2 = known("lanternMote", 500);
        p.inv.push(mote2);
        AR.useArtifact(game, p, mote2);
        p.inv.splice(p.inv.indexOf(mote2), 1);
        m.time.skipTime(game, 1, { interruptible: false });
        if (St.bonus(p, "torch") !== torch0) fail(`a lantern-mote taken out of the pack still lights you a tick later (torch bonus ${St.bonus(p, "torch")})`);
      } catch (err) { fail(`a lantern-mote leaving the pack: ${err.message}`); }
    }
    // Cells: loaded from the pack, filled from the purse, sun and dark recharging exactly over any split.
    let p = fresh({ depth: 4 });
    const bell = { kind: "artifact", id: "echoBell", known: true, cell: { id: "glim", charge: 20 } };
    const spare = { kind: "cell", id: "dark", charge: 900 };
    p.inv.push(bell, spare);
    AR.useArtifact(game, p, bell);
    if (bell.cell.id !== "dark" || bell.cell.charge !== 800 || !p.inv.some((c) => c.kind === "cell" && c.id === "glim" && c.charge === 20)) fail(`loading a cell: ${JSON.stringify(bell.cell)}, the old one ${JSON.stringify(p.inv.filter((c) => c.kind === "cell"))}`);
    const glimCell = p.inv.find((c) => c.kind === "cell" && c.id === "glim");
    p.funds = 100;
    const paid = AR.fillCell(game, p, glimCell);
    if (paid !== 25 || glimCell.charge !== 2500 || p.funds !== 75) fail(`filling a glim cell with 20 charge: ${paid} glim, ${glimCell.charge} charge`);
    const sun = { kind: "cell", id: "sun", charge: 0 }, dark = { kind: "cell", id: "dark", charge: 0 };
    const recharge = (steps, each, torch, surface) => {
      p = fresh({ depth: 4 });
      if (surface) { game.zone.outdoor = true; game.zone.lightless = false; }
      p.torch = torch;
      const s = { ...sun }, d = { ...dark };
      p.inv.push(s, d);
      const t0 = game.time;
      for (let k = 0; k < steps; k++) AR.rechargeCells(game, p, t0 + k * each, t0 + (k + 1) * each);
      return [s.charge, d.charge];
    };
    // The plumb-line ear marks a hidden pit within 6 tiles as time passes, in either view.
    for (const view of ["map", "3d"]) {
      p = fresh({ view, depth: 4 });
      const hole = carveHole(p);
      IM.grantImplant(p, "plumbEar");
      if (view === "map") m.time.skipTime(game, 1, { interruptible: false }); else game.debug.step(1 / 30);
      if (game.zone.holeSeen[hole] !== 1) fail(`${view}: the plumb-line ear didn't mark a pit 2 tiles away`);
    }
    const one = recharge(1, 600, false, false), split = recharge(10, 60, false, false);
    if (!same(one, split) || one[1] !== 500 || one[0] !== 0) fail(`a dark cell over 600 s underground with the torch out: one step ${one}, ten steps ${split} (want [0, 500])`);
    stats.cells = { darkOver600s: one[1], glimFill: paid };
  });

  // --- 6. The pack screen -------------------------------------------------------------------------------------------
  section("pack screen", () => {
    const p = fresh();
    p.inv.length = 0;
    for (let k = 0; k < 60; k++) p.inv.push(k % 3 === 0 ? { kind: "weapon", id: "dagger", ench: 0, known: true, props: [], tag: k }
                                           : k % 3 === 1 ? { kind: "potion", effect: Object.keys(I.POTIONS)[k % 10], count: 1 } : { kind: "artifact", id: "plumbBob", known: k % 2 === 0, cell: null });
    // (Potions of one effect stack in the game; here each is its own entry, as 60 rows.)
    const rowsAt = {};
    for (const [cols, rows] of [[100, 30], [180, 56]]) {
      m.resize(cols, rows);
      game.mode = "map"; game.view = "map"; game.modeStack = [];
      game.debug.openInv();
      const text = () => { game.debug.draw(); return m.capture.chars.join(""); };
      const name = (i) => I.itemName(game, p.inv[i]);
      game.invSel = 0;
      let t = text();
      if (!t.includes("I close")) fail(`${cols}×${rows}: "I close" isn't on screen`);
      for (let k = 0; k < 59; k++) m.keys.dispatchKey(game, "ArrowDown", false, "");
      t = text();
      const top = game.invTop;
      if (game.invSel !== 59 || top <= 0) fail(`${cols}×${rows}: after 59 × ↓ the selection is ${game.invSel}, the list's top ${top}`);
      m.keys.dispatchKey(game, "Home", false, "");
      text();
      if (game.invSel !== 0 || game.invTop !== 0) fail(`${cols}×${rows}: Home: selection ${game.invSel}, top ${game.invTop}`);
      m.keys.dispatchKey(game, "PageDown", false, "");
      const page = game.invSel;
      text();
      if (!(page > 1)) fail(`${cols}×${rows}: PgDn moved the selection to ${page}`);
      rowsAt[`${cols}x${rows}`] = { page: game.invPage, topAt59: top };
      // The filter: potions only.
      for (let k = 0; k < 6 && game.invFilter !== "potions"; k++) m.keys.dispatchKey(game, "KeyF", false, "f");
      t = text();
      if (game.invFilter !== "potions" || p.inv[game.invSel]?.kind !== "potion" || /dagger/.test(t.slice(0, t.indexOf("I close")))) fail(`${cols}×${rows}: the potions filter (${game.invFilter}) shows other things`);
      m.keys.dispatchKey(game, "KeyF", false, "f");
      while (game.invFilter !== "all") m.keys.dispatchKey(game, "KeyF", false, "f");
      // The Equipment tab.
      m.keys.dispatchKey(game, "Tab", false, "");
      t = text();
      if (game.invTab !== "equipment" || !t.includes("Right hand") || !t.includes("Feet") || !t.includes("Belt")) fail(`${cols}×${rows}: Tab didn't show the Equipment tab with every part`);
      m.keys.dispatchKey(game, "Tab", false, "");
      m.keys.dispatchKey(game, "Escape", false, "");
      if (game.mode !== "map") fail(`${cols}×${rows}: Esc left the inventory for ${game.mode}`);
      void name;
    }
    m.resize(180, 56);
    stats.pack = { items: 60, ...rowsAt };
    // The parent's keys answer as they did.
    const q = fresh();
    game.debug.openInv();
    const answers = [m.inventory.inventoryKey(game, "ArrowDown"), m.inventory.inventoryKey(game, "KeyT"), m.inventory.inventoryKey(game, "KeyI")];
    game.invSel = 0;
    const drink = m.inventory.inventoryKey(game, "Enter");
    if (!same(answers, [0, "throw", null]) || drink !== RULES().body.drinkTime) fail(`the parent's keys: ${JSON.stringify(answers)}, drinking ${drink}`);
    // G picks up what you just dropped (walking over it doesn't, until you've stepped away).
    game.modeStack = []; game.mode = "map";
    const knife = I.makeItem({ kind: "knife", count: 1 }, q.x, q.y, q.z);
    knife.dropped = true;
    game.zone.items.push(knife);
    const n0 = q.inv.find((x) => x.kind === "knife")?.count || 0;
    I.pickUpItems(game);
    const left = game.zone.items.includes(knife);
    m.keys.dispatchKey(game, "KeyG", false, "g");
    if (!left || game.zone.items.includes(knife) || (q.inv.find((x) => x.kind === "knife")?.count || 0) !== n0 + 1) fail("G didn't pick up the knife you'd just dropped");
    // A filter hiding what game.invSel points at: E does nothing to it; dropping the filter's last thing goes back to
    // everything, with the selection on something shown.
    {
      const r = fresh();
      r.inv.length = 0;
      r.inv.push({ kind: "potion", effect: "healing", count: 1 }, { kind: "scroll", effect: "teleport", count: 1 });
      game.debug.openInv();
      game.invFilter = "potions"; game.invSel = 1;
      const hidden = m.inventory.inventoryKey(game, "Enter");
      if (hidden !== 0 || r.inv.length !== 2) fail(`E under the potions filter read the hidden scroll (${hidden} s, ${r.inv.length} things left)`);
      game.invSel = 0;
      m.inventory.inventoryKey(game, "KeyX");
      if (game.invFilter !== "all" || r.inv[game.invSel]?.kind !== "scroll") fail(`dropping the last potion under its filter: filter ${game.invFilter}, selected ${r.inv[game.invSel]?.kind}`);
      m.keys.dispatchKey(game, "Escape", false, "");
    }
  });

  // --- 7. The consumable effects table ---------------------------------------------------------------------------
  section("effects table", () => {
    const E = m.effects;
    const missing = [...Object.keys(I.POTIONS).filter((k) => !E.DRINK[k]), ...Object.keys(I.SCROLLS).filter((k) => !E.READ[k])];
    for (const k of ["poison", "paralysis", "darkness", "shadows", "descent", "healing", "haste"]) if (!E.SPLASH[k]) missing.push(`splash ${k}`);
    if (missing.length) fail(`effects with no entry: ${missing.join(", ")}`);
    let threw = false;
    try { E.registerEffect("pour", "x", () => {}); } catch { threw = true; }
    if (!threw) fail("registerEffect took a table that doesn't exist");
    stats.effects = { drink: Object.keys(E.DRINK).length, read: Object.keys(E.READ).length, splash: Object.keys(E.SPLASH).length };
  });

  // --- 8. The inventory in check-screen-frames' 8 states ----------------------------------------------------------
  // Those frames aren't compared with p0-0c any more (screen-frames.js NOT_COMPARED): the same states here, held to
  // what the rebuilt screen must show (seeds 99 and 31, depths 3 and 11, 3D and the map, after statuses and messages).
  section("screen-frames' inventory states", () => {
    let shown = 0;
    m.resize(180, 56);
    for (const seed of [99, 31])
      for (const depth of [3, 11]) {
        m.seedRandom(seed * 100 + depth);
        startRun(seed);
        const st = game.run.world.start;
        game.pages = null; game.pendingPages = null; game.story.cube = true;
        game.debug.enterZone(`${st.wx},${st.wy},${depth}`, "down");
        const p = game.player;
        for (const view of ["3d", "map"]) {
          const tag = `seed ${seed} depth ${depth} ${view} inventory`;
          game.modeStack = []; game.mode = view === "3d" ? "explore" : "map"; game.view = view; game.paused = false; p.yaw = 0.7; p.pitch = -0.1;
          for (let k = 0; k < 2; k++) game.debug.step(1 / 60);
          for (const id of ["hasted", "poisoned", "shadowed"]) m.status.addStatus(game, p, id, { t: 30 });
          game.log("A test line in the log.", [200, 200, 200]);
          game.invFilter = "all";   // (the filter is remembered between openings: these states show everything)
          game.debug.openInv();
          const text = () => { game.debug.draw(); return m.capture.chars.join(""); };
          let t = text();
          const names = p.inv.map((it) => I.itemName(game, it) + (it.count > 1 ? ` x${it.count}` : ""));
          const head = `LV ${p.level} · STR ${St.attr(p, "str")} · HP ${p.hp}/${St.maxHp(p)}`;
          const missing = [game.mode === "inventory" ? null : `mode ${game.mode}`, t.includes("INVENTORY") ? null : "title",
            t.includes("[ PACK ]") ? null : "the Pack tab", t.includes(head) ? null : `"${head}"`, t.includes(`(${p.inv.length} of ${p.inv.length})`) ? null : "the count",
            t.includes("I close") ? null : "I close", ...names.filter((n) => !t.includes(n)).map((n) => `"${n}"`)].filter(Boolean);
          m.keys.dispatchKey(game, "Tab", false, "");
          t = text();
          const w = Bd.wielded(p);
          if (!t.includes("[ EQUIPMENT ]") || !t.includes("Right hand") || (w && !t.includes(I.itemName(game, w)))) missing.push("the Equipment tab with your weapon");
          m.keys.dispatchKey(game, "Escape", false, "");
          if (game.mode !== (view === "3d" ? "explore" : "map")) missing.push(`Esc went to ${game.mode}`);
          if (missing.length) fail(`${tag}: ${missing.join(", ")}`);
          else shown++;
        }
      }
    stats.screenFrameStates = `${shown} of 8 inventory states show the pack, the header, the tabs and I close`;
  });

  function RULES() { return m.rules.RULES; }
  return { name: "items", ok: problems.length === 0, problems, stats };
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser).
export async function run(env) {
  const { S, capture, resize } = await env.screen({ cols: 180, rows: 56 });
  const m = { S, capture, resize, seedRandom: env.seedRandom };
  const load = async (key, path) => { m[key] = await env.src(path); };
  await Promise.all([
    load("game", "game.js"), load("items", "items.js"), load("body", "body.js"), load("stats", "stats.js"), load("inventory", "inventory.js"),
    load("implants", "bodymods/implants.js"), load("artifacts", "bodymods/artifacts.js"), load("stations", "bodymods/stations.js"),
    load("equipment", "screens/equipment.js"), load("examine", "screens/examine.js"), load("screens", "screens.js"), load("keys", "keys.js"),
    load("events", "events.js"), load("renderMap", "renderMap.js"), load("interact", "interact.js"), load("talk", "talk.js"),
    load("currency", "currency.js"), load("creatures", "creatures.js"), load("world", "world.js"), load("rules", "rules.js"),
    load("status", "status.js"), load("abilities", "abilities.js"), load("codec", "save/codec.js"), load("rng", "rng.js"),
    load("time", "time.js"), load("effects", "effects.js"), load("player", "player.js"),
  ]);
  m.implantTable = (await env.src("content/items/implants.js")).IMPLANTS;
  m.artifactTable = (await env.src("content/items/artifacts.js")).ARTIFACTS;
  return checkItems(m);
}
