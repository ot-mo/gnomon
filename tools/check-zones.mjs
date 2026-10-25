// The zone core: Zone, zones.js and events.js (see tests/checks/zones.js).
//   node tools/check-zones.mjs
import { installNodeEnv } from "./node-env.mjs";
import { report } from "./report.mjs";

await installNodeEnv();
const { game, startRun } = await import("../src/game.js");
const { checkZones } = await import("../tests/checks/zones.js");
process.exit(report(checkZones({ game, startRun })));
