// The inventory screen (I; TECH_DESIGN §4.2 `inventory`). The game is paused while it's open, in either view.
// Two tabs: Pack (a scrolling list, a filter by kind, its weight and your glim) and Equipment (every part of your
// body, what it wears or holds, the implant in its socket, and the belt). It opens on the Pack.
//   Pack:      ↑↓ / W S / PgUp PgDn / wheel / mouse: select · E / Enter / Space: use, read, equip or examine an
//              artifact · T: throw · X: drop · F: filter · L: look closer (examine) · R: swap weapons
//   Equipment: ↑↓ / mouse: select · E / Enter / Space: take it off (into the pack), or on an empty part, the pack
//              showing what goes there (E on one puts it on that part) · L: look closer · R
//   Tab / ← →: the other tab · I / Esc: close
// Using something on the map costs game time (returned by the key), like any other action, and closes the screen.
//
// Gear's enchantment is hidden until you equip it. Cursed gear (−) can't be taken off until a scroll of remove
// curse lifts the curse; implants come out only at a Truing Cradle (bodymods). game.invSel is always an index into
// the pack (golden and the bot set it), whatever the filter shows.
//
//   openInventory(game), closeInventory(game)
//   inventoryKey(game, code) → seconds | 0 | null (close) | "throw" (game.throwStack) | { aim: it } (an artifact to aim)
//   inventoryClick(game, cell) → the same, for a left click;  inventoryWheel(game, sign)
//   useSelected(game), equip(game, it, index, part?) → bool, unequipPart(game, partId) → seconds, swapWeapons(game) → seconds
//   packFilters(p) → [{ id, label, n }]   packWeight(p)   bodyRows(game) → the Equipment tab's rows
//   setBodyNote(fn)   fn(game, p) → the line over the Equipment tab's parts (bodymods: grade and true-marks)
//   drawInventory(game)
import * as S from "./screen.js";
import { pushMode, popMode } from "./screens.js";
import { emit } from "./events.js";
import { UI, hit, at, hitLabel, list, listKey, listWheel, tabs, tabsKey, wrap } from "./ui.js";
import { WEAPONS, ARMOURS, ELEMENTS, ITEM_KINDS, itemName, itemInfo, itemGlyph, itemAura, itemWeight, makeItem, isGear, strNeeded, takeOne,
  registerItemAction, useItem, canUse, RELIC_COLOR, mendItem, requirements, shortfall, badlyText } from "./items.js";
import { drinkPotion, readScroll } from "./effects.js";
import { RULES } from "./rules.js";
import { armourValue, bonus, weaponReach } from "./player.js";
import { attr, maxHp, dv, carryCap } from "./stats.js";
import { purseCap, formatFunds } from "./currency.js";
import { defaultPart, slotsFor, canEquip, equip as bodyEquip, unequip as bodyUnequip, swapBelt, wielded, wornOn, belt } from "./body.js";

// What using things from the pack does (the kinds in content name these actions).
registerItemAction("drink", (game, e, it) => { takeOne(e, it); drinkPotion(game, it.effect); return RULES.body.drinkTime; });
registerItemAction("read", (game, e, it) => { takeOne(e, it); readScroll(game, it.effect); return RULES.body.readTime; });
// (a broken piece is mended instead, with the Repair power: that takes its own time, items.js MEND_TIME; B1)
registerItemAction("wear", (game, e, it) => (it.broken ? mendItem(game, e, it) : equip(game, it, e.inv.indexOf(it), wearPart(game, e, it)) ? RULES.body.equipTime : 0));
// Where E puts gear on: the part chosen on the Equipment tab (the pack shown "for" it), else the body's default.
const wearPart = (game, e, it) => (e === game.player && game.invFilter === "for" && slotsFor(e, it).includes(game.invFor) ? game.invFor : undefined);

const AURA = { good: ["(good)", [120, 220, 120]], neutral: ["(neutral)", [170, 170, 170]], bad: ["(bad)", [255, 110, 100]] };
const TABS = ["pack", "equipment"];
const BAD = [255, 150, 120], CURSE = [200, 80, 120], DIM = [170, 170, 170];

