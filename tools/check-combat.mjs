// Combat: d20 hit-chance tables, map/3D parity, the planes, the dark and the core, creatures against
// creatures (see tests/checks/combat.js).
//   node tools/check-combat.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, SRC } from "./node-env.mjs";
import { report } from "./report.mjs";

await installNodeEnv();
const { game, startRun } = await import("../src/game.js");
const { checkCombat } = await import("../tests/checks/combat.js");
const srcFiles = fs.readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith(".js"))
  .map((f) => ({ file: f.split(path.sep).join("/"), text: fs.readFileSync(path.join(SRC, f), "utf8") }));
process.exit(report(checkCombat({ game, startRun, srcFiles })));
