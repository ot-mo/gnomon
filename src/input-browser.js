// Browser backend for input.js: keyboard events, mouse buttons, and pointer lock for mouse look.
import { canvas } from "./screen-canvas.js";

const isLocked = () => document.pointerLockElement === canvas;

export const browserInput = {
  canLock: true,
  isLocked,

  lock() {
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});   // refused: pointerlockerror follows (init), and the next click retries
    } catch (e) { /* not supported here: keyboard look still works */ }
  },

  unlock() { if (isLocked()) document.exitPointerLock(); },

  init(handlers, keys) {
    addEventListener("keydown", (e) => {
      if (e.code === "Tab" || e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      keys.add(e.code);
      handlers.onKeyDown?.(e.code, e.repeat, e.key);   // e.key: the character typed, for text fields
    });
    addEventListener("keyup", (e) => keys.delete(e.code));
    addEventListener("blur", () => keys.clear());
    canvas.addEventListener("mousedown", (e) => handlers.onMouseDown?.(e.button, e.clientX, e.clientY));
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    addEventListener("mousemove", (e) => {
      if (isLocked()) handlers.onLook?.(e.movementX, e.movementY);
      else handlers.onHover?.(e.clientX, e.clientY);
    });
    addEventListener("wheel", (e) => handlers.onWheel?.(Math.sign(e.deltaY)), { passive: true });
    document.addEventListener("pointerlockchange", () => handlers.onLockChange?.(isLocked()));
    // A request refused: Esc closing a screen over 3D asks for the lock again, and a browser refuses it once the
    // player took the lock away (Escape is not a user activation). game.js onLockRefused decides.
    document.addEventListener("pointerlockerror", () => handlers.onLockRefused?.());
  },
};
