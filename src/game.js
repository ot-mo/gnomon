// The game: modes, the loop, and wiring input to actions. (main.js starts it in the browser.)
//   explore   – real-time first-person view
//   map       – top-down, turn-based: time passes only when you act (see turns.js)
//   inventory – the inventory screen over either view; the game is paused
//   levelup   – choosing a perk after gaining a level; the game is paused
//   descend   – brief "DEPTH n" screen between zones
//   story     – full-screen story pages (the intro, the cube, the ending)
//   rotate    – the moment the cube turns the world: the camera swings down from above
//   talk      – a conversation (dialogue.js); shop – the peddler's pack; journal – your quests
//   dead      – game over; R starts a new run
//   won       – the Lich King is dead; R starts a new run
//
// A run is built from its seed on a world (world/run.js buildRun; the test world for now) and starts at
// the world's start landmark: in the test world the Temple of Angles, on span (0, 0) over the legacy
// stack (world/zonegen.js, world/legacy.js). You start on the map only: until you find the Rotation
// Cube, Tab does nothing. game.story.cube says whether you have it. game.run is the run (its sites,
// history, villages: saved with the slot, never rebuilt on a load), game.zone the zone you're in,
// game.zones every zone you've visited ("wx,wy,z" → Zone); game.state holds what persists as plain
// data (uids, zone patches, when you left a zone).
// game.view says which picture is showing ("3d" or "map"); it survives descending and dying.
import * as S from "./screen.js";
import { keys, isLocked, lockPointer, unlockPointer } from "./input.js";
import { changeZone, enterZone, cachedZone, makeZone, zoneBelow, zoneAbove, dungeonOffset, zoneKey, tryWalkOff, ZONE_RULES } from "./zones.js";
import { on, runUpdates } from "./events.js";
import "./world/zonegen.js";   // the zone generators: surfaces, site dungeons, the legacy stack
import { buildRun } from "./world/run.js";
import { TEST_WORLD } from "./content/world/test-world.js";
import { makePlayer, clampPitch, updatePlayer, takeImpact, hasFeatherFall, bonus, bodyCollides, RADIUS } from "./player.js";
import { updateMonsters, pushPlayerOut, playerAttack, monsterAt } from "./monsters.js";
import { pickUpItems, POTIONS, POTION_COLORS, scrollTitles, makeItem, makeRelic, pickRelic, randomEquipment, awayFromWalls, RELICS, RELIC_COLOR } from "./items.js";
import { render3d } from "./render3d.js";
import { renderMap, mapView, tileAtCell } from "./renderMap.js";
import { drawHud, levelUpClick } from "./hud.js";
import { offerPerks, takePerk } from "./leveling.js";
import { interact, lookTarget } from "./interact.js";
import { refreshView, mapStep, mapWait, mapUseTime, startTravel, startExplore, travelStep } from "./turns.js";
import { drinkPotion, tickEffects } from "./effects.js";
import { openInventory, closeInventory, inventoryKey, inventoryClick, drawInventory, swapWeapons } from "./inventory.js";
import { throwReady, throwAtNearest, updateProjectiles, updateClouds, updateBombs, THROW_TIME } from "./throwing.js";
import { makeRng } from "./rng.js";
import { B, FLOOR_Z } from "./world.js";
import { updateSpikes } from "./traps.js";
import { toggleMusic, updateMusic, playCubeTheme } from "./music.js";
import { unlockAudio, audioFrame } from "./audio.js";
import { sfx, toggleSounds, setListener } from "./sfx.js";
import { questEvent } from "./npcs.js";
import { INTRO, CUBE_PAGES, TAUNTS, FINAL_PAGES, EPILOGUE, LICH_COLOR } from "./story/legacy.js";
import { openCubeWall } from "./content/world/temple.js";
import { openTalk, talkKey, talkClick, talkHover, drawTalk, shopKey, drawShop, openJournal, journalKey, drawJournal,
         openStory, storyKey, nextPage, drawStory, updateTalk } from "./dialogue.js";