// The inventory is a screen on the mode stack (screens/equipment.js registers it): opening pushes it over the view
// you are in; closing pops back there (in 3D the pointer locks again).
export function openInventory(game) {
  pushMode(game, "inventory");
  game.invSel = Math.min(game.invSel || 0, Math.max(0, game.player.inv.length - 1));
  game.invTab = "pack";
  if (!game.invFilter || game.invFilter === "for") { game.invFilter = "all"; game.invFor = null; }
  if (!visible(game).includes(game.invSel)) game.invFilter = "all";
  game.eqSel ||= 0;
}

export function closeInventory(game) {
  if (game.mode === "inventory") popMode(game);
}

// --- The pack's filter ---------------------------------------------------------------------------------------
const FILTERS = [
  { id: "all", label: "everything", test: () => true },
  { id: "gear", label: "gear", test: (it) => isGear(it) },
  { id: "potions", label: "potions", test: (it) => it.kind === "potion" },
  { id: "scrolls", label: "scrolls", test: (it) => it.kind === "scroll" },
  { id: "thrown", label: "to throw", test: (it) => !!ITEM_KINDS[it.kind]?.throwable && it.kind !== "potion" },
  { id: "artifacts", label: "artifacts and cells", test: (it) => it.kind === "artifact" || it.kind === "cell" },
  { id: "implants", label: "implants", test: (it) => it.kind === "implant" },
];
const OTHER = { id: "other", label: "other things", test: (it) => !FILTERS.slice(1).some((f) => f.test(it)) };
// The filters that have something in them (always "everything"), with how many each shows.
export function packFilters(p) {
  const inv = p.inv || [];
  return [...FILTERS, OTHER].map((f) => ({ id: f.id, label: f.label, n: inv.filter(f.test).length })).filter((f) => f.id === "all" || f.n > 0);
}
const filterOf = (id) => [...FILTERS, OTHER].find((f) => f.id === id) || FILTERS[0];
// The pack indices the list shows, in pack order. The filter "for" (from the Equipment tab: game.invFor, a part)
// shows what goes on that part.
function visible(game) {
  const inv = game.player.inv, p = game.player;
  const test = game.invFilter === "for" ? (it) => slotsFor(p, it).includes(game.invFor) : filterOf(game.invFilter || "all").test;
  const out = [];
  inv.forEach((it, i) => { if (test(it)) out.push(i); });
  return out;
}
export const packWeight = (p) => (p.inv || []).reduce((s, it) => s + itemWeight(it) * (it.count || 1), 0);

// --- Keys ------------------------------------------------------------------------------------------------------
// The keys inventoryKey answers (any other goes on to the global bindings: M, N).
export const INVENTORY_KEYS = new Set(["ArrowUp", "KeyW", "ArrowDown", "KeyS", "KeyE", "Enter", "Space", "NumpadEnter", "KeyT", "KeyX", "KeyR",
  "KeyI", "Escape", "Tab", "ArrowLeft", "ArrowRight", "KeyF", "KeyL", "PageUp", "PageDown", "Home", "End", "Numpad8", "Numpad2"]);

// Returns the game time the action took (0 if nothing happened), null to just close, "throw" (the selected
// stack is in game.throwStack: the screen throws it), or { aim: it } (an artifact that needs a target).
export function inventoryKey(game, code) {
  if (code === "KeyI" || code === "Escape") return null;
  const t = tabsKey(code, TABS.indexOf(game.invTab || "pack"), TABS.length);
  if (t !== null) { game.invTab = TABS[t]; return 0; }
  if (code === "KeyR") return swapWeapons(game);
  if ((game.invTab || "pack") === "equipment") return equipmentKey(game, code);
  return packKey(game, code);
}

