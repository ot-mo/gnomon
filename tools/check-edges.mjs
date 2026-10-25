// Zone edges: the seam rules (a)-(e) of TECH_DESIGN §5.1 on every open edge of every landmark span and
// 200 random neighbour pairs on 3 seeds, the apron beside each seam, and arrival over every checked edge
// within ±1 (tests/checks/edges.js).
//   node tools/check-edges.mjs [--pairs 200] [--seeds 1,42,1234] [--real false]
import { parseArgs } from "./node-env.mjs";
import { report } from "./report.mjs";
import { checkEdges } from "../tests/checks/edges.js";

const args = parseArgs();
process.exit(report(checkEdges({
  pairs: args.pairs !== undefined ? Number(args.pairs) : 200,
  seeds: args.seeds ? String(args.seeds).split(",").map(Number) : undefined,
  real: args.real !== "false",
})));
