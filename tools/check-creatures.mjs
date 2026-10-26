// Creatures: one list, the glyph registry, spawning, ids, who is who, and the flat and ghost talk rules
// (see tests/checks/creatures.js).
//   node tools/check-creatures.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, SRC } from "./node-env.mjs";
import { report } from "./report.mjs";

await installNodeEnv();
const { game, startRun } = await import("../src/game.js");
const { checkCreatures } = await import("../tests/checks/creatures.js");
const srcFiles = fs.readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith(".js"))
  .map((f) => ({ file: f.split(path.sep).join("/"), text: fs.readFileSync(path.join(SRC, f), "utf8") }));
process.exit(report(checkCreatures({ game, startRun, srcFiles })));
