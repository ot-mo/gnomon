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
