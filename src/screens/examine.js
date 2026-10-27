// Examine (TECH_DESIGN §4.2 `examine`; owner WS5): the full description of an item or a creature: all its bonuses
// and a comparison with what you wear there; or a creature's level, attitude, health and AV/DV bands (exact numbers
// with a level-eye implant), and its weaknesses and resistances (combat.js resistText, as the map's line has them).
// Opened by an `inspect` event with open: true (WS8's look cursor L, in either view; the map's held hover emits
// open: false since 0D1 and opens nothing), and by L in the inventory (data: { item }). Paused; Esc (or Enter,
// Space, E, L, a click) closes it and returns where you were. Tab: the next thing on that tile.
//
//   openExamine(game, data) → bool       data: an inspect payload { zone, x, y, z, creature?, item?, block?, open }
//                                        or { item }; false (nothing opened) when there is nothing to describe
//   examineLines(game, subject) → [{ text, color }]    subject: { creature } | { item } | { tile, block }
//   examineSubjects(data) → [subject]                   what the screen can show for that payload, in order
import * as S from "../screen.js";
import { registerScreen, pushMode, popMode, modeData } from "../screens.js";
import { UI, wrap, hitLabel } from "../ui.js";
import { on } from "../events.js";
import { itemName, itemGlyph, itemDetails, itemBonuses, itemPrice, itemWeight, isGear, ITEM_KINDS, ARMOURS } from "../items.js";
import { slotsFor, wornOn, defaultPart } from "../body.js";
import { partLabel } from "../inventory.js";
import { CREATURE_TYPES, ELITES, canTalk } from "../creatures.js";
import { attitude } from "../factions.js";
import { resistText, avOf, dvOf } from "../combat.js";
import { maxHp } from "../stats.js";
import { formatPrice } from "../currency.js";
import { BLOCKS } from "../world.js";
import { describeTile } from "../renderMap.js";
import { implantEffect } from "../bodymods/implants.js";

export const MODE = "examine";

// --- What there is to see ---------------------------------------------------------------------------------------
export function examineSubjects(data) {
  if (!data) return [];
  const out = [];
  if (data.creature) out.push({ creature: data.creature });
  if (data.item) out.push({ item: data.item });
  if (!out.length && (data.block !== undefined || data.x !== undefined)) out.push({ tile: { x: data.x, y: data.y }, block: data.block });
  return out;
}

export function openExamine(game, data) {
  const subjects = examineSubjects(data);
  if (!subjects.length) return false;
  game.travel = null;
  pushMode(game, MODE, { ...data, subjects, k: 0 });
  return true;
}
on("inspect", (game, payload) => { if (payload?.open) openExamine(game, payload); });

// --- Words -------------------------------------------------------------------------------------------------------
const KEY_WORDS = {
  crit: (n) => `${n > 0 ? "+" : ""}${Math.round(n * 100)}% crits`, swing: (n) => `swings ${Math.round(n * 100)}% faster`,
  reach: (n) => `${n > 0 ? "+" : ""}${n} reach`, maxDmg: (n) => `+${n} max damage`, leech: () => "hits sometimes heal you",
  crush: () => "double damage to brittle foes", thorns: (n) => `whoever hits you takes ${n}`, ward: (n) => `arrows and bolts do ${n} less`,
  regen: (n) => (n > 0 ? "slowly heals you" : "slowly drains you"), darkRegen: () => "heals you fast with your torch out",
  maxHp: (n) => `${n > 0 ? "+" : ""}${n} max HP`, armour: (n) => `${n > 0 ? "+" : ""}${n} armour`, av: (n) => `${n > 0 ? "+" : ""}${n} AV`,
  dv: (n) => `${n > 0 ? "+" : ""}${n} DV`, speed: (n) => `${n > 0 ? "+" : ""}${Math.round(n * 100)}% speed`,
  torch: (n) => (n > 0 ? "a brighter torch" : "a dimmer torch"), sense: (n) => `creatures within ${n} tiles show on the map`,
  darkSight: () => "you see a little with your torch out", stealth: (n) => (n > 0 ? "harder to notice" : "easier to notice"),
  firstBlock: () => "a blow misses you now and then", jump: (n) => `jump ${n} block${n === 1 ? "" : "s"} higher`,
  featherFall: () => "falls never hurt you", killHeal: (n) => (n > 0 ? `+${n} HP for every kill` : "kills hurt you"),
  examine: (n) => `${n > 0 ? "+" : ""}${n} to examine`, toHit: (n) => `${n > 0 ? "+" : ""}${n} to hit`,
};
const ATTR_WORDS = { str: "STR", agi: "AGI", tou: "TOU", int: "INT", wil: "WIL", ego: "EGO" };
export function bonusWords(b) {
  return Object.entries(b || {}).filter(([, n]) => n).map(([k, n]) => (ATTR_WORDS[k] ? `${n > 0 ? "+" : ""}${n} ${ATTR_WORDS[k]}` : KEY_WORDS[k]?.(n) || `${k} ${n > 0 ? "+" : ""}${n}`));
}