import { maxHp } from "./stats.js";
import { addStatus, hasStatus, statusFlag, statusLeft, cooldownLeft, startCooldown } from "./status.js";
import { RULES } from "./rules.js";
import { setPurse } from "./currency.js";

export const game = {
  seed: 0, zone: null, player: null,
  world: TEST_WORLD,   // the world definition new runs are built on (the real one waits for its content)
  run: null,           // the run: buildRun(seed, world) for a new game
  zones: new Map(),    // "wx,wy,z" → Zone: every zone you've visited stays as you left it
  state: null,         // persistent plain data (zones.js: uids, zonePatches, zoneLeft)
  mode: "explore", view: "3d", paused: true,
  time: 0, fov: 75, sensitivity: 0.0025,
  messages: [], effects: [], target: null, travel: null, fps: 60, frameMs: 0,
  descendT: 0, deathCause: "",
  potionColor: {}, knownPotions: new Set(), invSel: 0, invReturn: "explore",
  scrollTitle: {}, knownScrolls: new Set(),
  auraKnown: new Set(),   // "potion:poison", "scroll:fire"…: kinds you've sensed with a potion of seeing
  perkChoices: [], levelReturn: "explore",
  flow: null, flowX: -1, flowY: -1, flowVersion: -1,
  story: { cube: false },   // how far the story has got
  quests: [], talk: null, shop: null, pages: null, hints: new Set(),
  cam: null, rotT: 0,       // the cube's rotation: a camera override for render3d
  pendingPages: null,       // story pages to show once the "DEPTH n" screen is done

  // Potion of descent: sink straight through to the level below, unhurt.
  fallThrough() {
    const below = zoneBelow(this, this.zone);
    if (below) fallTo(below, this.zone, this.player.x, this.player.y, "");
  },

  // The Lich King falls: the run is won (after the epilogue).
  win() {
    this.travel = null;
    this.log("The Lich King crumbles to dust. The dungeon falls silent. You have won!", [255, 230, 120]);
    finishMainQuest();
    openStory(this, EPILOGUE, () => { this.mode = "won"; });
  },

  // You touch the Rotation Cube: the world turns (see step), then the story continues.
  onCube() {
    this.story.cube = true;
    playCubeTheme();   // and the music turns with it
    openCubeWall(this.zone);
    this.travel = null;
    this.mode = "rotate";
    this.view = "3d";
    this.rotT = 0;
    const p = this.player;
    p.pitch = 0; p.vz = 0; p.yaw = -Math.PI / 2;   // facing back the way you came: north
  },

  onTalk(npc) { openTalk(this, npc); },

  // A guardian notices you.
  onGuardianWakes(m) {
    const words = {
      flatqueen: "The drawing on the floor moves. The Flat Queen slides toward you, flat as a shadow. (She lives in the plane: fight her on the map.)",
      warden: "Something huge breathes out in the dark, and your torch gutters. The Gloom Warden is awake. (It hides from torchlight.)",
      colossus: "Stone grinds on stone. The Colossus turns its head to look at you, and the star in its brow blazes. (Strike the core from up high.)",
    }[m.guardian];
    this.log(words, m.color);
  },
  // A guardian falls: the gate to the stairs opens, and it leaves a relic behind.
  onGuardianDies(m) {
    const zone = this.zone, hall = zone.guardianHall;
    if (hall) for (const [x, y, z] of hall.gate) zone.set(x, y, z, B.AIR);
    zone.slam = null;
    zone.refresh();
    this.log(`The ${m.name} falls! Behind it, the gate to the stairs grinds open.`, [255, 230, 140]);
    const ground = zone.stand[m.tx + m.ty * zone.w] >= 0 ? zone.stand[m.tx + m.ty * zone.w] : FLOOR_Z;
    const key = pickRelic(this.relicsFound);
    const it = key ? makeRelic(key) : { ...randomEquipment(Math.random, zone.level + 2, 0.5), known: true };
    if (key) this.relicsFound.add(key);
    zone.items.push(makeItem(it, ...awayFromWalls(zone, m.x, m.y, ground), ground));
    if (key) this.log(`Where it stood lies a relic: ${RELICS[key].name}.`, RELIC_COLOR);
    // Its summoned helpers fade with it.
    zone.monsters = zone.monsters.filter((o) => !(o.type === "shade" || (m.guardian === "flatqueen" && o.type === "flatling")));
  },
  questEvent(what, data) { questEvent(this, what, data); },

  // Flat (status.js, bible §10.2): you exist only in the Plane, so the view is the map until it ends.
  forceMapView() { if (this.mode === "explore") toMapView(); },

  // A tip shown once per run.
  hint(id, text) {
    if (this.hints.has(id)) return;
    this.hints.add(id);
    this.log(text, [200, 190, 255]);
  },

  log(text, color = [220, 220, 220]) {
    this.messages.push({ text, color, time: this.time });
    if (this.messages.length > 40) this.messages.shift();
  },

  hurtPlayer(dmg, source, quiet = false) {
    if (this.mode === "dead") return;
    const p = this.player;
    p.hp -= dmg;
    // Second wind: a killing blow leaves you on 1 HP, then not again for RULES.cooldown.secondWind
    // seconds of game time (it was once per floor; TECH_DESIGN §2.4).
    if (p.hp <= 0 && p.perks.has("secondWind") && !(cooldownLeft(p, "secondWind") > 0)) {
      startCooldown(p, "secondWind", RULES.cooldown.secondWind);
      p.hp = 1;
      this.log("Everything goes grey... and you get up again. (Second wind!)", [255, 230, 140]);
    }
    p.hurt = 0.35;
    this.effects.push({ kind: "damage", onPlayer: true, x: p.x, y: p.y, z: p.z + 2, text: `-${dmg}`, color: [255, 90, 80], time: this.time });
    if (!quiet) {
      this.log(`${source[0].toUpperCase() + source.slice(1)} ${source.endsWith("spikes") ? "hit" : "hits"} you (${dmg}).`, [255, 110, 100]);
      sfx("hurt");
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.mode = "dead";
      this.deathCause = statusFlag(p, "flat") ? `${source}, while pressed flat` : source;   // bible §10.2
      this.travel = null;
      unlockPointer();
    }
  },

  // Stairs under your feet, or nothing under them at all? Returns true if you left the zone.
  // Down and up go along the zone graph: the level below (zoneBelow) or above (zoneAbove).
  checkFloorEvents() {
    const p = this.player, zone = this.zone;
    if (p.z < -1.5) {
      const x = p.x, y = p.y, below = zoneBelow(this, zone);
      if (!below) {   // nothing below this zone (no valid level has a hole there): back onto solid ground
        enterZone(this, zone, { how: "fall", fx: x, fy: y, rng: Math.random });
        return true;
      }
      if (zone.get(Math.floor(x), Math.floor(y), FLOOR_Z - 1) === B.WATER_DEEP) {
        fallTo(below, zone, x, y, "You sink beneath the dark water and are swept down to the floor below.");
      } else if (hasFeatherFall(p)) {
        fallTo(below, zone, x, y, "You fall through the dark... and drift down gently.");
      } else {
        fallTo(below, zone, x, y, "You fall through the dark and land hard.");
        this.hurtPlayer(2 + Math.floor(Math.random() * 3), "the fall");
      }
      return true;
    }
    if (!p.onGround) return false;
    const under = zone.get(Math.floor(p.x), Math.floor(p.y), Math.round(p.z) - 1);
    const below = under === B.STAIRS ? zoneBelow(this, zone) : null, above = under === B.STAIRS_UP ? zoneAbove(this, zone) : null;
    if (below) { changeFloor(below, "down", "You descend the stairs..."); return true; }
    if (above) { changeFloor(above, "up", "You climb the stairs back up..."); return true; }
    return false;
  },
};

