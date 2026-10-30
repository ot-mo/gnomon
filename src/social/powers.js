// Two powers that live among the peoples (bible §13.2; content/powers.js; B3):
//   Oil fire (Glimcraft)   your torch lit, look (L) at a glim or clear-glim puddle within 4 tiles (social/liquids.js
//                          pourLiquid: a dropped vial) and it catches: 6 s of fire (clear glim 12) for whatever stands in it
//   Chime (Parley)         an ability: preach at a creature that is neutral to you (bible §7.2 "Conversion": EGO
//                          against its WIL): d20 + your EGO modifier against 10 + its WIL modifier; won, it walks with
//                          you (ai.js recruit), one at a time; lost, it has heard enough sermons for a day. 60 s
import { on } from "../events.js";
import { registerAbility } from "../abilities.js";
import { attitude } from "../factions.js";
import { mod } from "../stats.js";
import { hashInt } from "../rng.js";
import { hasKey } from "../keyset.js";
import * as ai from "../ai.js";
import { lightPuddle } from "./liquids.js";

export const OIL_FIRE = { reach: 4 };
on("inspect", (game, ev) => {
  const p = game.player;
  if (!ev?.open || !p?.torch || !hasKey(p.perks, "oilFire")) return;
  if (Math.max(Math.abs(ev.x - Math.floor(p.x)), Math.abs(ev.y - Math.floor(p.y))) > OIL_FIRE.reach) return;
  if (lightPuddle(game, ev.x, ev.y)) game.log("You touch your torch to the oil. It goes up with a soft cough.", [255, 170, 80]);
});

export const CHIME = { cooldown: 60, range: 4, dc: 10, day: 24 * 60 };
const wilOf = (c) => (c.attrs ? mod(c, "wil") : 0);
registerAbility("chime", {
  name: "the Chime", source: "power", target: "creature", range: CHIME.range, cooldown: () => CHIME.cooldown, mapTime: 1,
  info: () => `Preach at a creature that leaves you be: EGO against its WIL, and it walks with you. One at a time.`,
  use(game, e, lvl, target) {
    const c = target?.creature, say = (t, col = [230, 200, 140]) => { if (e === game.player) game.log(t, col); };
    if (!c || c === e) return false;
    if (c.boss || c.flags?.legend || attitude(game, c, e) !== "neutral") { say(`${c.name} isn't listening.`, [200, 190, 170]); return false; }
    const now = game.time || 0;
    if (c.chimedAt !== undefined && now - c.chimedAt < CHIME.day) { say(`${c.name} has heard your sermon already today.`, [200, 190, 170]); return false; }
    const prev = game.zone.creatures.find((o) => o.chimed && o.brain?.leader === "player");
    c.chimedAt = now;
    const roll = 1 + (hashInt(game.seed ?? 0, "chime", c.id, Math.floor(now)) % 20);
    if (roll + mod(e, "ego") < CHIME.dc + wilOf(c)) { say(`You ring the Chime. ${c.name} listens politely, and stays where it is.`); return true; }
    if (prev) { ai.dismiss(game, prev); prev.chimed = false; }
    ai.recruit(game, c, e);
    c.chimed = true;
    say(`You ring the Chime, and ${c.name} hears the hour in it. It falls in beside you.`, [255, 220, 150]);
    return true;
  },
});
