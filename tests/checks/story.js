// WS7's check (TECH_DESIGN §8.3 "WS7" acceptance; owner WS7). Part 7a: history, grammar, secrets, murals, gossip,
// the journal (1-6). Part 7b: villages on every village site for 20 seeds (7), each quest template completed by events
// (8), the campaign's hooks (9); each section's comment says what it holds.
//
//   run(env) → { name, ok, problems, stats }      tests/checks/index.js's contract (Node: tools/check-story.mjs)
//
// 1. History: 100 seeds on the real world, each valid (story/history.js validateHistory: the contract, bible §8's
//    numbers, every event with a gospel, an inscription, a gloss and a cause, the site requests well-formed for WS10:
//    unique ids and names, their event and ruler, a tier with a usable span, 1-5 floors, regionPrefs, a relic placed at
//    most once) in at most 50 ms each; the same seed twice is the same history, and buildRun's is generateHistory's
//    (its own stream, R6); the test world keeps P0's fixture exactly. The validator itself bites: eight broken
//    histories are each refused. A seed's time is the best of three runs.
// 2. Names: 10,000 generated names (Hours, places, regions) hold bible §2.3 (9 letters a word) and none holds a word of
//    §15.11 (check-names' own deny-list); nor does any string of 20 real-world histories.
// 3. Secrets: ids stable per seed (two builds, and a save's restoreRun, give the same defs), of the documented forms,
//    one location per site; learnSecret files, emits "secret", starts a visit quest that a zone entry at the span
//    completes (or completes at once when you've been there), refuses a repeat and an unknown id; three accounts
//    triangulate an event (XP, a note); five triangulated events give the Hour's cult pass; readings and markSold.
// 4. Murals: learned only through `inspect`: by the map hover held 0.5 s (the mouse) and by the look cursor's payload
//    (open: true, what WS8's L sends: the keyboard); a mosaic only on the map, a relief only in 3D in light, a rune only
//    in the dark; describing and drawing the map learn nothing; the describer shows a mosaic's text.
// 5. Gossip: a talker that gossips offers "Heard anything lately?" and its rumour lands in the journal; a legacy talker
//    (Maren) offers nothing new.
// 6. The journal screen: J opens it, its five tabs by keys and clicks, the Histories tab shows what you read, J, Esc and
//    a click outside the tabs close it; its state survives JSON (a save).
import * as names from "./names.js";

const NAME = "story (history, grammar, secrets, murals, gossip, journal; villages, quests, campaign)";

