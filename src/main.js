// Browser entry point: a canvas to draw on, pointer lock for mouse look, and the
// requestAnimationFrame loop. The game itself is in game.js.
import * as S from "./screen.js";
import { canvasBackend } from "./screen-canvas.js";
import { setInputBackend, initInput } from "./input.js";
import { browserInput } from "./input-browser.js";
import { game, inputHandlers, startRun, randomSeed, tick } from "./game.js";
import { FLAGS, TITLE } from "./config.js";
import { useStore, memoryAdapter } from "./save/index.js";
import { openTitle } from "./screens/title.js";

S.setBackend(canvasBackend);
setInputBackend(browserInput);
initInput(inputHandlers);
S.resize();
addEventListener("resize", S.resize);

document.title = TITLE;
window.game = game;   // poke at it from the browser console (game.debug has handy functions)
useStore(memoryAdapter());   // saves stay in memory (this page only) until WS9's IndexedDB
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
