// Character creation (TECH_DESIGN §4.2 `create`; bible §10.1; owner WS4): the wizard, genotype → background →
// attributes (point-buy with live HP, DV, AV, MA) → mutations (offers from progression/mutations.js over
// content/mutations.js) or the free implant (grade; WS5's bodymods) → name (ui.js textInput: "Ö" and "m" type; Tab
// suggests one) → run mode (One Wick, Commons Lamp, Pilgrim) → begin. WS9's title pushes it with { seed, mode }
// (its seed field and mode line); beginning starts the run with the made character (progression/chargen.js beginRun).
//
// Keys: ↑↓ (W S) choose, Enter (E, Space) next, Esc back (on the first step, back to the title). On the attributes:
// ← → (A D, - +) lower and raise the chosen one, R the suggested spread. On the name every printable key types,
// Tab suggests a name, Enter is next, Esc back. The mouse: a click on a row chooses it and a second click goes on;
// [ Next ] and [ Back ], the [-] [+] beside each attribute, [ Suggest ], and the steps along the top (any step
// already reached).
//
//   openCreate(game, { seed, mode }) → the wizard as the whole stack (checks and tools; WS9's title pushes it)
//   wizard() → the state as it stands: { step, steps, genotype, background, attrs, name, mode, seed, mutations,
//              implant, msg }   (checks)
//   wizardChoices() → the choices beginning would pass to beginRun
import * as S from "../screen.js";
import { registerScreen, setMode, popMode } from "../screens.js";
import { UI, list, listKey, listAt, listWheel, keyHelp, wrap, hit, at, textInput, drawTextInput } from "../ui.js";
import { FLAGS } from "../config.js";
import { randomSeed } from "../game.js";
import { makeRng, seedFor } from "../rng.js";
import { ATTRS, maxHp, dv, av, ma, cooldownMul, carryCap, mod, attr } from "../stats.js";
import { makeBody } from "../body.js";
import { WEAPONS, ARMOURS, ITEM_KINDS } from "../items.js";
import { formatPrice } from "../currency.js";
import { GENOTYPES } from "../content/genotypes.js";
import { BACKGROUNDS, LEVELS, backgroundsOf } from "../content/backgrounds.js";
import { MUTATIONS } from "../content/mutations.js";
import { IMPLANTS } from "../content/items/implants.js";
import { TREES } from "../content/powers.js";
import { FACTIONS } from "../factions.js";
import { mutationOffers } from "../progression/mutations.js";
import { RUN_MODES, NAME_MAX, beginRun, validateChoices, suggestSpread, suggestName, baseAttrs, pointsLeft,
         canRaise, canLower } from "../progression/chargen.js";

export const MODE = "create";

const STEPS = ["genotype", "background", "attributes", "track", "name", "mode", "begin"];
const STEP_LABELS = { genotype: "Genotype", background: "Background", attributes: "Attributes", track: "Mutations",
                      name: "Name", mode: "Mode", begin: "Begin" };
// The run modes (bible §10.1). (WS9's save.js RUN_MODES holds the same names for its title; this wizard needs them
// before that file is in this tree.)
const MODE_TEXT = {
  oneWick: { name: "One Wick", note: "Permadeath: when you die, the run is over." },
  commonsLamp: { name: "Commons Lamp", note: "A checkpoint whenever you enter or leave a settlement; you wake at the last one when you die." },
  pilgrim: { name: "Pilgrim", note: "Most factions start at 0 or above; kills give no XP, discoveries, quests and Kindlings 2.2 times as much." },
};
// What each attribute drives (bible §10.6), for the attributes step.
const ATTR_TEXT = {
  str: "Melee damage over a weapon's need, forcing doors and crates, resisting knockback, how far you throw.",
  agi: "To-hit, dodging (DV), critical hits, how far you jump, your aim when throwing.",
  tou: "HP (TOU + 4, then 3 + its modifier a level), saves against poison and disease, falls, how long ink keeps you flat.",
  int: "Examining artifacts, spotting secret walls, 4 power offers a level at 18, what readings sell for.",
  wil: "Ability cooldowns, mental armour (MA), regeneration, shorter bad effects.",
  ego: "Mental mutations, prices, Kindling gains, how many followers you keep, how much Cast you bear.",
};

