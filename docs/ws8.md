# WS8: combat depth, AI and targeting

Phase 1 workstream (TECH_DESIGN §8.3 "WS8", with DECISIONS: combat is **d20**, bible §10.6 and §15.6). Worktree
`C:\Users\Otto Mörner\Code\gnomon-wt\ws8`, branch `ws/ws8`, from `p0-done`. Files (§8.4): `combat.js`, `ai.js`,
`creatures.js`, `turns.js`, `throwing.js`, `missiles.js`, `screens/target.js`, `content/items/missiles.js`,
`tools/check-combat.mjs`, `tests/checks/combat.js`; new: `tools/browser-ws8.mjs`. Gate numbers, deviations and the
verification: `docs/sessions/ws8.md`.

Everything new that changes how the game plays is either new content (missile weapons, followers) or behind the
**d20 set**: under `RULES.combat = "legacy"` (still the default until the integrator's flip, §8.5) the map's T throws
as the parent did, nothing flees, and the log keeps the parent's lines, so golden, the screen frames and the legacy
fights match. L (look), V (missile weapons), Shift + direction, followers, the Plane's movement, catch-up on
re-entry, followers and hunters over an edge, and the 3D activity radius work under both sets.

## Public API

### Targeting and looking (`screens/target.js`): for WS4, WS5, WS7

```js
// MODE = "target": a screen over the map (pausesTime). Keys: arrows / WASD / numpad move the cursor (Shift: 4 tiles),
// Tab / Shift+Tab cycle what you can see (foes first, then the nearest), Enter / Space / E / a left click confirm, and so
// does the key that opened it (T, V, L: pressing it twice acts on the default target); Esc or a right click cancel.
// The mouse moves the cursor (hover). The header names what you're doing; the last row the creature, your hit chance
// (d20 with the aimed bonus for a projectile, your weapon's for a look), the distance and what's in the way.
openTarget(game, { purpose: "look" | "throw" | "missile" | "ability", range, verb, item, spec, flight, done }) → true
//   In 3D (not on the map) done(game, aimTarget(game, range)) at once. done(game, target | null) when confirmed or
//   cancelled. flight(game, target) → a pretend projectile (throwing.js ballisticFrom): the line of fire is its exact
//   flight (throwing.js flightOf); without it a straight line, red past the first wall.
//   target = { creature, point: { x, y, z }, tile: { x, y }, dir: [dx, dy, 0] }   (abilities.js aimTarget's shape)
requestTarget(game, ability, done)   // abilities.js's seam with the screen behind it: in 3D done(aimTarget) at once,
                                     // on the map done(target | null) later (see Integration requests 1). An
                                     // AbilityDef may add spec(game, e) → a combat spec: the screen shows its hit chance
look(game)                           // L: map → the look cursor; 3D → the crosshair at once. Both emit
                                     // inspect { zone, x, y, z, creature?, item?, block?, open: true } and log lookLine
lookLine(game, payload) → string     // "A goblin, level 3, out for you, 75% to hit with your weapon. Weak to fire."
cursorTarget(game) → target | null   // what the open screen points at;  targetText(game) → { top, bottom } (its two rows)
lineOfFire(game, data) → { tiles: [{ x, y, state }], end: "clear" | "interposed" | "blocked" | "far", hit }
```

WS5's examine screen opens on `inspect` with `open: true` (from L in either view, as before from nothing); WS7's
murals are learned from `inspect` (the look cursor's, or the map's held hover with `open: false`, P0).

### Spatial queries (`creatures.js`): for WS6a's witnesses

```js
creaturesNear(zone, x, y, r) → c[]                  // P0: 8×8 buckets during an AI update, a scan outside it
nearestCreature(zone, x, y, r, ok = () => true) → c | null
sees(game, c, e) → bool                             // c sees e (you or a creature): its sight (people 10), line of sight
                                                    // eye to eye; for you the parent's torch/daylight/shadows/stealth rules
                                                    // (light.js inDark), and pressed flat you're seen only by flat things;
                                                    // ghosts the light hides and things across the plane are never seen
witnessesOf(game, e, r = 12) → c[]                  // everyone (people too) within r who sees e
creaturesAlong(zone, x0, y0, z0, x1, y1, z1, { pad = 0.15, skip }) → [{ c, t }]   // bodies a segment passes, nearest first
eyesOf(e), bodyMid(e) → z
touchesYou(game, attacker) → bool                   // not while you're flat and it isn't (blows, arrows, splashes)
```

### The AI (`ai.js`)

```js
recruit(game, c, leader = game.player) → c   // c.brain.leader = "player" | id: it follows, fights its leader's side
                                             // (WS6b's Kindling recruits through this)
dismiss(game, c) → c                         // it stops following: factions.js attitude decides again (the P0
                                             // stub: a monster is out for you at once)
leaderOf(game, c) → entity | null            fleeLevel(c) → share of health it runs below (0: never)
AI_RULES = RULES.ai = { foeRange 8, foeForget 3, lose 8, outdoorRadius 32,
  flee: { recover 0.5, forget 6, most 10, brave 15, byType: { rat, bat, goblin, archer, spider, orc, salamander } },
  wary: { keep 3, watch 8 }, follow: { near 2, far 5 }, chaseEdge 3, heal: { fullAfter 3600 }, ability: { every 0.5 } }
```

- **States** (`c.state`, saved): `idle`, `wander`, `chase` (hunting you), `flee`. **Brain** (`c.brain`, saved): `target`,
  `grudges`, `hurtBy`, `leader`, `wary` (factions.js attitude "wary": it watches you from within 8 tiles and keeps 3
  away, never striking first), `fleeFrom`/`fleeT`/`fleeLeft` and `braveT` (fleeing: it runs from what hurts it under
  `fleeLevel`, until healed to half, out of its foe's sight for 6 s, or 10 s at most; cornered or run out it turns
  at bay for 15 s), `arriving` (seconds until it comes into this zone after you: hidden, untouchable, not acting).
  A type's `flee` (a share) says how cowardly it is; under the d20 set `RULES.ai.flee.byType` gives the parent's
  living creatures one, and the legacy set none (no new random draws either: the legacy fights match).
- **Abilities**: a creature with abilities (`c.innate`, or its gear's) tries each ready one every 0.5 s when
  `def.ai.when(game, c, target)` is true; `use(game, c, lvl, target)` gets `{ creature, point, tile, dir }` with
  `creature` what it fights, **you included** (WS4: an ability's `use` must expect the player as a target). `when` is
  asked with `target` null when the creature fights nothing (an ability on itself can still say yes).
- **Zone changes** (§5.1): `zone:leave` takes along every follower of yours in the zone (over an edge, by the stairs,
  or on WS1's world-map travel, `how: "travel"`) and, over an edge, whatever hunts you within 3 tiles of the exit (not guardians, bosses, statues or the rooted), out of the zone you leave
  before write-behind snapshots it; `zone:enter` puts them in at the border you crossed (the stairs: beside you),
  `arriving` for as long as their way to you took (at most 4 s). A zone you come back to (`away` s later, not a load)
  catches up: statuses (status.js catchUpStatuses), healing (all of it after an hour), hunts and targets lapse; bosses
  and guardians only run out their statuses (a set fight: they neither heal nor forget you); things in flight, lit
  bombs and gas wait for you, as they always did.
- **The activity radius**: in 3D a surface zone updates only creatures within 32 tiles (or hunting, fleeing,
  following, after a target); dungeons every creature; the map 12 (turns.js, unchanged).

### Combat (`combat.js`)

```js
combatLine(game, result, spec, ctx) → string   // the d20 log line (TECH_DESIGN §3.1 step 6), one format in both views:
//   You hit the goblin for 5. · You hit the goblin (x2) for 10. · You slay the goblin (x2, 10). · You miss the goblin.
//   Your bolt hits the goblin for 4. · The goblin's hide turns your blow. · The goblin hits you (x2) for 8.
//   The goblin misses you. · Your armour turns the goblin's blow. · The orc hits the goblin for 3. (only where you see it)
// A spec may carry noun ("bolt") and onHit(game, tgt, result) (after a d20 blow that hurt and didn't kill).
// hitPlayer(game, m, dmg, source, blocked, ranged, rng, soaked, crit = null): crit null keeps the parent's line.
// playerMelee: something hostile first; at anyone else (your follower, a neutral) the first swing holds back and a
// second within 2 s strikes (Appendix B; the map's Shift + direction).
```

### Throws, missile weapons and the map (`throwing.js`, `missiles.js`, `turns.js`, `content/items/missiles.js`)

```js
// throwing.js
ballistic(sx, sy, sz, tx, ty, tz, speed, gravity) → { vx, vy, vz, time }   aimPoint(game, target) → { x, y, z }
launch(game, it, from, to, { speed, gravity, extra }) → projectile           throwAt(game, stack, target) → projectile | null
flightOf(game, pr, { maxT = 3 }) → { t, x, y, z, creature, stop, path }      finishFlight(game, pr, seconds)
ballisticFrom(game, target, speed, gravity) → pretend projectile             THROW_AIM.aim (filled by screens/target.js)
landOutside(game, item, x, y) → patch | null      // a thing that came down past an open edge or corner waits there:
PATCH_OPS.landItem   // { op: "landItem", item, ox, oy } (ox, oy from that zone's west/north edges, or negative from east/south)
// missiles.js
readyLauncher(p), ammoFor(p, launcher), missileSpec(p, launcher), fire(game), aimFire(game), fireAt(game, launcher, target)
// the "pinned" status (noMove), the HUD segment "missile" ("V: bolt-bow x12 0.4s"), V bound in explore and map
// content/items/missiles.js
MISSILES = { sling, boltBow }   AMMO = { bolt }   kinds "missile" { id, ench } and "ammo" { effect, count }
// turns.js
mapStep(game, dx, dy, { force = shiftHeld() })   shiftHeld()   planeHeight(game, x, y, z)
```

- **A missile weapon is carried in the pack, not held** (V fires the ready one): `player.js` attackTime/weaponReach,
  `hud.js`'s weapon drawing and `inventory.js` read `WEAPONS[wielded.id]` for whatever the hand holds, so a launcher
  in the hand would break them. A shot's d20 damage is its range + material + enchantment (no STR); it reloads as the
  cooldown `"missile"` (game seconds, both views); the sling's stones are free, the bolt-bow's bolts are spent and
  drop where they land unless they break (30%).
- **Pressed flat** (bible §10.2, DECISIONS "its movement rules are WS8's"): on the map chasms, pits and deep water are
  floor at your height, ledges within 2 blocks up or down are floor, you slide under closed doors and gates (locked
  too), walls stop you, levers and the like stand out of the Plane; you talk only to flat people; you strike and are
  struck only by flat things; deep things' arrows, splashes, blasts and gas pass over you, and a deep hunter loses you.
- **Walking into a creature on the map**: hostile → attack; your follower → you swap places; anything else → "in
  your way" (Shift + direction attacks it).

### Keys (§4.3)

`L` (map, explore): look. `V` (map, explore): fire the missile weapon. `Shift` + direction (map): attack anyway. On
the target screen: as above. (T on the map opens the target screen under the d20 set.)

## Integration requests

1. **`abilities.js` (WS4):** route the map's target through the screen, which answers later:
   ```js
   import { requestTarget as targetScreen } from "./screens/target.js";
   export function requestTarget(game, ability, done) {
     if (game.view !== "map") { done(aimTarget(game, ability?.range || REQUEST_RANGE)); return; }
     targetScreen(game, ability, done);   // the target screen: done(target | null) on confirm or cancel
   }
   // useAbility: continue in the callback on the map
   const go = (target) => { if (!activate(game, e, id, target)) return false; if (onMap && def.mapTime > 0) mapUseTime(game, def.mapTime); return true; };
   if (def.target === "self") return go(null);
   if (onMap && e === game.player) { requestTarget(game, def, (t) => { if (t) go(t); }); return false; }
   let target = null; requestTarget(game, def, (t) => { target = t; }); return go(target);
   ```
   `check-abilities` §5 then drives the screen (Enter) instead of expecting an answer at once. Also: an ability's
   `use(game, e, lvl, target)` may get the player as `target.creature` when a creature uses it (ai.js).
2. **`factions.js` (WS6a):** a creature hostile to you is hostile to your followers too (`attitude(a, f)` where
   `f.brain.leader === "player"`: "hostile" when `attitude(a, player)` is). Today monsters ignore your followers until
   one strikes them (then a grudge).
3. **`traps.js` (WS10):** spikes rise through a flat player harmlessly (bible §10.2): `updateSpikes` should skip you
   when `!touchesYou(game, null)` (creatures.js).
4. **`monsters.js` (the integrator; §8.4 names no owner):** `pushPlayerOut` should skip creatures with
   `brain.arriving > 0` (hidden, still on their way in: today one could nudge you for up to 4 s at a zone's border).
5. **`renderMap.js` (WS3):** "L: look · V: fire" in the map header if it fits (the T hint is there); the legend's `)`
   row could say "weapon (missile weapons and bolts in wood colours)". (Missile weapons and bolts use `)`, bible §15.7's
   weapon glyph.) Followers are drawn tinted toward cyan by `turns.js refreshView`'s
   sighting colour; WS3 may prefer its own ally overlay.
6. **`tests/checks/content.js` and `tests/checks/body.js` (frozen, P0's):** each lists a sample of every registered
   item kind and fails without one, so this branch added the `missile` and `ammo` samples (one line each, `// WS8`);
   0D2.md §6 says a new kind adds its sample. Keep them at the merge.
7. **`tools/README.md` (the integrator):** check-combat's parts (`--only combat,targeting,ai,arena,ttk`, `--runs`)
   and `--perf [--seconds 40] [--against <root>]`; `tools/browser-ws8.mjs` (serve with `node tools/serve.mjs 8648`).
   §8.4: `tools/browser-ws8.mjs` as WS8's.
8. **`stats.js` `BONUS_KEYS` (the integrator, for WS4):** a key such as `missileAcc` if WS4's *Steady hand* ("+2 to hit
   with slings and bolt-bows", bible §10.8) wants one; `missileSpec` would add `bonus(p, "missileAcc")` to `acc`.
9. **The flip (§8.5, the integrator):** `RULES.combat = "d20"` turns on the map's targeted throw, fleeing and the d20
   log; check-legacyfights then needs `overrideRules("combat", "legacy")` around its fights (its fixture is the
   parent's). The TTK tables (`node tools/check-combat.mjs --only ttk`) are the balance reference: see
   `docs/sessions/ws8.md` §3 for what they say about tiers 5-8.
10. `check-legacyfights` doesn't cover a creature hitting a creature under the legacy set: not needed for WS8 (the
    legacy set's creature-on-creature branch has no parent counterpart to compare with, and WS8 didn't change it).
11. **`stats.js` and `abilities.js` (the integrator, WS4):** P0 gives `innate` two meanings: `stats.js` reads a creature's
    `innate` as its own bonus table (`{ dv: 20 }` in check-combat), `abilities.js` reads it as a list of ability ids
    (the player's `["foldStep"]`, which `stats.js` then adds up as a bonus table with a key `"0"`). One of them should
    take another name (`c.bonuses`, or `e.abilities`). ai.js asks for abilities only when `innate` is a list.

## Handoff

(Filled in at the end of the workstream; see below.)
