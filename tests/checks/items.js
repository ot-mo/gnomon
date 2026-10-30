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
//      equips from the pack, the Equipment tab takes off into the pack (the main hand's weapon too, since the WS9
//      merge: bare hands, WS5 #4; cursed things stick; the belt goes to the pack); no base field is written.
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
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };

// --- The consumable effects, traced (§7) ------------------------------------------------------------------------------
// consumableTrace(m) → { "drink:<effect>" | "read:<effect>": hash }: each potion drunk and each scroll read from the same
// seeded state (seed 7's start, legacy depth 3, on the map, HP 10, a cursed ring in the pack), and a hash of everything it
// changed: the log (text and colour), HP, max HP, STR, statuses, place and zone, the creatures (type, HP, state,
// statuses), the weapon, the map's seen and pit cells, gas clouds, and the next random number (so every draw counts). It
// needs only m.game, m.stats, m.body and m.seedRandom, so it runs on any tree since p0-done: PARENT_CONSUMABLES below
// are its hashes from p0-done's effects.js switches (recorded once, docs/sessions/ws5.md §7).
export function consumableTrace(m) {
  const { game, startRun } = m.game, out = {};
  const setup = (seed) => {
    m.seedRandom(seed);
    startRun(7);
    game.pages = null; game.pendingPages = null; game.story.cube = true; game.modeStack = [];
    const s = game.run.world.start;
    game.debug.enterZone(`${s.wx},${s.wy},3`, "down");
    game.view = "map"; game.mode = "map"; game.paused = false;
    const p = game.player;
    p.hp = 10;
    p.inv.push({ kind: "ring", id: "strength", ench: -1, known: false });
    game.messages = [];
    return p;
  };
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const digest = () => {
    const p = game.player, z = game.zone, w = m.body.wielded(p);
    return JSON.stringify({
      msgs: game.messages.map((x) => [x.text, x.color]), hp: p.hp, max: m.stats.maxHp(p), str: m.stats.attr(p, "str"),
      st: Object.entries(p.status || {}).map(([k, s]) => [k, +s.t.toFixed(3)]).sort(), pos: [p.x, p.y, p.z].map((v) => +v.toFixed(3)), zone: z.key,
      cr: z.creatures.filter((c) => !c.talk).map((c) => [c.type, c.hp, c.state, Object.keys(c.status || {}).sort()]),
      w: w && [w.id, w.ench, w.element || null, !!w.known], ring: p.inv.find((x) => x.kind === "ring")?.ench,
      seen: sum(z.seen), holes: sum(z.holeSeen), clouds: z.clouds.length, next: Math.random(),
    });
  };
  const POTIONS = ["healing", "strength", "flying", "haste", "seeing", "shadows", "descent", "poison", "paralysis", "darkness"];
  const SCROLLS = ["uncurse", "fire", "frost", "shock", "holy", "blessing", "teleport", "summon", "malice"];
  POTIONS.forEach((e, k) => { setup(700 + k); m.effects.drinkPotion(game, e); out[`drink:${e}`] = fnv(digest()); });
  SCROLLS.forEach((e, k) => { setup(800 + k); m.effects.readScroll(game, e); out[`read:${e}`] = fnv(digest()); });
  return out;
}
// Recorded from p0-done (9f8bea5) with consumableTrace against its own modules.
const PARENT_CONSUMABLES = {
  "drink:healing": "21f466b5", "drink:strength": "c744e00b", "drink:flying": "0d21ca66", "drink:haste": "cb52b67f",
  "drink:seeing": "4d8dc488", "drink:shadows": "c7c3eb23", "drink:descent": "c35ae757", "drink:poison": "371f1083",
  "drink:paralysis": "6b57528b", "drink:darkness": "9f580897", "read:uncurse": "1de47280", "read:fire": "4708abe1",
  "read:frost": "072005ec", "read:shock": "33719e06", "read:holy": "e4a150aa", "read:blessing": "607d1fc7",
  "read:teleport": "c3be6d4d", "read:summon": "2df32921", "read:malice": "e0eabfe0",
};