function packKey(game, code) {
  const inv = game.player.inv, shown = visible(game);
  // What acts on the selection acts only on a thing the list shows (a filter may hide what game.invSel points at).
  if (["KeyE", "Enter", "Space", "NumpadEnter", "KeyT", "KeyX", "KeyL"].includes(code) && !shown.includes(game.invSel)) return 0;
  if (code === "KeyE" || code === "Enter" || code === "Space" || code === "NumpadEnter") return useSelected(game);
  if (code === "KeyT") {
    const it = inv[game.invSel];
    if (it && ITEM_KINDS[it.kind]?.throwable) { game.throwStack = it; return "throw"; }
    game.log("You can throw potions, throwing knives and bombs.", DIM);
    return 0;
  }
  if (code === "KeyX") return dropSelected(game);
  if (code === "KeyF") { cycleFilter(game); return 0; }
  if (code === "KeyL") { if (inv[game.invSel]) pushMode(game, "examine", { item: inv[game.invSel], from: "pack" }); return 0; }
  if (code === "ArrowUp" || code === "KeyW" || code === "Numpad8") { moveSel(game, shown, -1); return 0; }   // (no wrapping: the parent's keys)
  if (code === "ArrowDown" || code === "KeyS" || code === "Numpad2") { moveSel(game, shown, 1); return 0; }
  const state = { sel: Math.max(0, shown.indexOf(game.invSel)), page: game.invPage || 1 };
  if (listKey(state, code, shown.length) === "move") game.invSel = shown[state.sel] ?? 0;
  return 0;
}
function moveSel(game, shown, step) {
  const k = shown.indexOf(game.invSel);
  if (!shown.length) return;
  game.invSel = shown[k < 0 ? 0 : Math.max(0, Math.min(shown.length - 1, k + step))];
}
function cycleFilter(game) {
  const fs = packFilters(game.player), k = fs.findIndex((f) => f.id === (game.invFilter || "all"));
  game.invFilter = fs[(k + 1) % fs.length].id;   // (from "for", k is -1: back to everything)
  game.invFor = null;
  const shown = visible(game);
  if (!shown.includes(game.invSel)) game.invSel = shown[0] ?? 0;
}

function equipmentKey(game, code) {
  const rows = bodyRows(game);
  const sel = Math.min(game.eqSel || 0, rows.length - 1);
  if (code === "ArrowUp" || code === "KeyW" || code === "Numpad8") { game.eqSel = Math.max(0, sel - 1); return 0; }
  if (code === "ArrowDown" || code === "KeyS" || code === "Numpad2") { game.eqSel = Math.min(rows.length - 1, sel + 1); return 0; }
  if (code === "Home" || code === "PageUp") { game.eqSel = 0; return 0; }
  if (code === "End" || code === "PageDown") { game.eqSel = rows.length - 1; return 0; }
  const row = rows[sel];
  if (code === "KeyL") { const it = row?.item || row?.implant; if (it) pushMode(game, "examine", { item: it, from: "equipment" }); return 0; }
  if (code === "KeyE" || code === "Enter" || code === "Space" || code === "NumpadEnter") return row ? takeOff(game, row) : 0;
  return 0;
}

// Click a row to select it; click the selected row again to use it (Pack) or take it off (Equipment). A tab's
// name switches to it; a word of the key help presses its key.
export function inventoryClick(game, cell) {
  const h = at(cell);
  if (!h) return 0;
  if (h.key) return inventoryKey(game, h.key);
  if (h.tab !== undefined) { game.invTab = TABS[h.tab]; return 0; }
  if (h.list && h.index !== undefined && (game.invTab || "pack") === "pack") {   // a row of the pack's list (ui.js list's hit rect)
    const i = visible(game)[h.index];
    if (i === undefined) return 0;
    if (i === game.invSel) return useSelected(game);
    game.invSel = i;
    return 0;
  }
  if (h.bodyRow !== undefined) {
    if (h.bodyRow === game.eqSel) { const row = bodyRows(game)[h.bodyRow]; return row ? takeOff(game, row) : 0; }
    game.eqSel = h.bodyRow;
  }
  return 0;
}
export function inventoryWheel(game, sign) {
  if ((game.invTab || "pack") === "equipment") { game.eqSel = Math.max(0, Math.min(bodyRows(game).length - 1, (game.eqSel || 0) + Math.sign(sign))); return; }
  const shown = visible(game), state = { sel: Math.max(0, shown.indexOf(game.invSel)) };
  if (listWheel(state, sign, shown.length)) game.invSel = shown[state.sel] ?? 0;
}

