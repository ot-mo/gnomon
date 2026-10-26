// The torch's glim (DECISIONS §1 "Currency"; bible §3.2). The torch burns 1 glim per
// RULES.torch.hoursPerGlim world hours (4: 240 s of game time) while it is lit in darkness: underground
// (a zone with no sky), inside the Shade (a span whose terrain is `dark`), and on the surface at night
// (19:00-05:00, clock.js). By day it costs nothing. With an empty purse it gutters to a 1-tile flicker
// (RULES.torch.gutterRange) and never goes out: it still counts as lit for every light rule (light.js
// inDark, braziers), and the next glim you get relights it at once, by day too (it pays the glim it owes
// on the next tick of the clock: bible §3.2, it gutters "until you get more glim").
//
//   darkSeconds(game, zone, t0, t1) → s     how much of [t0, t1] is darkness for a torch in that zone
//   burnTorch(game, e, t0, t1, zone)         the drain, the only one: e.torchBurn counts the seconds lit in
//                                            darkness since the last glim; each glimSeconds() of them pays 1
//                                            glim through currency.pay. When the purse can't, the count
//                                            stays at glimSeconds() (owed; the flicker itself is free), and
//                                            every later tick, dark or not, tries to pay it
//   torchGutters(e) → bool                   lit, and the last glim couldn't be paid
//   glimSeconds() → 240
//
// It runs from the clock (clock.js catchUp emits "clock:tick" { t0, t1 }): every frame in both views
// (3D frames and map actions alike pass game time), when you leave a zone (so the time counts in the
// zone you spent it in), and from skipTime. darkSeconds is exact for any interval (nightSeconds adds up
// over any split), so a skip burns what playing the same time out burns.
import { RULES } from "./rules.js";
import { pay } from "./currency.js";
import { nightSeconds } from "./clock.js";
import { zoneIsLightless } from "./light.js";
import { on } from "./events.js";

export const glimSeconds = () => RULES.torch.hoursPerGlim * 60 * RULES.clock.secondsPerMinute;

// Is this zone on a span whose terrain is always dark (the Shade)?
function darkTerrain(game, zone) {
  const world = game.run?.world;
  if (!world?.tileAt || zone.wx === undefined || zone.wx === null) return false;
  const tile = world.tileAt(zone.wx, zone.wy);
  return !!(tile && world.terrains?.[tile.terrain]?.dark);
}

export function darkSeconds(game, zone, t0, t1) {
  if (!zone || !(t1 > t0)) return 0;
  if (zoneIsLightless(zone) || darkTerrain(game, zone)) return t1 - t0;
  return nightSeconds(t0, t1);
}

export const torchGutters = (e) => !!e?.torch && (e.torchBurn || 0) >= glimSeconds() - 1e-9;

export function burnTorch(game, e, t0, t1, zone = game.zone) {
  if (!e?.torch) return;
  const dark = darkSeconds(game, zone, t0, t1), was = torchGutters(e);
  if (!(dark > 0) && !was) return;   // by day nothing burns; a guttering torch still pays what it owes
  const per = glimSeconds();
  e.torchBurn = (e.torchBurn || 0) + (dark > 0 ? dark : 0);
  while (e.torchBurn >= per - 1e-9) {
    if (!pay(game, e, 1)) { e.torchBurn = per; break; }
    e.torchBurn = Math.max(0, e.torchBurn - per);
  }
  const now = torchGutters(e);
  if (e === game.player && now !== was)
    game.log(now ? "Your purse is dry: the torch gutters down to a flicker." : "The torch drinks a drop of glim and flares up again.", [255, 200, 120]);
}

on("clock:tick", (game, { t0, t1 }) => { if (game.player) burnTorch(game, game.player, t0, t1); });
