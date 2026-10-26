// The world map's drawing (TECH_DESIGN §5.2 "Viewport"; §1.4 "overworld (WS1)"). A P0 stub with the frozen
// signature; WS1 builds it and calls it from the `world` screen (screens/worldmap.js).
//
//   renderWorld(game)     the viewport (two cells per span, following the cursor with the zone map's pickOrigin
//                         rule) and the info panel (right, 40 columns, from 2·w + 42 columns; else a 6-row strip);
//                         checked at 100×30, 160×64 and 180×56. Draws only: no state changes.
//
// Until WS1 builds it, it throws "not built yet (WS1)". Remove STUB when the file is built.
export const STUB = "WS1";

export function renderWorld(game) { throw new Error("renderWorld: not built yet (WS1)"); }
