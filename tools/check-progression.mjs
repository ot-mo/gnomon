// WS4's check in Node (tests/checks/progression.js through its run(env); owner WS4): character creation and
// progression (4a: point-buy, every genotype × background, levels 1 → 20 through the card, the wizard by keys and
// mouse at 100×30, suggested names, the old game under the legacy set).
//   node tools/check-progression.mjs
import { runChecks } from "./run-check.mjs";
import { parseArgs } from "./node-env.mjs";

process.exit(await runChecks(["progression"], parseArgs()));
