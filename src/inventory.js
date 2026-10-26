// The inventory screen (I). The game is paused while it's open, in either view.
// ↑↓ / W S / mouse: select · E / Enter / Space: use, read or equip · T: throw · X: drop · I / Esc: close
// Using something on the map costs game time (returned by useSelected), like any other action.
//
// Gear's enchantment is hidden until you equip it. Cursed gear (−) can't be taken off
// until a scroll of remove curse lifts the curse.
import * as S from "./screen.js";
import { pushMode, popMode } from "./screens.js";
import { hitLabel } from "./ui.js";
import { WEAPONS, ARMOURS, ELEMENTS, ITEM_KINDS, itemName, itemInfo, itemGlyph, itemAura, makeItem, isGear, strNeeded, takeOne,
  registerItemAction, useItem, canUse, RELIC_COLOR } from "./items.js";
import { drinkPotion, readScroll } from "./effects.js";
import { RULES } from "./rules.js";
import { armourValue, bonus, weaponReach } from "./player.js";
import { attr, maxHp } from "./stats.js";
import { defaultPart, canEquip, equip as bodyEquip, swapBelt, wielded, wornOn, belt } from "./body.js";

// What using things from the pack does (the kinds in content name these actions).
registerItemAction("drink", (game, e, it) => { takeOne(e, it); drinkPotion(game, it.effect); return RULES.body.drinkTime; });
registerItemAction("read", (game, e, it) => { takeOne(e, it); readScroll(game, it.effect); return RULES.body.readTime; });
registerItemAction("wear", (game, e, it) => (equip(game, it, e.inv.indexOf(it)) ? RULES.body.equipTime : 0));

const layout = { x0: 0, y0: 0, listY: 0, w: 0 };   // where the list was drawn, for mouse clicks
const TOP = 9;   // the item list starts this many rows below the top of the box
const AURA = { good: ["(good)", [120, 220, 120]], neutral: ["(neutral)", [170, 170, 170]], bad: ["(bad)", [255, 110, 100]] };

// The inventory is a screen on the mode stack (src/screens/inventory.js): opening pushes it over the view
// you are in; closing pops back there (in 3D the pointer locks again).
export function openInventory(game) {
  pushMode(game, "inventory");
  game.invSel = Math.min(game.invSel || 0, Math.max(0, game.player.inv.length - 1));
}

export function closeInventory(game) {
  if (game.mode === "inventory") popMode(game);
}

// The keys inventoryKey answers (any other goes on to the global bindings: M, N).
export const INVENTORY_KEYS = new Set(["ArrowUp", "KeyW", "ArrowDown", "KeyS", "KeyE", "Enter", "Space", "NumpadEnter", "KeyT", "KeyX", "KeyR", "KeyI", "Escape"]);

// Returns the game time the action took (0 if nothing happened), null to just close,
// or "throw" (the selected stack is in game.throwStack: main.js throws it).
export function inventoryKey(game, code) {
  const inv = game.player.inv;
  if (code === "ArrowUp" || code === "KeyW") game.invSel = Math.max(0, game.invSel - 1);
  else if (code === "ArrowDown" || code === "KeyS") game.invSel = Math.min(inv.length - 1, game.invSel + 1);
  else if (code === "KeyE" || code === "Enter" || code === "Space" || code === "NumpadEnter") return useSelected(game);
  else if (code === "KeyT") {
    const it = inv[game.invSel];
    if (it && ITEM_KINDS[it.kind]?.throwable) { game.throwStack = it; return "throw"; }
    game.log("You can throw potions, throwing knives and bombs.", [170, 170, 170]);
  }
  else if (code === "KeyX") return dropSelected(game);
  else if (code === "KeyR") return swapWeapons(game);
  else if (code === "KeyI" || code === "Escape") return null;
  return 0;
}

// Click a row to select it; click the selected row again to use it.
export function inventoryClick(game, cell) {
  if (!cell) return 0;
  const k = cell.y - layout.listY;
  if (k < 0 || k >= game.player.inv.length || cell.x < layout.x0 || cell.x >= layout.x0 + layout.w) return 0;
  if (k === game.invSel) return useSelected(game);
  game.invSel = k;
  return 0;
}

// E: use the selected thing the way its kind says (drink, read, put on: items.js registry).
export function useSelected(game) {
  const p = game.player;
  const it = p.inv[game.invSel];
  if (!it || !canUse(it)) return 0;
  const t = useItem(game, p, it);
  game.invSel = Math.min(game.invSel, Math.max(0, p.inv.length - 1));
  return t;
}

