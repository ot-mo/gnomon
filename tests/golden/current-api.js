// The golden scenarios' adapter for today's API (zones, generateDungeonLevel + legacyParams).
// tools/check-golden.mjs replays tests/golden/scenarios.js through it and compares the result with
// the fixtures recorded at 75edbd3 (legacy-api.js). When a later session changes an API the
// scenarios touch (stats in 0B, creatures in 0C), it updates this adapter, never the fixtures.
// Since 0B the derived numbers come from the stat bus (stats.js) with RULES.stats = "legacy", and the
// parent's five gear fields are read from the body (body.js): the primary hand, the body part, the first
// finger, the neck and the belt. The parent's `gold` field is the purse (currency.js funds), and its
// `gold` piles are today's `cash` piles (the same pile in glim): the adapter shows generated and stamped
// piles under the parent's kind name, so the dungeon and vault facts compare as recorded.
// Since 0C monsters and people are one list, zone.creatures (creatures.js): the parent's monsters are the
// creatures that don't talk, and its people the talkers, shown in the parent's shape (depth = level,
// met and state from talk).
// Since 0D1 every mode is a screen on the mode stack (screens.js): a perk is taken on the levelup screen.
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
  const stats = await env.load("stats.js");
  const body = await env.load("body.js");
  const currency = await env.load("currency.js");
  const { canTalk } = await env.load("creatures.js");
  const screens = await env.load("screens.js");
  const game = G.game;
  const STACKS = ["potion", "scroll", "knife", "bomb"];
  const parentKinds = (zone) => { for (const it of zone.items) if (it.kind === "cash") it.kind = "gold"; return zone; };

  return {
    name: "current",
    game, seedRandom, makeRng, FLOOR_Z: world.FLOOR_Z, cols: env.capture.cols, rows: env.capture.rows,

    newRun: (seed) => G.startRun(seed),
    // The legacy stack's level `depth`, as the fixture site under tile (0, 0) makes it.
    generateLevel(seed, depth) {
      const zone = dungeon.generateDungeonLevel(seed, dungeon.legacyParams(depth, seed));
      zone.siteId = "legacy";
      return parentKinds(zone.seal());
    },
    enterLevel(level, depth, how) { game.zones.set(level.key, level); zones.enterZone(game, level, { how, rng: Math.random }); },
    player: () => game.player,
    level: () => game.zone,
    creatures: (f) => f.creatures.filter((c) => !canTalk(c)),
    npcs: (f) => f.creatures.filter(canTalk).map((n) => ({ type: n.type, tx: n.tx, ty: n.ty, z: n.z, depth: n.level, met: n.talk.met, state: n.talk.state })),
    clearCreatures() { const z = game.zone; z.creatures = z.creatures.filter(canTalk); },

    prepare() {
      game.pages = null; game.pendingPages = null; game.story.cube = true;
      game.mode = "explore"; game.view = "3d"; game.paused = true; game.travel = null;
    },
    prepareFrames(f) {
      game.time = 100; game.effects = []; game.cam = null; game.fov = 75;
      const p = game.player;
      p.hurt = 0; p.wade = 0; p.swing = 0;
      for (const m of f.creatures) if (!canTalk(m)) m.anim = 0;
      f.creatures.filter(canTalk).forEach((n, k) => { n.id = 1000 + k; });   // a ghost's bob reads its id
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
    takePerk(key) { game.perkChoices = [key]; screens.pushMode(game, "levelup"); game.debug.choosePerk(0); },   // the levelup screen (0D1)
    relic: (key) => items.makeRelic(key),
    playerFacts(keys) {
      const p = game.player;
      return {
        derived: { str: stats.attr(p, "str"), maxHp: stats.maxHp(p), armour: stats.av(p), reach: player.weaponReach(p),   // the stat bus (0B)
                   bonus: Object.fromEntries(keys.map((k) => [k, stats.bonus(p, k)])) },
        gear: { weapon: body.wielded(p), armour: body.wornOn(p, "body"), ring: body.wornOn(p, "finger_r"),   // the body (0B)
                amulet: body.wornOn(p, "neck"), sidearm: body.belt(p) },
        inv: p.inv, keys: p.keys, gold: currency.funds(p), torch: p.torch,   // the purse (0B)
        perks: Object.keys(p.perks).map((k) => [k, leveling.perkRank(p, k)]),   // a { id: 1 } map since 0D2 (R5)
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
    stampVault: (f, built, x, y, rng) => { const at = vaults.stampVault(f, built, x, y, rng); parentKinds(f); return at; },
    // The temple is a plan since 0A2: stamped the parent's way (48×48×10, rock roof, no front door).
    buildTemple: (seed) => temple.templeFixture(seed),
  };
}