// E: use the selected thing the way its kind says (drink, read, put on: items.js registry).
export function useSelected(game) {
  const p = game.player;
  const it = p.inv[game.invSel];
  if (!it || !canUse(it)) return 0;
  const t = useItem(game, p, it);
  game.invSel = Math.min(game.invSel, Math.max(0, p.inv.length - 1));
  keepInView(game);
  return t;
}

// Put on (or take in hand) a piece of gear from the inventory, on the part the body picks for it
// (body.js defaultPart). A new weapon goes into your hand and the one you held moves to your belt
// (swapped in with R); whatever was on your belt goes back in your pack. Returns true if it worked.
export function equip(game, it, index, part = defaultPart(game.player, it)) {
  const p = game.player;
  const check = canEquip(game, p, it, part);
  if (!check.ok) {
    if (check.reason === "weak") game.log(`You're not strong enough for the ${itemName(game, it)} (needs ${check.need} STR, you have ${attr(p, "str")}).`, BAD);
    else if (check.reason === "cursed") game.log(`Your cursed ${itemName(game, check.item)} won't come off! A scroll of remove curse would help.`, CURSE);
    else if (check.reason === "broken") return mendItem(game, p, it) > 0;   // (B1: the Repair power mends it; else it says so)
    else if (check.reason === "shell") game.log(`Your shell won't go under the ${itemName(game, it)}: nothing heavier than clothes on your back.`, BAD);
    else game.log(`You have nowhere to put the ${itemName(game, it)}.`, DIM);
    return false;
  }
  p.inv.splice(index, 1);
  const { removed } = bodyEquip(game, p, it, part);   // STR, max HP and armour follow (stats.js)
  const holds = p.body.parts.find((q) => q.id === part).holds;
  const old = removed[0] || null;
  for (const r of removed) {
    if (holds && r === old) {
      if (p.body.belt) p.inv.push(p.body.belt);
      p.body.belt = old;
    } else if (!(r.kind === "armour" && r.id === "clothes")) p.inv.push(r);   // plain clothes just get left behind
  }
  // Wearing it shows what it really is.
  const wasKnown = it.known;
  it.known = true;
  const verb = holds ? "wield" : "put on";
  if (!wasKnown && it.ench < 0) game.log(`You ${verb} the ${itemName(game, it)}. A chill runs through you: it's cursed, and it won't let go!`, CURSE);
  else if (!wasKnown && it.ench > 0 && !it.relic) game.log(`You ${verb} the ${itemName(game, it)}. It hums with a blessing.`, [255, 245, 200]);
  else game.log(`You ${verb} the ${itemName(game, it)}.`, [220, 220, 220]);
  warnBadly(game, it);
  if (holds && old) game.log(`Your ${itemName(game, old)} goes on your belt. (R: swap weapons)`, DIM);
  if (game.invFilter === "for") { game.invFilter = "all"; game.invFor = null; }
  game.invSel = Math.min(game.invSel, Math.max(0, p.inv.length - 1));
  return true;
}

// The Equipment tab's E: what that part wears goes into the pack (the main hand's weapon too: then you fight with your
// fists, WS5 #4 at the WS9 merge). Cursed things stick; implants come out only at a Truing Cradle. Returns the time it took.
export function unequipPart(game, partId) {
  const p = game.player, it = wornOn(p, partId);
  if (!it) return 0;
  const r = bodyUnequip(game, p, partId);
  if (!r.ok) {
    if (r.reason === "cursed") game.log(`Your cursed ${itemName(game, it)} won't come off! A scroll of remove curse would help.`, CURSE);
    return 0;
  }
  p.inv.push(it);
  game.log(`You take off the ${itemName(game, it)}.`, [220, 220, 220]);
  return RULES.body.equipTime;
}
function takeOff(game, row) {
  if (row.belt) {
    const p = game.player, it = belt(p);
    if (!it) return 0;
    p.body.belt = null;
    p.inv.push(it);
    game.log(`You put the ${itemName(game, it)} from your belt into your pack.`, [220, 220, 220]);
    return RULES.body.beltSwap;
  }
  if (!row.item && !row.both) return putOnHere(game, row);
  if (!row.item) return 0;
  return unequipPart(game, row.part.id);
}