const wiz = {
  step: 0, reached: 0, seed: 0, mode: "oneWick", genotype: "bent", background: null, attrs: null, attrSel: 0,
  name: { text: "", cursor: 0, max: 24 }, names: 0, mutations: [], implant: null, msg: "",   // (reset() sets the field's max:
  // progression/chargen.js and game.js import each other through this screen, so nothing of theirs is read at load)
  lists: Object.fromEntries(STEPS.map((s) => [s, { sel: 0, top: 0 }])),
};
export const wizard = () => ({ step: STEPS[wiz.step], steps: [...STEPS], genotype: wiz.genotype, background: wiz.background,
  attrs: wiz.attrs && { ...wiz.attrs }, name: wiz.name.text, mode: wiz.mode, seed: wiz.seed, mutations: [...wiz.mutations],
  implant: wiz.implant, msg: wiz.msg });
export const wizardChoices = () => ({ genotype: wiz.genotype, background: wiz.background, attrs: { ...wiz.attrs },
  mutations: [...wiz.mutations], implant: wiz.genotype === "plumb" ? wiz.implant : null, name: wiz.name.text.trim(), mode: wiz.mode });

function reset(data = {}) {
  Object.assign(wiz, { step: 0, reached: 0, seed: data?.seed ?? FLAGS.seed ?? randomSeed(), mode: RUN_MODES.includes(data?.mode) ? data.mode : "oneWick",
    genotype: "bent", background: null, attrs: null, attrSel: 0, names: 0, mutations: [], implant: null, msg: "" });
  wiz.name = { text: "", cursor: 0, max: NAME_MAX, fresh: false };
  for (const s of STEPS) wiz.lists[s] = { sel: 0, top: 0 };
  wiz.lists.mode.sel = RUN_MODES.indexOf(wiz.mode);
}

export function openCreate(game, data = {}) { setMode(game, MODE, data, { pointer: false }); }

// --- The steps' rows and what choosing one does ------------------------------------------------------------------
const stepId = () => STEPS[wiz.step];
const bgs = () => backgroundsOf(wiz.genotype);
const trackName = () => (wiz.genotype === "plumb" ? "Implant" : "Mutations");
const creasesLeft = () => GENOTYPES.bent.creases - wiz.mutations.reduce((n, id) => n + (MUTATIONS[id]?.cost ?? 4), 0);

// A player made from the choices so far, for the live numbers (never the run's: nothing here is kept).
function preview(game) {
  const G = GENOTYPES[wiz.genotype], bg = BACKGROUNDS[wiz.background];
  const p = { attrs: { ...(wiz.attrs || baseAttrs(wiz.genotype)) }, genotype: wiz.genotype, background: wiz.background, level: 1,
              maxHpGain: 0, perks: {}, status: {}, body: makeBody("humanoid"), trees: bg?.trees || [] };
  for (const [part, it] of Object.entries(bg?.kit.equip || {})) p.body.equip[part] = it;
  if (G.track === "mutations") p.creases = creasesLeft();
  return p;
}

function offersFor(game) {
  if (wiz.genotype !== "bent") return [];
  const rng = makeRng(seedFor(wiz.seed, "creation", "mutations", wiz.mutations.length));
  return (mutationOffers(game, preview(game), rng) || []).filter((id) => MUTATIONS[id] && !wiz.mutations.includes(id));
}
function implantRows() {
  const bg = BACKGROUNDS[wiz.background], max = GENOTYPES.plumb.freeImplantCost;
  const ids = Object.keys(IMPLANTS).filter((id) => (IMPLANTS[id].grade ?? IMPLANTS[id].license ?? IMPLANTS[id].cost ?? 0) <= max);
  if (!ids.length && bg?.implant) ids.push(bg.implant);   // until WS5's implants are in: the one your Level gives
  return ids;
}

