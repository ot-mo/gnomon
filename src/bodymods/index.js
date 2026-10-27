// Body mods (WS5; TECH_DESIGN §8.3 "WS5"). src/features.js imports this file; it registers everything WS5 adds:
// the implant and true-mark kinds, the implant abilities and the "stilled" status (implants.js), the artifact and
// cell kinds and the cells' recharging (artifacts.js), the Truing Cradle's use and the surgeon and tinker
// services (stations.js), and the Equipment tab's grade line. The examine screen and the tabbed inventory
// register from screens/examine.js and screens/equipment.js (screens/index.js imports every screen).
//
//   canInstall(game, p, item, partId) · install(game, p, item, partId) · uninstall(game, p, partId)   implants.js
//   examineArtifact(game, p, it) → result                                                             artifacts.js
// docs/ws5.md lists everything else they export.
import "./stations.js";
import { setBodyNote } from "../inventory.js";
import { pickUpHere } from "../items.js";
import { bind } from "../keys.js";
import { on } from "../events.js";
import { isPlumb, gradeOf, gradeUsed, trueMarks, implantEffect } from "./implants.js";
import { markHoles, randomBodyMod } from "./artifacts.js";
import { BOTTOM_LOOT } from "../gen/vaults.js";
import { BEAT_SIGHT } from "../traps.js";
export { canInstall, install, uninstall } from "./implants.js";
export { examineArtifact } from "./artifacts.js";

// WS10's seams (at its merge): a lair's owner guards an artifact, a cell or an implant, and the reliquary's altar
// holds one (drawn from the site's own stream); the metronome heart shows the spikes about to rise in 3D.
BOTTOM_LOOT.bodyMod = randomBodyMod;
BEAT_SIGHT.has = (game) => implantEffect(game.player, "beatSight");

// G (TECH_DESIGN §4.3, WS5's key): pick up what lies at your feet, in either view; it takes no time, as walking over
// things doesn't.
bind("play", "KeyG", (game) => { pickUpHere(game); }, { help: "pick up" });

// The plumb-line ear: pits and chasms within 6 tiles mark themselves on the map as time passes (both views: the clock
// ticks with 3D frames and with map actions alike).
on("clock:tick", (game) => {
  const p = game.player;
  if (game.zone && implantEffect(p, "plumbEar")) markHoles(game.zone, p.x, p.y, 6);
});

setBodyNote((game, p) => (isPlumb(p)
  ? `Grade ${gradeUsed(p)} of ${gradeOf(p)} used · ${trueMarks(p)} true-mark${trueMarks(p) === 1 ? "" : "s"} · implants go in and out only at a Truing Cradle`
  : null));
