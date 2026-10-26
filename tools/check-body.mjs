// Bodies and the item kind registry (see tests/checks/body.js).
//   node tools/check-body.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, SRC } from "./node-env.mjs";
import { report } from "./report.mjs";

await installNodeEnv();
const { game, startRun } = await import("../src/game.js");
const inventory = await import("../src/inventory.js");
const { checkBody } = await import("../tests/checks/body.js");
const srcFiles = fs.readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith(".js"))
  .map((f) => ({ file: f.split(path.sep).join("/"), text: fs.readFileSync(path.join(SRC, f), "utf8") }));
process.exit(report(checkBody({ game, startRun, inventory, srcFiles })));