export const randomSeed = () => 1 + Math.floor(Math.random() * 999999);

// A new game on `seed` (quick start: no character to make yet), at the world's start landmark.
export function startRun(seed, world = game.world) {
  game.seed = seed;
  game.run = buildRun(seed, world);
  game.state = { seed, world: { id: game.run.world.id, version: game.run.world.version }, uids: {}, zonePatches: {}, zoneLeft: {} };
  game.zone = null;
  game.zoneLru = [];
  game.player = makePlayer();
  if (world.startPurse) setPurse(game.player, world.startPurse);
  game.messages = [];
  game.effects = [];
  game.travel = null;
  game.time = 0;
  // Which colour is which potion is shuffled for every run. You start knowing healing.
  const colors = makeRng(seed ^ 0x5eed).shuffle([...POTION_COLORS.keys()]);
  game.potionColor = Object.fromEntries(Object.keys(POTIONS).map((effect, k) => [effect, colors[k]]));
  game.knownPotions = new Set(["healing"]);
  game.scrollTitle = scrollTitles(makeRng(seed ^ 0x5c011));   // and scroll titles too
  game.knownScrolls = new Set();
  game.auraKnown = new Set();
  game.invSel = 0;
  game.zones = new Map();
  game.story = { cube: false };
  game.quests = [];
  game.hints = new Set();
  game.relicsFound = new Set();   // relics already found (or dropped) this run: each turns up once
  game.crystalsBought = 0;        // crystals bought from Pell (each makes the next dearer)
  game.cam = null;
  game.pendingPages = null;
  const start = game.run.world.start;
  changeZone(game, zoneKey(start.wx, start.wy, 0), { how: "start" });   // the test world's: the temple, over the legacy stack
  game.view = "map";
  game.paused = false;
  openStory(game, INTRO, () => {
    game.mode = "map";
    refreshView(game);
    game.log("You wake in your little room in the temple. Maren is waiting in the main hall, to the south.", [255, 220, 140]);
  });
}

