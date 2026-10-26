// Saves: the codec, the store, snapshot-first saves, write-behind, loading, the 0D2 gate (save → load → identical
// after the bot's 10-zone session, in this process and in a fresh one), and WS9's: the 30-zone gate, migrations
// against a save made by p0-done's code, the automatic, unload and checkpoint saves, death, export and import, the
// shell screens and the HUD. See tests/checks/save.js.
//   node tools/check-save.mjs [--seeds 1,7] [--v1-from p0-done | none]
//       (the gate's seeds besides 1234, default 1 and 7; the tree whose code makes section 10's v1 save, by git archive)
//   node tools/check-save.mjs --fresh <store.json> --slot <id> --keys "k1;k2;…"
//       (the gate's fresh process: loads the slot from that store dump into a game that never ran, and prints
//       the digest on a line starting "DIGEST ")
//   node tools/check-save.mjs --v1 <src dir>     (a save made by the tree at <src dir>: "V1 { dump, slotId, keys, digest }")
//   node tools/check-save.mjs --debug-hud on|off (the HUD's segments with and without ?debug=1: "DEBUG { ids, text }")
//   NODE_PATH="$(npm root -g)" node tools/check-save.mjs --browser [--port 8649]   (the browser half: below; not run by run-all)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { installNodeEnv, parseArgs, ROOT } from "./node-env.mjs";
import { report } from "./report.mjs";

const args = parseArgs();

if (args.fresh) {
  await installNodeEnv();
  const { game } = await import("../src/game.js");
  const { loadGame, memoryAdapter } = await import("../src/save/index.js");
  const { RUN_STATS } = await import("../src/world/run.js");
  const { entityCounter } = await import("../src/ids.js");
  const { digestGame } = await import("../tests/checks/save.js");
  const store = memoryAdapter({ from: JSON.parse(fs.readFileSync(String(args.fresh), "utf8")) });
  const builds = RUN_STATS.builds;
  await loadGame(String(args.slot), { store });
  const out = await digestGame(game, String(args.keys).split(";"));
  const n = entityCounter(), idProblems = [];
  for (const z of game.zones.values()) for (const c of z.creatures) if (!(c.id < n)) idProblems.push(`${z.key} creature id ${c.id} ≥ counter ${n}`);
  console.log(`DIGEST ${JSON.stringify({ ...out, builds: RUN_STATS.builds - builds, idProblems })}`);
  process.exit(0);
}

// Section 10's v1 save, made by another tree's own code (its game, its save, its codec): the temple, two levels down
// with a few steps on level 1, saved there; the digest as tests/checks/save.js digestGame makes it.
if (args.v1) {
  const env = await installNodeEnv({ srcDir: path.resolve(String(args.v1)) });
  const { game, startRun } = await env.load("game.js");
  const save = await env.load("save/index.js"), codec = await env.load("save/codec.js");
  const { serializeRun } = await env.load("world/run.js"), { getIds } = await env.load("ids.js"), { cachedZone } = await env.load("zones.js");
  const map = () => { game.view = "map"; game.mode = "map"; game.paused = false; game.modeStack = []; };
  startRun(1234);
  game.pages = null; game.pendingPages = null; game.story.cube = true; map();
  game.debug.enterZone("0,0,1", "down"); map();
  for (const k of ["KeyD", "KeyS", "Space"]) game.debug.mapKey(k);
  game.debug.enterZone("0,0,2", "down"); map();
  const st = save.memoryAdapter(), m = await save.saveGame(game, { store: st });
  await save.whenWritten(game);
  const keys = [...game.zones.keys()].filter((k) => k === game.zone.key || game.state.zoneLeft[k] !== undefined).sort();
  const digest = { state: codec.canonicalJson(game.state), player: codec.canonicalJson(codec.encodePlayer(game.player)),
                   run: codec.canonicalJson(serializeRun(game.run)), ids: codec.canonicalJson(getIds()), zones: {} };
  for (const k of keys)
    digest.zones[k] = codec.canonicalJson({ ...(await codec.encodeZone(cachedZone(game, k), {}, { deflate: false })), slot: null, savedAt: 0, ids: null, cp: null, v: null });
  console.log(`V1 ${JSON.stringify({ dump: st.dump(), slotId: m.id, keys, digest })}`);
  process.exit(0);
}

