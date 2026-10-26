// Every screen the game registers (screens.js): the views, then what opens over them. The Phase 1 screens
// (TECH_DESIGN §4.2, owners in §8.4) are listed here from 0D2 as stubs that register nothing yet, so this
// file needs no edit when a workstream builds one: the stub registers its mode itself once built.
import "./play.js";
import "./transition.js";
import "./inventory.js";
import "./talk.js";
import "./journal.js";
import "./story.js";
import "./levelup.js";
import "./pause.js";
import "./dead.js";
import "./title.js";
import "./worldmap.js";    // world      WS1
import "./create.js";      // create     WS4
import "./charsheet.js";   // char       WS4
import "./abilities.js";   // abilities  WS4
import "./equipment.js";   // (inventory's Equipment tab) WS5
import "./examine.js";     // examine    WS5
import "./factions.js";    // factions   WS6a
import "./trade.js";       // trade      WS6b
import "./ritual.js";      // ritual     WS6b
import "./target.js";      // target     WS8
import "./log.js";         // log        WS9
import "./options.js";     // options    WS9
