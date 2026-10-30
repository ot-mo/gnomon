// An Hour's cult as a faction definition (bible §6.3, §7.7, §8.7; C2 #6; B3): C2's recipe (docs/c2.md request 6) from
// content/factions.js HOUR_CULT and the ruler. Pure data, imported by world/run.js's factions step; social/cults.js does
// the rest (registering it, its members, the pass, the Hourbound). Its own module so the run doesn't load the save codec.
//   cultFaction(ruler) → FactionDef   id `cult:<short>`
import { HOUR_CULT } from "../content/factions.js";
import { GRAMMAR } from "../content/grammar.js";

export function cultFaction(R) {
  const D = GRAMMAR.domains[R.domains?.[0]];
  return { ...HOUR_CULT, id: `cult:${R.short}`, name: R.cult?.name || `the cult of ${R.name}`, color: D?.rgb || [230, 170, 60], rulerId: R.id,
    about: HOUR_CULT.about.replace("{name}", R.name).replace("{cog}", R.epithet).replace("{ordinal}", R.ordinal),
    likes: [...(R.favoured || []).map((f) => [f, "the Hour favoured them"]), ["horary", HOUR_CULT.likesHorary]],
    hates: (R.hated || []).map((f) => [f, "the Hour hated them"]) };
}