export async function run(env) {
  const problems = [], stats = {};
  const fail = (m) => problems.push(m);
  const { capture } = await env.screen({ cols: 100, rows: 30 });
  const { game, startRun, inputHandlers } = await env.src("game.js");
  await env.src("features.js");
  const H = await env.src("story/history.js"), G = await env.src("story/grammar.js"), SEC = await env.src("story/secrets.js");
  const RUN = await env.src("world/run.js"), WM = await env.src("world/worldmodel.js");
  const { REAL_WORLD } = await env.src("content/world/worldmap.js"), { TEST_WORLD } = await env.src("content/world/test-world.js");
  const { GRAMMAR } = await env.src("content/grammar.js");
  const events = await env.src("events.js"), renderMap = await env.src("renderMap.js"), talk = await env.src("talk.js");
  const journal = await env.src("story/journal.js"), murals = await env.src("story/murals.js"), gossip = await env.src("story/gossip.js");
  const creatures = await env.src("creatures.js"), screens = await env.src("screens.js"), JS = await env.src("screens/journal.js");
  const real = WM.compileWorld(REAL_WORLD), test = WM.compileWorld(TEST_WORLD);
  const json = (v) => JSON.stringify(v);

  // --- 1. History -------------------------------------------------------------------------------------------------
  {
    const times = [], counts = { events: [99, 0], relics: [99, 0], child: 0, old: 0, falseDeaths: 0, lostRelics: 0, disagree: 0, requests: 0 };
    let bad = 0;
    const text = [];
    for (let seed = 1; seed <= 100; seed++) {
      // A seed's time is the best of three runs: the generator's cost, not a busy machine's interruptions (run-all
      // runs this check beside ten others). The budget is per seed, as §8.3 says.
      let h, best = Infinity;
      for (let k = 0; k < 3; k++) { const t0 = performance.now(); h = H.generateHistory(seed, real); best = Math.min(best, performance.now() - t0); }
      if (best > 50) for (let k = 0; k < 6; k++) { const t0 = performance.now(); H.generateHistory(seed, real); best = Math.min(best, performance.now() - t0); }   // over: best of nine before it fails
      times.push(best);
      const p = H.validateHistory(h, { world: real });
      if (p.length) { bad++; if (bad <= 5) fail(`history seed ${seed}: ${p.slice(0, 3).join("; ")}`); }
      for (const R of h.rulers) {
        counts.events = [Math.min(counts.events[0], R.events.length), Math.max(counts.events[1], R.events.length)];
        const n = h.relics.filter((r) => r.rulerId === R.id).length;
        counts.relics = [Math.min(counts.relics[0], n), Math.max(counts.relics[1], n)];
        for (const e of R.events) {
          if (e.type !== "origin" && e.age < 16) counts.child++;
          if (e.age > 70) counts.old++;
          if (e.falseDeath) counts.falseDeaths++;
          if (e.disagree) counts.disagree++;
        }
      }
      // The text (the review's scan): articles, sentence starts, the cause cited, the First Hour heir to no one.
      for (const R of h.rulers) {
        if (R.epithet.startsWith("the ") && !R.cult.name.endsWith(R.epithet)) text.push(`${R.cult.name} (epithet ${R.epithet})`);
        for (const e of R.events) {
          const all = `${e.text.gospel} | ${e.text.inscription} | ${e.text.hostile}`;
          if (/\ba [aeiou]/i.test(all)) text.push(`"a" before a vowel: ${e.id}: ${all}`);
          if (/[.!?] [a-z]/.test(e.text.gospel)) text.push(`a sentence in small letters: ${e.id}: ${e.text.gospel}`);
          if (!["origin", "death", "readFloor", "pressed"].includes(e.type) && !all.toLowerCase().includes(e.cause.toLowerCase())) text.push(`${e.id} (${e.type}) never cites its cause "${e.cause}"`);
          if (R.period === 1 && /reigning Hour/.test(all)) text.push(`the First Hour and a reigning Hour: ${e.text.gospel}`);
          if (/Twice Twice|Twice Who|twice\.$/.test(all)) text.push(`a doubled Erratum: ${e.text.gospel}`);
        }
      }
      for (const r of h.relics) if (/\ba [aeiou]/i.test(`${r.text.deep} | ${r.text.dark}`) || (r.mask && !Array.isArray(r.hatedBy))) text.push(`${r.id}: ${r.text.deep} | ${r.text.dark}`);
      counts.lostRelics += h.relics.filter((r) => r.lostAt).length;
      counts.requests += h.siteRequests.length;
      if (seed <= 3 && json(h) !== json(H.generateHistory(seed, real))) fail(`history seed ${seed}: not the same twice`);
      if (seed <= 3 && json(RUN.buildRun(seed, real).history) !== json(h)) fail(`history seed ${seed}: buildRun's isn't generateHistory's`);
    }
    if (text.length) fail(`${text.length} text defects in 100 histories: ${text.slice(0, 3).join(" || ")}`);
    if (json(H.generateHistory(1, real)) === json(H.generateHistory(2, real))) fail("seeds 1 and 2 make the same history");
    // A wider sweep, validity only: seeds 101-600 and 615 (whose Hour once hated every faction it could have favoured,
    // and the padding of its favoured never ended).
    let sweptBad = 0;
    for (const seed of [...Array.from({ length: 500 }, (_, k) => 101 + k), 615]) {
      const p = H.validateHistory(H.generateHistory(seed, real), { world: real });
      if (p.length && ++sweptBad <= 3) fail(`history seed ${seed}: ${p[0]}`);
    }
    counts.swept = `seeds 101-600 and 615: ${501 - sweptBad} of 501 valid`;
    const sorted = [...times].sort((a, b) => a - b), max = sorted[sorted.length - 1];
    if (max > 50) fail(`a history took ${max.toFixed(1)} ms (budget 50)`);
    for (const seed of [1, 7, 1234]) {
      if (json(RUN.buildRun(seed, test).history) !== json(H.fixtureHistory())) fail(`the test world's history (seed ${seed}) isn't P0's fixture`);
      const p = H.validateHistory(H.fixtureHistory(), { strict: false });
      if (p.length) fail(`the fixture fails the contract: ${p[0]}`);
    }
    // The validator bites.
    const base = H.generateHistory(5, real), mutants = {
      "an event without a cause": (h) => { h.rulers[0].events[2].cause = ""; },
      "an inscription in small letters": (h) => { h.rulers[1].events[3].text.inscription = "a lowercase carving"; },
      "an unexpanded symbol": (h) => { h.rulers[2].events[1].text.gospel = "#name# did a thing."; },
      "a dangling site request": (h) => { h.siteRequests[0].eventId = "nobody:1"; },
      "two requests with one name": (h) => { h.siteRequests[1].name = h.siteRequests[0].name; },
      "a tier without a span": (h) => { h.siteRequests[2].tier = 9; },
      "tier 8 (its one usable span sits beside the Gnomon)": (h) => { h.siteRequests[0].tier = 8; },
      "a gospel of four sentences": (h) => { h.rulers[3].events[2].text.gospel = "One. Two. Three. Four."; },
      "two events with one gloss": (h) => { h.rulers[1].events[5].text.hostile = h.rulers[3].events[4].text.hostile; },
      "two favoured factions": (h) => { h.rulers[4].favoured = h.rulers[4].favoured.slice(0, 2); },
      "a relic placed twice": (h) => { const r = h.relics.find((x) => x.id); h.siteRequests[0].relicId = r.id; h.siteRequests[1].relicId = r.id; },
      "four Hours": (h) => { h.rulers.pop(); },
    };
    const missed = [];
    for (const [why, mutate] of Object.entries(mutants)) {
      const h = JSON.parse(json(base));
      mutate(h);
      if (!H.validateHistory(h, { world: real }).length) missed.push(why);
    }
    if (missed.length) fail(`validateHistory accepts: ${missed.join(", ")}`);
    stats.history = `100 real-world seeds, ${100 - bad} valid; ms (best of 3) p50 ${sorted[50].toFixed(2)}, p95 ${sorted[95].toFixed(2)}, max ${max.toFixed(2)}; ` +
      `events per Hour ${counts.events.join("-")}, relics ${counts.relics.join("-")}, ${counts.requests} site requests; ` +
      `${counts.child} child-age and ${counts.old} old-age events, ${counts.falseDeaths} false deaths, ${counts.lostRelics} lost relics, ` +
      `${counts.disagree} disagreeing; text defects (articles, small-letter sentences, uncited causes, the First Hour as heir, doubled Errata, cults, masks) ${text.length}; ${counts.swept}; ${Object.keys(mutants).length} broken histories refused`;
  }

  // --- 2. Names ---------------------------------------------------------------------------------------------------
  {
    const { makeRng } = await env.src("rng.js");
    const rng = makeRng(31337), list = [];
    const domains = Object.keys(GRAMMAR.domains);
    for (let k = 0; k < 10000; k++) list.push(k % 3 === 0 ? G.hourName(rng) : k % 3 === 1 ? G.placeName(rng) : G.regionName(rng, domains[k % domains.length]));
    const long = list.filter((n) => n.split(/[\s'-]+/).some((w) => w.length > 9));
    if (long.length) fail(`${long.length} generated names have a word over 9 letters: ${long.slice(0, 3).join(", ")}`);
    const hits = names.findHits(list.map((s, k) => ({ file: `name ${k}`, text: s }))).hits;
    if (hits.length) fail(`${hits.length} generated names hold a §15.11 word: ${hits.slice(0, 3).map((h) => h.text).join(", ")}`);
    const strings = [];
    for (let seed = 1; seed <= 20; seed++) names.stringsIn(H.generateHistory(seed, real), strings);
    const sHits = names.findHits([...new Set(strings)].map((s, k) => ({ file: `history string ${k}`, text: s }))).hits;
    if (sHits.length) fail(`history strings hold a §15.11 word: ${sHits.slice(0, 3).map((h) => h.text).join(" | ")}`);
    // The generators' own test refuses what it must (each word of the list, inside a name too).
    const planted = ["Ezra", "Spindlewick", "Sultanmere"].filter((n) => G.nameAllowed(n));
    if (planted.length) fail(`nameAllowed lets through ${planted.join(", ")}`);
    stats.names = `10,000 names (${new Set(list).size} distinct), over 9 letters a word: ${long.length}, §15.11 hits ${hits.length}; ` +
      `${new Set(strings).size} distinct strings of 20 histories, hits ${sHits.length}`;
  }

  // --- 3. Secrets -------------------------------------------------------------------------------------------------
  {
    const FORMS = [/^loc:[\w:,.-]+$/, /^hist:[a-z]+:\d+:(flat|deep|dark)$/, /^hist:noon:[1-6]:(flat|deep|dark)$/, /^gossip:\d+$/, /^village:village:\d+,\d+:[12]$/];
    let stable = 0, total = 0;
    for (const seed of [1, 42, 1234]) {
      for (const W of [real, test]) {
        const r1 = RUN.buildRun(seed, W), r2 = RUN.buildRun(seed, W);
        const a = SEC.makeSecrets(r1), b = SEC.makeSecrets(r2);
        const c = SEC.makeSecrets(RUN.restoreRun(JSON.parse(json(RUN.serializeRun(r1))), W));
        if (json([...a]) !== json([...b]) || json([...a]) !== json([...c])) fail(`seed ${seed} ${W.id}: the secrets differ between two builds or after a save`);
        // The run's own step makes them (world/run.js, since the WS7a merge), so a save carries them as they are.
        const kept = RUN.restoreRun(JSON.parse(json(RUN.serializeRun(r1))), W).secrets;
        if (json([...r1.secrets]) !== json([...a]) || json([...kept]) !== json([...a])) fail(`seed ${seed} ${W.id}: run.secrets (${r1.secrets.size}, ${kept.size} after a save) isn't makeSecrets' ${a.size}`);
        else stable++;
        total += a.size;
        for (const id of a.keys()) if (!FORMS.some((f) => f.test(id))) fail(`seed ${seed} ${W.id}: secret id "${id}"`);
        const locs = [...a.values()].filter((d) => d.kind === "location");
        if (locs.length !== r1.sites.size) fail(`seed ${seed} ${W.id}: ${locs.length} location secrets for ${r1.sites.size} sites`);
        const hist = [...a.values()].filter((d) => d.kind === "history").length;
        const want = 3 * (r1.history.rulers.reduce((n, R) => n + R.events.length, 0) + GRAMMAR.noon.length);
        if (hist !== want) fail(`seed ${seed} ${W.id}: ${hist} history secrets, want ${want}`);
        if (![...a.values()].some((d) => d.kind === "gossip")) fail(`seed ${seed} ${W.id}: no rumours`);
        for (const d of a.values()) if (!SEC.secretText(r1, d)) fail(`seed ${seed} ${W.id}: ${d.id} has no text`);
      }
    }
    // A mural names its event by its text alone (WS10 lays text): every account of 20 real runs resolves to itself.
    let resolved = 0, wrong = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = RUN.buildRun(seed, real);
      for (const R of r.history.rulers) for (const e of R.events) for (const rd of SEC.READINGS) {
        if (SEC.muralSecret(r, e.text[SEC.ACCOUNT[rd]]) === `hist:${e.id}:${rd}`) resolved++;
        else if (++wrong <= 3) fail(`seed ${seed}: the ${rd} account of ${e.id} reads as ${SEC.muralSecret(r, e.text[SEC.ACCOUNT[rd]])}`);
      }
    }
    // Learning, in the test world.
    startRun(7);
    game.mode = "map"; game.view = "map"; game.story.cube = true; game.modeStack = []; game.pages = null;
    const got = [], off = events.on("secret", (g, e) => got.push(e));
    const site = [...game.run.sites.values()].find((s) => s.kind !== "landmark" && (s.at.wx !== 0 || s.at.wy !== 0));
    const locId = `loc:${site.id}`;
    const e1 = SEC.learnSecret(game, locId, "talk");
    const visit = SEC.visitQuest(game, locId);
    if (!e1 || e1.source !== "talk" || got.length !== 1 || got[0].id !== locId || got[0].kind !== "location" || json(got[0].at) !== json(site.at))
      fail(`learnSecret(${locId}): ${json(e1)}, events ${json(got.map((e) => e.id))}`);
    if (!visit || visit.done || json(visit.target) !== json({ wx: site.at.wx, wy: site.at.wy, siteId: site.id })) fail(`no open visit quest for ${locId}: ${json(visit)}`);
    if (SEC.learnSecret(game, locId, "talk") !== null || got.length !== 1) fail("learning a secret twice did something");
    if (SEC.learnSecret(game, "loc:nowhere", "talk") !== null) fail("an unknown secret was learned");
    game.debug.enterZone(`${site.at.wx},${site.at.wy},0`, "edge");
    if (!visit.done) fail(`entering span (${site.at.wx}, ${site.at.wy}) didn't complete the visit quest (stage ${visit.stage})`);
    const home = [...game.run.sites.values()].find((s) => s.kind === "landmark");
    SEC.learnSecret(game, `loc:${home.id.replace(/^landmark:/, "")}`, "talk", { quiet: true });
    const homeVisit = SEC.visitQuest(game, `loc:${home.id.replace(/^landmark:/, "")}`);
    if (!homeVisit?.done) fail(`a visit quest to a place you've been (${home.name}) didn't complete at once`);
    // Triangulation on the fixture's third event of Ishvalet.
    const p = game.player, xp0 = p.xp, lv0 = p.level, notes0 = journal.journalOf(game).notes.length;
    SEC.learnSecret(game, "hist:ishvalet:3:flat", "talk");
    SEC.learnSecret(game, "hist:ishvalet:3:deep", "talk");
    if (journal.journalOf(game).triangulated["ishvalet:3"] !== undefined) fail("two accounts triangulated an event");
    SEC.learnSecret(game, "hist:ishvalet:3:dark", "talk");
    const want = SEC.TRIANGULATION.xp(5);   // the request's tier 2 → level 5
    const { xpToNext, lvlXP } = await env.src("leveling.js");
    // WS4's rate is the one source (RULES.progression.xp.rewards.triangulation, since the WS7a merge): doubled there,
    // the triangulation's XP doubles.
    {
      const { RULES: RR, overrideRules: OR } = await env.src("rules.js"), X = RR.progression.xp;
      const undo = OR("progression", { xp: { ...X, rewards: { ...X.rewards, triangulation: 2 * X.rewards.triangulation } } });
      const doubled = SEC.TRIANGULATION.xp(5);
      undo();
      if (doubled !== Math.round(2 * X.rewards.triangulation * lvlXP(5)) || want !== Math.round(X.rewards.triangulation * lvlXP(5))) fail(`the triangulation's XP isn't WS4's xpReward: ${want}, ${doubled} with the rate doubled`);
    }
    let gained = p.xp - xp0;
    for (let l = lv0; l < p.level; l++) gained += xpToNext(l);
    if (journal.journalOf(game).triangulated["ishvalet:3"] === undefined || gained !== want || journal.journalOf(game).notes.length !== notes0 + 1)
      fail(`three accounts: triangulated ${journal.journalOf(game).triangulated["ishvalet:3"]}, XP +${gained} (want ${want}), notes ${journal.journalOf(game).notes.length - notes0}`);
    // The journal keeps history ids by year (§2.14), whatever order they were learned in.
    SEC.learnSecret(game, "hist:noon:2:deep", "talk", { quiet: true });
    SEC.learnSecret(game, "hist:ammaruth:1:dark", "talk", { quiet: true });
    SEC.learnSecret(game, "hist:ishvalet:1:flat", "talk", { quiet: true });
    const order = journal.journalOf(game).order.history.join();
    if (order !== "hist:ishvalet:1:flat,hist:ishvalet:3:flat,hist:ishvalet:3:deep,hist:ishvalet:3:dark,hist:ammaruth:1:dark,hist:noon:2:deep")
      fail(`order.history: ${order}`);
    // The cult pass, on a real-world run (learnSecret needs only the run, the journal and the log).
    const keep = { run: game.run, state: game.state.journal };
    game.run = RUN.buildRun(42, real);
    delete game.state.journal;
    const R = game.run.history.rulers[0], passes = [];
    const offPass = events.on("cultPass", (g, e) => passes.push(e.rulerId));
    for (const e of R.events.slice(0, 4)) for (const r of SEC.READINGS) SEC.learnSecret(game, `hist:${e.id}:${r}`, "talk", { quiet: true });
    if (journal.journalOf(game).cultPass[R.id] !== undefined) fail("four triangulated events gave a cult pass");
    for (const r of SEC.READINGS) SEC.learnSecret(game, `hist:${R.events[4].id}:${r}`, "talk", { quiet: true });
    if (journal.journalOf(game).cultPass[R.id] === undefined || json(passes) !== json([R.id])) fail(`five triangulated events: cult pass ${journal.journalOf(game).cultPass[R.id]}, events ${json(passes)}`);
    const rd = SEC.readings(game);
    if (rd.length !== 15 || rd.some((x) => !x.text || !x.reading || x.kind !== "history" || x.sold)) fail(`readings: ${json(rd.slice(0, 2))}`);
    if (!SEC.markSold(game, rd[0].id) || SEC.markSold(game, rd[0].id) || !SEC.readings(game)[0].sold) fail("markSold: not once and only once");
    offPass();
    game.run = keep.run; game.state.journal = keep.state;
    off();
    stats.secrets = `${resolved} accounts of 20 runs each resolve to their own secret by text; ids stable over two builds and a save on ${stable} seed × world pairs (${total} secrets); a visit quest completed by entering the span ` +
      `and at once for a place visited; triangulation +${want} XP and a note; a cult pass at five triangulated events`;
  }

  // --- 4. Murals --------------------------------------------------------------------------------------------------
  {
    const { FLOOR_Z } = await env.src("world.js");
    const { B } = await env.src("blocks.js");
    startRun(7);
    game.mode = "map"; game.view = "map"; game.story.cube = true; game.modeStack = []; game.pages = null;
    game.fps = 60; game.frameMs = 1.5;
    const z = game.zone, p = game.player, J = () => journal.journalOf(game).secrets;
    const ev = game.run.history.rulers[0].events;   // the fixture's Ishvalet: three events
    const px = Math.floor(p.x), py = Math.floor(p.y);
    const free = [];
    for (let dy = -4; dy <= 4; dy++) for (let dx = -6; dx <= 6; dx++) {
      const x = px + dx, y = py + dy;
      if ((dx || dy) && x > 0 && y > 0 && x < z.w - 1 && y < z.d - 1) free.push([x, y]);
    }
    for (const [x, y] of free) z.seen[x + y * z.w] = 1;
    const [mx, my] = free[0], [rx, ry] = free[3], [kx, ky] = free[6];
    z.set(mx, my, FLOOR_Z - 1, B.MOSAIC_GOLD);
    z.murals = [
      { x: mx, y: my, z: FLOOR_Z - 1, view: "map", text: ev[0].text.gospel },
      { x: rx, y: ry, z: FLOOR_Z + 1, view: "3d", text: ev[0].text.inscription },
      { x: kx, y: ky, z: FLOOR_Z - 1, view: "map", text: ev[1].text.gospel },
    ];
    const id0 = `hist:${ev[0].id}:flat`, idR = `hist:${ev[0].id}:deep`, id1 = `hist:${ev[1].id}:flat`;
    // Tiles: a mural's own tile reads it alone, even beside another mosaic's mural; a tablet's edge reads its mural.
    {
      const zz = { murals: [{ x: 5, y: 5, z: FLOOR_Z - 1, view: "map", text: "a" }, { x: 6, y: 5, z: FLOOR_Z - 1, view: "map", text: "b" }],
                   get: (x, y, zl) => (zl === FLOOR_Z - 1 && y === 5 && x >= 4 && x <= 7 ? B.MOSAIC_WHITE : 0) };
      const at = (x, y) => murals.muralsAt(zz, x, y).map((m) => m.text).join();
      if (at(5, 5) !== "a" || at(6, 5) !== "b" || at(4, 5) !== "a" || at(7, 5) !== "b" || at(5, 6) !== "") fail(`muralsAt: ${[at(5, 5), at(6, 5), at(4, 5), at(7, 5), at(5, 6)]}`);
      // A 5-wide tablet (WS10's Hour-site paving, x 8-12 round a mural at 10): its edges read it; a gap or a third tile doesn't.
      const zt = { murals: [{ x: 10, y: 3, z: FLOOR_Z - 1, view: "map", text: "c" }],
                   get: (x, y, zl) => (zl === FLOOR_Z - 1 && y === 3 && x >= 8 && x <= 12 && x !== 14 ? B.MOSAIC_WHITE : y === 3 && x === 13 ? B.MOSAIC_GOLD : 0) };
      const at5 = (x) => murals.muralsAt(zt, x, 3).map((m) => m.text).join();
      if (at5(8) !== "c" || at5(12) !== "c" || at5(13) !== "" || at5(7) !== "") fail(`a 5-wide tablet: ${[at5(8), at5(12), at5(13), at5(7)]}`);
    }
    // Drawing and describing learn nothing; the describer shows the mosaic's text, and says what the relief needs.
    game.debug.draw();
    for (let y = 0; y < z.d; y++) for (let x = 0; x < z.w; x++) renderMap.describeTile(game, { x, y });
    if (Object.keys(J()).length) fail(`drawing or describing learned ${Object.keys(J())}`);
    const said = renderMap.describeTile(game, { x: mx, y: my }), saidR = renderMap.describeTile(game, { x: rx, y: ry });
    if (!said.includes(ev[0].text.gospel) || !/read it in 3D/.test(saidR)) fail(`the inspect line: "${said}" / "${saidR}"`);
    // The mouse: a hover held 0.5 s on the mosaic.
    const cellOf = (x, y) => ({ x: (x - renderMap.mapView.tx0) * 2, y: renderMap.mapView.top + y - renderMap.mapView.ty0 });
    const c = cellOf(mx, my);
    inputHandlers.onHover(c.x + 0.5, c.y + 0.5);
    for (let k = 0; k < 4; k++) game.debug.step(0.1);
    if (J()[id0]) fail("the mosaic was learned before 0.5 s of hover");
    game.debug.step(0.15);
    if (J()[id0]?.source !== "mural") fail(`a 0.55 s hover on the mosaic: ${json(J()[id0])}`);
    if (!game.messages.some((m) => (m.text || m).includes?.(ev[0].text.gospel))) fail("the hover's reading didn't reach the log");
    renderMap.mapView.hover = null;
    // The keyboard: the look cursor's payload on the second mosaic (WS8's L emits inspect { …, open: true }).
    events.emit(game, "inspect", { ...renderMap.inspectAt(game, { x: kx, y: ky }, true) });
    if (J()[id1]?.source !== "mural") fail(`the look cursor (open: true) on a mosaic: ${json(J()[id1])}`);
    // The wrong view: a relief on the map; a mosaic in 3D.
    events.emit(game, "inspect", { zone: z, x: rx, y: ry, z: FLOOR_Z + 1, open: true });
    if (J()[idR]) fail("a relief was read on the map");
    game.view = "3d"; game.mode = "explore";
    delete journal.journalOf(game).secrets[id0];
    events.emit(game, "inspect", { zone: z, x: mx, y: my, z: FLOOR_Z - 1, open: true });
    if (J()[id0]) fail("a mosaic was read in 3D");
    p.torch = true;
    events.emit(game, "inspect", { zone: z, x: rx, y: ry, z: FLOOR_Z + 1, open: true });
    if (J()[idR]?.source !== "mural") fail(`a relief in 3D with the torch lit: ${json(J()[idR])}`);
    // A rune in daylight with the torch out: the light is too much for it.
    p.torch = false;
    const lit = !murals.readable(game, z, { x: rx, y: ry, z: FLOOR_Z + 1, view: "dark" }) && murals.readable(game, z, { x: rx, y: ry, z: FLOOR_Z + 1, view: "3d" });
    z.murals.push({ x: rx, y: ry + 1, z: FLOOR_Z + 1, view: "dark", text: ev[1].text.hostile });
    events.emit(game, "inspect", { zone: z, x: rx, y: ry + 1, z: FLOOR_Z + 1, open: true });
    if (!lit || J()[`hist:${ev[1].id}:dark`]) fail(`a rune by daylight with the torch out was read (the surface lit: ${lit})`);
    // A rune: in the dark only, below ground.
    game.debug.enterZone("0,0,1", "down");
    const d = game.zone, q = game.player, dx = Math.floor(q.x), dy = Math.floor(q.y), idK = `hist:${ev[2].id}:dark`;
    d.murals = [{ x: dx + 1, y: dy, z: FLOOR_Z + 1, view: "dark", text: ev[2].text.hostile }];
    game.view = "3d"; game.mode = "explore"; q.torch = true;
    events.emit(game, "inspect", { zone: d, x: dx + 1, y: dy, z: FLOOR_Z + 1, open: true });
    if (J()[idK]) fail("a rune was read with the torch lit");
    q.torch = false;
    events.emit(game, "inspect", { zone: d, x: dx + 1, y: dy, z: FLOOR_Z + 1, open: true });
    if (J()[idK]?.source !== "mural") fail(`a rune in the dark: ${json(J()[idK])}`);
    // A relief in the dark with the torch out: too dark to read.
    const idR2 = `hist:${ev[2].id}:deep`;
    d.murals.push({ x: dx - 1, y: dy, z: FLOOR_Z + 1, view: "3d", text: ev[2].text.inscription });
    events.emit(game, "inspect", { zone: d, x: dx - 1, y: dy, z: FLOOR_Z + 1, open: true });
    if (J()[idR2]) fail("a relief was read in the dark with the torch out");
    stats.murals = "a mosaic by a 0.5 s hover and by the look cursor's payload (open: true); a relief in 3D in light, not on the map; " +
      "a mosaic not in 3D; a rune in the dark, not by torchlight nor by daylight; a relief not in the dark; drawing and describing learned nothing";
  }

  // --- 5. Gossip --------------------------------------------------------------------------------------------------
  {
    startRun(7);
    game.mode = "map"; game.view = "map"; game.story.cube = true; game.modeStack = []; game.pages = null;
    const z = game.zone, maren = z.creatures.find((c) => c.talk);
    talk.registerDialogue("storyCheck", () => talk.node("Hello.", [talk.bye()]));
    const p = game.player;
    const teller = creatures.spawnCreature(maren.type, Math.floor(p.x) + 1, Math.floor(p.y), p.z, {});
    teller.talk = { dialogue: "storyCheck", gossip: true };
    // A talker of a faction that has an opinion of an Hour tells a rumour about that Hour (the fixture: the Kites
    // favour Ishvalet, the Pleatwood hate Ammaruth).
    for (const [faction, rulerId] of [["kites", "hour:ishvalet"], ["pleatwood", "hour:ammaruth"]]) {
      const t2 = creatures.spawnCreature(maren.type, Math.floor(p.x) - 1, Math.floor(p.y), p.z, {});
      t2.talk = { dialogue: "storyCheck", gossip: true }; t2.faction = faction;
      const d = gossip.gossipDef(game, t2);
      if (d?.ref?.rulerId !== rulerId) fail(`a talker of ${faction} told a rumour of ${d?.ref?.rulerId}, not ${rulerId}`);
    }
    const text = gossip.gossipFor(game, teller);
    if (!text) fail("a talker that gossips has nothing to tell");
    const root = talk.talkTo(game, teller), opt = root.options.find((o) => /Heard anything/.test(o.label));
    if (!opt) fail(`no gossip option: ${json(root.options.map((o) => o.label))}`);
    else {
      const said = opt.go();
      const heard = Object.keys(journal.journalOf(game).secrets).filter((id) => id.startsWith("gossip:"));
      if (said?.text !== text || heard.length !== 1) fail(`the rumour: "${said?.text}" vs "${text}", journal ${json(heard)}`);
    }
    const marenOpts = maren ? talk.talkTo(game, maren).options.map((o) => o.label) : [];
    if (marenOpts.some((l) => /Heard anything/.test(l)) || gossip.gossipFor(game, maren) !== null) fail("a legacy talker gossips");
    stats.gossip = `a gossiping talker told "${(text || "").slice(0, 60)}…"; Maren tells nothing new`;
  }

  // --- 6. The journal screen --------------------------------------------------------------------------------------
  {
    const press = (code) => inputHandlers.onKeyDown(code, false, code);
    const screenText = () => { game.debug.draw(); const out = []; for (let y = 0; y < capture.rows; y++) out.push(capture.chars.slice(y * capture.cols, (y + 1) * capture.cols).join("")); return out; };
    const clickAt = (label) => { const rows = screenText(); for (let y = 0; y < rows.length; y++) { const x = rows[y].indexOf(label); if (x >= 0) { inputHandlers.onMouseDown(0, x + 1, y); return true; } } fail(`"${label}" isn't on screen`); return false; };
    SEC.learnSecret(game, "hist:ishvalet:2:flat", "mural", { quiet: true });
    press("KeyJ");
    if (game.mode !== "journal") fail(`J opened ${game.mode}`);
    let t = screenText().join("\n");
    if (!/JOURNAL/.test(t) || !/QUESTS/.test(t) || !/Locations/.test(t)) fail("the journal's tabs aren't drawn");
    press("Digit3");
    t = screenText().join("\n");
    const want = game.run.history.rulers[0].events[1].text.gospel.slice(0, 30);
    if (!/Ishvalet the Glazier/.test(t) || !t.replace(/\s+/g, " ").includes(want) || !/of \d+ events known/.test(t)) fail(`the Histories tab: ${t.slice(0, 300)}`);
    press("ArrowRight");
    if (game.journalView.tab !== 3) fail(`→ from Histories gave tab ${game.journalView.tab}`);
    clickAt("Notes");
    if (game.journalView.tab !== 4 || game.mode !== "journal") fail(`a click on "Notes": tab ${game.journalView.tab}, ${game.mode}`);
    clickAt("JOURNAL");
    if (game.mode !== "map") fail(`a click outside the tabs left ${game.mode}`);
    press("KeyJ"); inputHandlers.onMouseDown(2, 10, 10);
    if (game.mode !== "map") fail(`a right-click left ${game.mode} (the old journal closed on any button)`);
    // The Quests tab says what the parent's journal said (dialogue.js drawJournal, still there): the same lines, in
    // order; and a failed quest is listed (the old journal showed it among the open ones).
    {
      const quests = await env.src("story/quests.js"), dlg = await env.src("dialogue.js");
      const saved = game.quests.splice(0);
      quests.startQuest(game, "temple", { title: "The shaking floor", text: "Find out what's shaking the lower sanctum. It's east, past the spike hall and the mosaic room.", quiet: true });
      quests.startQuest(game, "corwin", { title: "Corwin's errand", text: "Bring him what he asked for.", quiet: true });
      quests.finishQuest(game, "corwin", null, { quiet: true });
      game.debug.draw(); dlg.drawJournal(game);
      const rows = [];
      for (let y = 0; y < capture.rows; y++) rows.push(capture.chars.slice(y * capture.cols, (y + 1) * capture.cols).join(""));
      const w = Math.min(capture.cols - 4, 84), x0 = (capture.cols - w) >> 1;   // the old box (dialogue.js drawJournal)
      const top = rows.findIndex((r) => r.slice(x0 + 3, x0 + 10) === "JOURNAL"), foot = rows.findIndex((r) => r.slice(x0 + 3).startsWith("J or Esc to close"));
      const old = top < 0 || foot < 0 ? [] : rows.slice(top + 2, foot).map((r) => r.slice(x0 + 3, x0 + w - 1).trim()).filter(Boolean);
      const mine = JS.journalLines(game, 0, Math.min(capture.cols - 4, 84) - 6).filter(([t, c]) => c && t.trim()).map(([t]) => t.trim());
      let at = -1;
      const lost = old.filter((l) => { const k = mine.indexOf(l, at + 1); if (k < 0) return true; at = k; return false; });   // each, in order
      if (!old.length || lost.length) fail(`the Quests tab lost the old journal's lines: ${lost.slice(0, 3).join(" | ")} (old ${old.length})`);
      quests.startQuest(game, "visit", { id: "visit:test", title: "A lost errand", quiet: true });
      quests.advanceQuest(game, quests.questOf(game, "visit:test"), "failed", { quiet: true });
      if (!JS.journalLines(game, 0, 80).some(([t]) => t.includes("✗ A lost errand"))) fail("a failed quest isn't in the Quests tab");
      game.quests.splice(0, game.quests.length, ...saved);
      stats.journalQuests = `${old.length} lines of the old journal, all in the Quests tab in order; a failed quest listed`;
    }
    press("KeyJ"); press("Escape");
    if (game.mode !== "map") fail(`Esc left ${game.mode}`);
    if (json(JSON.parse(json(game.state)).journal) !== json(game.state.journal)) fail("the journal doesn't survive JSON");
    stats.journal = "J, five tabs by 1-5, → and a click; Histories shows the mosaic read; a click outside and Esc close; JSON round trip";
  }

  // --- Part 7b -----------------------------------------------------------------------------------------------------
  await villages7b(env, { fail, stats, test, real, json, startRun, game });
  await quests7b(env, { fail, stats, test, json, startRun, game });
  await campaign7b(env, { fail, stats, real, test, json, game, startRun });
  return { name: NAME, ok: problems.length === 0, problems, stats };
}

// --- 7. Villages (7b) -------------------------------------------------------------------------------------------------
// Every village site P0's placeSites returns, 20 seeds on both worlds (the real world has no regions before C1, so no
// village sites yet): the record valid (story/villages.js validateVillage), the same made alone (R6), its surface valid
// on generation (gen/surface.js validateSurface) with the cast where the record says, each reachable with doors open,
// mortal, a member of its village (and its people's faction or the Bent villages, 0.25-0.5); the murals on their blocks
// and naming their own accounts; the same zone twice is the same. Then in play: the mosaics read on the map by the
// hover's and the look cursor's inspect (from the tablet's middle and edges), a lintel in 3D in light, a doorstep rune in
// the dark only; the describer shows a tablet's text; the first visit's XP once and the faction registered; villagers
// gossip, the warden doesn't; the leader's readings, opinions and name for the Kindling.
async function villages7b(env, { fail, stats, test, real, json, startRun, game }) {
  const RUN = await env.src("world/run.js"), SUR = await env.src("gen/surface.js"), VIL = await env.src("story/villages.js");
  const VS = await env.src("story/village-site.js"), murals = await env.src("story/murals.js"), renderMap = await env.src("renderMap.js");
  const { B, BLOCKS } = await env.src("blocks.js"), { FLOOR_Z } = await env.src("world.js"), creatures = await env.src("creatures.js");
  const F = await env.src("factions.js"), journal = await env.src("story/journal.js"), events = await env.src("events.js");
  const SEC = await env.src("story/secrets.js"), talk = await env.src("talk.js"), { xpToNext } = await env.src("leveling.js");
  const counts = { test: 0, real: 0 }, seen = { styles: new Set(), shrines: new Set(), templates: new Set() };
  let n = 0, empty = 0, attempts = 0, maps = 0, lintels = 0, runes = 0, cast = 0, twice = 0, mortals = 0, teaching = 0;
  const codec = await env.src("save/codec.js"), POW = await env.src("content/powers.js"), facs = {};
  const times = [];
  for (const W of [test, real]) for (let seed = 1; seed <= 20; seed++) {
    const run = RUN.buildRun(seed, W);
    const want = [...run.sites.values()].filter((s) => s.kind === "village");
    if (run.villages.size !== want.length) fail(`seed ${seed} ${W.id}: ${run.villages.size} villages for ${want.length} village sites`);
    for (const site of want) {
      const v = run.villages.get(site.id), tag = `seed ${seed} ${W.id} ${site.id}`;
      counts[W.id === "test" ? "test" : "real"]++;
      const p = VIL.validateVillage(run, v);
      if (p.length) fail(`${tag}: ${p.slice(0, 3).join("; ")}`);
      if (json(VIL.generateVillage(run, site)) !== json(v)) fail(`${tag}: the record differs made alone (R6)`);
      if (json(run.factions.get(v.factionId)) !== json(VIL.villageFaction(v)))   // the run's factions step (WS7b #9, at the merge)
        fail(`${tag}: the run's faction is ${json(run.factions.get(v.factionId))?.slice(0, 120)}, not villageFaction's`);
      else facs[v.parent] = (facs[v.parent] || 0) + 1;
      seen.styles.add(v.layout.style); seen.shrines.add(v.culture.shrine); if (v.quest) seen.templates.add(v.quest.template);
      const t0 = performance.now(), z = SUR.generateSurface(run, site.at.wx, site.at.wy);
      times.push(performance.now() - t0);
      n++; attempts += z.attempts; if (v.abandoned) empty++;
      if (z.problems.length) fail(`${tag}: ${z.problems.slice(0, 3).join("; ")}`);
      if (z.village?.siteId !== site.id) { fail(`${tag}: no zone.village`); continue; }
      const members = z.creatures.filter((c) => c.village === site.id);
      if (members.length !== v.roles.length) fail(`${tag}: ${members.length} of ${v.roles.length} of the cast placed`);
      for (const r of v.roles) {
        const c = members.find((m) => m.uid === r.uid);
        if (!c) continue;
        const second = Object.entries(c.faction || {}).find(([id]) => id !== v.factionId)?.[1];
        if (c.talk?.dialogue !== r.dialogue || c.name !== r.name || c.faction?.[v.factionId] !== 1 || !(second >= 0.25 && second <= 0.5)
          || !(creatures.typeOf(c).hp > 0) || !(c.hp > 0) || c.maxHp !== c.hp || c.glyph !== "@" || c.level !== v.level)
          fail(`${tag}: ${r.uid} is ${json({ d: c.talk?.dialogue, name: c.name, f: c.faction, hp: creatures.typeOf(c).hp, level: c.level, own: c.hp })}`);
        if (c.teaches?.length) {   // (found at the WS7b merge: an artificing village's leader taught Repair, which waits on WS5)
          teaching++;
          if (c.teaches.some((id) => !POW.POWERS[id] || POW.POWERS[id].needs)) fail(`${tag}: ${r.uid} teaches ${c.teaches} (a power still waiting on its needs)`);
        }
        if (r === v.roles[0]) {   // mortal (WS6a #1, at the merge): a struck one keeps its health through a save
          const back = codec.rebuildCreature(JSON.parse(json(codec.trimCreature({ ...c, hp: c.hp - 1 }))), z);
          if (back.hp !== c.hp - 1 || back.maxHp !== c.maxHp || !creatures.touchable(game, back, {})) fail(`${tag}: ${r.uid} reloaded with hp ${back.hp} of ${back.maxHp}`);
          else mortals++;
        }
      }
      for (const x of VS.castReachable(z)) if (!x.ok) fail(`${tag}: ${x.c.name} can't be reached`);
      cast += members.length;
      const kinds = { map: 0, "3d": 0, dark: 0 };
      for (const m of z.murals) {
        kinds[m.view]++;
        if (SEC.secretText(run, m.secret) !== m.text) fail(`${tag}: a ${m.view} mural's text isn't ${m.secret}`);
        if (m.view === "map") {
          maps++;
          if (!BLOCKS[z.get(m.x, m.y, FLOOR_Z - 1)]?.mosaic) fail(`${tag}: a map mural off its mosaic`);
          for (const dx of [-2, -1, 0, 1, 2]) if (!murals.muralsAt(z, m.x + dx, m.y).includes(m)) fail(`${tag}: the tablet's tile ${dx} doesn't read its mural`);
        } else if (m.view === "3d") { lintels++; if (z.get(m.x, m.y, m.z) !== B.MURAL) fail(`${tag}: a lintel without its carved panel`); }
        else { runes++; if (z.get(m.x, m.y, FLOOR_Z - 1) !== B.RUNE) fail(`${tag}: a doorstep rune without its rune`); }
      }
      const wantK = v.abandoned ? { map: 1, "3d": 1, dark: 1 } : { map: v.history.length, "3d": v.history.length, dark: v.layout.rune ? 1 : 0 };
      if (json(kinds) !== json(wantK)) fail(`${tag}: murals ${json(kinds)}, want ${json(wantK)}`);
      if (n % 8 === 1) {   // the same zone twice: blocks, cast, murals
        const z2 = SUR.generateSurface(run, site.at.wx, site.at.wy);
        const sig = (zz) => json([zz.creatures.map((c) => [c.uid, c.type, c.tx, c.ty]), zz.murals, zz.village]);
        if (sig(z2) !== sig(z) || Buffer.compare(Buffer.from(z.blocks), Buffer.from(z2.blocks)) !== 0) fail(`${tag}: the zone differs made twice`);
        twice++;
      }
    }
  }
  times.sort((a, b) => a - b);
  // R6 between villages: with another village's site gone, a village keeps its culture, cast, art, government and
  // abandonment (only what names a neighbour may change: a feud's text and hatred, a quest's target).
  let pairs = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const run = RUN.buildRun(seed, test), vs = [...run.sites.values()].filter((s) => s.kind === "village");
    for (const gone of vs) {
      const run2 = { ...run, sites: new Map([...run.sites].filter(([id]) => id !== gone.id)) };
      for (const site of vs) {
        if (site === gone) continue;
        const keepK = (v) => json([v.culture, v.roles, v.history, v.government, v.abandoned, v.founding.map((f) => f.event), v.layout.rune]);
        if (keepK(VIL.generateVillage(run2, site)) !== keepK(run.villages.get(site.id))) fail(`seed ${seed}: ${site.id} changed when ${gone.id} was taken away`);
        pairs++;
      }
    }
  }
  // No Math.random in the generation files (R6; check-determinism scans gen/ and world/, these are story/).
  for (const f of ["story/villages.js", "story/questplan.js", "story/village-site.js"]) {
    const text = await env.text(`src/${f}`);
    if (/Math\.random/.test(text)) fail(`${f} calls Math.random`);
  }
  stats.villages = `${n} villages (test world ${counts.test}, real world ${counts.real}: no regions there before C1) on every village site of 20 seeds, ` +
    `${empty} abandoned; surfaces valid on ${attempts} attempts (p50 ${times[n >> 1]?.toFixed(1)} ms, max ${times[n - 1]?.toFixed(1)}); ${cast} villagers placed and reachable; ` +
    `the run's factions villageFaction's (${Object.entries(facs).map(([k, x]) => `${x} under ${k}`).join(", ")}); ${mortals} villagers mortal through a save; ${teaching} leaders teaching a power that works today; ` +
    `${maps} mosaic, ${lintels} lintel and ${runes} rune murals on their blocks; records alike made alone and in ${pairs} pairs with another village taken away, ${twice} zones alike made twice; ` +
    `styles ${[...seen.styles].join(", ")}; shrines ${[...seen.shrines].join(", ")}; ${seen.templates.size} of 9 templates drawn`;

  // In play: a village of the test world with a rune, by the inspect paths.
  let seed = 0, pick = null;
  for (seed = 1; seed <= 40 && !pick; seed++) {
    const run = RUN.buildRun(seed, test);
    pick = [...run.villages.values()].find((x) => !x.abandoned && x.layout.rune && x.history.length === 2) || null;
  }
  seed--;
  startRun(seed);
  game.mode = "map"; game.view = "map"; game.story.cube = true; game.modeStack = []; game.pages = null;
  const v = game.run.villages.get(pick.siteId);
  const site = game.run.sites.get(v.siteId), key = `${site.at.wx},${site.at.wy},0`;
  const p = game.player, xp0 = p.xp, lv0 = p.level;
  game.debug.enterZone(key, "edge");
  const z = game.zone, J = () => journal.journalOf(game).secrets;
  let gained = p.xp - xp0;
  for (let l = lv0; l < p.level; l++) gained += xpToNext(l);
  const fac = F.FACTIONS[v.factionId];
  if (gained !== VS.VILLAGE_REWARD.xp(v.level) || !fac || fac.parent !== v.parent || fac.siteId !== v.siteId)
    fail(`the first visit: +${gained} XP (want ${VS.VILLAGE_REWARD.xp(v.level)}), faction ${json(fac && { parent: fac.parent, siteId: fac.siteId })}`);
  game.debug.enterZone(`${site.at.wx + (site.at.wx > 1 ? -1 : 1)},${site.at.wy},0`, "edge");
  const xp1 = p.xp, lv1 = p.level;
  game.debug.enterZone(key, "edge");
  if (p.xp !== xp1 || p.level !== lv1) fail("a second visit gave XP again");
  // The mosaics: from the tablet's middle by the look cursor's payload, from its edge by a hover's (open: false).
  const [ma, mb] = z.murals.filter((m) => m.view === "map");
  z.seen.fill(1);
  for (let y = 0; y < z.d; y++) for (let x = 0; x < z.w; x++) renderMap.describeTile(game, { x, y });
  game.debug.draw();
  if (J()[ma.secret]) fail("drawing or describing the village read its mosaic");
  const said = renderMap.describeTile(game, { x: ma.x - 2, y: ma.y });
  if (!said?.includes(ma.text)) fail(`the inspect line on the tablet's edge: "${said}"`);
  game.view = "3d"; game.mode = "explore";
  events.emit(game, "inspect", { zone: z, x: ma.x, y: ma.y, z: ma.z, open: true });
  if (J()[ma.secret]) fail("a village mosaic was read in 3D");
  game.view = "map"; game.mode = "map";
  events.emit(game, "inspect", { zone: z, x: ma.x, y: ma.y, z: ma.z, open: true });
  events.emit(game, "inspect", { zone: z, x: mb.x + 2, y: mb.y, z: mb.z, open: false });
  if (J()[ma.secret]?.source !== "mural" || J()[mb.secret]?.source !== "mural") fail(`the village's mosaics on the map: ${json([J()[ma.secret], J()[mb.secret]])}`);
  // A lintel: in 3D in light; not on the map.
  const lt = z.murals.find((m) => m.view === "3d");
  events.emit(game, "inspect", { zone: z, x: lt.x, y: lt.y, z: lt.z, open: true });
  if (J()[lt.secret]) fail("a lintel was read on the map");
  game.view = "3d"; game.mode = "explore"; p.torch = true;
  events.emit(game, "inspect", { zone: z, x: lt.x, y: lt.y, z: lt.z, open: true });
  if (J()[lt.secret]?.source !== "mural") fail(`a lintel in 3D by daylight: ${json(J()[lt.secret])}`);
  // The doorstep rune: inside the shut hall, torch lit no; torch out yes.
  const rn = z.murals.find((m) => m.view === "dark");
  events.emit(game, "inspect", { zone: z, x: rn.x, y: rn.y, z: rn.z, open: true });
  if (J()[rn.secret]) fail("the doorstep rune was read by torchlight");
  p.torch = false;
  events.emit(game, "inspect", { zone: z, x: rn.x, y: rn.y, z: rn.z, open: true });
  if (J()[rn.secret]?.source !== "mural") fail(`the doorstep rune in the dark: ${json(J()[rn.secret])}`);
  p.torch = true; game.view = "map"; game.mode = "map";
  // Gossip: a villager tells, the warden doesn't; the leader for the Kindling.
  const villager = z.creatures.find((c) => c.villageRole === "villager"), warden = z.creatures.find((c) => c.villageRole === "warden");
  const vOpts = talk.talkTo(game, villager).options.map((o) => o.label), wOpts = talk.talkTo(game, warden).options.map((o) => o.label);
  if (!vOpts.some((l) => /Heard anything/.test(l)) || wOpts.some((l) => /Heard anything/.test(l))) fail(`gossip: a villager ${json(vOpts)}, the warden ${json(wOpts)}`);
  const leader = z.creatures.find((c) => c.villageRole === "leader");
  if (!leader.named || !leader.readings?.length || leader.readings.some((id) => !SEC.secretDef(game.run, id)) || !Array.isArray(leader.opinions) || !Array.isArray(leader.teaches))
    fail(`the leader for the Kindling: ${json({ named: leader.named, readings: leader.readings, opinions: leader.opinions, teaches: leader.teaches })}`);
  // A save of the village zone and back (the WS9 codec): the cast keeps its village, role and the Kindling's fields; the
  // murals, zone.village and the flags come back; the giver still offers its quest.
  {
    const codec = await env.src("save/codec.js");
    const rec = await codec.finishZone(codec.snapshotZone(z, { slot: "check", savedAt: 1 }));
    const back = await codec.decodeZone(JSON.parse(json(rec)));
    const keepK = (c) => json([c.uid, c.village, c.villageRole, c.readings, c.opinions, c.teaches, c.faction, c.named, c.talk?.dialogue]);
    const lost = z.creatures.filter((c) => c.village).filter((c) => keepK(back.creatures.find((b) => b.uid === c.uid) || {}) !== keepK(c));
    if (lost.length || json(back.murals) !== json(z.murals) || json(back.village) !== json(z.village)) fail(`a saved village loses ${lost.map((c) => c.name)}${json(back.murals) !== json(z.murals) ? ", its murals" : ""}${json(back.village) !== json(z.village) ? ", zone.village" : ""}`);
    const g2 = back.creatures.find((c) => c.villageRole === "questGiver");
    if (v.quest && !talk.talkTo(game, g2).options.some((o) => /anything I can do/.test(o.label))) fail("a reloaded quest-giver offers nothing");
  }
  SEC.learnSecret(game, leader.readings[0], "ritual", { quiet: true });
  const JS = await env.src("screens/journal.js");
  if (!JS.journalLines(game, 1, 200).some(([t]) => t.includes(v.founding[0].text.slice(0, 30)))) fail("a village tale isn't in the Locations tab");
  stats.villagePlay = `${v.name} (seed ${seed}): first visit +${gained} XP once, its faction (parent ${v.parent}) registered; both mosaics read on the map ` +
    `(the look cursor at the middle, a hover's inspect at the edge), not in 3D; a lintel in 3D by daylight, not on the map; the doorstep rune with the torch out only; ` +
    `a villager gossips, the warden doesn't; the leader named with ${leader.readings.length} readings; a village tale in the Locations tab`;
}

// --- 8. Quests (7b) ---------------------------------------------------------------------------------------------------
// Each of the nine templates given by its village's quest-giver (its own planned quest, on the first test-world seed that
// has one), completed by bus events through the real paths (the pack's pickup, inspect, kill, zone entry, the talk
// options), then turned in at the giver: 25 × tier glim (what the purse takes), +100 with the village and +25 with each
// faction that likes it, the quest XP, 1 of 3 items. An unrelated event moves nothing. "Recover" with its target zone
// visited before the quest is given (the thing waits there, once); "rescue" sends the lost one home by a zone patch to the
// already-visited village (uids); a hunted beast's uid stays dead. (An unrelated secret, inspect or tick moves nothing.)
async function quests7b(env, { fail, stats, test, json, startRun, game }) {
  const RUN = await env.src("world/run.js"), QP = await env.src("story/questplan.js"), VQ = await env.src("story/villagequests.js");
  const talk = await env.src("talk.js"), events = await env.src("events.js"), items = await env.src("items.js"), mon = await env.src("monsters.js");
  const F = await env.src("factions.js"), journal = await env.src("story/journal.js"), { xpToNext } = await env.src("leveling.js");
  const zones = await env.src("zones.js");
  const done = [];
  const seedFor = (T) => { for (let s = 1; s <= 60; s++) { const r = RUN.buildRun(s, test); const v = [...r.villages.values()].find((x) => x.quest?.template === T); if (v) return [s, v.siteId]; } return [null, null]; };
  const xpOf = (p) => { let t = p.xp; for (let l = 1; l < p.level; l++) t += xpToNext(l); return t; };
  for (const T of QP.QUEST_ORDER) {
    const [seed, siteId] = seedFor(T);
    if (!seed) { fail(`${T}: no village of 60 seeds gives it`); continue; }
    startRun(seed);
    game.mode = "map"; game.view = "map"; game.story.cube = true; game.modeStack = []; game.pages = null;
    const run = game.run, v = run.villages.get(siteId), prm = v.quest.params, site = run.sites.get(siteId);
    const home = `${site.at.wx},${site.at.wy},0`, p = game.player;
    const enter = (key) => { game.debug.enterZone(key, "edge"); return game.zone; };
    const opt = (c, re) => (c ? talk.talkTo(game, c).options.find((o) => re.test(o.label)) : null);
    const who = (uid) => game.zone.creatures.find((c) => c.uid === uid);
    const tick = () => events.emit(game, "clock:tick", { t0: game.time, t1: game.time });
    try {
      // "Recover": its zone first, before the quest exists: the thing is already there.
      if (T === "recover") { const z = enter(prm.target.key); if (z.items.filter((i) => i.uid === prm.itemUid).length !== 1) throw new Error("not waiting in its zone before the quest"); }
      enter(home);
      const g = who(prm.giver);
      const ask = opt(g, /anything I can do/);
      if (!ask) throw new Error(`the giver offers nothing: ${json(talk.talkTo(game, g).options.map((o) => o.label))}`);
      ask.go().options.find((o) => /do it/.test(o.label)).go();
      const q = journal && game.quests.find((x) => x.id === VQ.villageQuestId(siteId));
      if (!q) throw new Error("not started");
      const s0 = q.stage;
      if (/\{\w+\}/.test(q.title + q.text) || /\bat ([^,.]+), at \1\b/.test(q.text) || /\bOur the\b|[.!?] [a-z]/.test(q.text)) throw new Error(`the words: "${q.title}" / "${q.text}"`);
      events.emit(game, "secret", { id: "nothing", kind: "gossip" });
      events.emit(game, "inspect", { zone: game.zone, x: 1, y: 1, z: 2, open: true });
      tick();
      if (q.stage !== s0) throw new Error(`unrelated events moved it to ${q.stage}`);
      if (T === "recover" || T === "climb") {
        const z = enter(prm.target.key), its = z.items.filter((i) => i.uid === prm.itemUid);
        if (its.length !== 1) throw new Error(`${its.length} things in its zone`);
        if (T === "climb") {   // on the pole's top: the map can't get there (one block a step, no jumps)
          const stand = (await env.src("world.js")).standWith(z, "open"), path = await env.src("pathing.js");
          const dist = path.reachable(stand, z.w, z.d, Math.floor(z.spawn.x), Math.floor(z.spawn.y), path.PLAYER_STEP_UP, path.PLAYER_DROP);
          const P = z.village.perch;
          if (dist[P.x + P.y * z.w] >= 0 || its[0].z !== P.z || dist[P.x - 2 + P.y * z.w] < 0) throw new Error("the perch is reachable on the map, or its steps aren't");
        }
        p.x = its[0].x; p.y = its[0].y; p.z = its[0].z;
        const heard = [], offPick = events.on("pickup", (g, ev) => heard.push(ev.item?.uid));
        items.pickUpItems(game);   // items.js's "pickup" (WS7b #12, at the merge) moves it before the tick does
        offPick();
        if (q.stage !== "return" || json(heard) !== json([prm.itemUid])) throw new Error(`picked up: stage ${q.stage} before the tick, pickup heard for ${json(heard)}`);
        tick();
        if (q.stage !== "return") throw new Error(`the thing in the pack: stage ${q.stage}`);
        // Dropped on the way back: fetching again, and no turn-in for it.
        const held = p.inv.find((i) => i.uid === prm.itemUid);
        p.inv = p.inv.filter((i) => i !== held);
        events.emit(game, "quest:turnIn", { q });   // (before the tick that notices: the turn-in itself must refuse)
        if (q.done) throw new Error("turned in with the thing dropped");
        tick();
        if (q.stage !== "fetch") throw new Error(`the thing dropped: stage ${q.stage}`);
        p.inv.push(held); tick();
      } else if (T === "carry") {
        enter(prm.target.key);
        const o = opt(who(prm.toUid), /bring word/);
        if (!o) throw new Error("the other leader hears nothing");
        o.go().options[1].go();   // the answer sweetened
      } else if (T === "readFloor") {
        const z = enter(prm.target.key), m = z.murals.find((mm) => mm.secret === prm.secret);
        events.emit(game, "inspect", { zone: z, x: m.x - 1, y: m.y, z: m.z, open: false });
      } else if (T === "pray") {
        const z = game.zone, s = z.village.shrine;
        const wrong = s.view === "map" ? "3d" : "map";
        game.view = wrong; game.mode = wrong === "map" ? "map" : "explore";
        events.emit(game, "inspect", { zone: z, x: s.x, y: s.y, z: s.z, open: true });
        if (q.stage !== "pray") throw new Error("prayed in the wrong view");
        game.view = s.view === "map" ? "map" : "3d"; game.mode = game.view === "map" ? "map" : "explore";
        p.torch = s.view !== "dark";
        if (s.view === "dark") game.time += 15 * 60;   // 21:00: night
        events.emit(game, "inspect", { zone: z, x: s.x + 3, y: s.y + 2, z: s.z, open: true });
        if (q.stage !== "pray") throw new Error("prayed at the wrong tile");
        events.emit(game, "inspect", { zone: z, x: s.x, y: s.y, z: s.z, open: true });
        game.view = "map"; game.mode = "map"; p.torch = true;
      } else if (T === "find") {
        const off = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [site.at.wx + dx, site.at.wy + dy])
          .find(([x, y]) => run.world.tileAt(x, y)?.edges === "open" && `${x},${y},0` !== prm.target.key);
        if (off) { enter(`${off[0]},${off[1]},0`); if (q.stage !== "go") throw new Error("another span found the place"); }
        enter(prm.target.key);
      }
      else if (T === "hunt") {
        const z = enter(prm.target.key), b = who(prm.beastUid);
        if (!b) throw new Error("no beast");
        const decoy = (await env.src("creatures.js")).addCreature(z, (await env.src("creatures.js")).spawnCreature("rat", b.tx, b.ty, b.z, { rng: () => 0.5, level: 1 }));
        mon.killMonster(game, decoy, "dies");
        if (q.stage !== "hunt") throw new Error("another kill ended the hunt");
        mon.killMonster(game, b, "dies");
        if (zones.uidWhere(game, prm.beastUid) !== "dead") throw new Error("the beast's uid isn't dead");
        enter(home); enter(prm.target.key);
        if (who(prm.beastUid)) throw new Error("the beast came back");
      } else if (T === "rescue") {
        enter(prm.target.key);
        const o = opt(who(prm.lostUid), /Go home/);
        if (!o) throw new Error("the lost one has nothing to hear");
        o.go();
        if (who(prm.lostUid) || zones.uidWhere(game, prm.lostUid) !== home) throw new Error("the lost one didn't leave for home");
      } else if (T === "chart") {
        const z = enter(prm.target.key);
        z.seen.fill(0);
        const { KIND } = await env.src("blocks.js");
        // The goal: percent%, or 5 under what can be walked to (or stood beside) from where you came in.
        if (!(q.vars.chartable > 0 && q.vars.chartable <= 100)) throw new Error(`the level's chartable share: ${q.vars.chartable}`);
        const goal = Math.max(1, Math.min(prm.percent, q.vars.chartable - 5));
        const open = []; for (let i = 0; i < z.w * z.d; i++) if (z.kind[i] !== KIND.WALL) open.push(i);
        for (const i of open.slice(0, Math.floor(open.length * (goal - 1) / 100))) z.seen[i] = 1;   // (mapPercent rounds)
        tick();
        if (q.stage !== "chart") throw new Error(`under ${goal}% charted ended it`);
        z.seen.fill(1); tick();
      }
      if (q.stage !== "return") throw new Error(`stage ${q.stage}`);
      const back = `${q.title}: go back to ${q.giver.name}.`;   // the line that says so (found at the WS7b merge: a prayer said nothing)
      if (!game.messages.some((m) => m.text === back)) throw new Error(`no "${back}" in the log: ${json(game.messages.slice(-3).map((m) => m.text))}`);
      events.emit(game, "quest:turnIn", { q: { ...q } });   // someone else's turn-in
      if (q.done) throw new Error("another quest's turn-in finished it");
      enter(home);
      if (T === "rescue" && !who(prm.lostUid)) throw new Error("the lost one isn't home (the patch to the visited village)");
      const f0 = p.funds || 0, x0 = xpOf(p), r0 = F.repOf(game, v.factionId), inv0 = p.inv.length;
      const likes0 = v.likedBy.map((id) => F.repOf(game, id));
      const other = T === "carry" ? run.villages.get(prm.to) : null, o0 = other ? F.repOf(game, other.factionId) : 0;
      const room = (await env.src("currency.js")).purseRoom(p);
      const n1 = opt(who(prm.giver), /It's done/).go();
      if (!q.done) throw new Error("not done at the giver");
      const R = q.reward, dRep = F.repOf(game, v.factionId) - r0;
      if (R.funds !== 25 * v.tier || (p.funds || 0) - f0 !== Math.min(R.funds, room)) throw new Error(`glim ${(p.funds || 0) - f0} of ${R.funds}`);
      if (dRep !== (T === "carry" ? 75 : 100) || v.likedBy.some((id, k) => F.repOf(game, id) - likes0[k] !== 25)) throw new Error(`rep +${dRep}`);
      if (other && F.repOf(game, other.factionId) - o0 !== 25) throw new Error("the sweetened answer didn't please the other village");
      if (xpOf(p) - x0 !== R.xp || !(R.xp > 0)) throw new Error(`XP +${xpOf(p) - x0} (reward ${R.xp})`);
      if (prm.itemUid && p.inv.some((i) => i.uid === prm.itemUid)) throw new Error("the thing wasn't handed over");
      n1.options[1].go();
      if (q.vars.took !== 1 || p.inv.length < inv0 - (prm.itemUid ? 1 : 0) + 1 - 0 || opt(who(prm.giver), /reward/)) throw new Error(`the item choice: took ${q.vars.took}`);
      done.push(`${T} (${v.name}, ${prm.where}: +${R.funds} glim, +${R.xp} XP)`);
    } catch (e) { fail(`quest ${T} (seed ${seed}, ${v?.name}): ${e.message}`); }
  }
  stats.quests = `${done.length} of ${QP.QUEST_ORDER.length} templates completed by events and turned in: ${done.join("; ")}`;
}

// --- 9. The campaign (7b) -----------------------------------------------------------------------------------------------
// The data: eleven beats, 7 and 8 both after 6 and 9 after both, each matcher at a real-world landmark and a floor it has;
// the intro, the starter chain. The engine: no campaign on the test world (the parent's story stays); on the real world the
// start gives beat 1, each beat's event finishes it and starts the next; a wrong floor doesn't; 7 and 8 in either order,
// 9 only after both; the Lengthening three times (after 5, the first of 7 and 8, and 9); the early bonus × 1.5.
async function campaign7b(env, { fail, stats, real, test, json, game, startRun }) {
  const CAM = await env.src("story/campaign.js"), RUN = await env.src("world/run.js"), events = await env.src("events.js");
  const { INTRO } = await env.src("story/legacy.js"), { xpToNext } = await env.src("leveling.js");
  const B = CAM.CAMPAIGN.beats;
  if (B.length !== 11 || B.some((b, k) => b.n !== k + 1) || new Set(B.map((b) => b.id)).size !== 11) fail(`the beats: ${B.map((b) => b.id)}`);
  for (const b of B) {
    if (b.after.some((id) => !B.find((x) => x.id === id && x.n < b.n))) fail(`${b.id}: after ${b.after}`);
    const L = real.landmarks.get(b.done.landmark || b.landmark);
    if (!L) fail(`${b.id}: no landmark ${b.done.landmark}`);
    else if (b.done.event === "zone:enter" && b.done.z > 0 && !(L.dungeon && b.done.z <= (L.dungeon.floors?.length || L.dungeon.levels)))
      fail(`${b.id}: ${L.id} has no floor ${b.done.z}`);
  }
  if (json(B[6].after) !== json(["beat6"]) || json(B[7].after) !== json(["beat6"]) || !B[8].needsAll || json(B[8].after) !== json(["beat7", "beat8"])) fail("beats 7-9's order");
  if (!CAM.CAMPAIGN.intro.length || CAM.CAMPAIGN.starter.length !== 5) fail("the intro or the starter chain");
  if (CAM.introPages(RUN.buildRun(1, test)) !== INTRO || CAM.introPages(RUN.buildRun(1, real)) !== CAM.CAMPAIGN.intro) fail("introPages");
  // The test world: none of it.
  // The pages startRun opens (WS7b #11, at the merge): the parent's INTRO on the test world, the campaign's on the real one.
  startRun(3, real);
  const introReal = game.mode === "story" && game.pages?.list;
  startRun(3);
  const introTest = game.mode === "story" && game.pages?.list;
  if (introTest !== INTRO || introReal !== CAM.CAMPAIGN.intro)
    fail(`startRun's intro: test world ${introTest === INTRO ? "INTRO" : introTest?.[0]?.title}, real world ${introReal === CAM.CAMPAIGN.intro ? "the campaign's" : introReal?.[0]?.title}`);
  if (game.quests.some((q) => q.template === "beat") || game.state.campaign?.started != null || CAM.beginCampaign(game)) fail("the campaign started on the test world");
  // The real world (the run and the bus; zones are stand-ins with a landmark and a floor).
  const keep = { run: game.run, quests: game.quests, campaign: game.state.campaign };
  game.run = RUN.buildRun(1, real); game.quests = []; delete game.state.campaign;
  const beats = [], lengthen = [], offB = events.on("beat", (g, e) => beats.push(e.n)), offL = events.on("lengthen", (g, e) => lengthen.push(beats.length));
  const at = (landmarkId, z) => events.emit(game, "zone:enter", { zone: { landmarkId, z, key: `x,${z}` }, how: "edge" });
  const open = () => game.quests.filter((q) => q.template === "beat" && !q.done).map((q) => q.id).sort().join();
  if (!CAM.beginCampaign(game) || CAM.beginCampaign(game) || open() !== "beat1") fail(`the start: ${open()}`);
  at("kettleMesa", 2);
  if (open() !== "beat1") fail("beat 1 finished on the wrong floor");
  const p = game.player, lv = p.level;
  const finish = (b) => (b.done.event === "secret" ? events.emit(game, "secret", { id: b.done.id, kind: "history" }) : at(b.done.landmark, b.done.z));
  for (const b of B.slice(0, 6)) finish(b);
  if (open() !== "beat7,beat8") fail(`after beat 6: ${open()}`);
  finish(B[7]);
  if (open() !== "beat7") fail(`after beat 8 first: ${open()}`);
  finish(B[6]);
  if (open() !== "beat9") fail(`after both: ${open()}`);
  p.level = 1;   // beat 10 begun far below its band: the early bonus
  for (const b of B.slice(8)) finish(b);
  p.level = lv;
  const q10 = game.quests.find((q) => q.id === "beat10");
  if (q10?.reward?.xp !== Math.round(CAM.BEAT_XP(B[9].band[0]) * 1.5)) fail(`beat 10's early bonus: ${q10?.reward?.xp}`);
  if (json(beats) !== json([1, 2, 3, 4, 5, 6, 8, 7, 9, 10, 11]) || json(lengthen) !== json([5, 7, 9]) || open() !== "") fail(`beats ${json(beats)}, the Lengthening after ${json(lengthen)}`);
  offB(); offL();
  game.run = keep.run; game.quests = keep.quests; game.state.campaign = keep.campaign;
  stats.campaign = `11 beats as data at their landmarks' floors; the start on the real world gives beat 1 (none on the test world, whose intro stays the parent's); ` +
    `beats done by their events in order, 8 before 7, 9 after both; the Lengthening after beats ${json(lengthen)}; beat 10 begun early ×1.5`;
}