function rowsOf(game) {
  switch (stepId()) {
    case "genotype": return Object.keys(GENOTYPES);
    case "background": return bgs();
    case "attributes": return ATTRS;
    case "track": return wiz.genotype === "plumb" ? implantRows() : [...wiz.mutations.map((id) => ({ taken: id })), ...offersFor(game), { done: true }];
    case "mode": return RUN_MODES;
    default: return [];
  }
}

function go(game, to) {
  to = Math.max(0, Math.min(STEPS.length - 1, to));
  wiz.msg = "";
  if (to > wiz.step && !leave(game)) return;
  wiz.step = to;
  wiz.reached = Math.max(wiz.reached, to);
  if (stepId() === "name" && !wiz.name.text) suggest();
}

// Leaving a step forwards: what it chose is kept, or it says what's missing.
function leave(game) {
  const rows = rowsOf(game), sel = wiz.lists[stepId()].sel;
  switch (stepId()) {
    case "genotype": {
      const g = rows[sel];
      if (g !== wiz.genotype || !wiz.background) { wiz.genotype = g; wiz.background = null; wiz.attrs = null; wiz.mutations = []; wiz.implant = null; wiz.reached = 0; }
      return true;
    }
    case "background": {
      const b = rows[sel];
      if (b !== wiz.background) { wiz.background = b; wiz.attrs = suggestSpread(wiz.genotype, b); wiz.implant = null; wiz.reached = 1; }
      return true;
    }
    case "attributes": {
      const left = pointsLeft(wiz.genotype, wiz.attrs);
      if (left !== 0) { wiz.msg = left > 0 ? `Spend every point first (${left} left).` : `${-left} points too many.`; return false; }
      return true;
    }
    case "track":
      if (wiz.genotype === "plumb" && !wiz.implant) wiz.implant = rows[sel] ?? BACKGROUNDS[wiz.background]?.implant ?? null;
      return true;
    case "name":
      if (!wiz.name.text.trim()) { wiz.msg = "Your name, first (Tab suggests one)."; return false; }
      return true;
    case "mode": wiz.mode = rows[sel]; return true;
    default: return true;
  }
}

// Choosing row i of a list step: the step's choice, then on to the next step. On the Bent's mutations a row is
// taken (or given back) and the list stays; its last row goes on.
function choose(game, i) {
  const st = wiz.lists[stepId()], rows = rowsOf(game);
  if (i < 0 || i >= rows.length) return;
  st.sel = i;
  if (stepId() === "track" && wiz.genotype === "plumb") wiz.implant = rows[i];
  if (stepId() === "track" && wiz.genotype === "bent" && !rows[i].done) {
    pickTrack(rows[i]);
    st.sel = Math.min(i, rowsOf(game).length - 1);
    return;
  }
  go(game, wiz.step + 1);
}

function pickTrack(row) {
  if (row.taken) { wiz.mutations = wiz.mutations.filter((id) => id !== row.taken); return; }   // give it back
  const cost = MUTATIONS[row]?.cost ?? 4;
  if (cost > creasesLeft()) { wiz.msg = `That needs ${cost} creases; you have ${creasesLeft()}.`; return; }
  wiz.mutations.push(row);
}

function begin(game) {
  const problems = validateChoices(wizardChoices());
  if (problems.length) { wiz.msg = problems[0]; return; }
  beginRun(game, wizardChoices(), { seed: wiz.seed });
}

// A suggested name stands in the field "fresh": the first letter you type (or Backspace) replaces it whole, and
// moving the cursor keeps it to edit.
function suggest() {
  wiz.name.text = suggestName(wiz.genotype, wiz.background, makeRng(seedFor(wiz.seed, "creation", "name", wiz.names++)));
  wiz.name.cursor = [...wiz.name.text].length;
  wiz.name.fresh = true;
}
const printable = (k) => typeof k === "string" && [...k].length === 1 && !/[\p{Cc}\p{Cf}]/u.test(k);