// E on an empty part: the pack, showing what goes there; E on one of those then puts it on that part (the second
// finger, the folding rack's second back, the off hand: E from the pack alone takes the body's default part, one ring
// at a time as in the parent's game).
function putOnHere(game, row) {
  const p = game.player, label = partLabel(row.part).toLowerCase();
  if (!p.inv.some((it) => slotsFor(p, it).includes(row.part.id))) {
    game.log(row.implant ? `Nothing in your pack goes on your ${label}. (The ${itemName(game, row.implant)} in its socket comes out only at a Truing Cradle.)`
                         : `Nothing in your pack goes on your ${label}.`, DIM);
    return 0;
  }
  game.invTab = "pack"; game.invFilter = "for"; game.invFor = row.part.id;
  game.invSel = visible(game)[0];
  return 0;
}

// R: swap the weapon in your hand with the one on your belt. Returns the time it took (0 if not).
export function swapWeapons(game) {
  const p = game.player;
  const r = swapBelt(game, p);
  if (!r.ok) {
    if (r.reason === "empty") game.log("You have no second weapon on your belt. (Wield another weapon and the old one goes there.)", DIM);
    else if (r.reason === "cursed") game.log(`Your cursed ${itemName(game, r.item)} won't leave your hand!`, CURSE);
    else if (r.reason === "weak") game.log(`You're not strong enough for the ${itemName(game, belt(p))}.`, BAD);
    return 0;
  }
  const w = wielded(p);
  const fresh = !w.known;
  w.known = true;
  const bad = fresh && w.ench < 0;
  game.log(`You draw the ${itemName(game, w)}.${bad ? " It's cursed, and it won't let go!" : ""}`, bad ? CURSE : [220, 220, 220]);
  warnBadly(game, w);
  p.attackCd = Math.max(p.attackCd, r.time);
  return r.time;
}

// Put on or drawn without the attributes it asks for (B4, the attribute set): it goes on, and the log says what it costs.
function warnBadly(game, it) {
  const p = game.player, lack = badlyText(it, (k) => attr(p, k));
  if (!lack) return;
  const need = Object.entries(requirements(it)).map(([k, n]) => `${k.toUpperCase()} ${n}`).join(", ");
  const have = shortfall(it, (k) => attr(p, k)).map((s) => `${s.attr.toUpperCase()} ${s.have}`).join(", ");
  game.log(`You can hardly ${it.kind === "armour" ? "move in" : "use"} the ${itemName(game, it)} (needs ${need}; you have ${have}): ${lack.replace(/^[^:]*: (used|worn) badly \((.*)\)$/, "$2")}.`, BAD);   // (what it costs: badlyText's brackets)
}

function dropSelected(game) {
  const p = game.player;
  const it = p.inv[game.invSel];
  if (!it) return 0;
  const one = takeOne(p, it);
  const item = makeItem(one, p.x, p.y, p.z);
  item.dropped = true;   // don't pick it straight back up
  game.zone.items.push(item);
  emit(game, "drop", { e: p, item });   // (bodymods: what ran in the pack stops)
  game.log(`You drop the ${itemName(game, one)}.`, DIM);
  game.invSel = Math.min(game.invSel, Math.max(0, p.inv.length - 1));
  keepInView(game);
  return 0;
}
// After the pack changed: a filter left with nothing goes back to everything, and the selection is a thing shown.
function keepInView(game) {
  if (game.invFilter && game.invFilter !== "all" && !visible(game).length) { game.invFilter = "all"; game.invFor = null; }
  const shown = visible(game);
  if (shown.length && !shown.includes(game.invSel)) game.invSel = shown[0];
}

