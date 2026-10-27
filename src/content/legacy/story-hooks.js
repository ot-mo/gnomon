// The parent game's story on the event bus (TECH_DESIGN §2.12; moved out of game.js in 0D1): the guardians
// waking and falling, the Lich King's death (the win), relics turning up once each, the gate opening from
// below, Vorlath's taunts and the last floor's pages.
//
//   win(game)   the run is won: the epilogue's pages, then the victory card
import { on } from "../../events.js";
import { setMode } from "../../screens.js";
import { CREATURE_TYPES, theOf, TheOf } from "../../creatures.js";
import { makeItem, makeRelic, pickRelic, randomEquipment, awayFromWalls, RELICS, RELIC_COLOR } from "../../items.js";
import { mapView } from "../../renderMap.js";
import { openStory } from "../../dialogue.js";
import { B, FLOOR_Z } from "../../world.js";
import { EPILOGUE, TAUNTS, FINAL_PAGES, LICH_COLOR } from "../../story/legacy.js";
import { finishQuest, questOf } from "../../story/quests.js";

function finishMainQuest(game) {   // quietly: the ending pages say it
  if (questOf(game, "main")) finishQuest(game, "main", null, { quiet: true });
}

// A guardian notices you (guardians.js emits "guardian:wake").
on("guardian:wake", (game, { c }) => {
  const words = {
    flatqueen: "The drawing on the floor moves. The Flat Queen slides toward you, flat as a shadow. (She lives in the plane: fight her on the map.)",
    warden: "Something huge breathes out in the dark, and your torch gutters. The Gloom Warden is awake. (It hides from torchlight.)",
    colossus: "Stone grinds on stone. The Colossus turns its head to look at you, and the star in its brow blazes. (Strike the core from up high.)",
  }[c.guardian];
  game.log(words, c.color);
});
on("kill", (game, { c }) => {
  const t = CREATURE_TYPES[c.type];
  if (t.guardian) guardianFalls(game, c);
  if (t.boss) win(game);
});

// A guardian falls: the gate to the stairs opens, and it leaves a relic behind.
function guardianFalls(game, m) {
  const zone = game.zone, hall = zone.guardianHall;
  if (hall) for (const [x, y, z] of hall.gate) zone.set(x, y, z, B.AIR);
  zone.slam = null;
  zone.refresh();
  game.log(`${TheOf(m)} falls! Behind it, the gate to the stairs grinds open.`, [255, 230, 140]);
  const ground = zone.stand[m.tx + m.ty * zone.w] >= 0 ? zone.stand[m.tx + m.ty * zone.w] : FLOOR_Z;
  const key = pickRelic(game.relicsFound);
  const it = key ? makeRelic(key) : { ...randomEquipment(Math.random, zone.level + 2, 0.5), known: true };
  if (key) game.relicsFound.add(key);
  zone.items.push(makeItem(it, ...awayFromWalls(zone, m.x, m.y, ground), ground));
  if (key) game.log(`Where it stood lies a relic: ${RELICS[key].name}.`, RELIC_COLOR);
  // Its summoned helpers fade with it.
  zone.creatures = zone.creatures.filter((o) => !(o.type === "shade" || (m.guardian === "flatqueen" && o.type === "flatling")));
}

// The Lich King falls: the run is won (after the epilogue).
export function win(game) {
  game.travel = null;
  game.log("The Lich King crumbles to dust. The dungeon falls silent. You have won!", [255, 230, 120]);
  finishMainQuest(game);
  openStory(game, EPILOGUE, () => setMode(game, "won"));
}

// Arriving in a zone (zones.js enterZone emits these). Before you're placed: treasure marked "relic?"
// becomes a relic you haven't found yet; and coming back up to a guardian's level from below (you fell
// past it), you arrive by its stairs, behind its gate, which opens from this side.
on("zone:prepare", (game, { zone, arrival }) => {
  resolveRelics(game, zone);
  const hall = zone.guardianHall;
  if (arrival.how === "up" && hall && hall.gate.some(([x, y, z]) => zone.get(x, y, z) === B.GATE)) {
    for (const [x, y, z] of hall.gate) zone.set(x, y, z, B.AIR);
    zone.refresh();
  }
});
// After you're placed: the map recentres, and the first time you reach a legacy level Vorlath has
// something to say (and on the last one, a page of story).
on("zone:enter", (game, { zone, first }) => {
  mapView.panX = mapView.panY = 0;
  if (!first || zone.siteId !== "legacy" || zone.type !== "dungeon") return;
  if (TAUNTS[zone.dungeonIndex]) game.log(TAUNTS[zone.dungeonIndex], zone.dungeonIndex === 1 ? [255, 220, 140] : LICH_COLOR);
  if (zone.final) game.pendingPages = FINAL_PAGES;
});

// Treasure marked "relic?" (deep levels) becomes a relic you haven't found yet, chosen now so none
// turns up twice; once they're all found, fine gear instead.
function resolveRelics(game, zone) {
  for (const it of zone.items) {
    if (it.kind !== "relic?") continue;
    const key = pickRelic(game.relicsFound);
    const { x, y, z } = it;
    for (const k of Object.keys(it)) delete it[k];
    Object.assign(it, key ? makeRelic(key) : randomEquipment(Math.random, zone.level + 2, 0.4), { x, y, z });
    if (key) game.relicsFound.add(key);
  }
}
