// The world map's drawing (TECH_DESIGN §5.2 "Viewport"; bible §4.1, §4.2; WS1). Called by the `world` screen
// (screens/worldmap.js). Draws only: it reads game.trip and game.state.atlas and changes neither.
//
//   renderWorld(game)        each span two cells wide (its glyph, then a road or river running east, a pin, or a
//                            step of the fast-travel path under the pointer); the view follows the cursor (the
//                            span under the pointer, else you) by the zone map's pickOrigin rule, so a world wider
//                            than the screen scrolls. The info panel sits on the right, 40 columns wide, when the
//                            screen has 2·w + 42 columns, else in a 6-row strip at the bottom. Header: the date,
//                            the span, the lamp; footer: the keys, each a button. A prompt or the "go down where?"
//                            menu is drawn over it all.
//   worldView                where the last frame put things: { x0, y0, viewW, viewH, sx0, sy0, w, h, panel, keys }
//   spanAtCell(cell) → { wx, wy } | null      which span of the world a screen cell shows (the mouse; null in a margin)
//   spanLines(game, wx, wy) → [{ text, color }]   the info panel's lines for a span
//   FOOTER                   [label, code]: the footer's buttons
//
// Looks: terrain glyphs and colours from the world's terrains; spans you haven't been to are dimmer, the whole
// map darker at night; T tints every span by its tier against yours (green below, yellow at, orange one above,
// red two or more above). You are @; a known landmark is its initial in gold; a known site its kind's mark.
import * as S from "../screen.js";
import { UI, box, hit, wrap, modal } from "../ui.js";
import { clockLabel, isNight } from "../clock.js";
import { levelOfTier } from "../world/worldmodel.js";
import { formatFunds } from "../currency.js";
import { spanKey, playerTier, canStep, edgeBetween } from "./state.js";
import { isKnown, knownSites, pinsAt } from "./discovery.js";
import { isLost, lostChance } from "./lost.js";
import { encounterChance } from "./encounters.js";
import { stepHours, travelPath } from "./travel.js";

export const worldView = { x0: 0, y0: 1, viewW: 0, viewH: 0, sx0: 0, sy0: 0, w: 0, h: 0, panel: "right", keys: [] };
export const PANEL_W = 40, STRIP_H = 6;
export const SITE_MARK = { village: "⌂", ruin: "∩", lair: "Ω", historic: "†", station: "¤", dungeon: "¤" };
const ROAD = [172, 162, 142], RIVER = [90, 150, 200], PIN = [255, 220, 90], GOLD = [255, 210, 110], YOU = [255, 255, 255];
const TIER_TINT = [[110, 200, 110], [230, 220, 110], [240, 160, 80], [230, 80, 70]];

export const FOOTER = [["Enter: go down", "Enter"], ["Z: wait", "KeyZ"], ["F: torch", "KeyF"], ["T: tiers", "KeyT"], ["Esc: back", "Escape"]];
const FOOTER_VIEW = [["T: tiers", "KeyT"], ["Esc: close", "Escape"]];

const scale = (c, k) => c.map((v) => Math.round(v * k));
const initial = (name) => (/[A-Z]/.exec(String(name).replace(/^the /i, "")) || [String(name)[0]?.toUpperCase() || "?"])[0];

export function spanAtCell(cell) {
  const v = worldView;
  if (!cell) return null;
  const sx = Math.floor((cell.x - v.x0) / 2), sy = cell.y - v.y0;
  if (sx < 0 || sy < 0 || sx >= v.viewW || sy >= v.viewH) return null;
  const wx = v.sx0 + sx, wy = v.sy0 + sy;   // (a world narrower than the view sits in a margin: no span there)
  return wx >= 0 && wy >= 0 && wx < v.w && wy < v.h ? { wx, wy } : null;
}

// travelPath is a Dijkstra over every span: kept while you stand still and know no new span.
let memo = { key: "", path: null };
function pathTo(game, from, to) {
  const key = `${game.run.seed}|${from.wx},${from.wy}|${to.wx},${to.wy}|${Object.keys(game.state.atlas?.visited || {}).length}`;
  if (memo.key !== key) memo = { key, path: travelPath(game, from, to) };
  return memo.path;
}

const pickOrigin = (size, view, at) => (size <= view ? -Math.floor((view - size) / 2) : Math.max(0, Math.min(size - view, Math.floor(at - view / 2))));

function danger(game, t) {
  const d = t.tier - playerTier(game);
  return d <= -1 ? ["below you", TIER_TINT[0]] : d === 0 ? ["about your match", TIER_TINT[1]] : d === 1 ? ["risky", TIER_TINT[2]] : ["deadly for you", TIER_TINT[3]];
}

