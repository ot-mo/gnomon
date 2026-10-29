// Browser entry point: a canvas to draw on, pointer lock for mouse look, and the
// requestAnimationFrame loop. The game itself is in game.js.
import * as S from "./screen.js";
import { canvasBackend } from "./screen-canvas.js";
import { setInputBackend, initInput } from "./input.js";
import { browserInput } from "./input-browser.js";
import { game, inputHandlers, startRun, randomSeed, tick } from "./game.js";
import "./content/index.js";   // every content file (after game.js, whose graph loads the legacy ones in their order)
import "./features.js";        // every Phase 1 workstream's index (stubs in P0: they register nothing)
import { FLAGS, WORLD, TITLE } from "./config.js";
import { REAL_WORLD } from "./content/world/worldmap.js";
import { useStore, memoryAdapter } from "./save/index.js";
import { openTitle } from "./screens/title.js";

S.setBackend(canvasBackend);
setInputBackend(browserInput);
initInput(inputHandlers);
S.resize();
addEventListener("resize", S.resize);

document.title = TITLE;
window.game = game;   // poke at it from the browser console (game.debug has handy functions)
useStore(memoryAdapter());   // a ?quick=1 game's saves stay in memory (the browser tools); the title opens IndexedDB and moves it there (WS9 #1)
// New games (the title's and ?quick=1's) start on GNOMON's real world, at Hollowmere, whose temple holds the Rotation
// Cube (TECH_DESIGN §8.5's last wiring merge); ?world=test starts them on the test world instead, which the browser
// tools use. A save loads on its own world either way (save.js).
if (WORLD === "real") game.world = REAL_WORLD;
// The title screen (New quick game / Continue), or with ?quick=1 straight into a new quick game (?seed=N).
if (FLAGS.quick) startRun(FLAGS.seed ?? randomSeed());
else openTitle(game);

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  tick(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
