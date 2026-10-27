// Gained a level (or someone taught you a trick): stop and choose (TECH_DESIGN §4.2 `levelup`; WS4 from Phase 1).
// The game waits.
//   The legacy set: the parent's card (hud.js drawLevelUp): one of three perks, four at a milestone; 1-4 or a click.
//   The attribute set (bible §10.7): the card says what the level gave (max HP, a crease, an attribute point: the
//   level's point is credited when its card opens); with a point to spend it first asks which attribute it raises
//   (or keeps it for a later card), then
//   offers the powers (leveling.js offerPowers: 3, or 4 at INT 18+, a major among them at levels 5, 10, 15…).
//   ↑↓ (W S) choose, Enter (E, Space) take, a digit picks a row, a click takes it.
//
//   checkLevelUp(game)      once a frame: in a view with a level (or a gift) pending, open the screen
//   choosePerk(game, k)     take choice k (0-based) and close it (both sets; golden's adapter calls it)
//   levelCard(game)         the attribute set's card as it stands: { level, gift, milestone, step, sel, rows } (checks)
import * as S from "../screen.js";
import { registerScreen, pushMode, popMode } from "../screens.js";
import { offerPerks, offerPowers, takePerk, PERKS, perkLabel } from "../leveling.js";
import { drawLevelUp, levelUpClick } from "../hud.js";
import { RULES } from "../rules.js";
import { attr, mod, raiseAttr, maxHp, ATTRS } from "../stats.js";
import { GENOTYPES } from "../content/genotypes.js";
import { TREES } from "../content/powers.js";
import { UI, modal, box, listKey, listAt, listWheel, wrap, keyHelp, hit } from "../ui.js";

const legacy = () => RULES.stats === "legacy";

export function checkLevelUp(game) {
  const p = game.player;
  if ((game.mode !== "explore" && game.mode !== "map") || !(p.pendingLevels > 0 || p.bonusPerks > 0)) return;
  if (!legacy()) { openCard(game, p); return; }
  game.perkGift = !(p.pendingLevels > 0);
  if (p.pendingLevels > 0) p.pendingLevels--; else p.bonusPerks--;
  game.perkMilestone = !game.perkGift && p.level % 5 === 0 && !p.milestones?.has(p.level);
  if (game.perkMilestone) (p.milestones ||= new Set()).add(p.level);
  game.perkChoices = offerPerks(game.player, game.perkMilestone);
  if (game.perkChoices.length) {
    game.travel = null;
    pushMode(game, "levelup");
  }
}

export function choosePerk(game, k) {
  if (k < 0 || k >= game.perkChoices.length) return;
  takePerk(game, game.perkChoices[k]);
  if (game.mode === "levelup") popMode(game);
}

// --- The attribute set's card ----------------------------------------------------------------------------------
// Levels are resolved in the order they came (two at once: level 9, then 10), each with its own offers.
const card = { level: 0, gift: false, milestone: false, draw: 0, step: "power", sel: 0, top: 0, gains: [] };
export const levelCard = (game) => ({ ...card, rows: rowsOf(game) });

function openCard(game, p) {
  const gift = !(p.pendingLevels > 0);
  const level = gift ? p.level : p.level - p.pendingLevels + 1;
  if (gift) p.bonusPerks--; else p.pendingLevels--;
  const milestone = !gift && level % RULES.progression.level.milestoneEvery === 0;
  const draw = gift ? (p.giftDraws = (p.giftDraws || 0) + 1) : 0;
  if (!gift && level % RULES.progression.level.attrPointEvery === 0) p.attrPoints = (p.attrPoints || 0) + 1;   // this level's point
  Object.assign(card, { level, gift, milestone, draw });
  offer(game);
  const G = GENOTYPES[p.genotype];
  const gains = gift ? [] : [`+${Math.max(RULES.hp.perLevelMin, RULES.hp.perLevel + mod(p, "tou"))} max HP`,
    G?.creasesPerLevel && `+${G.creasesPerLevel} crease`, level % RULES.progression.level.attrPointEvery === 0 && "an attribute point"].filter(Boolean);
  Object.assign(card, { gains, sel: 0, top: 0, step: p.attrPoints > 0 ? "attr" : "power" });
  if (card.step === "power" && !game.perkChoices.length) return;   // nothing left to learn and no point to spend
  game.travel = null;
  pushMode(game, "levelup");
}

// The powers this card offers, drawn again once its attribute points are spent: INT raised to 18 there makes 4
// (the same seed, level and draw: the same powers, and one more).
function offer(game) { game.perkChoices = offerPowers(game, game.player, { level: card.level, milestone: card.milestone, draw: card.draw }); }

// The rows of the step on show: an attribute and what it would become, or a power.
function rowsOf(game) {
  const p = game.player;
  if (card.step === "attr") return [...ATTRS.map((k) => ({ attr: k })), { later: true }];
  return game.perkChoices.map((id) => ({ power: id }));
}

