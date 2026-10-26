// The AI (ai.js), spatial buckets (creatures.js) and the factions stub (factions.js): TECH_DESIGN §1.4,
// §2.11, §3.4.
//
//   checkAi({ game, startRun, srcFiles }) → { name, ok, problems, stats }
//
//   1. The move: monsters.js no longer thinks (no updateMonsters, perceive or chooseStep there), and
//      AI_HOOKS holds "boss" and the three "guardian:<id>" hooks.
//   2. Buckets: during an update creaturesNear through the 8×8 buckets returns exactly what the linear
//      scan returns (random points and radii, creatures added and removed while they stand); after the
//      update they are dropped.
//   3. attitude (the stub): a monster is hostile to you, a person neutral, creatures neutral to each
//      other, unaware across the plane and the dark, hostile with a grudge; a follower takes its leader's
//      side. With registered factions: §2.11's band × temperament table and relations.
//   4. Creature targets: two goblins out of your sight, one with a grudge against the other: it picks it
//      (pickTarget), closes in by greedy steps (no flow field), strikes; the victim strikes back; the
//      fight ends in a death that gives you no XP. A target moved beyond 8 tiles is dropped.
//   5. The hooks run: a blinded Flat Queen shrugs it off ("guardian:flatqueen"), the Lich King at 60% of
//      its health raises three skeletons ("boss").
//
// game/startRun: the real game (game.js). srcFiles: [{ file, text }] of every src/ module.
import { Zone, B, FLOOR_Z } from "../../src/world.js";
import { enterZone } from "../../src/zones.js";
import { updateCreatures, pickTarget, flowTo, AI_HOOKS } from "../../src/ai.js";
import { spawnCreature, addCreature, removeCreature, creaturesNear, buildBuckets, dropBuckets, hostilesTo, targetsFor } from "../../src/creatures.js";
import { attitude, band, registerFaction, addRep, repOf } from "../../src/factions.js";
import { makeRng, distance } from "../../src/rng.js";
import { addStatus, hasStatus } from "../../src/status.js";

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

function arena(key, w = 48, d = 24) {
  const z = new Zone({ key, wx: 96, wy: 96, z: 0, type: "surface", level: 3, seed: 3, w, d, h: 16, name: "AI Test" });
  for (let y = 0; y < z.d; y++)
    for (let x = 0; x < z.w; x++) for (let k = 0; k < FLOOR_Z; k++) z.set(x, y, k, k === FLOOR_Z - 1 ? B.GRASS : B.ROCK);
  z.edges = { n: null, s: null, e: null, w: null };
  z.refresh();
  z.spawn = { x: 1.5, y: 1.5, z: FLOOR_Z, yaw: 0 };
  return z.seal();
}

