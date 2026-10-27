// WS6's check (TECH_DESIGN §8.3 "WS6a" and "WS6b" acceptance; owner WS6a, then WS6b after its cases): factions,
// reputation, witnesses and the dialogue builders.
//
//   1. factions   the 21 factions of bible §15.4 and the Bent villages are registered, each start (Bent / Plumb)
//                 is the bible's, likes and hates name registered factions and became relations ±1, the hidden
//                 parent groups never show
//   2. attitude   §2.11's table, band × temperament, toward you (every cell, at both edges of each band); weights
//                 (a hated membership of weight ≥ 0.25 wins, else the weighted mean); a talker that can't fight is
//                 wary where a fighter would be hostile; the house rule (flat against deep, a ghost against the
//                 light, unaware; dark-sight sees ghosts; you are seen across both); grudges; followers (friendly
//                 to their side, WS8's request 2: hostile to you is hostile to your followers); creature against
//                 creature (a shared faction, likes, hates, one way only, a parent group's relation); and the old
//                 game unchanged: every legacy monster out for you and nobody else, every legacy person neutral
//   3. rep        bands at their edges; baseRep by genotype and in a Pilgrim run (the Askew stay below zero);
//                 addRep's sum, its clamp to ±1000, the "rep" event; a background's changes on top (WS4's beginRun
//                 way); the kill penalties (common, named, weighted, the haters' half, repOnKill); an attack seen
//                 by nobody else costs nothing but grudges; only you and your followers move rep
//   4. bot        a real run (seed 1234): you hit a Hollowmere villager by walking into it on the map, and again
//                 with the 3D swing: the villager and the fellows that see it turn hostile, one out of range and one
//                 of another faction don't, Hollowmere's rep drops by attackPenalty, the kill costs killPenalty and
//                 the Assize (who hate the Bent) gain half, the Rustbacks nothing; the witnesses then hunt you (ai.js); a follower's blow
//                 counts; a blow at someone already out for you costs nothing
//   5. builders   every legacy person's dialogue and every role (villager, priest, guard, wanderer, merchant) of
//                 every faction at every band gives valid nodes, walked to depth 4 (each answer a node, null or a
//                 shop tab); a refusal at Dark is one goodbye; a Cold merchant won't open the pack; greetings stay
//                 within two lines (bible §2.1)
//   6. state      game.state.rep and knownFactions, and the creatures' grudges, are plain JSON and survive the
//                 save codec's round trip (save/codec.js)
//   7. screen     P opens the factions screen in both views, it lists what you know with the band's light word,
//                 the selection moves, P and Esc close it
//
// Part 6b (WS6b; TECH_DESIGN §8.3 "WS6b" with DECISIONS):
//   8. prices     priceOf against bible §3.1 for EGO 10-24 × Cold, Grey, Warm, Bright (buy × (1.5 − 0.1·EGO mod −
//                 step), sell × (0.3 + 0.05·EGO mod + step/2)); the note the trade screen shows; buying always
//                 dearer than selling; the Snuffer's +20%; a trader with no faction; the level factor; the legacy set
//   9. backing    the item backing: receive, pay, a payment too big refused whole, the smallest stack first, the
//                 overflow of a full pack; no liquid backing; the counter: a sale into a full purse becomes credit
//  10. Pell       his six services, each listed on the trade screen through registerService, paid and run
//  11. Kindling   each rite ready only in its view (the Tracing on the map, the Lighting in lit 3D facing them, the
//                 Snuffing in the dark), and offered so in talk; "only" factions; the bond's numbers (opinions,
//                 own reading, the sacrament poured, EGO); ink for the line; the hour of the Snuffing; the menu
//                 (readings and rumours, the +120 cap, powers by rank, recruiting and its follower limit, the best
//                 item, the −250 floor); the ritual screen; oathbreaking and the Snuffer, not for an accident
//  12. restock    on zone:enter after two world days away, not before nor on a load; the same goods for the same
//                 day; Pell too; the sacrament on sale; the back shelf only at Bright
//  13. voices     the legacy people keep theirs; a faction's (Hz, wave, flags); the heaviest membership; the talk screen
//  14. liquids    liquidAt by column; a vial filled beside water, drunk; ink makes you Flat; every sacrament exists
//  15. shrines    the component on a statue; donations (the Vigil's cap, the Lampless only in the dark)
//  16. trade      the screen by keys: from talk, a buy, Tab, Esc back to the talker's first words
//  17. JSON       the Kindling's, the Snuffer's and the donations' state
export const BIBLE_START = {   // bible §15.4 "Start (Bent / Plumb)"
  hollowmere: [100, 100], noonVigil: [50, 50], survey: [0, 0], assize: [-700, -100], horary: [0, 0], pressed: [-50, -50],
  lampless: [-100, -100], drovers: [0, 0], chandlers: [-50, -50], rustbacks: [-450, -450], flatfolk: [0, 0], unlit: [0, 0],
  askew: [-500, -500], plan: [-100, 100], moths: [300, 300], kites: [-100, -100], clatter: [50, 50], saltbeasts: [-400, -400],
  sporeMoot: [-200, -200], pleatwood: [0, 0], errata: [-250, -250],
};
// §2.11's table: band × temperament → attitude toward you.
const TABLE = {
  hated: ["hostile", "hostile", "hostile"], disliked: ["wary", "hostile", "hostile"], indifferent: ["neutral", "neutral", "hostile"],
  liked: ["friendly", "friendly", "neutral"], loved: ["friendly", "friendly", "friendly"],
};
const TEMPERS = ["docile", "neutral", "aggressive"];
const EDGES = { hated: [-1000, -600], disliked: [-599, -250], indifferent: [-249, 249], liked: [250, 599], loved: [600, 1000] };

