// The ancient history of a run (TECH_DESIGN §2.15; bible §8: the Hours, the god-kings of the morning).
//
//   generateHistory(seed, world) → History
//   History = { rulers: [{ id, name, epithet, domains, born: { region }, died, favoured, hated, events: [{ id, year, type,
//               cause, text: { gospel, inscription, hostile }, siteRequest?, relicId? }] }],
//               siteRequests: [{ id, rulerId, eventId, name, tier, regionPrefs, floors, relicId }],
//               relics: [{ id, name, base: { kind, id }, powers, domain, lovedBy, slays }] }
//
// P0 fixture: the same History for every seed (two Hours, two site requests, one relic), so the site
// code can be built against the real contract while WS7 writes the generator. The generator will draw
// only from seedFor(seed, "history"), never Math.random (R6). A fresh copy each call: callers may keep it.
import { countGen } from "../world/genstats.js";

const FIXTURE = {
  rulers: [
    {
      id: "hour:ishvalet", name: "Ishvalet", epithet: "the Glazier", domains: ["glass"], born: { region: "the Clear Coast" },
      died: 214, favoured: ["kites", "plan", "flatfolk"], hated: ["unlit"],
      events: [
        { id: "ishvalet:1", year: 140, type: "origin", cause: "heir to the reigning Hour",
          text: { gospel: "Ishvalet was born under a pane that would not break.",
                  inscription: "HERE THE GLAZIER FIRST SAW THE MORNING THROUGH GLASS.",
                  hostile: "A lens-grinder's child, spoiled by mirrors." } },
        { id: "ishvalet:2", year: 171, type: "forgedRelic", cause: "grinding lenses", relicId: "relic:morningLens",
          text: { gospel: "She ground the Morning Lens from the sea's first glaze.",
                  inscription: "THE LENS SEES WHAT THE EYE REFUSES.",
                  hostile: "She stole the sea's glass and called it a gift." } },
        { id: "ishvalet:3", year: 198, type: "longShadow", cause: "two suns in one lens", siteRequest: "site:glazierRest",
          text: { gospel: "Where two suns stood in one lens, she raised a house of clear walls.",
                  inscription: "REST, GLAZIER. THE PANES KEEP WATCH.",
                  hostile: "A glass house for a glass heart." } },
      ],
    },
    {
      id: "hour:ammaruth", name: "Ammaruth", epithet: "Who Wept Salt", domains: ["salt"], born: { region: "the White Pans" },
      died: 402, favoured: ["clatter", "saltbeasts", "errata"], hated: ["pleatwood"],
      events: [
        { id: "ammaruth:1", year: 330, type: "origin", cause: "found pressed in a floor and unpressed as a babe",
          text: { gospel: "Ammaruth was lifted from a salt floor, and wept the first salt.",
                  inscription: "FROM THE CRUST, A CROWN.",
                  hostile: "Dug out of the pans like a stone, and as cold." } },
        { id: "ammaruth:2", year: 371, type: "armyAtGate", cause: "a ban on salting the dead", siteRequest: "site:saltedField",
          text: { gospel: "He salted the field where the gate fell, so nothing would grow against him.",
                  inscription: "THE WHITE FIELD REMEMBERS.",
                  hostile: "He burned the harvest white and called it law." } },
      ],
    },
  ],
  siteRequests: [
    { id: "site:glazierRest", rulerId: "hour:ishvalet", eventId: "ishvalet:3", name: "Ishvalet's Rest", tier: 2,
      regionPrefs: ["midwood", "tessellate"], floors: 2, relicId: "relic:morningLens" },
    { id: "site:saltedField", rulerId: "hour:ammaruth", eventId: "ammaruth:2", name: "the Salted Field of the Gate", tier: 1,
      regionPrefs: ["westreach", "waste"], floors: 2, relicId: null },
  ],
  relics: [
    { id: "relic:morningLens", name: "the Morning Lens", base: { kind: "amulet", id: "sight" }, powers: [{ examine: 5 }],
      domain: "glass", lovedBy: ["kites"], slays: ["unlit"] },
  ],
};

export function generateHistory(seed, world) {
  countGen("history");
  return JSON.parse(JSON.stringify(FIXTURE));
}
