// Imports, and the Phase 1 stubs held to their frozen signatures (0D2; TECH_DESIGN §8.2 "0D2" gate: "every stub
// module imports cleanly in Node and in the browser"; §1.1 tree, §1.4 "Feature modules", §8.4 owners).
//
//   run(env) → { name, ok, problems, stats, notes }         (tests/checks/index.js's contract; tools/check-imports.mjs)
//   FROZEN    file of src/ → { owner, throws?, neutral?, fns?, data?, mode?, reexports? }: what each stub exports
//
// 1. Every module loads on its own. In Node each module of src/ and tests/checks/ is imported first thing in a
//    process of its own (no other module loaded before it, so an import cycle that only works in one order shows),
//    but for three that need the page (main.js, screen-canvas.js, input-browser.js). In the browser every module of
//    src/ the game and the checks reach (tests/lib/crawl.js) but main.js, every FROZEN file and every check module,
//    in one page (test-world.html has the canvas screen-canvas.js takes); tools/browser-0d2.mjs watches that page's
//    console and boots main.js in index.html. tests/checks/index.js lists each tests/checks/*.js once
//    (Node: against the folder) and every module exports run(), or is node-only there.
// 2. The stubs: every FROZEN file exists and exports what TECH_DESIGN freezes for it (by name; functions are
//    functions). While a file still says STUB = its owner: each `throws` function throws exactly
//    "<name>: not built yet (<owner>)"; each `neutral` function returns its neutral value; a content table is
//    empty; a screen's MODE is registered by nobody; re-exports are the very functions of the module they come
//    from. Every module of src/ that says STUB is in FROZEN, with the same owner. A check stub (tests/checks/<ws>.js
//    with STUB) passes with stats.stub. Once a workstream builds a file it deletes STUB, and only the names stay
//    held.
// 3. Loading registers nothing new: after game.js, each workstream index of src/features.js (in its order) and
//    content/index.js are loaded one at a time, and every registry (screens, key bindings, bus handlers and
//    updates, HUD segments, map overlays and describers, statuses, item kinds, creature types and elites,
//    abilities and their sources, AI hooks, factions, dialogues, talk options, services, bonus sources, body
//    plans, zone generators, site builders, legend handlers, gimmicks, themes, biome builders, currency
//    backings, quest templates) must be the same before and after any of them that is still a STUB.
// 4. The browser sees every module: each module of src/ is reachable from src/main.js or a check module by
//    imports (tests/lib/crawl.js: what the browser's env.srcFiles() reads), unless it is a P0 stub nobody imports
//    yet (listed in the notes). Node only (it needs the folder's listing).
import { crawlImports, importsOf } from "../lib/crawl.js";
import { CHECKS } from "./index.js";

const NAME = "imports (modules load; Phase 1 stubs)";

