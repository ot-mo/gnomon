// WS4's check in Node (tests/checks/progression.js through its run(env); owner WS4). A stub that passes until WS4
// fills the module in.
//   node tools/check-progression.mjs [options for the check]
import { runChecks } from "./run-check.mjs";
import { parseArgs } from "./node-env.mjs";

process.exit(await runChecks(["progression"], parseArgs()));
