// Content (0D2 skeleton; TECH_DESIGN §2.18, §9 "check-content", Appendix A; P0 → C in Phase 3): what every registry
// holds, once the game, content/index.js and features.js have loaded (as main.js loads them).
//
//   checkContent(m) → { name, ok, problems, stats, notes }     m: the modules (see run() below), after startRun
//
//   1. Required fields, per registry (the register functions refuse less; this holds the rest):
//      - creatures: a name, one glyph, a colour; a monster (it fights) hp, speed, damage [lo, hi], cooldown, reach,
//        sight, w, h, xp and its art (frames and a palette); one generation picks (`depths`) a [lo, hi] range of
//        levels and a weight; a person (`talks`) a title (empty for a statue). Elites: an adjective, a colour, a health factor, info.
//      - items: every kind name()s, glyph()s ([ch, colour]), price()s and weigh()s a sample of itself, and has art
//        and a palette for it; an item `use` named by a string is a registered item action. The legacy tables:
//        weapons (dmg, swing, reach, STR, tier, held art), armours (armour, STR, tier, metal), potions and scrolls
//        (a weight), rings, amulets and properties (a name or adjective, info, bonus), relics (a name and info).
//      - statuses: a name, a colour, kind good | bad, stack max | add | refresh, a default time, known flags, and
//        `ends` naming registered statuses; hooks are functions.
//      - abilities: the id it is filed under, a name, a known source and target, range and mapTime ≥ 0, cooldown(lvl)
//        and info(lvl) answering, use(); every ability a player can have (the sources, the hotbar) is registered.
//      - screens: draw(), handlers that are functions, pausesTime/saveable booleans, pointer unlock | lock | keep,
//        over view | none, filed under its own mode.
//      - HUD segments: unique ids, parts(), a priority, row 0 | 1, align left | right.
//      - block uses (interact.js registerUse): keyed by a block that exists or a flag some block has.
//      - legend handlers: unique ids, and every letter of the default legend and of every plan (vaults, guardian and
//        boss halls, the worlds' landmark plans, the temple's three) names a registered handler.
//   2. Bonus keys (Appendix A): every bonus content gives (gear properties, rings and amulets at −2..+2, relics,
//      item kinds' bonuses(), perks, statuses) uses only stats.js BONUS_KEYS.
//   3. Art rows and palettes, as test.html checks them: every creature's frames (or a person's art) the same height,
//      rows the same width, every letter in its palette; every weapon's held art with a pivot inside (0, 1); every
//      floor sprite with its kind's palette; no more potion effects than potion colours; every ring, amulet and relic
//      drawn, named and described.
//   4. The coverage rule (§2.18, review #14): for every region of both worlds and every level its spans and dungeons
//      can produce (span levels by tier; every site dungeon's floors on 3 seeds), at least three creature types are
//      spawnable (the region's creature table when it has one, else the legacy tables through contentLevel(), as
//      pickCreatureType reads them: nothing falls through to its "goblin" default) and a loot table exists (the
//      region's, else the legacy one: gear of that level, potions and scrolls). Exempt, and reported: the test
//      world's legacy stack keeps the parent's floor 1 (rat and goblin only; check-legacyfights holds its fights).
//      A legacy stack's floors (the Keeper's Stair under Hollowmere too) are the legacy tables' whatever region holds them.
//
//   1b. C4's data (Phase 3; content/items/forge.js, gear.js, tonics.js, artifacts.js, mutations.js, backgrounds.js):
//      the materials (a name, a tier each from 1 to 8, damage, armour, a rising value, a colour, a line; bonus keys);
//      every weapon a class, a value and a description, the new ones tier 0 (the parent's loot never draws them); every
//      armour a description, the new pieces a slot of the humanoid body, a tier, valid bonuses, something they do or
//      what they wait for (`needs`), a worn reputation by the bible's factions; the forged pieces and values real ids;
//      every description at most 3 sentences (bible §2.1); the tonics, their statuses and the tools; every artifact
//      and waiting artifact (a name, a class, a complexity, a charge, a value, a line; a waiting one its `needs`, a
//      relic its three registers); every waiting mutation (kind, cost, max, exclusions, info by level, needs, its
//      reputation by the bible's factions); every kit piece a registered kind, a real id, its material the ladder's.
//      The words of the area go in the stats (bible §15.9: about 12 an entry; not a gate).
//   5. Its teeth (checkMutations): 13 mutations of the live registries (a ragged art row, a palette letter missing, an
//      unknown bonus key, a status kind, two creature types fewer from level 20, a missing legend handler, a screen
//      without draw(), an ability's target, a monster without hp, a weapon's pivot, an elite without info, an item
//      kind without a sample, a HUD segment on row 2) each fail checkContent, and everything is as it was after.
//
// What Phase 3 adds (content files of §2.18 still empty in P0: regions, factions, mutations, implants, …) gets its
// fields here as it lands; check-world holds the world, terrains and landmarks, check-creatures the glyph registry.
const RGB = (c) => Array.isArray(c) && c.length === 3 && c.every((v) => Number.isInteger(v) && v >= 0 && v <= 255);
const num = (v, min = 0) => typeof v === "number" && !Number.isNaN(v) && v >= min;
const range = (r, min = 0) => Array.isArray(r) && r.length === 2 && num(r[0], min) && num(r[1], r[0]);
const fn = (f) => typeof f === "function";
const str = (s) => typeof s === "string" && s.length > 0;
const oneGlyph = (g) => typeof g === "string" && [...g].length === 1;

