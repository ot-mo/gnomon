# Tools

Node-only scripts for checking the game. They need **Node 20 or newer** and nothing else: no npm packages. The
`package.json` at the repository root only declares `"type": "module"`, so Node loads `src/*.js` as ES modules.

Run everything with:

```
node tools/run-all.mjs
```

It runs every `check-*.mjs` in this folder and exits non-zero if any fails.

| Tool | What it does |
|---|---|
| `node-env.mjs` | The headless environment the other tools use: stub screen and input backends (the frame lands in a capture buffer), an in-memory `localStorage`, and a seedable `Math.random`. Sound stays off by itself (`audio.js` needs `window`). It also works against an old copy of `src/`. |
| `golden-record.mjs` | Recorded the golden fixtures in `tests/fixtures/golden/` from the parent game's code (commit `75edbd3`). Run it only against that code: `--src DIR` points it at an exported copy, `--out DIR` writes elsewhere. |

## Re-recording the golden fixtures

The fixtures were recorded once, before any game code changed, and every later check compares against them. To
record them again from the parent's code (for instance to confirm they are right):

```
git archive 75edbd3 src | tar -x -C <tmp>
copy package.json <tmp>\           (any package.json with "type": "module" above src/)
node tools/golden-record.mjs --src <tmp>/src --out <tmp>/golden
```

and compare `<tmp>/golden/*.json` with `tests/fixtures/golden/*.json`. They match byte for byte.

What the fixtures contain is described at the top of `tests/golden/scenarios.js`.