// splashTrace(m) → [{ effect, parent, table }]: a potion thrown on the map at a goblin beside you (throwing.js
// throwAtNearest lands it at once), through throwing.js's own switch (the parent's, still the one the game calls until
// WS8 applies docs/ws5.md request 3), and from the same state through effects.js splash() with the context throwing.js
// works out: the two digests must be equal.
export function splashTrace(m) {
  const { game, startRun } = m.game, out = [];
  const setup = (effect) => {
    m.seedRandom(900);
    startRun(7);
    game.pages = null; game.pendingPages = null; game.story.cube = true; game.modeStack = [];
    const s = game.run.world.start;
    game.debug.enterZone(`${s.wx},${s.wy},4`, "down");
    game.view = "map"; game.mode = "map";
    const p = game.player, z = game.zone;
    z.creatures = z.creatures.filter((c) => c.talk);
    let at = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy;
      if (z.stand[x + y * z.w] === p.z && !z.solid(x, y, p.z + 1)) { at = [x, y]; break; }
    }
    const g = m.creatures.addCreature(z, m.creatures.spawnCreature("goblin", at[0], at[1], p.z, { rng: () => 0.5, state: "idle", level: 3 }));
    z.sightings.set(g.id, { x: g.x, y: g.y, glyph: g.glyph, color: g.color, name: g.name, time: game.time });
    p.hp = 10;
    const stack = { kind: "potion", effect, count: 1 };
    p.inv.push(stack);
    game.messages = []; game.effects = [];
    return { p, g, stack };
  };
  const digest = () => {
    const p = game.player, z = game.zone;
    return JSON.stringify({ msgs: game.messages.map((x) => [x.text, x.color]), hp: p.hp, st: Object.keys(p.status || {}).sort(),
      cr: z.creatures.filter((c) => !c.talk).map((c) => [c.hp, c.state, Object.entries(c.status || {}).map(([k, v]) => [k, v.t]).sort()]),
      clouds: z.clouds.map((c) => [c.r, c.time, c.kind]), holes: z.holeSeen.reduce((a, v) => a + v, 0), ready: p.ready, yaw: +p.yaw.toFixed(4),
      bursts: game.effects.filter((e) => e.kind === "burst").length });
  };
  for (const effect of Object.keys(m.items.POTIONS)) {
    const { stack } = setup(effect);
    m.throwing.throwAtNearest(game, stack);
    const parent = digest();
    const { p, g, stack: s2 } = setup(effect);
    // What throwAtNearest and shatter do before the switch (throwing.js), then the table.
    p.ready = { kind: s2.kind, effect: s2.effect };
    m.items.takeOne(p, s2);
    p.yaw = Math.atan2(g.y - p.y, g.x - p.x);
    const x = g.x, y = g.y, z = g.z + g.h * 0.6, color = m.items.POTION_COLORS[game.potionColor[effect]];
    const known = game.knownPotions.has(effect);
    game.knownPotions.add(effect);
    game.log(known ? `The potion of ${m.items.POTIONS[effect].name} shatters!` : `The ${color.name} potion shatters. It was a potion of ${m.items.POTIONS[effect].name}!`, color.rgb);
    game.effects.push({ kind: "burst", x, y, z, color: color.rgb, time: game.time });
    const near = m.creatures.hostilesTo(game, p).filter((c) => m.creatures.touchable(game, c) && Math.hypot(c.x - x, c.y - y) <= 1.8 && Math.abs(c.z - z) < 2.5);
    const youToo = Math.hypot(p.x - x, p.y - y) <= 1.8 && Math.abs(p.z + 1 - z) < 2.5;
    m.effects.splash(game, effect, { x, y, z, r: 1.8, near, youToo, names: () => near.map((c) => c.name).join(", ") });
    out.push({ effect, parent: fnv(parent), table: fnv(digest()) });
  }
  return out;
}

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
      onehand: () => { const b = Bd.makeBody("humanoid"); b.parts = b.parts.filter((q) => q.id !== "hand_l"); delete b.equip.hand_l; return b; },
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
      // Bare hands (WS5 #4, at the WS9 merge; until then the main hand's weapon stayed): it comes off into the pack, and
      // you fight with your fists (the dagger's swing, a shorter reach than the sword's, combat's fists); the 3D view
      // draws no weapon; Pell's forge offers nothing. Then the sword goes back in hand.
      const swordReach = m.player.weaponReach(g), forge = m.talk.serviceDef("forge"), forgeArmed = forge?.available(game, null)?.length;
      const tOff = m.inventory.unequipPart(game, "hand_r");
      let drawn = true;
      const v = [game.view, game.mode];
      try { game.view = "3d"; game.mode = "explore"; game.debug.draw(); } catch (e) { drawn = `threw ${e.message}`; } finally { [game.view, game.mode] = v; }
      const bare = { off: tOff > 0 && !Bd.wielded(g) && g.inv.includes(sword), swing: m.player.attackTime(g), reach: m.player.weaponReach(g),
                     fists: !!m.combat.weaponSpec(g).fists, drawn, forge: forge?.available(game, null)?.length };
      if (!bare.off || !(bare.swing > 0) || !(bare.reach > 0 && bare.reach < swordReach) || !bare.fists || bare.drawn !== true || bare.forge !== 0 || !(forgeArmed > 0))
        fail(`bare hands: ${JSON.stringify({ ...bare, swordReach, forgeArmed })}`);
      stats.bareHands = { ...bare, swordReach, forgeArmed };
      m.inventory.equip(game, sword, g.inv.indexOf(sword));
      if (Bd.wielded(g) !== sword || g.inv.includes(sword)) fail("the sword didn't go back in hand after bare hands");
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
  section("implants", () => { St.STATS_DEBUG.verify = true; try {   // (the stat cache verified throughout)
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
    if (!same(fit.map, fit["3d"]) || fit.map.dt !== 60 || fit.map.fee !== 50 || fit.map.torch !== 0.333) fail(`fitting: map ${JSON.stringify(fit.map)}, 3D ${JSON.stringify(fit["3d"])} (want 60 s, 50 glim, torch +1/3 in both)`);
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
    // A waived fee (the Square's free fittings): no glim, but the station and the hour.
    {
      const q = fresh(), it = { kind: "implant", id: "lampCrown" };
      q.inv.push(it);
      const fw = q.funds, tw = game.time, r = IM.withTruing(game, { at: "cradle", waive: true }, () => IM.install(game, q, it, "head", { waive: true }));
      if (!r.ok || q.funds !== fw || game.time - tw !== 60) fail(`a waived fitting: ${r.ok ? "fitted" : r.reason}, ${fw - q.funds} glim, ${game.time - tw} s (want fitted, 0, 60)`);
      want("a waived fitting with no station", IM.install(game, fresh(), { kind: "implant", id: "lampCrown" }, "head", { waive: true }), "station");
    }
    // Dying on the table (poison running out your last HP inside the hour): not fitted, nothing paid.
    {
      const q = fresh();
      const crown2 = { kind: "implant", id: "lampCrown" };
      q.inv.push(crown2); q.hp = 2;
      m.status.addStatus(game, q, "poisoned", { t: 30, mag: 1 });
      const fd = q.funds, r = withC(() => IM.install(game, q, crown2, "head"));
      if (r.ok || r.reason !== "dead" || q.body.implants.head || q.funds !== fd) fail(`dying on the table: ${JSON.stringify({ ok: r.ok, reason: r.reason, fitted: !!q.body.implants.head, paid: fd - q.funds })} (want refused, "dead", nothing paid)`);
      reasons["dying on the table"] = r.reason;
    }
    // Taking out: the curse lock, the grade back, † destroyed, the folding rack's part.
    p = fresh();
    p.license = { grade: 12 };
    const heart = { kind: "implant", id: "glimHeart" }, rack = { kind: "implant", id: "foldingRack" }, eye2 = { kind: "implant", id: "levelEye" };
    p.inv.push(heart, rack, eye2);
    const hp0 = St.maxHp(p);
    withC(() => { IM.install(game, p, heart, "body"); IM.install(game, p, rack, "back"); IM.install(game, p, eye2, "face"); });
    if (St.maxHp(p) !== hp0 - 5) fail(`the glim heart: max HP ${St.maxHp(p)}, want ${hp0 - 5}`);
    if (m.torch.torchCost(p) !== 0) fail(`the glim heart: the torch costs ${m.torch.torchCost(p)} of its glim, want nothing (torch.js torchCost)`);
    if (!p.body.parts.some((q) => q.id === "back_2")) fail("the folding rack gave no second back");
    const cloak = { kind: "armour", id: "cloak", ench: 0, known: true };
    if (!Bd.equip(game, p, cloak, "back_2").ok) fail("no cloak on the second back");
    want("taking out without a station", IM.uninstall(game, p, "face"), "station");
    if (p.body.implants.face !== eye2) fail("the level-eye came out without a station");
    const u1 = withC(() => IM.uninstall(game, p, "face"));
    if (!u1.ok || u1.destroyed || !p.inv.includes(eye2) || IM.gradeUsed(p) !== 8) fail(`taking out the level-eye: ${JSON.stringify({ ok: u1.ok, destroyed: u1.destroyed })}, grade used ${IM.gradeUsed(p)} (want 8)`);
    const u2 = withC(() => IM.uninstall(game, p, "body"));
    if (!u2.ok || !u2.destroyed || p.inv.includes(heart) || St.maxHp(p) !== hp0) fail("the glim heart wasn't destroyed on removal, or max HP didn't come back");
    if (m.torch.torchCost(p) !== 1) fail(`the glim heart taken out: the torch costs ${m.torch.torchCost(p)}, want the full 1`);
    const u3 = withC(() => IM.uninstall(game, p, "back"));
    if (!u3.ok || p.body.parts.some((q) => q.id === "back_2") || !p.inv.includes(cloak) || !p.inv.includes(rack)) fail("taking out the folding rack: the part, the cloak or the rack went astray");
    // Removal takes the hour too, and a hunt within reach refuses it; the "uninstall" and "grade" events; HP clamped when
    // an implant lowers max HP; one of each outside plate grafts; the Cradle's G row raises the grade.
    {
      const q = fresh(); q.license = { grade: 12 };
      const eye = { kind: "implant", id: "levelEye" }, eye2 = { kind: "implant", id: "levelEye" }, glim = { kind: "implant", id: "glimHeart" };
      q.inv.push(eye, eye2, glim);
      withC(() => IM.install(game, q, eye, "face"));
      const seen = [], offs = ["uninstall", "grade"].map((t) => m.events.on(t, () => seen.push(t)));
      const hunter = m.creatures.addCreature(game.zone, m.creatures.spawnCreature("goblin", Math.floor(q.x) + 2, Math.floor(q.y), q.z, { rng: () => 0.5, state: "chase", level: 3 }));
      const tr = game.time, hr = withC(() => IM.uninstall(game, q, "face"));
      if (hr.ok || hr.reason !== "hunted" || game.time !== tr || q.body.implants.face !== eye) fail(`taking out with a hunt within reach: ${hr.reason}, ${game.time - tr} s`);
      game.zone.creatures = game.zone.creatures.filter((c) => c !== hunter);
      const tu = game.time, ur = withC(() => IM.uninstall(game, q, "face"));
      if (!ur.ok || game.time - tu !== 60 || !seen.includes("uninstall")) fail(`taking out: ${ur.ok ? "ok" : ur.reason}, ${game.time - tu} s (want 60), uninstall event ${seen.includes("uninstall")}`);
      q.credits = 2;   // (past grade 8 a grade takes 2)
      IM.raiseGrade(game, q);
      if (!seen.includes("grade")) fail("no grade event");
      offs.forEach((off) => off());
      q.hp = St.maxHp(q);
      withC(() => IM.install(game, q, glim, "body"));
      if (q.hp !== St.maxHp(q)) fail(`the glim heart left HP ${q.hp} above max HP ${St.maxHp(q)}`);
      q.body.parts.push({ id: "face_2", type: "face", implant: true }); q.body.implants.face_2 = null;
      withC(() => IM.install(game, q, eye, "face"));
      want("a second level-eye in a second face socket", withC(() => IM.canInstall(game, q, eye2, "face_2")), "twice");
      q.credits = 2;
      const g0 = IM.gradeOf(q);
      m.equipment.openTruing(game, { at: "cradle" });
      m.keys.dispatchKey(game, "KeyG", false, "g");
      if (IM.gradeOf(q) !== g0 + 1 || q.credits !== 0) fail(`G at the Cradle: grade ${g0} → ${IM.gradeOf(q)}, ${q.credits} true-marks left`);
      m.keys.dispatchKey(game, "Escape", false, "");
    }
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
    // The bible's tile counts (§13.3, §13.6) through player.js torchRange: the dark lens 4 tiles and dark goggles 2 with the
    // torch out; the lamp crown +2 on a lit torch's 6.
    {
      const sight = {};
      for (const [what, put] of [["lens", (q) => IM.grantImplant(q, "darkLens")], ["goggles", (q) => Bd.equip(game, q, { kind: "armour", id: "goggles", ench: 0, known: true }, "face")],
                                 ["crown", (q) => IM.grantImplant(q, "lampCrown")]]) {
        const q = fresh(); put(q); q.torch = what === "crown";
        sight[what] = +m.player.torchRange(q).toFixed(3);
      }
      if (sight.lens !== 4 || sight.goggles !== 2 || sight.crown !== 8) fail(`sight: dark lens ${sight.lens} tiles (4), goggles ${sight.goggles} (2), lamp crown's torch ${sight.crown} (8)`);
      stats.sight = sight;
    }
    // The dial spine: once a world day (1,440 s of game time) at any WIL.
    const spineAt = {};
    for (const wil of [10, 24]) {
      const q = fresh(); q.license = { grade: 12 }; q.attrs.wil = wil; St.invalidateStats(q);
      IM.grantImplant(q, "dialSpine");
      m.abilities.activate(game, q, "dialSpine", null);
      spineAt[wil] = Math.round(m.abilities.cooldownLeft(q, "dialSpine"));
    }
    if (spineAt[10] !== 1440 || spineAt[24] !== 1440) fail(`the dial spine's cooldown: WIL 10 ${spineAt[10]} s, WIL 24 ${spineAt[24]} s (want 1440 at both)`);
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
      if (!said(/draughtsmen trace you on the drafting floor, flat/)) fail(`${view}: the Cradle's fitting doesn't tell the draughtsmen's tracing (bible §10.4)`);
      if (p.body.implants.face !== it || game.time - t2 < 60) fail(`${view}: Enter on the dark lens in the Cradle: ${p.body.implants.face ? "in" : "not in"}, ${game.time - t2} s`);
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
    // The same surgeon as a talker who trades (WS6b's trade screen, merged at p2-ws6b; the dependency table's "WS5
    // implant surgery"): the services tab lists the fitting, Enter on it pays the fee and fits it, an hour passes.
    {
      p = fresh();
      const doc = m.creatures.addCreature(game.zone, m.creatures.spawnCreature("mira", Math.floor(p.x) + 1, Math.floor(p.y), p.z, { talk: { dialogue: "merchant", state: {} } }));
      Object.assign(doc, { name: "Detail C", merchant: { services: m.stations.SERVICES } });
      const tendons = { kind: "implant", id: "springTendons" };
      p.inv.push(tendons);
      const f0 = p.funds, t0 = game.time;
      m.merchants.openTrade(game, doc, "services");
      const list = m.merchants.tradeRows(game, doc, "services"), k = list.findIndex((r) => r.service === m.talk.serviceDef("fitImplant") && r.target.item === tendons);
      if (game.mode !== "trade" || k < 0) fail(`the trade screen's services: mode ${game.mode}, rows ${list.map((r) => r.label).join("; ") || "none"} (want the tendons' fitting)`);
      else {
        game.trade.sel = k;
        m.keys.dispatchKey(game, "Enter", false, "Enter");
        const got = { fitted: p.body.implants.feet === tendons, paid: f0 - p.funds, hour: +(game.time - t0).toFixed(1), mode: game.mode, label: list[k].label };
        stats.surgeryByTrade = JSON.stringify(got);
        if (!got.fitted || got.paid !== list[k].price || got.paid !== 50 || got.hour < 59) fail(`the surgeon's fitting through the trade screen: ${stats.surgeryByTrade} (want fitted, 50 glim, an hour)`);
        m.keys.dispatchKey(game, "Escape");
      }
    }
    // WS10's seams (at its merge): a lair's owner guards a body mod (gen/vaults.js BOTTOM_LOOT.bodyMod, drawn from the
    // site's stream), and only a fitted metronome heart shows the beat (traps.js BEAT_SIGHT).
    {
      const kinds = new Set(), draw = m.rng.makeRng(41);
      for (let k = 0; k < 60; k++) kinds.add(m.vaults.BOTTOM_LOOT.bodyMod?.(draw, 12)?.kind);
      p = fresh();
      const without = m.traps.BEAT_SIGHT.has(game);
      p.body.implants.body = { kind: "implant", id: "metronomeHeart" }; m.stats.invalidateStats(p);
      const withHeart = m.traps.BEAT_SIGHT.has(game);
      delete p.body.implants.body; m.stats.invalidateStats(p);
      stats.ws10Seams = `body mods ${[...kinds].sort().join(", ")}; the beat ${without} without, ${withHeart} with a metronome heart`;
      if (![...kinds].every((k) => ["artifact", "cell", "implant"].includes(k)) || kinds.size < 2 || without || !withHeart) fail(`WS10's seams: ${stats.ws10Seams}`);
      // A history relic as the reliquary's altar lays it (WS10 #4): the relic's name, the relic colour, a relic's price,
      // and the history's powers on top of its base piece's own.
      const rdef = game.run.history.relics[0], relic = m.vaults.BOTTOM_LOOT.relic(rdef), plainPiece = { ...relic, histRelic: undefined, relicName: undefined, powers: undefined };
      const gain = Object.fromEntries(Object.entries(m.items.itemBonuses(relic)).map(([k, n]) => [k, n - (m.items.itemBonuses(plainPiece)[k] || 0)]).filter(([, n]) => n));
      const want = Object.assign({}, ...rdef.powers);
      stats.histRelic = `${m.items.itemName(game, relic)}, ${m.items.itemPrice(relic)} glim, colour ${m.items.itemGlyph(game, relic)[1]}, powers ${JSON.stringify(gain)}`;
      if (m.items.itemName(game, relic) !== rdef.name || m.items.itemPrice(relic) !== 400 || JSON.stringify(m.items.itemGlyph(game, relic)[1]) !== JSON.stringify(m.items.RELIC_COLOR) || JSON.stringify(gain) !== JSON.stringify(want))
        fail(`a history relic: ${stats.histRelic} (want ${rdef.name}, 400, the relic colour, ${JSON.stringify(want)})`);
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
  } finally { St.STATS_DEBUG.verify = false; } });

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
        const rng = m.rng.makeRng(1000 + Object.keys(m.artifactTable).indexOf(id) * 97 + int * 7 + extra);   // (a stream of its own for each case)
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
    // The tinker recharges glim cells only, at a glim for every 100 charge missing.
    const gc = { kind: "cell", id: "glim", charge: 1050 }, sc = { kind: "cell", id: "sun", charge: 0 };
    p.inv.push(gc, sc);
    const cellRows = m.talk.servicesFor(game, tinker).filter((r) => r.id === "rechargeCell");
    const cellPrice = cellRows.find((r) => r.target === gc) && m.talk.serviceDef("rechargeCell").price(game, tinker, gc);
    if (cellRows.length !== 1 || cellRows[0].target !== gc || cellPrice !== 15) fail(`the tinker's recharging: ${cellRows.length} rows (want the glim cell only), ${cellPrice} glim (want 15)`);
    else { m.talk.serviceDef("rechargeCell").run(game, tinker, gc); if (gc.charge !== 2500) fail(`the tinker's recharge left ${gc.charge}`); }
    // Draining a cell into the purse: 100 charge a glim, as far as the purse holds (bible §3.1).
    {
      const dc = { kind: "cell", id: "dark", charge: 950 }, big = { kind: "cell", id: "glim", charge: 2500 };
      p.inv.push(dc, big);
      p.purse = 200; p.funds = 100;
      const drain = m.talk.serviceDef("drainCell");
      drain.run(game, tinker, dc);
      const after1 = [p.funds, dc.charge];
      p.funds = 195;
      drain.run(game, tinker, big);
      if (!same(after1, [109, 50]) || p.funds !== 200 || big.charge !== 2000) fail(`draining: a dark cell at 950 gave ${JSON.stringify(after1)} (want [109, 50]); a full glim cell into a purse 5 short left ${p.funds} glim, ${big.charge} charge (want 200, 2000)`);
    }
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
    if (!/goblin, level 4/i.test(t1)) fail("the examine screen doesn't name the goblin and its level");
    // The bands without a level-eye (examine.js's thresholds): health, AV, DV.
    {
      const av = m.combat.avOf(goblin), dvv = m.combat.dvOf(game, goblin);
      const avWord = av <= 0 ? "no armour" : av <= 1 ? "light armour" : av <= 3 ? "armoured" : "heavily armoured";
      const dvWord = dvv <= 6 ? "easy to hit" : dvv <= 9 ? "quick" : dvv <= 12 ? "hard to hit" : "very hard to hit";
      if (!t1.includes(`Unhurt · ${avWord} · ${dvWord}`)) fail(`the bands for an unhurt goblin (AV ${av}, DV ${dvv}): want "Unhurt · ${avWord} · ${dvWord}"`);
      goblin.hp = Math.ceil(goblin.maxHp * 0.4);
      if (!text().includes("Badly hurt")) fail("a goblin at 40% health isn't Badly hurt");
      goblin.hp = goblin.maxHp;
    }
    if (/Health \d+ of \d+/.test(t1)) fail("exact numbers without a level-eye");
    m.keys.dispatchKey(game, "Tab", false, "");
    if (!/ring of protection/i.test(text()) || !/armour/i.test(text())) fail("Tab didn't show the ring and its bonus");
    m.keys.dispatchKey(game, "Escape", false, "");
    if (game.mode !== "map") fail(`Esc left examine for ${game.mode}`);
    // A level-eye reads the numbers.
    p.body.implants.face = { kind: "implant", id: "levelEye" }; St.invalidateStats(p);
    m.events.emit(game, "inspect", m.renderMap.inspectAt(game, { x: tx, y: ty }, true));
    { const want = `Health ${goblin.hp} of ${goblin.maxHp} · AV ${m.combat.avOf(goblin)} · DV ${m.combat.dvOf(game, goblin)}`;
      if (!text().includes(want)) fail(`a level-eye doesn't show "${want}"`); }
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
      game.zone.seen[c.tx + c.ty * game.zone.w] = 1;   // (a sighting stands on a tile the map shows: the target screen asks)
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
      // E in the pack, then the target: in 3D the crosshair at once; on the map WS8's target screen (since the WS4b
      // merge), confirmed by Enter on what it starts on (the nearest hostile in reach), on a tile east picked first
      // (how: a number of tiles), or cancelled by Esc (how: "esc").
      const use = (it, how = 0) => {
        const p = game.player;
        p.inv.push(it);
        const t = AR.useArtifact(game, p, it);
        if (t && typeof t === "object" && t.aim) {
          AR.aimArtifact(game, p, t.aim);
          if (game.mode === "target") {
            if (how === "esc") m.keys.dispatchKey(game, "Escape");
            else { for (let k = 0; k < how; k++) m.keys.dispatchKey(game, "ArrowRight"); m.keys.dispatchKey(game, "Enter", false, "Enter"); }
          }
          return "aimed";
        }
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
      // Aimed ones: a goblin ahead (the map's target screen starts on the nearest hostile in sight; 3D aims the crosshair).
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
      hostileAhead(p, 6);   // (something beyond the knife's 4 tiles: on the map the screen starts on your tile, and 4 east is picked)
      const x0 = p.x, knife = known("foldKnife");
      use(knife, 4);
      r.foldKnife = { moved: +(p.x - x0).toFixed(2), charge: knife.cell.charge };
      // The map's target screen cancelled: an aimed artifact is lowered, nothing paid (in 3D the crosshair always gives a point).
      if (view === "map") {
        p = fresh({ view, depth: 4 }); lineEast(p);
        const f0 = p.funds, gun = known("glimgun", null), lc = known("lancet");
        use(gun, "esc"); use(lc, "esc");
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
    if (out.map.echoBell.revealed !== out["3d"].echoBell.revealed) fail(`the echo-bell revealed ${out.map.echoBell.revealed} cells on the map and ${out["3d"].echoBell.revealed} in 3D`);
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
    // Through the clock (skipTime fires clock:tick, as frames and map actions do), on the start span's open ground from
    // 06:00: 600 s by day with the torch lit (sun +500, dark +0), then to 19:00, then 300 s of night with the torch out
    // (sun +0, dark +250); the same in one skip as in ten.
    const clocked = (pieces) => {
      startRun(7);
      game.pages = null; game.pendingPages = null; game.story.cube = true; game.modeStack = []; game.mode = "map"; game.view = "map";
      const q = game.player, sunC = { kind: "cell", id: "sun", charge: 0 }, darkC = { kind: "cell", id: "dark", charge: 0 };
      q.inv.push(sunC, darkC); q.torch = true;
      const skip = (secs) => { for (let k = 0; k < pieces; k++) m.time.skipTime(game, secs / pieces, { interruptible: false }); };
      skip(600);
      const day = [sunC.charge, darkC.charge];
      skip(180);
      const dusk = sunC.charge;
      q.torch = false;
      skip(300);
      return { day, sunAt19: dusk, night: [sunC.charge - dusk, darkC.charge] };
    };
    const c1 = clocked(1), c10 = clocked(10);
    if (!same(c1, c10) || !same(c1.day, [500, 0]) || !same(c1.night, [0, 250])) fail(`cells through the clock: one skip ${JSON.stringify(c1)}, ten ${JSON.stringify(c10)} (want day [500, 0], night [0, 250])`);
    stats.cellsByClock = c1;
    const one = recharge(1, 600, false, false), split = recharge(10, 60, false, false);
    if (!same(one, split) || one[1] !== 500 || one[0] !== 0) fail(`a dark cell over 600 s underground with the torch out: one step ${one}, ten steps ${split} (want [0, 500])`);
    stats.cells = { darkOver600s: one[1], glimFill: paid };
    // Loot for sites: artifacts, cells and implants, never a true-mark (bible §10.4 budgets those to site bottoms,
    // floor plans and the vow).
    {
      const rng = m.rng.makeRng(5), kinds = {};
      for (let k = 0; k < 10000; k++) { const it = AR.randomBodyMod(rng, 1 + (k % 24)); kinds[it.kind] = (kinds[it.kind] || 0) + 1; }
      if (kinds.credit || !kinds.artifact || !kinds.cell || !kinds.implant) fail(`randomBodyMod over 10,000 draws: ${JSON.stringify(kinds)}`);
      stats.loot = kinds;
    }
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
      game.invSel = 0;
      let t = text();
      if (!t.includes("I close")) fail(`${cols}×${rows}: "I close" isn't on screen`);
      for (let k = 0; k < 59; k++) m.keys.dispatchKey(game, "ArrowDown", false, "");
      t = text();
      const top = game.invTop;
      if (game.invSel !== 59 || top !== 60 - (rows - 12) || game.invPage !== rows - 12) fail(`${cols}×${rows}: after 59 × ↓ the selection is ${game.invSel}, the list's top ${top} (want ${60 - (rows - 12)}), a page ${game.invPage} (want ${rows - 12})`);
      m.keys.dispatchKey(game, "Home", false, "");
      text();
      if (game.invSel !== 0 || game.invTop !== 0) fail(`${cols}×${rows}: Home: selection ${game.invSel}, top ${game.invTop}`);
      m.keys.dispatchKey(game, "PageDown", false, "");
      const page = game.invSel;
      text();
      if (page !== rows - 12) fail(`${cols}×${rows}: PgDn moved the selection to ${page}, want a page (${rows - 12})`);
      rowsAt[`${cols}x${rows}`] = { page: game.invPage, topAt59: top };
      // The filter: potions only.
      for (let k = 0; k < 6 && game.invFilter !== "potions"; k++) m.keys.dispatchKey(game, "KeyF", false, "f");
      t = text();
      if (game.invFilter !== "potions" || p.inv[game.invSel]?.kind !== "potion" || /dagger/.test(t.slice(0, t.indexOf("I close")))) fail(`${cols}×${rows}: the potions filter (${game.invFilter}) shows other things`);
      // A click on a row under the filter selects that row's thing (the list's row index goes through the filter).
      {
        const shownIdx = p.inv.map((it, i) => (it.kind === "potion" ? i : -1)).filter((i) => i >= 0), want = shownIdx[3];
        game.debug.draw();
        let rowCell = null;   // (potions share names: find the list's 4th row by its hit rect, as a click would)
        for (let y = 0; y < m.capture.rows && !rowCell; y++)
          for (let x = 0; x < m.capture.cols && !rowCell; x++) { const h = m.ui.at({ x, y }); if (h?.list && h.index === 3) rowCell = { x, y }; }
        if (!rowCell) fail(`${cols}×${rows}: no 4th row on the potions list to click`);
        else {
          m.inventory.inventoryClick(game, rowCell);
          if (game.invSel !== want) fail(`${cols}×${rows}: a click on the potions list's 4th row selected pack index ${game.invSel}, want ${want}`);
        }
      }
      m.keys.dispatchKey(game, "KeyF", false, "f");
      while (game.invFilter !== "all") m.keys.dispatchKey(game, "KeyF", false, "f");
      // The Equipment tab.
      m.keys.dispatchKey(game, "Tab", false, "");
      t = text();
      if (game.invTab !== "equipment" || !t.includes("Right hand") || !t.includes("Feet") || !t.includes("Belt")) fail(`${cols}×${rows}: Tab didn't show the Equipment tab with every part`);
      m.keys.dispatchKey(game, "Tab", false, "");
      m.keys.dispatchKey(game, "Escape", false, "");
      if (game.mode !== "map") fail(`${cols}×${rows}: Esc left the inventory for ${game.mode}`);
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
    // Line for line: every potion drunk and scroll read gives what p0-done's switches gave (the same log, numbers,
    // statuses and random draws), and every thrown potion's splash from the table what throwing.js's switch gives.
    // (Traced on the legacy sets, as p0-done's switches were: since the flip, p2-flip, they aren't the default.)
    const undoSets = [m.rules.overrideRules("stats", "legacy"), m.rules.overrideRules("combat", "legacy")];
    let traced, splashes;
    try { traced = consumableTrace(m); splashes = splashTrace(m); } finally { while (undoSets.length) undoSets.pop()(); }
    const off = Object.keys(PARENT_CONSUMABLES).filter((k) => traced[k] !== PARENT_CONSUMABLES[k]);
    if (off.length || Object.keys(traced).length !== Object.keys(PARENT_CONSUMABLES).length) fail(`consumables that differ from p0-done's switches: ${off.join(", ") || "(a different set)"}`);
    const drift = splashes.filter((r) => r.parent !== r.table).map((r) => r.effect);
    if (drift.length) fail(`thrown potions whose splash from the table differs from throwing.js's switch: ${drift.join(", ")}`);
    stats.effectsTraced = `${Object.keys(traced).length - off.length} of ${Object.keys(PARENT_CONSUMABLES).length} drunk or read as at p0-done; ${splashes.length - drift.length} of ${splashes.length} splashes as throwing.js's switch`;
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

// --- C4: the parent's gear as the parent showed it (golden (b) for item text) ---------------------------------------
// parentGearTrace(m) → { [label]: fnv hash }: every piece of the parent's gear (its 7 weapons and 15 armours by id,
// written out: C4's new entries are left out), its rings, amulets and relics, at enchantment -1, 0, +2, known and not,
// plain, flaming and with a property: its name, info line, price, glyph, palette, bonuses and armour value. It needs
// only items.js and a game, so it runs on any tree since WS5's merge: PARENT_GEAR below is its trace at p3i-props
// (7959ea0), recorded once (docs/sessions/c4.md §6). Examine's description line (TEXT) is C4's, beside the parent's
// line: itemDetails is not in the trace.
const PARENT_WEAPONS = ["dagger", "shortsword", "mace", "spear", "longsword", "waraxe", "greatsword"];
const PARENT_ARMOURS = ["clothes", "leather", "chain", "scale", "plate", "reedHat", "copperCap", "ironHelm", "goggles", "cloak", "bracers",
  "gloves", "gauntlets", "sandals", "boots"];
export function parentGearTrace(m) {
  const I = m.items, game = m.game.game, out = {};
  const look = (it) => JSON.stringify([I.itemName(game, it), I.itemInfo(game, it), I.itemPrice(it), I.itemGlyph(game, it), I.itemPalette(game, it),
    I.itemBonuses(it), I.ITEM_KINDS[it.kind].av?.(it) ?? null]);
  const add = (label, it) => { out[label] = fnv(look(it)); };
  for (const ench of [-1, 0, 2]) for (const known of [false, true]) {
    for (const id of PARENT_WEAPONS) {
      add(`weapon ${id} ${ench} ${known}`, { kind: "weapon", id, ench, known });
      add(`weapon ${id} ${ench} ${known} fire keen`, { kind: "weapon", id, ench, known, element: "fire", props: ["keen"] });
    }
    for (const id of PARENT_ARMOURS) {
      add(`armour ${id} ${ench} ${known}`, { kind: "armour", id, ench, known });
      add(`armour ${id} ${ench} ${known} light thorns`, { kind: "armour", id, ench, known, props: ["light", "thorns"] });
    }
    for (const kind of ["ring", "amulet"]) for (const id of Object.keys(kind === "ring" ? I.RINGS : I.AMULETS)) add(`${kind} ${id} ${ench} ${known}`, { kind, id, ench, known });
  }
  for (const key of Object.keys(I.RELICS)) add(`relic ${key}`, I.makeRelic(key));
  return out;
}
// Recorded from p3i-props (7959ea0) with parentGearTrace against its own modules: the fnv of the whole trace, and its size.
const PARENT_GEAR = { entries: 352, hash: "7e4a7549" };

// --- C4: the real world's gear, tonics, artifacts, mutations and kits (owner C4; Phase 3) -----------------------------
// checkGear(m) → { name: "gear", ok, problems, stats }: C4's own data, held to the bible's numbers written out here (not
// read from the tables under test).
//   1. The material ladder (bible §13.1): each material's tier, damage and armour; every weapon class in every material
//      wielded and put away in both formula sets: the spec's material is the ladder's, the item line shows the range
//      with it, the derived numbers come back exactly (the stat cache verified); noonsilver cuts flat while wielded; a
//      forged armour piece in every material adds the ladder's armour; a piece that isn't forged takes none.
//   2. Prices on bible §3.1's anchors (a copper short sword 40, an iron longsword 120, a balm tonic 25, a homing pip 300)
//      and the names ("copper short sword", "saltsteel scale mail").
//   3. randomGear by level (1-30, seeded): materials never above the zone's tier, the tier's own the commonest, heavy
//      classes held back to their tier, only pieces that do something, never clothes, the same draws for the same seed;
//      and the parent's randomEquipment never draws a new piece (golden (b) holds its numbers).
//   4. The three switched-on artifacts: on, their bonus (and the HUD's status); off, gone.
//   5. Marker chalk in both views: a mark on your tile in the zone's markers, a stick used; a second on the same tile and
//      a tenth on the floor refused, nothing used.
//   6. Tonics: each one's effect and its overdose; the second in a row's TOU save (a pass ends the one before, a failure
//      overdoses); the Bent's half and bad reaction; the balm the same played out (1/60 s) and skipped.
//   7. The kits: every background's character holds its bible pieces (forged in their material, the tonics, vials,
//      chalk, the glimgun), each named.
//   8. The waiting tables: the artifacts and relics with ARTIFACTS are bible §13.4's 30, the mutations with MUTATIONS
//      §13.5's 40 (20 physical, 12 mental, 8 defects; the planar ones the bible's); none waiting is offered or laid as
//      loot; each says what it needs; a relic has its three registers (the dark one lower case, no punctuation).
export function checkGear(m) {
  const problems = [], stats = {};
  const fail = (msg) => problems.push(msg);
  const { game, startRun } = m.game, I = m.items, Bd = m.body, St = m.stats, F = m.forge, GR = m.gear, TN = m.tonics, AR = m.artifacts, ARC = m.artifactTables;
  const section = (name, fn) => { try { fn(); } catch (err) { fail(`${name}: threw ${err.stack?.split("\n").slice(0, 3).join(" / ") || err}`); } };
  const entity = () => ({ body: Bd.makeBody("humanoid"), inv: [], attrs: St.makeAttrs(30), level: 1, maxHpGain: 0, hp: 20, perks: {}, status: {} });
  const snap = (e) => JSON.stringify({ hp: St.maxHp(e), av: St.av(e), dv: St.dv(e), attrs: St.ATTRS.map((k) => St.attr(e, k)), b: St.bonusTable(e) });
  const fresh = ({ view = "map", genotype = "plumb" } = {}) => {
    startRun(7);
    game.pages = null; game.pendingPages = null; game.story.cube = true; game.modeStack = [];
    const s = game.run.world.start;
    game.debug.enterZone(`${s.wx},${s.wy},3`, "down");
    game.view = view; game.mode = view === "map" ? "map" : "explore"; game.paused = false;
    game.zone.creatures = game.zone.creatures.filter((c) => c.talk);
    const p = game.player;
    p.genotype = genotype; p.status = {}; game.messages = [];
    St.invalidateStats(p);
    return p;
  };
  const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

  // Bible §13.1, written out: [material, tier, damage, armour].
  const LADDER = [["bone", 1, -1, 0], ["copper", 2, 0, 0], ["iron", 3, 1, 0], ["saltsteel", 4, 2, 1], ["blackglass", 5, 3, 1],
    ["truesteel", 6, 4, 2], ["pleatmetal", 7, 5, 2], ["noonsilver", 8, 6, 3]];

  section("the parent's gear", () => {
    const trace = parentGearTrace(m), n = Object.keys(trace).length, h = fnv(JSON.stringify(trace));
    if (n !== PARENT_GEAR.entries || h !== PARENT_GEAR.hash) {
      fail(`the parent's gear reads differently from p3i-props: ${n} entries hashing ${h}, want ${PARENT_GEAR.entries} hashing ${PARENT_GEAR.hash}`);
    }
    stats.parentGear = `${n} pieces of the parent's gear read as at p3i-props (${h})`;
  });

  section("ladder", () => {
    const ids = Object.keys(F.MATERIALS);
    if (JSON.stringify(ids) !== JSON.stringify(LADDER.map((r) => r[0]))) fail(`materials ${ids.join(", ")}, want the bible's eight in order`);
    for (const [id, tier, dmg, av] of LADDER) {
      const d = F.MATERIALS[id];
      if (!d || d.tier !== tier || d.dmg !== dmg || d.av !== av) fail(`${id}: tier ${d?.tier}, damage ${d?.dmg}, armour ${d?.av}; want ${tier}, ${dmg}, ${av}`);
    }
    let pieces = 0;
    const undo = [];
    for (const set of ["legacy", "attributes"]) {
      const back = m.rules.overrideRules("stats", set);
      St.STATS_DEBUG.verify = true;
      try {
        for (const id of Object.keys(I.WEAPONS)) for (const [mat, , dmg] of LADDER) {
          const e = entity(), it = GR.makeGear("weapon", id, mat), before = snap(e);
          if (it.made !== mat || it.material !== dmg) { fail(`${set}: makeGear weapon ${id} ${mat}: made ${it.made}, material ${it.material}`); continue; }
          const r = Bd.equip(game, e, it, "hand_r");
          if (!r.ok) { fail(`${set}: ${mat} ${id} won't go in hand (${r.reason})`); continue; }
          const spec = m.combat.weaponSpec(e);
          if (spec.material !== dmg) fail(`${set}: ${mat} ${id}: the spec's material is ${spec.material}, want ${dmg}`);
          // (the line shows the material as it adds a blow: × the swing ÷ RULES.d20.swingRef, the light-weapon fix of 2026-10-30)
          const w = I.WEAPONS[id], line = I.itemInfo(game, it), shown = Math.round(dmg * w.swing / m.rules.RULES.d20.swingRef);
          if (!line.startsWith(`${w.dmg[0] + shown}-${w.dmg[1] + shown} damage`) || !line.includes(F.MATERIALS[mat].info)) fail(`${set}: ${mat} ${id}'s line: "${line}"`);
          if ((St.bonus(e, "cutsFlat") > 0) !== (mat === "noonsilver") || line.includes("cuts flat") !== (mat === "noonsilver")) fail(`${set}: ${mat} ${id}: cutsFlat ${St.bonus(e, "cutsFlat")}, line "${line}"`);
          if (!Bd.unequip(game, e, "hand_r").ok || snap(e) !== before) fail(`${set}: ${mat} ${id} on and off changed the derived numbers`);
          pieces++;
        }
        for (const [mat, , dmg] of LADDER) {   // the bolt-bow's shot adds its material (missiles.js missileSpec)
          const p = { ...entity(), readyMissile: "boltBow" }, it = GR.makeGear("missile", "boltBow", mat), spec = m.missiles.missileSpec(p, it);
          if (it.made !== mat || spec.material !== dmg || !I.itemName(game, it).startsWith(`${mat} bolt-bow`)) fail(`${set}: a ${mat} bolt-bow: made ${it.made}, the shot's material ${spec.material}, named ${I.itemName(game, it)}`);
          pieces++;
        }
        for (const id of Object.keys(I.ARMOURS)) for (const [mat, , , av] of LADDER) {
          const e = entity(), it = GR.makeGear("armour", id, mat), before = snap(e);
          const forged = F.FORGED.armour.includes(id);
          if (forged !== (it.made === mat)) { fail(`${set}: armour ${id} in ${mat}: made ${it.made}, forged ${forged}`); continue; }
          const part = Bd.slotsFor(e, it)[0];
          const plain = { kind: "armour", id, ench: 0, known: true }, pe = entity();
          if (!Bd.equip(game, pe, plain, part).ok || !Bd.equip(game, e, it, part).ok) { fail(`${set}: ${mat} ${id} won't go on ${part}`); continue; }
          if (I.itemInfo(game, it).includes("cuts flat")) fail(`${set}: ${mat} ${id}'s line says it cuts flat beings: only a weapon does`);
          if (St.av(e) - St.av(pe) !== (forged ? av : 0)) fail(`${set}: ${mat} ${id}: armour ${St.av(e)} against ${St.av(pe)} plain, want +${forged ? av : 0}`);
          if (!Bd.unequip(game, e, part).ok || snap(e) !== before) fail(`${set}: ${mat} ${id} on and off changed the derived numbers`);
          pieces++;
        }
      } finally { St.STATS_DEBUG.verify = false; back(); }
    }
    for (const u of undo) u();
    stats.ladder = `${pieces} pieces in their materials, on and off, in both formula sets (${Object.keys(I.WEAPONS).length} classes, ${F.FORGED.armour.length} forged armours)`;
  });

  section("prices", () => {
    const want = [[GR.makeGear("weapon", "shortsword", "copper"), 40, "copper short sword"], [GR.makeGear("weapon", "longsword", "iron"), 120, "iron longsword"],
      [GR.makeGear("armour", "scale", "saltsteel"), Math.round(110 * 2), "saltsteel scale mail"], [{ kind: "tonic", effect: "balm" }, 25, "balm tonic"]];
    for (const [it, price, name] of want) {
      if (I.itemPrice(it) !== price || I.itemName(game, it) !== name) fail(`${name}: ${I.itemName(game, it)} at ${I.itemPrice(it)}, want ${name} at ${price}`);
    }
    const pip = ARC.ARTIFACTS.homingPip || ARC.ARTIFACTS_WAITING.homingPip;   // (live since B1)
    if (pip.value !== 300) fail(`the homing pip's value ${pip.value}, want 300`);
    // Up the ladder, worth more at every rung.
    const ladder = LADDER.map(([mat]) => I.itemPrice(GR.makeGear("weapon", "longsword", mat)));
    if (ladder.some((v, k) => k && v <= ladder[k - 1])) fail(`a longsword's price up the ladder: ${ladder.join(", ")}`);
    stats.prices = `copper short sword 40, iron longsword 120, saltsteel scale mail 220, balm 25; a longsword ${ladder.join(" / ")}`;
  });

  section("randomGear", () => {
    const tierOf = (level) => Math.min(8, Math.ceil((level + 1) / 3));
    let launchers = 0;
    const HEAVY = { greatsword: 4, maul: 4, glaive: 4, waraxe: 3, longsword: 3 };
    // The armour that does something now (written out, not read from gear.js useful): armour, a bonus the stat bus reads, or
    // since B1 a special that is built (a worn reputation).
    const LOOT_ARMOUR = ["leather", "chain", "scale", "plate", "copperCap", "ironHelm", "goggles", "cloak", "bracers", "gauntlets", "boots",
      "helm", "plumbHelm", "lampCrownHat", "monocle", "glassScale", "pleatedCoat", "reedCloak", "featherCloak", "mapCase", "kiteGlider", "examiningKit",
      "stiltSandals", "stiltBoots", "featheredHood", "assizeWrit", "buckler", "climbingHooks"];   // (B1: the hood and the writ, their worn reputation built)
    const drawnArmour = new Set();
    const tally = {};
    for (let level = 1; level <= 30; level++) {
      const tier = tierOf(level), rng = m.rng.makeRng(4100 + level), mats = {};
      for (let k = 0; k < 400; k++) {
        const it = GR.randomGear(rng, level);
        if (!I.ITEM_KINDS[it.kind] || !({ weapon: I.WEAPONS, armour: I.ARMOURS, missile: m.missileTable }[it.kind] || {})[it.id]) { fail(`level ${level}: drew ${JSON.stringify(it)}`); continue; }
        if (it.id === "clothes") fail(`level ${level}: drew plain clothes`);
        if (it.kind === "armour" && !LOOT_ARMOUR.includes(it.id)) fail(`level ${level}: drew ${it.id}, which isn't loot (it does nothing yet, or is clothes)`);
        if (it.made) {
          mats[it.made] = (mats[it.made] || 0) + 1;
          if (F.MATERIALS[it.made].tier > tier) fail(`level ${level} (tier ${tier}): ${it.made} (tier ${F.MATERIALS[it.made].tier})`);
          if (it.kind !== "armour" && it.material !== F.MATERIALS[it.made].dmg) fail(`level ${level}: ${it.made} ${it.id} with material ${it.material}`);
        } else if (it.kind === "weapon" || it.id === "boltBow") fail(`level ${level}: a ${it.id} with no material`);
        if (it.kind === "missile") launchers++;
        if (it.kind === "armour") drawnArmour.add(it.id);
        if (HEAVY[it.id] > tier) fail(`level ${level} (tier ${tier}): a ${it.id} before tier ${HEAVY[it.id]}`);
        if (I.ARMOURS[it.id]?.tier > tier && !F.FORGED.armour.includes(it.id)) fail(`level ${level}: ${it.id} of tier ${I.ARMOURS[it.id].tier}`);
      }
      const top = Object.entries(mats).sort((a, b) => b[1] - a[1])[0]?.[0];
      const own = LADDER.find((r) => r[1] === tier)[0];
      if (top !== own) fail(`level ${level} (tier ${tier}): the commonest material is ${top} (${JSON.stringify(mats)}), want ${own}`);
      tally[level] = top;
    }
    const never = LOOT_ARMOUR.filter((id) => !drawnArmour.has(id));
    if (never.length) fail(`randomGear never drew ${never.join(", ")} in 12,000 draws`);
    const a = [], b = [];
    for (let k = 0, r1 = m.rng.makeRng(9), r2 = m.rng.makeRng(9); k < 50; k++) { a.push(GR.randomGear(r1, 12)); b.push(GR.randomGear(r2, 12)); }
    if (JSON.stringify(a) !== JSON.stringify(b)) fail("randomGear: two draws from the same seed differ");
    // The parent's loot: nothing new, ever.
    const fresh = new Set([...Object.keys(F.GEAR_WEAPONS), ...Object.keys(F.GEAR_ARMOURS)]);
    let parent = 0;
    for (let depth = 1; depth <= 20; depth++) {
      const rng = m.rng.makeRng(700 + depth);
      for (let k = 0; k < 200; k++, parent++) { const it = I.randomEquipment(rng, depth); if (fresh.has(it.id) || it.made) fail(`randomEquipment at depth ${depth} drew ${it.id}${it.made ? ` in ${it.made}` : ""}`); }
    }
    const tonics = {};
    for (let k = 0, rng = m.rng.makeRng(31); k < 1400; k++) { const t = TN.randomTonic(rng); tonics[t.effect] = (tonics[t.effect] || 0) + 1; if (!TN.TONICS[t.effect]) fail(`randomTonic: ${t.effect}`); }
    if (Object.keys(tonics).length !== 6 || Object.entries(tonics).sort((a, b) => b[1] - a[1])[0][0] !== "balm") fail(`randomTonic: ${JSON.stringify(tonics)} (all six, the balm the commonest)`);
    stats.randomGear = `${launchers} launchers among them; randomTonic ${JSON.stringify(tonics)}; 30 levels × 400 draws; the commonest material by tier: ${[1, 4, 7, 10, 13, 16, 19, 22].map((l) => `${tierOf(l)} ${tally[l]}`).join(", ")}; randomEquipment ${parent} draws, none new`;
  });

  // The map case: 3 points off the lost chance (bible §15.6 counts a compass-ring's 5), never lost-proof.
  section("map case", () => {
    const p = fresh(), it = GR.makeGear("armour", "mapCase");
    if (!Bd.equip(game, p, it, "back").ok) { fail("the map case won't go on the back"); return; }
    const n = St.bonus(p, "navigation");
    if (Math.abs(n - 0.03) > 1e-9) fail(`the map case: navigation ${n}, want 0.03 (a compass-ring is 0.05)`);
    Bd.unequip(game, p, "back");
    stats.mapCase = `navigation ${n}`;
  });

  section("switched on", () => {
    const p = fresh(), out = {};
    for (const [id, key, n] of [["featherfallLantern", "featherFall", 1], ["jumpSprings", "jump", 2], ["mirrorShield", "ward", 3]]) {
      const it = { kind: "artifact", id, known: true, cell: { id: "glim", charge: 2500 } };
      p.inv.push(it);
      const before = St.bonus(p, key);
      const t1 = AR.useArtifact(game, p, it), on = St.bonus(p, key) - before, hud = m.status.statusLine(game, p).some((s) => s.text === ARC.ARTIFACTS[id].name.toUpperCase());
      const t2 = AR.useArtifact(game, p, it), off = St.bonus(p, key) - before;
      if (!(t1 > 0) || on !== n || !hud || !(t2 > 0) || off !== 0) fail(`${id}: on +${on} ${key} (want +${n}), HUD ${hud}; off +${off}`);
      out[id] = `+${on} ${key}`;
      p.inv.splice(p.inv.indexOf(it), 1);
    }
    stats.switchedOn = out;
  });

  section("marker chalk", () => {
    const out = {};
    for (const view of ["map", "3d"]) {
      const p = fresh({ view }), z = game.zone;
      z.markers.length = 0;
      const chalk = { kind: "tool", effect: "markerChalk", count: 3 };
      p.inv.push(chalk);
      const t = I.useItem(game, p, chalk), x = Math.floor(p.x), y = Math.floor(p.y);
      const marked = z.markers.some((mk) => mk.x === x && mk.y === y);
      const again = I.useItem(game, p, chalk);
      for (let k = 0; z.markers.length < 9; k++) z.markers.push({ x: k, y: 0 });
      p.x += 1;
      const full = I.useItem(game, p, chalk);
      if (!(t > 0) || !marked || chalk.count !== 2 || again !== 0 || full !== 0 || z.markers.length !== 9) fail(`${view}: chalk ${t} s, marked ${marked}, ${chalk.count} left, again ${again}, a tenth ${full}`);
      out[view] = `a mark at (${x}, ${y}), ${chalk.count} sticks left`;
    }
    stats.chalk = out;
  });

  section("tonics", () => {
    const out = {};
    const has = (p, id) => m.status.hasStatus(p, id);
    const expect = {
      balm: (p, h0) => p.hp - h0 === 12, hasp: (p) => m.status.statusLeft(p, "hasted") === 15, gloam: (p) => St.bonus(p, "darkSight") === 3 && St.bonus(p, "stealth") === 0.3,
      ironbark: (p) => St.bonus(p, "av") === 2 && St.bonus(p, "str") === 2, foldSap: (p) => has(p, "flat"), clearwit: (p) => St.bonus(p, "examine") === 5 && St.bonus(p, "int") === 2,
    };
    const od = {
      balm: (p) => has(p, "tonic:sick"), hasp: (p) => has(p, "hasted") && has(p, "tonic:crash"), gloam: (p) => has(p, "blinded") && (p.torch = true) && m.player.torchRange(p) <= 1,   // (B1, C4 #10: blind in any light)
      ironbark: (p) => has(p, "tonic:heavy"), foldSap: (p) => m.status.statusLeft(p, "flat") === 60, clearwit: () => !game.zone.seen.some(Boolean),
    };
    if (JSON.stringify(Object.keys(TN.TONICS)) !== JSON.stringify(Object.keys(expect))) fail(`tonics ${Object.keys(TN.TONICS).join(", ")}, want bible §13.8's six`);
    for (const id of Object.keys(expect)) {
      let p = fresh(); p.hp = 4;
      const h0 = p.hp, it = { kind: "tonic", effect: id, count: 2 };
      p.inv.push(it);
      const t = I.useItem(game, p, it);
      if (id === "balm") for (let k = 0; k < 200; k++) m.status.tickStatuses(game, p, 1 / 60);
      if (t !== m.rules.RULES.body.drinkTime || it.count !== 1 || !expect[id](p, h0)) fail(`${id}: ${t} s, ${it.count} left, its effect ${expect[id](p, h0)} (${JSON.stringify(Object.keys(p.status))})`);
      p = fresh(); game.zone.seen.fill(1);
      TN.injectTonic(game, p, "ironbark", () => 0.9);
      const r = TN.injectTonic(game, p, id, seq(0));   // nat 1: the second in a row fails its save
      if (!r.overdose || r.save?.dc !== 15 || !od[id](p) || has(p, "tonic:ironbark")) fail(`${id} overdosed: ${JSON.stringify(r)}, its overdose ${od[id](p)}, ironbark ${has(p, "tonic:ironbark")}`);
      out[id] = "ok";
    }
    // A pass (nat 20 against 15) ends the one before and the new one works; the third in a row asks 18.
    {
      const p = fresh();
      TN.injectTonic(game, p, "ironbark", () => 0.9);
      const r = TN.injectTonic(game, p, "gloam", seq(0.99));
      const r3 = TN.injectTonic(game, p, "clearwit", seq(0.99));
      if (r.overdose || has(p, "tonic:ironbark") || has(p, "tonic:clearwit") === false || r3.save?.dc !== 18 || has(p, "tonic:gloam")) fail(`the chain: ${JSON.stringify([r, r3])}, ${JSON.stringify(Object.keys(p.status))}`);
    }
    // One at a time over time: the chain lasts as long as the tonic (a Bent's gloam works its 60 s at half strength, so a
    // second 31 s on asks the save), and a pass ends the one before, haste and flat included.
    {
      const p = fresh({ genotype: "bent" });
      TN.injectTonic(game, p, "gloam", seq(0.9));
      m.status.catchUpStatuses(game, p, 31);
      const r = TN.injectTonic(game, p, "ironbark", seq(0.99, 0.9));
      if (!r.save || has(p, "tonic:gloam") || !has(p, "tonic:ironbark")) fail(`a Bent's gloam, then ironbark 31 s on: save ${JSON.stringify(r.save)}, ${JSON.stringify(Object.keys(p.status))}`);
      for (const [first, st] of [["hasp", "hasted"], ["foldSap", "flat"]]) {
        const q = fresh();
        TN.injectTonic(game, q, first, seq(0.9));
        const r2 = TN.injectTonic(game, q, "ironbark", seq(0.99));
        if (r2.overdose || has(q, st)) fail(`${first}, then a passed ironbark: ${st} still on (${JSON.stringify(Object.keys(q.status))})`);
      }
      const q = fresh();
      TN.injectTonic(game, q, "balm", seq(0.9)); m.status.catchUpStatuses(game, q, 3.5);
      const r3 = TN.injectTonic(game, q, "balm", seq(0.9));
      if (r3.save) fail("a balm after the last one's 3 s asked a save");
    }
    // The hasp's crash, played out and skipped alike: paralysed 3 s after its 15, gone by 40.
    {
      const run = (skip) => {
        const p = fresh(); TN.injectTonic(game, p, "ironbark", seq(0.9)); TN.injectTonic(game, p, "hasp", seq(0));
        const at = (sec) => { if (skip) m.status.catchUpStatuses(game, p, sec); else for (let k = 0; k < Math.round(sec * 60); k++) m.status.tickStatuses(game, p, 1 / 60); };
        at(16); const mid = +m.status.statusLeft(p, "paralyzed").toFixed(2);
        at(24); return [mid, has(p, "paralyzed")];
      };
      const played = run(false), skipped = run(true);
      if (JSON.stringify(played) !== JSON.stringify([2, false]) || JSON.stringify(skipped) !== JSON.stringify(played)) fail(`the hasp's crash: played ${JSON.stringify(played)}, skipped ${JSON.stringify(skipped)} (want 2 s left at 16 s, none at 40)`);
    }
    // An overdone balm: a fresh one 30 s later... still nothing while the sickness lasts.
    {
      const p = fresh(); p.hp = 4;
      TN.injectTonic(game, p, "ironbark", () => 0.9); TN.injectTonic(game, p, "balm", seq(0));
      m.status.catchUpStatuses(game, p, 20);
      const before = p.hp;
      TN.injectTonic(game, p, "balm", seq(0.9));
      m.status.catchUpStatuses(game, p, 4);
      if (!has(p, "tonic:sick") || p.hp !== before) fail(`a balm while sick healed ${p.hp - before}`);
    }
    // The item line reads the drinker's numbers: the Plumb's 12, the Bent's 6.
    {
      const it = { kind: "tonic", effect: "balm" };
      fresh({ genotype: "plumb" }); const plumb = I.itemInfo(game, it);
      fresh({ genotype: "bent" }); const bent = I.itemInfo(game, it);
      if (!plumb.startsWith("Heals 12") || !bent.startsWith("Heals 6")) fail(`the balm's line: "${plumb}" / "${bent}"`);
      out.lines = `${plumb.split(".")[0]} / ${bent.split(".")[0]}`;
    }
    // The Bent: half, and the bad reaction.
    {
      let p = fresh({ genotype: "bent" }); p.hp = 4;
      TN.injectTonic(game, p, "balm", seq(0.9));
      m.status.catchUpStatuses(game, p, 5);
      const ironbark = (TN.injectTonic(game, (p = fresh({ genotype: "bent" })), "ironbark", seq(0.9)), St.bonus(p, "av"));
      p = fresh({ genotype: "bent" }); TN.injectTonic(game, p, "clearwit", seq(0.9));
      const wit = [St.bonus(p, "examine"), St.bonus(p, "int")];   // half of +5 and +2, rounded down
      if (wit.join() !== "2,1") fail(`a Bent's clearwit: +${wit[0]} examine, +${wit[1]} INT, want +2 and +1`);
      p = fresh({ genotype: "bent" });
      const bad = TN.injectTonic(game, p, "hasp", seq(0.01));
      if (bad.k !== 0.5 || !bad.overdose || !has(p, "tonic:crash") || ironbark !== 1) fail(`the Bent: ironbark +${ironbark} armour, a bad reaction ${JSON.stringify(bad)}`);
      out.bent = `ironbark +${ironbark} armour, bad reaction on 0.01`;
    }
    // The rules' numbers, written out (bible §13.8): the save's edge and its TOU modifier; the chain's 60 s; the Bent's 5%
    // and halved times; the overdoses' times and effects; the values.
    {
      const tou20 = (p) => { p.attrs = { ...p.attrs, tou: 20 }; St.invalidateStats(p); return p; };   // TOU modifier +2
      let p = tou20(fresh()); TN.injectTonic(game, p, "ironbark", seq(0.9));
      const edge = TN.injectTonic(game, p, "gloam", seq(0.6));   // nat 13 + 2 = 15 against 15: a pass
      p = tou20(fresh()); TN.injectTonic(game, p, "ironbark", seq(0.9));
      const under = TN.injectTonic(game, p, "gloam", seq(0.55));   // nat 12 + 2 = 14: an overdose
      if (edge.overdose || edge.save?.total !== 15 || !under.overdose || under.save?.total !== 14) fail(`the save's edge with TOU 20: ${JSON.stringify(edge.save)} ${edge.overdose}, ${JSON.stringify(under.save)} ${under.overdose}`);
      p = fresh(); TN.injectTonic(game, p, "gloam", seq(0.9)); m.status.catchUpStatuses(game, p, 59);
      const at59 = TN.injectTonic(game, p, "ironbark", seq(0.99));
      p = fresh(); TN.injectTonic(game, p, "gloam", seq(0.9)); m.status.catchUpStatuses(game, p, 61);
      const at61 = TN.injectTonic(game, p, "ironbark", seq(0.99));
      if (!at59.save || at61.save) fail(`gloam's chain: a second at 59 s asked ${JSON.stringify(at59.save)}, at 61 s ${JSON.stringify(at61.save)}`);
      let bents = 0, plumbs = 0;
      const rng = m.rng.makeRng(77);
      for (let k = 0; k < 4000; k++) {
        const q = game.player;
        q.genotype = k % 2 ? "bent" : "plumb"; q.status = {}; St.invalidateStats(q);
        if (TN.injectTonic(game, q, "balm", rng).overdose) (k % 2 ? bents++ : plumbs++);
      }
      fresh();
      if (Math.abs(bents / 2000 - 0.05) > 0.015 || plumbs) fail(`bad reactions: the Bent ${bents} of 2000 (want about 5%), the Plumb ${plumbs}`);
      out.badReactions = `the Bent ${bents} of 2000, the Plumb ${plumbs}`;
      const od = (id, check) => { const q = fresh(); game.zone.seen.fill(1); game.zone.holeSeen.fill(1); TN.injectTonic(game, q, "ironbark", seq(0.9)); TN.injectTonic(game, q, id, seq(0)); return check(q); };
      const ods = {
        balm: od("balm", (q) => m.status.statusLeft(q, "tonic:sick") === 30 && m.status.statusFlag(q, "noRegen")),
        gloam: od("gloam", (q) => m.status.statusLeft(q, "blinded") === 20),   // (B1, C4 #10: blind in any light, player.js torchRange)
        ironbark: od("ironbark", (q) => m.status.statusLeft(q, "tonic:heavy") === 20 && m.status.statusSpeed(q) === 0.5),
        hasp: od("hasp", (q) => m.status.statusLeft(q, "hasted") === 15 && m.status.statusLeft(q, "tonic:crash") === 15),
        foldSap: od("foldSap", (q) => m.status.statusLeft(q, "flat") === 60),
        clearwit: od("clearwit", () => !game.zone.seen.some(Boolean) && !game.zone.holeSeen.some(Boolean)),
      };
      for (const [id, ok] of Object.entries(ods)) if (!ok) fail(`${id}'s overdose isn't the bible's`);
      const half = {};
      for (const [id, st, want] of [["hasp", "hasted", 7.5], ["foldSap", "flat", 5], ["gloam", "tonic:gloam", 60]]) {
        const q = fresh({ genotype: "bent" }); TN.injectTonic(game, q, id, seq(0.9));
        half[id] = m.status.statusLeft(q, st);
        if (half[id] !== want) fail(`a Bent's ${id}: ${st} ${half[id]} s, want ${want}`);
      }
      const VALUES = { balm: 25, hasp: 40, gloam: 35, ironbark: 45, foldSap: 50, clearwit: 35 };
      for (const [id, v] of Object.entries(VALUES)) if (I.itemPrice({ kind: "tonic", effect: id }) !== v) fail(`the ${id} tonic is worth ${I.itemPrice({ kind: "tonic", effect: id })}, want ${v}`);
      out.rules = `the save's edge 15 passes and 14 fails at TOU 20; the chain asks at 59 s, not 61; a Bent's hasp ${half.hasp} s, fold-sap ${half.foldSap} s`;
    }
    // The balm played out and skipped heal the same.
    {
      const a = fresh(); a.hp = 3; TN.injectTonic(game, a, "balm", seq(0.9));
      for (let k = 0; k < 6 * 60; k++) m.status.tickStatuses(game, a, 1 / 60);
      const played = a.hp;
      const b = fresh(); b.hp = 3; TN.injectTonic(game, b, "balm", seq(0.9));
      m.status.catchUpStatuses(game, b, 6);
      if (played !== 15 || b.hp !== 15) fail(`the balm: played out to ${played}, skipped to ${b.hp}, want 15 both`);
      out.balmExact = `${played} and ${b.hp}`;
    }
    stats.tonics = out;
  });

  section("kits", () => {
    const C = m.chargen, BG = m.backgrounds.BACKGROUNDS, out = {};
    const WANT = {
      reedcutter: [["weapon", "handAxe", "copper"], ["armour", "reedCloak"], ["tonic", "balm", null, 2]],
      mothTender: [["weapon", "lanternFlail", "copper"]],
      mesaRunner: [["weapon", "dagger", "bone"], ["armour", "stiltSandals"], ["knife", null, null, 6], ["missile", "sling"]],
      droversChild: [["weapon", "shortsword", "copper"]],
      hushNovice: [["weapon", "dagger", "bone"], ["vial", "umbra"]],
      pressedPilgrim: [["weapon", "staff", "bone"], ["armour", "mapCase"], ["vial", "ink", null, 3], ["tool", "markerChalk", null, 12]],
      archivistOfVey: [["weapon", "stylus", "bone"], ["armour", "examiningKit"]],
      surveyorOfVey: [["armour", "mapCase"], ["missile", "boltBow"], ["ammo", "bolt", null, 20]],
      forgehandOfOrrum: [["weapon", "mace", "iron"], ["armour", "leather"]],
      aspirantOfTheRule: [["weapon", "longsword", "iron"], ["armour", "chain", "iron"], ["armour", "assizeWrit"]],
      lamplighterOfCassin: [["artifact", "glimgun"]],
      nightWardenOfCassin: [["weapon", "dagger", "copper"]],
    };
    for (const [bg, want] of Object.entries(WANT)) {
      const B = BG[bg], p = C.makeCharacter({ genotype: B.genotype, background: bg, attrs: C.suggestSpread(B.genotype, bg), name: "Test", mode: "oneWick" });
      const all = [...Object.values(p.body.equip).filter((v) => v && typeof v === "object"), p.body.belt, ...p.inv].filter(Boolean);
      for (const [kind, id, made, count] of want) {
        const it = all.find((x) => x.kind === kind && (id === null || x.id === id || x.effect === id) && (!made || x.made === made));
        if (!it) { fail(`${bg}: no ${made ? made + " " : ""}${kind} ${id || ""}`); continue; }
        if (count && it.count !== count) fail(`${bg}: ${count} ${id || kind} wanted, ${it.count} in the kit`);
        if (made && it.kind === "weapon" && it.material !== F.MATERIALS[made].dmg) fail(`${bg}: a ${made} ${id} with material ${it.material}`);
      }
      for (const it of all) { const n = I.itemName(game, it); if (!n || /undefined|NaN/.test(n)) fail(`${bg}: a kit piece named ${JSON.stringify(n)}`); }
      out[bg] = all.map((it) => I.itemName(game, it)).join(", ");
    }
    if (BG.nightWardenOfCassin && !(BG.nightWardenOfCassin.kit.belt?.made === "copper")) fail("the Night-warden's second copper dagger is not on the belt");
    stats.kits = out;
  });

  section("waiting", () => {
    const ART = ["homingPip", "programmablePip", "plumbBob", "theodolite", "lanternMote", "snuffer", "shadowLamp", "paneCutter", "unpressLens",
      "handPress", "echoBell", "bridgeReel", "featherfallLantern", "jumpSprings", "glimgun", "lancet", "forcePane", "mirrorShield", "stillDial",
      "foldKnife", "beatBox", "turnKey", "kiteDrone", "inkStamp", "quicksilverLevel", "heightLens", "recallBead", "rotationPip", "noonglass", "greatTheodolite"];
    const live = ARC.ARTIFACTS, wait = ARC.ARTIFACTS_WAITING;
    const have = new Set([...Object.keys(live), ...Object.keys(wait)]);
    for (const id of ART) if (!have.has(id)) fail(`artifact ${id} (bible §13.4) is in neither table`);
    if (have.size !== ART.length) fail(`${have.size} artifacts and relics, want the bible's ${ART.length}`);
    for (const id in wait) {
      const d = wait[id];
      if (live[id]) fail(`${id} is both live and waiting`);
      if (!(typeof d.needs === "string" && d.needs.length > 10) || !d.name || !d.info) fail(`waiting artifact ${id}: name, info and needs`);
      if (d.relic && !(d.flat && d.deep && /^[a-z \n]+$/.test(d.dark || ""))) fail(`relic ${id}: its three registers (dark "${d.dark}")`);
    }
    const MUT = { physical: ["shellback", "thistlehide", "extraArms", "wings", "stiltLegs", "geckoPads", "lampskin", "nightEyes", "diggingHands", "regeneration",
      "spareHeart", "bellowsThroat", "inkGlands", "flatwise", "deepEyes", "heavyBones", "gills", "horns", "silkGlands", "echoThroat"],
      mental: ["foldStep", "overlook", "shadowsense", "kindle", "snuff", "endear", "muddle", "forcePlane", "timeLag", "foresight", "backglass", "readhand"],
      defect: ["lightsick", "brittleBones", "shadowless", "mothKissed", "sleepwalker", "crookedManner", "beatDeaf", "darkFear"] };
    const PLANAR = ["wings", "stiltLegs", "geckoPads", "lampskin", "nightEyes", "inkGlands", "flatwise", "deepEyes", "heavyBones", "gills", "silkGlands", "echoThroat",
      "foldStep", "overlook", "shadowsense", "kindle", "snuff", "forcePlane", "foresight"];
    const REFUND = { lightsick: 2, brittleBones: 3, shadowless: 3, mothKissed: 2, sleepwalker: 2, crookedManner: 2, beatDeaf: 3, darkFear: 3 };
    const MU = m.mutationsContent, all = { ...MU.MUTATIONS, ...MU.MUTATIONS_WAITING };
    for (const [kind, ids] of Object.entries(MUT)) for (const id of ids) {
      const d = all[id];
      if (!d) { fail(`mutation ${id} (bible §13.5) is in neither table`); continue; }
      if (d.kind !== kind) fail(`${id}: ${d.kind}, want ${kind}`);
      if (!!d.planar !== PLANAR.includes(id)) fail(`${id}: planar ${!!d.planar}`);
      if (kind === "defect" ? d.cost !== -REFUND[id] : d.cost !== 4) fail(`${id}: cost ${d.cost}`);
      if (MU.MUTATIONS[id] && MU.MUTATIONS_WAITING[id]) fail(`${id} is both live and waiting`);
      if (MU.MUTATIONS_WAITING[id] && !(typeof d.needs === "string" && d.needs.length > 10)) fail(`waiting mutation ${id} says nothing of what it needs`);
      for (const x of d.excludes || []) if (!all[x]) fail(`${id} excludes ${x}, which is no mutation`);
      if (typeof d.info(1) !== "string" || typeof d.info(10) !== "string") fail(`${id}: info`);
    }
    if (Object.keys(all).length !== 40) fail(`${Object.keys(all).length} mutations, want the bible's 40`);
    // None waiting is offered: 300 seeded offers to a fresh Bent with creases to spare.
    const p = fresh({ genotype: "bent" }); p.mutations = {}; p.creases = 99;
    let offered = 0;
    for (let k = 0; k < 300; k++) for (const id of m.mutations.mutationOffers(game, p, m.rng.makeRng(k))) { offered++; if (MU.MUTATIONS_WAITING[id]) fail(`a waiting mutation offered: ${id}`); }
    // ...nor laid as loot.
    let mods = 0;
    for (let k = 0, rng = m.rng.makeRng(5); k < 2000; k++) { const it = AR.randomBodyMod(rng, 1 + (k % 30)); mods++; if (it.kind === "artifact" && wait[it.id]) fail(`randomBodyMod laid a waiting ${it.id}`); }
    stats.waiting = `${Object.keys(live).length} artifacts live and ${Object.keys(wait).length} waiting (${Object.values(wait).filter((d) => d.relic).length} relics); ` +
      `${Object.keys(MU.MUTATIONS).length} mutations live and ${Object.keys(MU.MUTATIONS_WAITING).length} waiting; ${offered} offers and ${mods} loot draws, none waiting`;
  });

  // A history relic's ability ids (strings) aren't bonuses (integrator, C2 #10: their letters were walked as keys "0"…).
  {
    const base = { kind: "amulet", id: Object.keys(I.AMULETS)[0] }, b0 = I.itemBonuses(base);
    const b = I.itemBonuses({ ...base, histRelic: true, powers: ["saltWard", { wil: 2 }] });
    const keys = Object.keys(b).filter((k) => !St.BONUS_KEYS.includes(k));
    if (keys.length || (b.wil || 0) - (b0.wil || 0) !== 2) problems.push(`a relic with an ability id and +2 WIL: bonuses ${JSON.stringify(b)}`);
  }
  return { name: "items: C4's gear", ok: problems.length === 0, problems, stats };
}

// --- B1: gear and powers (the backlog of C4's and WS5's requests, 2026-10-30) ------------------------------------------
// checkB1Gear(m) → { name: "items: B1's gear", ok, problems, stats }: each applied request held, written out here.
//   1. The real world's loot (C4 #1): lootGear and lootPotion give the parent's draws exactly off the real world
//      (the same rng, the same items) and C4's gear and tonics on it; a real-world run's dungeon floors, surface
//      rewards, elite drops and merchants' shelves draw C4's gear (forged weapons in a material, no parent weapon) and
//      tonics; the test world's dungeons none.
export function checkB1Gear(m) {
  const problems = [], stats = {};
  const fail = (msg) => problems.push(msg);
  const { game, startRun } = m.game, I = m.items;
  const section = (name, fn) => { try { fn(); } catch (err) { fail(`${name}: threw ${err.stack?.split("\n").slice(0, 3).join(" / ") || err}`); } };
  const c4Gear = (it) => (it.kind === "weapon" && !!it.made) || (it.kind === "missile" && (it.id === "sling" || !!it.made)) ||
    (it.kind === "armour" && (!!it.made || !m.forge.FORGED.armour.includes(it.id)));
  const isGearKind = (it) => ["weapon", "armour", "missile"].includes(it?.kind);

  section("loot", () => {
    // Off the real world: the parent's draws, draw for draw.
    for (let k = 0; k < 300; k++) {
      const a = m.rng.makeRng(900 + k), b = m.rng.makeRng(900 + k), depth = 1 + (k % 20);
      const x = I.lootGear(a, depth, 0.15, false), y = I.randomEquipment(b, depth, 0.15);
      if (JSON.stringify(x) !== JSON.stringify(y) || a() !== b()) { fail(`lootGear off the real world drew ${JSON.stringify(x)}, randomEquipment ${JSON.stringify(y)}`); break; }
      const a2 = m.rng.makeRng(k), b2 = m.rng.makeRng(k);
      if (JSON.stringify(I.lootPotion(a2, false)) !== JSON.stringify(I.randomPotion(b2)) || a2() !== b2()) { fail("lootPotion off the real world isn't randomPotion"); break; }
    }
    // On it: C4's gear and a share of tonics.
    let forged = 0, tonics = 0, potions = 0;
    for (let k = 0; k < 2000; k++) {
      const it = I.lootGear(m.rng.makeRng(7000 + k), 1 + (k % 26), 0.15, true);
      if (!c4Gear(it)) fail(`lootGear on the real world drew the parent's ${it.kind} ${it.id} (no material)`);
      if (it.made) forged++;
      const pt = I.lootPotion(m.rng.makeRng(k), true);
      if (pt.kind === "tonic") tonics++; else if (pt.kind === "potion") potions++;
      else fail(`lootPotion drew a ${pt.kind}`);
    }
    if (Math.abs(tonics / 2000 - I.TONIC_SHARE) > 0.04) fail(`lootPotion on the real world: ${tonics} tonics in 2000, want about ${I.TONIC_SHARE * 2000}`);
    stats.loot = `off the real world 300 gear and potion draws equal to the parent's; on it 2000 gear draws all C4's (${forged} forged), ${tonics} tonics and ${potions} potions`;

    // A real-world run: its dungeon floors; the same seed's test world.
    const counts = { real: { gear: 0, parent: 0, tonic: 0, zones: 0 }, test: { gear: 0, parent: 0, tonic: 0, zones: 0 } };
    for (const [name, world] of [["real", m.worldmap.REAL_WORLD], ["test", m.testWorld.TEST_WORLD]]) {
      startRun(11, world);
      const run = game.run, c = counts[name];
      for (const site of run.sites.values()) {
        if (!site.dungeon || site.dungeon.legacy || c.zones >= 30) continue;
        for (let z = 1; z <= Math.min(2, site.dungeon.levels); z++) {
          const zone = m.zones.ZONE_GENERATORS.dungeon(game, { wx: site.at.wx, wy: site.at.wy, z });
          if (!zone) continue;
          c.zones++;
          if (!!zone.realLoot !== (name === "real")) fail(`${name} ${site.id} level ${z}: realLoot ${zone.realLoot}`);
          for (const it of zone.items) {
            if (it.kind === "tonic") c.tonic++;
            if (!isGearKind(it)) continue;
            if (c4Gear(it) && (name === "real" || it.made)) c.gear++; else c.parent++;
          }
        }
      }
    }
    const R = counts.real, T = counts.test;
    if (R.zones < 20 || R.parent > 0 || R.gear < 10 || R.tonic < 3) fail(`real-world dungeon floors: ${JSON.stringify(R)} (want C4's gear only, and tonics)`);
    if (T.tonic > 0 || T.gear > 0 || T.parent < 5) fail(`test-world dungeon floors: ${JSON.stringify(T)} (want the parent's gear only, no tonics)`);
    // Surface rewards (on and off the real world), elite drops, a merchant's shelf.
    const sr = { gear: 0, parent: 0, tonic: 0 };
    for (let k = 0; k < 600; k++) {
      const it = m.common.surfaceReward(m.rng.makeRng(k), 2 + (k % 24), true);
      if (it.kind === "tonic") sr.tonic++;
      else if (isGearKind(it)) c4Gear(it) ? sr.gear++ : sr.parent++;
      const t = m.common.surfaceReward(m.rng.makeRng(k), 2 + (k % 24), false);
      if (t.kind === "tonic" || (isGearKind(t) && t.made)) { fail(`surfaceReward off the real world drew ${JSON.stringify(t)}`); break; }
    }
    if (sr.parent || sr.gear < 200 || sr.tonic < 10) fail(`surfaceReward on the real world: ${JSON.stringify(sr)}`);
    startRun(11, m.worldmap.REAL_WORLD);
    const p = game.player, zone = game.zone, drops = { gear: 0, parent: 0, tonic: 0 };
    const rand = Math.random;
    try {
      let s = 1;
      Math.random = () => (((s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0)) / 4294967296);
      for (let k = 0; k < 200; k++) {
        const c = m.creatures.addCreature(zone, m.creatures.spawnCreature("goblin", Math.floor(p.x), Math.floor(p.y), p.z, { level: 14, elite: true, rng: () => 0.5 }));
        const before = zone.items.length;
        m.monsters.killMonster(game, c, "", true, true);
        for (const it of zone.items.slice(before)) {
          if (it.kind === "tonic") drops.tonic++;
          else if (isGearKind(it)) c4Gear(it) ? drops.gear++ : drops.parent++;
        }
        zone.items.length = before;
      }
    } finally { Math.random = rand; }
    if (drops.parent || drops.gear < 20 || drops.tonic < 10) fail(`a real-world elite's drops: ${JSON.stringify(drops)}`);
    const trader = { type: "villager", level: 9, talk: { state: {} }, merchant: { stock: "general" }, uid: "b1-trader" };
    const shelf = m.merchants.restock(game, trader).map((s) => s.item);
    if (!shelf.some((it) => it.kind === "tonic") || shelf.some((it) => isGearKind(it) && !c4Gear(it)) || !shelf.some((it) => it.made))
      fail(`a real-world merchant's shelf: ${shelf.map((it) => `${it.kind}:${it.id || it.effect}${it.made ? `(${it.made})` : ""}`).join(", ")}`);
    stats.lootWorld = `real dungeon floors ${JSON.stringify(R)}, test ${JSON.stringify(T)}; surface rewards ${JSON.stringify(sr)}; elite drops ${JSON.stringify(drops)}; a shelf of ${shelf.length}`;
  });

  // 2. Light (WS5 #19, WS6b #3, C4 #10): the lantern-mote lights 6 tiles torch or no and counts you lit (light.js inDark);
  //    the Snuffer's mark takes a tile off a lit torch; gloam's 6 tiles with the torch out (3 for the Bent); blinded leaves
  //    a tile in any light, the dark sight with the torch out.
  section("light", () => {
    startRun(13, m.testWorld.TEST_WORLD);
    const s0 = game.run.world.start;
    game.debug.enterZone(`${s0.wx},${s0.wy},3`, "down");   // (a dungeon floor of the legacy stack: dark)
    const p = game.player, P = m.player, L = m.light, S = m.status;
    p.status = {}; p.mutations = {}; p.torch = false; p.snufferMark = false; m.stats.invalidateStats(p);
    const dark0 = P.torchRange(p), darkHere = L.inDark(game, game.zone, p.x, p.y, p.z);
    S.addStatus(game, p, "running:lanternMote", { t: 100 });
    const mote = P.torchRange(p), motePow = P.torchPower(p), moteDark = L.inDark(game, game.zone, p.x, p.y, p.z);
    p.torch = true;
    const moteLit = P.torchRange(p);
    S.removeStatus(game, p, "running:lanternMote"); p.torch = false;
    if (!darkHere || dark0 > 0 || mote !== P.MOTE_RANGE || motePow < P.MOTE_POWER || moteDark || moteLit < P.MOTE_RANGE)
      fail(`the lantern-mote: torch out ${dark0} → ${mote} tiles (power ${motePow}), in the dark ${darkHere} → ${moteDark}; lit ${moteLit}`);
    p.torch = true;
    const lit = P.torchRange(p);
    p.snufferMark = true;
    const marked = P.torchRange(p);
    p.snufferMark = false;
    if (Math.abs(lit - marked - 1) > 1e-9) fail(`the Snuffer's mark: a lit torch ${lit} → ${marked}, want a tile less`);
    p.torch = false;
    p.genotype = "plumb"; m.tonics.injectTonic(game, p, "gloam", () => 0.99);
    const gloam = P.torchRange(p);
    S.removeStatus(game, p, "tonic:gloam"); S.removeStatus(game, p, "tonic");
    p.genotype = "bent"; m.tonics.injectTonic(game, p, "gloam", () => 0.99);
    const gloamBent = P.torchRange(p);
    S.removeStatus(game, p, "tonic:gloam"); S.removeStatus(game, p, "tonic");
    if (gloam !== 6 || gloamBent !== 3) fail(`gloam with the torch out: ${gloam} tiles (want 6), a Bent's ${gloamBent} (want 3: half)`);
    S.addStatus(game, p, "nightEyes", { t: 100 });   // (a little dark sight, so the dark's range isn't 0)
    const sight = P.torchRange(p);
    S.addStatus(game, p, "blinded", { t: 20 });
    const blindDark = P.torchRange(p);
    p.torch = true;
    const blindLit = P.torchRange(p);
    S.removeStatus(game, p, "blinded"); S.removeStatus(game, p, "nightEyes");
    if (blindLit > 1 || !(sight > 0) || blindDark !== sight) fail(`blinded: ${blindLit} tiles with the torch lit (want 1 at most), ${blindDark} with it out (want the dark sight's ${sight})`);
    stats.light = `the lantern-mote ${mote} tiles torch out (lit counted); a lit torch ${lit} → ${marked} with the Snuffer's mark; gloam ${gloam} (a Bent's ${gloamBent}); blinded ${blindLit} lit`;
  });

  // 3. The survey lens and grip soles (WS5 #9): on a dark floor one 3D frame with the torch out marks the map within
  //    twice the reach with the lens (more tiles, none past twice); grip soles climb 2 blocks on the map, 1 without.
  section("survey", () => {
    startRun(13, m.testWorld.TEST_WORLD);
    // A dark hall 40 × 17 (no sky, no lamps): only your torch lights it.
    const W = m.world, z = new W.Zone({ key: "b1-survey", wx: 97, wy: 97, z: 1, type: "dungeon", level: 3, seed: 3, w: 40, d: 17, h: 8, name: "Survey Hall" });
    for (let y = 0; y < z.d; y++) for (let x = 0; x < z.w; x++) { for (let k = 0; k < W.FLOOR_Z; k++) z.set(x, y, k, W.B.ROCK); z.set(x, y, W.FLOOR_Z + 4, W.B.ROCK); }   // (a roof: no sky light)
    z.hasSky = false; z.edges = { n: null, s: null, e: null, w: null }; z.refresh();
    z.spawn = { x: 2.5, y: 8.5, z: W.FLOOR_Z, yaw: 0 };
    m.zones.enterZone(game, z.seal(), { how: "start" });
    const p = game.player, R = m.render3d;
    Object.assign(p, { x: 2.5, y: 8.5, z: W.FLOOR_Z, yaw: 0, pitch: 0 });
    R.setDynamicResolution(false);
    p.status = {}; p.mutations = {}; p.torch = true; m.stats.invalidateStats(p);
    const reach = m.player.torchRange(p);
    const frame = () => { z.seen.fill(0); game.effects = []; game.cam = null; game.fov = 75; game.view = "3d"; game.mode = "explore"; game.paused = false; Object.assign(p, { yaw: 0, pitch: 0 }); R.render3d(game); };
    const far = () => { let n = 0, max = 0; for (let i = 0; i < z.w * z.d; i++) if (z.seen[i]) { n++; max = Math.max(max, Math.hypot((i % z.w) + 0.5 - p.x, Math.floor(i / z.w) + 0.5 - p.y)); } return { n, max }; };
    frame(); const plain = far();
    p.body.implants.head = { kind: "implant", id: "surveyLens" }; m.stats.invalidateStats(p);
    frame(); const lens = far();
    p.body.implants.head = null; m.stats.invalidateStats(p);
    if (!(lens.n > plain.n) || !(lens.max > reach + 1.5) || lens.max > 2 * reach + 2 || plain.max > reach + 2)
      fail(`the survey lens: a 3D frame marked ${plain.n} tiles to ${plain.max.toFixed(1)} without it, ${lens.n} to ${lens.max.toFixed(1)} with it (the torch's reach ${reach})`);
    stats.survey = `one 3D frame on a dark floor: ${plain.n} tiles to ${plain.max.toFixed(1)} without the lens, ${lens.n} to ${lens.max.toFixed(1)} with it (reach ${reach})`;
    // Grip soles: a 2-block step on the map.
    game.view = "map"; game.mode = "map";
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    let dir = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = tx + dx, y = ty + dy;
      if (!z.solid(x, y, p.z) && z.stand[x + y * z.w] === p.z && !z.creatures.some((c) => Math.floor(c.x) === x && Math.floor(c.y) === y)) { dir = [dx, dy]; break; }
    }
    if (!dir) { fail("grip soles: no open tile beside you"); return; }
    const [x, y] = [tx + dir[0], ty + dir[1]];
    for (let k = 0; k < 2; k++) z.set(x, y, p.z + k, m.world.B.STONE);
    z.refresh();
    const tryStep = () => { const from = { x: p.x, y: p.y, z: p.z }; m.turns.mapStep(game, dir[0], dir[1], { force: false }); const moved = Math.floor(p.x) === x && Math.floor(p.y) === y; Object.assign(p, from); return moved; };
    const without = tryStep();
    p.body.implants.feet = { kind: "implant", id: "gripSoles" }; m.stats.invalidateStats(p);
    const withSoles = tryStep();
    p.body.implants.feet = null; m.stats.invalidateStats(p);
    p.body.equip.arms = m.gear.makeGear("armour", "climbingHooks"); m.stats.invalidateStats(p);   // (the climbing hooks, C4 #6)
    const withHooks = tryStep();
    p.body.equip.arms = null; m.stats.invalidateStats(p);
    if (!withHooks) fail("the climbing hooks: a 2-block step on the map refused");
    for (let k = 0; k < 2; k++) z.set(x, y, p.z + k, m.world.B.AIR);
    z.refresh();
    if (without || !withSoles) fail(`grip soles: a 2-block step on the map ${without ? "taken" : "refused"} without them, ${withSoles ? "taken" : "refused"} with them`);
    stats.gripSoles = "a 2-block step on the map refused without them, taken with them";
  });

  // 4. The tonics' and implants' rest (C4 #10, #14) and the missile powers (C4 #9): an overdone balm stops a potion of
  //    healing too; Alchemist's balm heals 18 over 3 s; the balm pump injects a balm from the pack when a blow leaves you
  //    under 40% (not above, not without the pump, not while a balm works); Glimgunner pays a glim every second shot;
  //    Pin: a bolt's pin 3 s, 2 without.
  section("tonics and implants", () => {
    startRun(13, m.testWorld.TEST_WORLD);
    const p = game.player, S = m.status, E = m.events, TN = m.tonics;
    const reset = () => { p.status = {}; p.perks = {}; p.body.implants = Object.fromEntries(Object.keys(p.body.implants).map((k) => [k, null])); p.maxHpGain = 20; m.stats.invalidateStats(p); p.hp = 5; };   // (room to heal 18)
    const settle = () => { for (let k = 0; k < 200; k++) S.tickStatuses(game, p, 1 / 60); };
    reset(); m.effects.drinkPotion(game, "healing"); const potion = p.hp - 5;
    reset(); S.addStatus(game, p, "tonic:sick", { t: 30 }); m.effects.drinkPotion(game, "healing"); const sick = p.hp - 5;
    reset(); p.genotype = "plumb"; TN.injectTonic(game, p, "balm"); settle(); const balm = p.hp - 5;
    reset(); p.perks = { alchemist: 1 }; TN.injectTonic(game, p, "balm"); settle(); const alch = p.hp - 5;
    if (potion !== 12 || sick !== 0 || balm !== 12 || alch !== 18) fail(`healing: a potion ${potion}, overdone ${sick}; a balm ${balm}, with Alchemist ${alch} (want 12, 0, 12, 18)`);
    // The balm pump.
    const pump = (hpShare, fitted, working = false) => {
      reset(); p.hp = Math.floor(m.stats.maxHp(p) * hpShare);
      if (fitted) p.body.implants.back = { kind: "implant", id: "balmPump" };
      if (working) S.addStatus(game, p, "tonic:balm", { t: 3, mag: 1 });
      p.inv = p.inv.filter((s) => s.kind !== "tonic"); p.inv.push({ kind: "tonic", effect: "balm", count: 2 });
      E.emit(game, "hurt", { tgt: p, src: null, dmg: 1 });
      return p.inv.find((s) => s.kind === "tonic")?.count ?? 0;
    };
    const used = pump(0.3, true), above = pump(0.5, true), none = pump(0.3, false), busy = pump(0.3, true, true);
    const sickPump = (() => { reset(); p.hp = Math.floor(m.stats.maxHp(p) * 0.3); p.body.implants.back = { kind: "implant", id: "balmPump" }; S.addStatus(game, p, "tonic:sick", { t: 30 });
      p.inv = p.inv.filter((s) => s.kind !== "tonic"); p.inv.push({ kind: "tonic", effect: "balm", count: 2 }); E.emit(game, "hurt", { tgt: p, src: null, dmg: 1 }); return p.inv.find((s) => s.kind === "tonic")?.count ?? 0; })();
    if (used !== 1 || above !== 2 || none !== 2 || busy !== 2 || sickPump !== 2) fail(`the balm pump: at 30% ${2 - used} used (want 1), at 50% ${2 - above}, without it ${2 - none}, a balm working ${2 - busy}, balm-sick ${2 - sickPump}`);
    reset(); p.hp = Math.floor(m.stats.maxHp(p) * 0.3); p.body.implants.back = { kind: "implant", id: "balmPump" };
    p.inv.push({ kind: "tonic", effect: "balm", count: 1 }); E.emit(game, "hurt", { tgt: p, src: null, dmg: 1 });
    if (!S.hasStatus(p, "tonic:balm")) fail("the balm pump's balm doesn't work");
    // Glimgunner.
    const shots = (perk) => {
      reset(); if (perk) p.perks = { glimgunner: 1 };
      const gun = { kind: "artifact", id: "glimgun", known: true }; p.inv.push(gun);
      m.currency.setPurse?.(p, "flask500"); p.funds = 10;
      for (let k = 0; k < 4; k++) m.artifacts.fireArtifact(game, p, gun, null);
      p.inv.splice(p.inv.indexOf(gun), 1);
      return 10 - m.currency.funds(p);
    };
    const paid = shots(false), paidGunner = shots(true);
    if (paid !== 4 || paidGunner !== 2) fail(`the glimgun: 4 shots paid ${paid} glim, with Glimgunner ${paidGunner} (want 4 and 2)`);
    // Pin.
    const pinFor = (perk) => {
      reset(); if (perk) p.perks = { pin: 1 };
      const c = { status: {}, x: 0, y: 0, z: 0, type: "goblin", name: "goblin" };
      const spec = m.missiles.missileSpec(p, { kind: "missile", id: "boltBow", ench: 0 });
      const rng = game.combatRng; game.combatRng = () => 0;
      try { spec.onHit(game, c, {}); } finally { game.combatRng = rng; }
      return c.status.pinned?.t;
    };
    const pin0 = pinFor(false), pin1 = pinFor(true);
    if (pin0 !== 2 || pin1 !== 3) fail(`Pin: a bolt's pin ${pin0} s, with Pin ${pin1} s (want 2 and 3)`);
    p.hp = m.stats.maxHp(p);
    stats.tonics = `a potion ${potion}, overdone ${sick}; a balm ${balm}, Alchemist's ${alch}; the pump at 30% used 1, at 50% none; the glimgun 4 shots ${paid} glim, Glimgunner ${paidGunner}; pins ${pin0} s, ${pin1} s with Pin`;
  });

  // 5. The pack's comparison (C4 #12): the material counts (a noonsilver dagger against a copper one: +6 × 0.3 ÷ 0.7 → +3
  //    a blow; saltsteel scale against iron scale +1 armour); the parent's gear reads as before (a longsword against a
  //    dagger: the difference of their ranges' middles, the old line).
  section("compare", () => {
    startRun(13, m.testWorld.TEST_WORLD);
    const p = game.player, G = m.gear, line = (sel) => m.inventory.compareLine(p, sel);
    p.body.equip.hand_r = G.makeGear("weapon", "dagger", "copper"); p.body.equip.body = G.makeGear("armour", "scale", "iron"); m.stats.invalidateStats(p);
    const silver = line(G.makeGear("weapon", "dagger", "noonsilver")), scale = line(G.makeGear("armour", "scale", "saltsteel"));
    p.body.equip.hand_r = { kind: "weapon", id: "dagger", ench: 0, known: true };
    const parent = line({ kind: "weapon", id: "longsword", ench: 2, known: false }), W = I.WEAPONS;
    const old = (W.longsword.dmg[0] + W.longsword.dmg[1]) / 2 - (W.dagger.dmg[0] + W.dagger.dmg[1]) / 2;
    if (silver !== " · +3 avg damage vs yours" || scale !== " · +1 armour vs yours" || parent !== ` · +${old} avg damage vs yours`)
      fail(`the pack's comparison: a noonsilver dagger "${silver}", saltsteel scale "${scale}", the parent's longsword "${parent}"`);
    stats.compare = `"${silver}", "${scale}", "${parent}"`;
  });

  // 6. The artifacts built (C4 #7): the homing pip takes you from a dungeon floor to the run's start (not with a hostile
  //    within 7 tiles, its charge then kept); the snuffer's circle is dark with the torch lit, 6 tiles round, for 20 s;
  //    the theodolite finds the sites of the spans around you (the real world's) and makes them known.
  section("artifacts", () => {
    const art = (id) => ({ kind: "artifact", id, known: true, cell: { id: "glim", charge: 2500 } });
    startRun(13, m.testWorld.TEST_WORLD);
    const s0 = game.run.world.start, home = `${s0.wx},${s0.wy},0`;
    game.debug.enterZone(`${s0.wx},${s0.wy},3`, "down");
    let p = game.player;
    const pip = art("homingPip");
    game.zone.creatures = game.zone.creatures.filter((c) => c.talk);
    const foe = m.creatures.addCreature(game.zone, m.creatures.spawnCreature("goblin", Math.floor(p.x), Math.floor(p.y), p.z, { level: 3, state: "chase", rng: () => 0.5 }));
    const refused = m.artifacts.fireArtifact(game, p, pip, null), keptCharge = pip.cell.charge, stayed = game.zone.key;
    m.creatures.removeCreature(game.zone, foe);
    const went = m.artifacts.fireArtifact(game, p, pip, null);
    if (refused || keptCharge !== 2500 || stayed === home || !went || game.zone.key !== home || pip.cell.charge !== 0)
      fail(`the homing pip: with a goblin beside you ${refused} (charge ${keptCharge}, in ${stayed}); alone ${went}, now in ${game.zone.key} (want ${home}), charge ${pip.cell.charge}`);
    // The snuffer, in the dark of a legacy floor with the torch lit.
    game.debug.enterZone(`${s0.wx},${s0.wy},3`, "down");
    p = game.player; p.torch = true;
    const L = m.light, at = (dx) => L.inDark(game, game.zone, p.x + dx, p.y, p.z + 1);
    const before = at(0);
    m.artifacts.fireArtifact(game, p, art("snuffer"), null);
    const here = at(0), five = at(5), eight = at(8);
    game.time += 21;
    const after = at(0);
    if (before || !here || !five || eight || after) fail(`the snuffer: lit before ${!before}; dark here ${here}, 5 tiles off ${five}, 8 off ${eight}; 21 s on ${after}`);
    // The theodolite, on the real world.
    startRun(17, m.worldmap.REAL_WORLD);
    // (standing in the span east of a site, so the site found is a neighbour's)
    const open = (wx, wy) => game.run.world.tileAt(wx, wy)?.edges === "open" && !game.run.world.tileAt(wx, wy)?.landmark;
    const site = [...game.run.sites.values()].find((s) => s.kind !== "landmark" && s.kind !== "village" && open(s.at.wx + 1, s.at.wy));
    game.debug.enterZone(`${site.at.wx + 1},${site.at.wy},0`, "start");
    p = game.player;
    const z = game.zone, A = game.state.atlas, around = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const id of game.run.sitesAt?.get(`${z.wx + dx},${z.wy + dy}`) || []) { const s = game.run.sites.get(id); if (s && s.kind !== "landmark") around.push(s); }
    for (const s of around) delete A.found[s.id];
    m.artifacts.fireArtifact(game, p, art("theodolite"), null);
    const found = around.filter((s) => A.found[s.id] === "theodolite").length;
    if (!around.length || found !== around.length || A.found[site.id] !== "theodolite" || !m.discovery.isKnown(game, z.wx + 1, z.wy)) fail(`the theodolite: ${found} of the ${around.length} sites around ${z.wx},${z.wy} found; the next span known ${m.discovery.isKnown(game, z.wx + 1, z.wy)}`);
    // The kits that wanted them (C4 #13): the Hush Novice's and the Night-warden's snuffer (3 uses), the Surveyor's
    // theodolite (5), known and charged; no kit wants either any more.
    const CG = m.chargen, BG = m.backgrounds.BACKGROUNDS, kits = { hushNovice: ["snuffer", 3], nightWardenOfCassin: ["snuffer", 3], surveyorOfVey: ["theodolite", 5] };
    for (const [bg, [id, uses]] of Object.entries(kits)) {
      const pc = CG.makeCharacter({ genotype: BG[bg].genotype, background: bg, attrs: CG.suggestSpread(BG[bg].genotype, bg), name: "Test", mode: "oneWick" });
      const it = pc.inv.find((x) => x.kind === "artifact" && x.id === id), need = m.artifactTables.ARTIFACTS[id]?.charge;
      if (!it || it.known !== true || !(it.cell?.charge >= uses * need) || it.cell.charge >= (uses + 1) * need || BG[bg].kit.wants.some((w) => w.includes(id)))
        fail(`${bg}'s kit: ${id} ${JSON.stringify(it)} (want known, ${uses} uses of ${need}); wants ${JSON.stringify(BG[bg].kit.wants)}`);
    }
    stats.artifacts = `the homing pip home from a floor (refused with a goblin by you); the snuffer dark 5 tiles off with the torch lit, not 8, not after 20 s; the theodolite ${found} sites around ${z.wx},${z.wy}`;
  });

  // 7. Recharge and Kindle at range (C4 #9): a sun or dark cell fills from the purse only with Recharge (a heart cell
  //    never); a cold brazier 3.5 tiles off is E's to light in 3D with Kindle at range and the torch lit, not without
  //    the power, not with the torch out, not 5.5 tiles off.
  section("recharge and kindle", () => {
    startRun(13, m.testWorld.TEST_WORLD);
    const p = game.player;
    const fill = (id, perk) => { p.perks = perk ? { recharge: 1 } : {}; p.funds = 100; const c = { kind: "cell", id, charge: 0 }; const t = I.useItem(game, p, c); return { t, charge: c.charge, paid: 100 - m.currency.funds(p) }; };
    const sun0 = fill("sun", false), sun1 = fill("sun", true), dark1 = fill("dark", true), heart1 = fill("heart", true), glim0 = fill("glim", false);
    if (sun0.t || sun0.charge || !sun1.t || sun1.charge !== 2500 || sun1.paid !== 25 || dark1.charge !== 2500 || heart1.charge || glim0.charge !== 2500)
      fail(`Recharge: a sun cell without it ${JSON.stringify(sun0)}, with it ${JSON.stringify(sun1)}; a dark cell ${JSON.stringify(dark1)}; a heart cell ${JSON.stringify(heart1)}; a glim cell without it ${JSON.stringify(glim0)}`);
    p.perks = {};
    // Kindle at range, in a hall.
    const W = m.world, z = new W.Zone({ key: "b1-kindle", wx: 98, wy: 98, z: 1, type: "dungeon", level: 3, seed: 3, w: 16, d: 9, h: 8, name: "Brazier Hall" });
    for (let y = 0; y < z.d; y++) for (let x = 0; x < z.w; x++) { for (let k = 0; k < W.FLOOR_Z; k++) z.set(x, y, k, W.B.ROCK); z.set(x, y, W.FLOOR_Z + 4, W.B.ROCK); }
    z.hasSky = false; z.edges = { n: null, s: null, e: null, w: null };
    z.spawn = { x: 2.5, y: 4.5, z: W.FLOOR_Z, yaw: 0 };
    m.zones.enterZone(game, z.seal(), { how: "start" });
    const aim = (bx) => { z.set(bx, 4, W.FLOOR_Z, W.B.BRAZIER); z.refresh(); Object.assign(p, { x: 2.5, y: 4.5, z: W.FLOOR_Z }); p.yaw = 0; p.pitch = Math.atan2(W.FLOOR_Z + 0.5 - (p.z + 1.45), bx + 0.5 - p.x); };
    const can = (bx, perk, torch) => { aim(bx); p.perks = perk ? { kindleAtRange: 1 } : {}; p.torch = torch; const t = m.interact.lookTarget(game); z.set(bx, 4, W.FLOOR_Z, W.B.AIR); z.refresh(); return t?.label || null; };
    const near = can(6, true, true), noPower = can(6, false, true), dark = can(6, true, false), far = can(8, true, true);
    aim(6); p.perks = { kindleAtRange: 1 }; p.torch = true; m.interact.interact(game);
    const lit = z.get(6, 4, W.FLOOR_Z) === W.B.BRAZIER_LIT;
    p.perks = {};
    if (!/light the brazier/.test(near || "") || noPower || dark || far || !lit) fail(`Kindle at range: 3.5 tiles "${near}", without the power "${noPower}", torch out "${dark}", 5.5 tiles "${far}"; E lit it ${lit}`);
    stats.recharge = `a sun cell filled with Recharge for ${sun1.paid} glim, refused without; a brazier 3.5 tiles off lit by E with Kindle at range`;
  });

  // 8. The specials (the coordinator's condition on check-content's info rule, 2026-10-30): every C4 armour piece with no
  //    armour, no bonus and no needs maps to a special in SPECIALS, a field the code handles; each special's test wears
  //    the piece and asserts what the game does differently. A piece with none of them fails. Every special a piece
  //    has is tested (the glass-scale's reflect and the hooks' climb too).
  section("specials", () => {
    const A = I.ARMOURS, F = m.forge, G = m.gear, St = m.stats;
    const partOf = (p, it) => m.body.defaultPart(p, it);
    const SPECIALS = {
      // takes a fifth of the blows that land on you (combat.js turnedAside)
      block: (id) => {
        startRun(13, m.testWorld.TEST_WORLD);
        const p = game.player, foe = m.creatures.spawnCreature("goblin", 1, 1, 2, { level: 3, rng: () => 0.5 }), St = m.stats;
        const turned = () => { let t = 0; for (let k = 0, rng = m.rng.makeRng(41); k < 1500; k++) { const r = m.combat.resolveAttack(game, foe, p, m.combat.naturalSpec(foe), { rng }); if (r.turned) t++; p.hp = m.stats.maxHp(p); } return t; };
        const off = turned(); const it = G.makeGear("armour", id); m.body.equip(game, p, it, partOf(p, it)); const on = turned();
        return off === 0 && on > 150 ? null : `turned ${off} without it, ${on} with it of 1,500 blows`;
      },
      // turns a share of arrows (combat.js turnedAside)
      reflect: (id) => {
        startRun(13, m.testWorld.TEST_WORLD);
        const p = game.player, foe = m.creatures.spawnCreature("goblin", 1, 1, 2, { level: 3, rng: () => 0.5 });
        const turned = () => { let t = 0; for (let k = 0, rng = m.rng.makeRng(43); k < 1500; k++) { const r = m.combat.resolveAttack(game, foe, p, m.combat.naturalSpec(foe), { rng, ranged: true }); if (r.turned) t++; p.hp = m.stats.maxHp(p); } return t; };
        const off = turned(); const it = G.makeGear("armour", id); m.body.equip(game, p, it, partOf(p, it)); const on = turned();
        return off === 0 && on > 100 ? null : `turned ${off} arrows without it, ${on} with it of 1,500`;
      },
      // reputation while worn (social/reputation.js syncWornRep, on body.js's "gear")
      wornRep: (id) => {
        startRun(13, m.testWorld.TEST_WORLD);
        const p = game.player, it = G.makeGear("armour", id), def = A[id], R = m.factions;
        let want = def.wornRep;
        if (want === "hour") {
          const H = game.run.history?.rulers?.find((h) => h.favoured?.length && h.hated?.length);
          if (!H) return "no Hour in the run's history to wear a mask of";
          it.hour = H.id;
          want = Object.fromEntries([...H.favoured.map((f) => [f, def.hourRep]), ...H.hated.filter((f) => !H.favoured.includes(f)).map((f) => [f, -def.hourRep])]);
        }
        const ids = Object.keys(want).filter((f) => R.FACTIONS[f]);
        for (const f of ids) R.addRep(game, f, -R.repOf(game, f));   // (all at 0: room both ways)
        m.body.equip(game, p, it, partOf(p, it));
        const on = ids.filter((f) => R.repOf(game, f) !== want[f]);
        m.body.unequip(game, p, partOf(p, it));
        const off = ids.filter((f) => R.repOf(game, f) !== 0);
        return ids.length && !on.length && !off.length ? null : `rep on ${on.join(", ") || "as wanted"}, off ${off.join(", ") || "back"} (${JSON.stringify(want)})`;
      },
      // climbs 2 blocks on the map (turns.js mapStep): checked with the hooks in section 3 (survey)
      climb: (id) => (id === "climbingHooks" && stats.gripSoles ? null : `no map climb tested for ${id}`),
      // Lightsick's sun doesn't reach you (progression/mutations.js veiled): at noon on the temple's open ground
      veil: (id) => {
        const sick = (worn) => {
          startRun(13, m.testWorld.TEST_WORLD);
          const p = game.player;
          game.view = "map"; game.mode = "map"; game.pages = null; game.story.cube = true;
          p.mutations = { lightsick: 1 }; p.status = {}; St.invalidateStats(p);
          let sunny = false;   // (somewhere under the open sky: the start is under the temple's roof)
          for (let y = 1; y < game.zone.d - 1 && !sunny; y++) for (let x = 1; x < game.zone.w - 1 && !sunny; x++) {
            const z = game.zone.stand[x + y * game.zone.w];
            if (z >= 0 && m.light.naturalLight(game, game.zone, x + 0.5, y + 0.5, z + 1.45) >= 0.9) { Object.assign(p, { x: x + 0.5, y: y + 0.5, z }); sunny = true; }
          }
          if (!sunny) return -1;
          if (worn) { const it = G.makeGear("armour", id); m.body.equip(game, p, it, partOf(p, it)); }
          m.game.step(1 / 60);   // (the watch puts the sun on, or not)
          const h = p.hp, noRegen = m.rules.overrideRules("regen", { ...m.rules.RULES.regen, base: 1e9 });
          try { m.time.skipTime(game, 60, { interruptible: false }); } finally { noRegen(); }
          return h - p.hp;
        };
        const bare = sick(false), under = sick(true);
        return bare > 0 && under === 0 ? null : `Lightsick at noon: lost ${bare} HP in 60 s bare, ${under} under it`;
      },
    };
    const infoOnly = Object.keys(F.GEAR_ARMOURS).filter((id) => !(A[id].armour > 0) && !Object.keys(A[id].bonus || {}).length && !A[id].needs);
    const tested = {};
    for (const id of Object.keys(F.GEAR_ARMOURS)) {
      const has = Object.keys(SPECIALS).filter((k) => A[id][k] !== undefined && A[id][k] !== false);
      if (infoOnly.includes(id) && !has.length) { fail(`armour ${id}: says what it does by its info alone, and no special the code handles (${Object.keys(SPECIALS).join(", ")})`); continue; }
      for (const k of has) {
        if (k === "veil" && A[id].needs && /veil|Lightsick/.test(A[id].needs)) continue;
        const why = SPECIALS[k](id);
        if (why) fail(`armour ${id}'s ${k}: ${why}`);
        else (tested[k] ||= []).push(id);
      }
    }
    stats.specials = `${infoOnly.length} pieces by their info alone (${infoOnly.join(", ")}); tested: ${Object.entries(tested).map(([k, v]) => `${k} ${v.join("/")}`).join("; ")}`;
  });

  return { name: "items: B1's gear", ok: problems.length === 0, problems, stats };
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
    load("time", "time.js"), load("effects", "effects.js"), load("player", "player.js"), load("merchants", "social/merchants.js"), load("vaults", "gen/vaults.js"), load("traps", "traps.js"), load("throwing", "throwing.js"), load("ui", "ui.js"), load("combat", "combat.js"), load("torch", "torch.js"),
  ]);
  m.implantTable = (await env.src("content/items/implants.js")).IMPLANTS;
  m.artifactTable = (await env.src("content/items/artifacts.js")).ARTIFACTS;
  // C4's (checkGear): its tables and the modules it drives.
  await Promise.all([load("forge", "content/items/forge.js"), load("gear", "content/items/gear.js"), load("tonics", "content/items/tonics.js"),
    load("artifactTables", "content/items/artifacts.js"), load("mutationsContent", "content/mutations.js"), load("mutations", "progression/mutations.js"),
    load("chargen", "progression/chargen.js"), load("backgrounds", "content/backgrounds.js"), load("missiles", "missiles.js")]);
  m.player ||= await env.src("player.js");
  m.missileTable = (await env.src("content/items/missiles.js")).MISSILES;
  // B1's (checkB1Gear).
  await Promise.all([load("worldmap", "content/world/worldmap.js"), load("testWorld", "content/world/test-world.js"), load("zones", "zones.js"),
    load("common", "gen/biomes/common.js"), load("monsters", "monsters.js"), load("light", "light.js"),
    load("render3d", "render3d.js"), load("turns", "turns.js"), load("discovery", "overworld/discovery.js"), load("factions", "factions.js")]);
  if (env.args?.only === "b1") return [checkB1Gear(m)];   // (node tools/check-items.mjs --only b1)
  return [checkItems(m), checkGear(m), checkB1Gear(m)];
}
