// WS7's check in Node (tests/checks/story.js through its run(env); owner WS7). A stub that passes until WS7
// fills the module in.
//   node tools/check-story.mjs [options for the check]
import { runChecks } from "./run-check.mjs";
import { parseArgs } from "./node-env.mjs";

process.exit(await runChecks(["story"], parseArgs()));