function finishMainQuest() {
  const q = game.quests.find((o) => o.id === "main");
  if (q) q.done = true;
}

// Arriving in a zone (zones.js enterZone emits these). Before you're placed: treasure marked
// "relic?" becomes a relic you haven't found yet; and coming back up to a guardian's level from
// below (you fell past it), you arrive by its stairs, behind its gate, which opens from this side.
on("zone:prepare", (game, { zone, arrival }) => {
  resolveRelics(zone);
  const hall = zone.guardianHall;
  if (arrival.how === "up" && hall && hall.gate.some(([x, y, z]) => zone.get(x, y, z) === B.GATE)) {
    for (const [x, y, z] of hall.gate) zone.set(x, y, z, B.AIR);
    zone.refresh();
  }
});
// After you're placed: the map recentres, and the first time you reach a legacy level Vorlath
// has something to say (and on the last one, a page of story).
on("zone:enter", (game, { zone, first }) => {
  mapView.panX = mapView.panY = 0;
  if (!first || zone.siteId !== "legacy" || zone.type !== "dungeon") return;
  if (TAUNTS[zone.dungeonIndex]) game.log(TAUNTS[zone.dungeonIndex], zone.dungeonIndex === 1 ? [255, 220, 140] : LICH_COLOR);
  if (zone.final) game.pendingPages = FINAL_PAGES;
});

// Treasure marked "relic?" (deep levels) becomes a relic you haven't found yet, chosen now so
// none turns up twice; once they're all found, fine gear instead.
function resolveRelics(zone) {
  for (const it of zone.items) {
    if (it.kind !== "relic?") continue;
    const key = pickRelic(game.relicsFound);
    const { x, y, z } = it;
    for (const k of Object.keys(it)) delete it[k];
    Object.assign(it, key ? makeRelic(key) : randomEquipment(Math.random, zone.level + 2, 0.4), { x, y, z });
    if (key) game.relicsFound.add(key);
  }
}

