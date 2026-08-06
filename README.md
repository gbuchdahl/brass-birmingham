This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Verification

Run the complete local verification gate:

```bash
pnpm check
```

For a faster gate that omits the production build, run `pnpm verify`. Generated
rules artifacts are checked for staleness as part of both commands.

You can start editing the public page in `src/app/(site)/page.tsx`. The page
auto-updates as you edit the file. The engine sandbox is available at `/dev`.

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
  - `src/engine/board/generated/topology.ts`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
