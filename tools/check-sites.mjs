// Every site of both worlds × every level × 5 seeds validates (its dungeon levels and its surface); history's
// two site requests are built (floors, names, leaning, murals, the relic and true-marks at the bottom); a legend
// lives in exactly one zone, and a killed one never returns (tests/checks/dungeons.js).
//   node tools/check-sites.mjs [--seeds 1,7,42,1234,31337]
import { installNodeEnv, parseArgs } from "./node-env.mjs";
import { report } from "./report.mjs";

const args = parseArgs();
await installNodeEnv();
const { checkSites, checkHistoric, checkLegends } = await import("../tests/checks/dungeons.js");
const seeds = args.seeds ? String(args.seeds).split(",").map(Number) : undefined;
const a = report(checkSites({ seeds }));
const b = report(checkHistoric({ seeds }));
const c = report(await checkLegends());
process.exit(a || b || c);