export async function run(env) {
  const scr = await env.screen();
  const m = (p) => env.src(p);
  const { game, startRun } = await m("game.js");
  const F = await m("factions.js"), creatures = await m("creatures.js"), talk = await m("talk.js"), events = await m("events.js");
  const rep = await m("social/reputation.js"), builders = await m("social/builders.js"), combat = await m("combat.js");
  const zones = await m("zones.js"), turns = await m("turns.js"), ai = await m("ai.js"), monsters = await m("monsters.js"), rng = await m("rng.js");
  const codec = await m("save/codec.js"), keys = await m("keys.js"), screens = await m("screens.js"), scrF = await m("screens/factions.js");
  const S = await m("screen.js"), { lineOfSight } = await m("raycast.js");
  const problems = [], stats = {};
  const fail = (msg) => problems.push(msg);
  const R = rng.makeRng(616);
  const p = () => game.player;
  const fresh = (seed = 1234, { genotype, mode } = {}) => {
    startRun(seed);
    game.pages = null; game.mode = "map";
    if (genotype) game.player.genotype = genotype;
    if (mode) game.state.mode = mode;
    for (const c of [...game.zone.creatures]) creatures.removeCreature(game.zone, c);
  };
  // A creature (a monster's body) with memberships, a talker (a person's body) with a role.
  const mob = (faction, temper, opts = {}) => {
    const c = creatures.spawnCreature(opts.type || "goblin", opts.x ?? 2, opts.y ?? 2, opts.z ?? 0, { rng: R, level: 3 });
    if (faction) c.faction = typeof faction === "string" ? { [faction]: 1 } : faction;
    if (temper) c.brain = { temperament: temper };
    if (opts.name) c.name = opts.name;
    return c;
  };
  const person = (type, dialogue, faction) => {
    const c = creatures.spawnCreature(type, 3, 3, 0, { level: 5, talk: { dialogue, state: {} } });
    if (faction) c.faction = { [faction]: 1 };
    return c;
  };

  // --- 1. Factions ------------------------------------------------------------------------------------------------
  fresh(1234, { genotype: "bent" });
  {
    const shown = Object.values(F.FACTIONS).filter((f) => !f.hidden).map((f) => f.id);
    const missing = Object.keys(BIBLE_START).filter((id) => !F.FACTIONS[id]);
    if (missing.length) fail(`factions not registered: ${missing.join(", ")}`);
    if (shown.length !== 22) fail(`${shown.length} factions shown, want the 21 and the Bent villages`);
    for (const [id, [bent, plumb]] of Object.entries(BIBLE_START)) {
      game.player.genotype = "bent"; const b = F.baseRep(game, id);
      game.player.genotype = "plumb"; const q = F.baseRep(game, id);
      if (b !== bent || q !== plumb) fail(`${id} starts at ${b} / ${q}, the bible says ${bent} / ${plumb}`);
    }
    for (const f of Object.values(F.FACTIONS)) {
      if (!TEMPERS.includes(f.temperament)) fail(`${f.id}: temperament ${f.temperament}`);
      for (const [o] of [...f.likes, ...f.hates]) if (!F.FACTIONS[o]) fail(`${f.id} names an unknown faction ${o}`);
      for (const [o] of f.likes) if (f.relations[o] !== 1) fail(`${f.id} likes ${o} but its relation is ${f.relations[o]}`);
      for (const [o] of f.hates) if (f.relations[o] !== -1) fail(`${f.id} hates ${o} but its relation is ${f.relations[o]}`);
      if (f.parent && !F.FACTIONS[f.parent]?.hidden) fail(`${f.id}'s parent ${f.parent} isn't a hidden group`);
    }
    if (scrF.knownFactions(game).some((id) => F.FACTIONS[id].hidden)) fail("a hidden group is listed as known");
    stats.factions = `${shown.length} shown, ${Object.keys(F.FACTIONS).length - shown.length} hidden groups, ${Object.values(F.FACTIONS).reduce((s, f) => s + Object.keys(f.relations).length, 0)} relations`;
  }

  // --- 2. Attitude ------------------------------------------------------------------------------------------------
  {
    let cells = 0;
    for (const [bandId, [lo, hi]] of Object.entries(EDGES))
      for (const [k, temper] of TEMPERS.entries())
        for (const r of [lo, hi]) {
          game.state.rep = { survey: r };
          const c = mob("survey", temper);
          const got = F.attitude(game, c, p()), want = TABLE[bandId][k];
          if (got !== want) fail(`a ${temper} member at ${r} (${bandId}): ${got}, the table says ${want}`);
          const t = person("mira", "villager", "survey"); t.brain = { temperament: temper };
          const tw = want === "hostile" ? "wary" : want, tg = F.attitude(game, t, p());
          if (tg !== tw) fail(`a ${temper} talker at ${r}: ${tg}, want ${tw}`);
          cells++;
        }
    // Weights.
    game.state.rep = { survey: -700, drovers: 700 };
    const w1 = mob({ survey: 0.25, drovers: 0.75 }, "docile"), w2 = mob({ survey: 0.2, drovers: 0.8 }, "docile");
    if (F.attitude(game, w1, p()) !== "hostile") fail(`a hated membership of weight 0.25: ${F.attitude(game, w1, p())}`);
    if (F.attitude(game, w2, p()) !== "friendly") fail(`weight 0.2 hated, 0.8 loved (mean 420, Warm): ${F.attitude(game, w2, p())}`);
    // The house rule.
    game.state.rep = {};
    const deep = mob("hollowmere", "docile"), flat = mob("rustbacks", "aggressive", { type: "flatling" });
    const ghost = mob("rustbacks", "aggressive", { type: "warden" }), seer = mob("hollowmere", "docile");
    seer.darkSight = true;
    if (!creatures.isFlat(flat) || !creatures.isGhostly(ghost)) fail("the flatling isn't flat or the Gloom Warden isn't ghostly: pick other bodies");
    const pairs = [[flat, deep, "unaware"], [deep, flat, "unaware"], [ghost, deep, "unaware"], [deep, ghost, "unaware"],
      [seer, ghost, "hostile"], [ghost, seer, "neutral"], [flat, p(), "hostile"], [ghost, p(), "hostile"]];
    for (const [a, b, want] of pairs) { const got = F.attitude(game, a, b); if (got !== want) fail(`house rule: ${a.type}(${Object.keys(a.faction)}) → ${b === p() ? "you" : b.type}: ${got}, want ${want}`); }
    // Grudges.
    const calm = mob("hollowmere", "docile");
    calm.brain.grudges = { player: 1 };
    if (F.attitude(game, calm, p()) !== "hostile") fail("a grudge against you isn't hostile");
    // Followers (WS8's request 2).
    const monster = mob(null, null), fol = mob(null, null), fol2 = mob(null, null);
    fol.brain = { leader: "player" }; fol2.brain = { leader: "player" };
    const flatFol = mob(null, null, { type: "flatling" }); flatFol.brain = { leader: "player" };
    const want2 = [[monster, fol, "hostile"], [fol, monster, "hostile"], [fol, p(), "friendly"], [p(), fol, "friendly"], [fol, fol2, "friendly"],
      [monster, flatFol, "unaware"], [flatFol, monster, "unaware"], [fol, flat, "unaware"], [deep, fol, "neutral"], [calm, fol, "hostile"]];
    for (const [a, b, want] of want2) { const got = F.attitude(game, a, b); if (got !== want) fail(`followers: ${a === p() ? "you" : a.brain?.leader ? "your follower" : a.type} → ${b === p() ? "you" : b.brain?.leader ? "your follower" : b.type}: ${got}, want ${want}`); }
    // A talker that can't be struck: a creature's faction hatred of it reads neutral, and one bearing a grudge
    // against you is wary, not hostile.
    {
      game.state.rep = {};
      const rbTalker = person("mira", "villager", "rustbacks"), hmFighter = mob("hollowmere");
      if (F.attitude(game, hmFighter, rbTalker) !== "neutral") fail(`Hollowmere's fighter → a Rustback talker: ${F.attitude(game, hmFighter, rbTalker)}`);
      const sore = person("mira", "villager", "survey"); sore.brain = { grudges: { player: 1 } };
      if (F.attitude(game, sore, p()) !== "wary") fail(`a talker with a grudge: ${F.attitude(game, sore, p())}`);
    }
    // A cycle of leaders (a bug elsewhere) answers rather than overflowing the stack; so does a cycle of parents.
    {
      const x = mob(null, null), y = mob(null, null), d = mob(null, null);
      creatures.addCreature(game.zone, x); creatures.addCreature(game.zone, y);
      x.brain = { leader: y.id }; y.brain = { leader: x.id };
      let got;
      try { got = F.attitude(game, x, d); } catch (err) { got = err.message; }
      if (got !== "neutral") fail(`a cycle of leaders: ${got}`);
      creatures.removeCreature(game.zone, x); creatures.removeCreature(game.zone, y);
      F.registerFaction("test:loopA", { parent: "test:loopB" }); F.registerFaction("test:loopB", { parent: "test:loopA" });
      try { got = F.relation("test:loopA", "hollowmere"); } catch (err) { got = err.message; }
      finally { delete F.FACTIONS["test:loopA"]; delete F.FACTIONS["test:loopB"]; }
      if (got !== 0) fail(`a cycle of parents: ${got}`);
    }
    // A type's memberships are shared by its creatures: asking one talker where it stands mustn't reorder them,
    // and the type's own temperament counts.
    {
      const T = creatures.CREATURE_TYPES.goblin, keep = { f: T.factions, t: T.temperament };
      // No type temperament: the first faction's (Hollowmere, docile) decides, so at Cold it is wary.
      T.factions = { hollowmere: 0.3, rustbacks: 0.7 }; delete T.temperament;
      try {
        game.state.rep = { hollowmere: -400, rustbacks: -400 };
        const g1 = creatures.spawnCreature("goblin", 2, 2, 0, { rng: R, level: 2 }), g2 = creatures.spawnCreature("goblin", 3, 2, 0, { rng: R, level: 2 });
        const before = F.attitude(game, g2, p());
        let threw = null;
        try { builders.standingOf(game, g1); } catch (err) { threw = err.message; }
        const after = F.attitude(game, g2, p());
        if (threw || before !== after || before !== "wary") fail(`a type's memberships: ${before} → ${after} after standingOf${threw ? ` (threw ${threw})` : ""} (want wary both times)`);
        // The type's temperament over its factions': an aggressive type of Hollowmere at Grey is out for you.
        T.factions = { hollowmere: 1 }; T.temperament = "aggressive"; game.state.rep = {};
        const g3 = creatures.spawnCreature("goblin", 2, 3, 0, { rng: R, level: 2 });
        if (F.attitude(game, g3, p()) !== "hostile") fail(`an aggressive type of Hollowmere at Grey: ${F.attitude(game, g3, p())}`);
        T.temperament = "docile";   // the same table, a new temper: neutral (and the memberships read afresh)
        if (F.attitude(game, g3, p()) !== "neutral") fail(`a docile type of Hollowmere at Grey: ${F.attitude(game, g3, p())}`);
      } finally { T.factions = keep.f; T.temperament = keep.t; if (keep.f === undefined) delete T.factions; if (keep.t === undefined) delete T.temperament; }
    }
    // Creature against creature.
    const hm = mob("hollowmere"), hm2 = mob("hollowmere"), az = mob("assize"), cl = mob("clatter"), sv = mob("survey"), rb = mob("rustbacks");
    // The Assize hates Hollowmere through the Bent (a parent group); Hollowmere hates the Rustbacks, not back.
    const cc = [[hm, hm2, "friendly"], [hm, az, "hostile"], [az, hm, "hostile"], [hm, rb, "hostile"], [rb, hm, "neutral"], [hm, cl, "friendly"], [cl, sv, "neutral"]];
    F.registerFaction("test:beasts", { hidden: true, group: true, relations: { "test:people": -1 } });
    F.registerFaction("test:moth", { parent: "test:beasts" });
    F.registerFaction("test:people", { hidden: true, group: true });
    F.registerFaction("test:village", { parent: "test:people" });
    try {
      cc.push([mob("test:moth"), mob("test:village"), "hostile"], [mob("test:village"), mob("test:moth"), "neutral"]);
      for (const [a, b, want] of cc) { const got = F.attitude(game, a, b); if (got !== want) fail(`${Object.keys(a.faction)} → ${Object.keys(b.faction)}: ${got}, want ${want}`); }
    } finally { for (const id of ["test:beasts", "test:moth", "test:people", "test:village"]) delete F.FACTIONS[id]; }
    // The old game: nobody has a faction.
    let legacy = 0;
    const types = Object.entries(creatures.CREATURE_TYPES);
    const ms = types.filter(([, t]) => !t.talks).map(([id]) => creatures.spawnCreature(id, 2, 2, 0, { rng: R, level: 2 }));
    const ps = types.filter(([, t]) => t.talks).map(([id]) => creatures.spawnCreature(id, 2, 2, 0, { level: 2 }));
    for (const a of ms) {
      if (F.attitude(game, a, p()) !== "hostile") fail(`legacy ${a.type} isn't out for you`);
      for (const b of [...ms, ...ps]) if (a !== b && !["neutral", "unaware"].includes(F.attitude(game, a, b))) fail(`legacy ${a.type} → ${b.type}: ${F.attitude(game, a, b)}`);
      legacy++;
    }
    for (const a of ps) if (F.attitude(game, a, p()) !== "neutral") fail(`legacy person ${a.type} → you: ${F.attitude(game, a, p())}`);
    stats.attitude = `${cells} table cells × 2 bodies, ${pairs.length} house-rule pairs, ${want2.length} follower pairs, ${cc.length} creature pairs, ${legacy} legacy monsters × ${ms.length + ps.length}`;
  }

  // --- 3. Rep arithmetic ------------------------------------------------------------------------------------------
  {
    const edges = [[-1000, "hated"], [-600, "hated"], [-599, "disliked"], [-250, "disliked"], [-249, "indifferent"], [0, "indifferent"],
      [249, "indifferent"], [250, "liked"], [599, "liked"], [600, "loved"], [1000, "loved"]];
    for (const [r, want] of edges) if (F.band(r) !== want) fail(`band(${r}) = ${F.band(r)}, want ${want}`);
    fresh(1234, { genotype: "bent", mode: "pilgrim" });
    const pil = Object.keys(BIBLE_START).map((id) => [id, F.baseRep(game, id)]);
    for (const [id, r] of pil) {
      const want = id === "askew" ? -500 : Math.max(0, BIBLE_START[id][0]);
      if (r !== want) fail(`Pilgrim: ${id} starts at ${r}, want ${want}`);
    }
    fresh(1234, { genotype: "plumb" });
    const seen = [];
    const off = events.on("rep", (g, e) => seen.push(e));
    try {
      // A background on top (WS4's beginRun: addRep for each of BACKGROUNDS[...].rep): the Aspirant of the Rule.
      for (const [f, n] of Object.entries({ assize: 300, hollowmere: -50 })) F.addRep(game, f, n, "background");
      F.addRep(game, "bentVillages", -50, "background");
      const got = [F.repOf(game, "assize"), F.repOf(game, "hollowmere"), F.repOf(game, "bentVillages")].join();
      if (got !== "200,50,-50") fail(`a Plumb Aspirant starts at Assize, Hollowmere, the Bent villages = ${got}, want 200,50,-50`);
      if (F.addRep(game, "moths", 2000) !== 1000 || F.addRep(game, "askew", -5000) !== -1000) fail(`addRep isn't clamped to ±1000: ${F.repOf(game, "moths")}, ${F.repOf(game, "askew")}`);
      const before = seen.length;
      F.addRep(game, "moths", 50);   // already at the top: nothing moved
      if (seen.length !== before) fail("addRep emitted a change that didn't happen");
      // Halves round away from zero both ways, and a non-number moves nothing.
      const h0 = F.repOf(game, "kites");
      const down = F.addRep(game, "kites", -2.5) - h0, up = F.addRep(game, "kites", 2.5) - (h0 + down);
      if (down !== -3 || up !== 3) fail(`addRep ±2.5 moved ${down} and ${up}, want -3 and 3`);
      if (F.addRep(game, "kites", NaN) !== h0 || !Number.isFinite(F.repOf(game, "kites"))) fail(`addRep(NaN) left kites at ${F.repOf(game, "kites")}`);
      if (F.addRep(game, "survey", -Infinity) !== -1000 || F.band(NaN) !== "indifferent") fail(`addRep(−Infinity) → ${F.repOf(game, "survey")}, band(NaN) → ${F.band(NaN)}`);
      if (F.addRep({ player: game.player }, "assize", 5) !== F.baseRep({ player: game.player }, "assize")) fail("addRep with no state doesn't give the rep");
      const e = seen.find((x) => x.faction === "assize");
      if (!e || e.n !== 300 || e.from !== -100 || e.rep !== 200 || e.reason !== "background") fail(`the rep event: ${JSON.stringify(e)}`);
    } finally { off(); }
    // Kills.
    fresh(1234, { genotype: "bent" });
    const k1 = mob("hollowmere"), k2 = mob("hollowmere", null, { name: "Elder Wenn" }), k3 = mob({ hollowmere: 0.5, clatter: 0.5 });
    k2.named = true;
    const r1 = rep.killed(game, p(), k1), r2 = rep.killed(game, p(), k2), r3 = rep.killed(game, p(), k3);
    // The Assize hates the Bent (Hollowmere's parent group); nobody else hates Hollowmere.
    const ok1 = r1.hollowmere === 95 && r1.assize === -698 && Object.keys(r1).length === 2;
    const ok2 = r2.hollowmere === 45 && r2.assize === -673 && Object.keys(r2).length === 2;
    // Half weights: −2.5 rounds away from zero to −3, and the haters' half of 2.5 is 1 (the
    // Saltbeasts hate the Clatter, the Assize the Bent).
    const ok3 = r3.hollowmere === 42 && r3.clatter === 47 && r3.saltbeasts === -399 && r3.assize === -672 && Object.keys(r3).length === 4;
    if (!ok1) fail(`a common Hollowmere kill: ${JSON.stringify(r1)}`);
    if (!ok2) fail(`a named Hollowmere kill: ${JSON.stringify(r2)}`);
    if (!ok3) fail(`a half-Hollowmere, half-Clatter kill: ${JSON.stringify(r3)}`);
    const leg = mob(null); leg.repOnKill = { survey: 150, rustbacks: -100 };
    const r4 = rep.killed(game, p(), leg);
    if (r4.survey !== 150 || r4.rustbacks !== -550) fail(`repOnKill: ${JSON.stringify(r4)}`);
    const before = JSON.stringify(game.state.rep);
    const ally = mob("hollowmere"); ally.brain = { leader: "player" };
    rep.killed(game, p(), ally);   // your follower dying (the default source says you) is no offence
    rep.killed(game, null, mob("hollowmere")); rep.killed(game, mob("assize"), mob("hollowmere"));
    if (JSON.stringify(game.state.rep) !== before) fail("a kill with no source, or by a creature, moved rep");
    // Through the bus: killMonster with you as the source, and with none (a status, a fall).
    const z = mob("survey"); creatures.addCreature(game.zone, z);
    monsters.killMonster(game, z, "", false, true, p());
    const z2 = mob("survey"); creatures.addCreature(game.zone, z2);
    monsters.killMonster(game, z2, "", false, false, null);
    if (F.repOf(game, "survey") !== 145) fail(`killMonster by you, then by nothing: survey ${F.repOf(game, "survey")}, want 145`);
    stats.rep = `${edges.length} band edges, Pilgrim floors for ${pil.length}, kills: common ${r1.hollowmere - 100}, named ${r2.hollowmere - 95}, haters +${r1.assize + 700}`;
  }

  // --- 4. The bot -------------------------------------------------------------------------------------------------
  const bot = (view) => {
    fresh(1234, { genotype: "bent" });
    const zone = game.zone, P = p();
    const tx = Math.floor(P.x), ty = Math.floor(P.y);
    const floorAt = (x, y) => x >= 0 && y >= 0 && x < zone.w && y < zone.d && zone.stand[x + y * zone.w] >= 0 && Math.abs(zone.stand[x + y * zone.w] - P.z) < 1;
    // Tiles in sight within 6, one out of range (over 13 tiles off), the victim beside you.
    const near = [], far = [], hidden = [], edgeIn = [], edgeOut = [];
    for (let y = 0; y < zone.d; y++) for (let x = 0; x < zone.w; x++) {
      if ((x === tx && y === ty) || !floorAt(x, y)) continue;
      const d = Math.hypot(x + 0.5 - P.x, y + 0.5 - P.y);
      const sight = lineOfSight(zone, x + 0.5, y + 0.5, zone.stand[x + y * zone.w] + 1.4, P.x, P.y, P.z + 1.5);
      if (d < 6 && d >= 2 && sight) near.push([x, y]);
      else if (d > 14 && d < 30) far.push([x, y]);
      if (d >= 2 && d < 10 && !sight) hidden.push([x, y]);   // a fellow within range behind a wall: not a witness
      if (sight && d > 10.5 && d < 11.8) edgeIn.push([x, y]);   // just inside witnessRange (12)
      if (sight && d > 12.3 && d < 13.8) edgeOut.push([x, y]);  // just outside it
    }
    const side = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([dx, dy]) => floorAt(tx + dx, ty + dy));
    if (!side || near.length < 3 || !far.length) { fail(`${view}: no room around the start for the bot (${near.length} near, ${far.length} far)`); return null; }
    const put = (x, y, faction, name) => {
      const c = creatures.spawnCreature("goblin", x, y, zone.stand[x + y * zone.w], { rng: R, level: 2 });
      c.faction = { [faction]: 1 }; c.brain = { temperament: "docile" }; c.name = name; c.xp = 0;
      return creatures.addCreature(zone, c);
    };
    const victim = put(tx + side[0], ty + side[1], "hollowmere", "reed-cutter");
    const used = new Set([`${tx + side[0]},${ty + side[1]}`]);
    const pickNear = () => { const t = near.find(([x, y]) => !used.has(`${x},${y}`)); used.add(`${t[0]},${t[1]}`); return t; };
    const w1 = put(...pickNear(), "hollowmere", "eel-netter"), w2 = put(...pickNear(), "hollowmere", "salt-raker");
    const other = put(...pickNear(), "clatter", "shell-trader");
    const away = put(...far[0], "hollowmere", "far reed-cutter");
    const all = [victim, w1, w2, other, away];
    // The edges, where this spot has them (stats say which): behind a wall, just inside and just outside 12 tiles.
    const extra = [[hidden, "neutral", "behind a wall"], [edgeIn, "hostile", "in sight 11 tiles off"], [edgeOut, "neutral", "in sight 13 tiles off"]]
      .filter(([spots]) => spots.length).map(([spots, want, what]) => ({ c: put(...spots[0], "hollowmere", what), want, what }));
    const before = all.map((c) => F.attitude(game, c, P));
    if (before.some((a) => a !== "neutral")) fail(`${view}: before the blow: ${before.join(", ")}`);
    const r0 = F.repOf(game, "hollowmere");
    game.combatRng = rng.makeRng(4);
    let blows = 0, first = null;
    const swing = () => {
      blows++;
      // (On the map a creature not out for you is in the way: Shift + the direction strikes it, turns.js mapStep.)
      if (view === "map") { game.mode = "map"; game.view = "map"; turns.mapStep(game, side[0], side[1], { force: true }); }
      else {
        game.mode = "explore"; game.view = "3d";
        P.attackCd = 0; P.pitch = Math.atan2(victim.z + victim.h * 0.5 - (P.z + 1.5), Math.hypot(victim.x - P.x, victim.y - P.y));
        P.yaw = Math.atan2(victim.y - P.y, victim.x - P.x);
        combat.playerMelee(game);
      }
    };
    while (zone.creatures.includes(victim) && blows < 40) {
      swing();
      if (first === null && victim.brain?.grudges?.player) {
        first = { rep: F.repOf(game, "hollowmere"), att: all.map((c) => F.attitude(game, c, P)), blows };
        for (const e of extra) e.first = F.attitude(game, e.c, P);
      }
    }
    const out = { view, blows, first, r0, killed: !zone.creatures.includes(victim) };
    if (!first) { fail(`${view}: ${blows} blows and the villager bears no grudge`); return out; }
    const [av, a1, a2, ao, aa] = first.att;
    if (av !== "hostile" || a1 !== "hostile" || a2 !== "hostile") fail(`${view}: after the first blow the villager and the two who saw it: ${av}, ${a1}, ${a2}`);
    if (ao !== "neutral" || aa !== "neutral") fail(`${view}: the Clatter trader and the far villager: ${ao}, ${aa} (want neutral, neutral)`);
    for (const e of extra) if (e.first !== e.want) fail(`${view}: a fellow ${e.what}: ${e.first}, want ${e.want}`);
    out.edges = extra.map((e) => e.what).join(", ") || "none here";
    if (first.rep !== r0 + rep.REP_RULES.attackPenalty) fail(`${view}: Hollowmere ${r0} → ${first.rep} after the first blow, want ${r0 + rep.REP_RULES.attackPenalty}`);
    out.afterBlows = F.repOf(game, "hollowmere");
    if (out.afterBlows !== first.rep && !out.killed) fail(`${view}: later blows moved rep again: ${first.rep} → ${out.afterBlows}`);
    if (!out.killed) fail(`${view}: the villager survived ${blows} blows`);
    else {
      const want = r0 + rep.REP_RULES.attackPenalty + rep.REP_RULES.killPenalty;
      if (F.repOf(game, "hollowmere") !== want) fail(`${view}: after the kill Hollowmere is ${F.repOf(game, "hollowmere")}, want ${want}`);
      if (F.repOf(game, "assize") !== -698 || F.repOf(game, "rustbacks") !== -450) fail(`${view}: the haters' half: assize ${F.repOf(game, "assize")}, rustbacks ${F.repOf(game, "rustbacks")}`);
    }
    out.rep = F.repOf(game, "hollowmere");
    // The witnesses hunt you.
    game.mode = view === "map" ? "map" : "explore";
    for (let k = 0; k < 12; k++) ai.updateCreatures(game, 0.25);
    out.hunting = [w1, w2].filter((c) => c.state === "chase").length;
    if (out.hunting < 2) fail(`${view}: ${out.hunting} of the 2 witnesses hunt you after 3 s (states ${w1.state}, ${w2.state})`);
    if (other.state === "chase" || away.state === "chase") fail(`${view}: the Clatter trader or the far villager hunts you`);
    return out;
  };
  {
    const runs = [bot("map"), bot("3d")].filter(Boolean);
    stats.bot = runs.map((r) => `${r.view}: rep ${r.r0} → ${r.first?.rep} at blow ${r.first?.blows} → ${r.rep} killed in ${r.blows}, ${r.hunting} witnesses hunting; edges tried: ${r.edges}`).join("; ");
  }
  {
    // A follower's blow counts; a blow at someone already out for you, or seen by nobody, costs no rep.
    fresh(1234, { genotype: "bent" });
    const zone = game.zone, P = p();
    const at = (dx, dy, faction, temper) => {
      const x = Math.floor(P.x) + dx, y = Math.floor(P.y) + dy;
      const c = mob(faction, temper, { x, y, z: P.z }); c.x = P.x + dx; c.y = P.y + dy; c.z = P.z;
      return creatures.addCreature(zone, c);
    };
    const fol = at(0, 0, null, null); fol.brain = { leader: "player" };
    const v = at(0.6, 0, "survey", "neutral"), wit = at(0.6, 0.3, "survey", "neutral");
    const r0 = F.repOf(game, "survey");
    rep.offend(game, fol, v);
    if (F.repOf(game, "survey") !== r0 + rep.REP_RULES.attackPenalty || !wit.brain.grudges?.player || !wit.brain.grudges?.[fol.id])
      fail(`a follower's blow: survey ${r0} → ${F.repOf(game, "survey")}, the witness's grudges ${JSON.stringify(wit.brain.grudges)}`);
    const az = at(-0.6, 0, "assize"), azw = at(-0.6, 0.3, "assize");
    const a0 = F.repOf(game, "assize");
    rep.offend(game, P, az);
    if (F.repOf(game, "assize") !== a0 || azw.brain?.grudges) fail(`a blow at an Assize member already out for a Bent you moved rep (${a0} → ${F.repOf(game, "assize")}) or gave grudges`);
    const lone = at(0, -0.6, "drovers", "neutral");
    const d0 = F.repOf(game, "drovers");
    rep.offend(game, P, lone);
    if (F.repOf(game, "drovers") !== d0 || !lone.brain.grudges?.player) fail(`an unseen blow: drovers ${d0} → ${F.repOf(game, "drovers")}, grudge ${JSON.stringify(lone.brain.grudges)}`);
    // The witness range's edge, on an open span: a fellow in sight 11 tiles off saw it, one 13 tiles off didn't. (A
    // witness sees no farther than its own sight, WS8's creatures.sees: so an archer, sight 13, for the 12-tile range.)
    {
      zones.changeZone(game, "1,0,0", { how: "start", rng: R });
      for (const o of [...game.zone.creatures]) creatures.removeCreature(game.zone, o);
      const z2 = game.zone, P2 = p();
      const seeAt = (d, tol = 0.2) => {
        for (let k = 0; k < 256; k++) {
          const ang = (k / 256) * Math.PI * 2, x = Math.floor(P2.x + Math.cos(ang) * d), y = Math.floor(P2.y + Math.sin(ang) * d);
          if (x < 0 || y < 0 || x >= z2.w || y >= z2.d || z2.stand[x + y * z2.w] < 0) continue;
          const dd = Math.hypot(x + 0.5 - P2.x, y + 0.5 - P2.y);
          if (Math.abs(dd - d) < tol && lineOfSight(z2, x + 0.5, y + 0.5, z2.stand[x + y * z2.w] + 1.4, P2.x, P2.y, P2.z + 1.5)) return [x, y];
        }
        return null;
      };
      // Just inside and just outside 12 (11.55-11.95 and 12.1-12.5 tiles off).
      const i11 = seeAt(11.75), o13 = seeAt(12.3);
      if (!i11 || !o13) fail(`the range edge: no open tile in sight at 11.75 (${i11}) or 12.3 (${o13}) tiles on 1,0,0`);
      else {
        const put2 = ([x, y]) => { const c = mob("survey", "neutral", { x, y, z: z2.stand[x + y * z2.w], type: "archer" }); return creatures.addCreature(z2, c); };
        const v2 = mob("survey", "neutral"); Object.assign(v2, { x: P2.x + 0.6, y: P2.y, z: P2.z }); creatures.addCreature(z2, v2);
        const near11 = put2(i11), far13 = put2(o13);
        const seen = rep.witnessesOf(game, P2, v2);
        if (!seen.includes(near11) || seen.includes(far13)) fail(`the range edge: 11.75 tiles off a witness ${seen.includes(near11)}, 12.3 tiles off ${seen.includes(far13)}`);
      }
    }
    // Each handler alone: a "hurt" with no blow (a bomb of yours) and an "attack" that missed each cost the penalty
    // once; a blow that couldn't touch costs nothing. A talker's death is a named kill.
    {
      fresh(1234, { genotype: "bent" });
      const P3 = p(), at3 = (dx, dy, f) => { const c = mob(f, "neutral"); Object.assign(c, { x: P3.x + dx, y: P3.y + dy, z: P3.z }); return creatures.addCreature(game.zone, c); };
      const h1 = at3(0.6, 0, "survey"); at3(0.6, 0.3, "survey");
      events.emit(game, "hurt", { tgt: h1, src: P3, dmg: 3 });
      const a1 = at3(-0.6, 0, "drovers"); at3(-0.6, 0.3, "drovers");
      events.emit(game, "attack", { att: P3, tgt: a1, result: { touched: true, hit: false } });
      const n1 = at3(0, 0.6, "clatter"); at3(0.3, 0.6, "clatter");
      events.emit(game, "attack", { att: P3, tgt: n1, result: { touched: false } });
      const got = [F.repOf(game, "survey"), F.repOf(game, "drovers"), F.repOf(game, "clatter")].join();
      if (got !== "-10,-10,50") fail(`a hurt alone, a missed attack alone, an untouched one: survey, drovers, clatter = ${got}, want -10,-10,50`);
      const talker = person("mira", "villager", "flatfolk");
      const k = rep.killed(game, P3, talker);
      if (k.flatfolk !== rep.REP_RULES.namedKillPenalty) fail(`killing a talker of the Flatfolk: ${JSON.stringify(k)}, want ${rep.REP_RULES.namedKillPenalty}`);
    }
    // Through combat.resolveAttack: the victim holds a blow against you (WS8's turnOnYou) only after "hurt" and
    // "attack" have gone out, so your first blow, landed under either set or missed under d20, costs rep once with
    // a fellow watching and both turn on you (merge finding: the grudge came first, offend saw a hostile victim).
    {
      const { overrideRules } = await m("rules.js");
      const got = [];
      for (const [set, how] of [["legacy", "hit"], ["d20", "hit"], ["d20", "miss"]]) {
        fresh(1234, { genotype: "bent" });
        const undo = overrideRules("combat", set);
        try {
          const P4 = p(), v = mob("pleatwood", "docile"), w = mob("pleatwood", "docile");
          Object.assign(v, { x: P4.x + 0.8, y: P4.y, z: P4.z, hp: 500, maxHp: 500 }); Object.assign(w, { x: P4.x + 0.8, y: P4.y + 0.5, z: P4.z });
          creatures.addCreature(game.zone, v); creatures.addCreature(game.zone, w);
          const r0 = F.repOf(game, "pleatwood");
          const r = combat.resolveAttack(game, P4, v, combat.weaponSpec(P4), { view: "map", rng: how === "miss" ? () => 0 : () => 0.6 });
          const r1 = F.repOf(game, "pleatwood");
          combat.resolveAttack(game, P4, v, combat.weaponSpec(P4), { view: "map", rng: () => 0.6 });
          const line = `${set} ${how}: ${r0} → ${r1} → ${F.repOf(game, "pleatwood")}, ${F.attitude(game, v, P4)}, ${F.attitude(game, w, P4)}`;
          got.push(line);
          if (r.hit !== (how === "hit") || r1 !== r0 + rep.REP_RULES.attackPenalty || F.repOf(game, "pleatwood") !== r1 ||
              F.attitude(game, v, P4) !== "hostile" || F.attitude(game, w, P4) !== "hostile")
            fail(`your first blow through resolveAttack (${line}${r.hit !== (how === "hit") ? `, hit ${r.hit}` : ""}): want ${r0} → ${r0 + rep.REP_RULES.attackPenalty} once, both hostile`);
        } finally { undo(); }
      }
      stats.throughCombat = got.join("; ");
    }
    // Harm's source (request 2, at the merge): a Survey member dying of poison you gave (src "player": your blade's,
    // your cloud's) is your kill, one dying of a trap's gas nobody's (no rep; the XP stays the parent's either way);
    // the "kill" payload names the victim's factions; applyDamage given no source moves nothing.
    {
      const status = await m("status.js"), seen = [];
      const off = events.on("kill", (g, e) => seen.push(e));
      try {
        const got = [];
        for (const [how, src] of [["yours", "player"], ["a trap's", undefined]]) {
          fresh(1234, { genotype: "bent" });
          const P5 = p(), v = mob({ survey: 0.6, drovers: 0.4 }, "docile"), w = mob("survey", "docile");
          Object.assign(v, { x: P5.x + 0.8, y: P5.y, z: P5.z, hp: 1 }); Object.assign(w, { x: P5.x + 0.8, y: P5.y + 0.5, z: P5.z });
          creatures.addCreature(game.zone, v); creatures.addCreature(game.zone, w);
          const r0 = F.repOf(game, "survey"), xp0 = P5.xp;
          status.addStatus(game, v, "poisoned", { t: 30, mag: 2, src });
          for (let k = 0; k < 40 && game.zone.creatures.includes(v); k++) status.tickStatuses(game, v, 0.25);
          const dead = !game.zone.creatures.includes(v), kill = seen.find((e) => e.c === v);
          got.push(`${how} poison: survey ${r0} → ${F.repOf(game, "survey")}, xp +${P5.xp - xp0}, factions ${kill?.factions?.join("+")}`);
          const want = src ? r0 + Math.round(rep.REP_RULES.killPenalty * 0.6) : r0;
          if (!dead || F.repOf(game, "survey") !== want || !(P5.xp > xp0) || kill?.factions?.join() !== "survey,drovers")
            fail(`a death by ${how} poison: ${got.at(-1)}, dead ${dead} (want survey ${want}, some XP, factions survey+drovers)`);
        }
        fresh(1234, { genotype: "bent" });
        const P6 = p(), v = mob("survey", "docile"), w = mob("survey", "docile");
        Object.assign(v, { x: P6.x + 0.8, y: P6.y, z: P6.z, hp: 500, maxHp: 500 }); Object.assign(w, { x: P6.x + 0.8, y: P6.y + 0.5, z: P6.z });
        creatures.addCreature(game.zone, v); creatures.addCreature(game.zone, w);
        const r0 = F.repOf(game, "survey");
        combat.applyDamage(game, v, 3);
        if (F.repOf(game, "survey") !== r0 || v.brain?.grudges || w.brain?.grudges)
          fail(`applyDamage with no source: survey ${r0} → ${F.repOf(game, "survey")}, grudges ${JSON.stringify([v.brain?.grudges, w.brain?.grudges])}`);
        // Your thrown poison's cloud marks the poison yours; a trap's gas (no src) leaves it nobody's.
        {
          const fx = await m("effects.js"), throwing = await m("throwing.js");
          fresh(1234, { genotype: "bent" });
          const P7 = p(), a = mob("survey", "docile"), b = mob("survey", "docile");
          Object.assign(a, { x: P7.x + 4, y: P7.y, z: P7.z }); Object.assign(b, { x: P7.x - 4, y: P7.y, z: P7.z });
          creatures.addCreature(game.zone, a); creatures.addCreature(game.zone, b);
          fx.splash(game, "poison", { x: a.x, y: a.y, z: a.z + 1, r: 1.5, near: [], youToo: false, names: [] });
          game.zone.clouds.push({ x: b.x, y: b.y, z: b.z + 1, r: 1.5, time: 8, kind: "poison" });
          throwing.updateClouds(game, 0.1);
          const sa = status.statusOf(a, "poisoned")?.src, sb = status.statusOf(b, "poisoned");
          got.push(`clouds: yours ${sa}, a trap's ${sb?.src ?? null}`);
          if (sa !== "player" || !sb || sb.src) fail(`poison clouds: your thrown one's poison src ${sa} (want player), a trap's ${sb ? sb.src : "no poison"} (want none)`);
        }
        stats.harmSource = got.join("; ");
      } finally { off(); }
    }
    // A kill that wasn't your aim (WS6b request 2, at its merge): a creature dying on your thorns is told { splash: true }
    // in the "kill" payload (the Kindling's oaths let it pass, social/ritual.js); a blow's kill is not.
    {
      const seen = [], off = events.on("kill", (g, e) => seen.push(e));
      try {
        fresh(1234, { genotype: "bent" });
        const P9 = p(), combat2 = combat, st = await m("stats.js");
        const t = mob(null, null); Object.assign(t, { x: P9.x + 0.8, y: P9.y, z: P9.z, hp: 1 }); creatures.addCreature(game.zone, t);
        P9.bonuses = { ...(P9.bonuses || {}), thorns: 5 }; st.invalidateStats(P9);
        combat2.hitPlayer(game, t, 1, "the goblin", "the goblin's blow", false, () => 0.5, 0);
        delete P9.bonuses.thorns; st.invalidateStats(P9);
        const u = mob(null, null); Object.assign(u, { x: P9.x + 0.8, y: P9.y, z: P9.z, hp: 1 }); creatures.addCreature(game.zone, u);
        monsters.killMonster(game, u, "test");
        const k1 = seen.find((e) => e.c === t), k2 = seen.find((e) => e.c === u);
        stats.splash = `thorns ${k1 ? k1.splash : "no kill"}, a blow ${k2 ? !!k2.splash : "no kill"}`;
        if (k1?.splash !== true || k1?.src !== P9 || !k2 || k2.splash) fail(`the kill payload's splash: ${stats.splash} (want thorns true with you as the source, a blow false)`);
      } finally { off(); }
    }
    // Mortal villagers (WS6a #1, at the WS7b merge): a talker whose type has hp (WS7's villagers) can be struck. On the
    // map a bump talks; Shift + the direction strikes it (a fellow in sight: rep and grudges); out for you, a bump strikes
    // it; killed, a talker's death is a named kill. A legacy person (no hp) still only talks, Shift or not.
    {
      fresh(1234, { genotype: "bent" });
      const P10 = p(), zone = game.zone, tx = Math.floor(P10.x), ty = Math.floor(P10.y);
      const free = (x, y) => zone.stand[x + y * zone.w] === P10.z && !creatures.creatureAt(zone, x, y);
      const side = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([dx, dy]) => free(tx + dx, ty + dy) && free(tx - dx, ty - dy));
      const v = creatures.addCreature(zone, creatures.spawnCreature("villageWarden", tx + side[0], ty + side[1], P10.z, { level: 3 }));
      const wit = creatures.addCreature(zone, creatures.spawnCreature("villageLeech", tx - side[0], ty - side[1], P10.z, { level: 3 }));
      v.faction = { hollowmere: 1 }; wit.faction = { hollowmere: 1 };
      const r0 = F.repOf(game, "hollowmere"), hp0 = v.hp, out = [];
      game.mode = "map"; game.view = "map";
      turns.mapStep(game, side[0], side[1]);
      out.push(`bump: ${game.mode}`);
      const talked = game.mode === "talk";
      while (game.mode !== "map") keys.dispatchKey(game, "Escape");
      turns.mapStep(game, side[0], side[1], { force: true });
      const struck = { hp: v.hp, rep: F.repOf(game, "hollowmere"), att: F.attitude(game, v, P10), wit: F.attitude(game, wit, P10), mode: game.mode };
      out.push(`Shift: hp ${hp0} → ${struck.hp}, Hollowmere ${r0} → ${struck.rep}, ${struck.att} / ${struck.wit}`);
      v.hp = Math.min(v.hp, 1);
      for (let k = 0; k < 20 && zone.creatures.includes(v); k++) turns.mapStep(game, side[0], side[1]);
      const killed = !zone.creatures.includes(v), rk = F.repOf(game, "hollowmere");
      out.push(`out for you, bumps: ${killed ? "killed" : "alive"}, Hollowmere ${rk}`);
      const mira = creatures.addCreature(zone, creatures.spawnCreature("mira", tx + side[0], ty + side[1], P10.z, { level: 5 }));
      turns.mapStep(game, side[0], side[1], { force: true });
      out.push(`Shift on a legacy person: ${game.mode}, touchable ${creatures.touchable(game, mira)}`);
      while (game.mode !== "map") keys.dispatchKey(game, "Escape");
      stats.mortal = out.join("; ");
      if (!(hp0 > 0) || !talked || !(struck.hp < hp0) || struck.mode !== "map" || struck.rep !== r0 + rep.REP_RULES.attackPenalty || struck.att !== "hostile" || struck.wit !== "hostile" ||
          !killed || rk !== r0 + rep.REP_RULES.attackPenalty + rep.REP_RULES.namedKillPenalty || mira.hp !== undefined || creatures.touchable(game, mira))
        fail(`mortal villagers: ${stats.mortal}`);
    }
    // An implant fitted in play (WS5 #20, bible §10.4): the Plan +25 each, the first four only; taking one out, or a
    // creature's fitting, moves nothing.
    {
      const IM = await m("bodymods/implants.js");
      fresh(1234, { genotype: "plumb" });
      const P8 = p(), r0 = F.repOf(game, "plan"), it = { kind: "implant", id: "lampCrown" };
      const fit = IM.install(game, P8, it, "head", { free: true });
      const r1 = F.repOf(game, "plan");
      IM.uninstall(game, P8, "head");
      const r2 = F.repOf(game, "plan");
      events.emit(game, "install", { e: mob(null, null), item: it, partId: "head" });
      const rc = F.repOf(game, "plan");
      for (let k = 0; k < 4; k++) events.emit(game, "install", { e: P8, item: it, partId: "head" });
      const r3 = F.repOf(game, "plan");
      stats.implants = `Plan ${r0} → ${r1} fitted → ${r2} out → ${rc} a creature's → ${r3} after four more`;
      if (!fit.ok || r1 !== r0 + 25 || r2 !== r1 || rc !== r2 || r3 !== r0 + 100) fail(`implants and the Plan: ${stats.implants}${fit.ok ? "" : ` (install: ${fit.reason})`}, want ${r0 + 25}, ${r0 + 25}, ${r0 + 25}, ${r0 + 100}`);
    }
    stats.offend = `follower's blow ${rep.REP_RULES.attackPenalty}, at the hostile 0, unseen 0`;
  }

  // --- 5. Builders ------------------------------------------------------------------------------------------------
  {
    fresh(1234, { genotype: "bent" });
    let walked = 0, nodes = 0;
    const legacy = Object.entries(creatures.CREATURE_TYPES).filter(([, t]) => t.talks).map(([id]) => id);
    for (const id of legacy) {
      fresh(1234, { genotype: "bent" });
      const c = creatures.spawnCreature(id, 3, 3, 0, { level: 5, talk: { state: id === "pell" ? { stock: [] } : id === "door" ? { choices: ["3", "5"], answer: "3", gate: [], spawns: [] } : {} } });
      creatures.addCreature(game.zone, c);
      const w = builders.walkDialogue(game, c);
      walked++; nodes += w.nodes;
      for (const pr of w.problems) fail(`legacy ${id}: ${pr}`);
      game.mode = "map"; game.modeStack = [];
    }
    fresh(1234, { genotype: "bent" });
    const shown = Object.values(F.FACTIONS).filter((f) => !f.hidden), curtSeen = {};
    const opens = (x) => !!(x?.trade || x?.shop);   // the pack: WS6b's trade screen (Pell keeps his shop)
    for (const role of builders.ROLES) for (const f of shown) for (const [bandId, [lo]] of Object.entries(EDGES)) {
      game.state.rep = { [f.id]: bandId === "hated" ? -800 : lo };
      const c = person("mira", role, f.id);
      c.talk.state = role === "merchant" ? { stock: [{ item: { kind: "potion", id: "heal" }, price: 10, count: 1 }] } : {};
      const w = builders.walkDialogue(game, c);
      walked++; nodes += w.nodes;
      for (const pr of w.problems) fail(`${role} of ${f.id} at ${bandId}: ${pr}`);
      const root = talk.talkTo(game, c);
      if (root.text.length > 140) fail(`${role} of ${f.id} at ${bandId}: a ${root.text.length}-letter greeting`);
      if (bandId === "hated" && (root.options.length !== 1 || !root.options[0].bye)) fail(`${role} of ${f.id} at Dark: ${root.options.length} options`);
      const st = builders.standingOf(game, c);
      const refused = st.attitude === "hostile" || bandId === "hated", curt = !refused && (bandId === "disliked" || st.attitude === "wary");
      if (curt) curtSeen[role] = (curtSeen[role] || 0) + 1;
      if (refused !== (root.options.length === 1 && root.options[0].bye === true)) fail(`${role} of ${f.id} at ${bandId}: refused ${refused}, options ${root.options.length}`);
      if (role === "merchant" && !refused) {
        const shop = root.options.find((o) => /what you have/.test(o.label))?.go();
        const want = curt ? "node" : "shop";
        if ((opens(shop) ? "shop" : "node") !== want) fail(`merchant of ${f.id} at ${bandId}: the pack gives ${JSON.stringify(shop?.trade ?? shop?.shop ?? shop?.text)}`);
      }
    }
    // Cold is reached by a talker of one faction (every role, every temperament, the merchant's pack shut).
    for (const role of builders.ROLES) if (!(curtSeen[role] > 0)) fail(`no ${role} of a single faction ever spoke curtly at Cold`);
    for (const temper of TEMPERS) {
      game.state.rep = { drovers: -400 };
      const c = person("mira", "merchant", "drovers"); c.brain = { temperament: temper };
      c.talk.state = { stock: [{ item: { kind: "potion", id: "heal" }, price: 10, count: 1 }] };
      const root = talk.talkTo(game, c), pack = root.options.find((o) => /what you have/.test(o.label))?.go();
      if (root.text !== builders.GREET.merchant.disliked || !pack || opens(pack)) fail(`a ${temper} Drover merchant at Cold: "${root.text}", the pack ${JSON.stringify(pack?.shop ?? pack?.text)}`);
    }
    // A grudge makes a Grey talker curt, and curt never says "New face." (met or not).
    {
      game.state.rep = {};
      const g = person("mira", "villager", "survey"); g.brain = { grudges: { player: 1 } };
      const text = talk.talkTo(game, g).text;
      if (text !== builders.GREET.villager.disliked) fail(`a Grey villager with a grudge, met for the first time: "${text}"`);
    }
    // Bad answers are caught: a shop tab that doesn't exist.
    {
      const bad = person("mira", "test:badShop", null);
      talk.registerDialogue("test:badShop", () => talk.node("hi", [{ label: "Show me.", go: () => ({ shop: "attic" }) }, talk.bye()]));
      const w = builders.walkDialogue(game, bad);
      talk.registerDialogue("test:badShop", () => talk.node("...", [talk.bye()]));
      if (!w.problems.some((x) => /shop tab attic/.test(x))) fail(`walkDialogue let a shop tab "attic" through: ${w.problems.join("; ")}`);
    }
    // The main faction is the heaviest; Cold with it is curt though the weighted mean is Grey; a merchant opens on buy.
    {
      game.state.rep = { survey: -400, drovers: 0 };
      const mix = person("mira", "merchant", null); mix.faction = { drovers: 0.4, survey: 0.6 };
      mix.talk.state = { stock: [{ item: { kind: "potion", id: "heal" }, price: 10, count: 1 }] };
      const st = builders.standingOf(game, mix), root = talk.talkTo(game, mix);
      if (st.faction !== "survey" || st.attitude !== "neutral" || root.text !== builders.GREET.merchant.disliked)
        fail(`a merchant 0.6 Survey (Cold) 0.4 Drovers: main ${st.faction}, ${st.attitude}, "${root.text}"`);
      const shut = root.options.find((o) => /what you have/.test(o.label))?.go();
      if (!shut || opens(shut)) fail(`the same merchant at Cold opens its pack: ${JSON.stringify(shut?.trade)}`);
      game.state.rep = {};
      const open = talk.talkTo(game, mix).options.find((o) => /what you have/.test(o.label))?.go();
      if (open?.trade !== "theirs") fail(`a Grey merchant's pack opens on ${JSON.stringify(open?.trade ?? open?.shop)}, want the trade screen on theirs (WS6b)`);
    }
    // A talker with no faction (the roles work for anyone).
    for (const role of builders.ROLES) {
      const w = builders.walkDialogue(game, person("rook", role, null));
      walked++; nodes += w.nodes;
      for (const pr of w.problems) fail(`${role} with no faction: ${pr}`);
    }
    stats.builders = `${walked} talkers walked (${legacy.length} legacy, ${builders.ROLES.length} roles × ${shown.length} factions × 5 bands, ${builders.ROLES.length} without), ${nodes} nodes`;
  }

  // --- 6. JSON-only state -----------------------------------------------------------------------------------------
  {
    fresh(1234, { genotype: "bent" });
    const P = p(), c = mob("hollowmere", "docile"), w = mob("hollowmere", "docile");
    Object.assign(c, { x: P.x + 0.6, y: P.y, z: P.z }); Object.assign(w, { x: P.x, y: P.y + 0.6, z: P.z });
    creatures.addCreature(game.zone, c); creatures.addCreature(game.zone, w);
    rep.offend(game, p(), c);
    F.addRep(game, "kites", 37);
    game.state.knownFactions = { hollowmere: 1 };
    const pure = (v) => JSON.stringify(JSON.parse(JSON.stringify(v))) === JSON.stringify(v) &&
      !/function|\[object/.test(JSON.stringify(v));
    for (const [k, v] of [["rep", game.state.rep], ["knownFactions", game.state.knownFactions], ["a brain", c.brain], ["a witness's brain", w.brain]])
      if (!pure(v) || Object.values(v).some((x) => x instanceof Map || x instanceof Set)) fail(`${k} isn't plain JSON: ${JSON.stringify(v)}`);
    const rec = codec.trimCreature(c);
    const back = codec.rebuildCreature(JSON.parse(JSON.stringify(rec)), game.zone);
    if (JSON.stringify(back.faction) !== JSON.stringify(c.faction) || JSON.stringify(back.brain) !== JSON.stringify(c.brain))
      fail(`the codec loses a membership or a grudge: ${JSON.stringify(back.faction)} ${JSON.stringify(back.brain)}`);
    const state2 = JSON.parse(JSON.stringify(game.state));
    if (state2.rep?.kites !== -63 || state2.rep?.hollowmere !== 90) fail(`state.rep through JSON: ${JSON.stringify(state2.rep)}`);
    stats.state = `rep ${JSON.stringify(game.state.rep)}, grudges ${JSON.stringify(c.brain.grudges)}`;
  }

  // --- 7. The screen ----------------------------------------------------------------------------------------------
  {
    fresh(1234, { genotype: "bent" });
    F.addRep(game, "survey", 300);
    const seen = [];
    for (const view of ["map", "explore"]) {
      game.modeStack = []; screens.setMode(game, view, undefined, { pointer: false });
      keys.dispatchKey(game, "KeyP");
      if (game.mode !== "factions") { fail(`P in ${view} opened ${game.mode}`); continue; }
      S.clear(); screens.drawStack(game); S.present();
      const frame = scr.frameText();
      for (const want of ["FACTIONS", "the Survey", "Warm", "the Plumb Assize", "Dark"]) if (!frame.includes(want)) fail(`the factions screen in ${view} doesn't show "${want}"`);
      seen.push(frame.length);
      const ids = scrF.knownFactions(game);
      if (!ids.includes("survey") || !ids.includes("assize") || ids.includes("pleatwood")) fail(`known in ${view}: ${ids.join(", ")}`);
      keys.dispatchKey(game, "ArrowDown");
      if (game.factionsView.sel !== 1) fail(`↓ moved the selection to ${game.factionsView.sel}`);
      keys.dispatchKey(game, "KeyP", true);   // P held: its repeat doesn't close what P opened
      if (game.mode !== "factions") fail(`P's key repeat closed the factions screen (${game.mode})`);
      let musicKey = 0;
      const unbind = keys.bind("*", "KeyQ", () => { musicKey++; });   // a "*" binding, as M and N are
      keys.dispatchKey(game, "KeyQ");
      unbind();
      if (musicKey !== 1 || game.mode !== "factions") fail(`a "*" key (M, N) didn't get through the factions screen (${musicKey}, ${game.mode})`);
      keys.dispatchKey(game, view === "map" ? "KeyP" : "Escape");
      if (game.mode !== view) fail(`closing the factions screen left ${game.mode}, want ${view}`);
    }
    // Who you've been near: the "factions:known" update marks a member within 10 tiles; a hidden group never shows.
    {
      fresh(1234, { genotype: "bent" });
      game.mode = "map";
      const near = mob("pleatwood"); Object.assign(near, { x: p().x + 1, y: p().y, z: p().z }); creatures.addCreature(game.zone, near);
      game.state.rep = { peoples: 40 };
      if (scrF.knownFactions(game).includes("pleatwood")) fail("the Pleatwood known before anyone met one");
      events.runUpdates(game, 1.5);
      const ids = scrF.knownFactions(game);
      if (!ids.includes("pleatwood")) fail(`a Pleatwood member beside you for 1.5 s: known ${ids.join(", ")}`);
      if (ids.includes("peoples")) fail("a hidden group is listed because its rep moved");
    }
    stats.screen = `opened and closed in map and 3D; known at the start: ${scrF.knownFactions(game).length}`;
  }

  // ===== Part 6b (WS6b): trade, the Kindling, the item backing, voices, liquids, shrines ==================================
  const merchants = await m("social/merchants.js"), ritual = await m("social/ritual.js"), voices = await m("social/voices.js");
  const liquids = await m("social/liquids.js"), shrines = await m("social/shrines.js"), backings = await m("social/backings.js");
  const currency = await m("currency.js"), rules = await m("rules.js"), items = await m("items.js"), stats6 = await m("stats.js");
  const scrTrade = await m("screens/trade.js"), world = await m("world.js"), dl = await m("dialogue.js");
  const leveling = await m("leveling.js"), body = await m("body.js");
  const { RULES, overrideRules } = rules;
  const named = (type, dialogue, faction, at = {}) => {
    const c = creatures.spawnCreature(type, at.x ?? 3, at.y ?? 3, 0, { level: at.level ?? 5, talk: { dialogue, state: {} } });
    if (faction) c.faction = typeof faction === "string" ? { [faction]: 1 } : faction;
    c.named = true; c.name = at.name || "Ama";
    if (at.near) Object.assign(c, { x: p().x + at.near[0], y: p().y + at.near[1], z: p().z, tx: Math.floor(p().x + at.near[0]), ty: Math.floor(p().y + at.near[1]) });
    creatures.addCreature(game.zone, c);
    return c;
  };
  const setEgo = (score) => { p().attrs = { ...(p().attrs || stats6.makeAttrs()), ego: score }; stats6.invalidateStats(p()); };
  const close = (a, b) => Math.abs(a - b) < 1e-9;

  // --- 8. Prices: EGO × the rep step (bible §3.1, §15.6) ----------------------------------------------------------------
  {
    fresh(1234, { genotype: "bent" });
    const undo = overrideRules("stats", "attributes");
    try {
      const it = { kind: "weapon", id: "mace", ench: 0, known: true }, worth = items.itemPrice(it);
      const trader = named("mira", "merchant", "drovers", { level: 0 });
      let cells = 0;
      const STEP = { disliked: -0.1, indifferent: 0, liked: 0.1, loved: 0.2 };
      for (const score of [10, 12, 16, 20, 24]) for (const [bandId, step] of Object.entries(STEP)) {
        setEgo(score);
        game.state.rep = { drovers: EDGES[bandId][0] };
        const m6 = stats6.mod(p(), "ego");
        const sell = Math.max(0, 0.3 + 0.05 * m6 + step / 2), buy = Math.max(0.2, sell, 1.5 - 0.1 * m6 - step);
        if (!close(merchants.repStepOf(game, trader), step)) fail(`the rep step at ${bandId}: ${merchants.repStepOf(game, trader)}, want ${step}`);
        const gotBuy = merchants.priceOf(game, it, trader, "buy"), gotSell = merchants.priceOf(game, it, trader, "sell");
        if (gotBuy !== Math.round(worth * buy)) fail(`buy at EGO ${score} (${m6}), ${bandId}: ${gotBuy}, want ${Math.round(worth * buy)}`);
        if (gotSell !== Math.floor(worth * sell)) fail(`sell at EGO ${score} (${m6}), ${bandId}: ${gotSell}, want ${Math.floor(worth * sell)}`);
        const note = merchants.priceNote(game, trader);
        if (!close(note.buy, buy) || !close(note.sell, sell) || !note.text.includes(`EGO ${m6 >= 0 ? "+" : ""}${m6}`)) fail(`the price note at EGO ${score}, ${bandId}: ${note.text}`);
        if (gotBuy <= gotSell) fail(`buying is no dearer than selling at EGO ${score}, ${bandId}: ${gotBuy} vs ${gotSell}`);
        cells++;
      }
      setEgo(16); game.state.rep = { drovers: 0 };
      const grey = [merchants.priceOf(game, it, trader, "buy"), merchants.priceOf(game, it, trader, "sell")];
      setEgo(24); game.state.rep = { drovers: 600 };
      const bright = [merchants.priceOf(game, it, trader, "buy"), merchants.priceOf(game, it, trader, "sell")];
      // The Snuffer pays +20% to buy, and sells as before.
      game.state.snuffer = { at: 0, until: (game.time || 0) + 100 };
      const snuffed = [merchants.priceOf(game, it, trader, "buy"), merchants.priceOf(game, it, trader, "sell")];
      if (snuffed[0] !== Math.round(bright[0] * 1.2)) fail(`the Snuffer's buy price ${snuffed[0]}, want ${Math.round(bright[0] * 1.2)}`);
      if (snuffed[1] !== bright[1]) fail(`the Snuffer's sell price moved: ${snuffed[1]} vs ${bright[1]}`);
      game.state.snuffer = null;
      // A trader with no faction has no step; a level-6 trader charges × priceLevel(6) on buying.
      const plain = named("rook", "merchant", null, { level: 6 });
      setEgo(16);
      if (merchants.repStepOf(game, plain) !== 0) fail("a trader with no faction has a rep step");
      const want6 = Math.round(Math.round(worth * currency.priceLevel(6)) * 1.5);
      if (merchants.priceOf(game, it, plain, "buy") !== want6) fail(`a level-6 trader's buy price ${merchants.priceOf(game, it, plain, "buy")}, want ${want6}`);
      stats.prices = `${cells} cells (EGO 10-24 × Cold/Grey/Warm/Bright) as bible §3.1; a ${worth}-glim mace at Grey, EGO 16: buy ${grey[0]}, sell ${grey[1]}; Bright, EGO 24: ${bright[0]} / ${bright[1]}; the Snuffer buys at ${snuffed[0]}`;
    } finally { undo(); }
    // The legacy set: the parent's numbers whatever the band (priceMul ignores the trader there).
    const pell = person("pell", "pell", null), it = { kind: "potion", effect: "healing" };
    game.state.rep = {};
    if (merchants.priceOf(game, it, pell, "sell") !== currency.sellPrice(game, p(), items.itemPrice(it))) fail("the legacy set's sell price changed");
  }

  // --- 9. The item backing: pay, receive, overflow (and the counter's overflow at trade) --------------------------------
  {
    fresh(1234, { genotype: "bent" });
    const CUR = currency.CURRENCY, old = CUR.backing;
    backings.registerCoinage("testBit", { name: "bit", plural: "bits", weight: 0.5 });
    const undoSet = overrideRules("stats", "attributes"), undoEnc = overrideRules("encumbrance", true);
    try {
      CUR.backing = { kind: "item", item: "testBit" };
      p().inv = []; p().funds = 0;
      const r1 = currency.receive(game, p(), 30), f1 = currency.funds(p());
      if (r1 !== 0 || f1 !== 30) fail(`item backing: receive 30 → overflow ${r1}, funds ${f1}`);
      const ok1 = currency.pay(game, p(), 12), f2 = currency.funds(p());
      if (!ok1 || f2 !== 18) fail(`item backing: pay 12 → ${ok1}, funds ${f2}`);
      const ok2 = currency.pay(game, p(), 100), f3 = currency.funds(p());
      if (ok2 || f3 !== 18) fail(`item backing: pay 100 of 18 → ${ok2}, funds ${f3} (nothing may go)`);
      // Two stacks: the smaller goes first.
      p().inv.push({ kind: "coinage", effect: "testBit", count: 5 });
      currency.pay(game, p(), 6);
      const counts = p().inv.filter((i) => i.kind === "coinage").map((i) => i.count);
      if (JSON.stringify(counts) !== "[17]") fail(`paying 6 from stacks of 18 and 5: ${JSON.stringify(counts)}, want [17]`);
      // Overflow: what the pack can't carry comes back.
      const room = backings.coinRoom(p());
      if (!Number.isFinite(room) || room <= 0) fail(`coinRoom under encumbrance: ${room}`);
      const before = currency.funds(p()), over = currency.receive(game, p(), room + 40);
      if (over !== 40 || currency.funds(p()) !== before + room) fail(`receive ${room + 40} with room for ${room}: overflow ${over}, funds ${currency.funds(p())}`);
      if (currency.receive(game, p(), 7) !== 7) fail("a full pack took more coins");
      // The money isn't offered for sale.
      const t = named("mira", "merchant", "drovers");
      if (merchants.tradeRows(game, t, "yours").some((r) => r.it.kind === "coinage")) fail("the money is offered for sale");
      if (JSON.stringify(JSON.parse(JSON.stringify(p().inv))) !== JSON.stringify(p().inv)) fail("coins aren't plain JSON");
      stats.backing = `item: receive 30, pay 12, pay 100 refused (18 kept), smallest stack first, overflow ${over} of ${room + 40} (room ${room})`;
    } finally { CUR.backing = old; undoEnc(); undoSet(); }
    if (currency.backingKinds().join() !== "counter,item") fail(`backings: ${currency.backingKinds().join()}, want counter,item (no liquid backing: DECISIONS)`);
    // The counter: a sale the purse can't hold is refused whole (bible §3.1), and the screen turns to their goods.
    p().funds = currency.purseCap(p()) - 3;
    const t = named("mira", "merchant", "drovers");
    p().inv = [{ kind: "weapon", id: "mace", ench: 0, known: true }];
    const row = merchants.tradeRows(game, t, "yours")[0];
    const out = merchants.tradeRow(game, t, "yours", row);
    if (out.ok || out.offer !== "theirs" || p().funds !== currency.purseCap(p()) - 3 || p().inv.length !== 1)
      fail(`a ${row.price}-glim sale into a purse with room for 3: ok ${out.ok}, offer ${out.offer}, funds ${p().funds}, pack ${p().inv.length}`);
    game.modeStack = []; screens.setMode(game, "map", undefined, { pointer: false });
    merchants.openTrade(game, t, "yours");
    scrTrade.tradeChosen(game);
    if (game.trade.tab !== "theirs") fail(`after the refused sale the trade screen shows ${game.trade.tab}, want theirs`);
    scrTrade.closeTrade(game);
    stats.backing += `; counter: a ${row.price}-glim sale with room for 3 refused whole, their goods offered`;
    // No fill-and-sell loop: a trader pays for a filled vial's glass only, so no liquid from a pool sells for more
    // than an empty vial costs, at Bright and EGO 24 (the best prices there are), here and at Pell's.
    {
      const undo = overrideRules("stats", "attributes");
      try {
        setEgo(24); game.state.rep = { drovers: 600 };
        const t2 = named("mira", "merchant", "drovers", { level: 0, name: "Vi" });
        const empty = merchants.priceOf(game, { kind: "vial", effect: "" }, t2, "buy");
        for (const id of Object.keys((await m("content/liquids.js")).LIQUIDS)) {
          const sell = merchants.priceOf(game, { kind: "vial", effect: id }, t2, "sell");
          if (sell >= empty) fail(`a vial of ${id} sells for ${sell} at Bright, EGO 24; an empty one costs ${empty}`);
        }
      } finally { undo(); setEgo(16); }
      p().inv = [{ kind: "vial", effect: "turnwater", count: 1 }];
      const pell = person("pell", "pell", null);
      game.shop = { npc: pell, tab: "sell", sel: 0 };
      const pellPays = merchants.priceOf(game, p().inv[0], null, "sell");
      if (pellPays > currency.sellPrice(game, p(), 3)) fail(`Pell pays ${pellPays} for a vial of turnwater`);
      game.shop = null;
    }
  }

  // --- 10. Pell's services, all through registerService on the trade screen --------------------------------------------
  {
    fresh(1234, { genotype: "bent" });
    const pell = person("pell", "pell", null);
    creatures.addCreature(game.zone, pell);
    const pl = p();
    pl.funds = 1000; pl.purse = 1000;
    const want = ["uncurseWorn", "enchant", "forge", "identify", "namePotion", "uncurse"];
    pl.inv.push({ kind: "weapon", id: "longsword", ench: 1, known: false }, { kind: "potion", effect: "haste" },
      { kind: "armour", id: "plate", ench: -2, known: true });
    game.knownPotions.delete("haste");
    const ring = { kind: "ring", id: "protection", ench: -1, known: true };
    pl.inv.push(ring);
    body.equip(game, pl, ring);
    merchants.openTrade(game, pell, "services");
    if (game.mode !== "trade") fail(`openTrade on Pell: ${game.mode}`);
    const ids = new Set(merchants.tradeRows(game, pell, "services").map((r) => r.service.id));
    for (const id of want) if (!ids.has(id)) fail(`Pell's service ${id} isn't on the trade screen (rows: ${[...ids].join(", ")})`);
    // The Snuffer pays +20% for services too.
    const plainPrice = merchants.tradeRows(game, pell, "services")[0].price;
    game.state.snuffer = { at: 0, until: (game.time || 0) + 100 };
    const marked = merchants.tradeRows(game, pell, "services")[0].price;
    game.state.snuffer = null;
    if (marked !== Math.round(plainPrice * 1.2)) fail(`the Snuffer's service price ${marked}, want ${Math.round(plainPrice * 1.2)} (plain ${plainPrice})`);
    let ran = 0;
    for (const id of want) {
      const row = merchants.tradeRows(game, pell, "services").find((r) => r.service.id === id);
      if (!row) continue;
      const f0 = pl.funds, out = merchants.tradeRow(game, pell, "services", row);
      if (!out.ok || pl.funds !== f0 - row.price) fail(`${id}: ${out.line}, funds ${f0} → ${pl.funds} (price ${row.price})`); else ran++;
    }
    scrTrade.closeTrade(game);
    stats.pell = `${ids.size} services listed (${[...ids].join(", ")}), ${ran} of ${want.length} paid and run from the trade screen`;
  }

  // --- 11. The Kindling: the three rites, each in its view; the bond; the menu; oathbreaking ------------------------------
  {
    const setup = () => {
      fresh(1234, { genotype: "bent" });
      p().funds = 200; p().inv = []; p().torch = true; setEgo(16); p().perks = {};
      game.view = "map";
    };
    const face = (c) => { p().yaw = Math.atan2(c.y - p().y, c.x - p().x); };
    setup();
    const ama = named("mira", "villager", "hollowmere", { near: [1, 0] });
    const optLabels = (c) => talk.talkTo(game, c).options.map((o) => o.label);
    if (!optLabels(ama).includes("Will you kindle with me?")) fail(`a named Hollowmere villager offers no Kindling: ${optLabels(ama).join(" | ")}`);
    const plainOne = named("mira", "villager", "hollowmere", { near: [0, 1] }); plainOne.named = false;
    if (optLabels(plainOne).some((l) => /kindle/i.test(l))) fail("an unnamed villager offers the Kindling");
    if (ritual.canKindle(game, named("mira", "villager", "askew", { near: [-1, 0] })) === null) fail("the Askew can be kindled");
    if (optLabels(person("pell", "pell", null)).some((l) => /kindle/i.test(l))) fail("Pell (no faction) offers the Kindling");
    // Each rite is ready only in its own view.
    const readyIn = (c) => ["tracing", "lighting", "snuffing"].filter((r) => !ritual.riteReady(game, c, r)).join() || "none";
    const views = {};
    game.view = "map"; views.map = readyIn(ama);
    game.view = "3d"; face(ama); views.lit = readyIn(ama);
    p().torch = false; views.dark = readyIn(ama);
    if (views.map !== "tracing" || views.lit !== "lighting" || views.dark !== "snuffing")
      fail(`rites ready by view: map ${views.map}, lit 3D ${views.lit}, dark ${views.dark}; want tracing / lighting / snuffing`);
    p().torch = true; p().yaw += Math.PI;
    if (!ritual.riteReady(game, ama, "lighting")) fail("the Lighting with your back to them");
    face(ama);
    Object.assign(ama, { x: p().x + 3.2, y: p().y });
    if (!ritual.riteReady(game, ama, "lighting")) fail("the Lighting from 3 tiles away");
    game.view = "map";
    if (!ritual.riteReady(game, ama, "tracing")) fail("the Tracing from 3 tiles away");
    Object.assign(ama, { x: p().x + 1, y: p().y });
    // Not across a cliff (3 blocks up), not through a wall (a stone column between you, two tiles apart).
    ama.z = p().z + 3;
    if (!ritual.riteReady(game, ama, "tracing")) fail("the Tracing across a 3-block cliff");
    ama.z = p().z;
    {
      const z = game.zone, wx = Math.floor(p().x) + 1, wy = Math.floor(p().y), z0 = Math.floor(p().z), saved = [];
      for (let k = z0; k < Math.min(z.h, z0 + 4); k++) { saved.push(z.get(wx, wy, k)); z.set(wx, wy, k, world.B.STONE); }
      Object.assign(ama, { x: p().x + 2, y: p().y });
      game.view = "3d"; face(ama);
      const lit = ritual.riteReady(game, ama, "lighting");
      p().torch = false; const dark = ritual.riteReady(game, ama, "snuffing"); p().torch = true;
      saved.forEach((b, k) => z.set(wx, wy, z0 + k, b));
      if (!lit || !dark) fail(`through a stone wall: the Lighting ${lit ?? "ready"}, the Snuffing ${dark ?? "ready"}`);
      if (ritual.riteReady(game, ama, "lighting")) fail(`the Lighting two tiles off with the wall gone: ${ritual.riteReady(game, ama, "lighting")}`);
      Object.assign(ama, { x: p().x + 1, y: p().y });
    }
    // In map view the talk option offers only the Tracing; in lit 3D only the Lighting.
    const riteOpts = () => (talk.talkTo(game, ama).options.find((o) => o.label === "Will you kindle with me?")?.go()?.options || []).map((o) => o.label).filter((l) => /^The /.test(l));
    game.view = "map"; const mapOpts = riteOpts().join();
    game.view = "3d"; face(ama); const litOpts = riteOpts().join();
    if (mapOpts !== "The Tracing." || litOpts !== "The Lighting.") fail(`the talk's rites: map [${mapOpts}], lit 3D [${litOpts}]`);
    // "flat only" (the Flatfolk) takes only the Tracing; "dark only" (the Unlit) only the Snuffing.
    const flat = named("ess", "villager", "flatfolk", { near: [0, -1], name: "Pip" }), ghost = named("brann", "villager", "unlit", { near: [-1, -1], name: "Wen" });
    game.view = "3d"; face(flat);
    if (!ritual.riteReady(game, flat, "lighting")) fail("the Flatfolk take the Lighting");
    game.view = "map";
    if (!ritual.riteReady(game, ghost, "tracing")) fail("the Unlit take the Tracing");
    game.view = "3d"; p().torch = false;
    if (ritual.riteReady(game, ghost, "snuffing")) fail(`the Unlit refuse the Snuffing in the dark: ${ritual.riteReady(game, ghost, "snuffing")}`);
    p().torch = true;

    // The bond's numbers, against what bible §3.3 says they should be.
    const bond = (rite, c, { sac = null, ego = 16 } = {}) => {
      setEgo(ego);
      if (sac) p().inv.push({ kind: "vial", effect: sac, count: 1 });
      const before = Object.fromEntries(Object.keys(F.FACTIONS).map((id) => [id, F.repOf(game, id)])), f0 = p().funds, t0 = game.time;
      const out = ritual.performRite(game, c, rite);
      const moved = Object.fromEntries(Object.keys(F.FACTIONS).map((id) => [id, F.repOf(game, id) - before[id]]).filter(([, n]) => n));
      return { out, moved, paid: f0 - p().funds, waited: game.time - t0 };
    };
    const expect = (c, { rite, sac, ego = 16 }) => {
      const eg = 1 + 0.1 * Math.floor((ego - 16) / 2), out = {};
      const add = (id, n) => { out[id] = (out[id] || 0) + (n > 0 ? Math.round(n * eg) : n); };
      const BOND = { loves: 80, likes: 40, dislikes: -40, hates: -80 };
      for (const [id, op] of ritual.opinionsOf(game, c)) add(id, BOND[op]);
      const own = Object.keys(c.faction)[0];
      if (ritual.readingsOf(own).set.has({ tracing: "flat", lighting: "deep", snuffing: "dark" }[rite])) add(own, 40);
      if (sac) add(own, 20);
      for (const id of Object.keys(out)) if (!out[id]) delete out[id];
      return out;
    };
    const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
    // The Tracing on the map, paid in glim (Hollowmere keep the deep reading: no own-reading bonus).
    setup();
    const t1 = named("mira", "villager", "hollowmere", { near: [1, 0], name: "Ama" });
    const ops1 = ritual.opinionsOf(game, t1), want1 = expect(t1, { rite: "tracing" });
    const r1 = bond("tracing", t1);
    if (!r1.out.ok || !same(r1.moved, want1) || r1.paid !== 1) fail(`the Tracing: ${r1.out.text}; moved ${JSON.stringify(r1.moved)}, want ${JSON.stringify(want1)}; paid ${r1.paid}`);
    if (!ritual.kin(game, t1) || !r1.out.text.includes("Here is my line.")) fail(`after the Tracing: kin ${!!ritual.kin(game, t1)}, "${r1.out.text}"`);
    if (ops1[0][0] !== "hollowmere" || ops1[0][1] !== "likes" || !ops1.some(([id, op]) => id === "assize" && op === "dislikes")) fail(`Ama's opinions: ${JSON.stringify(ops1)}`);
    const again = bond("tracing", t1);
    if (Object.keys(again.moved).length) fail(`a second Tracing without Warm Hands moved ${JSON.stringify(again.moved)}`);
    // With Warm Hands: +20 with EGO's share (EGO 24: +28), and never past the +120 (net 110: +10, then nothing).
    p().perks = { warmHands: 1 };
    const wh = bond("tracing", t1, { ego: 24 });
    if (wh.moved.hollowmere !== 28 || ritual.kin(game, t1).net !== 28) fail(`a Warm Hands Kindling at EGO 24: +${wh.moved.hollowmere}, net ${ritual.kin(game, t1).net}, want +28`);
    ritual.kin(game, t1).net = 110;
    const wh2 = bond("tracing", t1, { ego: 24 }), wh3 = bond("tracing", t1, { ego: 24 });
    if (wh2.moved.hollowmere !== 10 || wh3.moved.hollowmere || ritual.kin(game, t1).net !== 120) fail(`Warm Hands at net 110, EGO 24: +${wh2.moved.hollowmere} then +${wh3.moved.hollowmere || 0}, net ${ritual.kin(game, t1).net}; want +10, then 0, net 120`);
    p().perks = {}; setEgo(16);
    // A later Kindling leaves a sacrament in your pack (nothing would come of pouring it).
    p().inv = [{ kind: "vial", effect: "glim", count: 1 }];
    bond("tracing", t1);
    if (!p().inv.some((i) => i.kind === "vial" && i.effect === "glim")) fail(`a later Kindling poured the sacrament: ${JSON.stringify(p().inv)}`);
    // Crooked Manner (WS4 #21, at the WS6b merge): the words come out as a rude gesture and the Kindling gains its
    // faction 20 less (Hollowmere's +40 for liking its own: +20); a later one with Warm Hands' +20 gains nothing.
    {
      p().mutations = { crookedManner: 1 };
      p().inv = p().inv.filter((i) => i.kind !== "vial");   // (no sacrament to pour: the last test left one)
      const cm = named("mira", "villager", "hollowmere", { near: [0, 1], name: "Odd" });
      const want = expect(cm, { rite: "tracing" }), r = bond("tracing", cm);
      p().perks = { warmHands: 1 };
      const later = bond("tracing", cm);
      p().perks = {}; delete p().mutations.crookedManner;
      stats.crooked = `Hollowmere +${r.moved.hollowmere || 0} (plain +${want.hollowmere || 0}), a later one +${later.moved.hollowmere || 0}; "${r.out.text.split("\n")[0].slice(0, 60)}"`;
      if ((r.moved.hollowmere || 0) !== Math.max(0, (want.hollowmere || 0) - 20) || !/rude gesture/.test(r.out.text) || later.moved.hollowmere)
        fail(`Crooked Manner's Kindling: ${stats.crooked} (want 20 less, the rude gesture, nothing from Warm Hands)`);
    }
    // The Tracing with a vial of ink: the ink is spent, not glim.
    setup();
    const t1b = named("mira", "villager", "flatfolk", { near: [1, 0], name: "Ink" });
    // Two vials of ink: one draws the line, the other is poured (the Flatfolk's sacrament); with one, it only draws.
    p().inv.push({ kind: "vial", effect: "ink", count: 2 });
    const r1b = bond("tracing", t1b);
    if (!r1b.out.ok || r1b.paid !== 0 || p().inv.some((i) => i.effect === "ink")) fail(`the Tracing in ink: paid ${r1b.paid}, ${JSON.stringify(p().inv)}`);
    if (r1b.moved.flatfolk !== 40 + 40 + 20) fail(`a Flatfolk Tracing with two vials of ink (likes, own reading, sacrament): +${r1b.moved.flatfolk}, want +100`);
    setup();
    const t1c = named("mira", "villager", "flatfolk", { near: [1, 0], name: "Nib" });
    p().inv.push({ kind: "vial", effect: "ink", count: 1 });
    const r1c = bond("tracing", t1c);
    if (r1c.paid !== 0 || r1c.moved.flatfolk !== 80) fail(`a Flatfolk Tracing with one vial of ink: paid ${r1c.paid}, +${r1c.moved.flatfolk}, want 0 and +80`);
    // The Lighting in 3D with Hollowmere's sacrament (glim in a vial) at EGO 20 (+20% on gains); deep is their reading.
    setup();
    const t2 = named("mira", "villager", "hollowmere", { near: [1, 0], name: "Bel" });
    game.view = "3d"; face(t2);
    const want2 = expect(t2, { rite: "lighting", sac: "glim", ego: 20 });
    const r2 = bond("lighting", t2, { sac: "glim", ego: 20 });
    if (!r2.out.ok || !same(r2.moved, want2) || r2.paid !== 1) fail(`the Lighting: ${r2.out.text}; moved ${JSON.stringify(r2.moved)}, want ${JSON.stringify(want2)}; paid ${r2.paid}`);
    if (r2.moved.hollowmere !== Math.round(40 * 1.2) + Math.round(40 * 1.2) + Math.round(20 * 1.2)) fail(`Hollowmere after the Lighting at EGO 20: +${r2.moved.hollowmere}, want +120`);
    if (p().inv.some((i) => i.kind === "vial" && i.effect === "glim") || !p().inv.some((i) => i.kind === "vial" && i.effect === "")) fail("the sacrament wasn't poured out");
    // The Snuffing in the dark: an hour passes (60 s of game time), no glim.
    setup();
    const t3 = named("brann", "villager", "lampless", { near: [1, 0], name: "Cay" });
    game.view = "3d"; p().torch = false;
    const want3 = expect(t3, { rite: "snuffing" });
    const r3 = bond("snuffing", t3);
    if (!r3.out.ok || !same(r3.moved, want3) || r3.paid !== 0 || Math.abs(r3.waited - 60) > 1e-6) fail(`the Snuffing: ${r3.out.text}; moved ${JSON.stringify(r3.moved)}, want ${JSON.stringify(want3)}; paid ${r3.paid}, waited ${r3.waited}`);
    stats.kindling = `ready only in its view (map: ${views.map}; lit 3D: ${views.lit}; dark: ${views.dark}); Tracing ${JSON.stringify(r1.moved)}; in ink, Flatfolk +${r1b.moved.flatfolk}; Lighting at EGO 20 with glim poured ${JSON.stringify(r2.moved)}; Snuffing (${r3.waited} s) ${JSON.stringify(r3.moved)}`;

    // The flame-kin menu: rep as currency, the +120 cap, the floor, recruiting, the best item, a power.
    setup();
    const k = named("mira", "merchant", "drovers", { near: [1, 0], name: "Dov", level: 5 });
    k.teaches = ["swimmer", "tough", "repair"];   // (repair waits on its needs: never offered)
    ritual.performRite(game, k, "tracing");
    // The run's own secrets, learned as a player would (WS7's journal since the WS7a merge: its entries say only when
    // and how you learned each; kind, reading and text are the run's): deep readings of three events, a dark one of a
    // fourth (no event triangulated), a rumour.
    const SEC = await m("story/secrets.js"), defs = [...SEC.secretsOf(game.run).values()], evs = new Set();
    const pick = (reading) => { const d = defs.find((x) => x.kind === "history" && x.reading === reading && !evs.has(x.ref.eventId)); evs.add(d.ref.eventId); return d; };
    const A = pick("deep"), Cd = pick("deep"), Dd = pick("deep"), Bd = pick("dark"), G = defs.find((x) => x.kind === "gossip");
    delete game.state.journal;
    for (const d of [A, G, Bd]) SEC.learnSecret(game, d.id, "talk", { quiet: true });
    const rows = () => ritual.ritualRows(game, k);
    const ids = rows().map((r) => r.id);
    for (const w of [`give:${A.id}`, `give:${G.id}`, "power:swimmer", "power:tough", "recruit", "best"]) if (!ids.includes(w)) fail(`the flame-kin menu lacks ${w}: ${ids.join(", ")}`);
    if (ids.includes(`give:${Bd.id}`)) fail("the Drovers (deep) want a dark reading");
    if (ids.includes("power:repair")) fail("the flame-kin menu teaches Repair, a power still waiting on its needs");
    const label = rows().find((r) => r.id === `give:${A.id}`)?.label || "";
    if (!label.includes(SEC.secretText(game.run, A))) fail(`a reading's row doesn't tell its account: "${label}"`);
    const rep0 = F.repOf(game, "drovers");
    const doRow = (id, c = k) => ritual.ritualRow(game, c, ritual.ritualRows(game, c).find((r) => r.id === id));
    doRow(`give:${G.id}`); doRow(`give:${A.id}`);
    const kk = ritual.kin(game, k);
    if (F.repOf(game, "drovers") - rep0 !== 95 || kk.net !== 95) fail(`rumour + reading: +${F.repOf(game, "drovers") - rep0}, net ${kk.net}, want 95`);
    if (!game.state.journal.secrets[G.id].sold || rows().some((r) => r.id === `give:${G.id}`)) fail("a sold reading is offered again");
    SEC.learnSecret(game, Cd.id, "talk", { quiet: true });
    doRow(`give:${Cd.id}`);
    if (kk.net !== 120) fail(`the cap: net ${kk.net} after 95 + 35, want 120`);
    SEC.learnSecret(game, Dd.id, "talk", { quiet: true });
    if (doRow(`give:${Dd.id}`).ok) fail("a gain past the +120 cap went through");
    const repB = F.repOf(game, "drovers");
    doRow("power:tough");
    if (F.repOf(game, "drovers") !== repB - 50 || leveling.perkRank(p(), "tough") !== 1) fail(`a rank-1 power: rep ${repB} → ${F.repOf(game, "drovers")}, rank ${leveling.perkRank(p(), "tough")}`);
    const rank2 = rows().find((r) => r.id === "power:tough");
    if (rank2?.n !== -100) fail(`a rank-2 power costs ${rank2?.n}, want −100`);
    p().level = 1;
    if (ritual.recruitCost(game, k) !== -(150 + 15 * 4)) fail(`recruit cost at a gap of 4: ${ritual.recruitCost(game, k)}`);
    p().level = 20;
    if (ritual.recruitCost(game, k) !== -60) fail(`recruit cost far below you: ${ritual.recruitCost(game, k)}, want the floor −60`);
    const best = merchants.bestStock(game, k), bestRow = rows().find((r) => r.id === "best");
    if (bestRow?.n !== -Math.max(10, Math.round(items.itemPrice(best.item) / 5))) fail(`the best item's cost ${bestRow?.n} for worth ${items.itemPrice(best.item)}`);
    const nBest = best.count, invN = p().inv.length;
    doRow("best");
    if (best.count !== nBest - 1 || p().inv.length !== invN + 1) fail("asking for the best item gave nothing");
    if (!rows().find((r) => r.id === "best")?.why || doRow("best").ok) fail("the best item could be had twice from one pack");
    merchants.restock(game, k); k.talk.state.stockedAt += 1;
    if (rows().find((r) => r.id === "best")?.why) fail("the best item refused from a new pack");
    game.state.rep.drovers = 0;
    if (merchants.bestStock(game, k)?.best) fail("the back shelf's piece counts as the best item at Grey");
    // The floor: a cost that would take you to −250 or below is refused.
    game.state.rep.drovers = -200;
    const refused = doRow("recruit");
    if (refused.ok || k.brain?.leader === "player") fail(`recruiting at −200 for −60: ${refused.line}`);
    game.state.rep.drovers = 500;
    const rec = doRow("recruit");
    if (!rec.ok || k.brain?.leader !== "player" || F.attitude(game, k, p()) !== "friendly") fail(`recruiting: ${rec.line}; leader ${k.brain?.leader}, ${F.attitude(game, k, p())}`);
    // At most 2 Kindled followers (3 at EGO 20).
    const more = [0, -1].map((n) => { const c = named("mira", "villager", "drovers", { near: [n, 1], name: `F${n}` }); game.view = "map"; ritual.performRite(game, c, "tracing"); return c; });
    game.state.rep.drovers = 500;
    doRow("recruit", more[0]);
    const third = ritual.ritualRows(game, more[1]).find((r) => r.id === "recruit");
    if (!third?.why || doRow("recruit", more[1]).ok) fail(`a third Kindled follower at EGO 16: ${JSON.stringify(third)}`);
    setEgo(20);
    if (ritual.ritualRows(game, more[1]).find((r) => r.id === "recruit")?.why) fail("a third Kindled follower refused at EGO 20");
    setEgo(16);
    stats.menu = "rumour +60, reading +35, the +120 cap held; power −50 then −100; recruit −210 at a gap of 4, −60 far below; the best item −value/5; the −250 floor; 2 Kindled followers (3 at EGO 20)";

    // The screen: "Sit with me" opens it; Esc goes back to talking.
    game.modeStack = []; screens.setMode(game, "map", undefined, { pointer: false });
    dl.openTalk(game, k);
    game.talk.shown = game.talk.length;
    const sit = game.talk.node.options.findIndex((o) => /Sit with me/.test(o.label));
    if (sit < 0) fail(`a flame-kin's talk has no "Sit with me": ${game.talk.node.options.map((o) => o.label).join(" | ")}`);
    else {
      keys.dispatchKey(game, `Digit${sit + 1}`);
      if (game.mode !== "ritual") fail(`"Sit with me" opened ${game.mode}`);
      S.clear(); screens.drawStack(game); S.present();
      const frame = scr.frameText();
      for (const w of ["THE KINDLING", "Flame-kin by", "Learn"]) if (!frame.includes(w)) fail(`the ritual screen doesn't show "${w}"`);
      keys.dispatchKey(game, "Escape");
      if (game.mode !== "talk") fail(`Esc on the ritual screen led to ${game.mode}`);
      keys.dispatchKey(game, "Escape");
    }

    // Oathbreaking: you kill a flame-kin → −120 with everyone, the Moths at −600, the Snuffer (no Kindling for 7 days).
    setup();
    const victim = named("mira", "villager", "clatter", { near: [1, 0], name: "Eff" });
    ritual.performRite(game, victim, "tracing");
    const before = F.repOf(game, "survey"), stranger = named("mira", "villager", "hollowmere", { near: [0, 1], name: "Gil" });
    events.emit(game, "kill", { c: victim, src: p() });
    if (F.repOf(game, "survey") !== before - 120 || F.repOf(game, "moths") !== -600) fail(`oathbreaking: the Survey ${before} → ${F.repOf(game, "survey")}, the Moths ${F.repOf(game, "moths")}`);
    if (!merchants.snuffed(game) || ritual.canKindle(game, stranger) === null) fail("the Snuffer can still kindle");
    const sTalk = talk.talkTo(game, stranger).options.find((o) => /kindle/i.test(o.label))?.go();
    if (!/Snuffer/.test(sTalk?.text || "")) fail(`asking to kindle as the Snuffer: ${sTalk?.text}`);
    game.time += 7 * 24 * 60 * RULES.clock.secondsPerMinute + 1;
    if (merchants.snuffed(game)) fail("the Snuffer's mark lasts past 7 world days");
    setup();
    const v2 = named("mira", "villager", "clatter", { near: [1, 0], name: "Hob" });
    ritual.performRite(game, v2, "tracing");
    const s0 = F.repOf(game, "survey");
    events.emit(game, "kill", { c: v2, src: null });
    if (F.repOf(game, "survey") !== s0 || merchants.snuffed(game)) fail("an accidental death counted as oathbreaking");
    const v3 = named("mira", "villager", "clatter", { near: [0, 1], name: "Ivy" });
    ritual.performRite(game, v3, "tracing");
    events.emit(game, "kill", { c: v3, src: p(), splash: true });   // a lightning arc, thorns
    if (F.repOf(game, "survey") !== s0 || merchants.snuffed(game)) fail("a splash kill counted as oathbreaking");
  }

  // --- 12. Restock on zone:enter after two world days ------------------------------------------------------------------
  {
    fresh(1234, { genotype: "bent" });
    const t = named("mira", "merchant", "drovers", { name: "Kit" });
    merchants.ensureStock(game, t);
    const day = 24 * 60 * RULES.clock.secondsPerMinute;
    const sig = () => JSON.stringify(t.talk.state.stock.map((s) => [s.item, s.count]));
    for (const s of t.talk.state.stock) s.count = 0;
    const sold = sig();
    events.emit(game, "zone:enter", { zone: game.zone, away: 2 * day - 1, how: "walk", first: false, from: null });
    if (sig() !== sold) fail("restocked after less than two world days away");
    // A load sends the time since you last left this zone as `away` (zones.js): three days in a village, then a load.
    events.emit(game, "zone:enter", { zone: game.zone, away: 3 * day, how: "load", first: false, from: null });
    if (sig() !== sold) fail("restocked on a load (away three days since you last left)");
    game.time += 2 * day;
    events.emit(game, "zone:enter", { zone: game.zone, away: 2 * day, how: "walk", first: false, from: null });
    const after = t.talk.state.stock;
    if (sig() === sold || !after.some((s) => s.count > 0) || t.talk.state.stockedAt !== game.time) fail(`no restock after two world days: ${sig()}`);
    if (JSON.stringify(merchants.restock(game, t)) !== JSON.stringify(after)) fail("a restock on the same day gave other goods");
    // The legacy Pell keeps the parent's single pack: three days away, and his sold-out bombs stay sold out.
    const pell = person("pell", "pell", null); creatures.addCreature(game.zone, pell);
    pell.talk.state.stock = [{ item: { kind: "bomb" }, count: 0, price: 20 }];
    events.emit(game, "zone:enter", { zone: game.zone, away: 3 * day, how: "walk", first: false, from: null });
    if (pell.talk.state.stock.length !== 1 || pell.talk.state.stock[0].count !== 0) fail(`the legacy Pell was restocked: ${JSON.stringify(pell.talk.state.stock).slice(0, 120)}`);
    // A builder's merchant sells its faction's sacrament, and the back shelf shows only at Bright.
    const shelf = () => merchants.tradeRows(game, t, "theirs").some((x) => x.stock.best);
    game.state.rep = { drovers: 0 };
    if (shelf()) fail("the back shelf shows at Grey");
    game.state.rep = { drovers: 600 };
    if (!shelf()) fail("the back shelf is hidden at Bright");
    if (!t.talk.state.stock.some((s) => s.item.kind === "vial" && s.item.effect === "longbackMilk")) fail("a Drover merchant sells no longback milk");
    stats.restock = `${after.length} rows after two world days away (none at 2 days − 1 s, none on a load); the same day, the same goods; the legacy Pell never; the back shelf at Bright only`;
  }

  // --- 13. Voices -------------------------------------------------------------------------------------------------------
  {
    fresh(1234, { genotype: "bent" });
    for (const id of ["maren", "pell", "corwin", "brann", "mira", "rook", "lio", "ess", "tee", "door", "shrine"]) {
      const c = creatures.spawnCreature(id, 3, 3, 0, { talk: { dialogue: id, state: {} } });
      if (voices.voiceFor(c) !== id) fail(`the legacy ${id}'s voice: ${JSON.stringify(voices.voiceFor(c))}`);
    }
    const lamp = person("mira", "priest", "lampless"), v = voices.voiceFor(lamp);
    if (v?.pitch !== 110 || v.wave !== "sine" || v.ghost !== true) fail(`a Lampless priest's voice: ${JSON.stringify(v)}`);
    const sur = person("mira", "guard", "survey"), v2 = voices.voiceFor(sur);
    if (v2?.pitch !== 300 || v2.wave !== "square" || !v2.flags.includes("beat")) fail(`a Survey guard's voice: ${JSON.stringify(v2)}`);
    const mix = person("mira", "villager", null); mix.faction = { clatter: 0.3, pleatwood: 0.7 };
    if (voices.voiceFor(mix)?.stone !== true) fail(`the heaviest membership's voice (the Pleatwood, stone): ${JSON.stringify(voices.voiceFor(mix))}`);
    // A range (the Flatfolk 430-560 Hz, the Plan 180-260): each speaker its own pitch, the same every time.
    const pitches = new Set();
    for (let k = 0; k < 12; k++) {
      const ff = person("ess", "villager", "flatfolk"), vf = voices.voiceFor(ff);
      if (!(vf.pitch >= 430 && vf.pitch <= 560) || vf.thin !== true || voices.voiceFor(ff).pitch !== vf.pitch) fail(`a Flatfolk voice: ${JSON.stringify(vf)}`);
      pitches.add(vf.pitch);
      const pv = voices.voiceFor(person("mira", "guard", "plan")).pitch;
      if (!(pv >= 180 && pv <= 260)) fail(`a Plan voice at ${pv} Hz`);
    }
    if (pitches.size < 4) fail(`12 Flatfolk speak at only ${pitches.size} pitches`);
    const own = person("mira", "villager", "survey"); own.voice = { pitch: 99, wave: "sine" };
    if (voices.voiceFor(own)?.pitch !== 99) fail("a creature's own voice doesn't win");
    if (voices.voiceFor(creatures.spawnCreature("goblin", 2, 2, 0, { rng: R })) !== null) fail("a monster with no faction has a voice");
    game.modeStack = []; screens.setMode(game, "map", undefined, { pointer: false });
    creatures.addCreature(game.zone, lamp);
    dl.openTalk(game, lamp);
    if (JSON.stringify(game.talk?.voice) !== JSON.stringify(v)) fail(`the talk screen's voice: ${JSON.stringify(game.talk?.voice)}`);
    keys.dispatchKey(game, "Escape");
    stats.voices = `11 legacy people keep their voices; a Lampless priest ${JSON.stringify(v)}; a Survey guard ${JSON.stringify(v2)}`;
  }

  // --- 14. Liquids and the vial ------------------------------------------------------------------------------------------
  {
    fresh(1234, { genotype: "bent" });
    const z = game.zone, x = Math.floor(p().x) + 1, y = Math.floor(p().y), wz = Math.floor(p().z);
    if (liquids.liquidAt(z, x, y) !== (z.liquid || "water")) fail("liquidAt without zone.liquids");
    z.liquids = { [x + y * z.w]: "brine" };
    if (liquids.liquidAt(z, x, y) !== "brine" || liquids.liquidAt(z, x + 1, y) !== (z.liquid || "water")) fail("liquidAt by column");
    const old = z.get(x, y, wz);
    z.set(x, y, wz, world.B.WATER_SHALLOW);
    p().inv = [{ kind: "vial", effect: "", count: 1 }];
    items.useItem(game, p(), p().inv[0]);
    if (!p().inv.some((i) => i.kind === "vial" && i.effect === "brine")) fail(`filling a vial beside brine: ${JSON.stringify(p().inv)}`);
    z.set(x, y, wz, old);
    // Water three blocks above your feet (a tank on a roof) is out of reach.
    if (wz + 3 < z.h) {
      const high = z.get(x, y, wz + 3);
      z.set(x, y, wz + 3, world.B.WATER_SHALLOW);
      p().inv = [{ kind: "vial", effect: "", count: 1 }];
      items.useItem(game, p(), p().inv[0]);
      if (p().inv[0]?.effect !== "") fail(`a vial filled from water 3 blocks up: ${JSON.stringify(p().inv)}`);
      z.set(x, y, wz + 3, high);
    } else fail(`no room above the start tile for the high water (feet at ${wz}, height ${z.h})`);
    delete z.liquids;
    p().inv = [{ kind: "vial", effect: "", count: 1 }];
    if (items.useItem(game, p(), p().inv[0]) !== 0 || p().inv[0]?.effect !== "") fail("an empty vial filled with no water near");
    p().hp = 5;
    p().inv = [{ kind: "vial", effect: "freshWater", count: 1 }];
    items.useItem(game, p(), p().inv[0]);
    if (p().hp !== 7 || !p().inv.some((i) => i.kind === "vial" && i.effect === "")) fail(`fresh water: hp ${p().hp}, ${JSON.stringify(p().inv)}`);
    liquids.drinkLiquid(game, p(), "ink");
    if (!p().status?.flat) fail("ink didn't make you Flat");
    for (const f of Object.values(F.FACTIONS)) {
      if (f.hidden || f.group) continue;
      const s = liquids.sacramentOf(f.id);
      if (s !== "any" && !liquids.liquidDef(s)) fail(`${f.id}'s sacrament ${s} isn't in content/liquids.js`);
    }
    if (!liquids.isSacrament("unlit", "brine") || liquids.isSacrament("assize", "brine") || !liquids.isSacrament("noonVigil", "water")) fail("isSacrament");
    // A vial never backs or holds money (DECISIONS: glim is a counter): vials of glim in the pack aren't funds, can't
    // pay, and sell as glass.
    p().funds = 5; p().inv = [{ kind: "vial", effect: "glim", count: 3 }];
    if (currency.funds(p()) !== 5 || currency.pay(game, p(), 6) || p().inv[0].count !== 3) fail(`vials of glim count as money: funds ${currency.funds(p())}`);
    if (merchants.priceOf(game, p().inv[0], null, "sell") !== merchants.priceOf(game, { kind: "vial", effect: "" }, null, "sell")) fail("a vial of glim sells for more than its glass");
    const L = (await m("content/liquids.js")).LIQUIDS;
    stats.liquids = `${Object.keys(L).length} liquids (every faction's sacrament among them); a vial filled with brine; fresh water +2 HP; ink, Flat`;
  }

  // --- 15. Shrines -------------------------------------------------------------------------------------------------------
  {
    fresh(1234, { genotype: "bent" });
    p().funds = 1000; p().purse = 1000; p().torch = true;
    const post = creatures.spawnCreature("shrine", 3, 3, 0, { talk: { state: {} } });
    post.talk.dialogue = undefined;
    shrines.makeShrine(post, { cost: 15, faction: "noonVigil" });
    if (post.talk.dialogue !== "shrine" || post.talk.state.cost !== 15) fail(`makeShrine: ${JSON.stringify(post.talk)}`);
    const opts = talk.talkTo(game, post).options.map((o) => o.label);
    if (!opts.some((l) => /^Offer/.test(l)) || !opts.some((l) => /Give 50 glim to the Noon Vigil/.test(l))) fail(`a Vigil shrine's options: ${opts.join(" | ")}`);
    const r0 = F.repOf(game, "noonVigil");
    shrines.donate(game, post, 50);
    if (F.repOf(game, "noonVigil") !== r0 + 10 || p().funds !== 950) fail(`50 glim to the Vigil: rep +${F.repOf(game, "noonVigil") - r0}, funds ${p().funds}`);
    for (let k = 0; k < 30; k++) shrines.donate(game, post, 50);
    if (F.repOf(game, "noonVigil") !== r0 + 200) fail(`the Vigil's donation cap: +${F.repOf(game, "noonVigil") - r0}, want +200`);
    const hush = creatures.spawnCreature("shrine", 4, 3, 0, { talk: { state: {} } });
    shrines.makeShrine(hush, { faction: "lampless" });
    if (shrines.donate(game, hush, 10).ok) fail("a Lampless donation with the torch lit");
    p().torch = false; p().funds = 100;
    const l0 = F.repOf(game, "lampless"), out = shrines.donate(game, hush, 10);
    if (!out.ok || F.repOf(game, "lampless") !== l0 + 5) fail(`10 glim poured in the dark: ${out.line}`);
    const priest = person("mira", "priest", "noonVigil");
    if (talk.talkTo(game, priest).options.some((o) => /Give/.test(o.label))) fail("a Vigil priest takes donations past the cap");
    stats.shrines = `the shrine component on a statue (the legacy offering kept); the Vigil +10 per 50 glim, capped at +200; the Lampless +1 per 2 glim, in the dark only`;
  }

  // --- 16. The trade screen by keys -----------------------------------------------------------------------------------------
  {
    fresh(1234, { genotype: "bent" });
    p().funds = 300;
    const t = named("mira", "merchant", "drovers", { near: [1, 0], name: "Lu" });
    game.modeStack = []; screens.setMode(game, "map", undefined, { pointer: false });
    dl.openTalk(game, t);
    game.talk.shown = game.talk.length;
    const k = game.talk.node.options.findIndex((o) => /what you have/.test(o.label));
    keys.dispatchKey(game, `Digit${k + 1}`);
    if (game.mode !== "trade" || game.trade?.tab !== "theirs") fail(`"Show me what you have" opened ${game.mode} on ${game.trade?.tab}`);
    S.clear(); screens.drawStack(game); S.present();
    let frame = scr.frameText();
    for (const w of ["LU", "THEIRS", "yours", "services", "EGO", "buy ×", "glim"]) if (!frame.includes(w)) fail(`the trade screen doesn't show "${w}"`);
    const f0 = p().funds, rows0 = merchants.tradeRows(game, t, "theirs");
    const cheap = rows0.findIndex((r) => r.price <= f0);
    game.trade.sel = cheap;
    keys.dispatchKey(game, "Enter");
    if (p().funds !== f0 - rows0[cheap].price) fail(`Enter on theirs: funds ${f0} → ${p().funds}, price ${rows0[cheap].price}`);
    keys.dispatchKey(game, "Enter", true);   // the key held: its repeat buys nothing more
    if (p().funds !== f0 - rows0[cheap].price) fail(`a held Enter bought again: funds ${p().funds}`);
    keys.dispatchKey(game, "Tab");
    if (game.trade.tab !== "yours") fail(`Tab led to ${game.trade.tab}`);
    S.clear(); screens.drawStack(game); S.present();
    if (!scr.frameText().includes("YOURS")) fail("the yours tab isn't drawn");
    keys.dispatchKey(game, "Escape");
    if (game.mode !== "talk" || game.trade) fail(`Esc from trade: ${game.mode}`);
    if (!game.talk.node.options.some((o) => /what you have/.test(o.label))) fail("back from trade, the talk didn't start over");
    keys.dispatchKey(game, "Escape");
    stats.tradeScreen = `opened from talk on theirs; a buy by Enter (${rows0[cheap].price} glim); Tab to yours; Esc back to the talker's first words`;
  }

  // --- 17. JSON ----------------------------------------------------------------------------------------------------------
  {
    const st = JSON.parse(JSON.stringify(game.state));
    for (const k of ["kindling", "snuffer", "donations", "merchants"]) if (JSON.stringify(st[k]) !== JSON.stringify(game.state[k])) fail(`state.${k} isn't plain JSON`);
  }

  return { name: "social", ok: !problems.length, problems, stats };
}
