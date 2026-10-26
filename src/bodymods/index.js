// Body mods (WS5; TECH_DESIGN §8.3 "WS5"). src/features.js imports this file; it registers everything WS5 adds
// (the implant, artifact, cell and true-mark item kinds, the stations' use, the examine screen's `inspect` handler).
//
//   canInstall(game, p, item, partId) · install(game, p, item, partId) · uninstall(game, p, partId)   implants.js
//   examineArtifact(game, p, it) → result                                                             artifacts.js
//
// WS5 also owns items.js, inventory.js, effects.js, body.js and the screens equipment and examine
// (screens/index.js imports every screen).
// P0: registers nothing, so the game plays as before. Remove STUB when WS5 registers its parts here.
import "./stations.js";
export { canInstall, install, uninstall } from "./implants.js";
export { examineArtifact } from "./artifacts.js";
export const STUB = "WS5";
