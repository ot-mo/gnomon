// Whole frames, the HUD and the screens included, held to the old game (0D1 verification): the shell is a
// refactor, so at 180×56 every frame of these fixed states must be what p0-0c drew. golden.js's frames
// part only covers the render3d / renderMap cell buffers; this covers the status line, the messages, the
// inventory, the level-up, death and victory cards and the intro page around them.
//
//   screenFrames({ game, startRun, inputHandlers, addStatus, frameHash, seedRandom }) → [{ name, hash }]
//       the same script for any tree that has game.debug { enterZone, step, draw, openInv } and
//       status.js addStatus (p0-0c and later): two seeds, two legacy depths, both views, then statuses and
//       messages, the inventory, a level gained, the pause card (the pointer lock lost), death; the intro
//       page and the victory card.
//   checkScreenFrames(frames, fixture) → { name, ok, problems, stats }
//       fixture: { against, frames: [{ name, hash }] } (tools/record-screen-frames.mjs, from p0-0c)
export function screenFrames({ game, startRun, inputHandlers, addStatus, frameHash, seedRandom }) {
  const out = [];
  const shot = (name) => {
    game.fps = 60; game.frameMs = 1.5;   // the fps segment: the same number in both trees
    game.debug.draw();
    out.push({ name, hash: frameHash() });
  };
  const steps = (n) => { for (let k = 0; k < n; k++) game.debug.step(1 / 60); };

  for (const seed of [99, 31]) {
    seedRandom(seed);
    startRun(seed);
    shot(`seed ${seed} intro page`);
    for (const depth of [3, 11]) {
      seedRandom(seed * 100 + depth);
      startRun(seed);
      const st = game.run.world.start;
      game.pages = null; game.pendingPages = null; game.story.cube = true;
      game.debug.enterZone(`${st.wx},${st.wy},${depth}`, "down");
      const p = game.player;
      for (const view of ["3d", "map"]) {
        const tag = `seed ${seed} depth ${depth} ${view}`;
        const look = () => { game.mode = view === "3d" ? "explore" : "map"; game.view = view; game.paused = false; p.yaw = 0.7; p.pitch = -0.1; };
        look(); steps(2);
        shot(`${tag}`);
        if (view === "3d") {
          p.torch = !p.torch; shot(`${tag} torch toggled`); p.torch = !p.torch;
          inputHandlers.onLockChange(false); shot(`${tag} pause card`); inputHandlers.onLockChange(true); look();
        }
        // Statuses and messages.
        for (const id of ["hasted", "poisoned", "shadowed"]) addStatus(game, p, id, { t: 30 });
        game.log("A test line in the log.", [200, 200, 200]);
        game.log("Another, in another colour.", [255, 120, 80]);
        shot(`${tag} statuses and messages`);
        // The inventory.
        game.debug.openInv();
        shot(`${tag} inventory`);
        look();
        // A level gained.
        p.pendingLevels = 1; game.debug.step(1 / 60);
        shot(`${tag} levelup (${game.mode})`);
        if (game.mode === "levelup") game.debug.choosePerk(0);
        look();
      }
      // Death.
      for (let k = 0; k < 3 && game.mode !== "dead"; k++) { game.hurtPlayer(99999, "a test"); game.debug.step(1 / 60); }   // (a Second Wind perk takes the first)
      shot(`seed ${seed} depth ${depth} death card (${game.mode})`);
    }
  }
  // The victory card.
  seedRandom(7);
  startRun(7);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  game.mode = "won";
  shot("victory card");
  return out;
}

// Frames still drawn but not compared with the fixture, each with its reason (WS3, applied on ws/ws3 for the
// integrator to confirm at merge; tests/checks/render.js checks the victory card itself over the new map).
export const NOT_COMPARED = new Map([
  ["victory card", "drawn over the temple span's surface map, which WS3's outdoor looks change; the underground frames and golden (b) stay held"],
]);

export function checkScreenFrames(frames, fixture) {
  const problems = [], want = new Map(fixture.frames.map((f) => [f.name, f.hash]));
  let mismatched = 0, skipped = 0;
  for (const f of frames) {
    if (!want.has(f.name)) { problems.push(`no recorded frame "${f.name}"`); continue; }
    if (NOT_COMPARED.has(f.name)) { skipped++; continue; }
    if (want.get(f.name) !== f.hash) { mismatched++; problems.push(`"${f.name}" differs from ${fixture.against}`); }
  }
  for (const name of want.keys()) if (!frames.some((f) => f.name === name)) problems.push(`recorded frame "${name}" not drawn`);
  return { name: `screen frames (the HUD and screens against ${fixture.against})`, ok: problems.length === 0, problems,
           stats: { frames: `${frames.length} at 180×56, ${frames.length - skipped} compared, ${mismatched} mismatched`,
                    notCompared: [...NOT_COMPARED].map(([name, why]) => `${name}: ${why}`) } };
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-screen-frames.mjs gives.
export async function run(env) {
  const fixture = await env.json("tests/fixtures/screen-frames.json");
  const { frameHash } = await env.screen({ cols: 180, rows: 56 });
  const { game, startRun, inputHandlers } = await env.src("game.js");
  const { addStatus } = await env.src("status.js");
  return checkScreenFrames(screenFrames({ game, startRun, inputHandlers, addStatus, frameHash, seedRandom: env.seedRandom }), fixture);
}
