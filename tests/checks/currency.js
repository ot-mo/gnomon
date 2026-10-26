// Money (currency.js): TECH_DESIGN §2.10 and the 0B scope, with DECISIONS.md (glim, a counter, purses of
// 200 / 500 / 1,000).
//
//   checkCurrency({ game, startRun, dialogue, npcs, srcFiles }) → { name, ok, problems, stats }
//
//   1. The API on a bare entity: funds, pay (all or nothing), receive (what fits; the overflow comes back),
//      the purse sizes (setPurse refuses a size content doesn't list), formatPrice from CURRENCY, whole
//      amounts only, one backing per kind.
//   2. A new player: no glim, the starting purse.
//   3. Piles: walking over cash with a nearly full purse takes what fits and leaves the rest lying (told
//      once, however often you walk over it); a bigger purse takes the rest. In both views' paths: the
//      3D update and a map step both pick up through pickUpItems.
//   4. The shop (dialogue.js, real key presses): too poor is refused and changes nothing; a purchase takes
//      exactly the row's price, which is the stock price after priceMul (the Haggler perk: a fifth off);
//      a crystal is absorbed by its kind's onPickup; selling pays floor(value × sell share) and is refused
//      when the purse can't hold it; services take their price.
//   5. People: a shrine offering takes its cost; a reward that overflows the purse leaves the rest on
//      the ground as cash (Rook's bounty).
//   6. Migration: no `gold` field, `gold` pile or gold price text is left in src/ (the parent's touch
//      points all go through currency.js); generated levels lay cash, never gold.
import { RULES } from "../../src/rules.js";
import * as C from "../../src/currency.js";
import * as I from "../../src/items.js";
import * as St from "../../src/stats.js";
import { generateDungeonLevel, legacyParams } from "../../src/gen/dungeon.js";
import { makeRng } from "../../src/rng.js";

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
// Uses of the word that are not money: the sound's name, the floor art's key, the parent's pile kind kept
// as an alias (legacy.js), the map legend's word (golden (b) frames show it), and colour names.
const GOLD_OK = [/sfx\("gold"\)/, /case "gold":/, /sound: "gold"/, /FLOOR_ART\.gold/, /^\s*gold:\s*\{ w:/, /registerItemKind\("gold"/,
  /\["\$", \[255, 210, 70\], "gold"\]/, /"golden"/, /gold bands/];

export function checkCurrency({ game, startRun, dialogue, npcs, srcFiles }) {
  const problems = [], stats = {}, t0 = Date.now();
  const fail = (m) => problems.push(m);
  const { CURRENCY } = C;

  // --- 1. The API ----------------------------------------------------------------------------------
  {
    const e = {};
    if (C.funds(e) !== 0) fail(`a bare entity has ${C.funds(e)}`);
    if (C.purseCap(e) !== CURRENCY.startPurse) fail(`purseCap ${C.purseCap(e)}, want ${CURRENCY.startPurse}`);
    const o1 = C.receive(game, e, 150), o2 = C.receive(game, e, 100);
    if (o1 !== 0 || o2 !== 50 || C.funds(e) !== 200) fail(`receive 150 then 100 into 200: overflow ${o1}, ${o2}; funds ${C.funds(e)}`);
    if (C.pay(game, e, 201) || C.funds(e) !== 200) fail("pay more than you have took something");
    if (!C.pay(game, e, 60) || C.funds(e) !== 140) fail(`pay 60: funds ${C.funds(e)}`);
    if (!C.pay(game, e, 0) || C.receive(game, e, 0) !== 0) fail("a zero amount isn't free");
    if (C.setPurse(e, 300) || C.purseCap(e) !== 200) fail("setPurse took a size content doesn't list");
    const sizes = [];
    for (const size of CURRENCY.purses) {
      if (!C.setPurse(e, size)) fail(`setPurse(${size}) refused`);
      const over = C.receive(game, e, 5000);
      sizes.push(`${size}: ${C.funds(e)} (+${over} over)`);
      if (C.funds(e) !== size || C.purseRoom(e) !== 0) fail(`a ${size} purse holds ${C.funds(e)}`);
    }
    stats.purses = sizes;
    for (const bad of [-1, 1.5, NaN, "3"]) {
      let threw = false;
      try { C.receive(game, e, bad); } catch { threw = true; }
      if (!threw) fail(`receive(${JSON.stringify(bad)}) didn't throw`);
    }
    let dup = false;
    try { C.registerBacking("counter", { funds() {}, pay() {}, receive() {} }); } catch { dup = true; }
    if (!dup) fail("a second counter backing was accepted");
    const one = C.formatPrice(1), many = C.formatPrice(12);
    if (one !== `1 ${CURRENCY.name}` || many !== `12 ${CURRENCY.plural}`) fail(`formatPrice: "${one}", "${many}"`);
    if (C.formatFunds({ funds: 7 }) !== `${CURRENCY.glyph}7`) fail(`formatFunds: ${C.formatFunds({ funds: 7 })}`);
    stats.format = [one, many, C.formatFunds({ funds: 7 })];
    if (C.priceLevel(15) !== 1 + 15 / RULES.price.levelStep || C.priceLevel(30) !== C.priceLevel(20)) fail("priceLevel isn't 1 + contentLevel/15");
  }

  // --- 2. A new player -----------------------------------------------------------------------------
  startRun(1234);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  const p = game.player;
  if (C.funds(p) !== 0 || C.purseCap(p) !== CURRENCY.startPurse || "gold" in p) fail(`a new player: funds ${C.funds(p)}, purse ${C.purseCap(p)}${"gold" in p ? ", a gold field" : ""}`);

  // --- 3. Piles --------------------------------------------------------------------------------------
  {
    const logs = [];
    const log = game.log;
    game.log = (m, c) => { logs.push(m); return log.call(game, m, c); };
    p.funds = 195;
    const pile = I.makeItem({ kind: "cash", amount: 12 }, p.x, p.y, p.z);
    game.zone.items.push(pile);
    for (let k = 0; k < 5; k++) I.pickUpItems(game);
    const full = logs.filter((m) => /full/.test(m)).length;
    if (C.funds(p) !== 200 || !game.zone.items.includes(pile) || pile.amount !== 7) fail(`12 into a purse with room for 5: funds ${C.funds(p)}, pile ${pile.amount}`);
    if (full !== 1) fail(`walking over a pile with a full purse told you ${full} times (want once)`);
    C.setPurse(p, 500);
    I.pickUpItems(game);
    if (C.funds(p) !== 207 || game.zone.items.includes(pile)) fail(`a bigger purse didn't take the rest: funds ${C.funds(p)}`);
    stats.pile = { took: 5, left: 7, fullMessages: full, afterBiggerPurse: C.funds(p) };
    game.log = log;
    // The 3D update and a map step pick up through the same function: a pile by your feet in 3D, a pile
    // on the next tile on the map.
    const before = C.funds(p);
    game.view = "3d"; game.mode = "explore"; game.paused = false;
    game.zone.monsters.length = 0;
    game.zone.items.push(I.makeItem({ kind: "cash", amount: 3 }, p.x, p.y, p.z));
    game.debug.step(1 / 60);
    const in3d = C.funds(p) - before;
    game.view = "map"; game.mode = "map";
    const zone = game.zone, tx = Math.floor(p.x), ty = Math.floor(p.y);
    const next = [[1, 0, "ArrowRight"], [-1, 0, "ArrowLeft"], [0, 1, "ArrowDown"], [0, -1, "ArrowUp"]]
      .find(([dx, dy]) => zone.stand[tx + dx + (ty + dy) * zone.w] === zone.stand[tx + ty * zone.w] && !zone.npcs.some((n) => n.tx === tx + dx && n.ty === ty + dy));
    let onMap = null;
    if (next) {
      zone.items.push(I.makeItem({ kind: "cash", amount: 4 }, tx + next[0] + 0.5, ty + next[1] + 0.5, zone.stand[tx + ty * zone.w]));
      const b2 = C.funds(p);
      game.debug.mapKey(next[2]);
      onMap = C.funds(p) - b2;
    }
    if (in3d !== 3 || onMap !== 4) fail(`walking over cash: 3D took ${in3d} (want 3), the map step took ${onMap} (want 4)`);
    stats.views = { "3d": in3d, map: onMap };
  }

  // --- 4. The shop ---------------------------------------------------------------------------------
  {
    const pell = npcs.spawnNpc("pell", 1, 1, p.z, 5, { stock: npcs.peddlerStock(makeRng(3), 5) });
    pell.state.stock.push({ item: { kind: "heart" }, count: 1, price: Math.round(I.itemPrice({ kind: "heart" }) * C.priceLevel(5)) });
    const open = (tab) => { game.talk = { npc: pell, node: null, sel: 0 }; game.shop = { npc: pell, tab, sel: 0 }; game.mode = "shop"; };
    const press = (code) => dialogue.shopKey(game, code);
    const stock0 = pell.state.stock[0], base = stock0.price, count0 = stock0.count;
    p.funds = 0; p.purse = 1000;
    open("buy"); press("Enter");
    if (C.funds(p) !== 0 || stock0.count !== count0) fail("buying with an empty purse changed something");
    p.funds = 900;
    const things = () => p.inv.reduce((n, it) => n + (it.count || 1), 0), packBefore = things();
    open("buy"); press("Enter");
    const paid = 900 - C.funds(p);
    if (paid !== base || stock0.count !== count0 - 1 || things() !== packBefore + 1) fail(`buying at ${base}: paid ${paid}, stock ${count0} → ${stock0.count}, pack ${packBefore} → ${things()}`);
    // The Haggler: a fifth off (stats.js priceMul, the legacy haggle).
    p.perks.add("haggler");
    St.invalidateStats(p);
    const heartRow = pell.state.stock.length - 1, heart = pell.state.stock[heartRow];
    const want = Math.round(Math.round(heart.price * 1.5 ** (game.crystalsBought || 0)) * RULES.legacy.haggle);
    const hp0 = St.maxHp(p), f0 = C.funds(p);
    open("buy");
    const rows = pell.state.stock.filter((s) => s.count > 0);
    for (let k = 0; k < rows.indexOf(heart); k++) press("ArrowDown");
    press("Enter");
    if (f0 - C.funds(p) !== want || St.maxHp(p) !== hp0 + 5 || p.inv.some((it) => it.kind === "heart")) fail(`a heart crystal with the Haggler: paid ${f0 - C.funds(p)} (want ${want}), max HP ${hp0} → ${St.maxHp(p)}`);
    p.perks.delete("haggler");
    St.invalidateStats(p);
    // Selling: floor(value × 0.3); refused when the purse can't hold it.
    const ware = { kind: "weapon", id: "mace", ench: 2, known: true };
    p.inv.unshift(ware);
    const value = Math.floor(I.itemPrice(ware) * RULES.legacy.sellShare);
    p.funds = 999;
    open("sell"); press("Enter");
    if (!p.inv.includes(ware) || C.funds(p) !== 999) fail("selling into a full purse went through");
    p.funds = 100;
    open("sell"); press("Enter");
    if (p.inv.includes(ware) || C.funds(p) !== 100 + value) fail(`selling a mace +2 worth ${value}: funds ${C.funds(p)}`);
    // Services: too poor is refused; otherwise the first service takes its price, one of the parent's
    // service prices (50, 60 × (ench + 2), 150, 25) at this level.
    open("services");
    p.funds = 10; press("Enter");
    const poorPaid = 10 - C.funds(p);
    p.funds = 1000;
    open("services"); press("Enter");
    const svc = 1000 - C.funds(p), f = C.priceLevel(5);
    const prices = [50, 150, 25, ...[0, 1, 2, 3, 4].map((k) => 60 * (k + 2))].map((n) => Math.round(n * f));
    if (poorPaid !== 0 || !prices.includes(svc)) fail(`services: paid ${poorPaid} with 10, then ${svc} (want one of ${prices.join(", ")})`);
    stats.shop = { bought: paid, heartWithHaggler: want, sold: value, service: svc };
    game.mode = "map"; game.shop = null;
  }

  // --- 5. People -----------------------------------------------------------------------------------
  {
    const shrine = npcs.spawnNpc("shrine", 1, 1, p.z, 5, { cost: 70 });
    shrine.met = true;
    p.funds = 100;
    const node = npcs.talkTo(game, shrine);
    const offer = node.options.find((o) => /^Offer /.test(o.label));
    if (!offer || !offer.label.includes(C.formatPrice(70))) fail(`the shrine's offer: ${node.options.map((o) => o.label).join(" | ")}`);
    else offer.go();
    if (C.funds(p) !== 30) fail(`a 70 glim offering left ${C.funds(p)} of 100`);
    const poor = npcs.talkTo(game, npcs.spawnNpc("shrine", 1, 1, p.z, 5, { cost: 70 }));
    if (poor.options.some((o) => /^Offer /.test(o.label))) fail("a shrine offered a deal you can't afford");
    // Rook's bounty with a nearly full purse: the rest lies at your feet as cash.
    C.setPurse(p, 200);
    p.funds = 190;
    const rook = npcs.spawnNpc("rook", 1, 1, p.z, 5, { target: -1, targetName: "rat" });
    rook.met = true;
    npcs.addQuest(game, "rook", "Bounty", "test");
    const items0 = game.zone.items.length;
    const take = npcs.talkTo(game, rook).options.find((o) => /bounty/.test(o.label));
    take?.go();
    const spilled = game.zone.items.slice(items0).find((it) => it.kind === "cash");
    const reward = 40 + 5 * 4;
    if (C.funds(p) !== 200 || !spilled || spilled.amount !== reward - 10) fail(`a ${reward} glim bounty into a purse with room for 10: funds ${C.funds(p)}, on the ground ${spilled?.amount}`);
    stats.people = { offering: 70, bounty: reward, spilled: spilled?.amount };
  }

  // --- 6. Migration --------------------------------------------------------------------------------
  const left = [];
  for (const { file, text } of srcFiles) {
    if (file === "currency.js") continue;
    stripComments(text).split("\n").forEach((line, k) => {
      if (!/\bgold\b/.test(line) || GOLD_OK.some((re) => re.test(line))) return;
      left.push(`${file}:${k + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  if (left.length) fail(`gold touch points left: ${left.slice(0, 6).join("; ")}${left.length > 6 ? ` … (${left.length})` : ""}`);
  stats.goldLeft = left.length;
  let piles = 0, gold = 0;
  for (const seed of [1, 7])
    for (let depth = 1; depth <= 20; depth++) {
      const f = generateDungeonLevel(seed, legacyParams(depth, seed));
      for (const it of f.items) { if (it.kind === "cash") piles++; if (it.kind === "gold") gold++; }
    }
  if (!piles || gold) fail(`legacy levels lay ${piles} cash piles and ${gold} gold piles`);
  stats.levelPiles = { cash: piles, gold };

  stats.ms = Date.now() - t0;
  return { name: "currency", ok: problems.length === 0, problems, stats };
}
