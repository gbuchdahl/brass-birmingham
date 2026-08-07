import {
  hideHotseatHand,
  submitHotseatCommand,
  toHotseatViewModel,
  type HotseatSession,
} from "@/ui/hotseat-session";
import {
  selectedHotseatSellCommand,
  toHotseatPrototypeModel,
} from "@/ui/hotseat-prototype-model";

/**
 * Submits the exact progressive Sell currently selected in a revealed session.
 * A Gloucester follow-up immediately returns to a privacy-safe handoff so the
 * pending player's tile choice is never left mounted after the Sell click.
 */
export function submitSelectedHotseatSell(
  session: HotseatSession,
): HotseatSession {
  const privateModel = toHotseatPrototypeModel(
    toHotseatViewModel(session),
    session.state,
  ).private;
  if (privateModel === null) return session;
  const command = selectedHotseatSellCommand(privateModel);
  if (command === null) return session;
  const submitted = submitHotseatCommand(session, command);
  return submitted.state.progress.phase === "merchant_free_develop"
    ? hideHotseatHand(submitted)
    : submitted;
}

/**
 * Submits only an exact, complete public settlement selection for the current
 * authoritative revision. Malformed/stale drafts and incomplete prefixes are
 * inert, so the reducer never receives an inferred fallback choice map.
 */
export function submitSelectedHotseatLiquidation(
  session: HotseatSession,
): HotseatSession {
  const boundary = toHotseatPrototypeModel(
    toHotseatViewModel(session),
    session.state,
    session.draft,
  ).boundary;
  if (
    boundary?.kind !== "round_settlement" ||
    boundary.liquidation?.availability !== "exact" ||
    !boundary.liquidation.ready ||
    boundary.liquidation.liquidationChoices === null
  ) return session;
  return submitHotseatCommand(session, {
    type: "SETTLE_ROUND",
    liquidationChoices: boundary.liquidation.liquidationChoices,
  });
}
