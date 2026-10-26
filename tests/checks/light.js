// The light seam (light.js): TECH_DESIGN §6.3, R12, the 0C gate's light half.
//
//   checkLight({ game, startRun, render3d, frameHash, dungeonLevel }) → { name, ok, problems, stats }
//
//   1. Underground nothing changes: in a zone without sky (a test zone and a real dungeon level, under a
//      light well and beside lamps too) inDark is exactly "your torch is out", at daylight 1 and 0.
//   2. The gate, on a synthetic sky-lit zone at noon (daylight 1) with your torch out: a ghost plank in
//      front of you is not drawn (the frame is the same as with the plank gone) and a ghost person can't
//      be seen (no sprite) or talked to; at daylight 0 the plank is drawn and the ghost seen and talked to.
//   3. The other dark-only rules under the sky: runes glow only in the dark (the frame at noon differs from
//      the one at daylight 0, and underground daylight doesn't matter); the Gloom Warden can't be touched
//      at noon and can at daylight 0; a secret wall's crack light shows only at daylight 0; in a closed room at noon it's dark (deep shade); a goblin spots you
//      at its full sight with your torch out at noon (daylight is light), at 0.55 of it at daylight 0
//      and underground.
//   4. lightAt: sky × daylight, lamps untouched.
//
// render3d/frameHash: the 3D renderer and the node env's frame hash. dungeonLevel(): a generated level.
import { Zone, B, FLOOR_Z } from "../../src/world.js";
import { enterZone } from "../../src/zones.js";
import { interact } from "../../src/interact.js";
import { mapStep } from "../../src/turns.js";
import { updateCreatures } from "../../src/ai.js";
import { spawnCreature, addCreature, creatureSprite, touchable, ghostOffMap } from "../../src/creatures.js";
import { inDark, lightAt, naturalLight, zoneIsLightless, setDaylight } from "../../src/light.js";
import { RULES } from "../../src/rules.js";
import { EYE } from "../../src/player.js";

// A 24×24 grass field open to the sky (hasSky) or not; build(z) may add blocks before the light is computed.
function field(key, hasSky, build = null) {
  const z = new Zone({ key, wx: 97, wy: 97, z: 0, type: "surface", level: 1, seed: 5, w: 24, d: 24, h: 16, name: "Light Test" });
  for (let y = 0; y < z.d; y++)
    for (let x = 0; x < z.w; x++) for (let k = 0; k < FLOOR_Z; k++) z.set(x, y, k, k === FLOOR_Z - 1 ? B.GRASS : B.ROCK);
  build?.(z);
  z.hasSky = hasSky;
  z.edges = { n: null, s: null, e: null, w: null };
  z.refresh();
  z.spawn = { x: 10.5, y: 10.5, z: FLOOR_Z, yaw: 0 };
  return z.seal();
}

