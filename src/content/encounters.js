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
//   ENCOUNTERS.regions      region id → { kinds?, rows? }: a region's own weights, and (C3) the bands of the real world's
//                           regions (content/world/regions.js ids, docs/c1.md):
//                             rows        [[type, weight, lo, hi]]: the species a band of the span's level is drawn from
//                                         (content/creatures/levels.js pickRow, one draw as pickCreatureType makes): those
//                                         out for a stranger on the road (bible §12 by region; a faction's beasts and
//                                         patrols, not its docile or neutral folk), at least two at every level the
//                                         region's spans make (check-overworld). Read once overworld/encounters.js
//                                         bandOf draws from them (docs/c3.md, integration request 3); until then a band
//                                         is the parent's tables' (creatures.js pickCreatureType), as on the test world
//                           (`creatures`: [type ids] with the parent's `depths`, WS1's shape, still reads as before)
//   ENCOUNTERS.band         size: [lo, hi] at tier 1, each grown by perTier[k] a tier; same: the chance that a
//                           member is the leader's kind; elites as creatures.js rollElite gives them
//   ENCOUNTERS.travellers   rumour: how many spans away a site they tell you of may lie; reveal: the radius
//                           of spans they describe when they know of no site
//   ENCOUNTERS.legend       tiers: how far the span's tier may be from its lair's for a legend to roam there
//   ENCOUNTERS.lines        what the log says; {who}, {site}, {dir}, {spans}, {name} are filled in
const row = (type, weight, lo, hi) => [type, weight, lo, hi];

export const ENCOUNTERS = {
  kinds: { band: 6, travellers: 3, legend: 1 },
  regions: {
    // The Flats and the Mere: the safest country; more people on the way than teeth.
    flats: { kinds: { band: 5, travellers: 4, legend: 1 },
      rows: [row("saltrat", 4, 1, 8), row("brinehog", 3, 1, 8), row("brineGrub", 2, 1, 8), row("flatling", 1, 1, 10)] },
    waste: { rows: [row("brinehog", 3, 1, 11), row("rustbackScav", 3, 1, 11), row("chaffDevil", 3, 3, 11), row("saltrat", 1, 1, 7)] },
    steps: { rows: [row("rustbackScav", 5, 1, 10), row("rustbackSlinger", 2, 3, 10), row("ledgehorn", 3, 3, 10), row("ledgeSpider", 2, 3, 10),
                    row("saltrat", 1, 1, 7), row("brineGrub", 1, 1, 7)] },
    oldCuts: { rows: [row("rustbackScav", 5, 1, 10), row("rustbackSlinger", 2, 3, 10), row("ledgeSpider", 2, 3, 10), row("duskBat", 2, 3, 10)] },
    downs: { rows: [row("cairnHound", 3, 3, 11), row("barrowSkeleton", 2, 3, 13), row("duskBat", 2, 3, 13), row("brinehog", 2, 1, 8),
                    row("barrowTroll", 1, 9, 16), row("assizeOutrider", 1, 6, 13)] },
    // The Pleatwood keeps its own peace (its beetles, vines and monkeys are the trees' and leave a stranger be until
    // the trees don't): what comes for you on its roads is the wood's other animals.
    pleatwood: { kinds: { band: 4, travellers: 4, legend: 1 },
      rows: [row("pleatSpider", 4, 3, 15), row("duskBat", 2, 3, 14), row("hangvine", 1, 6, 16), row("paperWasps", 2, 9, 23), row("brinehog", 1, 3, 8)] },
    deepPleat: { rows: [row("paperWasps", 4, 9, 23), row("pleatSpider", 2, 9, 15), row("mootWalker", 2, 12, 23), row("hangvine", 1, 9, 23),
                        row("plumbknight", 1, 12, 23), row("assizer", 1, 12, 23), row("assizeOutrider", 1, 9, 17), row("duskBat", 1, 9, 14)] },
    // The Tessellate: Flatfolk couriers on every road, and the Assize's hounds after them.
    tessellate: { kinds: { band: 5, travellers: 4, legend: 1 },
      rows: [row("pressHound", 4, 9, 18), row("tileMimic", 3, 9, 18), row("erratum", 1, 9, 18), row("lampHound", 1, 6, 16), row("mosaicGolem", 1, 12, 18)] },
    shade: { kinds: { band: 7, travellers: 1, legend: 2 },
      rows: [row("shade", 4, 12, 28), row("longshadow", 3, 12, 28), row("wraith", 2, 12, 28)] },
    inkrun: { rows: [row("longshadow", 2, 12, 17), row("pressHound", 2, 9, 16), row("shade", 2, 12, 17), row("wraith", 1, 12, 17)] },
    stacks: { rows: [row("rustbackBrute", 3, 12, 25), row("beatSpider", 3, 12, 25), row("rustOoze", 2, 12, 25), row("girderGolem", 1, 15, 25)] },
    lattice: { kinds: { band: 7, travellers: 1, legend: 2 },
      rows: [row("askewAngle", 3, 18, 30), row("fold", 2, 18, 30), row("latticeTroll", 2, 18, 30), row("planarQueen", 1, 18, 30)] },
    teeth: { rows: [row("ledgehorn", 3, 3, 14), row("duskBat", 2, 3, 14), row("cairnHound", 1, 3, 11), row("lampHound", 1, 6, 16), row("barrowTroll", 1, 9, 16)] },
    glassShore: { rows: [row("glassCrab", 3, 12, 24), row("slagSalamander", 2, 12, 24), row("erratum", 2, 9, 24), row("tileMimic", 2, 9, 16), row("pressHound", 1, 9, 18)] },
    glassCauseway: { rows: [row("glassCrab", 3, 12, 22), row("erratum", 2, 9, 22), row("slagSalamander", 1, 12, 22)] },
    // The roads: traders and drovers going the other way, and whoever patrols the road.
    oldRule: { kinds: { band: 5, travellers: 5, legend: 1 },
      rows: [row("rustbackScav", 3, 1, 10), row("brinehog", 2, 1, 8), row("saltrat", 1, 1, 7), row("cairnHound", 1, 3, 11), row("assizeOutrider", 2, 6, 17),
             row("pressHound", 1, 9, 17), row("rustbackBrute", 1, 12, 17), row("plumbknight", 1, 14, 17)] },
    straightCut: { rows: [row("assizeOutrider", 3, 6, 17), row("pressHound", 2, 9, 17), row("plumbknight", 1, 12, 19), row("assizer", 1, 12, 19),
                          row("paperWasps", 1, 9, 17)] },
    slake: { rows: [row("brineGrub", 2, 1, 11), row("brinehog", 2, 1, 11), row("pleatSpider", 1, 3, 15), row("saltrat", 1, 1, 8)] },
    // (The Hollow Mere and the Glass Sea have no road and no encounter rate: nothing is met there on the way.)
  },
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