// --- The Equipment tab's rows ------------------------------------------------------------------------------------
// The line over the parts (bodymods sets it: your grade and true-marks); null: a plain heading.
let bodyNote = null;
export function setBodyNote(fn) { bodyNote = fn; }
const PART_LABELS = { hand_r: "Right hand", hand_l: "Left hand", body: "Body", finger_r: "Right finger", finger_l: "Left finger",
  neck: "Neck", head: "Head", face: "Face", back: "Back", arms: "Arms", hands: "Hands", feet: "Feet", back_2: "Second back" };
const TYPE_LABELS = { hand: "Extra hand", body: "Body", finger: "Finger", neck: "Neck", head: "Head", face: "Face", back: "Back", arm: "Arms", gloves: "Hands", feet: "Feet" };
export const partLabel = (part) => PART_LABELS[part.id] || TYPE_LABELS[part.type] || part.id;
// One row per part of your body (a two-handed weapon shows on its main hand; the other hand says so), then the belt.
export function bodyRows(game) {
  const p = game.player, b = p.body, rows = [];
  for (const part of b.parts) {
    const raw = b.equip[part.id];
    rows.push({ part, item: typeof raw === "string" ? null : raw || null, both: typeof raw === "string" ? b.equip[raw] : null,
                implant: part.implant ? b.implants[part.id] || null : null, socket: !!part.implant });
  }
  rows.push({ belt: true, item: belt(p), part: { id: "belt", type: "belt" } });
  return rows;
}

// --- Drawing -----------------------------------------------------------------------------------------------------
const nameColor = (it) => (it.ench < 0 && it.known ? [255, 110, 100] : it.relic ? RELIC_COLOR : [230, 230, 240]);
export function drawInventory(game) {
  const p = game.player, tab = game.invTab || "pack";
  const w = Math.min(S.cols - 4, 96);
  const shown = visible(game), rows = bodyRows(game);
  const listMax = Math.max(3, S.rows - 12);
  const listH = Math.max(4, Math.min(listMax, Math.max(shown.length, rows.length)));
  const h = listH + 9;
  const x0 = (S.cols - w) >> 1, y0 = Math.max(1, (S.rows - h) >> 1);
  S.blank(x0, y0, w, h);
  const line = (y) => { for (let x = x0; x < x0 + w; x++) S.put(x, y, "-", 70, 70, 80); };
  line(y0); line(y0 + 2); line(y0 + h - 1);

  S.text(x0 + 2, y0 + 1, "INVENTORY", 255, 230, 140);
  const tw = tabs(x0 + 13, y0 + 1, ["Pack", "Equipment"], TABS.indexOf(tab));
  const header = `LV ${p.level} · STR ${attr(p, "str")} · HP ${p.hp}/${maxHp(p)} · armour ${armourValue(p)} · DV ${dv(p)} · keys ${p.keys}`;
  const hx = Math.max(x0 + 14 + tw, x0 + w - header.length - 2);
  S.text(hx, y0 + 1, header.slice(0, Math.max(0, x0 + w - 2 - hx)), 170, 170, 170);

  const top = y0 + 4;
  let sel = null;
  if (tab === "pack") sel = drawPack(game, { x0, w, top, listH, shown });
  else sel = drawBody(game, { x0, w, top, listH, rows });

  const infoY = top + listH;
  line(infoY);
  if (sel) {
    let info = itemInfo(game, sel);
    if (tab === "pack") info += compareLine(p, sel);
    if (isGear(sel) && !sel.known && !sel.relic) info += " · enchantment unknown until equipped";
    wrap(info, w - 4).slice(0, 2).forEach((l, k) => S.text(x0 + 2, infoY + 1 + k, l, 190, 190, 200));
  }
  // The keys, "I close" first so a narrow screen never loses it; the hint where it fits.
  const hint = game.view === "map" ? "  (each takes a turn)" : "  (game paused)";
  const keys = tab === "pack" ? "I close · E use · T throw · X drop · F filter · L look · R swap weapons · Tab equipment"
                              : "I close · E take off or put on · L look · R swap weapons · Tab pack";
  const help = (keys.length + hint.length <= w - 4 ? keys + hint : keys).slice(0, w - 4);
  S.text(x0 + 2, y0 + h - 2, help, 120, 120, 130);
  const at = { x: x0 + 2, y: y0 + h - 2, text: help };
  hitLabel(at, "I close", { key: "Escape" });
  hitLabel(at, tab === "pack" ? "Tab equipment" : "Tab pack", { key: "Tab" });
  hitLabel(at, "F filter", { key: "KeyF" });
  hitLabel(at, "L look", { key: "KeyL" });
}

