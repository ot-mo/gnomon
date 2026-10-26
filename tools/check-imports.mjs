// Every module loads on its own, and the Phase 1 stubs keep their frozen signatures and register nothing (0D2;
// see tests/checks/imports.js). tools/browser-0d2.mjs does the browser half.
//   node tools/check-imports.mjs
import { runChecks } from "./run-check.mjs";
import { parseArgs } from "./node-env.mjs";

process.exit(await runChecks(["imports"], parseArgs()));
