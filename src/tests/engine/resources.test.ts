import { describe, expect, it } from "vitest";
import { createGame } from "@/engine";
import { buildLink } from "@/engine/board/api";
import {
  MAX_COAL_MARKET_UNITS,
  MAX_IRON_MARKET_UNITS,
  coalMarketPrice,
  ironMarketPrice,
} from "@/engine/rules/config";
import { moveCoalToMarket, moveIronToMarket, resolveCoal, resolveIron } from "@/engine/rules/resources";
import { makeTile, withTiles } from "./helpers";

describe("resolveCoal", () => {
  it("consumes connected coal from board first", () => {
    const base = { ...createGame(["A", "B"], "resources-tile-first"), phase: "rail" as const };
    const state = withTiles(base, {
      "tile-coal-nuneaton": makeTile("tile-coal-nuneaton", {
        city: "Nuneaton",
        industry: "coal",
        resourcesRemaining: 2,
        incomeOnFlip: 2,
      }),
    });
    const connectivityState = buildLink(state, "A", "Coventry", "Nuneaton", "rail");

    const result = resolveCoal(state, "A", {
      requiredUnits: 1,
      connectedTo: ["Coventry", "Nuneaton"],
      connectivityState,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sources[0]).toMatchObject({ kind: "tile", tileId: "tile-coal-nuneaton" });
    expect(result.spend).toBe(0);
    expect(result.state.board.tiles["tile-coal-nuneaton"].resourcesRemaining).toBe(1);
  });

  it("uses market price when no connected coal tiles exist", () => {
    const state = { ...createGame(["A", "B"], "resources-market-first"), phase: "rail" as const };
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
  });

  it("uses fallback price when market is empty", () => {
    const base = { ...createGame(["A", "B"], "resources-fallback"), phase: "rail" as const };
    const state = {
      ...base,
      market: { ...base.market, coal: { ...base.market.coal, units: 0 } },
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
  });

  it("resolves multi-unit coal deterministically across tile then market", () => {
    const base = { ...createGame(["A", "B"], "resources-multi"), phase: "rail" as const };
    const state = withTiles(base, {
      "tile-coal-a": makeTile("tile-coal-a", {
        city: "Nuneaton",
        industry: "coal",
        resourcesRemaining: 1,
      }),
    });
    const connectivityState = buildLink(state, "A", "Coventry", "Nuneaton", "rail");
    const marketPrice = coalMarketPrice(state.market.coal.units);

    const result = resolveCoal(state, "A", {
      requiredUnits: 2,
      connectedTo: ["Coventry", "Nuneaton"],
      connectivityState,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sources).toMatchObject([
      { kind: "tile", tileId: "tile-coal-a" },
      { kind: "market", price: marketPrice },
    ]);
    expect(result.spend).toBe(marketPrice);
  });
});

describe("coal market movement", () => {
  it("requires port connectivity to move coal tile resources to market", () => {
    const state = withTiles(createGame(["A", "B"], "coal-port-access"), {
      "tile-coal-stafford": makeTile("tile-coal-stafford", {
        city: "Stafford",
        industry: "coal",
        resourcesRemaining: 1,
      }),
    });

    const moved = moveCoalToMarket(state, "tile-coal-stafford");
    expect(moved.moved).toBe(0);
    expect(moved.state.board.tiles["tile-coal-stafford"].resourcesRemaining).toBe(1);
  });

  it("does not overfill coal market capacity", () => {
    const connected = buildLink(
      withTiles(createGame(["A", "B"], "coal-market-cap"), {
        "tile-coal-stafford": makeTile("tile-coal-stafford", {
          city: "Stafford",
          industry: "coal",
          resourcesRemaining: 2,
        }),
      }),
      "A",
      "Stafford",
      "Warrington",
      "canal",
    );
    const state = {
      ...connected,
      market: {
        ...connected.market,
        coal: { ...connected.market.coal, units: MAX_COAL_MARKET_UNITS },
      },
    };

    const moved = moveCoalToMarket(state, "tile-coal-stafford");
    expect(moved.moved).toBe(0);
    expect(moved.state.market.coal.units).toBe(MAX_COAL_MARKET_UNITS);
    expect(moved.state.board.tiles["tile-coal-stafford"].resourcesRemaining).toBe(2);
  });
});

describe("resolveIron", () => {
  it("consumes iron from board without connectivity requirements", () => {
    const state = withTiles(createGame(["A", "B"], "iron-no-connectivity"), {
      "tile-iron-dudley": makeTile("tile-iron-dudley", {
        city: "Dudley",
        industry: "iron",
        owner: "A",
      }),
    });

    const result = resolveIron(state, "B", { requiredUnits: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sources[0]).toMatchObject({ kind: "tile", tileId: "tile-iron-dudley" });
    expect(result.state.players.A.income).toBe(state.players.A.income + 1);
  });

  it("uses market then fallback when iron market is depleted", () => {
    const base = createGame(["A", "B"], "iron-market-fallback");
    const state = {
      ...base,
      market: {
        ...base.market,
        iron: { ...base.market.iron, units: 1 },
      },
    };
    const marketPrice = ironMarketPrice(1);
    const fallback = state.market.iron.fallbackPrice;

    const result = resolveIron(state, "A", { requiredUnits: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sources).toMatchObject([
      { kind: "market", price: marketPrice },
      { kind: "fallback", price: fallback },
    ]);
    expect(result.spend).toBe(marketPrice + fallback);
  });

  it("returns insufficient resources when fallback iron is unaffordable", () => {
    const base = createGame(["A", "B"], "iron-unaffordable");
    const state = {
      ...base,
      market: {
        ...base.market,
        iron: { ...base.market.iron, units: 0 },
      },
      players: {
        ...base.players,
        A: { ...base.players.A, money: base.market.iron.fallbackPrice - 1 },
      },
    };

    const result = resolveIron(state, "A", { requiredUnits: 1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INSUFFICIENT_RESOURCES");
  });
});

describe("iron market movement", () => {
  it("does not overfill iron market capacity", () => {
    const state = {
      ...withTiles(createGame(["A", "B"], "iron-market-cap"), {
        "tile-iron-dudley": makeTile("tile-iron-dudley", {
          city: "Dudley",
          industry: "iron",
          resourcesRemaining: 1,
        }),
      }),
      market: {
        ...createGame(["A", "B"], "iron-market-cap").market,
        iron: {
          ...createGame(["A", "B"], "iron-market-cap").market.iron,
          units: MAX_IRON_MARKET_UNITS,
        },
      },
    };

    const moved = moveIronToMarket(state, "tile-iron-dudley");
    expect(moved.moved).toBe(0);
    expect(moved.state.market.iron.units).toBe(MAX_IRON_MARKET_UNITS);
  });
});
