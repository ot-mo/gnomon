// The light seam: inDark underground is the torch, and under the sky daylight hides ghost planks, ghosts,
// runes and the Gloom Warden (see tests/checks/light.js; the 0C gate's light half).
//   node tools/check-light.mjs
import { installNodeEnv } from "./node-env.mjs";
import { report } from "./report.mjs";

const env = await installNodeEnv();
const { game, startRun } = await import("../src/game.js");
const { render3d } = await import("../src/render3d.js");
const { generateDungeonLevel, legacyParams } = await import("../src/gen/dungeon.js");
const { checkLight } = await import("../tests/checks/light.js");
const dungeonLevel = () => generateDungeonLevel(4242, legacyParams(3, 4242)).seal();
process.exit(report(checkLight({ game, startRun, render3d, frameHash: env.frameHash, dungeonLevel })));
