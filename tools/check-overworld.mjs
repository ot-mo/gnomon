// WS1's check in Node (tests/checks/overworld.js through its run(env); owner WS1): world-map travel on the test
// world and the real one (the random walk, fast travel, arrival edges, bands, rest, lost, discovery, the screen).
//   node tools/check-overworld.mjs [--steps n]       the random walk's steps a world (default 10000)
import { runChecks } from "./run-check.mjs";
import { parseArgs } from "./node-env.mjs";

process.exit(await runChecks(["overworld"], parseArgs()));
