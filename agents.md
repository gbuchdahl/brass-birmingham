# Brass: Birmingham agent handoff

Last updated: 2026-08-07

This repository is an engine-first, local hot-seat implementation of Brass:
Birmingham. The old M0–M4 skeleton notes that previously lived here are no
longer accurate; use this file and `docs/PROGRESS.md` as the durable handoff.

## Current branch and milestone

- Active branch: `agent/engine-alpha`
- Draft PR: <https://github.com/gbuchdahl/brass-birmingham/pull/2>
- Milestone: deterministic, rules-complete 2–4-player local hot-seat play through
  both eras and final scoring.
- Explicitly out of scope: online multiplayer, authentication, matchmaking, AI
  opponents, deployment, and fancy art.
- Status: verified complete. On 2026-08-07, an isolated checkout of implementation
  commit `3d2feaf` passed frozen install, the full code/build gate, and all nine
  production browser/accessibility scenarios with a clean worktree.

## Start here

1. Read `README.md` for setup and player-facing development instructions.
2. Read `docs/PROGRESS.md` for implemented behavior, browser scenarios, current
   counts, and any remaining checkpoint.
3. Inspect the draft PR and recent commits before changing shared files.
4. Preserve unrelated user work if the tree is dirty.

## Current architecture

- `src/engine/game-v2/`: authoritative composite game state, commands,
  serialization, turn/round/era lifecycle, exact legal selectors, and replay.
- `src/engine/actions-v2/` and `src/engine/actions/`: pure action kernels used by
  immutable GameStateV2 adapters.
- `src/engine/rules/generated/`: generated cards, board, tiles, income, merchants,
  and ruleset data used at runtime.
- `docs/rules-data/`: reviewable source data for generated rules artifacts.
- `src/ui/`: pure hot-seat projections/controllers, local persistence, exact
  progressive action models, and the intentionally plain React prototype.
- `src/app/dev/`: the playable `/dev` route. The root route redirects here.
- `src/tests/`: Vitest engine, UI, replay, and invariant coverage.
- `e2e/`: production-server Playwright/axe journeys and public-command-built
  serialized fixtures. Fixtures must not patch authoritative state directly.

## Important contracts

- Every accepted command advances revision exactly once; rejected commands
  preserve exact authoritative state.
- The command reducer and exact legal selectors are authoritative. UI controls
  must submit selector-emitted plans, never reconstruct rule choices ad hoc.
- Sell, Rail Network, and liquidation use bounded progressive prefixes. Local
  drafts are revision/card-bound, fail closed, remain private where applicable,
  and are excluded from autosave.
- Handoff models must not mount or serialize another player's hand or private
  follow-up choices.
- Browser saves contain the replay origin, accepted command journal, collision-
  safe command ordinal, and byte-verified head. Corrupt saves fail closed.
- Keyboard focus follows authoritative revision and active mode; draft-only
  clicks must retain their natural focus.
- Reset is two-step and one-shot. Confirmation is tied to game ID, revision,
  current/requested settings, and local-save context.

## Verification

Use the pinned toolchain through mise:

```bash
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm check
mise exec -- pnpm test:e2e
```

`pnpm check` covers generated-data freshness, ESLint, TypeScript, Vitest, and a
production Next.js build. `pnpm test:e2e` separately builds/serves production
and runs Playwright/axe. At this handoff, the expected local results are 49
Vitest files / 634 tests and 9 Playwright tests. Confirm the exact current counts
rather than copying them forward after new work.

The completion gate ran every command above in a separate fresh worktree at
`3d2feaf`; dependency installation was frozen, all checks passed, and the
checkout remained clean afterward.

CI runs frozen install, verification, Chromium installation, the production
browser gate, and uploads the Playwright report.

## Rules data workflow

1. Edit the appropriate source under `docs/rules-data/`.
2. Run `pnpm rules:generate`.
3. Review the generated TypeScript diff under `src/engine/rules/generated/`.
4. Run `pnpm check`.

Runtime engine code imports generated TypeScript, not YAML directly.

## Useful rule/UI checkpoints

- A new level-1 Iron Works produces 4 cubes. With the initial iron market at
  8/10, only 2 cubes sell for £2; 2 remain on the tile, so it does not flip and
  income does not advance yet. The public Build receipt explains this explicitly.
- Public liquidation exposes only owned positive-value assets, updates shortfall
  after each click, and cannot submit until the authoritative selector is ready.
- A one-link Rail plan can submit immediately or be promoted to inspect only
  exact ordered two-link extensions, including sequential coal and required own
  beer.
- Gloucester's Merchant reward persists as a private free-Develop follow-up and
  completes its parent Sell exactly once after resolution.

## Non-blocking follow-ups after milestone completion

- Deeper full-round browser journeys for 3 and 4 players; complete engine/replay
  journeys already cover both counts.
- Broader axe scans on every progressive branch.
- Stronger property/fuzz testing.
- Retire the legacy generic `attemptable` Network status and placeholder V1
  industry-value data once no compatibility consumer needs them.

Do not resurrect the legacy reducer skeleton, silent illegal-action behavior,
card-rule stubs, or skipped-property-test claims that this file used to describe.
