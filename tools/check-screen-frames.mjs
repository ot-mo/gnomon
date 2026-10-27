// Whole frames at 180×56, the HUD and the screens included, against p0-0c (see tests/checks/screen-frames.js).
//   node tools/check-screen-frames.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, seedRandom, ROOT } from "./node-env.mjs";
import { screenFrames, checkScreenFrames } from "../tests/checks/screen-frames.js";
import { report } from "./report.mjs";

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "fixtures", "screen-frames.json"), "utf8"));
const env = await installNodeEnv({ cols: 180, rows: 56 });
const { game, startRun, inputHandlers } = await env.load("game.js");
const { addStatus } = await env.load("status.js");
const rules = await env.load("rules.js");
process.exit(report(checkScreenFrames(screenFrames({ game, startRun, inputHandlers, addStatus, frameHash: env.frameHash, seedRandom, rules }), fixture)));
