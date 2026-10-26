// The AI, spatial buckets and the factions stub: hooks, buckets against the linear scan, attitude, and
// creatures fighting creatures (see tests/checks/ai.js).
//   node tools/check-ai.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, SRC } from "./node-env.mjs";
import { report } from "./report.mjs";

await installNodeEnv();
const { game, startRun } = await import("../src/game.js");
const { checkAi } = await import("../tests/checks/ai.js");
const srcFiles = fs.readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith(".js"))
  .map((f) => ({ file: f.split(path.sep).join("/"), text: fs.readFileSync(path.join(SRC, f), "utf8") }));
process.exit(report(checkAi({ game, startRun, srcFiles })));
