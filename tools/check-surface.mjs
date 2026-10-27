// Surface generation, WS2's acceptance (tests/checks/surface.js through its run(env); owner WS2): 500 real-world
// spans × 3 seeds valid, the world function's slope rule, the apron against the neighbour on 50 pairs a seed,
// liquids, the kept bands of the edge-swap frame, ports, and validateSurface's mutants.
//   node tools/check-surface.mjs [--spans 500] [--pairs 50] [--seeds 1,42,1234] [--budget]
//   --budget holds §6.7's surface budget too (p95 ≤ 60 ms, max ≤ 150 ms): run it alone for that.
import { runChecks } from "./run-check.mjs";
import { parseArgs } from "./node-env.mjs";

process.exit(await runChecks(["surface"], parseArgs()));
