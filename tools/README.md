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
| `check-dungeons.mjs` | 1,000 legacy levels (50 seeds × 20) pass `validateDungeonLevel`, guardian halls are complete, generation p95 ≤ 40 ms; `stampVault`'s options and the legend registry work; and the parameter contract's edges hold (`legacyParams` needs the run seed, …). `--seeds N`, `--budget MS`. |
| `check-determinism.mjs` | The same seed gives the same level (blocks, items, creatures, people, layout), and a static scan of the generation code: no `Math.random`, no `Math.hypot`, no random-comparator sorts. |
| `check-blocks.mjs` | Block ids are append-only against `tests/fixtures/block-ids.json`. |
| `check-zones.mjs` | The zone core: `Zone`, `zones.js` (changes, events, patches, uids, arrival, derived-array LRU), `events.js`, on the legacy site and a synthetic 80×48×16 surface zone. |
| `check-bot.mjs` | Runs `bot.mjs` in both views on two seeds. |
| `bot.mjs` | Scripted play through `game.debug`. `runStairs`: down three legacy levels and back up (and out to the temple), on the map by key presses and in 3D by walking, checking every arrival is beside the right stairs. `runSmoke`: plays a while with monsters alive on levels 3, 5, 10, 15 and 20 (guardians, the Lich), failing on any exception. `node tools/bot.mjs [--seed N] [--view map\|3d\|both]`. |
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

What the fixtures contain is described at the top of `tests/golden/scenarios.js`. They were recorded in Node 20; compare
them in Node (the renderer uses `Math.exp` and friends, whose last bits are not promised to match in other engines).

## Browser checks

`test.html` runs the dungeon validation in the browser (`window.testResult`). Serve the repository root with
`python -m http.server 8130` (or the `gnomon` preview config) and open `/test.html` or `/index.html?seed=N`. Before any
key press or click, route the game's audio into a silent sink (an `AnalyserNode` followed by a zero-gain node) until
`?silent=1` exists, and close the tab when done.