// Drop from (x, y) in `zone` to the level below (a hole, deep water, a potion of descent). Under a
// surface zone the levels sit at its dungeonRect (TECH_DESIGN §5.5), so the point moves by that
// offset; dungeon levels line up 1:1 (their offset is 0).
function fallTo(below, zone, x, y, message) {
  const { ox, oy } = dungeonOffset(game, zone);
  changeFloor(below, "fall", message, x - ox, y - oy);
}

// Go to another zone (stairs, a hole, a potion of descent), then show its name for a moment.
// `how` ("start" | "down" | "up" | "fall") and (fx, fy) decide where you appear (zones.arrivalPoint).
function changeFloor(addr, how, message, fx, fy) {
  if (!changeZone(game, addr, { how, fx, fy, rng: Math.random }, message)) return;
  game.mode = "descend";   // shows "DEPTH n" for a moment, going down or up
  game.descendT = 1.2;
}

// ---------------------------------------------------------------------------
// Real time (3D view)
function update(dt) {
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

  updateMonsters(game, dt);
  updateSpikes(game);
  updateProjectiles(game, dt);
  updateBombs(game, dt);
  updateClouds(game, dt);
  tickEffects(game, dt);
  if (statusFlag(p, "flat")) game.forceMapView();   // pressed flat: the map view only
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

const ROTATE_TIME = 3.2;
const ease = (t) => t * t * (3 - 2 * t);

export function step(dt) {
  // Gained a level (or someone taught you a trick)? Stop and choose a perk.
  const p = game.player;
  if ((game.mode === "explore" || game.mode === "map") && (p.pendingLevels > 0 || p.bonusPerks > 0)) {
    game.perkGift = !(p.pendingLevels > 0);
    if (p.pendingLevels > 0) p.pendingLevels--; else p.bonusPerks--;
    game.perkMilestone = !game.perkGift && p.level % 5 === 0 && !p.milestones?.has(p.level);
    if (game.perkMilestone) (p.milestones ||= new Set()).add(p.level);
    game.perkChoices = offerPerks(game.player, game.perkMilestone);
    if (game.perkChoices.length) {
      game.levelReturn = game.mode;
      game.mode = "levelup";
      game.travel = null;
      unlockPointer();
    }
  }
  if (game.mode === "explore" && !game.paused) {
    game.time += dt;
    update(dt);
  } else if (game.mode === "talk") {
    updateTalk(game, dt);   // the words type out, letter by spoken letter
  } else if (game.mode === "rotate") {
    // The cube turns the world: from straight above (the only way you've ever seen it),
    // the camera swings down and round into your own eyes.
    game.rotT += dt;
    const k = ease(Math.min(1, game.rotT / ROTATE_TIME));
    game.cam = { pitch: -1.55 * (1 - k), lift: 7 * (1 - k), yaw: (1 - k) * Math.PI * 0.75 };
    if (game.rotT >= ROTATE_TIME + 0.6) {
      game.cam = null;
      openStory(game, CUBE_PAGES, () => {
        game.mode = "explore";
        game.paused = true;
        game.log("The wall behind the altar has slid away. Go back and talk to Maren.", [255, 220, 140]);
        game.log("Tab: switch between the view from above (the map) and the view from inside (3D).", [200, 190, 255]);
      });
    }
  } else if (game.mode === "map" && game.travel) {
    game.travel.timer -= dt;                     // walk the route one turn at a time, visibly
    if (game.travel.timer <= 0) { game.travel.timer = 0.07; travelStep(game); }
  } else if (game.mode === "descend") {
    game.descendT -= dt;
    if (game.descendT <= 0) {
      if (game.player.hp <= 0) game.mode = "dead";
      else if (game.view === "map") { game.mode = "map"; refreshView(game); }
      else game.mode = "explore";
      if (game.pendingPages && game.mode !== "dead") {   // something to say about this floor first
        const back = game.mode;
        openStory(game, game.pendingPages, () => { game.mode = back; if (back === "explore") game.paused = true; });
        game.pendingPages = null;
      }
    }
  }
  runUpdates(game, dt);   // registered per-frame hooks for this mode (events.js)
  game.effects = game.effects.filter((e) => game.time - e.time < 1.2);
}

export function draw() {
  if (game.mode === "story") { drawStory(game); S.present(); return; }
  if (game.view === "map" && game.mode !== "descend" && game.mode !== "rotate") renderMap(game);
  else render3d(game);
  drawHud(game);
  if (game.mode === "inventory") drawInventory(game);
  if (game.mode === "talk") drawTalk(game);
  if (game.mode === "shop") drawShop(game);
  if (game.mode === "journal") drawJournal(game);
  S.present();
}

// ---------------------------------------------------------------------------
function toggleMap() {
  if (!game.story.cube) {
    game.log("You've only ever seen the world one way: flat, from above. Is there any other way?", [170, 170, 170]);
    return;
  }
  // Pressed flat: no way of turning works (Tab, or Escape on the map), and no fold power fires.
  if (statusFlag(game.player, "flat")) { game.log("You're flat: you can't turn until it passes.", [220, 220, 230]); return; }   // bible §10.2
  foldPowers();
  if (game.mode === "explore") toMapView();
  else if (game.mode === "map") {
    sfx("rotate", { up: true });
    game.mode = "explore";
    game.view = "3d";
    game.travel = null;
    game.paused = false;
    game.player.vz = 0;
    lockPointer();   // allowed: we're inside a key press
  }
}

// From 3D to the map: by Tab, or forced (pressed flat; that is no turn of yours, so no fold powers).
function toMapView() {
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
  game.mode = "map";
  game.view = "map";
  unlockPointer();
  refreshView(game);
}

// Turning the world: the Mantle of Angles makes you untouchable for a moment, and Folding
// strike stuns everything next to you (at most every 10 s).
function foldPowers() {
  const p = game.player;
  const guard = bonus(p, "foldGuard");
  if (guard > 0) addStatus(game, p, "guarded", { t: guard, stack: "refresh" });
  if (p.perks.has("foldingStrike") && !(cooldownLeft(p, "foldingStrike") > 0)) {
    const near = game.zone.monsters.filter((m) => Math.hypot(m.x - p.x, m.y - p.y) < 1.9 && !m.guardian);
    if (near.length) {
      for (const m of near) addStatus(game, m, "stunned", { t: 2, stack: "max" });
      startCooldown(p, "foldingStrike", RULES.cooldown.foldingStrike);
      game.log(`The world folds around you, and ${near.length > 1 ? `${near.length} monsters reel` : `the ${near[0].name} reels`}! (stunned)`, [200, 190, 255]);
    }
  }
}

// Q: drink a potion you know heals. Returns true if you drank one.
function quickHeal() {
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

function toggleTorch() {
  game.player.torch = !game.player.torch;
  game.log(game.player.torch ? "You light your torch." : "You put out your torch. Harder to see, harder to be seen.", [255, 200, 120]);
}

function toggleMarker(tile) {
  const zone = game.zone;
  if (!tile || tile.x < 0 || tile.y < 0 || tile.x >= zone.w || tile.y >= zone.d) return;
  const k = zone.markers.findIndex((m) => m.x === tile.x && m.y === tile.y);
  if (k >= 0) zone.markers.splice(k, 1);
  else if (!zone.seen[tile.x + tile.y * zone.w]) game.log("You can only mark places you've seen.", [170, 170, 170]);
  else if (zone.markers.length >= 9) game.log("You can place at most 9 markers.", [170, 170, 170]);
  else zone.markers.push({ x: tile.x, y: tile.y });
}

// Inventory: close it after using something; on the map, using takes game time.
function inventoryAction(cost) {
  if (cost === 0) return;              // just moved the selection, or nothing happened
  if (game.mode === "inventory") closeInventory(game);   // (a potion of descent may have moved you already)
  if (cost === null) {                 // closed with I / Esc
    if (game.mode === "explore") { game.paused = false; lockPointer(); }
    return;
  }
  if (cost === "throw") {              // T on a potion or knife: throw it (and make it the ready item)
    const stack = game.throwStack;
    game.throwStack = null;
    if (game.mode === "map") { if (throwAtNearest(game, stack)) mapUseTime(game, THROW_TIME); }
    else if (game.mode === "explore") { game.player.throwCd = 0; throwReady(game, stack); game.paused = false; lockPointer(); }
    return;
  }
  if (game.mode === "map") {
    mapUseTime(game, cost);
    if (hasStatus(game.player, "paralyzed") && game.mode === "map") mapUseTime(game, statusLeft(game.player, "paralyzed"));   // frozen: the world moves on
  } else if (game.mode === "explore") { game.paused = false; lockPointer(); }
}

function choosePerk(k) {
  if (k < 0 || k >= game.perkChoices.length) return;
  takePerk(game, game.perkChoices[k]);
  game.mode = game.levelReturn;
  if (game.mode === "explore") { game.paused = false; lockPointer(); }
}

function openInv() {
  game.travel = null;
  if (game.mode === "explore") unlockPointer();
  openInventory(game);
}

// Map controls: one step per key press (holding a key repeats it).
const MAP_MOVES = {
  KeyW: [0, -1], ArrowUp: [0, -1], Numpad8: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1], Numpad2: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], Numpad4: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0], Numpad6: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
};

