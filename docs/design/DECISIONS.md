# GNOMON: build decisions

This file settles where the two design documents disagree, and fixes the working rules for everyone who builds the
fork. **Read it first.**

**Order of authority.** Where the documents conflict, the higher one wins:

1. this file;
2. `WORLD_BIBLE.md` §15 (the data appendix);
3. the rest of `WORLD_BIBLE.md`, for content, rules and numbers;
4. `TECH_DESIGN.md`, for architecture, modules, data models, process, phases and tests.

`TECH_CRITIQUE.md` is background: its findings are already folded into `TECH_DESIGN.md`. `docs/research/` holds the two
surveys of the parent code that the tech design cites.

## 1. Where the bible overrides the tech design

| Topic | Tech design said | Build this instead |
|---|---|---|
| Combat | `RULES.combat = "dice"` with PV/AV penetration (§3.2) | **`"d20"`**: bible §10.6 and §15.6. To-hit is d20 + AGI mod + accuracy + bonuses > DV; a natural 1 misses; a natural 20 hits and crits for ×2 damage; +1 from high ground. Damage is the weapon range + material + floor((STR − req)/2) + enchantment, then the existing multipliers. Armour soaks a random 0..AV. Creatures roll d20 + floor(level/3) vs your DV; creature DV is 5 + floor(level/4) + species; creatures scale +6% HP per level and +1 damage per 4 levels. No `penetrations()`, no `pv` bonus key. `check-combat` asserts hit-chance tables and map/3D parity instead of penetration odds. Keep the `legacy` set for golden checks. |
| Levels | `byTier = [1,3,…,15]` | Surface zone level = **3 × tier − 1**; tier of a level = min(8, ceil((level + 1)/3)). Landmark dungeon floor levels are explicit (bible §15.3). A generic site's floor k (1-based) has level = surface level + k. Legacy tables are read through `contentLevel()` = min(level, 20) until content phase C3 covers levels up to 30. |
| Currency | water; counter, item and liquid backings | **Glim** (lamp oil): a counter, shown as `$` in the old gold colour. The purse holds 200 / 500 / 1,000 glim depending on the purse flask (bible §15.6). There is no liquid backing, no containers and no thirst. Torch drain is 1 glim per 4 world hours while lit in darkness (underground, the Shade, surface night); it costs nothing by day. With an empty purse the torch gutters to a 1-tile flicker and never goes out completely. |
| Liquids | currency and mixing | One dominant liquid per tile, with no mixing. Liquids are faction sacraments for the Kindling and the base of tonics (bible §13.7–13.8). |
| Clock | 1 game minute per game second | The same in other words: **one world hour = 60 s of game time** in both views. Day 06–18, dusk 18–19, night 19–05, dawn 05–06, the noon window 11–13. The run starts on day 1 at 06:00. **Z** waits until dawn, noon, dusk, midnight, healed or N hours. |
| World size | 40..64 × 20..32 | **42 × 21** (it passes that check). The UI calls a world tile a **span**. |
| Run modes | Classic, Roleplay, Wander | Those are banned names. Use ids **`oneWick`** (permadeath), **`commonsLamp`** (checkpoint on entering or leaving a settlement) and **`pilgrim`** (kills give 0 XP, other XP ×2.2). `RULES.classic.*` becomes `RULES.oneWick.*`. |
| Genotypes | `mutant` / `pure`, `license`, `credit`, `station` | Ids **`bent`** (mutations; the points are **creases**) and **`plumb`** (implants; **grade**, **true-marks**, the **Truing Cradle**). Neutral code identifiers are fine, but no UI or content string may use the banned words (bible §15.11). |
| Bonding | the "sharing rite" | **The Kindling**, with three view rites: the **Tracing** on the map, the **Lighting** in lit 3D, the **Snuffing** in the dark. Numbers are in bible §15.6. |
| Psychic counterweight | — | **Cast** and the **Smoothers** (bible §10.3, §12.12). The trigger is Tab rotation, and the hunters are flat, fought on the map. |
| Flat status | scattered | One core status `flat` in `status.js`, exactly as bible §10.2 and §15.6 define it. Phase 0 creates it, with the forced map and the Tab lock; its movement rules are WS8's. |
| Start and the legacy campaign | the legacy stack under tile (0, 0) | In the **test world** the legacy fixture stays at (0, 0). In the **real world** it is the **Keeper's Stair** under Hollowmere at (5, 16): 20 floors, levels 2–21, optional. Hollowmere's sanctum reuses the parent's Temple of Angles plan. |
| Glyphs | — | Bible §15.7 is binding. A check asserts that no creature glyph is a reserved one and that every (glyph, colour) pair is unique. |
| Heights | — | Surface: standable ground at most 12 blocks above the datum, scenery at most 14. Dungeon platforms at most 5 blocks above the floor. Anything taller is a billboard. |
| Names | deny-list | `check-names` uses bible §15.11. Match whole words, case-insensitive. "Classic", "Roleplay" and "Wander" are flagged only as mode names, in UI strings next to "mode". A **variable** called `classic` is still renamed. |
| Scope | — | Bible §15.9's scope guards are binding: no hunger or thirst, no limbs or dismemberment, no temperature, no liquid mixing, no penetration dice, two progression tracks. |

