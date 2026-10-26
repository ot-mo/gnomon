// Missile weapons and their ammunition (TECH_DESIGN §2.18 "MISSILES", §2.9 kinds `missile` and `ammo`; WS8,
// numbers from bible §13.2 until C4 sets them). No `pv`: combat is d20 (DECISIONS §1).
//
//   MISSILES[id] = { name, dmg: [lo, hi], acc, range (tiles), speed (blocks/s), gravity (blocks/s²),
//                    reload (seconds between shots, and what a shot costs on the map), hands,
//                    ammo: an AMMO id, or null for free shots (the sling's stones), noun (what the log calls
//                    a shot: "Your bolt hits the goblin for 5."), tier, price, info,
//                    onHit?: { status, t, chance } }   what a shot that hurt (and didn't kill) does after
//   AMMO[id] = { name, plural, price, breaks }          breaks: the chance a spent one is lost
// Items: { kind: "missile", id, ench } and { kind: "ammo", effect: an AMMO id, count } (a stack is keyed by
// its effect, items.js stackKey). A missile weapon is carried in the pack, not held: V fires the ready one
// (missiles.js), in 3D where you look and on the map at the target screen's cursor, and your hands keep
// your blade for the swing.
import { registerItemKind } from "../../items.js";

export const MISSILES = {
  sling: { name: "sling", dmg: [1, 4], acc: 0, range: 10, speed: 14, gravity: 16, reload: 0.7, hands: 1, ammo: null, noun: "stone",
           tier: 1, price: 25, onHit: { status: "stunned", t: 1, chance: 0.3 },
           info: "free stones; dazes now and then; lobs over low walls" },
  boltBow: { name: "bolt-bow", dmg: [3, 7], acc: 1, range: 16, speed: 26, gravity: 5, reload: 1, hands: 2, ammo: "bolt", noun: "bolt",
             tier: 2, price: 90, onHit: { status: "pinned", t: 2, chance: 1 },
             info: "long range; pins what it hits for 2 s" },
};
export const AMMO = {
  bolt: { name: "bolt", plural: "bolts", price: 2, breaks: 0.3 },
};

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const WOOD = { h: [[125, 85, 50], 0], H: [[165, 120, 75], 0] };
const STRING = { c: [[215, 205, 180], 0.1] };
const IRON = { i: [[150, 155, 170], 0.15], I: [[205, 210, 225], 0.25] };
const ART = {
  sling: { w: 0.4, h: 0.22, art: ["c    c", " c  c ", "  hh  "] },
  boltBow: { w: 0.5, h: 0.3, art: ["hhhhhh", "c iI c", " ciIc ", "  hh  "] },
  bolt: { w: 0.3, h: 0.1, art: ["IhhhH"] },
};

registerItemKind("missile", {
  stack: false, weight: () => 0,
  price: (it) => MISSILES[it.id].price + 30 * Math.max(0, it.ench || 0),
  name: (game, it) => `${it.ench ? `${signed(it.ench)} ` : ""}${MISSILES[it.id].name}`,
  glyph: () => ["}", [200, 165, 110]],
  info(game, it) {
    const m = MISSILES[it.id], ammo = m.ammo ? `shoots ${AMMO[m.ammo].plural}` : `shoots ${m.noun}s, free`;
    return `${m.dmg[0]}-${m.dmg[1]} damage · range ${m.range} · ${m.reload} s a shot · ${ammo} · ${m.info} · V fires it`;
  },
  art: { w: ART.sling.w, h: ART.sling.h, art: ART.sling.art },
  palette: () => ({ ...WOOD, ...STRING, ...IRON }),
});
registerItemKind("ammo", {
  stack: true, weight: () => 0,
  price: (it) => AMMO[it.effect].price,
  name: (game, it) => AMMO[it.effect].name,
  glyph: () => ["{", [205, 200, 185]],
  info: (game, it) => `ammunition for a ${Object.values(MISSILES).find((m) => m.ammo === it.effect)?.name || "missile weapon"}`,
  art: ART.bolt,
  palette: () => ({ ...WOOD, ...IRON }),
});
export const MISSILE_ART = ART;
