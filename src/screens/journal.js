// The journal (J; TECH_DESIGN §4.2 `journal`, owner WS7): tabs Quests · Locations · Histories (n of m known, by date) ·
// Gossip · Notes. J or Esc closes it; Tab, ← → or 1-5 change the tab; ↑ ↓ (W S), PgUp PgDn, Home End and the wheel
// scroll; a click on a tab opens it, a click anywhere else (or any other button) closes the journal. Drawing never changes the game's state.
//
//   openJournal(game)                  J (or a click on "J: journal"): open it over the view you are in
//   JOURNAL_TABS                       the tab names, in order
//   journalLines(game, tab, width) → [[text, rgb]]   a tab's text (for the screen and the checks)
// "Show on the world map" waits for WS1's world map (integration request).
import * as S from "../screen.js";
import { registerScreen, popMode } from "../screens.js";
import { openJournal } from "../dialogue.js";
import { UI, box, wrap, tabs, tabsKey, at } from "../ui.js";
import { mapPercent, questDone } from "../story/quests.js";
import { talkersIn } from "../creatures.js";
import { GRAMMAR } from "../content/grammar.js";
import { journalOf } from "../story/journal.js";
import { secretsOf, secretDef, secretText, secretTitle, READINGS } from "../story/secrets.js";

export { openJournal };
export const JOURNAL_TABS = ["Quests", "Locations", "Histories", "Gossip", "Notes"];

const C = { head: [255, 220, 120], text: [200, 200, 205], dim: [130, 130, 130], done: [120, 170, 125], mark: [120, 220, 200],
            flat: [230, 210, 150], deep: [200, 220, 255], dark: [190, 160, 230] };
const VIEW_WORD = { flat: "map", deep: "3D", dark: "dark" };
const view = (game) => (game.journalView ||= { tab: 0, top: 0 });

export function journalLines(game, tab, width) {
  const L = [], put = (t, c = C.text) => L.push([t, c]), para = (t, c, indent = "") => { for (const l of wrap(t, width - indent.length)) put(indent + l, c); };
  const J = journalOf(game), run = game.run;
  const learned = (kind) => Object.keys(J.secrets).map((id) => secretDef(run, id)).filter((d) => d?.kind === kind);
  if (tab === 0) {   // Quests: the parent's journal, as it was
    const active = game.quests.filter((q) => !q.done && !q.failed), done = game.quests.filter((q) => q.done);
    const failed = game.quests.filter((q) => q.failed && !q.done);
    if (!game.quests.length) put("Nothing yet.", C.dim);
    for (const q of active) {
      put(q.title, C.head);
      para(q.text, C.text, "  ");
      if (q.id === "mira" && talkersIn(game.zone).some((n) => n.talk.dialogue === "mira")) put(`  (This floor: ${mapPercent(game.zone)}% mapped so far.)`, C.mark);
      put("", null);
    }
    if (done.length) put("Done:", [120, 200, 130]);
    for (const q of done) put("  ✓ " + q.title, C.done);
    if (failed.length) put("Failed:", [200, 120, 110]);
    for (const q of failed) put("  ✗ " + q.title, [170, 120, 115]);
  } else if (tab === 1) {   // Locations
    const locs = learned("location");
    if (!locs.length) put("No places learned yet. Talk to people, read the floors, listen to rumours.", C.dim);
    for (const d of locs) {
      put(`${secretTitle(run, d)}${questDone(game, `visit:${d.id}`) ? "  (visited)" : ""}`, C.head);
      para(d.text, C.text, "  ");
    }
    const tales = learned("village");   // a village's own story (story/villages.js), under the places
    if (tales.length) { put("", null); put("Village tales:", C.mark); }
    for (const d of tales) { put(secretTitle(run, d), C.head); para(d.text, C.text, "  "); }
  } else if (tab === 2) histories(game, J, put, para);
  else if (tab === 3) {   // Gossip
    const heard = learned("gossip");
    if (!heard.length) put("No rumours yet. People in villages talk; ask them.", C.dim);
    for (const d of heard) { para(d.text, C.text); put("", null); }
  } else {   // Notes: newest first
    if (!J.notes.length) put("No notes yet.", C.dim);
    for (const n of [...J.notes].reverse()) { para(n.text, C.text); put("", null); }
  }
  return L;
}

