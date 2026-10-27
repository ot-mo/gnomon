// The Rust Steps (bible §4.4, §12.2): red mesas stacked like stairs, ledges and sheer drops; height is everything.
// The world function stacks the mesas (cliffTiers 2) and makes them of clay (sub); dress cuts ramps up their
// faces, onto a ledge and from a ledge onto the mesa above it, with a Rustback heap on a top now and then. The
// map shows one layer (a ramp ends at a wall where the ground is 4 up); 3D shows them all.
import { dress } from "./common.js";

export default function steps(ctx) {
  dress(ctx);
}