// The panel's lines for one span (the cursor's, else yours).
export function spanLines(game, wx, wy) {
  const world = game.run.world, t = world.tileAt(wx, wy), trip = game.trip, out = [];
  if (!t) return out;
  const T = world.terrains[t.terrain] || {}, R = world.regions?.[t.region];
  const line = (text, color = UI.text) => out.push({ text, color });
  line(`(${wx}, ${wy}) ${T.name || t.terrain}`, UI.title);
  if (R?.name && R.name !== T.name) line(R.name, UI.dim);
  const [d, dc] = danger(game, t);
  line(`Tier ${t.tier}, level ${levelOfTier(t.tier)}: ${d}`, dc);
  const A = game.state.atlas || {}, k = spanKey(wx, wy);
  line(A.visited?.[k] !== undefined ? "You have been here." : isKnown(game, wx, wy) ? "Known, not visited." : "Not visited.", UI.dim);
  if (t.travel === "no") line("Walk-in only: no travel onto it.", UI.bad);
  else if (t.travel === "road") line("Only along a road or a river.", UI.dim);
  else if (t.travel === "drop") line("The world map can't hold it: you walk it.", UI.dim);
  if (trip && !trip.viewOnly && (wx !== trip.wx || wy !== trip.wy)) {
    const dx = wx - trip.wx, dy = wy - trip.wy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) === 1 && !canStep(world, trip, dx, dy)) {
      const e = edgeBetween(world, trip, { wx, wy }), h = stepHours(game, trip, { wx, wy }, e);
      const lost = Math.round(100 * lostChance(game, { wx, wy }, e)), enc = Math.round(100 * encounterChance(game, t));
      line(`A step: ${fmtHours(h)}; lost ${lost}%, encounter ${enc}%.`);
    } else {
      const path = pathTo(game, trip, { wx, wy });
      if (path) {
        let h = 0, from = trip;
        for (const s of path) { h += stepHours(game, from, s); from = s; }
        line(`Fast travel: ${fmtHours(h)}, ${path.length} span${path.length > 1 ? "s" : ""}.`);
      } else line("No way you know of by road, river or places you've been.", UI.dim);
    }
  }
  for (const s of knownSites(game, wx, wy)) line(`${s.kind === "landmark" ? initial(s.name) : SITE_MARK[s.kind] || "*"} ${s.name}`, s.kind === "landmark" ? GOLD : UI.sel);
  for (const p of pinsAt(game, wx, wy)) if (p.label) line(`! ${p.label}`, PIN);
  if (R?.line) line(R.line, UI.dim);   // (the region's one sentence for a span, bible §2.1 rule 8; last, so it never pushes a site or pin out of the strip; integrator, C1a #4)
  return out;
}

const fmtHours = (h) => { const r = Math.round(h * 10) / 10; return `${r} hour${r === 1 ? "" : "s"}`; };

