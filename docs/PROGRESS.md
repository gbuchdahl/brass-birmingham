# Development progress

Last updated: 2026-08-06

## Where to look

- Active development branch: `agent/engine-alpha`
- Draft pull request: <https://github.com/gbuchdahl/brass-birmingham/pull/2>
- Latest pushed engine checkpoint: `5193c39` (`Keep game identity stable across rounds`)
- Full local verification: `pnpm check`

The project is currently **engine-first**. Most progress is visible in the rules
data, engine modules, and tests rather than in `pnpm dev`. The `/dev` route is a
thin sandbox and is not yet a representative playable game.

## Pushed and working

- Generated, reviewable rules data for the ruleset, cards, board, industry
  tiles, income track, and merchant tiles.
- Deterministic setup for 2-4 players, including player inventories, card
  zones, merchants, resource markets, and serializable random state.
- Canal and Rail era card setup and redealing.
- Atomic rule kernels for all seven player actions: Build, Network, Develop,
  Sell, Loan, Scout, and Pass.
- Coal, iron, beer, market, industry-inventory, income, and round-order rules.
- Canal/Rail scoring and era-transition helpers, including final ranking.
- Composite `GameStateV2` validation and strict versioned serialization.
- Deterministic command/replay coverage for the earlier engine slice.

The test suite is the best current demonstration of behavior. Start with:

```bash
pnpm test
```

Useful entry points include:

- `src/engine/game-v2/state.ts`
- `src/engine/game-v2/serialization.ts`
- `src/engine/actions/`
- `src/tests/engine/`
- `docs/rules-data/`

## Local work in progress

The shared worktree currently contains an uncommitted integration slice:

- `src/engine/game-v2/action-adapters.ts`
- `src/engine/game-v2/turn-lifecycle.ts`
- `src/engine/game-v2/era-lifecycle.ts`
- Their three corresponding test files under `src/tests/engine/`

These files connect the already-tested action kernels to `GameStateV2` and
coordinate turn, round, and era boundaries. They are being audited before they
are committed. In particular, boundary-state guards, immutable projections,
final-Rail income behavior, and valid composite test fixtures still need to be
settled.

## Next checkpoints

1. Finish the integration audit and commit/push action adapters, turn
   lifecycle, and era lifecycle as small coherent checkpoints.
2. Add a unified versioned command reducer with optimistic revision checks,
   typed rejections, deterministic replay, and explicit pending/terminal state.
3. Add legal-action and legal-target selectors backed by complete-game
   scenario tests.
4. Build a useful hot-seat/debug interface so `pnpm dev` exposes the engine and
   makes full games inspectable.
5. Run the final fresh-install gate: generated-data checks, lint, typecheck,
   unit tests, production build, and development-server smoke test.

## Goal and non-goals

The current milestone is a deterministic, rules-complete Brass: Birmingham
engine for 2-4 local players, covering both eras, final scoring,
serialization/replay, and a hot-seat development UI.

Online multiplayer, matchmaking, authentication, AI opponents, and deployment
are intentionally outside this milestone.

## Keeping this document useful

Update this file when a checkpoint is pushed: move completed work out of the
work-in-progress section, record the new pushed commit, and keep the next three
to five concrete checkpoints current. Do not use the UI alone to judge engine
progress until the hot-seat/debug checkpoint is complete.
