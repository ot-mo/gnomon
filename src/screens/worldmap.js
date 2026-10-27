// The world map (TECH_DESIGN §4.2 `world`, §5.2; bible §4.1, §4.6; owner WS1) and the wait menu (Z).
//
//   world   O in either view, on a surface zone with no hostile awake within 12 tiles (overworld/travel.js
//           enterWorldMap says why not). Arrows / WASD / the numpad (7 9 1 3 and Home PgUp End PgDn for the
//           diagonals) step a span; a click steps to a span next to you or fast-travels to a farther one you
//           know the way to (the path shows under the pointer); a right click pins or unpins a span. Enter goes
//           down at the edge you came in through, or, when you know sites on the span, asks where (the edge, or
//           a site's entrance: ↑↓ or 1-9, Enter); Esc goes down at the edge (where you stood if you haven't
//           moved). Z waits, F lights or puts out your torch, T tints the spans by tier. A hidden site seen from
//           the road or a span far above your tier asks first: Y / Enter, N / Esc, or a click.
//           Opened to look only (openWorldMap: the journal's Locations tab), the keys move the cursor and Esc
//           closes it.
//   wait    Z in either view or on the world map: until healed, dawn, noon, dusk, midnight, or 1-8 hours
//           (overworld/rest.js rest). ↑↓ / W S / the wheel choose, Enter or a click waits, T keeps the torch
//           lit while you wait (it is snuffed otherwise), Esc closes.
//
//   MODE = "world" · WAIT_MODE = "wait" · openWorldMap(game, { center }) · openWait(game)
import * as S from "../screen.js";
import { registerScreen, pushMode, popMode, syncStack } from "../screens.js";
import { bind, dispatchKey } from "../keys.js";
import { UI, box, modal, list, listKey, listWheel, listAt, at } from "../ui.js";
import { statusFlag } from "../status.js";
import { clockLabel } from "../clock.js";
import { hourSeconds, canStep } from "../overworld/state.js";
import { enterWorldMap, worldStep, fastTravel, leaveWorldMap, answer, toggleTorch } from "../overworld/travel.js";
import { knownSites, pin, unpin, pinsAt } from "../overworld/discovery.js";
import { rest, waitChoices } from "../overworld/rest.js";
import { renderWorld, spanAtCell } from "../overworld/renderWorld.js";

export const MODE = "world";
export const WAIT_MODE = "wait";

export const openWorldMap = (game, { center = null } = {}) => enterWorldMap(game, { viewOnly: true, center });

// --- The world map ---------------------------------------------------------------------------------------------
export const WORLD_MOVES = {
  KeyW: [0, -1], ArrowUp: [0, -1], Numpad8: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], Numpad2: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], Numpad4: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0], Numpad6: [1, 0],
  Numpad7: [-1, -1], Home: [-1, -1], Numpad9: [1, -1], PageUp: [1, -1], Numpad1: [-1, 1], End: [-1, 1], Numpad3: [1, 1], PageDown: [1, 1],
};

// One step, or the cursor's when you are only looking.
function move(game, dx, dy) {
  const trip = game.trip;
  if (!trip) return;
  if (trip.viewOnly) {
    const w = game.run.world, c = trip.cursor || trip;
    trip.cursor = { wx: Math.max(0, Math.min(w.w - 1, c.wx + dx)), wy: Math.max(0, Math.min(w.h - 1, c.wy + dy)) };
    return;
  }
  worldStep(game, dx, dy);
}

// Enter: down at the edge, or ask where when you know sites here.
function goDown(game) {
  const trip = game.trip;
  if (!trip) return;
  if (trip.viewOnly) { leaveWorldMap(game); return; }
  const sites = knownSites(game, trip.wx, trip.wy).filter((s) => s.surface);
  if (!sites.length) { leaveWorldMap(game, { at: "edge" }); return; }
  trip.menu = { sel: 0, items: [{ label: trip.moved ? "at the edge you came in by" : "where you stood", at: "edge" },
                                ...sites.map((s) => ({ label: `at ${s.name}`, at: "site", siteId: s.id }))] };
}

function chooseMenu(game, k) {
  const trip = game.trip, it = trip?.menu?.items[k];
  if (!it) return;
  trip.menu = null;
  leaveWorldMap(game, { at: it.at, siteId: it.siteId });
}

function menuKey(game, code) {
  const m = game.trip.menu, n = m.items.length;
  if (code === "Escape") { game.trip.menu = null; return; }
  const d = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (d && +d[1] <= n) { chooseMenu(game, +d[1] - 1); return; }
  const r = listKey(m, code, n);
  if (r === "select") chooseMenu(game, m.sel);
}

function clickSpan(game, button, s) {
  const trip = game.trip;
  if (!s || !trip) return;
  if (button === 2) {   // a pin of your own, or off again
    const mine = pinsAt(game, s.wx, s.wy).find((p) => !p.secretId);
    if (mine) unpin(game, mine.id); else pin(game, s.wx, s.wy, { label: "Your mark" });
    return;
  }
  if (button !== 0) return;
  if (trip.viewOnly) { trip.cursor = s; return; }
  const dx = s.wx - trip.wx, dy = s.wy - trip.wy;
  if (!dx && !dy) { goDown(game); return; }
  if (Math.max(Math.abs(dx), Math.abs(dy)) === 1 && !canStep(game.run.world, trip, dx, dy)) worldStep(game, dx, dy);
  else fastTravel(game, s);
}

