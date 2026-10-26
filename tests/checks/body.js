// Bodies (body.js) and the item kind registry (items.js): TECH_DESIGN §2.5, §2.9 and the 0B scope.
//
//   checkBody({ game, startRun, inventory, srcFiles }) → { name, ok, problems, stats }
//
//   1. Registry: every kind the game makes (a literal `kind: "…"` where src/ makes an item, everything the legacy
//      levels 1–20 lay out on two seeds, the loot tables at every level, the starting pack) is registered,
//      and every registered kind answers for a sample item: a name, a glyph [ch, rgb], a number price and
//      weight ≥ 0, floor art whose every letter has a palette entry, and stacking that agrees with takeOne.
//      `cash` exists and a pile of it goes into the purse when walked over.
//   2. Stacks: addToInventory merges stackable things and nothing else; takeOne(e, stack) takes one off a
//      stack (removing it at 0) or the whole item, and returns null for something not in the pack.
//   3. Plans: humanoid and beast exist, part ids are unique, the humanoid's primary hand comes first; a
//      beast holds nothing (no weapon goes on it, wielded() is null) but wears barding.
//   4. Every piece of gear on every part it fits (slotsFor), on a fresh humanoid: worn() lists it once,
//      the derived numbers come back exactly when it's taken off (unequip), cursed pieces refuse to come
//      off and refuse to be covered. Two rings count twice (both fingers); an implant counts; a
//      two-handed weapon takes both hands, is listed once and survives structuredClone as one object;
//      an extra limb (addPart) holds an off-hand weapon (offhands) and gives it back on removePart; one
//      item already worn can't go on a second part as well (reason "worn").
//   5. swapBelt: empty belt, a cursed weapon in hand, too weak; a good swap takes RULES.body.beltSwap s.
//   6. Migration: no `.weapon`, `.armour`, `.ring`, `.amulet` or `.sidearm` gear field is read or written
//      on the player in src/ (the five parent fields live on the body now).
//
// game/startRun/inventory: the real modules. srcFiles: [{ file, text }] of every src/ module.
import { RULES } from "../../src/rules.js";
import * as I from "../../src/items.js";
import * as Bd from "../../src/body.js";
import * as St from "../../src/stats.js";
import { generateDungeonLevel, legacyParams, LEGACY_LEVELS } from "../../src/gen/dungeon.js";
import { makeRng } from "../../src/rng.js";
import { funds } from "../../src/currency.js";
import { derived, gearCatalog } from "./stats.js";

const OLD_GEAR = /\b(p|player|game\.player|pl|e)\.(weapon|armour|ring|amulet|sidearm)\b/g;
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// One sample item of each kind the parent game had (plus cash), and every variety of the tabled ones.
function samples() {
  const out = [];
  for (const effect in I.POTIONS) out.push({ kind: "potion", effect, count: 2 });
  for (const effect in I.SCROLLS) out.push({ kind: "scroll", effect, count: 1 });
  out.push(...gearCatalog());
  out.push({ kind: "knife", count: 3 }, { kind: "bomb", count: 1 }, { kind: "key" }, { kind: "heart" }, { kind: "strength" },
    { kind: "gold", amount: 7 }, { kind: "cash", amount: 7 }, { kind: "cube" },
    { kind: "quest", id: "skull", name: "Brann's skull", info: "A ghost wants this back." }, { kind: "relic?" });
  return out;
}

