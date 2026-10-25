// The golden scenarios' adapter for today's API (zones, generateDungeonLevel + legacyParams).
// tools/check-golden.mjs replays tests/golden/scenarios.js through it and compares the result with
// the fixtures recorded at 75edbd3 (legacy-api.js). When a later session changes an API the
// scenarios touch (stats in 0B, creatures in 0C), it updates this adapter, never the fixtures.
//
// env: from tools/node-env.mjs.
export async function currentApi(env, seedRandom) {
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
  const temple = await env.load("content/world/temple.js");
  const zones = await env.load("zones.js");
  const game = G.game;
  const STACKS = ["potion", "scroll", "knife", "bomb"];

  return {
    name: "current",
    game, seedRandom, makeRng, FLOOR_Z: world.FLOOR_Z, cols: env.capture.cols, rows: env.capture.rows,

    newRun: (seed) => G.startRun(seed),
    // The legacy stack's level `depth`, as the fixture site under tile (0, 0) makes it.
    generateLevel(seed, depth) {
      const zone = dungeon.generateDungeonLevel(seed, dungeon.legacyParams(depth, seed));
      zone.siteId = "legacy";
      return zone.seal();
    },
    enterLevel(level, depth, how) { game.zones.set(level.key, level); zones.enterZone(game, level, { how, rng: Math.random }); },
    player: () => game.player,
    level: () => game.zone,
    creatures: (f) => f.monsters,
    npcs: (f) => f.npcs,
    clearCreatures() { game.zone.monsters.length = 0; },

    prepare() {
      game.pages = null; game.pendingPages = null; game.story.cube = true;
      game.mode = "explore"; game.view = "3d"; game.paused = true; game.travel = null;
    },
    prepareFrames(f) {
      game.time = 100; game.effects = []; game.cam = null; game.fov = 75;
      const p = game.player;
      p.hurt = 0; p.wade = 0; p.swing = 0;
      for (const m of f.monsters) m.anim = 0;
      f.npcs.forEach((n, k) => { n.id = 1000 + k; });
    },
    placeCamera(x, y, z, yaw, pitch) { Object.assign(game.player, { x, y, z, yaw, pitch, vz: 0 }); },
    frame3d(torch) { game.player.torch = torch; game.mode = "explore"; game.view = "3d"; render3d(game); return env.frameHash(); },
    frameMap(torch) { game.player.torch = torch; game.mode = "map"; game.view = "map"; renderMap(game); return env.frameHash(); },

    give(item) {
      const p = game.player;
      items.addToInventory(p, { ...item });
      return STACKS.includes(item.kind) ? p.inv.findIndex((s) => s.kind === item.kind && s.effect === item.effect) : p.inv.length - 1;
    },
    useInv(index) { game.debug.openInv(); game.invSel = index; game.debug.inventoryAction(inventory.inventoryKey(game, "Enter")); },
    invKey(code) { game.debug.openInv(); game.debug.inventoryAction(inventory.inventoryKey(game, code)); },
    dropAtFeet(item) { const p = game.player; game.zone.items.push(items.makeItem(item, p.x, p.y, p.z)); },
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
      ...vaults.VAULTS.map((v) => ({ name: v.name, kind: "vault", build: (rng) => vaults.buildVault(v, rng) })),
      ...Object.values(vaults.GUARDIAN_HALLS).map((v) => ({ name: v.name, kind: "hall", build: (rng) => vaults.buildVault(v, rng) })),
      ...Object.values(vaults.BOSS_HALLS).map((v) => ({ name: v.name, kind: "hall", build: (rng) => vaults.buildVault(v, rng) })),
    ],
    emptyLevel(level) {
      const f = new world.Zone({ type: "dungeon", level, seed: 1234, w: 48, d: 48, h: 10 });
      f.blocks.fill(world.B.ROCK);
      return f;
    },
    stampVault: (f, built, x, y, rng) => vaults.stampVault(f, built, x, y, rng),
    // The temple is a plan since 0A2: stamped the parent's way (48×48×10, rock roof, no front door).
    buildTemple: (seed) => temple.templeFixture(seed),
  };
}