// The frozen exports (TECH_DESIGN §1.4 "Feature modules" and §2, owners from §8.4). neutral: name → (game, m) →
// [args, expected], m = { rng, currency, items } for the expectations.
export const FROZEN = {
  // WS1 overworld
  "overworld/index.js": { owner: "WS1", fns: ["enterWorldMap", "worldStep", "fastTravel", "leaveWorldMap", "rest", "reveal", "isKnown", "pin", "renderWorld"] },
  "overworld/travel.js": { owner: "WS1", throws: ["enterWorldMap", "worldStep", "fastTravel", "leaveWorldMap"] },
  "overworld/discovery.js": { owner: "WS1", throws: ["reveal", "pin"], neutral: { isKnown: (g) => [[g, 0, 0], false] } },
  "overworld/rest.js": { owner: "WS1", throws: ["rest"] },
  "overworld/renderWorld.js": { owner: "WS1", throws: ["renderWorld"] },
  "overworld/encounters.js": { owner: "WS1" },
  "screens/worldmap.js": { owner: "WS1", mode: "world" },
  "content/encounters.js": { owner: "WS1", data: "ENCOUNTERS" },
  // WS2 surface
  "gen/terrain.js": { owner: "WS2", reexports: { "gen/surface.js": ["heightAt", "treeAt", "worldFns"] } },
  "gen/ports.js": { owner: "WS2", fns: ["edgePorts"], reexports: { "gen/surface.js": ["portsOf"] } },
  "gen/apron.js": { owner: "WS2", reexports: { "gen/surface.js": ["buildApronBand"] } },
  "gen/biomes/index.js": { owner: "WS2", data: "BIOME_BUILDERS" },
  "content/biomes.js": { owner: "WS2", data: "BIOMES" },
  "content/creatures/wildlife.js": { owner: "WS2", data: "WILDLIFE" },
  // WS3 rendering
  "content/moods.js": { owner: "WS3", data: "MOODS" },
  // WS4 progression
  "progression/index.js": { owner: "WS4", fns: ["makeCharacter", "mutationOffers", "gainMutation", "raiseMutation"] },
  "progression/chargen.js": { owner: "WS4", throws: ["makeCharacter"] },
  "progression/mutations.js": { owner: "WS4", throws: ["gainMutation", "raiseMutation"], neutral: { mutationOffers: (g, m) => [[g, g.player, m.rng], []] } },
  "screens/create.js": { owner: "WS4", mode: "create" },
  "screens/charsheet.js": { owner: "WS4", mode: "char" },
  "screens/abilities.js": { owner: "WS4", mode: "abilities" },
  "content/genotypes.js": { owner: "WS4", data: "GENOTYPES" },
  "content/backgrounds.js": { owner: "WS4", data: "BACKGROUNDS" },
  "content/mutations.js": { owner: "WS4", data: "MUTATIONS" },
  "content/powers.js": { owner: "WS4", data: "POWERS" },
  // WS5 body mods
  "bodymods/index.js": { owner: "WS5", fns: ["canInstall", "install", "uninstall", "examineArtifact"] },
  "bodymods/implants.js": { owner: "WS5", throws: ["install", "uninstall"],
    neutral: { canInstall: (g) => [[g, g.player, { kind: "implant", id: "x" }, "head"], { ok: false, reason: "not built yet (WS5)" }] } },
  "bodymods/artifacts.js": { owner: "WS5", throws: ["examineArtifact"] },
  "bodymods/stations.js": { owner: "WS5" },
  "screens/equipment.js": { owner: "WS5" },
  "screens/examine.js": { owner: "WS5", mode: "examine" },
  "content/items/artifacts.js": { owner: "WS5", data: "ARTIFACTS" },
  "content/items/implants.js": { owner: "WS5", data: "IMPLANTS" },
  // WS6a / WS6b social
  "social/index.js": { owner: "WS6a", fns: ["openTrade", "priceOf", "openRitual", "voiceFor", "liquidAt"] },
  "social/reputation.js": { owner: "WS6a" },
  "social/builders.js": { owner: "WS6a" },
  "screens/factions.js": { owner: "WS6a", mode: "factions" },
  "content/factions.js": { owner: "WS6a", data: "FACTIONS" },
  "social/merchants.js": { owner: "WS6b", throws: ["openTrade"],
    neutral: { priceOf: (g, m) => { const it = { kind: "potion", id: "heal" }; return [[g, it, null, "sell"], m.currency.sellPrice(g, g.player, m.items.itemPrice(it))]; } } },
  "social/ritual.js": { owner: "WS6b", throws: ["openRitual"] },
  "social/voices.js": { owner: "WS6b", neutral: { voiceFor: (g) => [[g.zone.creatures[0] || {}], null] } },
  "social/shrines.js": { owner: "WS6b" },
  "social/backings.js": { owner: "WS6b" },
  "social/liquids.js": { owner: "WS6b", neutral: { liquidAt: (g) => [[g.zone, 1, 1], g.zone.liquid || "water"] } },
  "screens/trade.js": { owner: "WS6b", mode: "trade" },
  "screens/ritual.js": { owner: "WS6b", mode: "ritual" },
  "content/liquids.js": { owner: "WS6b", data: "LIQUIDS" },
  "content/items/containers.js": { owner: "WS6b", data: "CONTAINERS" },
  // WS7 story (history.js, villages.js and quests.js are P0's working fixtures, held by name only)
  "story/index.js": { owner: "WS7", fns: ["generateHistory", "generateVillage", "startQuest", "learnSecret", "gossipFor", "expand"] },
  "story/history.js": { owner: "WS7", fns: ["generateHistory"] },
  "story/villages.js": { owner: "WS7", fns: ["generateVillage", "makeVillages"] },
  "story/quests.js": { owner: "WS7", fns: ["startQuest", "registerQuest"] },
  "story/secrets.js": { owner: "WS7", throws: ["learnSecret"] },
  "story/grammar.js": { owner: "WS7", throws: ["expand"] },
  "story/gossip.js": { owner: "WS7", neutral: { gossipFor: (g) => [[g, g.zone.creatures[0] || {}], null] } },
  "story/journal.js": { owner: "WS7" },
  "story/campaign.js": { owner: "WS7" },
  "content/grammar.js": { owner: "WS7", data: "GRAMMAR" },
  "content/quests.js": { owner: "WS7", data: "QUESTS" },
  "content/villages.js": { owner: "WS7", data: "VILLAGES" },
  "content/creatures/villagers.js": { owner: "WS7", data: "VILLAGERS" },
  // WS8 combat
  "missiles.js": { owner: "WS8" },
  "screens/target.js": { owner: "WS8", mode: "target" },
  "content/items/missiles.js": { owner: "WS8", data: "MISSILES" },
  // WS9 persistence and shell (save/ is P0's working skeleton, held by name only)
  "save/index.js": { owner: "WS9", fns: ["saveGame", "loadGame", "listSlots", "deleteSlot", "checkpoint"] },
  "screens/log.js": { owner: "WS9", mode: "log" },
  "screens/options.js": { owner: "WS9", mode: "options" },
  // WS10 dungeon sites
  "content/dungeons.js": { owner: "WS10", data: "DUNGEONS" },
  "content/creatures/legends.js": { owner: "WS10", data: "LEGENDS" },
};