function nudge(k, d) {
  if (!wiz.attrs) return;
  if (d > 0 ? canRaise(wiz.genotype, wiz.attrs, k) : canLower(wiz.genotype, wiz.attrs, k)) wiz.attrs[k] += d;
  wiz.msg = "";
}

// --- Drawing ---------------------------------------------------------------------------------------------------
const button = (x, y, label, payload, color = UI.title) => { S.text(x, y, label, ...color); hit({ x, y, w: label.length, h: 1 }, payload); return label.length; };
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const say = (x, y, w, text, color = UI.text) => { const lines = wrap(text, w); lines.forEach((l, k) => S.text(x, y + k, l, ...color)); return lines.length; };

function kitLine(it) {
  if (it.kind === "weapon") return WEAPONS[it.id]?.name;
  if (it.kind === "armour") return ARMOURS[it.id]?.name;
  if (it.kind === "potion") return `${it.count} potion${it.count > 1 ? "s" : ""} of ${it.effect}`;
  if (it.kind === "knife") return `${it.count} throwing knives`;
  return it.id || it.effect || it.kind;
}
function kitOf(bg) {
  const k = bg.kit, items = [...Object.values(k.equip || {}), k.belt, ...(k.pack || [])].filter((it) => it && ITEM_KINDS[it.kind]);
  return items.map(kitLine).filter(Boolean);
}
// (the factions' names are WS6a's content; until they're in, the id with a capital)
const factionName = (f) => FACTIONS[f]?.name || f.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const repLine = (rep) => Object.entries(rep || {}).map(([f, n]) => `${factionName(f)} ${signed(n)}`).join(", ");

function drawSteps(y) {
  let x = 2;
  STEPS.forEach((s, k) => {
    const label = s === "track" ? trackName() : STEP_LABELS[s], here = k === wiz.step, can = k <= wiz.reached;
    const text = here ? `[${label}]` : label;
    S.text(x, y, text, ...(here ? UI.title : can ? UI.dim : UI.help));
    if (can && !here) hit({ x, y, w: text.length, h: 1 }, { step: k });
    x += text.length + 1;
    if (k < STEPS.length - 1) { S.text(x, y, ">", ...UI.help); x += 2; }
  });
}

function drawList(game, x, y, w, h, row) {
  const st = wiz.lists[stepId()], rows = rowsOf(game);
  list(st, { x, y, w, h, items: rows, row, empty: "(nothing to choose here)" });
}

function drawGenotype(game, L, R) {
  drawList(game, L.x, L.y, L.w, L.h, (g, i, r) => {
    if (r.sel) S.text(r.x, r.y, ">", ...UI.mark);
    S.text(r.x + 2, r.y, GENOTYPES[g].name, ...(r.sel ? UI.sel : UI.text));
  });
  const G = GENOTYPES[rowsOf(game)[wiz.lists.genotype.sel]];
  let y = R.y;
  S.text(R.x, y++, G.name.toUpperCase(), ...UI.title);
  y += say(R.x, y, R.w, G.info) + 1;
  y += say(R.x, y, R.w, `Attributes: ${G.base} each, ${G.points} points to spend (1 per +1 to ${G.steepAt}, then ${G.steepCost}; at most ${G.maxAtCreation} before your background).`, UI.dim);
  y += say(R.x, y, R.w, G.track === "mutations"
    ? `Mutations: ${G.creases} creases to start, +${G.creasesPerLevel} a level. A new mutation costs 4.`
    : `Implants: grade ${G.grade}, with one free implant costing at most ${G.freeImplantCost}. True-marks raise your grade.`, UI.dim);
}

