// Browser entry point: a canvas to draw on, pointer lock for mouse look, and the
// requestAnimationFrame loop. The game itself is in game.js.
import * as S from "./screen.js";
import { canvasBackend } from "./screen-canvas.js";
import { setInputBackend, initInput } from "./input.js";
import { browserInput } from "./input-browser.js";
import { game, inputHandlers, startRun, randomSeed, tick } from "./game.js";
import { FLAGS, TITLE } from "./config.js";

S.setBackend(canvasBackend);
setInputBackend(browserInput);
initInput(inputHandlers);
S.resize();
addEventListener("resize", S.resize);

document.title = TITLE;
window.game = game;   // poke at it from the browser console (game.debug has handy functions)
startRun(FLAGS.seed ?? randomSeed());   // ?seed=N (config.js)

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  tick(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