function drawPack(game, { x0, w, top, listH, shown }) {
  const p = game.player, inv = p.inv;
  const f = game.invFilter === "for" ? { label: `for your ${partLabel(p.body.parts.find((q) => q.id === game.invFor) || { id: game.invFor }).toLowerCase()}` } : filterOf(game.invFilter || "all");
  const cap = carryCap(p), weight = packWeight(p);
  const summary = `F: ${f.label} (${shown.length} of ${inv.length}) · weight ${weight} of ${cap} · ${formatFunds(p)} of ${purseCap(p)}`;
  S.text(x0 + 2, top - 1, summary.slice(0, w - 4), 150, 150, 160);
  const state = { sel: Math.max(0, shown.indexOf(game.invSel)), top: game.invTop || 0 };
  list(state, {
    x: x0 + 1, y: top, w: w - 2, h: listH, items: shown, empty: inv.length ? "(nothing of that kind: F shows more)" : "(nothing)",
    row: (i, k, { x, y, w: rw, sel }) => packRow(game, inv[i], i, { x, y, w: rw, sel }),
  });
  game.invTop = state.top;
  game.invPage = listH;
  return inv[game.invSel] && shown.includes(game.invSel) ? inv[game.invSel] : null;
}

function packRow(game, it, i, { x, y, w, sel }) {
  const p = game.player;
  const [glyph, color] = itemGlyph(game, it);
  if (sel) S.text(x, y, ">", 255, 230, 140);
  S.put(x + 2, y, glyph, ...color);
  const name = itemName(game, it) + (it.count > 1 ? ` x${it.count}` : "");
  S.text(x + 4, y, name.slice(0, Math.max(0, w - 30)), ...(it.relic ? RELIC_COLOR : sel ? [255, 255, 255] : [200, 200, 200]));
  // Right side: what you know about it: strength needed, and good / neutral / bad.
  let right = x + w - 2;
  if (RULES.stats === "legacy" && (it.kind === "weapon" || it.kind === "armour")) {
    const need = strNeeded(it), tag = `needs ${need} STR`;
    right -= tag.length;
    S.text(right, y, tag, ...(attr(p, "str") < need ? [255, 110, 100] : [120, 200, 120]));
    right -= 1;
  } else if (it.kind === "weapon" || it.kind === "armour" || it.kind === "missile") {
    // (B4: every attribute it asks for, "STR 21 AGI 17", each red when you lack it)
    const req = Object.entries(requirements(it));
    for (let k = req.length - 1; k >= 0; k--) {
      const [a, n] = req[k], tag = `${a.toUpperCase()} ${n}`;
      right -= tag.length;
      S.text(right, y, tag, ...(attr(p, a) < n ? [255, 110, 100] : [120, 200, 120]));
      right -= 1;
    }
  }
  const aura = itemAura(game, it);
  const named = (it.kind === "potion" && game.knownPotions.has(it.effect)) || (it.kind === "scroll" && game.knownScrolls.has(it.effect));
  if (aura && !named) {
    const [tag, c] = AURA[aura];
    right -= tag.length;
    S.text(right, y, tag, ...c);
  } else if (!aura && (it.kind === "potion" || it.kind === "scroll" || (it.kind === "artifact" && it.known !== true && !it.broken))) {
    right -= 9;
    S.text(right, y, "(unknown)", 140, 140, 140);
  }
}

