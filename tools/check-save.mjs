// Saves: the codec, the store, snapshot-first saves, write-behind, loading, and the 0D2 gate (save → load →
// identical after the bot's 10-zone session, in this process and in a fresh one). See tests/checks/save.js.
//   node tools/check-save.mjs [--seeds 1,7]      (the gate's seeds besides 1234; default 1 and 7)
//   node tools/check-save.mjs --fresh <store.json> --slot <id> --keys "k1;k2;…"
//       (the gate's fresh process: loads the slot from that store dump into a game that never ran, and prints
//       the digest on a line starting "DIGEST ")
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
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

// The gate's fresh process: the store's contents through a file, the digest back on stdout.
function fresh(dump, slotId, keys) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnomon-save-"));
  const file = path.join(dir, "store.json");
  fs.writeFileSync(file, JSON.stringify(dump));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, "tools", "check-save.mjs"), "--fresh", file, "--slot", slotId, "--keys", keys.join(";")], { cwd: ROOT });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("close", (status) => {
      fs.rmSync(dir, { recursive: true, force: true });
      const line = out.split(/\r?\n/).find((l) => l.startsWith("DIGEST "));
      if (status !== 0 || !line) reject(new Error(`exit ${status}: ${(err || out).slice(-600)}`));
      else resolve(JSON.parse(line.slice(7)));
    });
  });
}

const { runSession } = await import("./bot.mjs");   // (installs the Node environment)
const { game, startRun, inputHandlers } = await import("../src/game.js");
const { checkSave } = await import("../tests/checks/save.js");
const screen = (cols, rows) => installNodeEnv({ cols, rows });   // (the title screen at 100×30, last)
const seeds = args.seeds === undefined ? undefined : String(args.seeds).split(",").filter(Boolean).map(Number);   // the gate's other seeds
process.exit(report(await checkSave({ game, startRun, inputHandlers, runSession, fresh, screen, root: ROOT, seeds })));
