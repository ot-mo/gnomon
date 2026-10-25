// The golden scenarios' adapter for the parent game's API (commit 75edbd3): Floor, generateFloor,
// game.floor/floors/depth, game.debug.enterFloor. tools/golden-record.mjs uses it to record the
// fixtures. It must keep working against an untouched copy of the parent's src/ (pass --src to
// the recorder); it never runs against today's src/.
//
// env: from tools/node-env.mjs (env.load imports a module from the chosen src directory).
export async function legacyApi(env, seedRandom) {
  const G = await env.load("game.js");
  const world = await env.load("world.js");
  const dungeon = await env.load("gen/dungeon.js");
  const vaults = await env.load("gen/vaults.js");
  const { makeRng } = await env.load("rng.js");
  const items = await env.load("items.js");
  const player = await env.load("player.js");
  const inventory = await env.load("inventory.js");
  const leveling = await env.load("leveling.js");
  const { render3d } = await env.load("render3d.js");
  const { renderMap } = await env.load("renderMap.js");
  const story = await env.load("story.js");
  const game = G.game;

  // pickVault's own normalisation (gen/vaults.js:335-337), for one chosen vault.
  const buildOf = (v) => (rng) => {
    const built = v.build ? v.build(rng) : { plan: v.plan, links: v.links };
    const { plan, links = [], ...extra } = Array.isArray(built) ? { plan: built } : built;
    return { ...v, ...extra, plan, links, w: plan[0].length, d: plan.length };
  };
  const STACKS = ["potion", "scroll", "knife", "bomb"];

  return {
    name: "legacy (75edbd3)",
    game, seedRandom, makeRng, FLOOR_Z: world.FLOOR_Z, cols: env.capture.cols, rows: env.capture.rows,

    newRun: (seed) => G.startRun(seed),
    generateLevel: (seed, depth) => dungeon.generateFloor(seed, depth),
    enterLevel(level, depth, how) { game.floors.set(depth, level); game.debug.enterFloor(depth, how); },
    player: () => game.player,
    level: () => game.floor,
    creatures: (f) => f.monsters,
    npcs: (f) => f.npcs,
    clearCreatures() { game.floor.monsters.length = 0; },

    // Out of the intro story and into the 3D view with the cube found; nothing pending.
    prepare() {
      game.pages = null; game.pendingPages = null; game.story.cube = true;
      game.mode = "explore"; game.view = "3d"; game.paused = true; game.travel = null;
    },
    // A still picture: fixed time, no effects, every animation at its first frame.
    prepareFrames(f) {
      game.time = 100; game.effects = []; game.cam = null; game.fov = 75;
      const p = game.player;
      p.hurt = 0; p.wade = 0; p.swing = 0;
      for (const m of f.monsters) m.anim = 0;
      f.npcs.forEach((n, k) => { n.id = 1000 + k; });   // a ghost's bob reads its id
    },
    placeCamera(x, y, z, yaw, pitch) { Object.assign(game.player, { x, y, z, yaw, pitch, vz: 0 }); },
    frame3d(torch) { game.player.torch = torch; game.mode = "explore"; game.view = "3d"; render3d(game); return env.frameHash(); },
    frameMap(torch) { game.player.torch = torch; game.mode = "map"; game.view = "map"; renderMap(game); return env.frameHash(); },

    // The inventory screen, as the 3D view uses it (no game time passes).
    give(item) {
      const p = game.player;
      items.addToInventory(p, { ...item });
      return STACKS.includes(item.kind) ? p.inv.findIndex((s) => s.kind === item.kind && s.effect === item.effect) : p.inv.length - 1;
    },
    useInv(index) { game.debug.openInv(); game.invSel = index; game.debug.inventoryAction(inventory.inventoryKey(game, "Enter")); },
    invKey(code) { game.debug.openInv(); game.debug.inventoryAction(inventory.inventoryKey(game, code)); },
    dropAtFeet(item) { const p = game.player; game.floor.items.push(items.makeItem(item, p.x, p.y, p.z)); },
    pickUp() { items.pickUpItems(game); },
    takePerk(key) { game.perkChoices = [key]; game.levelReturn = game.mode; game.debug.choosePerk(0); },
    relic: (key) => items.makeRelic(key),
    playerFacts(keys) {
      const p = game.player;
      return {
        derived: { str: p.str, maxHp: p.maxHp, armour: player.armourValue(p), reach: player.weaponReach(p),
                   bonus: Object.fromEntries(keys.map((k) => [k, player.bonus(p, k)])) },
        gear: { weapon: p.weapon, armour: p.armour, ring: p.ring, amulet: p.amulet, sidearm: p.sidearm },
        inv: p.inv, keys: p.keys, gold: p.gold, torch: p.torch,
        perks: [...p.perks].map((k) => [k, leveling.perkRank(p, k)]),
        known: { potions: game.knownPotions, scrolls: game.knownScrolls, auras: game.auraKnown },
      };
    },

    vaultCatalog: () => [
      ...vaults.VAULTS.map((v) => ({ name: v.name, kind: "vault", build: buildOf(v) })),
      ...Object.values(vaults.GUARDIAN_HALLS).map((v) => ({ name: v.name, kind: "hall", build: buildOf(v) })),
      { name: vaults.BOSS_VAULT.name, kind: "hall", build: buildOf(vaults.BOSS_VAULT) },
    ],
    emptyLevel(level) { const f = new world.Floor(level, 1234); f.blocks.fill(world.B.ROCK); return f; },
    stampVault: (f, built, x, y, rng) => vaults.stampVault(f, built, x, y, rng),
    buildTemple: (seed) => story.buildTemple(seed),
  };
}
