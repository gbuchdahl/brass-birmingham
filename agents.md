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
