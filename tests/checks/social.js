// WS6a's check (TECH_DESIGN §8.3 "WS6a" acceptance; owner WS6a; WS6b adds its cases after these): factions,
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
//                 the Assize and the Rustbacks gain half; the witnesses then hunt you (ai.js); a follower's blow
//                 counts; a blow at someone already out for you costs nothing
//   5. builders   every legacy person's dialogue and every role (villager, priest, guard, wanderer, merchant) of
//                 every faction at every band gives valid nodes, walked to depth 4 (each answer a node, null or a
//                 shop tab); a refusal at Dark is one goodbye; a Cold merchant won't open the pack; greetings stay
//                 within two lines (bible §2.1)
//   6. state      game.state.rep and knownFactions, and the creatures' grudges, are plain JSON and survive the
//                 save codec's round trip (save/codec.js)
//   7. screen     P opens the factions screen in both views, it lists what you know with the band's light word,
//                 the selection moves, P and Esc close it
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
  const turns = await m("turns.js"), ai = await m("ai.js"), monsters = await m("monsters.js"), rng = await m("rng.js");
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
    // Half weights: −2.5 rounds to the nearer whole (97.5 → 98 style), and the haters' half of 2.5 is 1 (the
    // Saltbeasts hate the Clatter, the Assize the Bent).
    const ok3 = r3.hollowmere === 43 && r3.clatter === 48 && r3.saltbeasts === -399 && r3.assize === -672 && Object.keys(r3).length === 4;
    if (!ok1) fail(`a common Hollowmere kill: ${JSON.stringify(r1)}`);
    if (!ok2) fail(`a named Hollowmere kill: ${JSON.stringify(r2)}`);
    if (!ok3) fail(`a half-Hollowmere, half-Clatter kill: ${JSON.stringify(r3)}`);
    const leg = mob(null); leg.repOnKill = { survey: 150, rustbacks: -100 };
    const r4 = rep.killed(game, p(), leg);
    if (r4.survey !== 150 || r4.rustbacks !== -550) fail(`repOnKill: ${JSON.stringify(r4)}`);
    const before = JSON.stringify(game.state.rep);
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
    const near = [], far = [];
    for (let y = 0; y < zone.d; y++) for (let x = 0; x < zone.w; x++) {
      if ((x === tx && y === ty) || !floorAt(x, y)) continue;
      const d = Math.hypot(x - tx, y - ty);
      if (d < 6 && d >= 2 && lineOfSight(zone, x + 0.5, y + 0.5, zone.stand[x + y * zone.w] + 1.4, P.x, P.y, P.z + 1.5)) near.push([x, y]);
      else if (d > 14 && d < 30) far.push([x, y]);
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
    const before = all.map((c) => F.attitude(game, c, P));
    if (before.some((a) => a !== "neutral")) fail(`${view}: before the blow: ${before.join(", ")}`);
    const r0 = F.repOf(game, "hollowmere");
    game.combatRng = rng.makeRng(4);
    let blows = 0, first = null;
    const swing = () => {
      blows++;
      if (view === "map") { game.mode = "map"; game.view = "map"; turns.mapStep(game, side[0], side[1]); }
      else {
        game.mode = "explore"; game.view = "3d";
        P.attackCd = 0; P.pitch = Math.atan2(victim.z + victim.h * 0.5 - (P.z + 1.5), Math.hypot(victim.x - P.x, victim.y - P.y));
        P.yaw = Math.atan2(victim.y - P.y, victim.x - P.x);
        combat.playerMelee(game);
      }
    };
    while (zone.creatures.includes(victim) && blows < 40) {
      swing();
      if (first === null && victim.brain?.grudges?.player) first = { rep: F.repOf(game, "hollowmere"), att: all.map((c) => F.attitude(game, c, P)), blows };
    }
    const out = { view, blows, first, r0, killed: !zone.creatures.includes(victim) };
    if (!first) { fail(`${view}: ${blows} blows and the villager bears no grudge`); return out; }
    const [av, a1, a2, ao, aa] = first.att;
    if (av !== "hostile" || a1 !== "hostile" || a2 !== "hostile") fail(`${view}: after the first blow the villager and the two who saw it: ${av}, ${a1}, ${a2}`);
    if (ao !== "neutral" || aa !== "neutral") fail(`${view}: the Clatter trader and the far villager: ${ao}, ${aa} (want neutral, neutral)`);
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
    stats.bot = runs.map((r) => `${r.view}: rep ${r.r0} → ${r.first?.rep} at blow ${r.first?.blows} → ${r.rep} killed in ${r.blows}, ${r.hunting} witnesses hunting`).join("; ");
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
        if ((shop?.shop ? "shop" : "node") !== want) fail(`merchant of ${f.id} at ${bandId}: the pack gives ${JSON.stringify(shop?.shop ?? shop?.text)}`);
      }
    }
    // Cold is reached by a talker of one faction (every role, every temperament, the merchant's pack shut).
    for (const role of builders.ROLES) if (!(curtSeen[role] > 0)) fail(`no ${role} of a single faction ever spoke curtly at Cold`);
    for (const temper of TEMPERS) {
      game.state.rep = { drovers: -400 };
      const c = person("mira", "merchant", "drovers"); c.brain = { temperament: temper };
      c.talk.state = { stock: [{ item: { kind: "potion", id: "heal" }, price: 10, count: 1 }] };
      const root = talk.talkTo(game, c), pack = root.options.find((o) => /what you have/.test(o.label))?.go();
      if (root.text !== builders.GREET.merchant.disliked || !pack || pack.shop) fail(`a ${temper} Drover merchant at Cold: "${root.text}", the pack ${JSON.stringify(pack?.shop ?? pack?.text)}`);
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
    stats.screen = `opened and closed in map and 3D; known at the start: ${scrF.knownFactions(game).length}`;
  }

  return { name: "social", ok: !problems.length, problems, stats };
}