export function renderWorld(game) {
  const world = game.run.world, trip = game.trip, A = game.state.atlas || {}, p = game.player;
  const viewOnly = !!trip?.viewOnly;
  const right = S.cols >= 2 * world.w + PANEL_W + 2;
  const footer = viewOnly ? FOOTER_VIEW : FOOTER;
  const top = 1, footRows = 1;
  const mapW = right ? S.cols - PANEL_W - 1 : S.cols, mapH = S.rows - top - footRows - (right ? 0 : STRIP_H);
  const viewW = Math.max(1, Math.floor(mapW / 2)), viewH = Math.max(1, mapH);
  const at = trip?.cursor || trip || { wx: game.zone?.wx ?? 0, wy: game.zone?.wy ?? 0 };
  const sx0 = pickOrigin(world.w, viewW, at.wx), sy0 = pickOrigin(world.h, viewH, at.wy);
  Object.assign(worldView, { x0: 0, y0: top, viewW, viewH, sx0, sy0, w: world.w, h: world.h, panel: right ? "right" : "strip", keys: footer });

  // Header.
  const lamp = p.torch ? "torch lit" : "torch out";
  const head = `World map · ${clockLabel(game)} · ${lamp} · ${formatFunds(p)}${isLost(game) ? " · lost" : ""}${viewOnly ? " · looking" : ""}`;
  S.text(1, 0, head.slice(0, S.cols - 2), ...UI.title);

  // Spans.
  const night = isNight(game) ? 0.6 : 1, tint = !!trip?.tint, me = playerTier(game);
  const hover = trip?.hover;
  const path = hover && trip && !trip.viewOnly && Math.max(Math.abs(hover.wx - trip.wx), Math.abs(hover.wy - trip.wy)) > 1 ? pathTo(game, trip, hover) : null;
  const onPath = new Set((path || []).map((s) => spanKey(s.wx, s.wy)));
  const pinned = new Set(Object.values(A.pins || {}).map((q) => spanKey(q.wx, q.wy)));   // (once a frame, not a span)
  const withSites = game.run.sitesAt || new Map();
  for (let sy = 0; sy < viewH; sy++)
    for (let sx = 0; sx < viewW; sx++) {
      const wx = sx0 + sx, wy = sy0 + sy, t = world.tileAt(wx, wy);
      if (!t) continue;
      const x = sx * 2, y = top + sy, k = spanKey(wx, wy), T = world.terrains[t.terrain] || {};
      const visited = A.visited?.[k] !== undefined;
      let ch = T.glyph || "?", col = T.color || UI.text;
      if (t.terrain !== "road" && t.roadWidth > 0) { ch = ":"; col = ROAD; }
      else if (t.terrain !== "river" && t.riverWidth > 0) { ch = "\""; col = RIVER; }
      const known = withSites.has(k) ? knownSites(game, wx, wy) : [];
      const lm = known.find((s) => s.kind === "landmark"), site = known.find((s) => s.kind !== "landmark");
      if (lm) { ch = initial(lm.name); col = GOLD; }
      else if (site) { ch = SITE_MARK[site.kind] || "*"; col = UI.sel; }
      if (tint) col = TIER_TINT[Math.max(0, Math.min(3, t.tier - me + 1))];
      else col = scale(col, (visited ? 1 : 0.72) * night);
      if (trip && wx === trip.wx && wy === trip.wy) { ch = "@"; col = YOU; }
      S.put(x, y, ch, ...col);
      let c2 = " ", col2 = col;
      if (pinned.has(k)) { c2 = "!"; col2 = PIN; }
      else if (onPath.has(k)) { c2 = "·"; col2 = UI.cursor; }
      else if (t.road.e) { c2 = "-"; col2 = scale(ROAD, night); }
      else if (t.river.e) { c2 = "~"; col2 = scale(RIVER, night); }
      S.put(x + 1, y, c2, ...col2);
    }
  const cur = hover || trip?.cursor;
  if (cur && cur.wx >= sx0 && cur.wy >= sy0 && cur.wx < sx0 + viewW && cur.wy < sy0 + viewH) {
    const x = (cur.wx - sx0) * 2, y = top + cur.wy - sy0;
    if (x > 0) S.put(x - 1, y, "[", ...UI.cursor);
    S.put(x + 1, y, "]", ...UI.cursor);
  }

  // The info panel: the span under the cursor, else yours.
  const info = cur || trip || at;
  const lines = spanLines(game, info.wx, info.wy);
  if (right) {
    const px = S.cols - PANEL_W;
    box(px - 1, top, PANEL_W + 1, S.rows - top - footRows, { rules: true });
    let y = top + 1;
    for (const l of lines) for (const w of wrap(l.text, PANEL_W - 2)) { if (y < S.rows - footRows - 1) S.text(px + 1, y++, w, ...l.color); }
    if (!viewOnly && y < S.rows - footRows - 2) { y++; S.text(px + 1, y, `You: level ${p.level || 1}, tier ${playerTier(game)}`.slice(0, PANEL_W - 2), ...UI.dim); }
  } else {
    const y0 = S.rows - footRows - STRIP_H;
    for (let x = 0; x < S.cols; x++) S.put(x, y0, "-", ...UI.edge);
    const flat = [];
    for (const l of lines) for (const w of wrap(l.text, S.cols - 2)) flat.push({ text: w, color: l.color });
    flat.slice(0, STRIP_H - 1).forEach((l, k) => S.text(1, y0 + 1 + k, l.text, ...l.color));
  }

  // Footer: the keys, each a button.
  let fx = 1;
  const fy = S.rows - 1;
  for (const [label, code] of footer) {
    if (fx + label.length >= S.cols) break;
    S.text(fx, fy, label, ...UI.help);
    hit({ x: fx, y: fy, w: label.length, h: 1 }, { key: code });
    fx += label.length + 3;
  }

  // A prompt, or the menu of where to go down.
  if (trip?.prompt) drawPrompt(trip.prompt.line, [["Y: yes", "KeyY"], ["N: no", "KeyN"]]);
  else if (trip?.menu) drawMenu(trip.menu);
}

function drawPrompt(text, buttons) {
  const lines = wrap(text, 44);
  const m = modal(50, lines.length + 4);
  box(m.x0, m.y0, m.w, m.h);
  lines.forEach((l, k) => S.text(m.x0 + 3, m.y0 + 1 + k, l, ...UI.text));
  let x = m.x0 + 3;
  const y = m.y0 + m.h - 2;
  for (const [label, code] of buttons) { S.text(x, y, label, ...UI.sel); hit({ x, y, w: label.length, h: 1 }, { key: code }); x += label.length + 4; }
}

function drawMenu(menu) {
  const m = modal(50, menu.items.length + 4);
  box(m.x0, m.y0, m.w, m.h, { title: "Go down where?" });
  menu.items.forEach((it, k) => {
    const y = m.y0 + 2 + k, sel = k === menu.sel, label = `${k + 1}. ${it.label}`.slice(0, m.w - 6);
    S.text(m.x0 + 2, y, `${sel ? ">" : " "} ${label}`, ...(sel ? UI.sel : UI.text));
    hit({ x: m.x0 + 2, y, w: m.w - 4, h: 1 }, { menu: k });
  });
}

