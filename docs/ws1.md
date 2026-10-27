# WS1: overworld travel

Phase 1 workstream (TECH_DESIGN §8.3 "WS1", §5.2; bible §4.1, §4.6, §4.9, §15.6; DECISIONS: the world is 42 × 21 and a
world tile is a **span**, one world hour is 60 s of game time, Z waits until dawn, noon, dusk, midnight, healed or N
hours, the torch drains glim at night, the run modes `oneWick` / `commonsLamp` / `pilgrim`, no §15.11 words).
Worktree `C:\Users\Otto Mörner\Code\gnomon-wt\ws1`, branch `ws/ws1`, from `p0-done`. Files (§8.4): `src/overworld/*`
(`index.js`, `state.js` and `lost.js` new), `screens/worldmap.js`, `content/encounters.js`, `tools/check-world.mjs`,
`tools/check-overworld.mjs`, `tests/checks/overworld.js`, `tests/checks/world.js` (given to WS1 by
`tests/checks/index.js`), and the new `tools/browser-ws1.mjs`. Gate numbers, deviations and the verification:
`docs/sessions/ws1.md`.

**The old game is untouched.** Nothing runs until you press O or Z (both keys were free; TECH_DESIGN §4.3 gives them to
WS1). What the parent's game newly sees: `game.state.atlas` (what you know of the world) is made on the first zone
entry and saved with the slot; the start span is visited and its sites paid without XP, so no level, HP or frame of the
legacy campaign under (0, 0) moves (golden, legacy fights and the recorded frames hold; check-save's round trips hold).

## How it plays

- **O** (either view, on a surface zone, not lost, no hostile awake within 12 tiles): the world map. Every span's
  terrain is common knowledge; its landmarks and sites show once you know of them. You are `@`.
- **Steps:** arrows / WASD / the numpad (7 9 1 3 and Home PgUp End PgDn for the diagonals). A step costs the span's
  `travelHours` (3 along a road edge, bible "roads stay roads"), +25% at night off roads, ÷ (1 + bonus(travel)), and
  passes through `skipTime` (R10). No zone is simulated or made while you travel.
- **Getting lost:** the span's lost chance, × 2 at night, × 0.25 in a terrain you have Terrain lore for, − 0.02 a point
  of INT modifier, − bonus(navigation), − 0.10 flying; 0 along a road or river and onto a road span. Lost drops you
  into the span's zone at a random reachable spot with the status `lost` (HUD "LOST"; the world map stays shut). Ways
  back: a road span, or a zone you knew before you got lost, at once; each new zone 25% (50% with Homing sense); in
  3D only, bearings from height (6 blocks up, look round half a turn over 2 s: 30%, once a zone); the Gnomon in sight
  (10%, once a zone, WS3's `gnomonDrawn`); "Which way am I?" to anyone you can talk to; a world day at most.
- **Encounters** (span's region × terrain rate, × 1.5 at night): a hostile band (you are taken down into the span's
  zone, visited or not, and it waits 8-12 tiles from where you arrive), travellers (a rumour of a site near by, pinned,
  or the spans around revealed; you stay on the map), a legend away from its lair. **Hidden sites:** each step rolls
  10% (20% with Keen Eye) for each undiscovered site of the span you enter: "Smoke rises from a fold in the land. Stop
  and look?" Yes takes you down at it; no records nothing.
- **A span 2+ tiers above yours** asks first (bible §15.6 "the warning").
- **Fast travel:** a click on a span you know the way to (the path shows under the pointer): roads, rivers and spans
  you have visited only; encounters × 0.25; never lost; no hidden sites.
- **Down:** Enter at the edge (a corner after a diagonal) you came in through, facing the way you went, or, when you
  know sites on the span, at one of them; Esc at the edge; unmoved, where you stood.
- **Z** (either view, or on the world map): wait until healed, dawn, noon, dusk, midnight, or 1, 2, 4 or 8 hours, hour
  by hour through `skipTime`; one encounter roll a whole hour at half the rate (a band 8-12 tiles from you; on the
  world map you are taken down first); the torch is snuffed while you wait unless T keeps it lit. F on the world map is
  the torch; T tints the spans by tier; a right click pins or unpins a span.
- **Discovery XP:** the first visit (entering its span's zone, in either view, or a level under it) to a landmark
  gives 0.3 of one level's XP at its level, any other site but a village 0.1 (villages pay their own, WS7b); the start
  span nothing. Through `gainXp(game, n, { source: "discovery" })`, so Pilgrim's ×2.2 applies where WS4's reads it.

## Public API

```js
// overworld/index.js re-exports all of these.
enterWorldMap(game, { viewOnly, center }) → { ok, why }      // travel.js; viewOnly: look only (the journal)
worldStep(game, dx, dy, { confirm, fast, drop = true }) → { ok, why?, confirm?, from, to, hours, seconds, lost,
          encounter, site, dropped, dead, chance: { lost, encounter } }
          // emits "world:step" { from, to: { wx, wy }, seconds, lost, encounter: kind | null }
fastTravel(game, { wx, wy }, { confirm }) → { ok, why?, confirm?, steps, seconds, path, stopped }
leaveWorldMap(game, { at: "edge" | "center" | "site" | "lost", siteId }) → true | Promise (a zone read from the save)
travelPath(game, from, to) → [{ wx, wy }] | null · stepHours(game, from, to, edge) → hours · answer(game, yes)
dropInto(game, encounter) → true | Promise   // down at the edge, then the band or legend placed into the zone you
          // are then in (8-12 tiles from where you arrive, also when that is the zone you opened the map from)
rest(game, { until: "healed" | "dawn" | "noon" | "dusk" | "midnight" | seconds, keepLit }) → { elapsed, interrupted,
     why: null | "until" | "hostile" | "encounter" | "dead", encounter }                              // rest.js
waitChoices(game) → [{ id, label, until }]
reveal(game, wx, wy, radius = 0) → n · isKnown(game, wx, wy) · pin(game, wx, wy, { label, secretId }) → pin
unpin(game, id) · pinsAt(game, wx, wy) · knownSites(game, wx, wy) · visit(game, wx, wy) · discoveryXp(game, site)
     // discovery.js; emits "discover" { kind, id, at, how } once a site
isLost(game) · lostChance(game, to, edge, { fast, learn, flying }) · findBearings(game, line)    // lost.js
     // flying: as you set out (worldStep reads it before the hours pass)
encounterChance(game, tile, { fast, rest }) · rollEncounter(game, at, opts) · placeEncounter(game, key, enc)
atlas(game) · canStep(world, from, dx, dy) → reason | null                                        // state.js
renderWorld(game) · worldView · spanAtCell(cell)                                                  // renderWorld.js
// screens/worldmap.js
MODE = "world" · WAIT_MODE = "wait" · openWorldMap(game, { center }) · openWait(game)
```

- **Saved state:** `game.state.atlas = { visited, revealed, found, paid, pins, lore, lost, n }` (JSON only).
  `state.world` was already the world's `{ id, version }` (game.js `startRun`), so TECH_DESIGN §2.17's
  `world: { visited, revealed, pins }` lives under `atlas`. `n` counts the travel stream's rolls
  (`hashFloat(seed, "travel", n)`), so a load rolls on where the save left off. The world screen isn't `saveable`:
  a save waits until you are back in a view.
- **The journey** is `game.trip` (runtime, never saved). Going down clears it; any other zone entry (a new run, a
  load) clears one left behind, and a death on the road clears it, so a later Z never rests "on the world map".
- **RULES.overworld** (`state.js`): every number above, and `xp: { landmark: 0.3, site: 0.1 }`, read only where
  `RULES.progression.xp.rewards` (WS4's) doesn't name the kind.
- **Zone patches:** `{ op: "band", types, elite, level?, state? }` (registered in `PATCH_OPS` by encounters.js); a
  legend is WS10's `{ op: "spawnCreature", uid, type: def.species, level: def.level, name }`.
- **Content:** `content/encounters.js ENCOUNTERS = { kinds, regions: { [region]: { kinds?, creatures? } }, band,
  travellers, legend, lines }` (C3 fills `regions` and the lines).

## Integration requests

1. **WS7 (`story/secrets.js`): nothing to apply.** `learnSecret` already calls `discovery.pin(game, wx, wy, { label,
   secretId })` once `discovery.STUB` is gone, which it is now. `pin` keeps one pin per secret and makes the span known;
   `world:step`'s `to` is `{ wx, wy }`, as the visit and find quests read it. Check at the merge that a location secret
   learned shows its pin on the world map (`pinsAt`).
2. **WS7 (`screens/journal.js`, Locations tab):** a key (and a click) that calls
   `openWorldMap(game, { center: { wx, wy } })` (`screens/worldmap.js`): the world map to look at, centred on the
   span, from anywhere (underground too); the keys move the cursor, Esc or a click on "Esc: close" goes back to the
   journal (it is pushed over it). Tested in `tools/browser-ws1.mjs` part 3.
3. **WS4 (`content/powers.js`):** drop `needs: "WS1"` from `keenEyeSites` (hidden sites 20%: read as
   `perkRank(p, "keenEyeSites")`), `pathfinder` (its `bonus: { travel: 0.5 }`: a step's hours ÷ 1.5), `terrainLore`
   (`perkRank(p, "terrainLore")`: as many terrains as ranks, each the first lossy terrain you travel onto after taking
   it, −75%) and `homingSense` (`perkRank(p, "homingSense")`: 50% a new zone). WS4b #22: Wings's `bonus(travel) = 1`
   is read as hours ÷ (1 + travel), × 2 speed as the bible has it.
4. **WS4 (`leveling.js` RULES.progression.xp.rewards):** add `site: 0.1` beside `landmark: 0.3` if the progression
   table should hold every reward (discovery.js reads it first; until then RULES.overworld.xp.site).
5. **The integrator (`tools/browser-0d1.mjs`):** its mode tour must reach the two new screens, or it fails "modes
   never reached: world, wait". This block, placed just before the factions screen's (after the target screen's), was
   run on a scratch merge of `ws/ws1` into `origin/integration` (`p2-ws7b`): 25 of 25 modes reached, golden (b) 27 of 27:
   ```js
       // The world map and the wait menu (WS1's): O on the map opens the world map, Esc closes it, and again a click on
       // its "Esc: back"; Z opens the wait menu, Esc closes it, and again a right click.
       if ((await mode()) === "map") for (const how of ["keys", "mouse"]) {
         for (const [code, want, close] of [["KeyO", "world", "Esc: back"], ["KeyZ", "wait", null]]) {
           await page.keyboard.press(code);
           await frames(page, 2);
           const opened = await mode();
           if (opened !== want) { problems.push(`${want} by ${how}: ${code.slice(3)} on the map led to ${opened}, not ${want}`); continue; }
           reached.add(want);
           if (how === "keys") await page.keyboard.press("Escape");
           else if (close) await click(close);
           else { const c = await page.evaluate(() => { const r = document.getElementById("screen").getBoundingClientRect(); return { x: r.left + 5, y: r.top + 5 }; }); await page.mouse.click(c.x, c.y, { button: "right" }); }
           await frames(page, 2);
           const closed = await mode();
           if (closed !== "map") problems.push(`${want} by ${how}: ${how === "keys" ? "Esc" : close ? `a click on ${close}` : "a right click"} led to ${closed}, not back to the map`);
         }
       }
   ```
6. **The integrator (`torch.js`):** on the world map the torch burns by the zone you left (`clock:tick` reads
   `game.zone`), so travelling the Shade by day costs nothing. `darkSeconds` could read the span under
   `game.trip` (`{ wx, wy }`) while it is set: its terrain's `dark`, else night. Small; not done here (not my file).
7. **The integrator (`rules.js` RULES.cooldown.restClears):** 3600 s is 60 world hours since DECISIONS made a world
   hour 60 s of game time; "a rest of an hour clears the second wind and first block" wants 60. Unchanged here (a
   frozen file); WS1's rest passes `reason: "rest"`, so the fix is the number alone.
8. **WS9 (the pause card's key list):** O "world map" and Z "wait" beside L, V, `,`, 1 and P. The world screen is not
   `saveable` (a save waits for a view); `state.atlas` rides in `slot.state` with no codec work.
9. **C1 / C3 (content):** the Hush Stair (bible §4.7: (19..21, 4) crossable at 8 hours each at night with the lamp out,
   once its dark reading is known) needs a span field the world data doesn't have yet (`nightPass: { hours, secret }`
   on the three spans: `canStep` and `stepHours` would read it); landmarks' `visibleFrom` (all 0 now, so a landmark
   shows once you stand on its span on the world map, enter its zone, or are told of it; `sight` reads the field); regions' `encounterRate`
   and `ENCOUNTERS.regions[r].creatures` (C3); the Drover caravans and the homing pip (bible §4.9) are services and
   items, not travel rules: `fastTravel` is what they would call.
10. **WS3 (information):** the Hand's caravans (bible §4.8: 25% a step onto a span under the Hand) wait for
    `clock.handAt`; `lost.js` already reads `render3d.gnomonDrawn` through a namespace import, so the Gnomon in sight
    works once WS3's is merged.
11. **WS10 (#7, information):** a legend met on the road is the patch you asked for, rolled only while
    `uidWhere(uid)` is null (placed nowhere, alive) and its lair is not on that span; once met, its lair's `claimUid`
    fails (check-overworld "encounter bands"). Recheck at the merge that the lair generated afterwards is empty of it.
12. **`tests/checks/world.js` at the merge:** `main` holds two approved edits to this file (WS10's `historicRule` in
    `siteRules`, WS7a's history line and its import). WS1 didn't touch `siteRules` or the imports above its own: it adds
    one import line (`canStep`, marked `// WS1`), one line in `checkWorld` (`const travel = checkTravel(problems);`
    and `travel` in the stats) and the function `checkTravel` after `checkWorld`, plus header section 5. Take
    `main`'s file and add those three pieces; nothing overlaps.

## Handoff

**Done:** tag `p1-ws1` on `ws/ws1` (the commit after this file's last change). `node tools/run-all.mjs` 37 of 37;
every §8.3 item with its numbers in `docs/sessions/ws1.md`; one independent verification (8 bugs, 9 check gaps, 3
text items) and its recheck (2 more), all fixed, one commit each.

**For the integrator** (§8.5 puts WS1 last): merge `p1-ws1`. Expect one conflict, the two import lines at the top of
`tests/checks/world.js` (request 12: keep both). Then apply requests 2 (the journal's key), 3 and 4 (WS4's `needs`
and `site` reward), 5 (`browser-0d1`'s tour, or it fails "modes never reached: world, wait"), 6 and 7 (torch.js,
restClears) as you judge, and carry 8-10. A scratch merge into `p2-ws7b` was tested (`docs/sessions/ws1.md` §2, §5):
the legend chain through a real lair, the secret's pin, Pilgrim's × 2.2 and the browser tools all pass there.

**Nothing is half finished.** Nothing waits on the user.
