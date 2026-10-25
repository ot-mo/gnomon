# GNOMON: rules for every session (local or cloud)

GNOMON is the overworld fork of The Rotation Cube, a browser ASCII roguelike. GitHub Pages serves `main` at
https://ot-mo.github.io/gnomon/, so **`main` must always be playable**.

## Start of every session

1. Read `docs/HANDOFF.md`: where the work stands and the exact next step.
2. Read `docs/design/DECISIONS.md` (it overrides everything), then the latest `docs/sessions/*.md`.
3. Run `git fetch origin --tags` and check out the branch `HANDOFF.md` names. Run `node tools/run-all.mjs` to confirm
   it is green before you change anything.

Order of authority: `DECISIONS.md` > `WORLD_BIBLE.md` §15 > the rest of the bible > `TECH_DESIGN.md`. The plan is
`TECH_DESIGN.md` §8: Phase 0 sessions (§8.2) one after another, then the Phase 1 workstreams (§8.3, ownership §8.4) in
parallel from tag `p0-done`, then integration, content (C1-C5) and balance.

## How every session or workstream is done

Implement → **independent, sceptical verification** (rerun the gate yourself; look for regressions in the old game;
try to break the claims) → fix (one commit per finding) → recheck → tag. A tag goes on only when
`node tools/run-all.mjs` is green and every gate item has its numbers in `docs/sessions/<id>.md`. Then fast-forward
`main` to the tag (`git push origin <tag>:main` only if it is a fast-forward; never force).

- Work on a branch (`wip/<session>` or `ws/<ws>`), never on `main`. Never rewrite history.
- **Commit each logical step and push it at once** (`git push origin <branch>`; push tags with `git push origin <tag>`).
  End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Node checks: `node tools/run-all.mjs` (Node ≥ 20, no npm dependencies). Never re-record golden fixtures.
- Browser checks: audio must never reach the speakers (route the destination into an AnalyserNode and a zero-gain node
  before any key press, or `?silent=1` once it exists). Close every tab and stop every server afterwards.
- Never modify the original repo `ot-mo/ascii-roguelike`. No Caves of Qud names (bible §15.11).
- The user's taste: both views must matter; rewards stay meaningful to the end; money is never plentiful.

## Handing off (local ↔ cloud)

Sessions alternate between the local machine and the cloud. Only **one** machine works on a branch at a time.
Before you stop, or as soon as you get close to a session or usage limit:

1. Commit and push everything. Leave no uncommitted or unpushed work; if a step is half done, commit it with a
   `WIP:` message that says what is unfinished.
2. Update `docs/HANDOFF.md` (branch, last tag, what is done, the exact next step, what is half finished, anything
   surprising), commit it, push it.
3. Say in your last message that the handoff is pushed, and on which branch.