registerScreen(MODE, {
  over: "none", pointer: "unlock",
  draw(game) {
    S.clear();
    if (game.trip && game.run) renderWorld(game);
  },
  // A prompt or the menu takes every key first; otherwise the bindings below.
  key(game, code, repeat) {
    const trip = game.trip;
    if (!trip) { popMode(game); return true; }
    if (trip.busy) return true;
    if (trip.prompt) {
      if (repeat) return true;
      if (code === "KeyY" || code === "Enter" || code === "NumpadEnter") answer(game, true);
      else if (code === "KeyN" || code === "Escape") answer(game, false);
      return true;
    }
    if (trip.menu) { if (!repeat) menuKey(game, code); return true; }
    return false;
  },
  mouse(game, button, cell) {
    const h = at(cell), trip = game.trip;
    if (!trip || trip.busy) return;
    if (h?.key) { dispatchKey(game, h.key, false, ""); return; }
    if (trip.menu) { if (h && h.menu !== undefined) chooseMenu(game, h.menu); else if (button === 2) trip.menu = null; return; }
    if (trip.prompt) return;
    clickSpan(game, button, spanAtCell(cell));
  },
  hover(game, cell) { if (game.trip) game.trip.hover = spanAtCell(cell); },
});

bind(MODE, Object.keys(WORLD_MOVES), (game, code) => move(game, ...WORLD_MOVES[code]), { repeat: true, help: "move" });
bind(MODE, ["Enter", "NumpadEnter"], (game) => goDown(game), { help: "go down" });
bind(MODE, "Escape", (game) => leaveWorldMap(game, { at: "edge" }), { help: "back" });
bind(MODE, "KeyZ", (game) => { if (!game.trip?.viewOnly) openWait(game); }, { help: "wait" });
bind(MODE, "KeyF", (game) => { if (!game.trip?.viewOnly) toggleTorch(game); }, { help: "torch" });
bind(MODE, "KeyT", (game) => { if (game.trip) game.trip.tint = !game.trip.tint; }, { help: "tier tint" });

// O in either view.
const canAct = (game) => !game.paused && !statusFlag(game.player, "noAct");
bind("play", "KeyO", (game) => { game.travel = null; enterWorldMap(game); }, { when: canAct, help: "world map" });

// --- Waiting -------------------------------------------------------------------------------------------------------
export function openWait(game) {
  game.travel = null;
  pushMode(game, WAIT_MODE, { sel: 0, top: 0, keepLit: false });
}
bind("play", "KeyZ", (game) => openWait(game), { when: canAct, help: "wait" });

// The menu's state rides on its stack entry (a check may set game.mode = "wait" directly: then it starts here).
const waitData = (game) => { const top = syncStack(game).at(-1); return (top.data ||= { sel: 0, top: 0, keepLit: false }); };
const hoursOf = (s) => { const h = Math.round((s / hourSeconds()) * 10) / 10; return `${h} hour${h === 1 ? "" : "s"}`; };

function waitNow(game, k) {
  const v = waitData(game), choice = waitChoices(game)[k];
  if (!choice) return;
  popMode(game);
  const r = rest(game, { until: choice.until, keepLit: v.keepLit });
  if (r.why === "hostile" || r.why === "dead") return;
  if (r.why === "encounter") { game.log(`Your rest is cut short after ${hoursOf(r.elapsed)}.`, [255, 200, 120]); return; }
  if (r.elapsed > 0) game.log(`You wait ${hoursOf(r.elapsed)}. It is ${clockLabel(game)}.`, [200, 200, 200]);
  else if (choice.until === "healed") game.log("You're not hurt.", [170, 170, 170]);
}

const ROWS = 3;
registerScreen(WAIT_MODE, {
  draw(game) {
    const v = waitData(game), items = waitChoices(game);
    const m = modal(44, items.length + ROWS + 4);
    box(m.x0, m.y0, m.w, m.h, { title: "Wait" });
    S.text(m.x0 + 2, m.y0 + 1, `It is ${clockLabel(game)}.`, ...UI.dim);
    list(v, { x: m.x0 + 2, y: m.y0 + 2, w: m.w - 4, h: items.length, items: items.map((c) => `Wait ${c.label}`) });
    const torch = `T: torch ${v.keepLit ? "kept lit" : "snuffed"} while you wait`;
    S.text(m.x0 + 2, m.y0 + m.h - 3, torch, ...UI.info);
    S.text(m.x0 + 2, m.y0 + m.h - 2, "Enter: wait · Esc: back", ...UI.help);
  },
  key(game, code, repeat) {
    const v = waitData(game), n = waitChoices(game).length;
    if (code === "Escape" || code === "KeyZ") { if (!repeat) popMode(game); return true; }
    if (code === "KeyT") { if (!repeat) v.keepLit = !v.keepLit; return true; }
    if (repeat && code !== "ArrowUp" && code !== "ArrowDown") return true;
    if (listKey(v, code, n) === "select") waitNow(game, v.sel);
    return true;
  },
  wheel(game, sign) { const v = waitData(game); listWheel(v, sign, waitChoices(game).length); },
  mouse(game, button, cell) {
    const v = waitData(game);
    if (button === 2) { popMode(game); return; }
    const k = listAt(v, cell);
    if (k >= 0) waitNow(game, k);
  },
});
