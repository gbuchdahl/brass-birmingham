import { describe, expect, it } from "vitest";
import { createGame } from "@/engine";
import { buildLink } from "@/engine/board/api";
import { moveCoalToMarket, resolveCoal, resolveIron } from "@/engine/rules/resources";
import { coalMarketPrice } from "@/engine/rules/config";

describe("resolveCoal", () => {
  it("consumes connected coal from board first", () => {
    const baseState = {
      ...createGame(["A", "B"], "resources-tile-first"),
      phase: "rail" as const,
    };
    const state = {
      ...baseState,
      board: {
        ...baseState.board,
        tiles: {
          "tile-coal-nuneaton": {
            id: "tile-coal-nuneaton",
            city: "Nuneaton",
            industry: "coal" as const,
            owner: "A",
            level: 1,
            resourcesRemaining: 2,
            incomeOnFlip: 2,
            flipped: false,
          },
        },
      },
    };
    const connectivityState = buildLink(state, "A", "Coventry", "Nuneaton", "rail");

    const result = resolveCoal(state, "A", {
      requiredUnits: 1,
      connectedTo: ["Coventry", "Nuneaton"],
      connectivityState,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.sources[0]?.kind).toBe("tile");
    expect(result.sources[0]).toMatchObject({ tileId: "tile-coal-nuneaton" });
    expect(result.spend).toBe(0);
    expect(result.state.board.tiles["tile-coal-nuneaton"].resourcesRemaining).toBe(
      state.board.tiles["tile-coal-nuneaton"].resourcesRemaining - 1,
    );
  });

  it("uses cheapest coal market slot when no connected coal tiles exist", () => {
    const base = {
      ...createGame(["A", "B"], "resources-market-first"),
      phase: "rail" as const,
    };
    const state = {
      ...base,
      board: {
        ...base.board,
        tiles: Object.fromEntries(
          Object.entries(base.board.tiles).map(([id, tile]) => [
            id,
            { ...tile, resourcesRemaining: 0, incomeOnFlip: tile.incomeOnFlip ?? 0, flipped: true },
          ]),
        ),
      },
    };

    expect(state.market.coal.units).toBeGreaterThan(0);
    const price = coalMarketPrice(state.market.coal.units);
    const connectivityState = buildLink(state, "A", "Coventry", "Nuneaton", "rail");
    const result = resolveCoal(state, "A", {
      requiredUnits: 1,
      connectedTo: ["Coventry", "Nuneaton"],
      connectivityState,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.sources[0]).toMatchObject({ kind: "market", price });
    expect(result.spend).toBe(price);
    expect(result.state.market.coal.units).toBe(state.market.coal.units - 1);
    expect(result.state.players.A.money).toBe(state.players.A.money - price);
  });

  it("uses fallback coal price when market is empty", () => {
    const base = {
      ...createGame(["A", "B"], "resources-fallback"),
      phase: "rail" as const,
    };
    const state = {
      ...base,
      board: {
        ...base.board,
        tiles: Object.fromEntries(
          Object.entries(base.board.tiles).map(([id, tile]) => [
            id,
            { ...tile, resourcesRemaining: 0, incomeOnFlip: tile.incomeOnFlip ?? 0, flipped: true },
          ]),
        ),
      },
      market: {
        ...base.market,
        coal: {
          ...base.market.coal,
          units: 0,
        },
      },
    };
    const connectivityState = buildLink(state, "A", "Coventry", "Nuneaton", "rail");

    const result = resolveCoal(state, "A", {
      requiredUnits: 1,
      connectedTo: ["Coventry", "Nuneaton"],
      connectivityState,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.sources[0]).toMatchObject({
      kind: "fallback",
      price: state.market.coal.fallbackPrice,
    });
    expect(result.spend).toBe(state.market.coal.fallbackPrice);
    expect(result.state.players.A.money).toBe(
      state.players.A.money - state.market.coal.fallbackPrice,
    );
  });

  it("selects connected coal tiles deterministically by tile id", () => {
    const base = {
      ...createGame(["A", "B"], "resources-deterministic"),
      phase: "rail" as const,
    };
    const state = {
      ...base,
      board: {
        ...base.board,
        tiles: {
          ...base.board.tiles,
          "tile-coal-a": {
            id: "tile-coal-a",
            city: "Nuneaton" as const,
            industry: "coal" as const,
            owner: "A",
            level: 1,
            resourcesRemaining: 1,
            incomeOnFlip: 1,
            flipped: false,
          },
          "tile-coal-z": {
            id: "tile-coal-z",
            city: "Nuneaton" as const,
            industry: "coal" as const,
            owner: "A",
            level: 1,
            resourcesRemaining: 1,
            incomeOnFlip: 1,
            flipped: false,
          },
        },
      },
    };
    const connectivityState = buildLink(state, "A", "Coventry", "Nuneaton", "rail");

    const result = resolveCoal(state, "A", {
      requiredUnits: 1,
      connectedTo: ["Coventry", "Nuneaton"],
      connectivityState,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sources[0]).toMatchObject({ kind: "tile", tileId: "tile-coal-a" });
  });

  it("requires port connectivity to move coal from tile to market", () => {
    const state = {
      ...createGame(["A", "B"], "coal-port-access"),
      board: {
        ...createGame(["A", "B"], "coal-port-access").board,
        tiles: {
          "tile-coal-stafford": {
            id: "tile-coal-stafford",
            city: "Stafford",
            industry: "coal" as const,
            owner: "A",
            level: 1,
            resourcesRemaining: 1,
            incomeOnFlip: 1,
            flipped: false,
          },
        },
      },
    };
    const moved = moveCoalToMarket(state, "tile-coal-stafford");
    expect(moved.moved).toBe(0);
    expect(moved.state.board.tiles["tile-coal-stafford"].resourcesRemaining).toBe(1);
  });

  it("consumes iron from board without connectivity requirements", () => {
    const state = {
      ...createGame(["A", "B"], "iron-no-connectivity"),
      board: {
        ...createGame(["A", "B"], "iron-no-connectivity").board,
        tiles: {
          "tile-iron-dudley": {
            id: "tile-iron-dudley",
            city: "Dudley",
            industry: "iron" as const,
            owner: "A",
            level: 1,
            resourcesRemaining: 1,
            incomeOnFlip: 1,
            flipped: false,
          },
        },
      },
    };

    const result = resolveIron(state, "B", { requiredUnits: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sources[0]).toMatchObject({ kind: "tile", tileId: "tile-iron-dudley" });
    expect(result.state.players.A.income).toBe(state.players.A.income + 1);
  });
});