// Section 18's ?debug=1: the flag is read from the URL when config.js loads, so a process of its own.
if (args["debug-hud"]) {
  globalThis.location = { search: args["debug-hud"] === "off" ? "" : "?debug=1" };
  await installNodeEnv({ cols: 180, rows: 56 });
  const { game, startRun } = await import("../src/game.js");
  const hud = await import("../src/hud.js");
  startRun(7);
  game.pages = null; game.view = "map"; game.mode = "map"; game.modeStack = [];
  const text = hud.layoutHud(game).rows.flat().filter((q) => q.id === "debug").map((q) => q.text).join("");
  console.log(`DEBUG ${JSON.stringify({ ids: hud.hudSegments(), text })}`);
  process.exit(0);
}

// --browser: WS9's browser acceptance in headless Chromium (Playwright, which the repository doesn't depend on:
// NODE_PATH="$(npm root -g)"), the repository served by tools/serve.mjs on --port (8649), audio muted (?silent=1, and
// an init script that sends anything connected to the speakers into an analyser and a zero-gain node). One browser
// context, so its IndexedDB lasts across reloads and pages:
//   1. a new game saves itself into IndexedDB; the page reloaded (pagehide: the unload save), Continue: the same tile
//   2. the renderer crashed (no pagehide): the title warns, and Continue counts the unclean exit
//   3. One Wick: death deletes the slot (a grave written), the recap a second on, T to the title: no Continue
//   4. the Commons Lamp: checkpoints at the start and on leaving the temple, death, C: woken at the second
//   5. Load a save → X downloads the slot's file; Import a save takes it back (a second slot)
//   6. ?debug=1: the HUD's debug line;  7. the IndexedDB adapter itself (tx, abort, keep, clear, writeNow)
// Any page error or console error fails it. The server and the browser are stopped at the end.
if (args.browser) {
  const { createRequire } = await import("node:module");
  let chromium;
  try { ({ chromium } = createRequire(import.meta.url)("playwright")); }
  catch { console.log("check-save --browser: Playwright is not installed (try NODE_PATH=$(npm root -g))"); process.exit(2); }
  const port = Number(args.port) || 8649, base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [path.join(ROOT, "tools", "serve.mjs"), String(port)], { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((ok, no) => { server.stdout.on("data", (d) => { if (/serving/.test(String(d))) ok(); }); server.on("exit", (c) => no(new Error(`serve.mjs exited (${c})`))); });
  const mute = () => {
    const connect = AudioNode.prototype.connect, sinks = new WeakMap();
    window.__rerouted = 0;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (!(dest instanceof AudioDestinationNode)) return connect.call(this, dest, ...rest);
      if (this instanceof GainNode && this.gain.value === 0) return connect.call(this, dest, ...rest);   // a muted sink's own gain
      let s = sinks.get(dest);
      if (!s) {
        const ctx = dest.context, an = ctx.createAnalyser(), g = ctx.createGain();
        g.gain.value = 0;
        connect.call(an, g); connect.call(g, dest);
        sinks.set(dest, s = an);
      }
      window.__rerouted++;
      return connect.call(this, s, ...rest);
    };
  };
  const problems = [], stats = {}, errors = [], notesB = [];
  const fail = (m) => problems.push(m);
  const browser = await chromium.launch();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnomon-browser-"));
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
    await ctx.addInitScript(mute);
    const open = async (q = "") => {
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
      page.on("console", (m) => { if (m.type() === "error") errors.push(`console error: ${m.text()}`); });
      await page.goto(`${base}/index.html?silent=1${q}`);
      await page.waitForFunction(() => window.game?.mode, null, { timeout: 30000 });
      return page;
    };
    const G = (page, fn, arg) => page.evaluate(fn, arg);
    const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout });
    const press = async (page, ...keys) => { for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(80); } };
    const slots = (page) => G(page, async () => (await import("/src/save/index.js")).listSlots());
    const titleReady = (page) => until(page, async () => window.game.mode === "title" && (await import("/src/save/index.js")).currentStore()?.kind === "indexeddb");
    const toLine = async (page, id) => {   // the title's selection onto the line `id`, by ↑ ↓
      const k = await G(page, async (id) => (await import("/src/screens/title.js")).titleItems().findIndex((it) => it.id === id), id);
      if (k < 0) { fail(`the title has no "${id}" line`); return; }
      await press(page, "Home", ...Array(k).fill("ArrowDown"));
    };
    const pastStory = async (page) => { for (let k = 0; k < 30 && (await G(page, () => game.mode)) === "story"; k++) await press(page, "Space"); };
    const where = (page) => G(page, () => ({ key: game.zone?.key, x: game.player?.x, y: game.player?.y, mode: game.mode, slot: game.saving?.slotId, cp: game.saving?.cp,
                                              unclean: game.saving?.unclean, reason: game.saving?.last?.reason }));

    // 1. Save, reload, Continue.
    if (args.verbose) console.log("· 1. Save, reload, Continue");
    let page = await open("&seed=1234");
    await titleReady(page);
    if ((await slots(page)).length) fail("a fresh browser context already has saves");
    await press(page, "Enter");
    await pastStory(page);
    await press(page, "ArrowDown", "ArrowDown", "ArrowRight");
    await page.waitForTimeout(1500);
    const before = await where(page);
    if (before.reason !== "zone" || !before.slot) fail(`the new game's first save: ${JSON.stringify(before)}`);
    await press(page, "ArrowRight");   // a step after the last save: the unload save on reload has it
    const moved = await where(page);
    await page.reload();
    await titleReady(page);
    await until(page, async () => (await import("/src/screens/title.js")).titleItems().some((it) => it.id === "continue"));
    await toLine(page, "continue"); await press(page, "Enter");
    await until(page, () => ["map", "explore", "pause"].includes(window.game.mode) && window.game.zone);
    const after = await where(page);
    if (after.key !== moved.key || after.x !== moved.x || after.y !== moved.y || after.slot !== moved.slot || after.unclean !== 0)
      fail(`reload → Continue: ${JSON.stringify(after)}, left at ${JSON.stringify(moved)}`);
    stats.reload = `a new game saved itself (${before.reason}) into IndexedDB in ${before.key}; one step later the page reloaded; Continue: ${after.key} at ${after.x},${after.y}, the step's tile (the unload save), 0 unclean`;

    // 2. A crash: no pagehide, no unload save.
    if (args.verbose) console.log("· 2. A crash: no pagehide, no unload save");
    await press(page, "ArrowLeft");
    await page.waitForTimeout(200);
    const cdp = await ctx.newCDPSession(page), crashedPage = page.waitForEvent("crash", { timeout: 10000 });
    cdp.send("Page.crash").catch(() => {});   // (it never answers: the renderer is gone)
    await crashedPage;
    page = await open("");
    await titleReady(page);
    await until(page, async () => (await import("/src/screens/title.js")).titleItems().some((it) => it.id === "continue"));
    const warned = await G(page, async () => (await import("/src/screens/title.js")).titleState().warnings.join(" "));
    await toLine(page, "continue"); await press(page, "Enter");
    await until(page, () => ["map", "explore", "pause"].includes(window.game.mode) && window.game.zone);
    await page.waitForTimeout(300);
    const crashed = await where(page), listed = (await slots(page))[0];
    if (!/without a save \(once\), or is still open in another tab/.test(warned) || crashed.unclean !== 1 || listed?.unclean !== 1)
      fail(`after a crash: the title warned "${warned}"; the load's unclean ${crashed.unclean}, the slot's ${listed?.unclean}`);
    stats.crash = `the renderer crashed: the title warned ("${warned}"); Continue counted 1 unclean exit (the slot holds it)`;

    // 3. One Wick's death.
    if (args.verbose) console.log("· 3. One Wick's death");
    await G(page, () => { window.game.hurtPlayer(99999, "a test"); });
    await page.waitForTimeout(1400);
    const gone = await slots(page), graves = await G(page, async () => (await import("/src/save/index.js")).graveyard());
    const recap = await G(page, () => window.game.mode);
    await press(page, "KeyT");
    await titleReady(page);
    const items = await G(page, async () => (await import("/src/screens/title.js")).titleItems().map((it) => it.id));
    if (gone.length || graves[graves.length - 1]?.cause !== "a test" || recap !== "dead" || items.includes("continue"))
      fail(`One Wick's death: slots ${gone.length}, the last grave ${JSON.stringify(graves[graves.length - 1])}, mode ${recap}, the title ${items.join(" ")}`);
    stats.oneWick = `death deleted the slot (0 left) and wrote a grave ("a test", unclean ${graves[graves.length - 1]?.unclean}); T: the title with no Continue`;

    // 4. The Commons Lamp.
    if (args.verbose) console.log("· 4. The Commons Lamp");
    await toLine(page, "mode"); await press(page, "ArrowRight");
    await toLine(page, "new"); await press(page, "Enter");
    await pastStory(page);
    await page.waitForTimeout(1200);
    const cp1 = (await where(page)).cp;
    await G(page, () => { window.game.debug.enterZone("0,0,1", "down"); window.game.mode = "map"; window.game.view = "map"; window.game.modeStack = []; });
    await page.waitForTimeout(1200);
    const atCp = await where(page);
    await G(page, () => { window.game.debug.enterZone("0,0,2", "down"); window.game.mode = "map"; window.game.modeStack = []; });
    await page.waitForTimeout(1200);
    await G(page, () => { window.game.hurtPlayer(99999, "a test"); });
    await page.waitForTimeout(1500);
    await press(page, "KeyC");
    await until(page, () => window.game.mode === "map" && window.game.zone?.key === "0,0,1");
    const woke = await where(page);
    if (cp1 !== 1 || atCp.cp !== 2 || woke.key !== atCp.key || woke.x !== atCp.x || woke.y !== atCp.y)
      fail(`the Commons Lamp: checkpoints ${cp1}, ${atCp.cp}; woke ${JSON.stringify(woke)}, the checkpoint ${JSON.stringify(atCp)}`);
    stats.commonsLamp = `checkpoint ${cp1} at the start, ${atCp.cp} on leaving the temple (${atCp.key} at ${atCp.x},${atCp.y}); died in 0,0,2; C woke in ${woke.key} at ${woke.x},${woke.y}`;

    // 5. Export and import through the title.
    if (args.verbose) console.log("· 5. Export and import through the title");
    await page.reload();
    await titleReady(page);
    await until(page, async () => (await import("/src/screens/title.js")).titleItems().some((it) => it.id === "load"));
    const n0 = (await slots(page)).length;
    await toLine(page, "load"); await press(page, "Enter");
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), press(page, "KeyX")]);
    const file = path.join(dir, download.suggestedFilename());
    await download.saveAs(file);
    await press(page, "Escape");
    await page.bringToFront();
    await toLine(page, "import");
    // (Headless Chromium once in three runs here didn't open the picker for the first Enter: one more try.)
    let chooser = null, tries = 0;
    for (; tries < 2 && !chooser; tries++) [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }).catch(() => null), press(page, "Enter")]);
    if (!chooser) throw new Error("Import a save: no file picker for two presses of Enter");
    if (tries > 1) notesB.push("the import's file picker opened on the second Enter");
    await chooser.setFiles(file);
    await until(page, async (n) => (await (await import("/src/save/index.js")).listSlots()).length === n + 1, n0);
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    stats.exportImport = `Load a save → X downloaded ${download.suggestedFilename()} (${fs.statSync(file).size} B: the slot, ${saved.zones.length} zones, ${saved.checkpointZones.length} copies); Import a save took it back (${n0} → ${n0 + 1} slots)`;
    await page.close();

    // 6. ?debug=1.
    if (args.verbose) console.log("· 6. ?debug=1");
    page = await open("&quick=1&seed=1234&debug=1");
    await until(page, () => window.game.zone);
    const dbg = await G(page, async () => { const h = await import("/src/hud.js"); return { ids: h.hudSegments(), text: h.layoutHud(window.game).rows.flat().filter((q) => q.id === "debug").map((q) => q.text).join("") }; });
    if (!dbg.ids.includes("debug") || !/^0,0,0 /.test(dbg.text)) fail(`?debug=1: ${JSON.stringify(dbg)}`);
    stats.debug = `?debug=1: "${dbg.text}"`;

    // 7. The IndexedDB adapter.
    if (args.verbose) console.log("· 7. The IndexedDB adapter");
    const idb = await G(page, async () => {
      const { idbAdapter } = await import("/src/save/store.js");
      const out = [], a = idbAdapter("gnomon-saves-check");
      const early = await a.writeNow([]).then(() => "wrote", (e) => e.message);
      await a.ready;
      await a.put("slots", { id: "x", deep: { n: 1 } });
      const got = await a.get("slots", "x");
      got.deep.n = 2;
      if ((await a.get("slots", "x")).deep.n !== 1) out.push("get handed out the stored object");
      try { await a.tx(async (t) => { await t.put("slots", { id: "y" }); throw new Error("no"); }); } catch { /* expected */ }
      if (await a.get("slots", "y")) out.push("a tx that threw still wrote");
      await a.writeNow([{ op: "put", store: "zones", value: { slot: "s", key: "1,0,0", cp: 0, n: 1 } }, { op: "put", store: "zones", value: { slot: "s", key: "2,0,0", cp: 2, n: 1 } },
                        { op: "put", store: "zones", value: { slot: "t", key: "1,0,0", cp: 0 } }]);
      await a.writeNow([{ op: "keep", key: ["s", "1,0,0"], epoch: 1 }, { op: "put", store: "zones", value: { slot: "s", key: "1,0,0", cp: 1, n: 2 } },
                        { op: "keep", key: ["s", "2,0,0"], epoch: 1 }]);
      const kept = await a.get("checkpointZones", ["s", "1,0,0"]), notKept = await a.get("checkpointZones", ["s", "2,0,0"]);
      if (kept?.n !== 1 || notKept) out.push(`keep: ${JSON.stringify(kept)}, ${JSON.stringify(notKept)}`);
      if ((await a.list("zones", { slot: "s" })).length !== 2) out.push("list by slot");
      await a.writeNow([{ op: "clear", store: "zones", slot: "s" }]);
      if ((await a.list("zones", { slot: "s" })).length || (await a.list("zones", { slot: "t" })).length !== 1) out.push("clear took the wrong rows");
      a.close();
      await new Promise((r) => { const q = indexedDB.deleteDatabase("gnomon-saves-check"); q.onsuccess = q.onerror = q.onblocked = () => r(); });
      return { out, early };
    });
    if (idb.out.length || !/not open yet/.test(idb.early)) fail(`the IndexedDB adapter: ${idb.out.join("; ")}; writeNow before it opened: ${idb.early}`);
    stats.idb = "copies in and out; a tx that threw wrote nothing; keep copied only the row written before the checkpoint; list by slot; clear took one slot's rows; writeNow refused before the connection opened";
    stats.audio = `?silent=1: only its zero-gain sink reached the speakers (${await G(page, () => window.__rerouted)} other connects had to be rerouted)`;
    await page.close();
  } catch (e) { fail(String(e.stack || e).split(/\r?\n/).slice(0, 4).join(" | ")); }
  finally {
    await browser.close();
    server.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  problems.push(...errors);
  process.exit(report({ name: "save (browser)", ok: !problems.length, problems, stats, notes: notesB }));
}

