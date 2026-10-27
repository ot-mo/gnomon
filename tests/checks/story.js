// WS7's check (TECH_DESIGN §8.3 "WS7" acceptance; owner WS7). Part 7a: history, grammar, secrets, murals, gossip,
// the journal. (7b adds villages on every village site for 20 seeds and each quest template completed by events.)
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

const NAME = "story (7a: history, grammar, secrets, murals, gossip, journal)";

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
      counts.lostRelics += h.relics.filter((r) => r.lostAt).length;
      counts.requests += h.siteRequests.length;
      if (seed <= 3 && json(h) !== json(H.generateHistory(seed, real))) fail(`history seed ${seed}: not the same twice`);
      if (seed <= 3 && json(RUN.buildRun(seed, real).history) !== json(h)) fail(`history seed ${seed}: buildRun's isn't generateHistory's`);
    }
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
      `${counts.disagree} disagreeing; ${counts.swept}; ${Object.keys(mutants).length} broken histories refused`;
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
    const FORMS = [/^loc:[\w:,.-]+$/, /^hist:[a-z]+:\d+:(flat|deep|dark)$/, /^hist:noon:[1-6]:(flat|deep|dark)$/, /^gossip:\d+$/];
    let stable = 0, total = 0;
    for (const seed of [1, 42, 1234]) {
      for (const W of [real, test]) {
        const r1 = RUN.buildRun(seed, W), r2 = RUN.buildRun(seed, W);
        const a = SEC.makeSecrets(r1), b = SEC.makeSecrets(r2);
        const c = SEC.makeSecrets(RUN.restoreRun(JSON.parse(json(RUN.serializeRun(r1))), W));
        if (json([...a]) !== json([...b]) || json([...a]) !== json([...c])) fail(`seed ${seed} ${W.id}: the secrets differ between two builds or after a save`);
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
    const { xpToNext } = await env.src("leveling.js");
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
    stats.murals = "a mosaic by a 0.5 s hover and by the look cursor's payload (open: true); a relief in 3D in light, not on the map; " +
      "a mosaic not in 3D; a rune in the dark, not by torchlight; drawing and describing learned nothing";
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
  return { name: NAME, ok: problems.length === 0, problems, stats };
}