export function checkAi({ game, startRun, srcFiles }) {
  const problems = [], stats = {};
  const expect = (ok, m) => { if (!ok) problems.push(m); return ok; };

  // --- 1. The move ----------------------------------------------------------------------------------------
  const monsters = stripComments(srcFiles.find((f) => f.file === "monsters.js").text);
  const left = ["updateMonsters", "function perceive", "function chooseStep", "function bossPhase", "flowField"].filter((n) => monsters.includes(n));
  expect(!left.length, `monsters.js still thinks: ${left.join(", ")}`);
  const hooks = ["boss", "guardian:flatqueen", "guardian:warden", "guardian:colossus"];
  expect(hooks.every((h) => typeof AI_HOOKS[h] === "function"), `AI_HOOKS lacks ${hooks.filter((h) => !AI_HOOKS[h]).join(", ")}`);
  stats.hooks = Object.keys(AI_HOOKS).sort();

  startRun(31);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  const logged = [], log = game.log;
  game.log = (text) => logged.push(text);
  const p = game.player;
  try {
    // --- 2. Buckets -------------------------------------------------------------------------------------
    const field = arena("ai-buckets", 64, 40);
    enterZone(game, field, { how: "start" });
    const rng = makeRng(77);
    for (let k = 0; k < 90; k++) {
      const x = rng.int(0, field.w - 1), y = rng.int(0, field.d - 1);
      const c = addCreature(field, spawnCreature("rat", x, y, FLOOR_Z, { rng: () => 0.5 }));
      c.x += rng() - 0.5; c.y += rng() - 0.5;   // between tiles, as they are mid-step
    }
    const ids = (list) => list.map((c) => c.id).sort((a, b) => a - b).join(",");
    const linear = (x, y, r) => field.creatures.filter((c) => distance(c.x - x, c.y - y) <= r);
    let queries = 0, wrong = 0;
    buildBuckets(field);
    const ask = () => {
      for (let k = 0; k < 150; k++) {
        const x = rng() * field.w, y = rng() * field.d, r = 0.5 + rng() * 14;
        queries++;
        if (ids(creaturesNear(field, x, y, r)) !== ids(linear(x, y, r))) wrong++;
      }
    };
    ask();
    for (let k = 0; k < 10; k++) removeCreature(field, field.creatures[rng.int(0, field.creatures.length - 1)]);
    for (let k = 0; k < 10; k++) addCreature(field, spawnCreature("bat", rng.int(0, field.w - 1), rng.int(0, field.d - 1), FLOOR_Z, { rng: () => 0.5 }));
    ask();
    dropBuckets(field);
    expect(wrong === 0, `creaturesNear through buckets differs from the linear scan in ${wrong} of ${queries} queries`);
    updateCreatures(game, 0.01);
    expect(!field.buckets, "the buckets outlive updateCreatures");
    stats.buckets = { queries, wrong, creatures: field.creatures.length };
    field.creatures.length = 0;

    // --- 3. attitude --------------------------------------------------------------------------------------
    const mk = (type, opts = {}) => spawnCreature(type, 2, 2, FLOOR_Z, { rng: () => 0.5, ...opts });
    const goblin = mk("goblin"), rat = mk("rat"), flatling = mk("flatling"), wraith = mk("wraith"), pell = mk("pell");
    const att = {
      goblinYou: attitude(game, goblin, p), pellYou: attitude(game, pell, p), youGoblin: attitude(game, p, goblin), youPell: attitude(game, p, pell),
      goblinRat: attitude(game, goblin, rat), goblinFlatling: attitude(game, goblin, flatling), flatlingYou: attitude(game, flatling, p),
      goblinWraith: wraith.vis.ghostly ? attitude(game, goblin, wraith) : "unaware", goblinPell: attitude(game, goblin, pell),
    };
    expect(att.goblinYou === "hostile" && att.pellYou === "neutral" && att.youGoblin === "hostile" && att.youPell === "neutral",
           `toward you: ${JSON.stringify(att)}`);
    expect(att.goblinRat === "neutral" && att.goblinPell === "neutral" && att.goblinFlatling === "unaware" && att.flatlingYou === "hostile" &&
           att.goblinWraith === "unaware", `creature to creature: ${JSON.stringify(att)}`);
    goblin.brain = { grudges: { [rat.id]: 1 } };
    expect(attitude(game, goblin, rat) === "hostile" && attitude(game, rat, goblin) === "neutral", "a grudge makes it hostile (one way)");
    rat.brain = { leader: goblin.id };
    field.creatures.push(goblin, rat);
    const follower = [attitude(game, rat, goblin), attitude(game, rat, p)];
    rat.brain = { leader: "player" };
    follower.push(attitude(game, rat, p), attitude(game, rat, goblin));
    expect(follower.join() === "friendly,hostile,friendly,hostile", `a follower takes its leader's side: ${follower.join()}`);
    field.creatures.length = 0;
    expect([-600, -599, -250, -249, 249, 250, 599, 600].map(band).join() === "hated,disliked,disliked,indifferent,indifferent,liked,liked,loved",
           "rep bands at −600, −250, +250, +600");
    registerFaction("aiTestWolves", { name: "test wolves", temperament: "aggressive", relations: { aiTestSheep: -1 } });
    registerFaction("aiTestSheep", { name: "test sheep", temperament: "docile" });
    const wolf = mk("rat"), sheep = mk("bat");
    wolf.faction = { aiTestWolves: 1 }; sheep.faction = { aiTestSheep: 1 };
    const table = [];
    for (const rep of [-700, -300, 0, 300, 700]) {
      addRep(game, "aiTestWolves", rep - repOf(game, "aiTestWolves"));
      addRep(game, "aiTestSheep", rep - repOf(game, "aiTestSheep"));
      table.push(`${attitude(game, sheep, p)}/${attitude(game, wolf, p)}`);
    }
    expect(table.join() === "hostile/hostile,wary/hostile,neutral/hostile,friendly/neutral,friendly/friendly",
           `band × temperament (docile/aggressive): ${table.join()}`);
    expect(attitude(game, wolf, sheep) === "hostile" && attitude(game, sheep, wolf) === "neutral", "relations −1: the wolves hunt the sheep");
    stats.attitude = { ...att, table };

    // --- 4. Creature targets ----------------------------------------------------------------------------
    const pit = arena("ai-fight", 48, 24);
    enterZone(game, pit, { how: "start" });
    Object.assign(p, { x: 1.5, y: 1.5, z: FLOOR_Z, torch: false });   // far off, in the dark
    const a = addCreature(pit, spawnCreature("goblin", 30, 12, FLOOR_Z, { rng: () => 0.5, state: "wander", level: 3 }));
    const b = addCreature(pit, spawnCreature("goblin", 37, 12, FLOOR_Z, { rng: () => 0.5, state: "idle", level: 3 }));
    a.brain = { grudges: { [b.id]: 1 } };
    expect(pickTarget(game, a) === b && a.brain.target === b.id && pickTarget(game, b) === null, "pickTarget: the grudge picks its foe, the other picks none");
    expect(hostilesTo(game, b).includes(a) && targetsFor(game, a).includes(b) && !targetsFor(game, b).includes(a), "hostilesTo / targetsFor see the grudge");
    expect(flowTo(game, b) === null && flowTo(game, p) === game.flow, "flowTo: a flow field toward you only");
    const xp0 = p.xp;
    let steps = 0, closer = true, struck = false, back = false, lastD = distance(a.x - b.x, a.y - b.y), time = 0;
    while (time < 60 && pit.creatures.includes(a) && pit.creatures.includes(b)) {
      updateCreatures(game, 1 / 30);
      time += 1 / 30;
      const d = distance(a.x - b.x, a.y - b.y);
      if (!struck && d > lastD + 1e-9 && a.state !== "chase") closer = false;
      if (!struck) { lastD = d; steps++; }
      if (b.hp < b.maxHp) struck = true;
      if (a.hp < a.maxHp) back = true;
    }
    const dead = !pit.creatures.includes(a) || !pit.creatures.includes(b);
    expect(closer && struck, `the goblin with the grudge didn't close in and strike (closer ${closer}, struck ${struck})`);
    expect(back && b.brain?.grudges?.[a.id] === 1, "the victim didn't strike back");
    expect(dead && p.xp === xp0 && a.state !== "chase" && b.state !== "chase", `the fight: a death ${dead}, your XP ${xp0} → ${p.xp}, states ${a.state}/${b.state}`);
    stats.fight = { seconds: +time.toFixed(2), approachUpdates: steps, survivor: pit.creatures.includes(a) ? "grudge" : "victim" };
    pit.creatures.length = 0;

    // Out of range: a target 20 tiles off is dropped at the next look.
    const c1 = addCreature(pit, spawnCreature("goblin", 20, 12, FLOOR_Z, { rng: () => 0.5, state: "wander" }));
    const c2 = addCreature(pit, spawnCreature("goblin", 24, 12, FLOOR_Z, { rng: () => 0.5, state: "wander" }));
    c1.brain = { grudges: { [c2.id]: 1 } };
    pickTarget(game, c1);
    const had = c1.brain.target === c2.id;
    Object.assign(c2, { tx: 44, ty: 12, nx: 44, ny: 12, x: 44.5, y: 12.5 });
    pickTarget(game, c1);
    expect(had && !c1.brain.target, "a creature target beyond 8 tiles is kept");
    pit.creatures.length = 0;

    // The hooks run: a guardian shrugs off blindness, the boss raises the dead at two thirds of its health.
    Object.assign(p, { x: 1.5, y: 1.5, z: FLOOR_Z });
    const queen = addCreature(pit, spawnCreature("flatqueen", 30, 12, FLOOR_Z, { rng: () => 0.5, state: "chase", level: 5 }));
    addStatus(game, queen, "blinded", { t: 5 });
    const lich = addCreature(pit, spawnCreature("lich", 20, 12, FLOOR_Z, { rng: () => 0.5, state: "chase", level: 20 }));
    lich.hp = Math.floor(lich.maxHp * 0.6);
    updateCreatures(game, 1 / 30);
    const raised = pit.creatures.filter((c) => c.type === "skeleton").length;
    expect(!hasStatus(queen, "blinded") && lich.phase === 1 && raised === 3, `hooks: the queen still blinded ${hasStatus(queen, "blinded")}, the lich's phase ${lich.phase}, ${raised} skeletons`);
    stats.hookRun = { queenBlinded: hasStatus(queen, "blinded"), lichPhase: lich.phase, raised };
    pit.creatures.length = 0;
  } finally {
    game.log = log;
  }
  return { name: "ai", ok: problems.length === 0, problems, stats };
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-ai.mjs gives.
export async function run(env) {
  await env.screen();
  const { game, startRun } = await env.src("game.js");
  return checkAi({ game, startRun, srcFiles: await env.srcFiles() });
}
