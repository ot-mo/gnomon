// The two views you play in, and the cube's turn between them (TECH_DESIGN §4.1, §4.2):
//   explore   real time, first person (render3d); the pointer is locked for mouse look
//   map       top-down and turn-based: time passes only when you act (turns.js); click-to-travel steps here
//   rotate    the moment the cube turns the world: the camera swings down from above (no input)
// and what moves you between zones: stairs, holes and deep water (checkFloorEvents), and walking off a
// surface zone's edge in 3D (walkOffEdge). Keys are bindings (keys.js): "play" for both views, then each
// view's own.
//
//   playMode(game) → "explore" | "map"     the view game.view says you are in
//   drawPlay(game)                         the view (map or 3D) and the HUD under every screen over it
//   checkFloorEvents(game) → bool          stairs under your feet, or nothing under them: true if you left
//   fallThrough(game)                      a potion of descent: down to the level below, unhurt
//   changeFloor(game, addr, how, message, fx, fy)   another zone, with the "DEPTH n" beat (transition.js)
//   onCube(game)                           you touched the Rotation Cube: the world turns
//   forceMapView(game)                     pressed flat (status.js): the map until it passes
//   toggleMap(game), mapKey(game, code), mapClick(game, button, cell), quickHeal(game)
//   HOTBAR_KEYS                            1-9: player.hotbar's abilities (abilities.js useHotbar), both views
import { keys, isLocked, lockPointer } from "../input.js";
import { registerScreen, setMode, pushMode } from "../screens.js";
import { bind, globalKey, dispatchKey } from "../keys.js";
import { at, hitLabel } from "../ui.js";
import { changeZone, enterZone, zoneBelow, zoneAbove, dungeonOffset, tryWalkOff, ZONE_RULES } from "../zones.js";
import { clampPitch, updatePlayer, takeImpact, hasFeatherFall, bonus, bodyCollides, RADIUS } from "../player.js";
import { pushPlayerOut } from "../monsters.js";
import { playerMelee } from "../combat.js";
import { updateCreatures } from "../ai.js";
import { creatureAt, hostilesTo, canTalk } from "../creatures.js";
import { pickUpItems } from "../items.js";
import { render3d, CLOCK_SEGMENT } from "../render3d.js";
import { renderMap, tileAtCell, mapView, hoverInspect, toggleMapLegend, setLegendKeyHint } from "../renderMap.js";
import { emit } from "../events.js";
import { drawHud, layoutHud, registerHudSegment } from "../hud.js";
import { ABILITIES, useHotbar } from "../abilities.js";
import { interact, lookTarget } from "../interact.js";
import { refreshView, mapStep, mapWait, mapUseTime, startTravel, startExplore, travelStep } from "../turns.js";
import { drinkPotion, tickEffects } from "../effects.js";
import { swapWeapons } from "../inventory.js";
import { throwReady, throwAtNearest, updateProjectiles, updateClouds, updateBombs, THROW_TIME } from "../throwing.js";
import { B, FLOOR_Z } from "../world.js";
import { updateSpikes } from "../traps.js";
import { playCubeTheme } from "../music.js";
import { sfx } from "../sfx.js";
import { CUBE_PAGES } from "../story/legacy.js";
import { openCubeWall } from "../content/world/temple.js";
import { openStory } from "../dialogue.js";
import { maxHp } from "../stats.js";
import { addStatus, statusFlag, cooldownLeft, startCooldown } from "../status.js";
import { RULES } from "../rules.js";
import { startTransition } from "./transition.js";
import { openInv } from "./inventory.js";
import { openJournal } from "./journal.js";
import { hasKey } from "../keyset.js";

export const playMode = (game) => (game.view === "map" ? "map" : "explore");

// The view, then the HUD. While the cube turns the view is always 3D.
// On the map the tiles start under the status line, which takes one row or two (hud.js layoutHud).
export function drawPlay(game) {
  const layout = layoutHud(game);
  if (game.view === "map" && game.mode !== "rotate") { mapView.top = 1 + layout.rows.length; renderMap(game); }
  else render3d(game);
  drawHud(game, layout);
}

