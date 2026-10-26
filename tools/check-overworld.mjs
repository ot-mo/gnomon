// WS1's check in Node (tests/checks/overworld.js through its run(env); owner WS1). A stub that passes until WS1
// fills the module in.
//   node tools/check-overworld.mjs [options for the check]
import { runChecks } from "./run-check.mjs";
import { parseArgs } from "./node-env.mjs";

process.exit(await runChecks(["overworld"], parseArgs()));