const hpBand = (f) => (f >= 1 ? "unhurt" : f >= 0.75 ? "scratched" : f >= 0.5 ? "hurt" : f >= 0.25 ? "badly hurt" : "near death");
const avBand = (n) => (n <= 0 ? "no armour" : n <= 1 ? "light armour" : n <= 3 ? "armoured" : "heavily armoured");
const dvBand = (n) => (n <= 6 ? "easy to hit" : n <= 9 ? "quick" : n <= 12 ? "hard to hit" : "very hard to hit");
const ATTITUDE = { hostile: ["out for you", [255, 120, 100]], wary: ["wary of you", [255, 200, 120]], neutral: ["minding its own business", [200, 200, 200]],
  friendly: ["friendly", [140, 230, 140]], unaware: ["hasn't noticed you", [170, 170, 200]] };

export function examineLines(game, subject) {
  const out = [], add = (text, color = UI.text) => out.push({ text, color });
  const p = game.player;
  if (subject.creature) {
    const c = subject.creature, t = CREATURE_TYPES[c.type] || {};
    if (canTalk(c)) {
      add(`${c.name}${c.title || t.title ? `, ${c.title || t.title}` : ""}`, UI.title);
      if (t.info) add(t.info);
      add(`${capital(ATTITUDE[attitude(game, c, p)]?.[0] || "here")}.`, ATTITUDE[attitude(game, c, p)]?.[1]);
      return out;
    }
    add(`${capital(c.name)}, level ${c.level || 1}`, UI.title);
    if (t.info) add(t.info);
    const [word, color] = ATTITUDE[attitude(game, c, p)] || ["here", UI.text];
    add(`It's ${word}.`, color);
    const exact = implantEffect(p, "readsCreatures"), mhp = c.maxHp || t.hp || 1, av = avOf(c), dvv = dvOf(game, c);
    add(exact ? `Health ${Math.max(0, Math.ceil(c.hp))} of ${mhp} · AV ${av} · DV ${dvv}` : `${capital(hpBand(c.hp / mhp))} · ${avBand(av)} · ${dvBand(dvv)}`,
      exact ? [150, 210, 230] : UI.dim);
    const res = resistText(c);
    if (res) add(`${capital(res)}.`, [255, 200, 140]);
    if (c.elite && ELITES[c.elite]?.info) add(`${capital(ELITES[c.elite].adj)}: ${ELITES[c.elite].info}.`, [255, 200, 140]);
    if (!exact) add("(A level-eye implant would read its exact numbers.)", UI.help);
    return out;
  }
  if (subject.item) {
    const it = subject.item, def = ITEM_KINDS[it.kind] || {};
    add(capital(itemName(game, it) + (it.count > 1 ? ` x${it.count}` : "")), UI.title);
    for (const l of itemDetails(game, it)) if (l) add(l);
    const words = bonusWords(itemBonuses(it));
    if (words.length && (it.known !== false || !isGear(it) || it.relic)) add(`While worn: ${words.join(", ")}.`, [150, 220, 150]);
    const av = def.av?.(it);
    if (av && it.known) add(`Armour ${av}.`, [150, 220, 150]);
    if (isGear(it)) {
      const parts = slotsFor(p, it), mine = parts.map((id) => wornOn(p, id)).find((x) => x && x !== it);
      if (!parts.length) add("It fits no part of your body.", UI.bad);
      else if (mine) {
        const theirs = bonusWords(itemBonuses(mine)), avMine = ITEM_KINDS[mine.kind]?.av?.(mine);
        add(`You wear ${itemName(game, mine)} there${avMine ? ` (armour ${avMine})` : ""}${theirs.length ? `: ${theirs.join(", ")}` : ""}.`, UI.dim);
      } else if (!parts.some((id) => wornOn(p, id) === it)) {
        const part = p.body.parts.find((q) => q.id === defaultPart(p, it));
        add(`Your ${part ? partLabel(part).toLowerCase() : "body"} is free for it.`, UI.dim);
      }
    }
    const price = itemPrice(it), weight = itemWeight(it);
    add(`${price ? `Worth about ${formatPrice(price)}` : "Not for sale"}${weight ? ` · weight ${weight}` : ""}.`, UI.help);
    return out;
  }
  const name = subject.block !== undefined && BLOCKS[subject.block] ? BLOCKS[subject.block].name : null;
  if (name) add(capital(name), UI.title);
  if (subject.tile && game.zone) { const d = describeTile(game, subject.tile); if (d) add(d); }
  return out;
}
const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// --- The screen ------------------------------------------------------------------------------------------------------
function drawExamine(game) {
  const data = modeData(game) || {}, subjects = data.subjects || [], k = Math.min(data.k || 0, subjects.length - 1);
  const subject = subjects[k];
  const w = Math.min(S.cols - 4, 76);
  const lines = subject ? examineLines(game, subject).flatMap(({ text, color }) => wrap(text, w - 6).map((t) => ({ text: t, color }))) : [];
  const h = Math.min(S.rows - 2, lines.length + 6);
  const x0 = (S.cols - w) >> 1, y0 = Math.max(1, (S.rows - h) >> 1);
  S.blank(x0, y0, w, h);
  const rule = (y) => { for (let x = x0; x < x0 + w; x++) S.put(x, y, "-", 90, 80, 120); };
  rule(y0); rule(y0 + h - 1);
  if (subject?.item) { const [g, c] = itemGlyph(game, subject.item); S.put(x0 + 2, y0 + 2, g, ...c); }
  else if (subject?.creature) S.put(x0 + 2, y0 + 2, subject.creature.glyph || "?", ...(subject.creature.color || UI.text));
  lines.slice(0, h - 5).forEach((l, i) => S.text(x0 + 4, y0 + 2 + i, l.text, ...(l.color || UI.text)));
  const more = subjects.length > 1 ? ` · Tab: the ${subjects[(k + 1) % subjects.length].creature ? "creature" : "thing"} there too` : "";
  const help = { x: x0 + 2, y: y0 + h - 2, text: `Esc close${more}` };
  S.text(help.x, help.y, help.text.slice(0, w - 4), 120, 120, 130);
  hitLabel(help, "Esc close", { key: "Escape" });
}

registerScreen(MODE, {
  draw: drawExamine,
  key(game, code) {
    const data = modeData(game) || {};
    if (code === "Tab" && (data.subjects?.length || 0) > 1) { data.k = ((data.k || 0) + 1) % data.subjects.length; return true; }
    if (["Escape", "Enter", "NumpadEnter", "Space", "KeyE", "KeyL", "KeyI"].includes(code)) { popMode(game); return true; }
    return false;
  },
  mouse(game, button) { if (button === 0 || button === 2) popMode(game); },
});