// Every registry a module could add to. Run after game.js has loaded.
export async function registries(src) {
  const m = {};
  for (const f of ["screens", "keys", "events", "hud", "renderMap", "status", "items", "creatures", "abilities", "ai", "factions", "talk",
    "stats", "body", "zones", "currency", "world/sites", "gen/vaults", "gen/dungeon", "gen/biomes/index", "story/quests"]) m[f] = await src(`${f}.js`);
  const keys = (o) => Object.keys(o).sort();
  return {
    screens: [...m.screens.SCREENS.keys()].sort(), keys: m.keys.boundCodes(), bus: m.events.busCounts(),
    hud: m.hud.hudSegments(), overlays: m.renderMap.mapOverlays(), describers: m.renderMap.describers(),
    statuses: keys(m.status.STATUS_DEFS), itemKinds: keys(m.items.ITEM_KINDS),
    creatures: keys(m.creatures.CREATURE_TYPES), elites: keys(m.creatures.ELITES),
    abilities: keys(m.abilities.ABILITIES), abilitySources: m.abilities.abilitySources(), aiHooks: keys(m.ai.AI_HOOKS),
    factions: keys(m.factions.FACTIONS), dialogues: m.talk.dialogueIds(), talkOptions: m.talk.talkOptionIds(),
    services: m.talk.serviceIds(), bonusSources: m.stats.bonusSources(), bodyPlans: keys(m.body.BODY_PLANS),
    zoneGenerators: Object.entries(m.zones.ZONE_GENERATORS).filter(([, f]) => f).map(([k]) => k),
    apronBuilders: Object.entries(m.zones.APRON_BUILDERS).filter(([, f]) => f).map(([k]) => k),
    siteBuilders: keys(m["world/sites"].SITE_BUILDERS), legends: m["gen/vaults"].legendHandlers(),
    gimmicks: keys(m["gen/dungeon"].GIMMICKS), themes: keys(m["gen/dungeon"].DUNGEON_THEMES),
    biomes: keys(m["gen/biomes/index"].BIOME_BUILDERS), backings: m.currency.backingKinds(), quests: m["story/quests"].questIds(),
  };
}