export function checkBody({ game, startRun, inventory, srcFiles }) {
  const problems = [], stats = {};
  const fail = (m) => problems.push(m);
  const t0 = Date.now();
  startRun(1234);

  // --- 1. Registry --------------------------------------------------------------------------------
  const made = new Set(["potion", "scroll", "knife", "bomb"]);   // the starting pack
  // Literal kinds where items are made: items.js, and lines that lay out, drop, stock or give an item.
  const MAKES = /makeItem|placeItem|item:|addToInventory|lying\(|give\(|treasure|extra =|kind: rng/;
  for (const { file, text } of srcFiles)
    for (const line of stripComments(text).split("\n"))
      if (file === "items.js" || MAKES.test(line)) for (const m of line.matchAll(/\bkind:\s*"([^"]+)"/g)) made.add(m[1]);
  let levels = 0, itemsLaid = 0;
  for (const seed of [1234, 7])
    for (let depth = 1; depth <= LEGACY_LEVELS; depth++) {
      const zone = generateDungeonLevel(seed, legacyParams(depth, seed));
      levels++;
      for (const it of zone.items) { made.add(it.kind); itemsLaid++; }
    }
  const rand = makeRng(99);
  for (let depth = 1; depth <= 20; depth++)
    for (let k = 0; k < 60; k++)
      for (const it of [I.randomTreasure(rand, depth), I.randomEquipment(rand, depth), I.randomJewel(rand, depth), I.randomPotion(rand), I.randomScroll(rand)])
        made.add(it.kind);
  const missing = [...made].filter((k) => !I.ITEM_KINDS[k]);
  if (missing.length) fail(`kinds the game makes but nobody registered: ${missing.join(", ")}`);
  if (!I.ITEM_KINDS.cash) fail("no cash kind");
  const sample = samples();
  const sampled = new Set(sample.map((it) => it.kind));
  for (const k in I.ITEM_KINDS) if (!sampled.has(k) && !k.startsWith("check")) fail(`registered kind ${k} has no sample in the check`);
  let answered = 0;
  for (const it of sample) {
    const at = `${it.kind} ${it.relic || it.id || it.effect || ""}`.trim();
    const def = I.ITEM_KINDS[it.kind];
    if (!def) continue;
    const name = I.itemName(game, it), glyph = I.itemGlyph(game, it);
    if (typeof name !== "string" || !name) fail(`${at}: name ${JSON.stringify(name)}`);
    if (!Array.isArray(glyph) || typeof glyph[0] !== "string" || glyph[0].length !== 1 || !Array.isArray(glyph[1]) || glyph[1].length !== 3)
      fail(`${at}: glyph ${JSON.stringify(glyph)}`);
    const price = I.itemPrice(it), weight = I.itemWeight(it);
    if (!(Number.isFinite(price) && price >= 0)) fail(`${at}: price ${price}`);
    if (!(Number.isFinite(weight) && weight >= 0)) fail(`${at}: weight ${weight}`);
    if (typeof I.itemInfo(game, it) !== "string") fail(`${at}: info is not a string`);
    if (!Array.isArray(I.itemDetails(game, it))) fail(`${at}: details is not a list`);
    const art = def.art, pal = I.itemPalette(game, it) || {};
    if (!art || !(art.w > 0) || !(art.h > 0) || !Array.isArray(art.art)) fail(`${at}: no floor art`);
    else {
      const letters = new Set(art.art.join("").replace(/ /g, ""));
      const bare = [...letters].filter((ch) => !pal[ch]);
      if (bare.length) fail(`${at}: art letters without a palette entry: ${bare.join("")}`);
      const spr = I.itemSprite(game, { ...it, x: 1.5, y: 1.5, z: 2 }, 3);
      if (!(spr.w === art.w && spr.art === art.art)) fail(`${at}: itemSprite doesn't use the kind's art`);
    }
    if (I.isGear(it) !== !!def.slot) fail(`${at}: isGear disagrees with the kind's slot`);
    answered++;
  }
  stats.registry = { kinds: Object.keys(I.ITEM_KINDS).length, madeByGame: made.size, samples: answered, legacyLevels: levels, itemsLaid };

  // --- 2. Stacks and takeOne -----------------------------------------------------------------------
  {
    const e = { inv: [] };
    const a = I.addToInventory(e, { kind: "potion", effect: "healing", count: 2, x: 1, y: 2, z: 3 });
    const b = I.addToInventory(e, { kind: "potion", effect: "healing" });
    const c = I.addToInventory(e, { kind: "potion", effect: "poison" });
    const w1 = I.addToInventory(e, { kind: "weapon", id: "dagger", ench: 0, known: true });
    const w2 = I.addToInventory(e, { kind: "weapon", id: "dagger", ench: 0, known: true });
    if (a !== b || a.count !== 3) fail(`stacking: healing potions not merged (count ${a.count})`);
    if (c === a || e.inv.length !== 4 || w1 === w2) fail(`stacking: ${e.inv.length} entries (want 4: two potion stacks, two daggers)`);
    if ("x" in a || "z" in a) fail("addToInventory kept the floor position");
    const one = I.takeOne(e, a);
    if (!same(one, { kind: "potion", effect: "healing" }) || a.count !== 2) fail(`takeOne off a stack: ${JSON.stringify(one)}, ${a.count} left`);
    I.takeOne(e, c);
    if (e.inv.includes(c)) fail("takeOne left an empty stack in the pack");
    if (I.takeOne(e, w1) !== w1 || e.inv.includes(w1)) fail("takeOne of gear didn't hand back the item itself");
    if (I.takeOne(e, { kind: "bomb", count: 1 }) !== null) fail("takeOne of something not in the pack didn't return null");
    for (const it of sample) if (!!I.stackKey(it) !== !!I.ITEM_KINDS[it.kind]?.stack) fail(`stackKey disagrees with ${it.kind}.stack`);
  }
  // Cash and gold piles go into the purse.
  {
    const p = game.player, before = funds(p);
    game.zone.items.push(I.makeItem({ kind: "cash", amount: 12 }, p.x, p.y, p.z), I.makeItem({ kind: "gold", amount: 5 }, p.x, p.y, p.z));
    const n = game.zone.items.length;
    I.pickUpItems(game);
    if (funds(p) !== before + 17 || game.zone.items.length !== n - 2) fail(`walking over 12 glim and 5 gold: purse ${before} → ${funds(p)}`);
    stats.cashPickup = { before, after: funds(p) };
  }

  // --- 3. Plans -------------------------------------------------------------------------------------
  for (const id of ["humanoid", "beast"]) {
    const plan = Bd.BODY_PLANS[id];
    if (!plan) { fail(`no ${id} body plan`); continue; }
    if (new Set(plan.map((p) => p.id)).size !== plan.length) fail(`${id}: duplicate part ids`);
  }
  if (Bd.BODY_PLANS.humanoid?.[0]?.primary !== true) fail("the humanoid plan doesn't start with its primary hand");
  {
    const beast = { body: Bd.makeBody("beast"), inv: [], attrs: St.makeAttrs(), level: 1, maxHpGain: 0, hp: 20 };
    const sword = { kind: "weapon", id: "dagger", ench: 0, known: true };
    if (Bd.slotsFor(beast, sword).length || Bd.equip(game, beast, sword).ok || Bd.wielded(beast) !== null) fail("a beast can hold a weapon");
    const barding = { kind: "armour", id: "leather", ench: 1, known: true };
    if (!Bd.equip(game, beast, barding).ok || !Bd.worn(beast).includes(barding) || St.av(beast) !== 2) fail(`a beast can't wear barding (AV ${St.av(beast)})`);
    if (Bd.worn({}).length || Bd.wielded({}) !== null) fail("an entity without a body wears something");
  }

  // --- 4. Every piece on every part it fits -------------------------------------------------------
  let fits = 0, cursedRefusals = 0;
  {
    const fresh = () => {
      const e = { body: Bd.makeBody("humanoid"), inv: [], attrs: St.makeAttrs(30), level: 1, maxHpGain: 0, hp: 20, perks: new Set(), status: {} };
      e.body.equip.body = { kind: "armour", id: "clothes", ench: 0, known: true };
      return e;
    };
    St.STATS_DEBUG.verify = true;
    try {
      for (const proto of gearCatalog()) {
        const parts = Bd.slotsFor(fresh(), proto);
        if (!parts.length) { fail(`${proto.kind} ${proto.id}: fits no humanoid part`); continue; }
        for (const part of parts) {
          const e = fresh(), it = structuredClone(proto);
          const before = derived(game, e), was = Bd.wornOn(e, part);
          const r = Bd.equip(game, e, it, part);
          if (!r.ok) { fail(`${it.kind} ${it.relic || it.id} on ${part}: refused (${r.reason})`); continue; }
          fits++;
          if (Bd.worn(e).filter((x) => x === it).length !== 1) fail(`${it.kind} ${it.id} on ${part}: not listed once by worn()`);
          if (was && !(r.removed.length === 1 && r.removed[0] === was)) fail(`${it.kind} on ${part}: didn't hand back what it covered`);
          if (it.ench < 0) {
            const u = Bd.unequip(game, e, part);
            if (u.ok || u.reason !== "cursed") fail(`cursed ${it.kind} ${it.id} on ${part} came off`);
            const cover = Bd.equip(game, e, { ...structuredClone(proto), ench: 1 }, part);
            if (cover.ok || cover.reason !== "cursed") fail(`cursed ${it.kind} ${it.id} on ${part} was covered`);
            cursedRefusals++;
            it.ench = 0;   // lift it (as a scroll would) to take it off
            St.invalidateStats(e);
          }
          const u = Bd.unequip(game, e, part);
          if (!u.ok || u.item !== it) fail(`${it.kind} ${it.id} on ${part}: unequip gave ${u.reason}`);
          if (was) Bd.equip(game, e, was, part);
          const after = derived(game, e);
          if (!same(before, after)) fail(`${it.kind} ${it.relic || it.id} ${it.ench} on and off ${part} changed ${Object.keys(before).filter((k) => !same(before[k], after[k])).join(", ")}`);
        }
      }
      // Two rings, one on each finger: both count.
      const e = fresh();
      const r1 = { kind: "ring", id: "strength", ench: 2, known: true }, r2 = { kind: "ring", id: "strength", ench: 3, known: true };
      Bd.equip(game, e, r1, "finger_r"); Bd.equip(game, e, r2, "finger_l");
      if (St.bonus(e, "str") !== 5 || Bd.worn(e).length !== 3) fail(`two rings of strength +2 and +3: bonus(str) ${St.bonus(e, "str")}, ${Bd.worn(e).length} worn`);
      if (Bd.defaultPart(e, { kind: "ring", id: "haste", ench: 1 }) !== "finger_r") fail("E doesn't put a ring on the first finger (the parent's one ring)");
      // An implant counts like gear.
      e.body.implants.head = { kind: "amulet", id: "life", ench: 1, known: true };
      St.invalidateStats(e);
      if (St.bonus(e, "maxHp") !== 5 || !Bd.worn(e).includes(e.body.implants.head)) fail(`an implant isn't counted (bonus(maxHp) ${St.bonus(e, "maxHp")})`);
    } catch (err) { fail(`gear on parts: ${err.message}`); }
    St.STATS_DEBUG.verify = false;

    // Two hands, and a third.
    if (!I.ITEM_KINDS.checkGreatbow)
      I.registerItemKind("checkGreatbow", { stack: false, slot: () => "hand", hands: () => 2, name: () => "check greatbow", glyph: () => ["}", [200, 200, 200]],
        price: () => 0, weight: () => 0, art: I.ITEM_KINDS.weapon.art, palette: I.ITEM_KINDS.weapon.palette, bonuses: () => ({ reach: 1 }) });
    const e = fresh(), bow = { kind: "checkGreatbow", id: "bow", ench: 0 }, knife = { kind: "weapon", id: "dagger", ench: 0, known: true };
    Bd.equip(game, e, knife, "hand_l");
    const rb = Bd.equip(game, e, bow, "hand_r");
    if (!rb.ok || rb.removed[0] !== knife || Bd.wielded(e) !== bow || Bd.wornOn(e, "hand_l") !== bow || Bd.offhands(e).length || Bd.worn(e).filter((x) => x === bow).length !== 1)
      fail("a two-handed weapon doesn't take both hands exactly once");
    if (St.bonus(e, "reach") !== 1) fail(`a two-handed weapon's bonus counted ${St.bonus(e, "reach")} times`);
    const copy = structuredClone(e);
    if (Bd.wielded(copy) !== Bd.wornOn(copy, "hand_l") || Bd.worn(copy).length !== 2) fail("a two-handed weapon doesn't survive structuredClone as one item");
    const rk = Bd.equip(game, e, knife, "hand_l");
    if (!rk.ok || rk.removed[0] !== bow || Bd.wielded(e) !== null || Bd.offhands(e)[0] !== knife) fail("a one-hander in the off hand didn't push the two-hander off both hands");
    const one = { body: Bd.makeBody("humanoid"), inv: [], attrs: St.makeAttrs(), level: 1, maxHpGain: 0, hp: 20 };
    Bd.removePart(one, "hand_l");
    if (Bd.canEquip(game, one, bow, "hand_r").ok) fail("a two-handed weapon went into the only hand");
    Bd.addPart(one, { id: "hand_x", type: "hand", holds: true });
    const extra = { kind: "weapon", id: "dagger", ench: 1, known: true };
    if (!Bd.slotsFor(one, extra).includes("hand_x") || !Bd.equip(game, one, extra, "hand_x").ok || Bd.offhands(one)[0] !== extra) fail("an extra hand can't hold an off-hand weapon");
    const ring = { kind: "ring", id: "regeneration", ench: 2, known: true };
    const r1 = Bd.equip(game, one, ring, "finger_r"), r2 = Bd.equip(game, one, ring, "finger_l");
    if (!r1.ok || r2.ok || r2.reason !== "worn" || Bd.worn(one).filter((x) => x === ring).length !== 1 || St.bonus(one, "regen") !== 2)
      fail(`one ring on two fingers: ${r2.ok ? "accepted" : r2.reason}, worn ${Bd.worn(one).filter((x) => x === ring).length}×, regen ${St.bonus(one, "regen")}`);
    const back = Bd.removePart(one, "hand_x");
    if (back[0] !== extra || Bd.worn(one).includes(extra)) fail("removePart didn't give back what the limb held");
  }
  stats.parts = { fits, cursedRefusals };

  // --- 5. swapBelt --------------------------------------------------------------------------------
  {
    const e = { body: Bd.makeBody("humanoid"), inv: [], attrs: St.makeAttrs(), level: 1, maxHpGain: 0, hp: 20 };
    const a = { kind: "weapon", id: "shortsword", ench: 0, known: true }, b = { kind: "weapon", id: "greatsword", ench: 0, known: true };
    e.body.equip.hand_r = a;
    const reasons = [Bd.swapBelt(game, e).reason];
    e.body.belt = b;
    reasons.push(Bd.swapBelt(game, e).reason);                 // the legacy set reads STR 10: too weak for a greatsword
    St.raiseAttr(e, "str", 10);
    a.ench = -1; reasons.push(Bd.swapBelt(game, e).reason); a.ench = 0;
    const ok = Bd.swapBelt(game, e);
    if (!same(reasons, ["empty", "weak", "cursed"])) fail(`swapBelt refusals: ${reasons.join(", ")}`);
    if (!ok.ok || ok.time !== RULES.body.beltSwap || Bd.wielded(e) !== b || Bd.belt(e) !== a) fail(`swapBelt: ${JSON.stringify(ok)}`);
    stats.swapBelt = { refusals: reasons, time: ok.time };
  }

  // --- 6. Migration ---------------------------------------------------------------------------------
  const left = [];
  for (const { file, text } of srcFiles) {
    if (file.startsWith("content/")) continue;
    const code = stripComments(text);
    for (const m of code.matchAll(OLD_GEAR)) left.push(`${file}: ${m[0]}`);
  }
  if (left.length) fail(`parent gear fields left: ${left.slice(0, 8).join("; ")}${left.length > 8 ? ` … (${left.length})` : ""}`);
  stats.oldGearFields = left.length;

  // The inventory screen still equips through the body: a ring from the pack lands on the first finger.
  {
    startRun(1234);
    const p = game.player, ring = { kind: "ring", id: "haste", ench: 1, known: false };
    p.inv.push(ring);
    inventory.equip(game, ring, p.inv.length - 1);
    if (Bd.wornOn(p, "finger_r") !== ring || p.inv.includes(ring)) fail("inventory.equip didn't put the ring on the first finger");
  }

  stats.ms = Date.now() - t0;
  return { name: "body", ok: problems.length === 0, problems, stats };
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-body.mjs gives.
export async function run(env) {
  await env.screen();
  const { game, startRun } = await env.src("game.js");
  return checkBody({ game, startRun, inventory: await env.src("inventory.js"), srcFiles: await env.srcFiles() });
}