// --- Zones: stairs, holes, deep water ---------------------------------------------------------------
// Down and up go along the zone graph: the level below (zoneBelow) or above (zoneAbove).
export function checkFloorEvents(game) {
  const p = game.player, zone = game.zone;
  if (p.z < -1.5) {
    const x = p.x, y = p.y, below = zoneBelow(game, zone);
    if (!below) {   // nothing below this zone (no valid level has a hole there): back onto solid ground
      enterZone(game, zone, { how: "fall", fx: x, fy: y, rng: Math.random });
      return true;
    }
    if (zone.get(Math.floor(x), Math.floor(y), FLOOR_Z - 1) === B.WATER_DEEP) {
      fallTo(game, below, zone, x, y, "You sink beneath the dark water and are swept down to the floor below.");
    } else if (hasFeatherFall(p)) {
      fallTo(game, below, zone, x, y, "You fall through the dark... and drift down gently.");
    } else {
      fallTo(game, below, zone, x, y, "You fall through the dark and land hard.");
      game.hurtPlayer(2 + Math.floor(Math.random() * 3), "the fall");
    }
    return true;
  }
  if (!p.onGround) return false;
  const under = zone.get(Math.floor(p.x), Math.floor(p.y), Math.round(p.z) - 1);
  const ex = zone.exit, fx = Math.floor(p.x), fy = Math.floor(p.y);
  if (under === B.STAIRS_UP && ex && ex.x === fx && ex.y === fy) {   // a second way up, out somewhere else (the Root Canals' far mouth: B2, C1b #22)
    changeFloor(game, ex.key, "teleport", "You climb the smugglers' stair and push up through an iron grate...", ex.at[0] + 0.5, ex.at[1] + 0.5);
    return true;
  }
  const below = under === B.STAIRS ? zoneBelow(game, zone) : null, above = under === B.STAIRS_UP ? upFrom(game, zone) : null;
  if (below) { changeFloor(game, below, "down", "You descend the stairs..."); return true; }
  if (above) { changeFloor(game, above, "up", "You climb the stairs back up..."); return true; }
  return false;
}

// The zone a stair up leads to: the level above (zoneAbove), or, from a zone with floors over it (zone.hasAbove: the
// Square's surface and its first floor up), the floor up at z − 1 (B2, C1b #8). The way back is the floor's stairs
// down (zoneBelow: z + 1).
export function upFrom(game, zone) {
  return zoneAbove(game, zone) || (zone.hasAbove ? { wx: zone.wx, wy: zone.wy, z: zone.z - 1, key: `${zone.wx},${zone.wy},${zone.z - 1}` } : null);
}

export function fallThrough(game) {
  const below = zoneBelow(game, game.zone);
  if (below) fallTo(game, below, game.zone, game.player.x, game.player.y, "");
}

// Drop from (x, y) in `zone` to the level below (a hole, deep water, a potion of descent). Under a
// surface zone the levels sit at its dungeonRect (TECH_DESIGN §5.5), so the point moves by that
// offset; dungeon levels line up 1:1 (their offset is 0).
function fallTo(game, below, zone, x, y, message) {
  const { ox, oy } = dungeonOffset(game, zone);
  changeFloor(game, below, "fall", message, x - ox, y - oy);
}

// Go to another zone (stairs, a hole, a potion of descent), then show its name for a moment.
// `how` ("start" | "down" | "up" | "fall") and (fx, fy) decide where you appear (zones.arrivalPoint).
export function changeFloor(game, addr, how, message, fx, fy) {
  if (!changeZone(game, addr, { how, fx, fy, rng: Math.random }, message)) return;
  startTransition(game);   // shows "DEPTH n" for a moment, going down or up
}

// --- Real time (the 3D view) -----------------------------------------------------------------------
export function update(game, dt) {
  const { player: p } = game;
  updatePlayer(p, game.zone, keys, dt);
  pushPlayerOut(game);
  if (walkOffEdge(game)) return;
  const zone = game.zone;
  const fall = takeImpact(p);
  if (fall) game.hurtPlayer(fall, "the fall");

  // You always know the ground right around you.
  const ptx = Math.floor(p.x), pty = Math.floor(p.y);
  for (let y = pty - 1; y <= pty + 1; y++)
    for (let x = ptx - 1; x <= ptx + 1; x++)
      if (x >= 0 && y >= 0 && x < zone.w && y < zone.d) zone.seen[x + y * zone.w] = 1;

  pickUpItems(game);
  if (game.checkFloorEvents()) return;

  updateCreatures(game, dt);
  updateSpikes(game);
  updateProjectiles(game, dt);
  updateBombs(game, dt);
  updateClouds(game, dt);
  tickEffects(game, dt);
  if (statusFlag(p, "flat")) forceMapView(game);   // pressed flat: the map view only
  vaultHint(game);
  p.attackCd = Math.max(0, p.attackCd - dt);
  p.throwCd = Math.max(0, p.throwCd - dt);
  p.swing = Math.max(0, p.swing - dt);
  p.hurt = Math.max(0, p.hurt - dt);
  game.target = lookTarget(game);
}

