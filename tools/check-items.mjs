// WS5's check in Node (tests/checks/items.js through its run(env); owner WS5). A stub that passes until WS5
// fills the module in.
//   node tools/check-items.mjs [options for the check]
import { runChecks } from "./run-check.mjs";
import { parseArgs } from "./node-env.mjs";

process.exit(await runChecks(["items"], parseArgs()));
