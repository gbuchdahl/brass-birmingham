A repository for building an online version of Brass Birmingham. 

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
│   │   ├── board/
│   │   ├── cards/
│   │   ├── rules/
│   │   ├── state/
│   │   └── util/
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
- `src/engine`: Pure rules engine. Key subpackages:
  - `board/`: static graphs for city/link topology.
  - `cards/`: deck + hand utilities, deterministic RNG usage, and card rules stubs.
  - `rules/`: game rule modules (`setup`, `build`, `sell`, `scoring`, `config`).
  - `state/`: constructors like `createGame` (seeded, deterministic).
  - `util/`: shared pure helpers (`rng`, upcoming math helpers, etc.).
- `src/ui`: Presentational React components (Board, Hand, Log) consuming projected state.
- `src/lib`: Shared helpers (IDs, invariants, future schemas) reusable across layers.
- `src/server`: Server-only helpers (store, bus, lock) for API routes.
- `src/tests`: Vitest suites—`engine/` for reducers, `properties/` for invariants/property tests.
- `public`: Static assets served by Next.js.
- `styles`: Global styling assets (Tailwind config) referenced by the app shell.
- `package.json` & `tsconfig.json`: Toolchain configuration anchoring Next.js, TypeScript, lint/test scripts.

Use this guide when navigating or extending the codebase so each agent understands where their responsibilities live.

# Agent: Milestone Tracker (Current State)

## Completed

1. **M0 Skeleton**
   - Reducer scaffold with explicit constructors (`reduce` is pure no-op for unknown actions).
   - Dev sandbox (`/dev`) hydrates seed game and dispatches actions.
2. **M1 Turn Skeleton**
   - `createGame(seats, seed)` seeds deterministic state, seat order, turn counter, event log.
   - `END_TURN` cycles `currentPlayer`, appends log entries, ignores out-of-turn requests.
3. **M2 Board & Cards (minimal)**
   - Deterministic RNG (`mulberry32`) and `shuffleInPlace` helper.
   - Micro board graph (`Birmingham`, `Coventry`) and adjacency map.
   - Minimal deck & hand dealing; players receive hands on game creation.

## Testing Status

- `pnpm vitest run` (passes): reducer smoke tests verify `END_TURN` rotation and out-of-turn guard.
- Property tests placeholder (`src/tests/properties/invariants.test.ts`) still skipped.

## Notes for Agents

- Deterministic seed defaults to `"dev-seed"` outside production for hydration stability.
- Card IDs (`c0..`) generated in deck builder; log events capture hands dealt (hand size only).
- UI sandbox uses `createGame(['A','B','C','D'])`; adjust seats array to mimic real player counts.
- Any future module split should follow the cards migration precedent: types-only files, barrel exports, and pure helpers.
- Keep reducers pure and exhaustively switch over `Action` unions—TypeScript will enforce via `never` guard.

