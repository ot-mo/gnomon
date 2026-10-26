// Records the legacy-fights fixture (tests/checks/legacyfights.js) from another tree's src: the p0-0b
// tree, the last before 0C moved combat. Never run it against today's src to "fix" a failing check.
//   git archive p0-0b src | tar -x -C /tmp/p0-0b
//   node tools/legacy-fights-record.mjs --src /tmp/p0-0b/src [--out tests/fixtures/legacy-fights.json]
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, seedRandom, parseArgs, ROOT } from "./node-env.mjs";
import { playLegacyFights } from "../tests/checks/legacyfights.js";

const args = parseArgs();
if (!args.src) { console.error("--src <a tree's src directory> is required"); process.exit(2); }
const out = args.out || path.join(ROOT, "tests", "fixtures", "legacy-fights.json");
const env = await installNodeEnv({ srcDir: path.resolve(String(args.src)) });
const { game, startRun, inputHandlers } = await env.load("game.js");
const { keys } = await env.load("input.js");
const steps = {};
for (const view of ["map", "3d"]) { seedRandom(1); steps[view] = playLegacyFights({ game, startRun, inputHandlers, keys }, view); }
fs.writeFileSync(out, JSON.stringify({ from: String(args.from || "p0-0b"), ...steps }) + "\n");
console.log(`legacy fights: map ${steps.map.length} steps, 3d ${steps["3d"].length} steps → ${path.relative(ROOT, out)}`);
