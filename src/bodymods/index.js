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
import { isPlumb, gradeOf, gradeUsed, trueMarks } from "./implants.js";
export { canInstall, install, uninstall } from "./implants.js";
export { examineArtifact } from "./artifacts.js";

setBodyNote((game, p) => (isPlumb(p)
  ? `Grade ${gradeUsed(p)} of ${gradeOf(p)} used · ${trueMarks(p)} true-mark${trueMarks(p) === 1 ? "" : "s"} · implants go in and out only at a Truing Cradle`
  : null));
