// Making the real world's gear (bible §13.1-§13.3; C4): a class or a piece of items/forge.js in a material, the loot
// that suits a level, and the kit tools (marker chalk). items/legacy.js reaches this file (content/index.js is frozen).
//
//   makeGear(kind, id, made, extra?) → item        { kind, id, made, material, ench: 0, known: true, ...extra }; made:
//                                                  a MATERIALS id for a forged piece (forge.js isForged), else ignored
//   randomGear(rand, level, luck = 0) → item       a weapon or armour for a zone of that level (the real world's
//                                                  counterpart of items.js randomEquipment, which the legacy stack keeps):
//                                                  the zone's tier's material most often, the tier below half as often,
//                                                  older ones now and then; a piece only from its own tier on, and only
//                                                  one that does something now (useful). Enchantment, element and
//                                                  properties as randomEquipment gives them, by level
//   tierOf(level)                                  min(8, ceil((level + 1) / 3)) (bible §15.6; leveling.js has the same)
//   useful(kind, id) → bool                        the piece does something the game has built (armour, a bonus, a
//                                                  weapon's damage): what randomGear and a merchant may offer
//   TOOLS[id] = { name, glyph, color, price, info }   the "tool" kind: { kind: "tool", effect: id, count }
//     markerChalk  E in the pack: a chalk mark on the floor where you stand, in either view: your map shows it, and in 3D
//                  it stands where you made it (the zone's markers, screens/play.js's; at most 9 a floor). count: marks
import { registerItemKind, takeOne, WEAPONS, ARMOURS, ELEMENTS, PROPERTIES } from "../../items.js";
import { MATERIALS, MATERIAL_ORDER, CLASS_OF, isForged } from "./forge.js";
import { RULES } from "../../rules.js";
import { seededSort } from "../../rng.js";

export const tierOf = (level) => Math.min(RULES.level.tierMax, Math.max(1, Math.ceil(((level || 1) + 1) / 3)));

export function makeGear(kind, id, made = null, extra = {}) {
  const it = { kind, id, ench: 0, known: true, ...extra };
  if (made && isForged(kind, id)) {
    if (!MATERIALS[made]) throw new Error(`makeGear: no material ${made}`);
    it.made = made;
    if (kind === "weapon") it.material = MATERIALS[made].dmg;
  }
  return it;
}

// A piece that does something now: armour, a bonus, a weapon. A piece whose whole point waits for code (`needs` and
// nothing else: a buckler, a banner) stays out of the loot until it is built.
export function useful(kind, id) {
  if (kind === "weapon") return !!WEAPONS[id];
  const a = ARMOURS[id];
  return !!a && (a.armour > 0 || Object.keys(a.bonus || {}).length > 0);
}

// The real world's gear by the tier it first turns up at: the light classes from the start, the heavy ones later (as
// the parent's floors hold greatswords back), the armour by its piece; forged gear in the zone's materials. The
// parent's own tiers (1-4, for floors) are not the bible's, so its pieces are placed here. (Clothes are nobody's loot.)
const CLASS_TIER = { dagger: 1, stylus: 1, staff: 1, handAxe: 1, shortsword: 1, mace: 2, spear: 2, lanternFlail: 2, longsword: 3, waraxe: 3,
  glaive: 4, maul: 4, greatsword: 4 };
const PIECE_TIER = { leather: 1, chain: 2, scale: 3, plate: 4, reedHat: 1, copperCap: 1, ironHelm: 3, goggles: 2, cloak: 1, bracers: 1,
  gloves: 1, gauntlets: 2, sandals: 1, boots: 1 };
const pieceTier = (id) => PIECE_TIER[id] ?? ARMOURS[id]?.tier ?? 1;
const weighted = (rand, entries) => {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let pick = rand() * total;
  for (const [v, w] of entries) if ((pick -= w) < 0) return v;
  return entries[entries.length - 1][0];
};

