// The landmarks' authored data (TECH_DESIGN §2.18 content/world/landmarks.js + plans/*.js; bible §5, §15.3): what
// worldmap.js adds to LANDMARK_INDEX's entry for each landmark that has its plan. C1a: Hollowmere, the start; C1b adds
// the other 15 (until then they stand on stub footprints, gen/surface.js).
//
//   LANDMARKS = [{ id, plan, anchor, flatten, visibleFrom, checkpoint, description, lines, letters }]
//     anchor       the plan's corner in its zone ([x, y]), so its footprint is the plan's size from there
//     description  the Deep line (bible §2.1: what you see in 3D); lines: all three registers, Flat, Deep and Dark
//     letters      who stands on each of the plan's people letters (C5 writes their words; each is placed once its
//                  kind exists: C3, C5). Maren is the temple's own (content/world/temple.js "M")
//   PLANS = { [id]: plan }   (plans/*.js; gen/surface.js stamps a plan through its `stamp` or stampVault)
import { HOLLOWMERE_PLAN } from "./plans/hollowmere.js";

export const LANDMARKS = [
  {
    id: "hollowmere", plan: "hollowmere", anchor: [0, 0], flatten: true, visibleFrom: 2, checkpoint: true,
    description: "Reed roofs, eel smoke, and a squat temple whose walls meet at angles nobody likes.",
    lines: {   // bible §5 A
      flat: "HOLLOWMERE. Stilts 212. Lamps 1 (commons). Cube 1.",
      deep: "Reed roofs, eel smoke, and a squat temple whose walls meet at angles nobody likes.",
      dark: "the floor has been shaking\nsomething under it is counting",
    },
    letters: {   // bible §5 A, "Inhabitants and services"
      a: { who: "mira", name: "Mira", role: "the Survey's cartographer" },
      b: { who: "tamsin", name: "Brother Tamsin", role: "a Horary missionary" },
      c: { who: "brann", name: "Brann", role: "a ghost in the crypt, seen only with your torch out" },
      e: { who: "hallen", name: "Reeve Hallen", role: "the Reeve" },
      i: { who: "ottilie", name: "Old Ottilie", role: "tinker" },
      j: { who: "corwin", name: "Sir Corwin", role: "the village warden" },
      n: { who: "pell", name: "Pell", role: "peddler (days 1-2 of his round)" },
      o: { who: "essAndTee", name: "Ess and Tee", role: "Flatfolk envoys of Folio, only on the map" },
      q: { who: "corner", name: "Corner", role: "the temple cat" },
    },
  },
];

export const PLANS = { hollowmere: HOLLOWMERE_PLAN };
