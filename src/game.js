// The game: its state, the loop and input dispatch. (main.js starts it in the browser.) Everything you
// see is a registered screen on the mode stack (screens.js, TECH_DESIGN §4.1); game.mode is the top:
//   explore   – real-time first-person view                   (src/screens/play.js)
//   map       – top-down, turn-based: time passes only when you act (see turns.js)
//   rotate    – the moment the cube turns the world: the camera swings down from above
//   transition – the "DEPTH n" beat between zones             (src/screens/transition.js)
//   pause     – the 3D view paused: pointer lock lost         (src/screens/pause.js)
//   inventory – the inventory screen over either view; the game is paused (src/screens/inventory.js)
//   levelup   – choosing a perk after gaining a level; the game is paused (src/screens/levelup.js)
//   story     – full-screen story pages (the intro, the cube, the ending)
//   talk      – a conversation (dialogue.js); shop – the peddler's pack; journal – your quests
//   dead      – game over; R starts a new run
//   won       – the Lich King is dead; R starts a new run
// The keys are bindings (keys.js): each screen's key() first, then the mode's bindings, "play" (explore and
// map), and "*" (M, N). The parent's story on the bus lives in content/legacy/story-hooks.js.
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
import { changeZone, cachedZone, makeZone, zoneKey } from "./zones.js";
import { runUpdates } from "./events.js";
import "./clock.js";   // the clock's events, every frame (time of day from state.time)
import "./world/zonegen.js";   // the zone generators: surfaces, site dungeons, the legacy stack
import { buildRun } from "./world/run.js";
import { TEST_WORLD } from "./content/world/test-world.js";
import { makePlayer } from "./player.js";
import { POTIONS, POTION_COLORS, scrollTitles } from "./items.js";
import { mapView } from "./renderMap.js";
import { refreshView } from "./turns.js";
import { throwReady, throwAtNearest } from "./throwing.js";
import { makeRng } from "./rng.js";
import { toggleMusic, updateMusic } from "./music.js";
import { unlockAudio, audioFrame } from "./audio.js";
import { sfx, toggleSounds, setListener } from "./sfx.js";
import { INTRO } from "./story/legacy.js";
import "./content/legacy/encounters.js";   // the parent game's people: dialogues, quests, Pell's services
import { openTalk, talkKey, storyKey, openStory } from "./dialogue.js";
import { statusFlag, cooldownLeft, startCooldown } from "./status.js";
import { RULES } from "./rules.js";
import { setPurse } from "./currency.js";
import { setMode, pushMode, popMode, syncStack, dispatchMouse, dispatchHover, dispatchWheel, updateScreen, drawStack } from "./screens.js";
import { bind, dispatchKey } from "./keys.js";
import { beginFrame } from "./ui.js";
import "./screens/index.js";   // every screen registers itself
import { update, checkFloorEvents, fallThrough, changeFloor, onCube, forceMapView, toggleMap, mapKey, mapClick, look, drawPlay } from "./screens/play.js";
import { openInv, inventoryAction } from "./screens/inventory.js";
import { checkLevelUp, choosePerk } from "./screens/levelup.js";
import { TOAST_TIME } from "./hud.js";
import "./content/legacy/story-hooks.js";   // last, so its bus handlers run after the others' (as in the parent)

export const game = {
  seed: 0, zone: null, player: null,
  world: TEST_WORLD,   // the world definition new runs are built on (the real one waits for its content)
  run: null,           // the run: buildRun(seed, world) for a new game
  zones: new Map(),    // "wx,wy,z" → Zone: every zone you've visited stays as you left it
  state: null,         // persistent plain data (zones.js: uids, zonePatches, zoneLeft)
  mode: "explore", view: "3d", paused: true,
  modeStack: [],       // screens.js: [{ mode, data }], what each pushed screen returns to (game.mode is the top)
  // time: the one clock (R10), seconds of game time, kept as state.time so it is saved with the state;
  // clock.js reads the time of day from it. uiTime: real seconds of play, in every mode.
  get time() { return this.state ? this.state.time : this.timeBeforeRun; },
  set time(t) { if (this.state) this.state.time = t; else this.timeBeforeRun = t; },
  timeBeforeRun: 0, uiTime: 0, fov: 75, sensitivity: 0.0025,
  messages: [], effects: [], target: null, travel: null, fps: 60, frameMs: 0,
  descendT: 0, deathCause: "",
  potionColor: {}, knownPotions: new Set(), invSel: 0,
  scrollTitle: {}, knownScrolls: new Set(),
  auraKnown: new Set(),   // "potion:poison", "scroll:fire"…: kinds you've sensed with a potion of seeing
  perkChoices: [], toasts: [],
  flow: null, flowX: -1, flowY: -1, flowVersion: -1,
  story: { cube: false },   // how far the story has got
  quests: [], talk: null, shop: null, pages: null, hints: new Set(),
  cam: null, rotT: 0,       // the cube's rotation: a camera override for render3d
  pendingPages: null,       // story pages to show once the "DEPTH n" screen is done

  fallThrough() { fallThrough(this); },          // a potion of descent
  onCube() { onCube(this); },                    // you touched the Rotation Cube: the world turns
  onTalk(npc) { openTalk(this, npc); },
  forceMapView() { forceMapView(this); },        // pressed flat (status.js, bible §10.2): the map until it ends
  newRun() { startRun(randomSeed()); },          // R on the death or victory card

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

  // A line for TOAST_TIME seconds of real time under the status line (hud.js): a zone's name over an edge,
  // discoveries. (On the map game time stands still between actions; uiTime always runs.)
  toast(text, color = [200, 220, 200]) {
    this.toasts = (this.toasts || []).filter((t) => this.uiTime - t.time < TOAST_TIME);
    this.toasts.push({ text, color, time: this.uiTime });
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
      this.deathCause = statusFlag(p, "flat") ? `${source}, while pressed flat` : source;   // bible §10.2
      this.travel = null;
      setMode(this, "dead");   // (unlocks the pointer)
    }
  },

  // Stairs under your feet, or nothing under them at all? Returns true if you left the zone (play.js).
  checkFloorEvents() { return checkFloorEvents(this); },
};

