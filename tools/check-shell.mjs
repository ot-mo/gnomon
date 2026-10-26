// The shell's spine: screens.js, keys.js and ui.js (see tests/checks/shell.js).
//   node tools/check-shell.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, SRC } from "./node-env.mjs";
import { report } from "./report.mjs";

const env = await installNodeEnv({ cols: 100, rows: 30 });
const { game, startRun, inputHandlers } = await import("../src/game.js");
const screens = await import("../src/screens.js");
const keys = await import("../src/keys.js");
const ui = await import("../src/ui.js");
const creatures = await import("../src/creatures.js");
const encounters = await import("../src/content/legacy/encounters.js");
const { makeRng } = await import("../src/rng.js");
const { checkShell } = await import("../tests/checks/shell.js");
const srcFiles = fs.readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith(".js"))
  .map((f) => ({ file: f.split(path.sep).join("/"), text: fs.readFileSync(path.join(SRC, f), "utf8") }));
process.exit(report(checkShell({ game, startRun, inputHandlers, screens, keys, ui, input: env.input, S: env.S, capture: env.capture, srcFiles, creatures, encounters, makeRng })));
