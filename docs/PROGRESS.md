# Development progress

Last updated: 2026-08-06

## Where to look

- Active development branch: `agent/engine-alpha`
- Draft pull request: <https://github.com/gbuchdahl/brass-birmingham/pull/2>
- Latest verified checkpoint: hot-seat walking skeleton and legal selectors
  (see branch HEAD)
- Full local verification: `pnpm check`

The project is currently **engine-first**, with a deliberately plain but
interactive hot-seat prototype at `/dev`. It supports privacy-safe device
handoff, exact industry Build and Develop plans, Pass, Loan, Scout, exact Canal
Network link selection, exact Merchant free-Develop follow-ups, automatic
cash-covered income settlement, corruption-safe local recovery, and the system
boundaries required to play deterministic rounds through both eras.

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
  selector-backed industry Build, Develop, Pass, Loan, Scout, and Canal Network
  actions, privacy-safe Merchant free-Develop resolution, typed errors,
  round/era Continue controls, public state summaries, visible built-industry
  boxes and next-tile inventories, recent event types, and final standings.
- A pure hot-seat session controller with pass-device handoff/reveal privacy,
  public/private projections, deterministic command history, draft/error
  handling, and unit coverage.
- A corruption-checked local save format containing a replay origin, accepted
  command journal, collision-safe command ordinal, and byte-verified head state.
  Invalid saves fail closed and require explicit user-confirmed replacement.
- Fail-closed progressive legal selectors. Pass, Loan, Scout, Canal Network,
  Merchant free Develop, card-specific industry Build, and card-specific
  Develop plans are exact. Sell is exact through a bounded progressive selector
  whose every accepted prefix can stop as a complete action or append one exact
  next sale. Round liquidation is also exact and progressive, exposing only the
  next owned positive-value asset for each negative-income seat until cash,
  liquidation proceeds, or exhausted assets settle the shortfall. Build plans
  include board space, top tile, overbuild, materially distinct coal/iron
  sources, market cost, production outcome, and total cost. Develop plans
  include ordered physical top tiles, exact board and market iron, price,
  provider depletion, and resulting inventory. Sell choices include the
  product, Merchant, mandatory beer source, reward, income, and any pending free
  Develop. Every complete plan is accepted by the authoritative command reducer
  or round-settlement authority. Rail Network, Sell, and liquidation remain
  explicitly incomplete in the UI.
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
public or handoff models. A pending Merchant free-Develop choice now returns to
a handoff, reveals only to the affected player, accepts an exact top-tile choice
(or the rules-required empty skip), and completes its parent Sell exactly once.
It is not yet reachable through ordinary browser play because Sell controls are
the next action slice.

The engine also exposes exact, reducer-checked Develop plans for a selected
card, including one- or two-tile removal, mandatory board iron before market
iron, exact market prices, and provider flips. The selector is bounded and has
a dense-board regression. Its hot-seat control shows ordered tile removals,
board-versus-market iron, exact cost, and the resulting public next-tile stacks.

Sell now has an exact progressive engine contract as well. It avoids factorial
multi-sale enumeration by exposing one decision layer at a time: each accepted
prefix is a reducer-ready action the player may submit immediately, while its
next choices append one legal product/Merchant/beer combination. It preserves
both material sale orders, deduplicates only byte-equivalent adapter outcomes,
and projects Merchant rewards and pending Gloucester free Develop.

Round settlement now has a bounded progressive liquidation contract. Missing
negative-income seats remain unacknowledged, cash-covered seats explicitly
choose `[]`, short seats append one owned positive-value industry at a time, and
the selector stops immediately when the shortfall is covered or assets are
exhausted. It previews cash and VP loss and returns a command map only after the
authoritative settlement accepts every seat together; final Rail correctly
skips income with `{}`.

The browser-verified prototype can build a real level-1 Cannock coal mine for
£5 and show its two coal cubes; Develop a level-1 Manufacturer and Cotton Mill
for £4 of market iron, reducing £17 to £13 and advancing both public next-tile
stacks; Scout three regular cards for both Wilds; build an exact reachable Canal
link for £3; continue after reload without command-ID collisions; take a Loan;
pay negative income from cash; settle into round 2; and reset to four players.
Reload restores the exact revision, market, and inventory while hiding the
current hand before any private state is mounted. Browser console output was
clean. The verified checkpoint has 46 test files / 599 tests plus the production
build. Start it with:

```bash
pnpm dev
```

Then open <http://localhost:3000/dev>.

## Next checkpoints

1. Add Sell and genuine asset-liquidation controls through exact progressive
   legal-target selectors.
2. Enumerate Rail Network coal/beer and optional two-link plans, then expose the
   Rail control without weakening the already exact Canal selector.
3. Run complete-game browser scenarios and the final fresh-install gate:
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