function drawBody(game, { x0, w, top, listH, rows }) {
  const p = game.player;
  const sockets = rows.some((r) => r.socket) && (p.genotype === "plumb" || rows.some((r) => r.implant));
  S.text(x0 + 2, top - 1, (bodyNote?.(game, p) || "What you wear and hold, part by part.").slice(0, w - 4), 150, 150, 160);
  game.eqSel = Math.max(0, Math.min(game.eqSel || 0, rows.length - 1));
  let topRow = Math.max(0, Math.min(game.eqTop || 0, rows.length - listH));   // keep the selection in view
  if (game.eqSel < topRow) topRow = game.eqSel;
  if (game.eqSel >= topRow + listH) topRow = game.eqSel - listH + 1;
  game.eqTop = topRow;
  const itemX = x0 + 17, socketX = x0 + Math.max(52, Math.min(w - 30, 60));
  for (let k = 0; k < listH && game.eqTop + k < rows.length; k++) {
    const r = rows[game.eqTop + k], y = top + k, sel = game.eqTop + k === game.eqSel;
    hit({ x: x0 + 1, y, w: w - 2, h: 1 }, { bodyRow: game.eqTop + k });
    if (sel) S.text(x0 + 1, y, ">", 255, 230, 140);
    S.text(x0 + 3, y, r.belt ? "Belt" : partLabel(r.part), ...(sel ? [255, 255, 255] : [130, 130, 130]));
    const it = r.item;
    if (it) {
      const [glyph, color] = itemGlyph(game, it);
      S.put(itemX, y, glyph, ...color);
      const curse = it.ench < 0 && it.known ? "  CURSED" : "";
      S.text(itemX + 2, y, (itemName(game, it) + curse + (r.belt ? "  (R: swap)" : "")).slice(0, socketX - itemX - 3), ...nameColor(it));
    } else if (r.both) S.text(itemX + 2, y, `(both hands: ${itemName(game, r.both)})`.slice(0, socketX - itemX - 3), 120, 120, 130);
    else S.text(itemX + 2, y, "(nothing)", 110, 110, 110);
    if (sockets && r.socket) {
      if (r.implant) { S.put(socketX, y, "♦", 120, 210, 235); S.text(socketX + 2, y, itemName(game, r.implant).slice(0, x0 + w - socketX - 4), 150, 210, 230); }
      else S.text(socketX + 2, y, "socket empty", 90, 100, 110);
    }
  }
  if (game.eqTop > 0) S.put(x0 + w - 2, top, "^", ...UI.help);
  if (game.eqTop + listH < rows.length) S.put(x0 + w - 2, top + listH - 1, "v", ...UI.help);
  const row = rows[game.eqSel];
  return row?.item || row?.both || row?.implant || null;
}

function compare(a, b, value, label) {
  const d = value(a) - value(b);
  return d === 0 ? "" : ` · ${d > 0 ? "+" : ""}${d} ${label} vs yours`;
}
// The pack's comparison with what you wield or wear on the body (B1, C4 #12): a weapon's average damage with its
// material as it adds a blow (× its swing ÷ RULES.d20.swingRef, as its line shows it); body armour's armour with its
// material. (Enchantment stays out: unknown until worn.) The parent's gear has no material: its numbers as before.
const avgBlow = (it) => { const w = WEAPONS[it.id]; return (w.dmg[0] + w.dmg[1]) / 2 + Math.round((it.material || 0) * w.swing / RULES.d20.swingRef); };
const bodyAv = (it) => (it ? ITEM_KINDS.armour.av({ ...it, ench: 0 }) : 0);
export function compareLine(p, sel) {
  const weapon = wielded(p);
  if (sel?.kind === "weapon" && weapon) return compare(sel, weapon, avgBlow, "avg damage");
  if (sel?.kind === "armour" && (ARMOURS[sel.id].slot || "body") === "body") return compare(sel, wornOn(p, "body"), bodyAv, "armour");
  return "";
}
