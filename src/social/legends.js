// Legends among the peoples (bible §12.13; WS10 #6; B3). A legend carries its 1-3 opinions of factions (world/sites.js
// makeLegend; gen/vaults.js spawnLegend puts them on the creature as c.opinions [[faction, "loves" | "hates", why]]):
//   - the Kindling's bond moves every faction that has an opinion of it (social/ritual.js opinionsOf);
//   - it sides with the members of a faction it loves and goes for those of one it hates (factions.js attitude);
//   - toward you it is a monster, out for you, unless you stand Warm or better with a faction it loves and with none it
//     hates: then it lets you be (neutral) until you give it cause (a grudge);
//   - flame-kin with it, it is friendly.
// A Herdmother is the Saltbeasts' (c.faction) and docile. A beast has no words, so there is no talk: look at her (L,
// either view) where a rite of hers is ready and it is done (the Saltbeasts' Herdmother's Lighting: in 3D, torch lit,
// within 2 tiles, facing her); where none is, the look says why. Kindled, her herd (every creature with c.herdOf = her
// uid) is friendly to you (game.state.kindling.herds[uid]).
import { FACTIONS, repOf, band, REP_BANDS, registerPlayerRule } from "../factions.js";
import { on } from "../events.js";
import { canKindle, riteReady, performRite, kin, RITES } from "./ritual.js";
import { registerCreatureField } from "../save/codec.js";

const warm = (game, f) => REP_BANDS.indexOf(band(repOf(game, f))) >= REP_BANDS.indexOf("liked");

registerPlayerRule("legend", (game, a, said) => {
  const ks = game.state?.kindling;
  if (a.herdOf && ks?.herds?.[a.herdOf] !== undefined) return "friendly";
  if (!a.flags?.legend) return null;
  if (a.uid && ks?.kin?.[a.uid]) return "friendly";
  if (said !== "hostile" || !Array.isArray(a.opinions) || a.brain?.grudges?.player) return null;
  const loved = a.opinions.filter(([, feel]) => feel === "loves").map(([f]) => f).filter((f) => FACTIONS[f]);
  const hated = a.opinions.filter(([, feel]) => feel === "hates").map(([f]) => f).filter((f) => FACTIONS[f]);
  return loved.some((f) => warm(game, f)) && !hated.some((f) => warm(game, f)) ? "neutral" : null;
});

on("inspect", (game, ev) => {
  if (!ev?.open || !game.player) return;
  const c = (ev.zone || game.zone)?.creatures?.find((m) => m.flags?.legend && !m.talk && m.tx === ev.x && m.ty === ev.y);
  if (!c || !c.faction) return;
  if (kin(game, c)) { game.log(`${c.name} knows your light.`, [255, 220, 150]); return; }
  const no = canKindle(game, c);
  if (no) { game.log(no, [200, 190, 170]); return; }
  const ready = Object.keys(RITES).find((r) => !riteReady(game, c, r));
  if (!ready) { game.log(riteReady(game, c, "lighting") || "Not here. Not like this.", [200, 190, 170]); return; }
  performRite(game, c, ready);
});

registerCreatureField("herdOf");
registerCreatureField("opinions");   // (a legend's; village-site.js registers it for villagers too)
