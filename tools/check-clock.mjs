// The clock: time of day as a view of state.time, its events and skipTime (see tests/checks/clock.js).
//   node tools/check-clock.mjs
import { installNodeEnv } from "./node-env.mjs";
import { report } from "./report.mjs";

await installNodeEnv();
const { game, startRun, attachState } = await import("../src/game.js");
const clock = await import("../src/clock.js");
const events = await import("../src/events.js");
const time = await import("../src/time.js");
const turns = await import("../src/turns.js");
const rules = await import("../src/rules.js");
const { checkClock } = await import("../tests/checks/clock.js");
process.exit(report(checkClock({ game, startRun, attachState, clock, events, time, turns, rules })));