// The kinds the game makes, one sample each (as test.html's).
export const ITEM_SAMPLES = {
  potion: { kind: "potion", effect: "healing" }, scroll: { kind: "scroll", effect: "fire" },
  weapon: { kind: "weapon", id: "mace", element: "fire", ench: 0 }, armour: { kind: "armour", id: "plate", ench: 0 },
  ring: { kind: "ring", id: "protection", ench: 1 }, amulet: { kind: "amulet", id: "life", ench: 1 },
  knife: { kind: "knife", count: 3 }, bomb: { kind: "bomb", count: 1 }, key: { kind: "key" }, heart: { kind: "heart" },
  strength: { kind: "strength" }, gold: { kind: "gold", amount: 5 }, cash: { kind: "cash", amount: 5 }, cube: { kind: "cube" },
  quest: { kind: "quest", name: "skull" }, "relic?": { kind: "relic?" },
  missile: { kind: "missile", id: "boltBow", ench: 1 }, ammo: { kind: "ammo", effect: "bolt", count: 10 },   // WS8 (content/items/missiles.js)
  implant: { kind: "implant", id: "lampCrown" }, credit: { kind: "credit", count: 1 }, artifact: { kind: "artifact", id: "echoBell", known: true, cell: { id: "glim", charge: 500 } }, cell: { kind: "cell", id: "sun", charge: 100 },   // WS5
  vial: { kind: "vial", effect: "brine" }, coinage: { kind: "coinage", effect: "glim", count: 3 },   // WS6b
  tool: { kind: "tool", effect: "markerChalk", count: 4 }, tonic: { kind: "tonic", effect: "balm", count: 2 },   // C4 (content/items/gear.js, tonics.js)
};
const STATUS_FLAGS = ["noAct", "noMove", "flying", "hidden", "untouchable", "noRegen", "flat"];
const ABILITY_SOURCES = ["mutation", "implant", "item", "power", "innate"];
const ABILITY_TARGETS = ["self", "dir", "creature", "tile", "area"];
const SCREEN_HANDLERS = ["draw", "key", "mouse", "hover", "wheel", "update", "enter", "leave"];