// Each Hour (and Noon) with what you know of it: its events by date, each with the accounts you've read.
function histories(game, J, put, para) {
  const run = game.run, h = run?.history, rulers = [...(h?.rulers || [])].sort((a, b) => a.events[0].year - b.events[0].year);
  const known = (id) => !!J.secrets[id];
  const all = [...secretsOf(run).values()].filter((d) => d.kind === "history");
  const events = new Set(all.map((d) => d.id.slice(0, d.id.lastIndexOf(":"))));
  const knownEvents = new Set(all.filter((d) => known(d.id)).map((d) => d.id.slice(0, d.id.lastIndexOf(":"))));
  put(`${knownEvents.size} of ${events.size} events known, ${all.filter((d) => known(d.id)).length} of ${all.length} accounts.`, C.mark);
  put("Flat Accounts are read on the map; Deep Inscriptions in 3D, in light; Dark Glosses in the dark.", C.dim);
  put("", null);
  const show = (head, items) => {   // items: [{ base, title, year, disagree, tri }]
    const n = items.length, k = items.filter((x) => READINGS.some((r) => known(`${x.base}:${r}`))).length;
    if (!k) return;
    const a = items.reduce((s, x) => s + READINGS.filter((r) => known(`${x.base}:${r}`)).length, 0);
    put(`${head} · ${k} of ${n} events, ${a} of ${3 * n} accounts`, C.head);
    for (const x of items) {
      const got = READINGS.filter((r) => known(`${x.base}:${r}`));
      if (!got.length) continue;
      const flags = [J.triangulated[x.key] !== undefined ? "triangulated" : null, x.disagree && got.length > 1 ? "the accounts disagree" : null].filter(Boolean);
      put(`  ${x.title}${x.year !== null ? `, year ${x.year}` : ""}${flags.length ? ` (${flags.join("; ")})` : ""}`, C.text);
      for (const r of got) para(`${VIEW_WORD[r]}: ${secretText(run, `${x.base}:${r}`)}`, C[r], "    ");
    }
    put("", null);
  };
  for (const R of rulers) {
    const head = `${R.name} ${R.epithet}${R.ordinal ? `, the ${R.ordinal} Hour` : ""}${J.cultPass[R.id] !== undefined ? " (cult pass)" : ""}`;
    show(head, R.events.map((e) => ({ base: `hist:${e.id}`, key: e.id, title: GRAMMAR.titles.events[e.type] || e.type, year: e.year, disagree: !!e.disagree })));
  }
  show("Noon, who was never crowned", GRAMMAR.noon.map((n, k) => ({ base: `hist:noon:${k + 1}`, key: `noon:${k + 1}`, title: n.event, year: null })));
  if (!knownEvents.size) put("Nothing of the Hours yet. Their accounts are in floors, on walls, and in the dark.", C.dim);
}

function drawJournal(game) {
  const w = Math.min(S.cols - 4, 96), h = S.rows - 2, inner = w - 6;
  const x0 = (S.cols - w) >> 1, y0 = 1, v = view(game);
  box(x0, y0, w, h, { edge: [120, 150, 200] });
  S.text(x0 + 3, y0 + 1, "JOURNAL", 200, 220, 255);
  tabs(x0 + 13, y0 + 1, JOURNAL_TABS, v.tab);
  const lines = journalLines(game, v.tab, inner), rows = h - 6;
  v.top = Math.max(0, Math.min(v.top, lines.length - rows));
  v.rows = rows; v.n = lines.length;
  lines.slice(v.top, v.top + rows).forEach(([t, c], k) => c && S.text(x0 + 3, y0 + 3 + k, t.slice(0, inner), ...c));
  if (v.top > 0) S.put(x0 + w - 2, y0 + 3, "^", ...UI.help);
  if (v.top + rows < lines.length) S.put(x0 + w - 2, y0 + 2 + rows, "v", ...UI.help);
  S.text(x0 + 3, y0 + h - 2, "J or Esc to close · ← → or 1-5: tabs · ↑ ↓: scroll", 110, 110, 120);
}

const SCROLL = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 };
function journalKey(game, code) {
  const v = view(game);
  if (code === "KeyJ" || code === "Escape") { popMode(game); return true; }
  const t = tabsKey(code, v.tab, JOURNAL_TABS.length) ?? (/^Digit[1-5]$/.test(code) ? +code.slice(5) - 1 : null);
  if (t !== null) { v.tab = t; v.top = 0; return true; }
  const page = Math.max(1, (v.rows || 10) - 1);
  if (SCROLL[code]) v.top += SCROLL[code];
  else if (code === "PageUp") v.top -= page;
  else if (code === "PageDown") v.top += page;
  else if (code === "Home") v.top = 0;
  else if (code === "End") v.top = Infinity;
  else return false;
  v.top = Math.max(0, Math.min(v.top, (v.n || 0) - (v.rows || 0)));
  return true;
}

registerScreen("journal", {
  draw: drawJournal,
  key(game, code, repeat) {
    if (repeat && (code === "KeyJ" || code === "Escape")) return false;
    return journalKey(game, code);
  },
  mouse(game, button, cell) {
    const p = button === 0 ? at(cell) : null;   // any other button closes it, as before
    if (p && p.tab !== undefined) { view(game).tab = p.tab; view(game).top = 0; }
    else popMode(game);
  },
  wheel(game, sign) { journalKey(game, sign < 0 ? "ArrowUp" : "ArrowDown"); },
});

