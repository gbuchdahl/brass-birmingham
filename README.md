This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

Development is currently focused on the deterministic rules engine. See
[the development progress document](docs/PROGRESS.md) for the active branch,
pushed checkpoints, local work in progress, and the next planned milestones.

## Getting Started

Install the pinned Node.js and pnpm versions, then install dependencies:

```bash
mise install
pnpm install --frozen-lockfile
```

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser. The root
route redirects to the local hot-seat prototype at `/dev`.

## Verification

Run the complete local verification gate:

```bash
pnpm check
```

For a faster gate that omits the production build, run `pnpm verify`. Generated
rules artifacts are checked for staleness as part of both commands.

Run the production-browser hot-seat and accessibility gate with:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

It builds and serves the production app, checks privacy-safe handoffs and
reloads, completes a two-era game with an exact Rail action, and runs axe WCAG
A/AA scans at representative public and private states.

The `/dev` route is an intentionally plain hot-seat walking skeleton backed by
the authoritative `GameStateV2` command reducer. Pass the device, reveal only
the current player's hand, and use selector-backed industry Build, Develop,
Sell, Pass, Loan, Scout, Canal Network, or Rail Network actions. Build choices
include the exact board space, industry tile, resource sources, and total cost.
Their receipts also explain automatic coal/iron market sales, cubes left on the
tile, and whether income advanced. Develop choices include one or two ordered top
tiles and the exact board/market iron sources and price. Sell choices progress
one exact product, Merchant, and mandatory beer source at a time, and any
nonempty accepted prefix can be submitted as the completed action.
Rail choices similarly expose exact link and coal-source plans: a legal
one-link plan can be submitted immediately or promoted to inspect only its
legal ordered two-link extensions, including the required own beer.
Player count and seed changes take effect after a two-step **New / reset game**
confirmation tied to the current game revision and requested settings.
Progress is corruption-checked and autosaved in this browser; reload always
returns to a privacy-safe handoff screen. If play enters a Merchant free-Develop
follow-up, its exact tile choice is also hidden behind the owning player's
handoff and can be resolved in the UI. Round settlement is public: cash-covered
players confirm payment, while cash-short players progressively choose exact
owned industries to liquidate until the authoritative settlement is ready.

## Rules Data Workflow

- Edit rules source files in `docs/rules-data/`.
- Generate runtime TypeScript artifacts with:

```bash
pnpm rules:generate
```

- Generated files are:
  - `src/engine/rules/generated/ruleset.ts`
  - `src/engine/rules/generated/cards.ts`
  - `src/engine/rules/generated/industry-values.ts`
  - `src/engine/rules/generated/industry-tiles-v2.ts`
  - `src/engine/rules/generated/board-v2.ts`
  - `src/engine/rules/generated/income-track.ts`
  - `src/engine/rules/generated/merchant-tiles.ts`
  - `src/engine/board/generated/topology.ts`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