function mapKey(code) {
  game.travel = null;                       // any key interrupts a click-to-travel
  if (code === "Escape") { toggleMap(); return; }
  if (code === "KeyI") { openInv(); return; }
  if (code === "KeyJ") { openJournal(game); return; }
  if (code === "KeyX") { startExplore(game); return; }
  if (MAP_MOVES[code]) { mapStep(game, ...MAP_MOVES[code]); return; }
  if (code === "Space" || code === "Period" || code === "Numpad5") mapWait(game);
  if (code === "KeyQ" && quickHeal()) mapUseTime(game, 0.5);
  if (code === "KeyT" && throwAtNearest(game)) mapUseTime(game, THROW_TIME);
  if (code === "KeyF") { toggleTorch(); refreshView(game); }
  if (code === "KeyR") { const t = swapWeapons(game); if (t) mapUseTime(game, t); }
}

function mapClick(button, clientX, clientY) {
  const tile = tileAtCell(S.cellAt(clientX, clientY));
  if (button === 2) { toggleMarker(tile); return; }
  if (button !== 0 || !tile) return;
  const p = game.player;
  const dx = tile.x - Math.floor(p.x), dy = tile.y - Math.floor(p.y);
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx || dy) && monsterAt(game.zone, tile.x, tile.y)) mapStep(game, dx, dy);
  else startTravel(game, tile.x, tile.y);
}