export const randomSeed = () => 1 + Math.floor(Math.random() * 999999);

// A new game on `seed` (quick start: no character to make yet), at the world's start landmark.
export function startRun(seed, world = game.world) {
  game.seed = seed;
  game.run = buildRun(seed, world);
  game.state = { seed, time: 0, world: { id: game.run.world.id, version: game.run.world.version }, uids: {}, zonePatches: {}, zoneLeft: {} };
  game.clockSeen = 0;   // clock.js: the clock's events have fired up to here (day 1, 06:00)
  game.zone = null;
  game.zoneLru = [];
  game.player = makePlayer();
  if (world.startPurse) setPurse(game.player, world.startPurse);
  game.messages = [];
  game.effects = [];
  game.travel = null;
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
  game.toasts = [];
  game.prefetchJob = null;   // zones.js: a staged prefetch under way, and the zone it last saw
  game.prefetchSeen = null;
  game.modeStack = [];
  const start = game.run.world.start;
  changeZone(game, zoneKey(start.wx, start.wy, 0), { how: "start" });   // the test world's: the temple, over the legacy stack
  game.view = "map";
  game.paused = false;
  setMode(game, "map", null, { pointer: false });
  openStory(game, INTRO, () => {
    refreshView(game);
    game.log("You wake in your little room in the temple. Maren is waiting in the main hall, to the south.", [255, 220, 140]);
  });
}

// One step of dt seconds: a level gained opens its screen; the top screen's update runs (explore advances
// the world in real time, the map walks a clicked route, talk types, the cube turns, the "DEPTH n" beat
// counts down); then the registered per-frame hooks for this mode (events.js).
export function step(dt) {
  syncStack(game);   // (a check or tool may have set game.mode directly)
  game.uiTime += dt;
  checkLevelUp(game);
  updateScreen(game, dt);
  runUpdates(game, dt);
  game.effects = game.effects.filter((e) => game.time - e.time < 1.2);
}

// The stack, from the topmost screen that fills the screen (a view, the story) up to the top.
export function draw() {
  beginFrame();   // ui.js hit-testing: what this frame draws where
  if (!drawStack(game)) drawPlay(game);   // (an unregistered mode: the view and HUD)
  S.present();
}

// ---------------------------------------------------------------------------
// M and N work in every mode (TECH_DESIGN §4.3), after the top screen (talk and the shop take every key).
bind("*", "KeyM", (game) => game.log(toggleMusic() ? "Music on. (M)" : "Music off. (M)", [170, 170, 170]), { help: "music" });
bind("*", "KeyN", (game) => game.log(toggleSounds() ? "Sounds and voices on. (N)" : "Sounds and voices off. (N)", [170, 170, 170]), { help: "sounds" });

// Input goes to the top screen (screens.js) and the bindings (keys.js).
export const inputHandlers = {
  onKeyDown(code, repeat, key = "") {
    unlockAudio();   // browsers only allow sound once you've pressed something
    dispatchKey(game, code, repeat, key);
  },
  onMouseDown(button, clientX, clientY) {
    unlockAudio();
    dispatchMouse(game, button, S.cellAt(clientX, clientY));
  },
  onLook(dx, dy) { look(game, dx, dy); },
  onHover(clientX, clientY) {
    mapView.hover = S.cellAt(clientX, clientY);
    dispatchHover(game, mapView.hover);
  },
  onWheel(sign) { dispatchWheel(game, sign); },
  // Esc under pointer lock never reaches keydown: losing the lock in 3D opens the pause card; getting it
  // back (a click) closes it.
  onLockChange(locked) {
    if (locked) { if (game.mode === "pause") popMode(game, undefined, { pointer: false }); game.paused = false; }
    else if (game.mode === "explore") pushMode(game, "pause");
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
game.debug = { update: (dt) => update(game, dt), step, startRun, draw,
               changeFloor: (addr, how, message, fx, fy) => changeFloor(game, addr, how, message, fx, fy),
               toggleMap: () => toggleMap(game), mapKey: (code) => mapKey(game, code),
               mapClick: (button, clientX, clientY) => mapClick(game, button, S.cellAt(clientX, clientY)),
               openInv: () => openInv(game), inventoryAction: (cost) => inventoryAction(game, cost), choosePerk: (k) => choosePerk(game, k),
               throwReady, throwAtNearest, lockChange: (locked) => inputHandlers.onLockChange(locked),
               enterZone: (key, how = "down", opts = {}) => changeZone(game, key, { how, rng: Math.random, ...opts }),
               zone: (key) => cachedZone(game, key) || makeZone(game, key),
               openTalk: (n) => openTalk(game, n), talkKey: (c) => talkKey(game, c), storyKey: (c) => storyKey(game, c) };
