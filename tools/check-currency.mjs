// Money: currency.js and every place the parent game touched gold (see tests/checks/currency.js).
//   node tools/check-currency.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, SRC } from "./node-env.mjs";
import { report } from "./report.mjs";

const env = await installNodeEnv();
const { game, startRun } = await import("../src/game.js");
const dialogue = await import("../src/dialogue.js");
const npcs = await import("../src/npcs.js");
const { checkCurrency } = await import("../tests/checks/currency.js");
const srcFiles = fs.readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith(".js"))
  .map((f) => ({ file: f.split(path.sep).join("/"), text: fs.readFileSync(path.join(SRC, f), "utf8") }));
process.exit(report(checkCurrency({ game, startRun, dialogue, npcs, srcFiles, capture: env.capture })));
