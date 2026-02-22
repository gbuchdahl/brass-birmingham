import { describe, expect, it } from "vitest";
import { createGame, reduce } from "@/engine";
import { buildLink } from "@/engine/board/api";
import { makeTile, withSingleCardInHand, withTiles } from "./helpers";
import { expectInvalid, expectOk } from "./reducer.shared";

const WILD_CARD = { id: "test-wild", kind: "Wild" as const };
const STAFFORD_LOCATION = {
  id: "test-location-stafford",
  kind: "Location" as const,
  payload: { city: "Stafford" },
};
const COVENTRY_LOCATION = {
  id: "test-location-coventry",
  kind: "Location" as const,
  payload: { city: "Coventry" },
};
const COAL_INDUSTRY = {
  id: "test-industry-coal",
  kind: "Industry" as const,
  payload: { industry: "Coal" },
};
const IRON_INDUSTRY = {
  id: "test-industry-iron",
  kind: "Industry" as const,
  payload: { industry: "Iron" },
};

function buildCoalAction(cardId: string) {
  return {
    type: "BUILD_INDUSTRY" as const,
    player: "A",
    city: "Stafford" as const,
    industry: "coal" as const,
    level: 1,
    cardId,
  };
}

describe("reduce BUILD_INDUSTRY", () => {
  it("rejects BUILD_INDUSTRY from non-current player", () => {
    const state = withSingleCardInHand(createGame(["A", "B"], "build-industry-wrong-player"), "B", WILD_CARD);
    expectInvalid(
      reduce(state, { ...buildCoalAction("test-wild"), player: "B" }),
      state,
      "NOT_CURRENT_PLAYER",
    );
  });

  it("rejects when card is missing from hand", () => {
    const state = createGame(["A", "B"], "build-industry-no-card");
    expectInvalid(
      reduce(state, buildCoalAction("not-in-hand")),
      state,
      "CARD_NOT_IN_HAND",
    );
  });

  it("rejects location card for wrong city", () => {
    const state = withSingleCardInHand(createGame(["A", "B"], "build-industry-location-mismatch"), "A", COVENTRY_LOCATION);
    expectInvalid(
      reduce(state, buildCoalAction(COVENTRY_LOCATION.id)),
      state,
      "CARD_DOES_NOT_ALLOW_BUILD",
    );
  });

  it("rejects industry card for wrong industry", () => {
    const state = withSingleCardInHand(createGame(["A", "B"], "build-industry-kind-mismatch"), "A", IRON_INDUSTRY);
    expectInvalid(
      reduce(state, buildCoalAction(IRON_INDUSTRY.id)),
      state,
      "CARD_DOES_NOT_ALLOW_BUILD",
    );
  });

  it("rejects industry card when city is not in player network", () => {
    const state = withSingleCardInHand(createGame(["A", "B"], "build-industry-no-network"), "A", COAL_INDUSTRY);
    expectInvalid(
      reduce(state, buildCoalAction(COAL_INDUSTRY.id)),
      state,
      "BUILD_NOT_CONNECTED_FOR_CARD",
    );
  });

  it("rejects unsupported city/industry slots", () => {
    const state = withSingleCardInHand(createGame(["A", "B"], "build-industry-illegal-city"), "A", WILD_CARD);
    const action = {
      type: "BUILD_INDUSTRY" as const,
      player: "A",
      city: "Coventry" as const,
      industry: "coal" as const,
      level: 1,
      cardId: WILD_CARD.id,
    };
    expectInvalid(reduce(state, action), state, "ILLEGAL_INDUSTRY_BUILD");
  });

  it("rejects duplicate unflipped industry in a city", () => {
    const base = withSingleCardInHand(createGame(["A", "B"], "build-industry-duplicate"), "A", WILD_CARD);
    const state = withTiles(base, {
      "tile-coal-stafford": makeTile("tile-coal-stafford", {
        city: "Stafford",
        industry: "coal",
      }),
    });

    expectInvalid(reduce(state, buildCoalAction(WILD_CARD.id)), state, "ILLEGAL_INDUSTRY_BUILD");
  });

  it("rejects unsupported level", () => {
    const state = withSingleCardInHand(createGame(["A", "B"], "build-industry-bad-level"), "A", WILD_CARD);
    const action = { ...buildCoalAction(WILD_CARD.id), level: 2 };
    expectInvalid(reduce(state, action), state, "ILLEGAL_INDUSTRY_BUILD");
  });

  it("rejects when base build cost is unaffordable", () => {
    const base = withSingleCardInHand(createGame(["A", "B"], "build-industry-no-money"), "A", WILD_CARD);
    const state = {
      ...base,
      players: {
        ...base.players,
        A: { ...base.players.A, money: 0 },
      },
    };
    expectInvalid(reduce(state, buildCoalAction(WILD_CARD.id)), state, "ILLEGAL_INDUSTRY_BUILD");
  });

  it("rejects when required coal cannot be afforded", () => {
    const base = withSingleCardInHand(createGame(["A", "B"], "build-industry-no-coal-cash"), "A", WILD_CARD);
    const state = {
      ...base,
      market: {
        ...base.market,
        coal: { ...base.market.coal, units: 0 },
      },
      players: {
        ...base.players,
        A: { ...base.players.A, money: base.market.coal.fallbackPrice - 1 },
      },
    };

    expectInvalid(reduce(state, buildCoalAction(WILD_CARD.id)), state, "INSUFFICIENT_RESOURCES");
  });

  it("builds with wild card, consumes and discards card, and logs resource provenance", () => {
    const state = { ...withSingleCardInHand(createGame(["A", "B"], "build-industry-wild"), "A", WILD_CARD), round: 2 };
    const next = expectOk(reduce(state, buildCoalAction(WILD_CARD.id)));
    const event = next.log[next.log.length - 1];

    expect(next.players.A.hand).toEqual([]);
    expect(next.deck.discard).toContain(WILD_CARD.id);
    expect(event).toMatchObject({
      type: "BUILD_INDUSTRY",
      data: {
        cardId: WILD_CARD.id,
        cardKind: "Wild",
        discardedCardId: WILD_CARD.id,
      },
    });
  });

  it("builds with location card and applies coal requirement + spend", () => {
    const state = { ...withSingleCardInHand(createGame(["A", "B"], "build-industry-location"), "A", STAFFORD_LOCATION), round: 2 };
    const beforeMoney = state.players.A.money;
    const next = expectOk(reduce(state, buildCoalAction(STAFFORD_LOCATION.id)));
    const event = next.log[next.log.length - 1];

    expect(next.players.A.money).toBeLessThan(beforeMoney);
    expect(event).toMatchObject({
      type: "BUILD_INDUSTRY",
      data: {
        cardKind: "Location",
        resourceSources: {
          coal: { required: 1 },
        },
      },
    });
  });

  it("builds with industry card when connected to network", () => {
    const base = { ...withSingleCardInHand(createGame(["A", "B"], "build-industry-networked"), "A", COAL_INDUSTRY), round: 2 };
    const connected = buildLink(base, "A", "Stafford", "Warrington", "canal");

    const next = expectOk(reduce(connected, buildCoalAction(COAL_INDUSTRY.id)));
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "BUILD_INDUSTRY",
      data: { cardKind: "Industry" },
    });
  });

  it("builds iron and moves output to market immediately", () => {
    const state = { ...withSingleCardInHand(createGame(["A", "B"], "build-iron"), "A", WILD_CARD), round: 2 };
    const action = {
      type: "BUILD_INDUSTRY" as const,
      player: "A",
      city: "Dudley" as const,
      industry: "iron" as const,
      level: 1,
      cardId: WILD_CARD.id,
    };

    const next = expectOk(reduce(state, action));
    const event = next.log[next.log.length - 1];
    expect(event).toMatchObject({
      type: "BUILD_INDUSTRY",
      data: {
        industry: "iron",
        marketMoved: 1,
        flipped: true,
        resourceSources: {
          iron: { required: 1 },
        },
      },
    });
  });
});