export function randomGear(rand, level, luck = 0) {
  const tier = tierOf(level);
  const near = (t) => (t === tier ? 4 : t === tier - 1 ? 2 : 1);
  // Half weapons, half armour; every class open at the tier weighs the same (its material carries the tier).
  const pool = rand() < 0.5
    ? Object.keys(CLASS_OF).filter((id) => WEAPONS[id] && (CLASS_TIER[id] || 1) <= tier).map((id) => [{ kind: "weapon", id }, 1])
    : Object.keys(ARMOURS).filter((id) => id !== "clothes" && useful("armour", id) && pieceTier(id) <= tier)
      .map((id) => [{ kind: "armour", id }, isForged("armour", id) ? 2 : near(pieceTier(id))]);
  const pick = weighted(rand, pool);
  const made = isForged(pick.kind, pick.id) ? weighted(rand, MATERIAL_ORDER.filter((m) => MATERIALS[m].tier <= tier).map((m) => [m, near(MATERIALS[m].tier)])) : null;
  const it = makeGear(pick.kind, pick.id, made, { known: false });
  // As the parent's loot: about 1 in 5 cursed, 1 in 5 blessed, by more the deeper the level; elements and properties
  // commoner as the levels rise (items.js randomEquipment, read by level instead of floor).
  const roll = rand(), size = 1 + Math.floor(rand() * Math.min(4, 1 + level / 6));
  if (roll < 0.2 - luck) it.ench = -size;
  else if (roll > 0.8 - luck) it.ench = size;
  if (it.kind === "weapon" && rand() < 0.03 + level * 0.008) it.element = Object.keys(ELEMENTS)[Math.floor(rand() * 4)];
  const props = Object.keys(PROPERTIES).filter((k) => PROPERTIES[k].slot === it.kind);
  const count = level < 5 ? 0 : rand() < Math.min(0.55, 0.05 * level) ? (level >= 14 && rand() < 0.35 ? 2 : 1) : 0;
  if (count) it.props = seededSort(props, () => rand() - 0.5).slice(0, count);
  return it;
}

// --- Tools --------------------------------------------------------------------------------------------------------
export const TOOLS = {
  markerChalk: {
    name: "marker chalk", glyph: "~", color: [235, 232, 220], price: 3,
    info: "Chalk a mark on the floor where you stand: it shows on your map, and in 3D where you made it. A stick a mark.",
  },
};
const CHALK_MAX = 9;   // screens/play.js toggleMarker's limit: a floor holds at most 9 markers
function chalkMark(game, e, it) {
  const zone = game.zone, x = Math.floor(e.x), y = Math.floor(e.y);
  if (zone.markers.some((m) => m.x === x && m.y === y)) { game.log("There's a mark here already.", [170, 170, 170]); return 0; }
  if (zone.markers.length >= CHALK_MAX) { game.log(`This floor already holds ${CHALK_MAX} marks.`, [170, 170, 170]); return 0; }
  zone.markers.push({ x, y });
  takeOne(e, it);
  game.log("You chalk a mark on the floor.", TOOLS.markerChalk.color);
  return 1;
}
registerItemKind("tool", {
  stack: true, weight: () => 0,
  name: (game, it) => TOOLS[it.effect]?.name || "tool",
  glyph: (game, it) => [TOOLS[it.effect]?.glyph || "~", TOOLS[it.effect]?.color || [200, 200, 200]],
  info: (game, it) => TOOLS[it.effect]?.info || "",
  price: (it) => TOOLS[it.effect]?.price || 0,
  art: { w: 0.3, h: 0.16, art: ["cccc ", " cCCc", "  cc "] },
  palette: (game, it) => { const c = TOOLS[it.effect]?.color || [200, 200, 200]; return { c: [c.map((v) => Math.round(v * 0.8)), 0.1], C: [c, 0.2] }; },
  use(game, e, it) {
    if (it.effect === "markerChalk") return e === game.player ? chalkMark(game, e, it) : 0;
    return 0;
  },
});
