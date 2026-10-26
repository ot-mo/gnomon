// The inventory screen (I). The game is paused while it's open, in either view.
// ↑↓ / W S / mouse: select · E / Enter / Space: use, read or equip · T: throw · X: drop · I / Esc: close
// Using something on the map costs game time (returned by useSelected), like any other action.
//
// Gear's enchantment is hidden until you equip it. Cursed gear (−) can't be taken off
// until a scroll of remove curse lifts the curse.
import * as S from "./screen.js";
import { WEAPONS, ARMOURS, ELEMENTS, itemName, itemInfo, itemGlyph, itemAura, makeItem, isGear, strNeeded, RELIC_COLOR } from "./items.js";
import { drinkPotion, readScroll } from "./effects.js";
import { armourValue, bonus, weaponReach } from "./player.js";
import { attr, maxHp, invalidateStats, clampHp } from "./stats.js";

const DRINK_TIME = 0.5, READ_TIME = 1.0, EQUIP_TIME = 1.0;
const layout = { x0: 0, y0: 0, listY: 0, w: 0 };   // where the list was drawn, for mouse clicks
const TOP = 9;   // the item list starts this many rows below the top of the box
const AURA = { good: ["(good)", [120, 220, 120]], neutral: ["(neutral)", [170, 170, 170]], bad: ["(bad)", [255, 110, 100]] };

export function openInventory(game) {
  game.invReturn = game.mode;
  game.mode = "inventory";
  game.invSel = Math.min(game.invSel || 0, Math.max(0, game.player.inv.length - 1));
}

export function closeInventory(game) {
  game.mode = game.invReturn;
}

