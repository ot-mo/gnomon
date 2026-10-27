// Genotypes (bible §10.3, §15.6; TECH_DESIGN §2.6 "Starting values"; WS4, then C4). The ids are fixed by DECISIONS
// §1: `bent` (mutations; the points are creases) and `plumb` (implants; grade, true-marks, the Truing Cradle).
//
//   GENOTYPES[id] = { name, plural, info, base, points, perPoint, steepAt, steepCost, maxAtCreation,
//                     track: "mutations" | "implants", creases?, creasesPerLevel?, grade?, freeImplantCost?,
//                     names, tonics }
//   base          every attribute starts here, and can't be bought below it
//   points        to spend at creation: +1 for perPoint up to steepAt, then steepCost per +1 (bible: 1 per +1 up to
//                 18, then 2), at most maxAtCreation in one attribute before the background's bonus
//   track         the second progression track (bible §15.9: two tracks, powers and this)
//   creases       the Bent's build currency at creation, +creasesPerLevel a level (progression/mutations.js spends them)
//   grade         the Plumb's at creation, with one free implant costing at most freeImplantCost (WS5 fits it)
//   names         the culture progression/chargen.js suggestName draws from (bible §2.3)
//   tonics        how tonics treat the genotype (bible §10.3; WS6b/C4 read it): Bent "half" (5% bad reaction), Plumb "full"
// Starting reputation by genotype (the Assize −700 or −100, the Plan +100 for the Plumb) is the faction table's
// (bible §15.4 "Start (Bent / Plumb)", WS6a); a background adds its own changes on top (content/backgrounds.js).
export const GENOTYPES = {
  bent: {
    name: "Bent", plural: "the Bent",
    info: "Things that were pressed and let go come back creased, and mutation is a crease. You carry the Pressing in your blood.",
    base: 10, points: 44, perPoint: 1, steepAt: 18, steepCost: 2, maxAtCreation: 22,
    track: "mutations", creases: 12, creasesPerLevel: 1,
    names: "marshfolk", tonics: { effect: 0.5, badReaction: 0.05 },
  },
  plumb: {
    name: "Plumb", plural: "the Plumb",
    info: "Your line sealed itself in the Levels while the Pressing happened, and carries no creases. Implants true you instead.",
    base: 12, points: 38, perPoint: 1, steepAt: 18, steepCost: 2, maxAtCreation: 22,
    track: "implants", grade: 2, freeImplantCost: 2,
    names: "plumb", tonics: { effect: 1, overdose: true },
  },
};
