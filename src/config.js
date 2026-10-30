// What the game is called, its version numbers and the flags it was opened with (TECH_DESIGN §1.4, §7.6;
// DECISIONS §2 "Identity").
//
//   GAME_ID = "gnomon"                       storage keys and the IndexedDB name start with it
//   TITLE = "GNOMON"                         the page title
//   VERSION = { save, gen, world }           save: the record shape; gen: generation; world: the fixed map data
//   FLAGS = { seed, silent, debug, quick }   from the URL (?seed=N&silent=1&debug=1&quick=1); in Node every
//                                            flag is off and seed is null
//   storageKey(name) → "gnomon:<name>"       the one way to name a localStorage key
//   parseFlags(search) → FLAGS               (exported for checks)
//   WORLD = "real" | "test"                  the world the browser game's new runs are built on (main.js): GNOMON's
//                                            real world, or with ?world=test the test world (the browser tools'; it
//                                            holds the parent's stack under (0, 0)). Node's checks build on the test
//                                            world whatever this says (game.js)
//   parseWorld(search) → WORLD               (exported for checks)
//
// seed: a whole number > 0, or null (a random one). silent: audio goes into an analyser and a zero-gain
// node, never to the speakers (audio.js). debug and quick: read by the title screen and the tools.
export const GAME_ID = "gnomon";
export const TITLE = "GNOMON";
export const VERSION = Object.freeze({ save: 1, gen: 8, world: 1 });   // gen: world/run.js GEN_VERSION (check-config holds them equal); world bumps when the fixed map data changes

const on = (v) => v !== null && v !== "0" && v.toLowerCase() !== "false" && v.toLowerCase() !== "off";

export function parseFlags(search = "") {
  const q = new URLSearchParams(search);
  const seed = parseInt(q.get("seed"), 10);
  return Object.freeze({ seed: seed > 0 ? seed : null, silent: on(q.get("silent")), debug: on(q.get("debug")), quick: on(q.get("quick")) });
}

const SEARCH = typeof location !== "undefined" && typeof location.search === "string" ? location.search : "";
export const FLAGS = parseFlags(SEARCH);

// (Its own export, not a FLAGS field: P0's check-config holds FLAGS to its four flags.)
export const parseWorld = (search = "") => (new URLSearchParams(search).get("world") === "test" ? "test" : "real");
export const WORLD = parseWorld(SEARCH);

export const storageKey = (name) => `${GAME_ID}:${name}`;
