// Shrines (TECH_DESIGN §1.2 npcs.js "shrines → social/shrines.js", §1.3 "shrines as a talking statue component";
// bible §3.5 "Donations"; owner WS6b). The parent's shrine (glim for a blessing, a bold offering that may call a
// trial first: content/legacy/encounters.js, dialogue "shrine") becomes a component any statue creature can carry,
// and a faction's shrine also takes donations for reputation.
//
//   makeShrine(c, { cost, faction }) → c     gives any creature that talks (a statue: the legacy shrine, a Vigil
//                                            noon-post, a Lampless Hush) the shrine: c.shrine = { cost, faction? }
//                                            and, unless it already says something of its own, the legacy shrine's
//                                            words (c.talk.dialogue = "shrine", c.talk.state.cost)
//   DONATIONS[factionId] = { per, rep, cap, dark? }   bible §3.5: the Noon Vigil +10 per 50 glim (up to +200);
//                                            the Lampless +1 per 2 glim poured out (up to +150), only in the dark
//   donate(game, c, glim) → { ok, rep, line }   pay glim, gain the faction's rep (the cap counts over the whole run:
//                                            game.state.donations[factionId])
//
// A faction's shrine, or one of its priests (builders.js role "priest"), offers "Give N glim to <faction>." on
// the root of its talk (talk.js registerTalkOptions), in amounts of one step and of five steps.
import { node, bye, talkTo, registerTalkOptions } from "../talk.js";
import { FACTIONS, membershipsOf, addRep, repOf } from "../factions.js";
import { pay, funds, formatPrice } from "../currency.js";
import { inDark } from "../light.js";
import { extendRules } from "../rules.js";

export const DONATIONS = extendRules("donations", {
  noonVigil: { per: 50, rep: 10, cap: 200 },
  lampless: { per: 2, rep: 1, cap: 150, dark: true },
});

export function makeShrine(c, { cost = 10, faction = null } = {}) {
  c.shrine = { cost, ...(faction ? { faction } : {}) };
  if (c.talk && !c.talk.dialogue) c.talk.dialogue = "shrine";
  if (c.talk?.dialogue === "shrine") (c.talk.state ||= {}).cost ??= cost;
  return c;
}

const shrineFaction = (c) => {
  if (c.shrine?.faction) return c.shrine.faction;
  if (c.talk?.dialogue !== "priest") return null;
  let best = null;
  for (const [id, w] of membershipsOf(c)) if (!best || w > best[1]) best = [id, w];
  return best?.[0] ?? null;
};
const given = (game, f) => game.state?.donations?.[f] || 0;

export function donate(game, c, glim) {
  const f = shrineFaction(c), d = DONATIONS[f], p = game.player;
  if (!d) return { ok: false, rep: 0, line: "Nobody here takes donations." };
  if (d.dark && !inDark(game, game.zone, p.x, p.y, p.z + 0.5)) return { ok: false, rep: 0, line: "Pour it out in the dark, or not at all." };
  const room = d.cap - given(game, f), steps = Math.floor(glim / d.per), rep = Math.min(room, steps * d.rep);
  if (rep <= 0) return { ok: false, rep: 0, line: room <= 0 ? `${FACTIONS[f].name} have had all the glim they'll count from you.` : "Too little to count." };
  const cost = Math.ceil(rep / d.rep) * d.per;
  if (!pay(game, p, cost)) return { ok: false, rep: 0, line: `You haven't got ${formatPrice(cost)}.` };
  addRep(game, f, rep, "donation");
  (game.state.donations ||= {})[f] = given(game, f) + rep;
  const line = `You give ${formatPrice(cost)} to ${FACTIONS[f].name}. (+${rep})`;
  game.log(line, FACTIONS[f].color || [255, 220, 140]);
  return { ok: true, rep, line };
}

registerTalkOptions("donations", (game, c) => {
  const f = shrineFaction(c), d = DONATIONS[f];
  if (!d || !game.state || repOf(game, f) <= -600 || given(game, f) >= d.cap) return null;
  return [d.per, d.per * 5].filter((n) => funds(game.player) >= n).map((n) => ({
    label: `Give ${formatPrice(n)} to ${FACTIONS[f].name}.`,
    go: () => node(donate(game, c, n).line, [{ label: "Back.", go: () => talkTo(game, c) }, bye()]),
  }));
});