// A child process of this tool, and its line starting with `tag`.
function childLine(argv, tag) {
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, [path.join(ROOT, "tools", "check-save.mjs"), ...argv], { cwd: ROOT });
    let out = "", err = "";
    c.stdout.on("data", (d) => { out += d; });
    c.stderr.on("data", (d) => { err += d; });
    c.on("close", (status) => {
      const line = out.split(/\r?\n/).find((l) => l.startsWith(tag + " "));
      if (status !== 0 || !line) reject(new Error(`exit ${status}: ${(err || out).slice(-600)}`));
      else resolve(JSON.parse(line.slice(tag.length + 1)));
    });
  });
}

// The gate's fresh process: the store's contents through a file, the digest back on stdout.
function fresh(dump, slotId, keys) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnomon-save-"));
  const file = path.join(dir, "store.json");
  fs.writeFileSync(file, JSON.stringify(dump));
  return childLine(["--fresh", file, "--slot", slotId, "--keys", keys.join(";")], "DIGEST")
    .finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

const v1From = args["v1-from"] === undefined ? "p0-done" : String(args["v1-from"]);
async function v1() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnomon-v1-"));
  try {
    execSync(`git archive ${JSON.stringify(v1From)} src package.json | tar -x -C ${JSON.stringify(dir)}`, { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
    return await childLine(["--v1", path.join(dir, "src")], "V1");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const child = {
  v1: v1From === "none" ? null : v1,
  async debug() {
    const on = await childLine(["--debug-hud", "on"], "DEBUG"), off = await childLine(["--debug-hud", "off"], "DEBUG");
    return { ids: on.ids, text: on.text, off: off.ids };
  },
};

const { runSession } = await import("./bot.mjs");   // (installs the Node environment)
const { game, startRun, inputHandlers } = await import("../src/game.js");
const { checkSave } = await import("../tests/checks/save.js");
const screen = (cols, rows) => installNodeEnv({ cols, rows });   // (the title screen at 100×30, last)
const seeds = args.seeds === undefined ? undefined : String(args.seeds).split(",").filter(Boolean).map(Number);   // the gate's other seeds
process.exit(report(await checkSave({ game, startRun, inputHandlers, runSession, fresh, screen, root: ROOT, seeds, child })));