// Walking off a surface zone's edge in 3D (TECH_DESIGN §5.1). The apron lets your body go past the
// border onto the next span's ground; once your centre is half a tile past an open edge you are in
// that span's zone, at the same point of the world, facing and falling as before (no transition
// screen). Against a solid edge (the sea, the world's border) you hear why, once.
function walkOffEdge(game) {
  const zone = game.zone, p = game.player;
  if (zone.type !== "surface") return false;
  const past = ZONE_RULES.walkOffPast, { w, d } = zone;
  const side = p.x >= w + past ? "e" : p.x < -past ? "w" : p.y >= d + past ? "s" : p.y < -past ? "n" : null;
  if (side) {
    const dx = side === "e" ? 1 : side === "w" ? -1 : 0, dy = side === "s" ? 1 : side === "n" ? -1 : 0;
    const exact = { x: p.x - dx * w, y: p.y - dy * d, z: p.z };
    if (!tryWalkOff(game, side, dx ? p.y : p.x, { exact })) return false;
    const nz = game.zone;
    const tx = Math.max(0, Math.min(nz.w - 1, Math.floor(p.x))), ty = Math.max(0, Math.min(nz.d - 1, Math.floor(p.y)));   // by a corner you may still be over the apron
    if (bodyCollides(p, nz)) {   // the apron wasn't the zone's real ground (it was built before the zone was): stand up
      const s = nz.stand[tx + ty * nz.w];
      p.x = tx + 0.5; p.y = ty + 0.5;
      if (s >= 0) p.z = s;
    }
    return true;
  }
  const near = RADIUS + 0.02;
  for (const [sd, close, along] of [["e", p.x > w - near, p.y], ["w", p.x < near, p.y], ["s", p.y > d - near, p.x], ["n", p.y < near, p.x]])
    if (close && !zone.edges[sd]) tryWalkOff(game, sd, along);   // shut: it only says why (once)
  return false;
}

// The first time you step into a puzzle room, a line about what you notice.
function vaultHint(game) {
  const v = game.zone.vault, p = game.player;
  if (!v?.hint || game.zone.flags.vaultHinted) return;
  if (p.x >= v.x0 && p.x < v.x1 + 1 && p.y >= v.y0 && p.y < v.y1 + 1) {
    game.zone.flags.vaultHinted = true;
    game.log(v.hint, [200, 190, 255]);
  }
}

// --- Turning the world -----------------------------------------------------------------------------
export function toggleMap(game) {
  if (!game.story.cube) {
    game.log("You've only ever seen the world one way: flat, from above. Is there any other way?", [170, 170, 170]);
    return;
  }
  // Pressed flat: no way of turning works (Tab, or Escape on the map), and no fold power fires.
  if (statusFlag(game.player, "flat")) { game.log("You're flat: you can't turn until it passes.", [220, 220, 230]); return; }   // bible §10.2
  foldPowers(game);
  if (game.mode === "explore") toMapView(game);
  else if (game.mode === "map") {
    sfx("rotate", { up: true });
    game.view = "3d";
    game.travel = null;
    game.player.vz = 0;
    setMode(game, "explore");   // locks the pointer (allowed: we're inside a key press) and unpauses
  }
}