function drawBackground(game, L, R) {
  drawList(game, L.x, L.y, L.w, L.h, (b, i, r) => {
    if (r.sel) S.text(r.x, r.y, ">", ...UI.mark);
    S.text(r.x + 2, r.y, BACKGROUNDS[b].name.slice(0, r.w - 2), ...(r.sel ? UI.sel : UI.text));
  });
  const bg = BACKGROUNDS[rowsOf(game)[wiz.lists.background.sel]];
  if (!bg) return;
  let y = R.y;
  S.text(R.x, y++, bg.name.toUpperCase(), ...UI.title);
  y += say(R.x, y, R.w, bg.info) + 1;
  const bonus = Object.entries(bg.bonus).map(([k, n]) => `${signed(n)} ${k.toUpperCase()}`).join(", ");
  y += say(R.x, y, R.w, `Bonus: ${bonus}${bg.level ? `; ${LEVELS[bg.level].info}` : ""}`, UI.dim);
  y += say(R.x, y, R.w, `Powers: the ${bg.trees.map((t) => TREES[t].name).join(" and ")} trees`, UI.dim);
  y += say(R.x, y, R.w, `Kit: ${kitOf(bg).join(", ") || "nothing"}; ${formatPrice(bg.glim)}`, UI.dim);
  if (bg.implant) y += say(R.x, y, R.w, `Free implant: ${implantName(bg.implant)}`, UI.dim);
  if (bg.rep) say(R.x, y, R.w, `Standing: ${repLine(bg.rep)}`, UI.dim);
}
const implantName = (id) => IMPLANTS[id]?.name || id.replace(/([A-Z])/g, " $1").toLowerCase().replace(/^tally /, "tally-").replace(/^plumb line/, "plumb-line");

function drawAttributes(game, L, R) {
  const p = preview(game), bg = BACKGROUNDS[wiz.background];
  let y = L.y;
  ATTRS.forEach((k, i) => {
    const sel = i === wiz.attrSel, x = L.x, bought = wiz.attrs[k], extra = bg?.bonus?.[k] || 0;
    if (sel) S.text(x, y, ">", ...UI.mark);
    S.text(x + 2, y, k.toUpperCase(), ...(sel ? UI.sel : UI.text));
    button(x + 6, y, "[-]", { attr: k, d: -1 }, canLower(wiz.genotype, wiz.attrs, k) ? UI.title : UI.help);
    S.text(x + 10, y, String(bought).padStart(2), ...UI.sel);
    button(x + 13, y, "[+]", { attr: k, d: 1 }, canRaise(wiz.genotype, wiz.attrs, k) ? UI.title : UI.help);
    S.text(x + 17, y, `${extra ? signed(extra) : "  "} = ${String(attr(p, k)).padStart(2)}  ${signed(mod(p, k))}`, ...UI.dim);
    hit({ x, y, w: 6, h: 1 }, { attrRow: i });
    y += 1;
  });
  const left = pointsLeft(wiz.genotype, wiz.attrs);
  S.text(L.x, y + 1, `Points left: ${left}`, ...(left === 0 ? UI.info : UI.title));
  button(L.x, y + 2, "[ Suggested spread ]", { key: "KeyR" });
  // The live numbers (stats.js, whichever formula set runs; the attribute set's are the bible's).
  let ry = R.y;
  S.text(R.x, ry++, "WHAT THEY MAKE", ...UI.title);
  const rows = [["HP", maxHp(p)], ["DV (dodge)", dv(p)], ["AV (armour)", av(p)], ["MA (mental armour)", ma(p)],
                ["Cooldowns", `${Math.round(cooldownMul(p) * 100)}%`], ["Carry", carryCap(p)]];
  for (const [label, v] of rows) { S.text(R.x, ry, label, ...UI.dim); S.text(R.x + 20, ry++, String(v), ...UI.sel); }
  ry++;
  const k = ATTRS[wiz.attrSel];
  S.text(R.x, ry++, k.toUpperCase(), ...UI.title);
  say(R.x, ry, R.w, ATTR_TEXT[k], UI.dim);
}

