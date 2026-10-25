// Every landmark zone of the test world validates on 5 seeds (with what each landmark promises), the
// ruin's dungeon validates, and 500 random spans validate with navigability ≥ 90% (tests/checks/landmarks.js).
//   node tools/check-landmarks.mjs [--tiles 500]
import { installNodeEnv, parseArgs } from "./node-env.mjs";
import { report } from "./report.mjs";

const args = parseArgs();
await installNodeEnv();
const { checkLandmarks } = await import("../tests/checks/landmarks.js");
process.exit(report(checkLandmarks({ tiles: Number(args.tiles) || 500 })));