// From 3D to the map: by Tab, or forced (pressed flat; that is no turn of yours, so no fold powers).
function toMapView(game) {
  sfx("rotate", { up: false });
  // In 3D you may stand up to half a tile past an open edge, over the apron; the map works in the
  // zone's own tiles, so step back onto the border tile you came from.
  const p = game.player, z = game.zone;
  if (p.x < 0 || p.y < 0 || p.x >= z.w || p.y >= z.d) {
    const tx = Math.max(0, Math.min(z.w - 1, Math.floor(p.x))), ty = Math.max(0, Math.min(z.d - 1, Math.floor(p.y)));
    p.x = tx + 0.5; p.y = ty + 0.5;
    const s = z.stand[tx + ty * z.w];
    if (s >= 0) p.z = s;
  }
  game.view = "map";
  setMode(game, "map");   // unlocks the pointer
  refreshView(game);
}

export function forceMapView(game) { if (game.mode === "explore") toMapView(game); }

// Turning the world: the Mantle of Angles makes you untouchable for a moment, and Folding
// strike stuns everything next to you (at most every 10 s).
function foldPowers(game) {
  const p = game.player;
  const guard = bonus(p, "foldGuard");
  if (guard > 0) addStatus(game, p, "guarded", { t: guard, stack: "refresh" });
  if (hasKey(p.perks, "foldingStrike") && !(cooldownLeft(p, "foldingStrike") > 0)) {
    const near = hostilesTo(game, p).filter((m) => Math.hypot(m.x - p.x, m.y - p.y) < 1.9 && !m.guardian);
    if (near.length) {
      for (const m of near) addStatus(game, m, "stunned", { t: 2, stack: "max" });
      startCooldown(p, "foldingStrike", RULES.cooldown.foldingStrike);
      game.log(`The world folds around you, and ${near.length > 1 ? `${near.length} monsters reel` : `the ${near[0].name} reels`}! (stunned)`, [200, 190, 255]);
    }
  }
}

// You touch the Rotation Cube: the world turns (the rotate screen), then the story continues.
export function onCube(game) {
  game.story.cube = true;
  playCubeTheme();   // and the music turns with it
  openCubeWall(game.zone);
  game.travel = null;
  game.view = "3d";
  game.rotT = 0;
  setMode(game, "rotate", null, { pointer: false });
  const p = game.player;
  p.pitch = 0; p.vz = 0; p.yaw = -Math.PI / 2;   // facing back the way you came: north
}

const ROTATE_TIME = 3.2;
const ease = (t) => t * t * (3 - 2 * t);

// The cube turns the world: from straight above (the only way you've ever seen it), the camera swings
// down and round into your own eyes. Then the story's pages, and the 3D view, paused until you click.
function rotateUpdate(game, dt) {
  game.rotT += dt;
  const k = ease(Math.min(1, game.rotT / ROTATE_TIME));
  game.cam = { pitch: -1.55 * (1 - k), lift: 7 * (1 - k), yaw: (1 - k) * Math.PI * 0.75 };
  if (game.rotT < ROTATE_TIME + 0.6) return;
  game.cam = null;
  setMode(game, "explore", null, { pointer: false });
  pushMode(game, "pause");
  openStory(game, CUBE_PAGES, () => {
    game.log("The wall behind the altar has slid away. Go back and talk to Maren.", [255, 220, 140]);
    game.log("Tab: switch between the view from above (the map) and the view from inside (3D).", [200, 190, 255]);
  });
}

// --- Actions ----------------------------------------------------------------------------------------
// Q: drink a potion you know heals. Returns true if you drank one.
export function quickHeal(game) {
  const p = game.player;
  const k = p.inv.findIndex((it) => it.kind === "potion" && it.effect === "healing");
  if (k < 0 || !game.knownPotions.has("healing")) {
    game.log("You have no potion you know heals. Press I to look through your things.", [170, 170, 170]);
    return false;
  }
  if (p.hp >= maxHp(p)) { game.log("You're already at full health.", [170, 170, 170]); return false; }
  if (--p.inv[k].count <= 0) p.inv.splice(k, 1);
  drinkPotion(game, "healing");
  return true;
}

function toggleTorch(game) {
  game.player.torch = !game.player.torch;
  game.log(game.player.torch ? "You light your torch." : "You put out your torch. Harder to see, harder to be seen.", [255, 200, 120]);
}

function toggleMarker(game, tile) {
  const zone = game.zone;
  if (!tile || tile.x < 0 || tile.y < 0 || tile.x >= zone.w || tile.y >= zone.d) return;
  const k = zone.markers.findIndex((m) => m.x === tile.x && m.y === tile.y);
  if (k >= 0) zone.markers.splice(k, 1);
  else if (!zone.seen[tile.x + tile.y * zone.w]) game.log("You can only mark places you've seen.", [170, 170, 170]);
  else if (zone.markers.length >= 9) game.log("You can place at most 9 markers.", [170, 170, 170]);
  else zone.markers.push({ x: tile.x, y: tile.y });
}

