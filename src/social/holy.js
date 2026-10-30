// Holy places and trespass (bible §3.5's Grey row, §7; C2 #5, WS6a #6, WS7b #16; B3). Where a faction holds the ground
// holy (social/places.js holyAt: a landmark's `holy`, `holyFloors` and its plan's `areas`, a site's, an Hour site's cult),
// a neutral member of that faction is hostile to you there while you stand below Warm with it, and every member turns
// on you when you break the place's rule (FAITHS[*].trespass). Each rule says its warning once
// (FACTIONS[f].lines.trespass.warn) and its words as they turn (`turn`); turned, they stay so until you leave the zone.
//
//   the Lampless, the Spore Moot   a lit torch: at Warm or above they ask once, and turn 10 s later if it still burns;
//                                  below Warm they are hostile there already. A Plumb with the dark-pass (darkPass) may
//                                  carry it through the Lampless' places
//   the Horary                     your torch going out inside the Hour-house: they turn at once
//   the Assize                     a Bent below Bright inside the Square: told once, turned 10 s later if still inside
//   the Plan                       a damaged block (a bomb going off in its place): a warning first, then −50 a block
//   the Pressed                    a bomb on their mosaics (boots are forgiven): they turn
// The Vigil's rule (the Cube's altar) and the Pleatwood's (cutting or burning) have nothing in the game to catch yet
// (docs/b3.md). An Hour's cult (cult:<short>) treats you as a pilgrim in its sites while you hold its pass
// (game.state.journal.cultPass[rulerId]: neutral, whatever your standing; social/cults.js).
//
//   holyNow(game) → { faction, rule } | null    where you stand now (memoised by zone and tile)
//   trespassed(game, faction) → bool            they have turned on you in this zone
//   darkPass(game) → bool                       a Plumb's earned leave to carry light among the Lampless (bible §3.3:
//                                               "earned"; here, Bright with them, or game.state.darkPass given by content)
// State: game.state.trespass = { [faction]: { zone, warned?, at?, turned? } } (JSON), dropped on leaving the zone.
import { FACTIONS, repOf, band, REP_BANDS, membershipsOf, registerPlayerRule, addRep } from "../factions.js";
import { on } from "../events.js";
import { holyAt } from "./places.js";

export const GRACE = 10;   // seconds of game time between a warning and the turn
const memo = new WeakMap();
export function holyNow(game) {
  const p = game.player, z = game.zone;
  if (!p || !z) return null;
  const key = `${z.key}|${Math.floor(p.x)},${Math.floor(p.y)}`;
  const m = memo.get(game);
  if (m && m.key === key && m.zone === z) return m.v;
  const v = holyAt(game, p.x, p.y);
  memo.set(game, { key, zone: z, v });
  return v;
}
const atLeast = (game, f, b) => REP_BANDS.indexOf(band(repOf(game, f))) >= REP_BANDS.indexOf(b);
const st = (game) => (game.state.trespass ||= {});
export const trespassed = (game, f) => { const t = game.state?.trespass?.[f]; return !!(t?.turned && t.zone === game.zone?.key); };
export const darkPass = (game) => !!game.state?.darkPass || (game.player?.genotype === "plumb" && atLeast(game, "lampless", "loved"));
const cultPass = (game, f) => {
  const def = FACTIONS[f];
  return !!(def?.rulerId && game.state?.journal?.cultPass?.[def.rulerId] !== undefined);
};

// Toward you: a member of the place's faction.
registerPlayerRule("holy", (game, a, said) => {
  const h = game.state ? holyNow(game) : null;
  if (!h || !FACTIONS[h.faction]) return null;
  if (!membershipsOf(a).some(([id]) => id === h.faction)) return null;
  if (cultPass(game, h.faction)) return said === "friendly" ? null : "neutral";   // a pilgrim in its sites
  if (trespassed(game, h.faction)) return "hostile";
  if ((said === "neutral" || said === "wary") && !atLeast(game, h.faction, "liked")) return "hostile";
  return null;
});

function say(game, f, which) {
  const line = FACTIONS[f]?.lines?.trespass?.[which];
  if (line) game.log(`${FACTIONS[f].name}: "${line}"`, which === "turn" ? [255, 120, 100] : [255, 200, 140]);
}
function warn(game, f) {
  const t = st(game)[f];
  if (t.warned) return false;
  t.warned = true; t.at = game.time || 0;
  say(game, f, "warn");
  return true;
}
function turn(game, f) {
  const t = st(game)[f];
  if (t.turned) return;
  t.turned = true; t.at = game.time || 0;
  say(game, f, "turn");
}
const LIGHT_KEEPERS = new Set(["lampless", "sporeMoot"]);   // the faiths whose rule is a lit torch

// The rules, every tick of the clock (both views).
on("clock:tick", (game) => {
  const p = game.player;
  if (!p || !game.state || !game.zone) return;
  const h = holyNow(game), zone = game.zone.key;
  const torch = !!p.torch, was = holyTick.get(game);
  holyTick.set(game, { torch, zone, f: h?.faction ?? null, bombs: new Set(game.zone.bombs || []) });
  if (!h || !FACTIONS[h.faction]) return;
  const f = h.faction, T = st(game);
  if (!T[f] || T[f].zone !== zone) T[f] = { zone };
  const t = T[f], now = game.time || 0;
  if (t.turned) return;
  if (LIGHT_KEEPERS.has(f) || h.rule === "noTorch") {
    if (!torch || (f === "lampless" && darkPass(game))) return;
    if (!atLeast(game, f, "liked")) return;   // (below Warm they are hostile here anyway)
    if (!t.warned) warn(game, f);
    else if (now - t.at >= GRACE) turn(game, f);
    return;
  }
  if (f === "horary") {
    if (was && was.zone === zone && was.f === f && was.torch && !torch) turn(game, f);
    return;
  }
  if (f === "assize") {
    if (p.genotype === "plumb" || atLeast(game, f, "loved")) return;
    if (!t.warned) warn(game, f);
    else if (now - t.at >= GRACE) turn(game, f);
    return;
  }
  if (f === "plan" || f === "pressed") {
    // A bomb that went off since the last tick, inside the place (one damaged block each: bible §7).
    const gone = was && was.zone === zone ? [...was.bombs].filter((b) => !(game.zone.bombs || []).includes(b)) : [];
    for (const b of gone) {
      const at = holyAt(game, b.x, b.y);
      if (at?.faction !== f) continue;
      if (f === "pressed") { turn(game, f); continue; }
      if (!t.warned) { warn(game, f); continue; }
      addRep(game, "plan", -50, "trespass");
      turn(game, f);
    }
  }
});
const holyTick = new WeakMap();

on("zone:leave", (game) => { if (game.state?.trespass) game.state.trespass = {}; });
