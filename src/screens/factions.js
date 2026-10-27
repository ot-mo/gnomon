// Factions (TECH_DESIGN §4.2 `factions`; owner WS6a): the factions you know, each with its rep bar, its band in the
// bible's light words (Dark, Cold, Grey, Warm, Bright), and for the selected one what it is, whom it likes and
// hates and why, its rite and its sacrament. P in either view opens it (§4.3); P, Esc or a right click closes it;
// ↑↓ / W S / the wheel or a click choose a row. The world waits while it is open, as on the other screens.
//
//   MODE = "factions" · openFactions(game)
//   knownFactions(game) → [id]   the factions you know of, in the content's order: any whose rep has moved
//                                (game.state.rep), any you start away from Grey's zero (your birth told you), and
//                                any whose member you've been within 10 tiles of (game.state.knownFactions,
//                                marked once a second in play). Hidden parent groups never show.
import * as S from "../screen.js";
import { registerScreen, pushMode, popMode } from "../screens.js";
import { bind } from "../keys.js";
import { registerUpdate } from "../events.js";
import { UI, box, modal, wrap, list, listKey, listWheel, listAt, hitLabel, at } from "../ui.js";
import { FACTIONS, repOf, baseRep, band, BAND_NAMES, membershipsOf, REP_MIN, REP_MAX } from "../factions.js";
import { creaturesNear } from "../creatures.js";

export const MODE = "factions";
const SEEN_RANGE = 10;

export function knownFactions(game) {
  const rep = game.state?.rep || {}, seen = game.state?.knownFactions || {};
  return Object.values(FACTIONS).filter((f) => !f.hidden &&
    (rep[f.id] !== undefined || seen[f.id] || baseRep(game, f.id) !== 0)).map((f) => f.id);
}

// Who you've been near (once a second, in either view).
registerUpdate("factions:known", (game) => {
  const p = game.player, zone = game.zone;
  if (!p || !zone || !game.state) return;
  for (const c of creaturesNear(zone, p.x, p.y, SEEN_RANGE))
    for (const [id] of membershipsOf(c)) if (!FACTIONS[id].hidden && !game.state.knownFactions?.[id]) (game.state.knownFactions ||= {})[id] = 1;
}, { modes: ["play"], every: 1 });

export function openFactions(game) {
  game.travel = null;
  game.factionsView = { sel: 0, top: 0 };
  pushMode(game, MODE);
}

const BAND_COLOR = { hated: [200, 80, 80], disliked: [170, 140, 200], indifferent: [175, 175, 185], liked: [240, 200, 110], loved: [255, 245, 200] };

function drawRow(game, id, { x, y, w, sel }) {
  const f = FACTIONS[id], r = repOf(game, id), b = band(r);
  if (sel) S.text(x, y, ">", ...UI.mark);
  S.text(x + 2, y, f.name.slice(0, 22), ...(f.color || UI.text));
  // The bar: −1000 … +1000, with a tick at 0 and the band's light word after it.
  const bw = (Math.max(9, w - 40) - 1) | 1, bx = x + 26;   // odd: as many cells each side of 0
  const at0 = Math.round(((0 - REP_MIN) / (REP_MAX - REP_MIN)) * (bw - 1));
  const atR = Math.round(((r - REP_MIN) / (REP_MAX - REP_MIN)) * (bw - 1));
  for (let k = 0; k < bw; k++) {
    const lit = r >= 0 ? k > at0 && k <= atR : k >= atR && k < at0;
    S.put(bx + k, y, k === at0 ? "|" : lit ? "=" : "·", ...(lit ? BAND_COLOR[b] : k === at0 ? UI.dim : UI.help));
  }
  const tail = `${BAND_NAMES[b].padEnd(6)} ${String(r).padStart(5)}`;
  S.text(bx + bw + 2, y, tail, ...BAND_COLOR[b]);
}

function detail(f) {
  const named = (xs) => xs.map(([id, why]) => (FACTIONS[id] ? FACTIONS[id].name + (why ? `: "${why}"` : "") : null)).filter(Boolean);
  const likes = [...named(f.likes || []), ...(f.likesToo || [])], hates = [...named(f.hates || []), ...(f.hatesToo || [])];
  const out = [[f.about || "", UI.text]];
  if (likes.length) out.push([`Likes ${likes.join("; ")}.`, [150, 200, 140]]);
  if (hates.length) out.push([`Hates ${hates.join("; ")}.`, [215, 140, 120]]);
  const bits = [f.temperament && `${f.temperament}`, f.rite && `rite: ${f.rite}`, f.liquid && `sacrament: ${f.liquid}`].filter(Boolean);
  if (bits.length) out.push([bits.join(" · "), UI.info]);
  return out;
}

export function drawFactions(game) {
  const v = (game.factionsView ||= { sel: 0, top: 0 });
  const ids = knownFactions(game);
  const { x0, y0, w, h } = modal(Math.min(S.cols - 2, 96), Math.min(S.rows - 2, 30));
  box(x0, y0, w, h, { title: " FACTIONS " });
  const rows = Math.max(3, h - 13);
  list(v, { x: x0 + 2, y: y0 + 2, w: w - 4, h: Math.min(rows, Math.max(1, ids.length)), items: ids,
            row: (id, i, cell) => drawRow(game, id, cell), empty: "You know of nobody yet. Walk about; people will find you." });
  const f = FACTIONS[ids[v.sel]];
  if (f) {
    let y = y0 + 3 + Math.min(rows, ids.length);
    S.text(x0 + 2, y, "-".repeat(w - 4), ...UI.help);
    y++;
    for (const [text, color] of detail(f)) for (const line of wrap(text, w - 6)) { if (y < y0 + h - 2) S.text(x0 + 3, y++, line, ...color); }
  }
  const help = { x: x0 + 2, y: y0 + h - 2, text: "↑↓ choose · P or Esc close" };
  S.text(help.x, help.y, help.text, ...UI.help);
  hitLabel(help, "Esc close", { key: "Escape" });
}

function close(game) { if (game.mode === MODE) popMode(game); game.factionsView = null; }

registerScreen(MODE, {
  draw: drawFactions,
  // Its own keys only (held keys don't repeat a close): anything else goes on to the "*" bindings (M, N).
  key(game, code, repeat) {
    if (code === "Escape" || code === "KeyP") { if (!repeat) close(game); return true; }
    return listKey(game.factionsView, code, knownFactions(game).length) !== null;
  },
  mouse(game, button, cell) {
    if (button === 2) { close(game); return; }
    const h = at(cell);
    if (h?.key) { close(game); return; }
    const k = listAt(game.factionsView, cell);
    if (k >= 0) game.factionsView.sel = k;
  },
  hover(game, cell) { const k = listAt(game.factionsView, cell); if (k >= 0) game.factionsView.sel = k; },
  wheel(game, sign) { listWheel(game.factionsView, sign, knownFactions(game).length); },
});

bind("play", "KeyP", (game) => openFactions(game), { help: "factions" });
