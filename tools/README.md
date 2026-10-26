# Tools

Node-only scripts for checking the game. They need **Node 20 or newer** and nothing else: no npm packages. The
`package.json` at the repository root only declares `"type": "module"`, so Node loads `src/*.js` as ES modules.

Run everything with:

```
node tools/run-all.mjs            (or: --only golden,zones)
```

It runs every `check-*.mjs` in this folder, each in its own Node process, and exits non-zero if any fails. The check
logic lives in `tests/checks/*.js` as pure functions returning `{ name, ok, problems, stats }`, so a browser page can run
them too; the `check-*.mjs` files only load inputs and print the result.

| Tool | What it does |
|---|---|
| `node-env.mjs` | The headless environment the other tools use: stub screen and input backends (the frame lands in a capture buffer), an in-memory `localStorage`, and a seedable `Math.random`. Sound stays off by itself (`audio.js` needs `window`). It also works against an old copy of `src/`. |
| `golden-record.mjs` | Recorded the golden fixtures in `tests/fixtures/golden/` from the parent game's code (commit `75edbd3`). Run it only against that code: `--src DIR` points it at an exported copy, `--out DIR` writes elsewhere. |
| `check-golden.mjs` | Replays the golden scenarios (`tests/golden/scenarios.js`) through today's API (`tests/golden/current-api.js`) and compares: mechanics trace, frame hashes, dungeon levels 2-20, vault stamps, the temple. `--only mechanics,frames`. |
| `check-dungeons.mjs` | 1,000 legacy levels (50 seeds × 20) pass `validateDungeonLevel`, guardian halls are complete, generation p95 ≤ 40 ms; `stampVault`'s options and the legend registry work; and the parameter contract's edges hold (`legacyParams` needs the run seed, a level validated without its `p` gets the same verdict, the `p` parts WS10 hasn't built throw). `--seeds N`, `--budget MS`. |
| `check-determinism.mjs` | The same seed gives the same level (blocks, items, creatures, people, layout), and a static scan of the generation code: no `Math.random`, no `Math.hypot`, no random-comparator sorts, and (from 0A2) no `Math.sin/cos/tan/exp/pow/atan2` (0A2 turned the temple into a plan, so nothing is exempt). It scans `gen/`, `world/`, `story/`, `content/world/` and `content/currency.js`. From 0A2 also the run and surfaces: `buildRun` twice per seed on both worlds (the second on a freshly compiled world) serializes the same; every landmark span of both worlds and 12 random test-world spans per seed generate the same on both runs (blocks, items, creatures, entrance, `dungeonRect`, edges, `zone.gen`), as do their apron bands from the world functions; the cached world functions agree with the uncached `heightAt`/`treeAt`/`portsOf`; the ruin's levels generate the same twice. Creatures carry no uid until 0C, so it notes that the uid comparison isn't exercised yet. |
| `check-blocks.mjs` | Block ids are append-only against `tests/fixtures/block-ids.json`; a block's `map` glyph is never one the bible's glyph registry (§15.7) gives to an item, a feature or a creature family. |
| `check-zones.mjs` | The zone core: `Zone`, `zones.js` (changes, events, patches, uids, arrival, derived-array LRU), `events.js`, on the legacy site and a synthetic 80×48×16 surface zone; falls (holes and the potion of descent) shift by a surface's `dungeonRect`. |
| `check-bot.mjs` | Runs `bot.mjs` in both views on two seeds, and its edge walk on both. |
| `check-stats.mjs` | The stat bus and the 0B gate (`tests/checks/stats.js`). `RULES` is frozen, `extendRules` adds a namespace once, `overrideRules` undoes. In both formula sets (`legacy`, `attributes`): every piece of gear (95: every weapon, armour, ring, amulet and property at −2/0/+2, every relic) put on and taken off, every registered status (`flat` included) added and removed, every perk rank taken, under `STATS_DEBUG.verify` (every `bonus()` rebuilds and compares the cache): the numbers equal the formulas worked out from the raw tables and come back exactly; then every item on every part it fits through `body.equip`/`unequip` (300). No base-field writes: the real inventory code (125 equips and swaps) on a player behind `guardBaseFields`. The attribute formulas at their reference points. Golden (a) with the cache verified and base writes watched (only the 8 permanent ones). And the rest of the gate, reported in `gate`: golden (a) replayed by the bot through the map's and the 3D view's controls (`bot.mjs` `runGoldenA`), `skipTime(600)` against 1/60 s stepping and drowning on the map and in 3D (check-status's numbers), golden (b) (the 27 frames). |
| `check-status.mjs` | Statuses and bulk time (`tests/checks/status.js`): no parent timer field left in `src/`; `skipTime(600)` equals stepping 1/60 s at a time within ±1 HP and ±0.1 s (poison with regeneration and cooldowns, poison against regeneration at full health, a draining cursed ring, deadly poison, natural regeneration, creatures burning and poisoned); `skipTime` stops for a hostile awake nearby and on `until()`, an hour's rest clears the cooldowns, 8 game hours take ≤ 20 ms; drowning in surface deep water the same on the map and in 3D (breath, hits, damage, the tile where it ends), not for a swimmer; `flat` forces the map, locks Tab, shows on the HUD. |
| `check-body.mjs` | Bodies and the item kind registry (`tests/checks/body.js`): every kind the game makes is registered and answers every query; stacks and `takeOne`; the humanoid and beast plans; every piece of gear on every part it fits, cursed refusals, two rings, implants, two-handed weapons, extra limbs; `swapBelt`; no parent gear field (`.weapon`, `.armour`, `.ring`, `.amulet`, `.sidearm`) left in `src/`. |
| `check-currency.mjs` | Money (`tests/checks/currency.js`): `funds`/`pay`/`receive` on a bare entity (all or nothing; the overflow comes back), the purses 200/500/1,000 (`setPurse` refuses other sizes), `formatPrice` from `CURRENCY`; a new player has no glim and the starting purse; a pile walked over with a nearly full purse leaves the rest lying (told once), on the map and in 3D; the shop by key presses (refused when poor, the price after the Haggler, a crystal absorbed, selling refused into a full purse, a service); a shrine offering; a reward that overflows the purse lands on the ground as cash; no `gold` field, pile or price text left in `src/`, and the legacy levels lay `cash`, never `gold`. |
| `check-edges.mjs` | Zone edges (TECH_DESIGN §5.1, §6.1): the seam rules (a)-(e) on every open edge of every landmark span and 200 random neighbour pairs on seeds 1, 42 and 1234 of the test world (plus the real world's landmark spans on seed 42): ground equal to the world function on both border columns, ports the same from both sides and laid by both zones, no step over 1 without a cliff, trees across an edge whole in both zones, nothing but the world function within 2 tiles of an open edge, per-run sites 6 tiles in; the apron band built from the world functions against a copy of the real neighbour next to the seam; and arrival from every standable border tile, both ways, within ±1 and never shifted (the share on the mirrored tile is reported). `--pairs N`, `--seeds a,b`, `--real false`. |
| `check-world.mjs` | The world model and the run: the test world and the real world validate (and broken worlds are refused); the real world equals WORLD_BIBLE §15 (map, letters, counts, tier grid, paths, terrains, landmark dungeons); travel, edges and edge ids per span; `buildRun` → `serializeRun` → `restoreRun` deep-equal on 5 seeds per world, with a spy proving the load path never builds; sites deterministic per seed and placed by the rules (one free span apart, 6 tiles from zone edges). |
| `check-landmarks.mjs` | The surface stub (`gen/surface.js`) on the test world: every landmark zone validates on 5 seeds, generates the same twice and has what its landmark promises (the temple's Maren, cube, spike hall, cube wall, front door, entrance stairs and the legacy levels 1:1 under the parent's frame with no sinkholes; the ruin's entrance, a `dungeonRect` centred under it, sinkholes inside it over level 1's floor, and its 5 levels down to the Flat Queen's hall; the tower's yard on the open east edge); then 500 random spans validate with navigability ≥ 90%, reporting the lowest, the mean, retries and timing. `--tiles N`. |
| `bot.mjs` | Scripted play through `game.debug`. `runStairs`: down three legacy levels and back up (and out to the temple, beside its entrance), on the map by key presses and in 3D by walking, checking every arrival is beside the right stairs. `runSmoke`: plays a while with monsters alive on levels 3, 5, 10, 15 and 20 (guardians, the Lich), failing on any exception. `runEdges`: walks east off the temple's span in 3D (prefetched neighbour, a one-frame swap with no transition screen, no camera jump, no darker frame) and steps back west on the map (the mirrored tile, within a block). `runGoldenA` (0B): golden (a)'s scripted steps through one view's controls (I, the arrow keys and Enter in the inventory, R, 1 on the level-up screen, walking over crystals and piles: a map step onto the next tile, or a 3D frame with it at your feet), compared step for step with the parent's trace. `node tools/bot.mjs [--seed N] [--view map\|3d\|both]`. |
| `browser-gate.mjs` | The 0A2 browser gate in headless Chromium, with real key presses. **Not a `check-*`**: it needs Playwright, which the repository doesn't depend on, so `run-all` doesn't run it. `NODE_PATH=$(npm root -g) node tools/browser-gate.mjs [--seeds 1234,7] [--shots DIR]`. It serves the repository on a free port, silences audio (an init script routes everything bound for the speakers through an analyser and a zero-gain node), and per seed: boots `index.html` into the intro pages and pages through them; walks off the temple span's east edge in 3D sampling every frame at `present()` (prefetched, no transition screen, no darker frame at the swap, no camera jump); steps back west on the map onto the mirrored tile; goes down the ruin's dungeon 2 levels and back up beside its entrance; walks into every sinkhole of the ruin's span and lands right under it; and fails on any console error or warning. |
| `report.mjs`, `run-all.mjs` | Printing a result; running every check. |

## Re-recording the golden fixtures

The fixtures were recorded once, before any game code changed, and every later check compares against them. Never
re-record them to make a check pass: when an API changes, update `tests/golden/current-api.js` instead. To record them
again from the parent's code (for instance to confirm they are right):

```
git archive 75edbd3 src | tar -x -C <tmp>
copy package.json <tmp>\           (any package.json with "type": "module" above src/)
node tools/golden-record.mjs --src <tmp>/src --out <tmp>/golden
```

and compare `<tmp>/golden/*.json` with `tests/fixtures/golden/*.json`. They match byte for byte (line endings aside).

What the fixtures contain is described at the top of `tests/golden/scenarios.js`. Renamings the adapter
makes (never the fixtures): the parent's `gold` field is `currency.funds(p)`, and the `cash` piles generation lays
today are shown under the parent's kind name `gold` (the same pile); the five gear fields are read from the body. They were recorded in Node 20; compare
them in Node (the renderer uses `Math.exp` and friends, whose last bits are not promised to match in other engines).

## Browser checks

`test.html` runs the dungeon validation in the browser (`window.testResult`). Serve the repository root with
`python -m http.server 8130` (or the `gnomon` preview config) and open `/test.html` or `/index.html?seed=N`. Before any
key press or click, route the game's audio into a silent sink (an `AnalyserNode` followed by a zero-gain node) until
`?silent=1` exists, and close the tab when done.
