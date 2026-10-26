// The torch's glim drain (see tests/checks/torch.js).
//   node tools/check-torch.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, SRC } from "./node-env.mjs";
import { report } from "./report.mjs";

await installNodeEnv();
const { game, startRun } = await import("../src/game.js");
const torch = await import("../src/torch.js");
const clock = await import("../src/clock.js");
const time = await import("../src/time.js");
const turns = await import("../src/turns.js");
const player = await import("../src/player.js");
const light = await import("../src/light.js");
const hud = await import("../src/hud.js");
const currency = await import("../src/currency.js");
const { compileWorld } = await import("../src/world/worldmodel.js");
const { REAL_WORLD } = await import("../src/content/world/worldmap.js");
const { checkTorch } = await import("../tests/checks/torch.js");
const torchSrc = fs.readFileSync(path.join(SRC, "torch.js"), "utf8");
process.exit(report(checkTorch({ game, startRun, torch, clock, time, turns, player, light, hud, currency, compileWorld, REAL_WORLD, torchSrc })));
