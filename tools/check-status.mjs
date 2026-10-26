// Statuses, bulk time and drowning (see tests/checks/status.js).
//   node tools/check-status.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, SRC } from "./node-env.mjs";
import { report } from "./report.mjs";

await installNodeEnv();
const { game, startRun, inputHandlers } = await import("../src/game.js");
const { checkStatus } = await import("../tests/checks/status.js");
const srcFiles = fs.readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith(".js"))
  .map((f) => ({ file: f.split(path.sep).join("/"), text: fs.readFileSync(path.join(SRC, f), "utf8") }));
process.exit(report(checkStatus({ game, startRun, inputHandlers, srcFiles })));