export function checkLight({ game, startRun, render3d, frameHash, dungeonLevel }) {
  const problems = [], stats = {};
  const expect = (ok, m) => { if (!ok) problems.push(m); return ok; };
  let undoDay = setDaylight(1);
  const day = (v) => { undoDay(); undoDay = setDaylight(v); };

  startRun(91);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  const p = game.player;
  const talked = [], logged = [];
  const onTalk = game.onTalk, log = game.log;
  game.onTalk = (n) => talked.push(n);
  game.log = (text) => logged.push(text);
  const frame = () => { game.time = 100; game.effects = []; game.cam = null; game.fov = 75; game.view = "3d"; game.mode = "explore"; render3d(game); return frameHash(); };
  const stand = (x, y, yaw = 0, pitch = 0) => Object.assign(p, { x, y, z: FLOOR_Z, vz: 0, yaw, pitch, hurt: 0, wade: 0, swing: 0 });

  try {
    // --- 1. Underground: the torch alone ------------------------------------------------------------------
    let points = 0, wrong = 0;
    const lamps = (z) => { z.set(6, 6, FLOOR_Z, B.LAMP); z.set(16, 16, FLOOR_Z + 2, B.LAMP); };
    const zones = [field("light-under", false, lamps), dungeonLevel()];
    for (const zone of zones) {
      game.zone = zone;
      for (const dl of [1, 0])
        for (const torch of [true, false]) {
          day(dl); p.torch = torch;
          for (let y = 0.5; y < zone.d; y += 1.5)
            for (let x = 0.5; x < zone.w; x += 1.5)
              for (const zz of [FLOOR_Z + 0.5, FLOOR_Z + 1.6]) {
                points++;
                if (inDark(game, zone, x, y, zz) !== !torch || naturalLight(game, zone, x, y, zz) !== 0) wrong++;
              }
        }
      expect(zoneIsLightless(zone), `${zone.key} has no sky but isn't lightless`);
    }
    const lit = zones[1].skyLight.some((v) => v > 0) || zones[0].lampLight.some((v) => v > 0);
    expect(lit && wrong === 0, `underground inDark isn't the torch test at ${wrong} of ${points} points (lit cells there: ${lit})`);
    stats.underground = { points, wrong };
    day(1);

    // --- 2. The gate: a ghost plank and a ghost person under the noon sky ---------------------------------
    const sky = field("light-sky", true);
    enterZone(game, sky, { how: "start" });
    expect(!zoneIsLightless(sky) && naturalLight(game, sky, 10.5, 10.5, FLOOR_Z + 1) > RULES.dark.threshold, "the sky zone isn't lit by the sky");
    // The plank: one ghost block at eye height three tiles ahead. Taking it out again leaves the light
    // arrays alone (no refresh), so the two frames differ only if the plank was drawn.
    const plankFrames = {};
    for (const dl of [1, 0]) {
      day(dl);
      stand(10.5, 10.5, 0, 0);
      p.torch = false;
      sky.set(13, 10, FLOOR_Z + 1, B.GHOST);
      const withPlank = frame();
      sky.set(13, 10, FLOOR_Z + 1, B.AIR);
      const without = frame();
      plankFrames[dl] = withPlank !== without;
    }
    expect(!plankFrames[1], "a ghost plank is drawn at noon with your torch out");
    expect(plankFrames[0], "a ghost plank isn't drawn at daylight 0 with your torch out");
    // And with the torch lit it never is.
    day(0); p.torch = true;
    sky.set(13, 10, FLOOR_Z + 1, B.GHOST);
    const litPlank = frame();
    sky.set(13, 10, FLOOR_Z + 1, B.AIR);
    expect(litPlank === frame(), "a ghost plank is drawn with your torch lit");

    // The ghost person (Brann) two tiles east of you.
    const ghost = addCreature(sky, spawnCreature("brann", 12, 10, FLOOR_Z, { level: 4 }));
    const ghostSeen = {};
    for (const dl of [1, 0]) {
      day(dl);
      stand(10.5, 10.5, 0, 0);
      p.torch = false;
      const n0 = talked.length;
      const sprite = !!creatureSprite(game, ghost);
      interact(game);
      ghostSeen[dl] = { sprite, talks: talked.length - n0 };
    }
    expect(!ghostSeen[1].sprite && ghostSeen[1].talks === 0, `at noon with the torch out a ghost is seen (${ghostSeen[1].sprite}) or talks (${ghostSeen[1].talks})`);
    expect(ghostSeen[0].sprite && ghostSeen[0].talks === 1, `at daylight 0 with the torch out a ghost isn't seen (${ghostSeen[0].sprite}) or doesn't talk (${ghostSeen[0].talks})`);
    // On the map, once met: walking into Brann talks only in the dark (at noon he's a cold spot), and the
    // map draws him only then. Underground (no sky) the parent's rule stays: once met, always there.
    ghost.talk.met = true;
    const ghostMap = {};
    const mapGhost = (zone, g, dl) => {
      day(dl);
      game.mode = "map"; game.view = "map";
      stand(g.tx - 0.5, g.ty + 0.5, 0, 0);
      p.torch = false;
      const n0 = talked.length;
      mapStep(game, 1, 0);
      const drawn = !ghostOffMap(game, g);
      game.mode = "explore"; game.view = "3d";
      return { talks: talked.length - n0, drawn };
    };
    ghostMap.noon = mapGhost(sky, ghost, 1); ghostMap.night = mapGhost(sky, ghost, 0);
    expect(ghostMap.noon.talks === 0 && !ghostMap.noon.drawn, `on the map at noon a met ghost talks (${ghostMap.noon.talks}) or is drawn (${ghostMap.noon.drawn})`);
    expect(ghostMap.night.talks === 1 && ghostMap.night.drawn, `on the map at daylight 0 a met ghost doesn't talk (${ghostMap.night.talks}) or isn't drawn (${ghostMap.night.drawn})`);
    {
      const under = field("light-ghost-under", false);
      enterZone(game, under, { how: "start" });
      const g2 = addCreature(under, spawnCreature("brann", 12, 10, FLOOR_Z, { level: 4 }));
      g2.talk.met = true;
      day(1); p.torch = true; const n0 = talked.length; game.mode = "map"; game.view = "map"; stand(11.5, 10.5); mapStep(game, 1, 0);
      ghostMap.underLit = { talks: talked.length - n0, drawn: !ghostOffMap(game, g2) };
      game.mode = "explore"; game.view = "3d";
      expect(ghostMap.underLit.talks === 1 && ghostMap.underLit.drawn, `underground a met ghost on the map with your torch lit: talks ${ghostMap.underLit.talks}, drawn ${ghostMap.underLit.drawn} (the parent's rule: yes)`);
      enterZone(game, sky, { how: "start" });
    }
    sky.creatures.length = 0;
    stats.gate = { plankDrawnNoon: plankFrames[1], plankDrawnNight: plankFrames[0], ghostNoon: ghostSeen[1], ghostNight: ghostSeen[0], ghostMap };

    // --- 3. The other dark-only rules -------------------------------------------------------------------
    // Runes: a rune wall ahead, frames at noon and at daylight 0 (torch out).
    const runes = field("light-runes", true, (z) => { for (let y = 8; y <= 12; y++) for (let k = FLOOR_Z; k < FLOOR_Z + 3; k++) z.set(13, y, k, B.RUNE); });
    enterZone(game, runes, { how: "start" });
    stand(10.5, 10.5, 0, 0); p.torch = false;
    day(1); const runeNoon = frame();
    day(0); const runeNight = frame();
    expect(runeNoon !== runeNight, "runes look the same at noon and at night with the torch out");
    const runesUnder = field("light-runes-under", false, (z) => { for (let y = 8; y <= 12; y++) for (let k = FLOOR_Z; k < FLOOR_Z + 3; k++) z.set(13, y, k, B.RUNE); });
    enterZone(game, runesUnder, { how: "start" });
    stand(10.5, 10.5, 0, 0); p.torch = false;
    day(1); const underNoon = frame();
    day(0); const underNight = frame();
    expect(underNoon === underNight, "underground, daylight changes how runes look");

    // A secret wall's cracks: light shows through only in the dark. A thin stone wall three tiles ahead;
    // marking it secret (no refresh) changes the frame only where the crack light is drawn.
    const cracks = field("light-cracks", true, (z) => { for (let y = 8; y <= 12; y++) for (let k = FLOOR_Z; k < FLOOR_Z + 3; k++) z.set(13, y, k, B.STONE); });
    enterZone(game, cracks, { how: "start" });
    const crackFrames = {};
    for (const dl of [1, 0]) {
      day(dl);
      stand(10.5, 10.5, 0, 0); p.torch = false;
      cracks.secretWalls.add(13 + 10 * cracks.w);
      const withCrack = frame();
      cracks.secretWalls.clear();
      crackFrames[dl] = withCrack !== frame();
    }
    expect(!crackFrames[1] && crackFrames[0], `a secret wall's crack light at noon ${crackFrames[1]}, at daylight 0 ${crackFrames[0]} (want only at daylight 0)`);

    // The Gloom Warden on the sky zone.
    enterZone(game, sky, { how: "start" });
    stand(10.5, 10.5);
    const warden = addCreature(sky, spawnCreature("warden", 13, 10, FLOOR_Z, { rng: () => 0.5, level: 10 }));
    p.torch = false;
    day(1); const touchNoon = touchable(game, warden);
    day(0); const touchNight = touchable(game, warden);
    p.torch = true; const touchLit = touchable(game, warden);
    expect(!touchNoon && touchNight && !touchLit, `the Gloom Warden touchable at noon ${touchNoon}, at night ${touchNight}, by torchlight ${touchLit}`);
    sky.creatures.length = 0;

    // Deep shade: a closed stone room at noon is dark.
    const room = field("light-room", true, (z) => {
      for (let y = 5; y <= 15; y++) for (let x = 5; x <= 15; x++)
        for (let k = FLOOR_Z; k <= FLOOR_Z + 4; k++) if (x === 5 || x === 15 || y === 5 || y === 15 || k === FLOOR_Z + 4) z.set(x, y, k, B.STONE);
    });
    day(1); p.torch = false; game.zone = room;
    const inside = inDark(game, room, 10.5, 10.5, FLOOR_Z + 1), outside = inDark(game, room, 20.5, 20.5, FLOOR_Z + 1);
    expect(inside && !outside, `a closed room at noon: dark inside ${inside}, outside ${outside}`);

    // Perception: a goblin 0.75 of its sight away, you with your torch out.
    const seen = {};
    const spot = (zone, dl) => {
      enterZone(game, zone, { how: "start" });
      day(dl);
      stand(4.5, 10.5);
      p.torch = false; p.sprinting = false;
      const g = addCreature(zone, spawnCreature("goblin", 4 + Math.round(11 * 0.75), 10, FLOOR_Z, { rng: () => 0.5, state: "idle" }));
      g.think = 0;
      updateCreatures(game, 0.001);
      const chase = g.state === "chase";
      zone.creatures.length = 0;
      return chase;
    };
    seen.noon = spot(sky, 1); seen.night = spot(sky, 0); seen.under = spot(field("light-under2", false), 1);
    expect(seen.noon && !seen.night && !seen.under, `a goblin at 0.75 of its sight spots you (torch out): noon ${seen.noon}, night ${seen.night}, underground ${seen.under}`);
    stats.rules = { cracks: crackFrames, runes: runeNoon !== runeNight, runesUnderground: underNoon === underNight, warden: { noon: touchNoon, night: touchNight }, shade: inside, perception: seen };

    // --- 4. lightAt -------------------------------------------------------------------------------------
    const lampZone = field("light-lamp", true, (z) => z.set(10, 10, FLOOR_Z + 3, B.LAMP));
    game.zone = lampZone;
    day(1); const a = lightAt(game, lampZone, 10.5, 11.5, FLOOR_Z + 1);
    day(0.5); const b = lightAt(game, lampZone, 10.5, 11.5, FLOOR_Z + 1);
    expect(a.sky > 0 && Math.abs(b.sky - a.sky * 0.5) < 1e-9 && a.lamp > 0 && b.lamp === a.lamp, `lightAt: sky ${a.sky} → ${b.sky} at half daylight, lamp ${a.lamp} → ${b.lamp}`);
    stats.lightAt = { sky: +a.sky.toFixed(3), lamp: +a.lamp.toFixed(3) };
  } finally {
    undoDay();
    game.onTalk = onTalk; game.log = log;
  }
  return { name: "light", ok: problems.length === 0, problems, stats };
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-light.mjs gives.
export async function run(env) {
  const { frameHash } = await env.screen();
  const { game, startRun } = await env.src("game.js");
  const { render3d } = await env.src("render3d.js");
  const { generateDungeonLevel, legacyParams } = await env.src("gen/dungeon.js");
  const dungeonLevel = () => generateDungeonLevel(4242, legacyParams(3, 4242)).seal();
  return checkLight({ game, startRun, render3d, frameHash, dungeonLevel });
}