function take(game, row) {
  const p = game.player;
  if (!row) return;
  if (row.attr || row.later) {
    if (row.attr) {
      const before = maxHp(p);
      raiseAttr(p, row.attr, 1);
      p.attrPoints--;
      p.hp += Math.max(0, maxHp(p) - before);   // more TOU: the HP it adds (to every level so far) you have at once
      game.log(`You raise your ${row.attr.toUpperCase()} to ${attr(p, row.attr)}.`, [255, 230, 120]);
    }
    if (row.later || !(p.attrPoints > 0)) { Object.assign(card, { step: "power", sel: 0, top: 0 }); offer(game); }
    if (card.step === "power" && !game.perkChoices.length) popMode(game);
    return;
  }
  takePerk(game, row.power);
  if (game.mode === "levelup") popMode(game);
}

function drawCard(game) {
  const p = game.player, rows = rowsOf(game), power = card.step === "power";
  const per = power ? 3 : 1, w = Math.min(S.cols - 4, 76), h = Math.min(S.rows - 2, rows.length * per + 9);
  const { x0, y0 } = modal(w, h);
  box(x0, y0, w, h, { rules: true });
  const title = card.gift ? "A trick of the trade! Choose a power:"
    : card.milestone ? `LEVEL ${card.level}: A MILESTONE!` : `LEVEL ${card.level}!`;
  S.text(x0 + ((w - title.length) >> 1), y0 + 1, title, ...UI.title);
  const gains = card.gains.join(" · ");
  if (gains) S.text(x0 + ((w - gains.length) >> 1), y0 + 2, gains.slice(0, w - 2), ...UI.info);
  const head = power ? (card.gift ? "" : "Choose a power:") : `An attribute point${p.attrPoints > 1 ? ` (${p.attrPoints} to spend)` : ""}: raise which?`;
  S.text(x0 + 3, y0 + 4, head, ...UI.text);
  card.sel = Math.max(0, Math.min(rows.length - 1, card.sel | 0));
  card.page = rows.length;
  // Each row is `per` lines tall (a power's two lines of text hang under its name); a click anywhere on it takes it.
  rows.forEach((r, i) => {
    const y = y0 + 5 + i * per;
    drawRow(game, r, i, { x: x0 + 2, y, w: w - 4, sel: i === card.sel }, per);
    hit({ x: x0 + 2, y, w: w - 4, h: per }, { list: card, index: i });
  });
  const help = [{ code: "ArrowUp", help: "choose" }, { code: "ArrowDown", help: "choose" }, { code: "Enter", help: power ? "take it" : "raise it" }];
  keyHelp(x0 + 3, y0 + h - 2, w - 6, help);
}

// One row: an attribute (with its next score), keeping the point, or a power (its name, tree and what it does).
function drawRow(game, r, i, { x, y, w, sel }, per) {
  const p = game.player;
  if (sel) S.text(x, y, ">", ...UI.mark);
  S.text(x + 2, y, String(i + 1), ...UI.title);
  if (r.later) { S.text(x + 5, y, "Keep it for a later level", ...(sel ? UI.sel : UI.dim)); return; }
  if (r.attr) {
    const v = attr(p, r.attr);
    S.text(x + 5, y, `${r.attr.toUpperCase()} ${v} -> ${v + 1}`, ...(sel ? UI.sel : UI.text));
    return;
  }
  const def = PERKS[r.power], tree = def.major ? "major" : def.tree ? TREES[def.tree].name : "general";
  S.text(x + 5, y, perkLabel(p, r.power), ...(def.major ? [255, 205, 90] : sel ? UI.sel : UI.text));
  S.text(x + w - tree.length - 1, y, tree, ...UI.help);
  wrap(def.info, w - 7).slice(0, per - 1).forEach((line, j) => S.text(x + 5, y + 1 + j, line, ...UI.dim));
}

const DIGITS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6,
                 Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad7: 6 };

registerScreen("levelup", {
  draw(game) { if (legacy()) drawLevelUp(game); else drawCard(game); },
  key(game, code, repeat) {
    if (legacy()) {
      const k = DIGITS[code];
      if (k === undefined || k > 3) return false;
      if (!repeat) choosePerk(game, k);
      return true;
    }
    const rows = rowsOf(game);
    if (code in DIGITS) { if (!repeat && rows[DIGITS[code]]) { card.sel = DIGITS[code]; take(game, rows[card.sel]); } return true; }
    const r = listKey(card, code, rows.length);
    if (r === "select" && !repeat) take(game, rows[card.sel]);
    return r !== null;
  },
  mouse(game, button, cell) {
    if (button !== 0) return;
    if (legacy()) { choosePerk(game, levelUpClick(game, cell)); return; }
    const i = listAt(card, cell), rows = rowsOf(game);
    if (i >= 0 && rows[i]) { card.sel = i; take(game, rows[i]); }
  },
  wheel(game, sign) { if (legacy()) return false; listWheel(card, sign, rowsOf(game).length); },
});