export const inputHandlers = {
  onKeyDown(code, repeat) {
    unlockAudio();   // browsers only allow sound once you've pressed something
    if (code === "KeyM" && !repeat && game.mode !== "talk" && game.mode !== "shop") {
      game.log(toggleMusic() ? "Music on. (M)" : "Music off. (M)", [170, 170, 170]);
      return;
    }
    if (code === "KeyN" && !repeat && game.mode !== "talk" && game.mode !== "shop") {
      game.log(toggleSounds() ? "Sounds and voices on. (N)" : "Sounds and voices off. (N)", [170, 170, 170]);
      return;
    }
    if (game.mode === "dead" || game.mode === "won") { if (code === "KeyR" && !repeat) startRun(randomSeed()); return; }
    if (game.mode === "descend" || game.mode === "rotate") return;
    if (game.mode === "story") { if (!repeat) storyKey(game, code); return; }
    if (game.mode === "talk") { if (!repeat) talkKey(game, code); return; }
    if (game.mode === "shop") { shopKey(game, code); return; }
    if (game.mode === "journal") { if (!repeat) journalKey(game, code); return; }
    if (game.mode === "levelup") {
      const k = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[code];
      if (k !== undefined && !repeat) choosePerk(k);
      return;
    }
    if (game.mode === "inventory") { inventoryAction(inventoryKey(game, code)); return; }
    if (code === "Tab") {
      if (!repeat) toggleMap();   // (refused while flat)
      return;
    }
    if (game.mode === "map") { if (!repeat || MAP_MOVES[code]) mapKey(code); return; }
    if (repeat) return;
    if (code === "KeyI") { openInv(); return; }
    if (code === "KeyJ") { openJournal(game); return; }
    if (game.paused || statusFlag(game.player, "noAct")) return;
    if (code === "Enter") playerAttack(game);   // for when a mouse button isn't handy
    if (code === "KeyE") interact(game);
    if (code === "KeyQ") quickHeal();
    if (code === "KeyT") throwReady(game);
    if (code === "KeyF") toggleTorch();
    if (code === "KeyR") swapWeapons(game);
  },
  onMouseDown(button, clientX, clientY) {
    unlockAudio();
    if (game.mode === "story") { if (button === 0) nextPage(game); return; }
    if (game.mode === "talk") { if (button === 0) talkClick(game, S.cellAt(clientX, clientY)); return; }
    if (game.mode === "journal") { journalKey(game, "Escape"); return; }
    if (game.mode === "levelup") { if (button === 0) choosePerk(levelUpClick(game, S.cellAt(clientX, clientY))); return; }
    if (game.mode === "inventory") { if (button === 0) inventoryAction(inventoryClick(game, S.cellAt(clientX, clientY))); return; }
    if (game.mode === "map") { mapClick(button, clientX, clientY); return; }
    if (game.mode !== "explore") return;
    if (!isLocked()) { lockPointer(); game.paused = false; return; }
    if (game.paused) { game.paused = false; return; }
    if (button === 0) playerAttack(game);
    if (button === 2) throwReady(game);
  },
  onLook(dx, dy) {
    if (game.mode !== "explore" || game.paused) return;
    game.player.yaw += dx * game.sensitivity;
    game.player.pitch -= dy * game.sensitivity;
    clampPitch(game.player);
  },
  onHover(clientX, clientY) {
    mapView.hover = S.cellAt(clientX, clientY);
    if (game.mode === "talk") talkHover(game, mapView.hover);
  },
  onWheel(sign) { if (game.mode === "explore") game.fov = Math.max(40, Math.min(100, game.fov + sign * 5)); },
  onLockChange(locked) {
    if (locked) game.paused = false;
    else if (game.mode === "explore") game.paused = true;   // Esc: pause until the next click
  },
};

// ---------------------------------------------------------------------------
// One frame: advance the game by dt seconds, then draw it.
export function tick(dt) {
  if (dt > 0) game.fps += (1 / dt - game.fps) * 0.05;
  step(dt);
  audioFrame();
  setListener(game.player.x, game.player.y, game.player.yaw, game.view === "map" || !game.story.cube);
  updateMusic(game);
  const t0 = performance.now();
  draw();
  game.frameMs += (performance.now() - t0 - game.frameMs) * 0.05;
}

// For automated checks from the console: run the simulation without the render loop.
//   enterZone(key, how, opts)    go straight to a zone (generated if new), placed by `how`
//   changeFloor(key, how, …)     the same with the "DEPTH n" beat, as stairs and holes do
game.debug = { update, step, startRun, changeFloor, toggleMap, draw, mapKey, mapClick, openInv, inventoryAction, choosePerk, throwReady, throwAtNearest,
               enterZone: (key, how = "down", opts = {}) => changeZone(game, key, { how, rng: Math.random, ...opts }),
               zone: (key) => cachedZone(game, key) || makeZone(game, key),
               openTalk: (n) => openTalk(game, n), talkKey: (c) => talkKey(game, c), storyKey: (c) => storyKey(game, c) };