// Returns the game time the action took (0 if nothing happened), null to just close,
// or "throw" (the selected stack is in game.throwStack: main.js throws it).
export function inventoryKey(game, code) {
  const inv = game.player.inv;
  if (code === "ArrowUp" || code === "KeyW") game.invSel = Math.max(0, game.invSel - 1);
  else if (code === "ArrowDown" || code === "KeyS") game.invSel = Math.min(inv.length - 1, game.invSel + 1);
  else if (code === "KeyE" || code === "Enter" || code === "Space" || code === "NumpadEnter") return useSelected(game);
  else if (code === "KeyT") {
    const it = inv[game.invSel];
    if (it && (it.kind === "potion" || it.kind === "knife" || it.kind === "bomb")) { game.throwStack = it; return "throw"; }
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

export function useSelected(game) {
  const p = game.player;
  const it = p.inv[game.invSel];
  if (!it) return 0;
  if (it.kind === "potion") {
    takeOne(p, game.invSel);
    drinkPotion(game, it.effect);
    return DRINK_TIME;
  }
  if (it.kind === "scroll") {
    takeOne(p, game.invSel);
    readScroll(game, it.effect);
    game.invSel = Math.min(game.invSel, Math.max(0, p.inv.length - 1));
    return READ_TIME;
  }
  if (isGear(it)) return equip(game, it, game.invSel) ? EQUIP_TIME : 0;
  return 0;
}

// Put on (or take in hand) a piece of gear from the inventory. A new weapon goes into your hand
// and the one you held moves to your belt (the sidearm, swapped in with R); whatever was on
// your belt goes back in your pack. Returns true if it worked.
export function equip(game, it, index) {
  const p = game.player;
  if (it.kind === "weapon" || it.kind === "armour") {
    const need = strNeeded(it);
    if (attr(p, "str") < need) {
      game.log(`You're not strong enough for the ${itemName(game, it)} (needs ${need} STR, you have ${attr(p, "str")}).`, [255, 150, 120]);
      return false;
    }
  }
  const slot = it.kind;   // "weapon", "armour", "ring" or "amulet"
  const old = p[slot];
  if (old && old.ench < 0) {
    game.log(`Your cursed ${itemName(game, old)} won't come off! A scroll of remove curse would help.`, [200, 80, 120]);
    return false;
  }
  p.inv.splice(index, 1);
  p[slot] = it;
  invalidateStats(p);   // STR, max HP and armour follow your gear (stats.js)
  clampHp(p);
  if (slot === "weapon") {
    if (p.sidearm) p.inv.push(p.sidearm);
    p.sidearm = old;
  } else if (old && !(slot === "armour" && old.id === "clothes")) p.inv.push(old);   // plain clothes just get left behind
  // Wearing it shows what it really is.
  const wasKnown = it.known;
  it.known = true;
  const verb = slot === "weapon" ? "wield" : "put on";
  if (!wasKnown && it.ench < 0) game.log(`You ${verb} the ${itemName(game, it)}. A chill runs through you: it's cursed, and it won't let go!`, [200, 80, 120]);
  else if (!wasKnown && it.ench > 0 && !it.relic) game.log(`You ${verb} the ${itemName(game, it)}. It hums with a blessing.`, [255, 245, 200]);
  else game.log(`You ${verb} the ${itemName(game, it)}.`, [220, 220, 220]);
  if (slot === "weapon" && old) game.log(`Your ${itemName(game, old)} goes on your belt. (R: swap weapons)`, [170, 170, 170]);
  game.invSel = Math.min(game.invSel, Math.max(0, p.inv.length - 1));
  return true;
}

// R: swap the weapon in your hand with the one on your belt. Returns the time it took (0 if not).
export function swapWeapons(game) {
  const p = game.player;
  if (!p.sidearm) { game.log("You have no second weapon on your belt. (Wield another weapon and the old one goes there.)", [170, 170, 170]); return 0; }
  if (p.weapon.ench < 0) { game.log(`Your cursed ${itemName(game, p.weapon)} won't leave your hand!`, [200, 80, 120]); return 0; }
  if (attr(p, "str") < strNeeded(p.sidearm)) { game.log(`You're not strong enough for the ${itemName(game, p.sidearm)}.`, [255, 150, 120]); return 0; }
  [p.weapon, p.sidearm] = [p.sidearm, p.weapon];
  invalidateStats(p);
  clampHp(p);
  const fresh = !p.weapon.known;
  p.weapon.known = true;
  const bad = fresh && p.weapon.ench < 0;
  game.log(`You draw the ${itemName(game, p.weapon)}.${bad ? " It's cursed, and it won't let go!" : ""}`, bad ? [200, 80, 120] : [220, 220, 220]);
  p.attackCd = Math.max(p.attackCd, 0.4);
  return 0.4;
}

function dropSelected(game) {
  const p = game.player;
  const it = p.inv[game.invSel];
  if (!it) return 0;
  const one = takeOne(p, game.invSel);
  const item = makeItem(one, p.x, p.y, p.z);
  item.dropped = true;   // don't pick it straight back up
  game.zone.items.push(item);
  game.log(`You drop the ${itemName(game, one)}.`, [170, 170, 170]);
  game.invSel = Math.min(game.invSel, Math.max(0, p.inv.length - 1));
  return 0;
}

// Remove one item from a slot (potions and scrolls come off their stack) and return it.
function takeOne(p, index) {
  const it = p.inv[index];
  if (it.kind === "potion" || it.kind === "scroll" || it.kind === "knife" || it.kind === "bomb") {
    it.count--;
    if (it.count <= 0) p.inv.splice(index, 1);
    return { kind: it.kind, effect: it.effect };
  }
  p.inv.splice(index, 1);
  return it;
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

  const wpn = WEAPONS[p.weapon.id], arm = ARMOURS[p.armour.id];
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
  const el = p.weapon.element ? ` · ${ELEMENTS[p.weapon.element].info}` : "";
  const maxDmg = bonus(p, "maxDmg");
  slotLine(y0 + 3, "Wielding", p.weapon, `${wpn.dmg[0] + p.weapon.ench}-${wpn.dmg[1] + p.weapon.ench + maxDmg} dmg · ${wpn.swing}s · reach ${weaponReach(p).toFixed(1)}${el}`);
  slotLine(y0 + 4, "Belt", p.sidearm, p.sidearm ? "R: swap" : "");
  slotLine(y0 + 5, "Wearing", p.armour, `armour ${arm.armour + p.armour.ench}`);
  slotLine(y0 + 6, "Ring", p.ring, p.ring ? itemInfo(game, p.ring) : "");
  slotLine(y0 + 7, "Amulet", p.amulet, p.amulet ? itemInfo(game, p.amulet) : "");
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
  const hint = game.invReturn === "map" ? "each takes a turn" : "game paused";
  S.text(x0 + 2, y0 + h - 2, `E use/equip · T throw · X drop · ↑↓ select · R swap weapons · I close  (${hint})`.slice(0, w - 4), 120, 120, 130);
}

function compare(a, b, value, label) {
  const d = value(a) - value(b);
  return d === 0 ? "" : ` · ${d > 0 ? "+" : ""}${d} ${label} vs yours`;
}
