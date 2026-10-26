// Key bindings (TECH_DESIGN §4.3). A key press goes, in order, to:
//   1. the top screen's key(game, code, repeat, key) (screens.js): a screen with a text field sees every key
//      first, so typing "m" in a name types an m;
//   2. the bindings for the current mode ("play" binds explore and map at once);
//   3. the "*" bindings (M and N: music and sounds), which work in every mode the top screen lets through.
// The first handler that takes the key ends it.
//
//   bind(mode, code, handler, { repeat = false, help = "", when } = {}) → unbind
//        code: a KeyboardEvent.code ("KeyM", "Digit1", "Escape"…) or an array of them.
//        handler(game, code, repeat, key) → false to let the key go on (anything else takes it).
//        repeat: also on auto-repeat. when(game) → bool: the binding is skipped when it says false.
//        Bindings for the same mode and code run in the order bound.
//   dispatchKey(game, code, repeat, key) → bool   key = e.key (the typed character), for text fields
//   helpFor(mode) → [{ code, help }]              the mode's bindings with help text, then "play", then "*"
//   keyLabel(code) → "M", "1", "Esc", "↑"…        how a code is written in help lines
import { screenFor } from "./screens.js";

const BINDINGS = new Map();   // mode → [{ code, handler, repeat, help, when }]

export function bind(mode, code, handler, { repeat = false, help = "", when } = {}) {
  const list = BINDINGS.get(mode) || [];
  const entries = (Array.isArray(code) ? code : [code]).map((c) => ({ code: c, handler, repeat, help, when }));
  list.push(...entries);
  BINDINGS.set(mode, list);
  return () => {
    const l = BINDINGS.get(mode);
    for (const e of entries) { const k = l ? l.indexOf(e) : -1; if (k >= 0) l.splice(k, 1); }
  };
}

const PLAY = new Set(["explore", "map"]);
const groupsFor = (mode) => (PLAY.has(mode) ? [mode, "play", "*"] : [mode, "*"]);

export function dispatchKey(game, code, repeat = false, key = "") {
  const def = screenFor(game.mode);
  if (def?.key && def.key(game, code, repeat, key)) return true;
  for (const group of groupsFor(game.mode)) {
    for (const b of BINDINGS.get(group) || []) {
      if (b.code !== code || (repeat && !b.repeat) || (b.when && !b.when(game))) continue;
      if (b.handler(game, code, repeat, key) !== false) return true;
    }
  }
  return false;
}

export function helpFor(mode) {
  const out = [], seen = new Set();
  for (const group of groupsFor(mode))
    for (const b of BINDINGS.get(group) || []) {
      if (!b.help || seen.has(b.code + "\n" + b.help)) continue;
      seen.add(b.code + "\n" + b.help);
      out.push({ code: b.code, help: b.help });
    }
  return out;
}

const LABELS = {
  Escape: "Esc", Enter: "Enter", NumpadEnter: "Enter", Space: "Space", Tab: "Tab", Backspace: "Backspace",
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", PageUp: "PgUp", PageDown: "PgDn",
  Comma: ",", Period: ".", Slash: "/", Minus: "-", Equal: "=", ShiftLeft: "Shift", ShiftRight: "Shift",
};

export function keyLabel(code) {
  if (LABELS[code]) return LABELS[code];
  const m = /^(?:Key|Digit|Numpad)(.+)$/.exec(code);
  return m ? m[1] : code;
}
