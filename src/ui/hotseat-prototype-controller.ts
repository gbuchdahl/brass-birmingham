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
