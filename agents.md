# Project Directory Reference

## Top-Level Layout
```
/ (repo root)
├── src/
│   ├── app/
│   │   ├── (site)/
│   │   ├── dev/
│   │   └── api/
│   ├── engine/
│   │   └── rules/
│   ├── ui/
│   ├── lib/
│   ├── server/
│   └── tests/
├── public/
├── styles/
├── package.json
└── tsconfig.json
```

## Directory Notes
- `src/app`: Next.js App Router entry point. `(site)` contains public pages, `dev` hosts the sandbox page, and `api` holds future server routes (`games/[id]/actions`).
- `src/engine`: Pure rules engine. Exports types, reducer, legal move helpers, and focused rule modules in `rules/` (`setup.ts`, `build.ts`, `sell.ts`, `scoring.ts`).
- `src/ui`: Presentational React components such as `Board.tsx`, `Hand.tsx`, and `Log.tsx` that consume projected state.
- `src/lib`: Shared utilities (identifiers and invariants today, schemas later) usable by both engine and UI/server layers.
- `src/server`: Server-only helpers like the in-memory store and placeholder bus/lock implementations that will back API routes.
- `src/tests`: Vitest suites. `engine/` covers reducer logic; `properties/` is the home for future invariant/property tests.
- `public`: Static assets served by Next.js.
- `styles`: Global styling assets (e.g., Tailwind configuration) referenced by the app shell.
- `package.json` & `tsconfig.json`: Toolchain configuration anchoring Next.js, TypeScript, and future lint/test scripts.

Reference this guide when navigating or extending the codebase so each agent understands where their responsibilities live.

# Agent: Cards Subsystem Migration

## Goal

Extract all card-related types and functions into `src/engine/cards/` so the engine stays modular. No functional changes—just organization.

## Deliverables

* New directory: `src/engine/cards/`
* Files:

  * `src/engine/cards/types.ts` — Card/Deck types (no logic)
  * `src/engine/cards/deck.ts` — `buildDeck`, `drawCards`, `discard`, `remove`
  * `src/engine/cards/hand.ts` — `dealToPlayers`, basic hand helpers
  * `src/engine/cards/index.ts` — barrel re-exports
* Updated imports in constructor and anywhere else cards were referenced.

## Step-by-step

1. **Create directory & files**

```
src/engine/cards/
  types.ts
  deck.ts
  hand.ts
  index.ts
```

2. **Move card types out of `src/engine/types.ts`**

* Remove any `Card`, `DeckState`, `CardId`, `CardKind` declarations from `src/engine/types.ts`.
* In `src/engine/cards/types.ts`, define the minimal interfaces:

  * `CardId`, `CardKind`, `Card { id; kind; payload? }`
  * `DeckState { draw; discard; removed; byId }`
* Keep these **type-only**; no logic.

3. **Relocate deck logic**

* In `src/engine/cards/deck.ts`, move (or recreate) functions:

  * `buildDeck(seed: string): DeckState`
  * `drawCards(deck: DeckState, n: number): { ids: CardId[]; deck: DeckState }`
  * (stubs for later) `discard(deck, ids)`, `remove(deck, ids)`
* Import RNG only here (e.g., `../util/rng`), not in types.

4. **Relocate hand logic**

* In `src/engine/cards/hand.ts`, move (or recreate):

  * `dealToPlayers(deck, seats, handSize) -> { deck, hands }`
  * (optional stubs) `addToHand`, `removeFromHand`

5. **Create barrel exports**

* In `src/engine/cards/index.ts`, re-export:

  * `export * from './types';`
  * `export * from './deck';`
  * `export * from './hand';`

6. **Update constructor to use new module**

* In `src/engine/state/create.ts`, change imports:

  * Replace any `../cards/deck` or `../cards/hand` paths with `../cards`.
  * Example: `import { buildDeck, dealToPlayers } from '../cards';`
* Ensure `createGame` uses `buildDeck(seed)` and `dealToPlayers(...)` exactly as before.

7. **Remove card defs from global types**

* Confirm `src/engine/types.ts` no longer references card types.
* If `GameState` doesn’t yet store `DeckState`, do nothing. If it does, import `DeckState` from `../cards`.

8. **Run & fix imports**

* `pnpm dev` (or your dev command) — fix any unresolved imports.
* `pnpm test` — ensure existing tests pass unchanged.

## Acceptance Criteria

* App compiles with **no** TypeScript errors.
* `/dev` page still renders; players still receive hands on `createGame`.
* All card-related imports originate from `src/engine/cards/`.
* No new behavior added; only file moves and import updates.

## Nice-to-haves (optional, stub only)

* `src/engine/cards/rules.ts` with placeholder exports:

  * `canPlayCard(state, player, cardId): boolean`
  * `describeCard(cardId): string`
* Do **not** implement logic yet; just function signatures to unblock future work.

## Guardrails

* Do not import `next/*`, DOM APIs, or fetch in card modules.
* Keep `types.ts` in cards free of any runtime code (types only).
* RNG usage stays inside `deck.ts` to keep determinism centralized.

## Verification Checklist

* [ ] `src/engine/types.ts` contains only engine/core types (no card types).
* [ ] `createGame` builds the deck and deals hands via the new module.
* [ ] No circular imports between `cards/*` and `state/*` or `rules/*`.
* [ ] `pnpm dev` and `pnpm test` both succeed.

If you want, I can also add a tiny one-line unit test stub (`cards/deck.test.ts`) the agent can generate to ensure `buildDeck` is deterministic given the same seed.
