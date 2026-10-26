// Missile weapons (TECH_DESIGN §1.1 "fire, reload, ammo in both views", §8.3 "WS8"; owner WS8): V fires (explore,
// map; §4.3), a targeted shot on the map through abilities.js requestTarget (the target screen, screens/target.js),
// real flight in 3D, both through combat.js resolveAttack. The design names no function here, so nothing is
// frozen; WS8 chooses the exports (content/items/missiles.js holds the weapons).
// P0: nothing (V is not bound). Remove STUB when the file is built.
export const STUB = "WS8";
