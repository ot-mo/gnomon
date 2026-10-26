// WS6a's check in Node (tests/checks/social.js through its run(env); owner WS6a). A stub that passes until WS6a
// fills the module in.
//   node tools/check-social.mjs [options for the check]
import { runChecks } from "./run-check.mjs";
import { parseArgs } from "./node-env.mjs";

process.exit(await runChecks(["social"], parseArgs()));
