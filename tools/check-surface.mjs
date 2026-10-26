// WS2's check in Node (tests/checks/surface.js through its run(env); owner WS2). A stub that passes until WS2
// fills the module in.
//   node tools/check-surface.mjs [options for the check]
import { runChecks } from "./run-check.mjs";
import { parseArgs } from "./node-env.mjs";

process.exit(await runChecks(["surface"], parseArgs()));
