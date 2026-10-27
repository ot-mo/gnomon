// WS5's check in Node (tests/checks/items.js through its run(env); owner WS5): the equip/unequip matrix, the implant
// rules, the identify odds, examine from an inspect event, the artifacts and cells in both views, the pack screen, the
// consumable effects held to p0-done, and the inventory in check-screen-frames' 8 states. About 10 s.
//   node tools/check-items.mjs [options for the check]
import { runChecks } from "./run-check.mjs";
import { parseArgs } from "./node-env.mjs";

process.exit(await runChecks(["items"], parseArgs()));