// The hotbar (TECH_DESIGN §2.8, §4.3): keys 1-9 use player.hotbar's abilities in both views (the number
// row only: the numpad's digits move you on the map).
export const HOTBAR_KEYS = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9"];

// --- Map controls: one step per key press (holding a key repeats it) ---------------------------------
export const MAP_MOVES = {
  KeyW: [0, -1], ArrowUp: [0, -1], Numpad8: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1], Numpad2: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], Numpad4: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0], Numpad6: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
};

// One key on the map, as the bindings below would take it (the bot and checks press keys through this).
export function mapKey(game, code) {
  game.travel = null;                       // any key interrupts a click-to-travel
  if (code === "Escape") { toggleMap(game); return; }
  if (code === "KeyI") { openInv(game); return; }
  if (code === "KeyJ") { openJournal(game); return; }
  if (code === "KeyX") { startExplore(game); return; }
  if (MAP_MOVES[code]) { mapStep(game, ...MAP_MOVES[code]); return; }
  if (code === "Space" || code === "Period" || code === "Numpad5") mapWait(game);
  if (code === "KeyQ" && quickHeal(game)) mapUseTime(game, 0.5);
  if (code === "KeyT" && throwAtNearest(game)) mapUseTime(game, THROW_TIME);
  if (code === "KeyF") { toggleTorch(game); refreshView(game); }
  if (code === "KeyR") { const t = swapWeapons(game); if (t) mapUseTime(game, t); }
  if (HOTBAR_KEYS.includes(code)) useHotbar(game, HOTBAR_KEYS.indexOf(code));
}

export function mapClick(game, button, cell) {
  const tile = tileAtCell(cell);
  if (button === 2) { toggleMarker(game, tile); return; }
  if (button !== 0 || !tile) return;
  const p = game.player;
  const dx = tile.x - Math.floor(p.x), dy = tile.y - Math.floor(p.y);
  const there = creatureAt(game.zone, tile.x, tile.y);   // a monster next to you: attack it
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx || dy) && there && !canTalk(there)) mapStep(game, dx, dy);
  else startTravel(game, tile.x, tile.y);
}

// --- The screens ------------------------------------------------------------------------------------
registerScreen("explore", {
  over: "none", pausesTime: false, pointer: "lock", saveable: true,   // (save/save.js: a save waits for one of the views)
  draw: drawPlay,
  update(game, dt) {
    if (game.paused) return;
    game.time += dt;
    update(game, dt);
  },
  mouse(game, button) {
    if (!isLocked()) { lockPointer(); game.paused = false; return; }
    if (game.paused) { game.paused = false; return; }
    if (button === 0) playerMelee(game);
    if (button === 2) throwReady(game);
  },
  wheel(game, sign) { game.fov = Math.max(40, Math.min(100, game.fov + sign * 5)); },
});

// The map header's key hints are buttons too: a click presses the key.
const HEADER_KEYS = [["I: inventory", "KeyI"], ["J: journal", "KeyJ"], ["Tab: 3D", "Tab"], ["X: explore", "KeyX"], ["Space: wait", "Space"]];

registerScreen("map", {
  over: "none", pausesTime: false, pointer: "unlock", saveable: true,
  draw(game) {
    drawPlay(game);
    for (const [label, key] of HEADER_KEYS) hitLabel(mapView.header, label, { key });
  },
  update(game, dt) {   // a hover held on a tile inspects it; walk a clicked route one turn at a time, visibly
    hoverInspect(game, dt, emit);
    if (!game.travel) return;
    game.travel.timer -= dt;
    if (game.travel.timer <= 0) { game.travel.timer = 0.07; travelStep(game); }
  },
  // Any key but the global ones (M, N) interrupts a click-to-travel; the bindings below do the rest.
  key(game, code, repeat) {
    if ((!repeat || MAP_MOVES[code]) && !globalKey(code)) game.travel = null;
    return false;
  },
  mouse(game, button, cell) {
    const h = button === 0 && at(cell);
    if (h?.key) dispatchKey(game, h.key, false, "");
    else mapClick(game, button, cell);
  },
});