function diffRegistries(a, b) {
  const out = [];
  for (const k of Object.keys(b)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(`${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`.slice(0, 400));
  return out;
}

const json = (v) => JSON.stringify(v);

export async function run(env) {
  const problems = [], notes = [], stats = {};
  const fail = (m) => problems.push(m);
  const read = (p) => env.text(p).then((t) => t, () => null);

  // --- 3 first: what loading the features registers, before anything else loads them --------------------------------
  await env.src("game.js");
  const featuresText = await read("src/features.js");
  const indexes = featuresText ? importsOf(featuresText).map((s) => s.replace(/^\.\//, "")) : [];
  if (!indexes.length) fail("src/features.js lists no workstream index");
  stats.featureIndexes = indexes.length;
  const registered = {};
  for (const file of [...indexes, "content/index.js"]) {
    const before = await registries(env.src);
    const mod = await env.src(file);
    const diff = diffRegistries(before, await registries(env.src));
    registered[file] = diff.length;
    const stub = file === "content/index.js" ? null : mod.STUB;
    if (diff.length && (stub || file === "content/index.js" && await contentStubsOnly(env)))
      fail(`${file}${stub ? ` (still a ${stub} stub)` : " (only stubs added since P0)"} registered something: ${diff.join("; ")}`);
  }
  stats.registeredByIndex = registered;

  // --- 2. The stubs --------------------------------------------------------------------------------------------------
  const scr = await env.screen();
  const { game, startRun } = await env.src("game.js");
  startRun(1234);
  const { SCREENS } = await env.src("screens.js");
  const m = { rng: (await env.src("rng.js")).makeRng(7), currency: await env.src("currency.js"), items: await env.src("items.js") };
  let stubs = 0, built = 0, calls = 0;
  for (const [file, spec] of Object.entries(FROZEN)) {
    let mod;
    try { mod = await env.src(file); } catch (err) { fail(`${file}: doesn't load: ${err.message}`); continue; }
    const isStub = mod.STUB !== undefined;
    if (isStub) stubs++; else built++;
    if (isStub && mod.STUB !== spec.owner) fail(`${file}: STUB says ${mod.STUB}, the owner is ${spec.owner}`);
    for (const name of [...(spec.fns || []), ...(spec.throws || []), ...Object.keys(spec.neutral || {}), ...Object.values(spec.reexports || {}).flat()])
      if (typeof mod[name] !== "function") fail(`${file}: ${name} isn't exported as a function`);
    if (spec.data && (typeof mod[spec.data] !== "object" || mod[spec.data] === null)) fail(`${file}: ${spec.data} isn't exported as a table`);
    if (spec.mode && mod.MODE !== spec.mode) fail(`${file}: MODE is ${json(mod.MODE)}, not "${spec.mode}"`);
    for (const [from, names] of Object.entries(spec.reexports || {})) {
      const src = await env.src(from);
      for (const n of names) if (mod[n] !== src[n]) fail(`${file}: ${n} isn't ${from}'s ${n}`);
    }
    if (!isStub) { if (spec.mode && !SCREENS.has(spec.mode)) notes.push(`${file} is built but registers no "${spec.mode}" screen`); continue; }
    for (const name of spec.throws || []) {
      calls++;
      const want = `${name}: not built yet (${spec.owner})`;
      try { mod[name](game, 0, 0, 0); fail(`${file}: ${name} didn't throw "${want}"`); }
      catch (err) { if (err?.message !== want) fail(`${file}: ${name} threw "${err?.message}", not "${want}"`); }
    }
    for (const [name, make] of Object.entries(spec.neutral || {})) {
      calls++;
      const [args, want] = make(game, m);
      try { const got = mod[name](...args); if (json(got) !== json(want)) fail(`${file}: ${name} gave ${json(got)}, not the neutral ${json(want)}`); }
      catch (err) { fail(`${file}: ${name} threw ${err?.message} instead of a neutral value`); }
    }
    if (spec.data && Object.keys(mod[spec.data] || {}).length) fail(`${file}: ${spec.data} has entries but the file is still a stub`);
    if (spec.mode && SCREENS.has(spec.mode)) fail(`${file}: "${spec.mode}" is registered but the file is still a stub`);
  }
  stats.frozenFiles = Object.keys(FROZEN).length;
  stats.stubs = `${stubs} still stubs, ${built} built (or P0's working code), ${calls} stub calls`;
  stats.screenAfter = `${scr.capture.cols}×${scr.capture.rows}`;

  // Check stubs (tests/checks/<ws>.js) pass with stats.stub; every check module has run() or is node-only.
  const checkStubs = [];
  for (const c of CHECKS) {
    let mod;
    try { mod = await c.load(); } catch (err) { fail(`tests/checks/${c.name}.js doesn't load: ${err.message}`); continue; }
    if (typeof mod.run !== "function" && !c.node) fail(`tests/checks/${c.name}.js has no run(env) and isn't node-only`);
    if (mod.STUB !== undefined) {
      checkStubs.push(c.name);
      const r = await mod.run(env);
      if (!r?.ok || r?.stats?.stub !== true || r.name !== c.name) fail(`tests/checks/${c.name}.js (a ${mod.STUB} stub) gave ${json(r)}`);
      if (mod.STUB !== c.owner) fail(`tests/checks/${c.name}.js: STUB says ${mod.STUB}, the index says ${c.owner}`);
    }
  }
  stats.checkStubs = checkStubs.join(" ");
  if (new Set(CHECKS.map((c) => c.name)).size !== CHECKS.length) fail("tests/checks/index.js lists a check twice");

  // --- 1 and 4: every module, by platform -----------------------------------------------------------------------------
  const seen = (await crawlImports(["src/main.js", "tests/checks/index.js"], read)).filter((f) => f.startsWith("src/")).map((f) => f.slice(4));
  stats.reachable = seen.length;
  if (env.platform === "node") await nodeImports(env, { fail, notes, stats, seen });
  else await browserImports(env, { fail, stats, seen });

  return { name: NAME, ok: problems.length === 0, problems, stats, notes };
}

// content/index.js may register only if something in it is no longer a stub (the legacy files were loaded by game.js).
async function contentStubsOnly(env) {
  for (const [file, spec] of Object.entries(FROZEN))
    if (file.startsWith("content/") && spec.data && (await env.src(file)).STUB === undefined) return false;
  return true;
}

// Node: every module of src/ and tests/checks/ first thing in a process of its own; the folder against the index;
// what the browser can't reach.
async function nodeImports(env, { fail, notes, stats, seen }) {
  const { default: fs } = await import("node:fs"), { default: path } = await import("node:path"), { default: os } = await import("node:os");
  const { spawn } = await import("node:child_process"), { pathToFileURL, fileURLToPath } = await import("node:url");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const list = (dir) => fs.readdirSync(path.join(root, dir), { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => f.split(path.sep).join("/")).sort();
  const srcFiles = list("src"), checkFiles = list("tests/checks");
  const indexed = new Set(CHECKS.map((c) => `${c.name}.js`));
  for (const f of checkFiles) if (f !== "index.js" && !indexed.has(f)) fail(`tests/checks/${f} isn't in tests/checks/index.js`);
  for (const f of indexed) if (!checkFiles.includes(f)) fail(`tests/checks/index.js lists ${f}, which doesn't exist`);
  for (const f of srcFiles) {
    const mod = /\bexport const STUB\b/.test(fs.readFileSync(path.join(root, "src", f), "utf8"));
    if (mod && !FROZEN[f]) fail(`src/${f} says STUB but isn't in FROZEN (tests/checks/imports.js)`);
  }
  for (const f of Object.keys(FROZEN)) if (!srcFiles.includes(f)) fail(`FROZEN names src/${f}, which doesn't exist`);
  const unseen = srcFiles.filter((f) => !seen.includes(f));
  const strayStubs = [];
  for (const f of unseen) {
    if (/\bexport const STUB\b/.test(fs.readFileSync(path.join(root, "src", f), "utf8"))) strayStubs.push(f);
    else fail(`src/${f} is reached from neither src/main.js nor a check module (the browser's env.srcFiles() can't see it)`);
  }
  if (strayStubs.length) notes.push(`P0 stubs nobody imports yet (their owners will): ${strayStubs.join(", ")}`);

  const BROWSER_ONLY = {
    "main.js": "the browser's entry point: it boots the game into the page",
    "screen-canvas.js": "it takes the page's <canvas id=\"screen\"> when it loads",
    "input-browser.js": "it imports screen-canvas.js",
  };
  const files = [...srcFiles.filter((f) => !BROWSER_ONLY[f]).map((f) => path.join(root, "src", f)), ...checkFiles.map((f) => path.join(root, "tests", "checks", f))];
  const load = "import(process.argv[1]).then(() => process.exit(0), (e) => { console.error(e && e.stack || e); process.exit(1); })";
  const one = (file) => new Promise((resolve) => {
    const child = spawn(process.execPath, ["-e", load, pathToFileURL(file).href], { cwd: root });
    let err = "";
    child.stderr.on("data", (d) => { err += d; });
    child.on("close", (status) => resolve(status === 0 ? null : `${path.relative(root, file).split(path.sep).join("/")} doesn't load on its own: ${err.trim().split("\n").slice(0, 3).join(" / ")}`));
  });
  const queue = [...files], jobs = Math.max(2, Math.floor((os.availableParallelism?.() ?? os.cpus().length) / 2));
  const t0 = performance.now();
  await Promise.all(Array.from({ length: jobs }, async () => { while (queue.length) { const p = await one(queue.shift()); if (p) fail(p); } }));
  stats.loadedAlone = `${files.length} modules (${srcFiles.length - Object.keys(BROWSER_ONLY).length} of src/, ${checkFiles.length} of tests/checks/), each in its own process, ${((performance.now() - t0) / 1000).toFixed(1)} s`;
  stats.browserOnly = Object.entries(BROWSER_ONLY).map(([f, why]) => `${f} (${why})`).join("; ");
  stats.srcModules = srcFiles.length;
}

// The browser: every module the game and the checks reach, every FROZEN file and every check module, in this page.
async function browserImports(env, { fail, stats, seen }) {
  const files = [...new Set([...seen.filter((f) => f !== "main.js"), ...Object.keys(FROZEN)])].sort();
  let loaded = 0;
  for (const f of files) { try { await env.src(f); loaded++; } catch (err) { fail(`src/${f} doesn't load: ${err.message}`); } }
  // main.js last, in a page of its own: it boots the game into a canvas.
  stats.loadedInPage = `${loaded} of ${files.length} modules of src/ and ${CHECKS.length} check modules (src/main.js: tools/browser-0d2.mjs opens index.html)`;
}