function drawTrack(game, L, R) {
  if (wiz.genotype === "plumb") {
    drawList(game, L.x, L.y, L.w, L.h, (id, i, r) => {
      if (r.sel) S.text(r.x, r.y, ">", ...UI.mark);
      S.text(r.x + 2, r.y, implantName(id).slice(0, r.w - 4), ...(r.sel ? UI.sel : UI.text));
      if (wiz.implant === id) S.text(r.x + r.w - 1, r.y, "*", ...UI.mark);
    });
    let y = R.y;
    S.text(R.x, y++, `GRADE ${GENOTYPES.plumb.grade}`, ...UI.title);
    y += say(R.x, y, R.w, `You start at grade ${GENOTYPES.plumb.grade}, with one implant costing at most ${GENOTYPES.plumb.freeImplantCost} fitted free. True-marks raise your grade; a Truing Cradle fits more.`, UI.dim) + 1;
    if (!Object.keys(IMPLANTS).length) say(R.x, y, R.w, "Your Level sends you down with this one; it is fitted once the Truing Cradle's implants are in the game.", UI.info);
    return;
  }
  const rows = rowsOf(game);
  drawList(game, L.x, L.y, L.w, L.h, (row, i, r) => {
    if (r.sel) S.text(r.x, r.y, ">", ...UI.mark);
    if (row.done) { S.text(r.x + 2, r.y, `Go on (keep ${creasesLeft()} creases)`.slice(0, r.w - 2), ...(r.sel ? UI.sel : UI.dim)); return; }
    const id = row.taken || row, m = MUTATIONS[id];
    S.text(r.x + 2, r.y, `${row.taken ? "* " : ""}${m?.name || id}`.slice(0, r.w - 2), ...(r.sel ? UI.sel : row.taken ? UI.mark : UI.text));
  });
  let y = R.y;
  S.text(R.x, y++, `CREASES: ${creasesLeft()} of ${GENOTYPES.bent.creases}`, ...UI.title);
  y += say(R.x, y, R.w, "A new mutation costs 4 creases; a defect gives some back. Creases you don't spend now are kept: you gain one a level.", UI.dim) + 1;
  const row = rows[wiz.lists.track.sel], m = MUTATIONS[row?.taken || row];
  if (m) say(R.x, y, R.w, typeof m.info === "function" ? m.info(1) : m.info || "", UI.text);
  else if (rows.length === 1) say(R.x, y, R.w, "No mutations are known yet: your creases are kept for later.", UI.info);
}

function drawName(game, L, R) {
  S.text(L.x, L.y, "Your name:", ...UI.text);
  drawTextInput(L.x, L.y + 2, Math.min(L.w + 10, NAME_MAX + 1), wiz.name, { focused: true, color: wiz.name.fresh ? UI.dim : UI.sel });
  button(L.x, L.y + 4, "[ Suggest ]", { key: "Tab" });
  const culture = wiz.genotype === "plumb" ? "Plumb names: a given name, a family and your Level." : "Names from where you grew up.";
  say(R.x, R.y, R.w, `${culture} Type any name you like (å, ä and ö too): your first letter replaces the suggestion. Tab suggests another.`, UI.dim);
}

function drawMode(game, L, R) {
  drawList(game, L.x, L.y, L.w, L.h, (m, i, r) => {
    if (r.sel) S.text(r.x, r.y, ">", ...UI.mark);
    S.text(r.x + 2, r.y, MODE_TEXT[m].name, ...(r.sel ? UI.sel : UI.text));
  });
  const m = RUN_MODES[wiz.lists.mode.sel];
  S.text(R.x, R.y, MODE_TEXT[m].name.toUpperCase(), ...UI.title);
  say(R.x, R.y + 1, R.w, MODE_TEXT[m].note, UI.dim);
}