## 2. Working rules for every agent

- **Repository.** `C:\Users\Otto Mörner\Code\gnomon` (the fork). **Never modify** `C:\Users\Otto Mörner\Code\ascii-roguelike`;
  it is the original game and stays as it is. The fork's remote `parent` points at it, read-only.
- **Identity.** `GAME_ID = "gnomon"`. Storage keys and the IndexedDB name start with `gnomon`. The page title is
  "GNOMON".
- **Sequence.** Phase 0 runs on `main`, one session after another, as in `TECH_DESIGN.md` §8.2. Each session ends with a
  green `node tools/run-all.mjs`, a commit and a tag (`p0-0a1`, `p0-0a2`, `p0-0b`, `p0-0c`, `p0-0d1`, `p0-done`).
- **Phase 1 workstreams.** Each runs in its own git worktree,
  `C:\Users\Otto Mörner\Code\gnomon-wt\<ws>`, on branch `ws/<ws>` created from tag `p0-done`. Make it with
  `git worktree add` from the main checkout, and edit only the files the ownership matrix (§8.4) gives you. Anything that
  needs a change to someone else's file goes in `docs/<ws>.md` under "Integration requests".
- **Commits.** Commit early and often: each logical step gets its own commit (a module moved, a check passing, a
  feature working), so that `main` and every `ws/*` branch show the work as it happens. End every message with the line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never rewrite history on `main`.
- **Pushing.** The fork is public at https://github.com/ot-mo/gnomon (remote `origin`), and GitHub Pages serves `main` at
  https://ot-mo.github.io/gnomon/. A post-commit hook pushes every commit, on any branch, to `origin` automatically, so
  don't push branches by hand. Annotated tags go up with the next commit's push (`--follow-tags`). If a tag must be up at
  once, run `git push origin <tag>`. The `parent` remote can't be pushed to.
- **Node.** Node 20.11 is installed, with no npm dependencies. Run scripts as ES modules (`.mjs`), or pass
  `--experimental-default-type=module` for `.js` entry points.
- **Browser checks.** Use the built-in browser pane and the preview server `gnomon` in `.claude/launch.json`
  (`node tools/serve.mjs 8130`, served from the repo root). A worktree serves on its own port from its own folder:
  start `node tools/serve.mjs <port>` in the background with the Bash tool, and kill it when done. (Not
  `python -m http.server`: on Windows it drops part of a boot's ~150 module requests.)
  - **Audio must never reach the speakers.** Until `?silent=1` exists, first patch the page so that anything connected
    to the AudioDestinationNode goes to an AnalyserNode followed by a zero-gain node.
  - **Close every tab you opened when you finish.** The pane keeps running while hidden, and the game's music would
    keep playing.
- **Writing.** Code comments and in-game text in plain English, matching the surrounding style. In-game text follows the
  bible's voice (§2) and its banned list.
- **Secrets.** The rules for placing secret rooms stay out of the README (the user likes to discover them). Keep them in
  a code comment only.
- **The user's taste.** Both views must matter, every system needs a map form and a 3D form, and rewards must stay
  meaningful to the end of the game. Spike fields must be crossable by a careful player who reads the map.
