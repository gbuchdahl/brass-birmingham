# Development progress

Last updated: 2026-08-06

## Where to look

- Active development branch: `agent/engine-alpha`
- Draft pull request: <https://github.com/gbuchdahl/brass-birmingham/pull/2>
- Latest pushed engine checkpoint: `e6b2fba` (`Enforce settled GameStateV2 era transitions`)
- Full local verification: `pnpm check`

The project is currently **engine-first**. The `/dev` route now makes setup and
authoritative state visible, but it is deliberately read-only and is not yet a
playable game.

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
- Immutable adapters connecting all seven action kernels to `GameStateV2`.
- Turn advancement, card refill, round spending/order, income settlement,
  explicit liquidation, and phase-boundary guards.
- Settled Canal-to-Rail transition and terminal Rail scoring, including
  replay-safe boundary provenance and protection against repeated scoring.
- Deterministic command/replay coverage for the earlier engine slice.
- A read-only `GameStateV2` inspector at `/dev` with deterministic 2-4 player
  setup controls, player mats, markets, card zones, Merchants, board spaces,
  links, and recent events.

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

## Current stopping point

The action-adapter, turn-lifecycle, and era-lifecycle integration audit is
complete and pushed. Rejections preserve exact state identity; round and era
boundaries cannot be bypassed by later events; final Rail skips income and
liquidation; and the composite fixtures preserve cards, tiles, and links.

The interface checkpoint is intentionally an inspector, not a partially wired
game client. It proves that `GameStateV2` can drive a useful display while the
unified command API is still being built. Start it with:

```bash
pnpm dev
```

Then open <http://localhost:3000/dev>.

## Next checkpoints

1. Add a unified versioned command reducer with optimistic revision checks,
   typed rejections, deterministic replay, and explicit pending/terminal state.
2. Resolve Merchant free-Develop follow-ups through that command/state-machine
   boundary.
3. Add legal-action and legal-target selectors backed by complete-game
   scenario tests.
4. Evolve the read-only inspector into a basic hot-seat action interface using
   the unified command and legality APIs.
5. Run the final fresh-install gate: generated-data checks, lint, typecheck,
   unit tests, production build, and development-server smoke test.

## Goal and non-goals

The current milestone is a deterministic, rules-complete Brass: Birmingham
engine for 2-4 local players, covering both eras, final scoring,
serialization/replay, and a hot-seat development UI.

Online multiplayer, matchmaking, authentication, AI opponents, and deployment
are intentionally outside this milestone.

## Keeping this document useful

Update this file when a checkpoint is pushed: record the newest engine
checkpoint and keep the next three to five concrete checkpoints current. Do
not mistake the read-only inspector for the hot-seat milestone.

For a fresh handoff:

```bash
git switch agent/engine-alpha
mise install
pnpm install --frozen-lockfile
pnpm check
```
