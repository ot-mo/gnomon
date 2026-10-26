// Records the screen-frames fixture (tests/checks/screen-frames.js) from another tree's src: p0-0c, the
// last tree before 0D1 moved the shell. Never run it against today's src to "fix" a failing check.
//   git archive p0-0c src | tar -x -C /tmp/p0-0c
//   node tools/screen-frames-record.mjs --src /tmp/p0-0c/src [--from p0-0c] [--out tests/fixtures/screen-frames.json]
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, seedRandom, parseArgs, ROOT } from "./node-env.mjs";
import { screenFrames } from "../tests/checks/screen-frames.js";

const args = parseArgs();
if (!args.src) { console.error("--src <a tree's src directory> is required"); process.exit(2); }
const out = args.out || path.join(ROOT, "tests", "fixtures", "screen-frames.json");
const env = await installNodeEnv({ srcDir: path.resolve(String(args.src)), cols: 180, rows: 56 });
const { game, startRun, inputHandlers } = await env.load("game.js");
const { addStatus } = await env.load("status.js");
const frames = screenFrames({ game, startRun, inputHandlers, addStatus, frameHash: env.frameHash, seedRandom });
fs.writeFileSync(out, JSON.stringify({ against: String(args.from || "p0-0c"), frames }, null, 1) + "\n");
console.log(`screen frames: ${frames.length} → ${path.relative(ROOT, out)}`);