// Put on (or take in hand) a piece of gear from the inventory, on the part the body picks for it
// (body.js defaultPart). A new weapon goes into your hand and the one you held moves to your belt
// (swapped in with R); whatever was on your belt goes back in your pack. Returns true if it worked.
export function equip(game, it, index) {
  const p = game.player;
  const part = defaultPart(p, it);
  const check = canEquip(game, p, it, part);
  if (!check.ok) {
    if (check.reason === "weak") game.log(`You're not strong enough for the ${itemName(game, it)} (needs ${check.need} STR, you have ${attr(p, "str")}).`, [255, 150, 120]);
    else if (check.reason === "cursed") game.log(`Your cursed ${itemName(game, check.item)} won't come off! A scroll of remove curse would help.`, [200, 80, 120]);
    else game.log(`You have nowhere to put the ${itemName(game, it)}.`, [170, 170, 170]);
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
  if (!wasKnown && it.ench < 0) game.log(`You ${verb} the ${itemName(game, it)}. A chill runs through you: it's cursed, and it won't let go!`, [200, 80, 120]);
  else if (!wasKnown && it.ench > 0 && !it.relic) game.log(`You ${verb} the ${itemName(game, it)}. It hums with a blessing.`, [255, 245, 200]);
  else game.log(`You ${verb} the ${itemName(game, it)}.`, [220, 220, 220]);
  if (holds && old) game.log(`Your ${itemName(game, old)} goes on your belt. (R: swap weapons)`, [170, 170, 170]);
  game.invSel = Math.min(game.invSel, Math.max(0, p.inv.length - 1));
  return true;
}

// R: swap the weapon in your hand with the one on your belt. Returns the time it took (0 if not).
export function swapWeapons(game) {
  const p = game.player;
  const r = swapBelt(game, p);
  if (!r.ok) {
    if (r.reason === "empty") game.log("You have no second weapon on your belt. (Wield another weapon and the old one goes there.)", [170, 170, 170]);
    else if (r.reason === "cursed") game.log(`Your cursed ${itemName(game, r.item)} won't leave your hand!`, [200, 80, 120]);
    else if (r.reason === "weak") game.log(`You're not strong enough for the ${itemName(game, belt(p))}.`, [255, 150, 120]);
    return 0;
  }
  const w = wielded(p);
  const fresh = !w.known;
  w.known = true;
  const bad = fresh && w.ench < 0;
  game.log(`You draw the ${itemName(game, w)}.${bad ? " It's cursed, and it won't let go!" : ""}`, bad ? [200, 80, 120] : [220, 220, 220]);
  p.attackCd = Math.max(p.attackCd, r.time);
  return r.time;
}

function dropSelected(game) {
  const p = game.player;
  const it = p.inv[game.invSel];
  if (!it) return 0;
  const one = takeOne(p, it);
  const item = makeItem(one, p.x, p.y, p.z);
  item.dropped = true;   // don't pick it straight back up
  game.zone.items.push(item);
  game.log(`You drop the ${itemName(game, one)}.`, [170, 170, 170]);
  game.invSel = Math.min(game.invSel, Math.max(0, p.inv.length - 1));
  return 0;
}

// ---------------------------------------------------------------------------
export function drawInventory(game) {
  const p = game.player;
  const w = Math.min(S.cols - 4, 80);
  const rows = Math.max(1, p.inv.length);
  const h = rows + TOP + 7;
  const x0 = (S.cols - w) >> 1, y0 = Math.max(1, (S.rows - h) >> 1);
  S.blank(x0, y0, w, h);
  const line = (y) => { for (let x = x0; x < x0 + w; x++) S.put(x, y, "-", 70, 70, 80); };
  line(y0); line(y0 + h - 1);

  const header = `LV ${p.level} · STR ${attr(p, "str")} · HP ${p.hp}/${maxHp(p)} · armour ${armourValue(p)} · keys ${p.keys}`;
  S.text(x0 + 2, y0 + 1, "INVENTORY", 255, 230, 140);
  S.text(x0 + w - header.length - 2, y0 + 1, header, 170, 170, 170);

  const weapon = wielded(p), armour = wornOn(p, "body"), ring = wornOn(p, "finger_r"), amulet = wornOn(p, "neck"), sidearm = belt(p);
  const wpn = WEAPONS[weapon.id], arm = armour ? ARMOURS[armour.id] : { armour: 0 };
  const curse = (it) => (it.ench < 0 ? "  CURSED" : "");
  const nameColor = (it) => (it.ench < 0 ? [255, 110, 100] : it.relic ? RELIC_COLOR : [230, 230, 240]);
  const slotLine = (y, label, it, detail) => {
    S.text(x0 + 2, y, label, 130, 130, 130);
    if (!it) { S.text(x0 + 12, y, "(nothing)", 110, 110, 110); return; }
    const name = (itemName(game, it) + curse(it)).slice(0, 34);
    S.text(x0 + 12, y, name, ...nameColor(it));
    const dx = Math.max(36, 12 + name.length + 2);
    S.text(x0 + dx, y, detail.slice(0, Math.max(0, w - dx - 2)), 150, 150, 160);
  };
  const el = weapon.element ? ` · ${ELEMENTS[weapon.element].info}` : "";
  const maxDmg = bonus(p, "maxDmg");
  slotLine(y0 + 3, "Wielding", weapon, `${wpn.dmg[0] + weapon.ench}-${wpn.dmg[1] + weapon.ench + maxDmg} dmg · ${wpn.swing}s · reach ${weaponReach(p).toFixed(1)}${el}`);
  slotLine(y0 + 4, "Belt", sidearm, sidearm ? "R: swap" : "");
  slotLine(y0 + 5, "Wearing", armour, armour ? `armour ${arm.armour + armour.ench}` : "");
  slotLine(y0 + 6, "Ring", ring, ring ? itemInfo(game, ring) : "");
  slotLine(y0 + 7, "Amulet", amulet, amulet ? itemInfo(game, amulet) : "");
  line(y0 + 8);

  layout.x0 = x0; layout.w = w; layout.listY = y0 + TOP;
  if (!p.inv.length) S.text(x0 + 4, y0 + TOP, "(nothing)", 120, 120, 120);
  p.inv.forEach((it, k) => {
    const y = y0 + TOP + k, sel = k === game.invSel;
    const [glyph, color] = itemGlyph(game, it);
    if (sel) S.text(x0 + 1, y, ">", 255, 230, 140);
    S.put(x0 + 3, y, glyph, ...color);
    const name = itemName(game, it) + (it.count > 1 ? ` x${it.count}` : "");
    S.text(x0 + 5, y, name, ...(it.relic ? RELIC_COLOR : sel ? [255, 255, 255] : [200, 200, 200]));
    // Right side: what you know about it — strength needed, and good / neutral / bad.
    let right = x0 + w - 2;
    if (it.kind === "weapon" || it.kind === "armour") {
      const need = strNeeded(it), tag = `needs ${need} STR`;
      right -= tag.length;
      S.text(right, y, tag, ...(attr(p, "str") < need ? [255, 110, 100] : [120, 200, 120]));
      right -= 1;
    }
    const aura = itemAura(game, it);
    const named = (it.kind === "potion" && game.knownPotions.has(it.effect)) || (it.kind === "scroll" && game.knownScrolls.has(it.effect));
    if (aura && !named) {
      const [tag, c] = AURA[aura];
      right -= tag.length;
      S.text(right, y, tag, ...c);
    } else if (!aura && (it.kind === "potion" || it.kind === "scroll")) {
      right -= 9;
      S.text(right, y, "(unknown)", 140, 140, 140);
    }
  });

  const infoY = y0 + TOP + rows + 1;
  line(infoY - 1);
  const sel = p.inv[game.invSel];
  if (sel) {
    let info = itemInfo(game, sel);
    if (sel.kind === "weapon") info += compare(WEAPONS[sel.id], wpn, (a) => (a.dmg[0] + a.dmg[1]) / 2, "avg damage");
    if (sel.kind === "armour") info += compare(ARMOURS[sel.id], arm, (a) => a.armour, "armour");
    if (isGear(sel) && !sel.known && !sel.relic) info += " · enchantment unknown until equipped";
    S.text(x0 + 2, infoY, info.slice(0, w - 4), 190, 190, 200);
  }
  const hint = game.view === "map" ? "each takes a turn" : "game paused";
  const help = `E use/equip · T throw · X drop · ↑↓ select · R swap weapons · I close  (${hint})`.slice(0, w - 4);
  S.text(x0 + 2, y0 + h - 2, help, 120, 120, 130);
  hitLabel({ x: x0 + 2, y: y0 + h - 2, text: help }, "I close", { key: "Escape" });
}

function compare(a, b, value, label) {
  const d = value(a) - value(b);
  return d === 0 ? "" : ` · ${d > 0 ? "+" : ""}${d} ${label} vs yours`;
}