function drawBegin(game, L, R) {
  const p = preview(game), bg = BACKGROUNDS[wiz.background], G = GENOTYPES[wiz.genotype];
  let y = L.y;
  S.text(L.x, y++, wiz.name.text.trim().slice(0, S.cols - L.x - 2), ...UI.title);
  S.text(L.x, y++, `${G.name}, ${bg.name}`, ...UI.text);
  y++;
  S.text(L.x, y++, ATTRS.map((k) => `${k.toUpperCase()} ${attr(p, k)}`).join("  "), ...UI.sel);
  S.text(L.x, y++, `HP ${maxHp(p)}  DV ${dv(p)}  AV ${av(p)}  MA ${ma(p)}`, ...UI.sel);
  y++;
  const w = S.cols - L.x - 2;
  y += say(L.x, y, w, `Powers: ${bg.trees.map((t) => TREES[t].name).join(", ")}`, UI.dim);
  y += say(L.x, y, w, `Kit: ${kitOf(bg).join(", ")}; ${formatPrice(bg.glim)}`, UI.dim);
  y += say(L.x, y, w, G.track === "mutations"
    ? `Mutations: ${wiz.mutations.map((id) => MUTATIONS[id]?.name || id).join(", ") || "none yet"}; ${creasesLeft()} creases kept`
    : `Grade ${G.grade}; implant: ${wiz.implant ? implantName(wiz.implant) : "none"}`, UI.dim);
  y += say(L.x, y, w, `Mode: ${MODE_TEXT[wiz.mode].name}. Seed ${wiz.seed}.`, UI.dim);
  S.text(L.x, y + 1, "Enter begins.", ...UI.info);
}

const DRAW = { genotype: drawGenotype, background: drawBackground, attributes: drawAttributes, track: drawTrack,
               name: drawName, mode: drawMode, begin: drawBegin };

function drawCreate(game) {
  S.clear();
  S.text(2, 0, "A NEW CHARACTER", ...UI.title);
  drawSteps(1);
  S.text(2, 2, "-".repeat(Math.max(0, S.cols - 4)), ...UI.edge);
  const top = 4, bottom = S.rows - 4, lw = Math.min(30, (S.cols >> 1) - 4);
  const L = { x: 2, y: top, w: lw, h: Math.max(1, bottom - top) };
  const R = { x: lw + 6, y: top, w: Math.max(10, S.cols - lw - 9), h: L.h };
  DRAW[stepId()](game, L, R);
  if (wiz.msg) S.text(2, S.rows - 3, wiz.msg.slice(0, S.cols - 4), ...UI.bad);
  let x = 2;
  if (wiz.step > 0 || inStackBelow) x += button(x, S.rows - 2, "[ Back ]", { key: "Escape" }) + 2;
  button(x, S.rows - 2, stepId() === "begin" ? "[ Begin ]" : "[ Next ]", { key: "Enter" });
  const help = stepId() === "name"
    ? [{ code: "Enter", help: "next" }, { code: "Tab", help: "suggest" }, { code: "Escape", help: "back" }]
    : stepId() === "begin" ? [{ code: "Enter", help: "begin" }, { code: "Escape", help: "back" }]
    : stepId() === "attributes"
      ? [{ code: "ArrowUp", help: "choose" }, { code: "ArrowDown", help: "choose" }, { code: "ArrowLeft", help: "lower" }, { code: "ArrowRight", help: "raise" },
         { code: "KeyR", help: "suggested" }, { code: "Enter", help: "next" }, { code: "Escape", help: "back" }]
      : [{ code: "ArrowUp", help: "choose" }, { code: "ArrowDown", help: "choose" }, { code: "Enter", help: "next" }, { code: "Escape", help: "back" }];
  keyHelp(2, S.rows - 1, S.cols - 4, help);
}
let inStackBelow = false;   // something under the wizard (the title) that Esc on the first step goes back to

// --- Input -----------------------------------------------------------------------------------------------------
function back(game) {
  wiz.msg = "";
  if (wiz.step > 0) { wiz.step--; return; }
  if (inStackBelow) popMode(game);
}

