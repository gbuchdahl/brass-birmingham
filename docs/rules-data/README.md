# Rules Data Entry

This directory is the editable source of truth for rules data. Runtime code consumes generated TypeScript files, not YAML directly.

## Files to edit

- `industry-values.yaml`: build costs, resource requirements, cube production, and income-on-flip.
- `board-topology.yaml`: cities, ports, and edges.

## Entry rules

- Use integers for all numeric values.
- Provide a `source_note` for every industry level row.
- If a value is unknown, use `UNKNOWN` in `source_note` and keep a temporary numeric placeholder. The generator fails on `UNKNOWN`.
- Keep city and node names exact; they are used as IDs.

## Generate runtime artifacts

```bash
pnpm rules:generate
```

This updates:

- `src/engine/rules/generated/industry-values.ts`
- `src/engine/board/generated/topology.ts`

## Validate

```bash
pnpm vitest run
pnpm vitest run --coverage
```
