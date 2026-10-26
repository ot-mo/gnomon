// Legacy fights, draw for draw: today's legacy combat against the p0-0b trace (tests/checks/legacyfights.js).
//   node tools/check-legacyfights.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, seedRandom, ROOT } from "./node-env.mjs";
import { playLegacyFights, checkLegacyFights } from "../tests/checks/legacyfights.js";
import { report } from "./report.mjs";

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "fixtures", "legacy-fights.json"), "utf8"));
const env = await installNodeEnv();
const { game, startRun, inputHandlers } = await env.load("game.js");
const { keys } = await env.load("input.js");
const steps = {};
for (const view of ["map", "3d"]) { seedRandom(1); steps[view] = playLegacyFights({ game, startRun, inputHandlers, keys }, view); }
process.exit(report(checkLegacyFights(steps, fixture)));