function key(game, code, repeat, k) {
  const step = stepId();
  if (step === "name") {
    if (code === "Tab") { if (!repeat) suggest(); return true; }
    if (wiz.name.fresh && (printable(k) || code === "Backspace" || code === "Delete")) Object.assign(wiz.name, { text: "", cursor: 0 });
    if (code !== "Enter" && code !== "NumpadEnter" && code !== "Escape") wiz.name.fresh = false;
    const r = textInput(wiz.name, code, k);
    if (r === "done" && !repeat) go(game, wiz.step + 1);
    else if (r === "cancel" && !repeat) back(game);
    else wiz.msg = "";
    return true;   // every key types here (M too), so nothing else hears it
  }
  if (code === "Escape") { if (!repeat) back(game); return true; }
  if (step === "begin") { if ((code === "Enter" || code === "NumpadEnter" || code === "KeyE" || code === "Space") && !repeat) begin(game); return true; }
  if (step === "attributes") {
    const n = ATTRS.length;
    if (code === "ArrowUp" || code === "KeyW") { wiz.attrSel = (wiz.attrSel + n - 1) % n; return true; }
    if (code === "ArrowDown" || code === "KeyS") { wiz.attrSel = (wiz.attrSel + 1) % n; return true; }
    if (code === "ArrowLeft" || code === "KeyA" || code === "Minus" || code === "NumpadSubtract") { nudge(ATTRS[wiz.attrSel], -1); return true; }
    if (code === "ArrowRight" || code === "KeyD" || code === "Equal" || code === "NumpadAdd") { nudge(ATTRS[wiz.attrSel], 1); return true; }
    if (code === "KeyR") { if (!repeat) { wiz.attrs = suggestSpread(wiz.genotype, wiz.background); wiz.msg = ""; } return true; }
    if ((code === "Enter" || code === "NumpadEnter" || code === "KeyE" || code === "Space") && !repeat) { go(game, wiz.step + 1); return true; }
    return false;
  }
  const st = wiz.lists[step], rows = rowsOf(game);
  const r = listKey(st, code, rows.length);
  if (r === "select" && !repeat) { if (rows.length) choose(game, st.sel); else go(game, wiz.step + 1); }
  else if (r === null && (code === "Enter" || code === "NumpadEnter") && !repeat) go(game, wiz.step + 1);   // (an empty list)
  return r !== null || code === "Enter" || code === "NumpadEnter";
}

function mouse(game, button, cell) {
  if (button === 2) { back(game); return; }
  if (button !== 0) return;
  const p = at(cell);
  if (!p) return;
  if (p.step !== undefined) { if (p.step < wiz.step) { wiz.step = p.step; wiz.msg = ""; } else go(game, p.step); return; }
  if (p.key === "Enter") { if (stepId() === "begin") begin(game); else go(game, wiz.step + 1); return; }
  if (p.key === "Escape") { back(game); return; }
  if (p.key === "Tab") { suggest(); return; }
  if (p.key === "KeyR") { wiz.attrs = suggestSpread(wiz.genotype, wiz.background); wiz.msg = ""; return; }
  if (p.attr) { wiz.attrSel = ATTRS.indexOf(p.attr); nudge(p.attr, p.d); return; }
  if (p.attrRow !== undefined) { wiz.attrSel = p.attrRow; return; }
  if (p.input) return;
  const st = wiz.lists[stepId()];
  // A click picks the row out; a click on the row already picked chooses it, as Enter does.
  if (p.list === st) { if (st.sel === p.index) choose(game, p.index); else st.sel = p.index; }
}

registerScreen(MODE, {
  over: "none", pointer: "unlock",
  enter(game, data) { reset(data); inStackBelow = (game.modeStack?.length || 0) > 1; },
  draw: drawCreate,
  key,
  mouse,
  wheel(game, sign) {
    if (stepId() === "attributes") { wiz.attrSel = Math.max(0, Math.min(ATTRS.length - 1, wiz.attrSel + Math.sign(sign))); return; }
    const st = wiz.lists[stepId()];
    if (st) listWheel(st, sign, rowsOf(game).length);
  },
});
