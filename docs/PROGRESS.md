# Development progress

Last updated: 2026-08-06

## Where to look

- Active development branch: `agent/engine-alpha`
- Draft pull request: <https://github.com/gbuchdahl/brass-birmingham/pull/2>
- Latest verified checkpoint: hot-seat walking skeleton and legal selectors
  (see branch HEAD)
- Full local verification: `pnpm check`

The project is currently **engine-first**, with a deliberately plain but
interactive hot-seat walking skeleton at `/dev`. It supports privacy-safe device
handoff, Pass, Loan, automatic cash-covered income settlement, and the system
boundaries required to play a deterministic Pass/Loan-only game through both
eras.

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
- Explicit authoritative progress for action, Merchant follow-up, round
  settlement, era transition, and terminal phases; persisted schema is now v3.
- Immutable adapters connecting all seven action kernels to `GameStateV2`.
- A unified versioned command reducer with optimistic revisions, unique command
  IDs, typed source errors, exact-state rejection, and deterministic replay.
- Persisted Gloucester free-Develop resolution that survives save/reload and
  advances the original Sell exactly once.
- Turn advancement, card refill, round spending/order, income settlement,
  explicit liquidation, and phase-boundary guards.
- Settled Canal-to-Rail transition and terminal Rail scoring, including
  replay-safe boundary provenance and protection against repeated scoring.
- Deterministic command/replay coverage for the earlier engine slice.
- An interactive `GameStateV2` hot-seat prototype at `/dev` with deterministic
  2-4 player reset controls, pass-device privacy, current-hand reveal/hide,
  card selection, Pass and Loan, typed errors, round/era Continue controls,
  public state summaries, recent event types, and final standings.
- A pure hot-seat session controller with pass-device handoff/reveal privacy,
  public/private projections, deterministic command history, draft/error
  handling, and unit coverage.
- A fail-closed legal-options API. Pass, Loan, Scout, and Merchant free Develop
  inputs are exactly enumerated; Build, Network, Develop, Sell, and liquidation
  are explicitly marked as only attemptable until their progressive target
  selectors are added.
- Strict event/phase provenance validation for command receipts, round and era
  boundaries, Merchant follow-ups, Canal-to-Rail transition, and terminal Rail
  scoring.
- Correct no-board-presence exceptions for a player's first Industry-card Build
  and first Network link.

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

Every accepted command advances revision once, rejections preserve exact state
identity, a real Gloucester Sell can serialize while pending and resume safely,
and the hot-seat controller never exposes opponent card identities through its
public or handoff models.

The browser-verified walking skeleton can take a Loan, Pass the other player,
pay the resulting negative income from cash without liquidating an industry,
settle into round 2, and reset to four players. Browser console output was clean.
The full gate currently passes 40 test files / 528 tests plus the production
build. Start it with:

```bash
pnpm dev
```

Then open <http://localhost:3000/dev>.

## Next checkpoints

1. Add corruption-safe local save/recovery by persisting a replay origin,
   accepted command journal, and validated head state; always restore to a
   privacy-safe handoff screen.
2. Make Pass and Loan consume the authoritative legal selector, then add Scout
   using its already exact card-triple enumeration.
3. Add exact Canal Network link targets and a visible first board mutation;
   retain an explicit Rail-Network limitation until coal/beer target planning is
   enumerated.
4. Add Develop, Build, Sell, Merchant free Develop, and genuine asset
   liquidation controls through progressive legal-target selectors.
5. Run complete-game browser scenarios and the final fresh-install gate:
   generated-data checks, lint, typecheck, unit tests, production build, and
   accessibility smoke.

## Goal and non-goals

The current milestone is a deterministic, rules-complete Brass: Birmingham
engine for 2-4 local players, covering both eras, final scoring,
serialization/replay, and a hot-seat development UI.

Online multiplayer, matchmaking, authentication, AI opponents, and deployment
are intentionally outside this milestone.

## Keeping this document useful

Update this file when a checkpoint is pushed and keep the next three to five
concrete checkpoints current. Do not mistake the Pass/Loan walking skeleton for
the rules-complete hot-seat milestone.

For a fresh handoff:

```bash
git switch agent/engine-alpha
mise install
pnpm install --frozen-lockfile
pnpm check
```
