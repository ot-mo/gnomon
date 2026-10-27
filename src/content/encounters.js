// Travel encounter tables (TECH_DESIGN §5.2 "Encounters", §2.18; bible §4.9; WS1, then C3 for the final data).
// overworld/encounters.js reads them; nothing here draws a random number.
//
//   ENCOUNTERS.kinds        kind → weight: what an encounter roll on the road turns out to be
//                             band        a hostile band: you are dropped into the span's zone, visited or not,
//                                         and it waits 8-12 tiles from where you arrive
//                             travellers  people on the road: they tell you of an unknown site near by (it is
//                                         pinned) or of the spans around you (revealed); you stay on the map
//                             legend      a legend away from its lair (only one that is placed nowhere yet and
//                                         alive: zones.js claimUid), met like a band; rolled as a band when the
//                                         run has none to send
//   ENCOUNTERS.regions      region id → { kinds?, creatures?: [type ids] }: a region's own weights, and the types
//                           its bands are drawn from (default: every type for the span's level, creatures.js
//                           pickCreatureType)
//   ENCOUNTERS.band         size: [lo, hi] at tier 1, each grown by perTier[k] a tier; same: the chance that a
//                           member is the leader's kind; elites as creatures.js rollElite gives them
//   ENCOUNTERS.travellers   rumour: how many spans away a site they tell you of may lie; reveal: the radius
//                           of spans they describe when they know of no site
//   ENCOUNTERS.legend       tiers: how far the span's tier may be from its lair's for a legend to roam there
//   ENCOUNTERS.lines        what the log says; {who}, {site}, {dir}, {spans}, {name} are filled in
export const ENCOUNTERS = {
  kinds: { band: 6, travellers: 3, legend: 1 },
  regions: {},
  band: { size: [1, 2], perTier: [0.3, 0.45], same: 0.7, state: "wander" },
  travellers: { rumour: 4, reveal: 1 },
  legend: { tiers: 1 },
  lines: {
    band: ["Tracks cross the road ahead, and they are fresh: {who}.", "Something has been following you since the last span: {who}.",
           "You walk into a camp you should have smelled sooner: {who}."],
    legend: ["Someone old and patient has been waiting on your road: {name}.", "The birds go quiet. {name} is abroad, far from its lair."],
    travellers: ["A salt-trader going the other way tells you of {site}, {spans} {dir} of here.",
                 "Two drovers resting by the way tell you of {site}, {spans} {dir} of here.",
                 "A surveyor with a chain over one shoulder marks {site} on your map: {spans} {dir} of here."],
    roads: ["A salt-trader going the other way tells you how the land lies around here.",
            "A Flatfolk courier, edge-on to you, describes the spans around you in a numbered list."],
    // A hidden site seen from the road (bible §4.9): by its kind, then "Stop and look?".
    site: { village: "Smoke rises from a fold in the land.", ruin: "Cut stone shows through the ground off the way.",
            lair: "A trail of gnawed bones leads off the way.", historic: "A carved post leans by the way, older than the road.",
            station: "Something squared and Plumb glints off the way.", other: "Something off the way catches your eye." },
    lost: "The way you thought you knew isn't there. You've lost your bearings.",
  },
};