export function checkContent(m) {
  const problems = [], stats = {}, notes = [];
  const fail = (msg) => problems.push(msg);
  const need = (ok, msg) => { if (!ok) fail(msg); return ok; };
  const { CREATURE_TYPES, ELITES } = m.creatures, I = m.items, game = m.game;

  // --- 1. Required fields -----------------------------------------------------------------------------------
  // Creatures.
  let monsters = 0, people = 0, picked = 0;
  for (const [id, t] of Object.entries(CREATURE_TYPES)) {
    const at = `creature ${id}`;
    need(str(t.name) && oneGlyph(t.glyph) && RGB(t.color), `${at}: needs a name, one glyph and an [r, g, b] colour`);
    if (t.talks) {
      people++;
      need(typeof t.title === "string", `${at}: a person needs a title (a statue's may be empty)`);
      continue;
    }
    monsters++;
    for (const k of ["hp", "speed", "cooldown", "reach", "sight", "w", "h", "xp"]) need(num(t[k]), `${at}: ${k} ${JSON.stringify(t[k])}`);
    need(t.hp > 0 && t.w > 0 && t.h > 0, `${at}: hp, w and h must be above 0`);
    need(range(t.damage), `${at}: damage ${JSON.stringify(t.damage)} isn't [lo, hi]`);
    need(Array.isArray(t.frames) && t.frames.length > 0 && t.palette, `${at}: no frames or palette`);
    if (t.depths) {
      picked++;
      need(range(t.depths, 1) && t.depths.every(Number.isInteger), `${at}: depths ${JSON.stringify(t.depths)} isn't [lo, hi] of whole levels`);
      need(num(t.weight) && t.weight > 0, `${at}: weight ${t.weight}`);
    }
  }
  for (const [id, e] of Object.entries(ELITES))
    need(str(e.adj) && RGB(e.color) && num(e.hp) && e.hp > 0 && str(e.info), `elite ${id}: needs adj, colour, hp > 0 and info`);
  stats.creatures = `${monsters} monsters (${picked} picked by generation), ${people} people, ${Object.keys(ELITES).length} elites`;

  // Items: every kind answers its sample; the legacy tables.
  const kinds = Object.keys(I.ITEM_KINDS);
  for (const kind of kinds) {
    const def = I.ITEM_KINDS[kind], it = ITEM_SAMPLES[kind];
    if (!need(it, `item kind ${kind}: no sample in tests/checks/content.js ITEM_SAMPLES (add one)`)) continue;
    const at = `item kind ${kind}`;
    try {
      const glyph = I.itemGlyph(game, it);
      need(str(I.itemName(game, it)), `${at}: name() gives ${JSON.stringify(I.itemName(game, it))}`);
      need(Array.isArray(glyph) && oneGlyph(glyph[0]) && RGB(glyph[1]), `${at}: glyph() gives ${JSON.stringify(glyph)}`);
      need(num(I.itemPrice(it)) && num(I.itemWeight(it)), `${at}: price ${I.itemPrice(it)}, weight ${I.itemWeight(it)}`);
      need(def.art && fn(def.palette) && I.itemPalette(game, it), `${at}: no art or palette`);
      need(typeof def.stack === "boolean", `${at}: stack must be true or false`);
      for (const k of ["info", "details", "slot", "hands", "req", "aura", "onImpact", "onPickup", "canPickUp", "bonuses", "av", "abilities"])
        need(def[k] === undefined || fn(def[k]), `${at}: ${k} must be a function`);
      if (typeof def.use === "string") need(I.itemActions().includes(def.use), `${at}: use "${def.use}" isn't a registered item action`);
      else need(def.use === undefined || fn(def.use), `${at}: use must be a function or an action's name`);
    } catch (err) { fail(`${at}: threw on its sample: ${err.message}`); }
  }
  for (const [id, w] of Object.entries(I.WEAPONS))
    need(str(w.name) && range(w.dmg, 1) && num(w.swing) && w.swing > 0 && num(w.reach) && w.reach > 0 && num(w.str) && Number.isInteger(w.tier) && w.held?.art,
      `weapon ${id}: needs name, dmg [lo, hi], swing, reach, str, a whole tier and held art`);
  for (const [id, a] of Object.entries(I.ARMOURS))
    need(str(a.name) && num(a.armour) && num(a.str) && Number.isInteger(a.tier) && typeof a.metal === "boolean", `armour ${id}: needs name, armour, str, tier and metal`);
  for (const [table, rows] of [["potion", I.POTIONS], ["scroll", I.SCROLLS]])
    for (const [id, p] of Object.entries(rows)) need(num(p.weight) && p.weight > 0, `${table} ${id}: weight ${p.weight}`);
  for (const [table, rows] of [["ring", I.RINGS], ["amulet", I.AMULETS]])
    for (const [id, r] of Object.entries(rows)) need(str(r.name) && fn(r.info) && fn(r.bonus), `${table} ${id}: needs name, info(n) and bonus(n)`);
  for (const [id, p] of Object.entries(I.PROPERTIES))
    need((p.slot === "weapon" || p.slot === "armour") && (str(p.adj) || str(p.suffix)) && str(p.info) && p.bonus && typeof p.bonus === "object",
      `property ${id}: needs slot weapon | armour, an adj or suffix, info and a bonus table`);
  stats.items = `${kinds.length} kinds; ${Object.keys(I.WEAPONS).length} weapons, ${Object.keys(I.ARMOURS).length} armours, ` +
    `${Object.keys(I.RINGS).length + Object.keys(I.AMULETS).length} jewels, ${Object.keys(I.PROPERTIES).length} properties, ${Object.keys(I.RELICS).length} relics`;

  // --- 1b. C4's data ----------------------------------------------------------------------------------------------
  if (m.c4) {
    const { forge: Fg, gear: Gr, tonics: Tn, artifacts: Ar, mutations: Mu, backgrounds: Bg } = m.c4;
    const KEYS = new Set(m.stats.BONUS_KEYS), FACTIONS = new Set([...Mu.BIBLE_FACTIONS, "bentVillages"]);
    const PARTS = new Set(m.body.BODY_PLANS.humanoid.map((q) => q.type));
    const sentences = (t) => (String(t).match(/[.!?](?=\s|$)/g) || []).length;
    const words = (t) => (typeof t === "string" ? t.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length : 0);
    const bonusOk = (at, b) => { for (const k of Object.keys(b || {})) need(KEYS.has(k), `${at}: unknown bonus key "${k}"`); };
    const repOk = (at, rep) => { for (const [f, n] of Object.entries(rep || {})) need(FACTIONS.has(f) && Number.isInteger(n), `${at}: reputation ${f} ${n} (a bible §15.4 faction, a whole number)`); };
    const tiers = Object.values(Fg.MATERIALS).map((d) => d.tier);
    need(JSON.stringify(tiers) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]), `materials: tiers ${tiers.join(", ")}, want 1-8 in order`);
    let lastValue = 0;
    for (const [id, d] of Object.entries(Fg.MATERIALS)) {
      need(str(d.name) && Number.isInteger(d.dmg) && Number.isInteger(d.av) && num(d.value) && d.value > lastValue && RGB(d.color) && str(d.info),
        `material ${id}: needs a name, whole damage and armour, a value above the rung below, a colour and a line`);
      lastValue = d.value;
      bonusOk(`material ${id}`, d.bonus);
    }
    for (const [id, w] of Object.entries(I.WEAPONS)) {
      need(Fg.CLASSES[Fg.CLASS_OF[id]]?.name, `weapon ${id}: no class (forge.js CLASS_OF, CLASSES)`);
      need(num(Fg.VALUE[id]) && Fg.VALUE[id] > 0, `weapon ${id}: no value (forge.js VALUE)`);
      need(str(Fg.TEXT[id]) && sentences(Fg.TEXT[id]) <= 3, `weapon ${id}: a description of at most 3 sentences (forge.js TEXT)`);
      if (Fg.GEAR_WEAPONS[id]) need(w.tier === 0, `weapon ${id}: tier ${w.tier}, want 0 (the parent's loot draws tiers 1-4)`);
    }
    for (const [id, a] of Object.entries(I.ARMOURS)) {
      need(str(Fg.TEXT[id]) && sentences(Fg.TEXT[id]) <= 3, `armour ${id}: a description of at most 3 sentences (forge.js TEXT)`);
      if (!Fg.GEAR_ARMOURS[id]) continue;
      const at = `armour ${id}`;
      need(PARTS.has(a.slot), `${at}: slot ${a.slot}, not a part of the humanoid body`);
      need(Number.isInteger(a.tier) && a.tier >= 1 && a.tier <= 8, `${at}: tier ${a.tier}`);
      bonusOk(at, a.bonus);
      need(a.armour > 0 || Object.keys(a.bonus || {}).length > 0 || str(a.needs), `${at}: does nothing and says nothing of what it needs`);
      need(a.info === undefined || (str(a.info) && sentences(a.info) <= 1), `${at}: info`);
      if (a.wornRep === "hour") need(Number.isInteger(a.hourRep) && a.hourRep > 0, `${at}: an Hour mask's hourRep`);
      else if (a.wornRep !== undefined) repOk(at, a.wornRep);
      if (a.wornRep !== undefined) need(str(a.needs), `${at}: a worn reputation with no needs (the hook is a request)`);
    }
    for (const id of Fg.FORGED.armour) need(I.ARMOURS[id], `forged armour ${id}: no such armour`);
    for (const id of Object.keys(Fg.VALUE)) need(I.WEAPONS[id] || I.ARMOURS[id] || m.c4.missiles.MISSILES[id], `value ${id}: no such weapon, armour or missile weapon`);
    for (const [id, c] of Object.entries(Fg.CLASSES)) need(str(c.name) && (c.info === undefined || str(c.info)) && str(c.needs), `class ${id}: name, info and needs`);
    for (const [id, t] of Object.entries(Tn.TONICS)) {
      need(str(t.name) && num(t.value) && t.value > 0 && num(t.t) && t.t > 0 && fn(t.info) && str(t.info(1)) && sentences(t.info(1)) <= 3 && str(t.info(0.5)) && fn(t.use) && fn(t.overdose),
        `tonic ${id}: name, value, time, info(k), use and overdose`);
    }
    for (const id of ["tonic", "tonic:balm", "tonic:gloam", "tonic:ironbark", "tonic:clearwit", "tonic:sick", "tonic:heavy", "tonic:crash"]) need(m.status.STATUS_DEFS[id], `status ${id} (tonics.js) isn't registered`);
    for (const [id, t] of Object.entries(Gr.TOOLS)) need(str(t.name) && oneGlyph(t.glyph) && RGB(t.color) && str(t.info) && num(t.price), `tool ${id}: name, glyph, colour, info and price`);
    for (const [table, rows] of [["artifact", Ar.ARTIFACTS], ["waiting artifact", Ar.ARTIFACTS_WAITING]])
      for (const [id, d] of Object.entries(rows)) {
        const at = `${table} ${id}`;
        need(str(d.name) && str(d.class) && Number.isInteger(d.complexity) && num(d.charge) && num(d.value) && str(d.info) && sentences(d.info) <= 3 && (d.relic || str(d.vague)),
          `${at}: name, vague, class, complexity, charge, value and info`);
        bonusOk(at, d.bonus);
        if (table === "waiting artifact") need(str(d.needs) && !Ar.ARTIFACTS[id], `${at}: says nothing of what it needs, or is live too`);
        if (d.relic) need(str(d.flat) && str(d.deep) && /^[a-z \n]+$/.test(d.dark || ""), `${at}: a relic's three registers (bible §2.1)`);
      }
    for (const [id, d] of Object.entries(Mu.MUTATIONS_WAITING)) {
      const at = `waiting mutation ${id}`;
      need(str(d.name) && ["physical", "mental", "defect"].includes(d.kind) && Number.isInteger(d.cost) && Number.isInteger(d.max) && d.max >= 1 && Array.isArray(d.excludes) && fn(d.info) && str(d.info(1)) && str(d.needs),
        `${at}: name, kind, cost, max, excludes, info(level) and needs`);
      need(!Mu.MUTATIONS[id], `${at}: is live too`);
      for (const x of d.excludes) need(Mu.MUTATIONS[x] || Mu.MUTATIONS_WAITING[x], `${at}: excludes ${x}, which is no mutation`);
      repOk(at, d.rep);
    }
    for (const [bg, B] of Object.entries(Bg.BACKGROUNDS)) {
      const pieces = [...Object.values(B.kit.equip || {}), B.kit.belt, ...(B.kit.pack || [])].filter(Boolean);
      for (const it of pieces) {
        const at = `${bg}'s kit: ${it.kind} ${it.id || it.effect || ""}`.trim();
        need(I.ITEM_KINDS[it.kind], `${at}: the kind isn't registered`);
        if (it.kind === "weapon") need(I.WEAPONS[it.id], `${at}: no such weapon`);
        if (it.kind === "armour") need(I.ARMOURS[it.id], `${at}: no such armour`);
        if (it.made) need(Fg.MATERIALS[it.made] && (it.kind !== "weapon" || it.material === Fg.MATERIALS[it.made].dmg), `${at}: made of ${it.made}, material ${it.material}`);
      }
      need(Array.isArray(B.kit.wants) && B.kit.wants.every(str), `${bg}'s kit: wants must be a list of lines`);
    }
    const area = [...Object.values(Fg.TEXT), ...Object.values(Fg.MATERIALS).map((d) => d.info), ...Object.values(Fg.CLASSES).map((d) => d.info),
      ...Object.values(Fg.GEAR_ARMOURS).map((d) => d.info), ...Object.values(Gr.TOOLS).map((d) => d.info), ...Object.values(Tn.TONICS).map((d) => d.info(1)),
      ...[...Object.values(Ar.ARTIFACTS), ...Object.values(Ar.ARTIFACTS_WAITING)].flatMap((d) => [d.info, d.vague, d.class, d.flat, d.deep, d.dark]),
      ...Object.values(Ar.CELLS).map((d) => d.info), ...Object.values(m.c4.implants.IMPLANTS).map((d) => d.info),
      ...[...Object.values(Mu.MUTATIONS), ...Object.values(Mu.MUTATIONS_WAITING)].map((d) => d.info(1))];
    stats.c4 = `${Object.keys(Fg.MATERIALS).length} materials, ${Object.keys(Fg.GEAR_WEAPONS).length} new classes, ${Object.keys(Fg.GEAR_ARMOURS).length} new pieces, ` +
      `${Object.keys(Tn.TONICS).length} tonics, ${Object.keys(Ar.ARTIFACTS).length} + ${Object.keys(Ar.ARTIFACTS_WAITING).length} artifacts, ` +
      `${Object.keys(Mu.MUTATIONS).length} + ${Object.keys(Mu.MUTATIONS_WAITING).length} mutations; the area's text ${area.reduce((n, t) => n + words(t), 0)} words`;
  }

  // 1c. C1b's landmarks (content/world/landmarks.js, plans/*.js, worldmap.js LANDMARK_DUNGEONS): every landmark has its
  // entry and its plans, rectangular, every letter in a plan's own legend or the default legend's structure (walls, doors,
  // lamps, runes, stairs: never an item or a creature by accident); its three registers (bible §2.1 rule 3: the Flat
  // line's name in capitals, the Deep line its description, the Dark line lower case with no punctuation but line breaks);
  // every letter of `letters` someone's place in one of its plans, a name and a role; who is below on a floor its
  // dungeon has; its holy place a faction; its dungeon's names, floor gimmicks, theme, cradles and vaults real and one a
  // floor. The area's words go in the stats (bible §15.9: 4,000 for the landmarks' registers and their people's words).
  if (m.c1b) {
    const { landmarks: LM, worldmap: WM, dungeon: DG, factions: FC } = m.c1b, V = m.vaults;
    const STRUCTURE = new Set(["wall", "door", "locked", "gate", "lamp", "rune", "stairs", "chasm", "floor", "step1", "step2", "step3", "ghostPlanks", "brazier", "lever"]);
    const wordsOf = (t) => (typeof t === "string" ? t.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length : 0);
    let words = 0, letters = 0;
    const texts = [];   // every string the area authors, for the names bible §15.10 retires
    const say = (t) => { if (typeof t === "string") texts.push(t); return wordsOf(t); };
    for (const L of WM.LANDMARK_INDEX) {
      const e = LM.LANDMARKS.find((l) => l.id === L.id), at = `landmark ${L.id}`;
      if (!need(e, `${at}: no entry in landmarks.js`)) continue;
      const plans = [e.plan, ...Object.values(e.spanPlans || {})].map((id) => [id, LM.PLANS[id]]);
      for (const [id, p] of plans) {
        if (!need(p?.rows?.length && p.rows.every((r) => r.length === p.rows[0].length), `${at}: plan ${id} missing or ragged`)) continue;
        for (const ch of new Set(p.rows.join(""))) {
          const h = p.legend?.[ch] ?? V.DEFAULT_LEGEND[ch] ?? "floor";
          need(p.legend && (ch in p.legend || STRUCTURE.has(h)), `${at}: plan ${id}'s "${ch}" falls to the default legend's ${h}`);
        }
        for (const t of p.texts || []) words += say(t);
        for (const a of p.areas || []) need(FC.FACTIONS[a.faction] && a.rect?.length === 4 && a.rect[0] >= 0 && a.rect[1] >= 0 && a.rect[2] < p.rows[0].length && a.rect[3] < p.rows.length,
          `${at}: plan ${id}'s area for ${a.faction}`);
        for (const st of p.steles || []) need(Number.isInteger(st.hour) && st.hour >= 0 && st.hour < 24 && p.rows[st.at[1]]?.[st.at[0]] !== undefined, `${at}: plan ${id}'s stele at ${st.at}, hour ${st.hour}`);
      }
      const ln = e.lines || {};
      need(/^[A-Z][A-Z' -]*\./.test(ln.flat || "") && ln.deep === e.description && str(ln.deep), `${at}: its Flat and Deep lines`);
      need(/^[a-z ]+(\n[a-z ]+)*$/.test(ln.dark || ""), `${at}: its Dark line (lower case, no punctuation but line breaks)`);
      words += say(ln.flat) + say(ln.deep) + say(ln.dark);
      for (const [ch, who] of Object.entries(e.letters || {})) {
        letters++;
        need(str(who.who) && str(who.name) && str(who.role) && plans.some(([, p]) => p?.rows.some((r) => r.includes(ch))), `${at}: letter ${ch} (${who.name}) stands nowhere in its plans`);
        words += say(who.name) + say(who.role);
      }
      for (const b of e.below || []) {
        need(str(b.who) && str(b.name) && str(b.role) && (Number.isInteger(b.floor) ? b.floor >= 1 && b.floor <= (L.dungeon?.floors.length || 0) : b.up >= 1 && b.up <= (L.dungeon?.up?.length || 0)),
          `${at}: ${b.name} on floor ${b.floor ?? `up ${b.up}`}, which its dungeon hasn't`);
        words += say(b.name) + say(b.role);
      }
      for (const f of e.holy ? (typeof e.holy === "string" ? [e.holy] : Object.values(e.holy)) : []) need(FC.FACTIONS[f], `${at}: holy to ${f}, which is no faction`);
      for (const [k, f] of Object.entries(e.holyFloors || {})) need(FC.FACTIONS[f] && Number(k) >= 1 && Number(k) <= (L.dungeon?.floors.length || 0), `${at}: floor ${k} holy to ${f}`);
      const d = L.dungeon;
      if (!d || d.legacy) continue;
      const n = d.floors.length;
      need(Array.isArray(d.named) && d.named.length === n && d.named.every(str), `${at}: ${d.named?.length} floor names for ${n} floors`);
      need(!d.floorGimmicks || d.floorGimmicks.length === n, `${at}: ${d.floorGimmicks?.length} floors of gimmicks for ${n} floors`);
      need([...(d.gimmicks || []), ...(d.floorGimmicks || []).flat(), ...(d.cast || [])].every((g) => DG.GIMMICKS[g]), `${at}: a gimmick that isn't one of GIMMICKS`);
      need(DG.DUNGEON_THEMES[d.theme], `${at}: theme ${d.theme}`);
      need((d.cradle || []).every((z) => Number.isInteger(z) && z >= 1 && z <= n), `${at}: a cradle off its floors`);
      need((d.vaultPool || []).every((v) => V.vaultById(Array.isArray(v) ? v[0] : v)), `${at}: a vault it can't draw`);
      words += d.named.reduce((k, t) => k + say(t), 0);
      for (const m of d.planned?.murals || []) words += say(m.text) + say(m.map);
    }
    // Bible §15.10 "Names settled": names not used in this world (check-names holds §15.11's).
    for (const name of ["Hackles", "Platen", "Roller", "Reticule", "Diptarch", "Hydrarch", "Seepborn", "Clearborn", "Gleam", "Brightness", "the Unlit Stair", "the Seam"]) {
      const re = new RegExp(`\\b${name}\\b`, "i"), hit = texts.find((t) => re.test(t));
      need(!hit, `landmarks: "${hit}" uses ${name}, a name bible §15.10 keeps out of this world`);
    }
    stats.c1b = `${WM.LANDMARK_INDEX.length} landmarks with their entries and ${Object.keys(LM.PLANS).length} plans, ${letters} people placed by letter; the area's text ${words} words`;
  }

  // Statuses.
  const statuses = Object.entries(m.status.STATUS_DEFS);
  for (const [id, s] of statuses) {
    const at = `status ${id}`;
    need(str(s.name) && RGB(s.color), `${at}: needs a name and a colour`);
    need(s.kind === "good" || s.kind === "bad", `${at}: kind ${s.kind}`);
    need(["max", "add", "refresh"].includes(s.stack), `${at}: stack ${s.stack}`);
    need(num(s.t) && s.t > 0, `${at}: default time ${s.t}`);
    for (const k of ["hud", "period", "tick", "onStart", "onEnd", "bonus", "killed"]) need(s[k] === undefined || fn(s[k]), `${at}: ${k} must be a function`);
    for (const f of Object.keys(s.flags || {})) need(STATUS_FLAGS.includes(f), `${at}: unknown flag ${f}`);
    for (const e of s.ends || []) need(m.status.STATUS_DEFS[e], `${at}: ends ${e}, which isn't registered`);
    need(s.warn === undefined || (Array.isArray(s.warn) && num(s.warn[0]) && str(s.warn[1])), `${at}: warn must be [seconds, line]`);
  }
  stats.statuses = statuses.length;

  // Abilities.
  const A = m.abilities.ABILITIES;
  for (const [id, a] of Object.entries(A)) {
    const at = `ability ${id}`;
    need(a.id === id && str(a.name), `${at}: filed as ${a.id}, name ${a.name}`);
    need(ABILITY_SOURCES.includes(a.source) && ABILITY_TARGETS.includes(a.target), `${at}: source ${a.source}, target ${a.target}`);
    need(num(a.range) && num(a.mapTime), `${at}: range ${a.range}, mapTime ${a.mapTime}`);
    need(fn(a.use) && fn(a.cooldown) && fn(a.info), `${at}: needs use(), cooldown() and info()`);
    try {
      const cd = a.cooldown(1, game.player), info = a.info(1);
      need(num(cd) && Number.isFinite(cd), `${at}: cooldown(1) = ${cd}`);
      need(str(info), `${at}: info(1) = ${JSON.stringify(info)}`);
    } catch (err) { fail(`${at}: cooldown(1)/info(1) threw: ${err.message}`); }
  }
  const owned = [...m.abilities.abilitiesOf(game.player).map((a) => a.id), ...(game.player.hotbar || []).filter(Boolean)];
  for (const id of owned) need(A[id], `the player has ability ${id}, which isn't registered`);
  stats.abilities = `${Object.keys(A).length} registered; the player's: ${[...new Set(owned)].join(", ") || "none"}`;

  // Screens.
  for (const [mode, s] of m.screens.SCREENS) {
    const at = `screen ${mode}`;
    need(s.mode === mode && fn(s.draw), `${at}: filed as ${s.mode}, draw ${typeof s.draw}`);
    for (const k of SCREEN_HANDLERS) need(s[k] === undefined || fn(s[k]), `${at}: ${k} must be a function`);
    need(typeof s.pausesTime === "boolean" && typeof s.saveable === "boolean", `${at}: pausesTime ${s.pausesTime}, saveable ${s.saveable}`);
    need(["unlock", "lock", "keep"].includes(s.pointer) && ["view", "none"].includes(s.over), `${at}: pointer ${s.pointer}, over ${s.over}`);
  }
  stats.screens = m.screens.SCREENS.size;

  // HUD segments.
  const segs = m.hud.hudSegments();
  need(new Set(segs).size === segs.length, `HUD segment ids repeat: ${segs.join(" ")}`);
  for (const id of segs) {
    const s = m.hud.segmentDef(id);
    need(fn(s.parts) && num(s.priority) && (s.row === 0 || s.row === 1) && (s.align === "left" || s.align === "right") && typeof s.split === "boolean",
      `HUD segment ${id}: needs parts(), a priority ≥ 0, row 0 | 1, align left | right, split`);
  }
  stats.hudSegments = segs.length;

  // Legend handlers.
  const V = m.vaults, handlers = V.legendHandlers();
  need(new Set(handlers).size === handlers.length, `legend handler ids repeat: ${handlers.join(" ")}`);
  let threw = false;
  try { V.registerLegend(handlers[0], () => {}); } catch { threw = true; }
  need(threw, `registerLegend took a second "${handlers[0]}"`);
  const plans = [["the default legend", { legend: V.DEFAULT_LEGEND }],
    ...V.VAULTS.map((v) => [`vault ${v.id}`, v]), ...Object.values(V.GUARDIAN_HALLS).map((v) => [`guardian hall ${v.id}`, v]),
    ...Object.values(V.BOSS_HALLS).map((v) => [`boss hall ${v.id}`, v]),
    ...m.worlds.flatMap(({ id, def }) => Object.entries(def.plans || {}).map(([k, p]) => [`${id} world plan ${k}`, p])),
    ...Object.entries(m.templeLegends).map(([k, legend]) => [`the temple's ${k} legend`, { legend }])];
  let letters = 0;
  for (const [what, p] of plans)
    for (const [ch, h] of Object.entries(p.legend || {})) { letters++; need(handlers.includes(h), `${what}: "${ch}" names legend handler "${h}", which isn't registered`); }
  stats.legend = `${handlers.length} handlers; ${letters} letters over ${plans.length} legends`;

  // Block uses (interact.js registerUse): each keyed by a block that exists or a flag some block has.
  const uses = m.interact.useIds();
  for (const k of uses)
    need(typeof k === "number" ? !!m.blocks[k] : m.blocks.some((b) => b?.[k]), `block use ${k}: no such block${typeof k === "number" ? "" : " flag"}`);
  stats.uses = uses.map(String).join(", ");

  // --- 2. Bonus keys ----------------------------------------------------------------------------------------
  const KEYS = new Set([...m.stats.BONUS_KEYS, ...m.stats.ATTRS]);
  let tables = 0;
  const keysOk = (what, b) => { tables++; for (const k of Object.keys(b || {})) need(KEYS.has(k), `${what}: unknown bonus key "${k}" (stats.js BONUS_KEYS, Appendix A)`); };
  for (const [id, p] of Object.entries(I.PROPERTIES)) keysOk(`property ${id}`, p.bonus);
  for (const [table, rows] of [["ring", I.RINGS], ["amulet", I.AMULETS]])
    for (const [id, r] of Object.entries(rows)) for (const n of [-2, -1, 1, 2]) keysOk(`${table} ${id} (${n})`, r.bonus(n));
  for (const key of Object.keys(I.RELICS)) keysOk(`relic ${key}`, I.itemBonuses(I.makeRelic(key)));
  for (const [kind, it] of Object.entries(ITEM_SAMPLES)) if (I.ITEM_KINDS[kind]) keysOk(`item kind ${kind}`, I.itemBonuses(it));
  for (const [id, p] of Object.entries(m.leveling.PERKS)) if (p.bonus) keysOk(`perk ${id}`, p.bonus(1));
  for (const [id, s] of statuses) if (s.bonus) keysOk(`status ${id}`, s.bonus({ t: 1, mag: 1, src: null, acc: 0 }));
  stats.bonusTables = tables;

  // --- 3. Art rows and palettes (test.html) ---------------------------------------------------------------------
  let arts = 0;
  const checkArt = (name, frames, palette) => {
    arts++;
    if (!need(Array.isArray(frames) && frames.length && palette, `${name}: no art or palette`)) return;
    for (const frame of frames) {
      need(frame.length === frames[0].length, `${name}: frames differ in height`);
      for (const row of frame) {
        need(row.length === frame[0].length, `${name}: ragged row "${row}"`);
        for (const ch of row) need(ch === " " || palette[ch], `${name}: no palette entry for "${ch}"`);
      }
    }
    for (const [ch, v] of Object.entries(palette)) need(Array.isArray(v) && RGB(v[0]) && num(v[1]), `${name}: palette "${ch}" isn't [[r, g, b], glow]`);
  };
  for (const [id, t] of Object.entries(CREATURE_TYPES)) {
    if (t.frames) checkArt(`creature ${id}`, t.frames, t.palette);
    else if (t.art) checkArt(`person ${id}`, [t.art], t.palette);
  }
  for (const [id, w] of Object.entries(I.WEAPONS)) {
    checkArt(`held ${id}`, [w.held.art], I.WEAPON_PALETTE);
    need(w.held.pivot > 0 && w.held.pivot < 1, `held ${id}: pivot ${w.held.pivot}`);
  }
  for (const [kind, a] of Object.entries(I.FLOOR_ART)) if (ITEM_SAMPLES[kind]) checkArt(`floor ${kind}`, [a.art], I.itemPalette(game, ITEM_SAMPLES[kind]));
  need(Object.keys(I.POTIONS).length <= I.POTION_COLORS.length, "more potion effects than colours");
  for (const id of Object.keys(I.RINGS)) checkArt(`ring ${id}`, [I.FLOOR_ART.ring.art], I.itemPalette(game, { kind: "ring", id }));
  for (const id of Object.keys(I.AMULETS)) checkArt(`amulet ${id}`, [I.FLOOR_ART.amulet.art], I.itemPalette(game, { kind: "amulet", id }));
  for (const key of Object.keys(I.RELICS)) {
    const it = I.makeRelic(key);
    checkArt(`relic ${key}`, [I.FLOOR_ART[it.kind].art], I.itemPalette(game, it));
    need(str(I.itemName(game, it)) && str(I.itemInfo(game, it)), `relic ${key}: no name or info`);
  }
  stats.art = `${arts} pieces`;

  // --- 4. The coverage rule -------------------------------------------------------------------------------------
  const cover = new Map();   // "world region level" → { world, region, level, from }
  const at = (world, region, level, from) => { const k = `${world}|${region}|${level}`; if (!cover.has(k)) cover.set(k, { world, region, level, from }); };
  let sitesSeen = 0;
  for (const { id, def } of m.worlds) {
    const W = m.compileWorld(def);
    for (const t of W.tiles) at(id, t.region, t.level, `span ${t.wx},${t.wy}`);
    for (const seed of [1, 42, 1234]) {
      const run = m.buildRun(seed, def);
      for (const s of run.sites.values()) {
        if (!s.dungeon) continue;
        sitesSeen++;
        // The legacy stack (the test world's temple, the real world's Keeper's Stair) is built from the parent's tables
        // whatever region it lies under (world/zonegen.js legacyZone, never the region's rows): its floors are the
        // legacy tables' to cover (C1a, once the real world's regions had creature rows).
        const region = s.dungeon.legacy ? "the legacy stack" : W.tileAt(s.at.wx, s.at.wy).region;
        for (let z = 1; z <= s.dungeon.levels; z++) at(id, region, m.dungeonLevelOf(s.dungeon, z), `${s.id} floor ${z}`);
      }
    }
  }
  const legacyTypes = Object.keys(CREATURE_TYPES).filter((id) => CREATURE_TYPES[id].depths);
  const spawnable = (world, region, level) => {
    const table = m.worlds.find((w) => w.id === world).def.regions?.[region]?.creatures;
    if (table) return table.filter(([type, weight, lo, hi]) => CREATURE_TYPES[type] && weight > 0 && level >= lo && level <= hi).map(([type]) => type);
    // (The legacy stack's floors are the parent's levels 1-20 whatever level the world lists them at: world/legacy.js
    // legacyZone, WS10 #9; so its tables at 20 at most, now that contentLevel reaches 23: integrator, C3 #1.)
    const lv = region === "the legacy stack" ? Math.min(level, 20) : m.contentLevel(level);
    return legacyTypes.filter((id) => { const t = CREATURE_TYPES[id]; return t.weight > 0 && lv >= t.depths[0] && lv <= t.depths[1]; });
  };
  const loot = (world, region, level) => {
    const own = m.worlds.find((w) => w.id === world).def.regions?.[region]?.loot;
    if (own) return own.length > 0;
    const tier = I.maxTierAt(level);
    const gear = [...Object.values(I.WEAPONS), ...Object.values(I.ARMOURS)].filter((g) => g.tier > 0 && g.tier <= tier);
    return gear.length > 0 && Object.values(I.POTIONS).some((p) => p.weight > 0) && Object.values(I.SCROLLS).some((s) => s.weight > 0);
  };
  let fewest = null;
  const exempt = [];
  for (const c of cover.values()) {
    const types = spawnable(c.world, c.region, c.level);
    if (c.world === "test" && c.level === 1 && /^landmark:temple floor 1$/.test(c.from) && types.length < 3) { exempt.push(`${c.from} (${types.join(", ")})`); continue; }
    if (!fewest || types.length < fewest.n) fewest = { n: types.length, at: `${c.world} ${c.region} level ${c.level}` };
    need(types.length >= 3, `coverage: ${c.world} world, region ${c.region}, level ${c.level} (${c.from}): ${types.length} creature type(s) spawnable (${types.join(", ")}), at least 3 needed`);
    need(loot(c.world, c.region, c.level), `coverage: ${c.world} world, region ${c.region}, level ${c.level}: no loot table`);
  }
  const levels = [...cover.values()].map((c) => c.level);
  stats.coverage = `${cover.size} (region, level) pairs over ${m.worlds.length} worlds (${sitesSeen} site dungeons on 3 seeds), levels ${Math.min(...levels)}-${Math.max(...levels)}; ` +
    `fewest types ${fewest?.n} (${fewest?.at})`;
  for (const e of exempt) notes.push(`coverage exempt: the test world's legacy stack keeps the parent's floor 1: ${e}`);
  if (!m.worlds.some((w) => Object.values(w.def.regions || {}).some((r) => r.creatures))) notes.push("no region has a creature table yet (C1): every level reads the legacy tables through contentLevel()");

  return { name: "content", ok: problems.length === 0, problems, stats, notes };
}

// Mutations the check must catch (each applied to the live registries, the check run, then undone): its teeth,
// run with every check. → { name, ok, problems, stats }
export const MUTATIONS = [
  ["a ragged art row", (m) => { const f = m.creatures.CREATURE_TYPES.rat.frames[0], old = f[1]; f[1] = old + "b"; return () => { f[1] = old; }; }, /creature rat: ragged row/],
  ["a palette letter missing", (m) => { const p = m.creatures.CREATURE_TYPES.bat.palette, old = p.e; delete p.e; return () => { p.e = old; }; }, /creature bat: no palette entry for "e"/],
  ["an unknown bonus key", (m) => { const p = m.items.PROPERTIES.keen, old = p.bonus; p.bonus = { critz: 0.1 }; return () => { p.bonus = old; }; }, /unknown bonus key "critz"/],
  ["a status of an unknown kind", (m) => { const s = m.status.STATUS_DEFS.hasted, old = s.kind; s.kind = "nice"; return () => { s.kind = old; }; }, /status hasted: kind nice/],
  ["two types fewer from level 20", (m) => { const T = m.creatures.CREATURE_TYPES, a = T.wraith.depths, b = T.troll.depths; T.wraith.depths = [10, 19]; T.troll.depths = [13, 19];
    return () => { T.wraith.depths = a; T.troll.depths = b; }; }, /coverage: .*level 2\d .*at least 3 needed/],
  ["a plan naming a missing legend handler", (m) => { const v = m.vaults.VAULTS[0], old = v.legend; v.legend = { ...(old || {}), X: "nope" }; return () => { v.legend = old; }; }, /names legend handler "nope"/],
  ["a screen without draw()", (m) => { m.screens.registerScreen("mutant", {}); return () => m.screens.SCREENS.delete("mutant"); }, /screen mutant: filed as mutant, draw undefined/],
  ["an ability with an unknown target", (m) => { m.abilities.registerAbility("mutant", { use: () => true, target: "nowhere" }); return () => { delete m.abilities.ABILITIES.mutant; }; }, /ability mutant: source innate, target nowhere/],
  ["a monster without hp", (m) => { const t = m.creatures.CREATURE_TYPES.goblin, old = t.hp; delete t.hp; return () => { t.hp = old; }; }, /creature goblin: hp undefined/],
  ["a held weapon's pivot outside (0, 1)", (m) => { const h = m.items.WEAPONS.dagger.held, old = h.pivot; h.pivot = 1.2; return () => { h.pivot = old; }; }, /held dagger: pivot 1.2/],
  ["an elite without info", (m) => { const e = m.creatures.ELITES.swift, old = e.info; delete e.info; return () => { e.info = old; }; }, /elite swift/],
  ["a material off its rung (C4)", (m) => { const d = m.c4.forge.MATERIALS.iron, old = d.tier; d.tier = 5; return () => { d.tier = old; }; }, /materials: tiers 1, 2, 5/],
  ["a worn piece for no faction (C4)", (m) => { const a = m.items.ARMOURS.featheredHood, old = a.wornRep; a.wornRep = { kytes: 250 }; return () => { a.wornRep = old; }; }, /armour featheredHood: reputation kytes/],
  ["a landmark's dark line punctuated (C1b)", (m) => { const e = m.c1b.landmarks.LANDMARKS.find((l) => l.id === "molar"), old = e.lines.dark; e.lines.dark = "So are we."; return () => { e.lines.dark = old; }; }, /landmark molar: its Dark line/],
  ["a plan's letter left to the default legend (C1b)", (m) => { const p = m.c1b.landmarks.PLANS.kettleMesa, old = p.legend.k; delete p.legend.k; return () => { p.legend.k = old; }; }, /landmark kettleMesa: plan kettleMesa's "k" falls to the default legend's key/],
  ["a dungeon short of a floor's name (C1b)", (m) => { const d = m.c1b.worldmap.LANDMARK_INDEX.find((l) => l.id === "metronome").dungeon, old = d.named; d.named = old.slice(1); return () => { d.named = old; }; }, /landmark metronome: 5 floor names for 6 floors/],
  ["a relic's dark line punctuated (C4)", (m) => { const d = m.c4.artifacts.ARTIFACTS_WAITING.noonglass, old = d.dark; d.dark = "It is noon."; return () => { d.dark = old; }; }, /waiting artifact noonglass: a relic's three registers/],
  ["an item kind with no sample", (m) => { m.items.registerItemKind("mutant", { name: () => "mutant", glyph: () => ["w", [1, 2, 3]], stack: false });
    return () => { delete m.items.ITEM_KINDS.mutant; }; }, /item kind mutant: no sample/],
  ["a HUD segment on row 2", (m) => { const d = m.hud.segmentDef("fps"); m.hud.registerHudSegment("fps", { ...d, row: 2 }); return () => m.hud.registerHudSegment("fps", d); }, /HUD segment fps/],
];

export function checkMutations(m) {
  const problems = [];
  let caught = 0;
  for (const [what, apply, want] of MUTATIONS) {
    const undo = apply(m);
    let r;
    try { r = checkContent(m); } finally { undo(); }
    if (r.problems.some((p) => want.test(p))) caught++;
    else problems.push(`${what}: not caught (${r.problems.slice(0, 2).join(" | ") || "no problem found"})`);
  }
  const after = checkContent(m);
  if (!after.ok) problems.push(`the registries aren't as they were after the mutations: ${after.problems.slice(0, 3).join(" | ")}`);
  return { name: "content mutations", ok: problems.length === 0, problems, stats: { caught: `${caught} of ${MUTATIONS.length}` } };
}

// The modules checkContent reads, after env.screen() has loaded the game as main.js does, and a run started.
export async function contentModules(src) {
  const [creatures, items, status, abilities, screens, hud, vaults, stats, leveling, run, sites, worldmodel, testWorld, worldmap, temple, game, interact, world] =
    await Promise.all(["creatures.js", "items.js", "status.js", "abilities.js", "screens.js", "hud.js", "gen/vaults.js", "stats.js", "leveling.js",
      "world/run.js", "world/sites.js", "world/worldmodel.js", "content/world/test-world.js", "content/world/worldmap.js", "content/world/temple.js",
      "game.js", "interact.js", "world.js"].map((p) => src(p)));
  // C4's tables (section 1b).
  const [forge, gear, tonics, artifacts, mutations, backgrounds, implants, body, missiles] = await Promise.all(["content/items/forge.js", "content/items/gear.js",
    "content/items/tonics.js", "content/items/artifacts.js", "content/mutations.js", "content/backgrounds.js", "content/items/implants.js", "body.js",
    "content/items/missiles.js"].map((p) => src(p)));
  // C1b's landmarks (section 1c).
  const [landmarks, dungeon, factions] = await Promise.all(["content/world/landmarks.js", "gen/dungeon.js", "content/factions.js"].map((p) => src(p)));
  game.startRun(4242);
  game.game.pages = null;
  return {
    creatures, items, status, abilities, screens, hud, vaults, stats, leveling, game: game.game,
    buildRun: run.buildRun, dungeonLevelOf: sites.dungeonLevelOf, compileWorld: worldmodel.compileWorld, contentLevel: stats.contentLevel,
    worlds: [{ id: "test", def: testWorld.TEST_WORLD }, { id: "real", def: worldmap.REAL_WORLD }],
    templeLegends: temple.TEMPLE_LEGENDS, interact, blocks: world.BLOCKS,
    body, c4: { forge, gear, tonics, artifacts, mutations, backgrounds, implants, missiles },
    c1b: { landmarks, worldmap, dungeon, factions },
  };
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-content.mjs gives.
export async function run(env) {
  await env.screen();
  const m = await contentModules(env.src);
  return [checkContent(m), checkMutations(m)];
}