registerScreen("rotate", { over: "none", pointer: "keep", draw: drawPlay, update: rotateUpdate, key: () => false });

// --- Keys (TECH_DESIGN §4.3: today's bindings) ----------------------------------------------------------
const canAct = (game) => !game.paused && !statusFlag(game.player, "noAct");
bind("play", "Tab", (game) => toggleMap(game), { help: "turn the world (refused while flat)" });
bind("play", "KeyI", (game) => openInv(game), { help: "inventory" });
bind("play", "KeyJ", (game) => openJournal(game), { help: "journal" });

bind("map", "Escape", (game) => toggleMap(game), { help: "to 3D" });
bind("map", Object.keys(MAP_MOVES), (game, code) => mapStep(game, ...MAP_MOVES[code]), { repeat: true, help: "move / attack" });
bind("map", ["Space", "Period", "Numpad5"], (game) => mapWait(game), { help: "wait" });
bind("map", "KeyX", (game) => startExplore(game), { help: "explore" });
bind("map", "KeyQ", (game) => { if (quickHeal(game)) mapUseTime(game, 0.5); }, { help: "quick-heal" });
bind("map", "KeyT", (game) => { if (throwAtNearest(game)) mapUseTime(game, THROW_TIME); }, { help: "throw" });
bind("map", "KeyF", (game) => { toggleTorch(game); refreshView(game); }, { help: "torch" });
bind("map", "KeyR", (game) => { const t = swapWeapons(game); if (t) mapUseTime(game, t); }, { help: "swap weapons" });
bind("map", HOTBAR_KEYS, (game, code) => { useHotbar(game, HOTBAR_KEYS.indexOf(code)); }, { help: "abilities (hotbar)" });
// The legend beside the map (renderMap.js): shown by itself where it fits; the comma hides it, or shows it where it
// doesn't (an 80-wide surface zone at 160 columns: the view then narrows and follows you). Its foot names the key.
// (TECH_DESIGN §4.3: G is WS5's pick-up; `,` is one of the keys kept for integration.)
bind("map", "Comma", (game) => { toggleMapLegend(game); }, { help: "map legend" });
setLegendKeyHint("comma");

bind("explore", "Enter", (game) => { playerMelee(game); }, { when: canAct, help: "attack" });   // for when a mouse button isn't handy
bind("explore", "KeyE", (game) => { interact(game); }, { when: canAct, help: "use / talk" });
bind("explore", "KeyQ", (game) => { quickHeal(game); }, { when: canAct, help: "quick-heal" });
bind("explore", "KeyT", (game) => { throwReady(game); }, { when: canAct, help: "throw" });
bind("explore", "KeyF", (game) => toggleTorch(game), { when: canAct, help: "torch" });
bind("explore", "KeyR", (game) => { swapWeapons(game); }, { when: canAct, help: "swap weapons" });
bind("explore", HOTBAR_KEYS, (game, code) => { useHotbar(game, HOTBAR_KEYS.indexOf(code)); }, { when: canAct, help: "abilities (hotbar)" });

// The status line's ability cooldowns (§4.5, priority 70): each hotbar slot whose ability is cooling down,
// "1 Fold Step 9s", each dropped on its own. A ready ability shows nothing, so the parent's status line is
// unchanged until you use one (WS4's abilities screen, B, lists them all).
registerHudSegment("clock", CLOCK_SEGMENT);   // WS3's (§4.5, priority 30), under the sky only (WS3 #3, at the WS9 merge)
registerHudSegment("abilities", { priority: 70, split: true, parts: (game, p) => (p.hotbar || []).map((id, k) => {
  const left = id ? cooldownLeft(p, id) : 0;
  return left > 0 ? { text: `${k + 1} ${ABILITIES[id]?.name || id} ${Math.ceil(left)}s`, color: [190, 170, 255] } : null;
}).filter(Boolean) });

// Mouse look (input.js calls this with the pointer locked).
export function look(game, dx, dy) {
  if (game.mode !== "explore" || game.paused) return;
  game.player.yaw += dx * game.sensitivity;
  game.player.pitch -= dy * game.sensitivity;
  clampPitch(game.player);
}
