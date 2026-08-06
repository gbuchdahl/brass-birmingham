# Rules Data Entry

This directory is the editable source of truth for rules data. Runtime code consumes generated TypeScript files, not YAML directly.

## Files to edit

- `ruleset.yaml`, `markets.yaml`, and `setup.yaml`: versioned ruleset, market tracks, and player-count setup.
- `cards.yaml`: exact location/industry card distribution and separate wild-card supply.
- `industry-values.yaml`: build costs, resource requirements, cube production, and income-on-flip.
- `industry-tiles-v2.yaml`: authoritative 45-tile per-player manifest with all printed face values.
- `board-v2.yaml`: authoritative retail-board locations, build and merchant spaces, physical links, and player-count rules.
- `income-track.yaml`: all 101 printed progress spaces plus loan and round-income rules.
- `merchant-tiles.yaml`: the nine retail Merchant tile faces and player-count bands.
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

- `src/engine/rules/generated/ruleset.ts`
- `src/engine/rules/generated/cards.ts`
- `src/engine/rules/generated/industry-values.ts`
- `src/engine/rules/generated/industry-tiles-v2.ts`
- `src/engine/rules/generated/board-v2.ts`
- `src/engine/rules/generated/income-track.ts`
- `src/engine/rules/generated/merchant-tiles.ts`
- `src/engine/board/generated/topology.ts`

## Validate

```bash
pnpm vitest run
pnpm vitest run --coverage
```
