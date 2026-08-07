import type { PlayableCardId } from "@/engine/cards-v2/types";
import type { HotseatPrototypeModel } from "@/ui/hotseat-prototype-model";

type GameV2HotseatPrototypeProps = {
  readonly model: HotseatPrototypeModel;
  readonly onReveal: () => void;
  readonly onHide: () => void;
  readonly onSelectCard: (cardId: PlayableCardId) => void;
  readonly onToggleScoutCard: (cardId: PlayableCardId) => void;
  readonly onSelectNetworkLink: (linkId: string) => void;
  readonly onSelectRailNetworkPlan: (planId: string) => void;
  readonly onSelectBuildPlan: (planId: string) => void;
  readonly onSelectDevelopPlan: (planId: string) => void;
  readonly onSelectSellNextOption: (optionId: string) => void;
  readonly onSelectMerchantFreeDevelop: (selectionId: string) => void;
  readonly onPass: () => void;
  readonly onLoan: () => void;
  readonly onScout: () => void;
  readonly onNetwork: () => void;
  readonly onAppendRailNetworkPlan: () => void;
  readonly onClearRailNetwork: () => void;
  readonly onBuild: () => void;
  readonly onDevelop: () => void;
  readonly onAppendSellSale: () => void;
  readonly onClearSell: () => void;
  readonly onSell: () => void;
  readonly onResolveMerchantFreeDevelop: () => void;
  readonly onAcknowledgeLiquidation: (seat: string) => void;
  readonly onLiquidateIndustry: (seat: string, buildSpaceId: string) => void;
  readonly onClearLiquidation: () => void;
  readonly onSettleRound: () => void;
  readonly onResolveEra: () => void;
};

const panel =
  "rounded-lg border border-slate-300 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-950";
const inset =
  "rounded border border-slate-200 bg-slate-50 p-3 dark:border-neutral-800 dark:bg-neutral-900";
const primaryButton =
  "rounded border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-400 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white";
const secondaryButton =
  "rounded border border-slate-400 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800";

function Emoji({ children }: { readonly children: string }) {
  return <span aria-hidden="true">{children}</span>;
}

export function GameV2HotseatPrototype({
  model,
  onReveal,
  onHide,
  onSelectCard,
  onToggleScoutCard,
  onSelectNetworkLink,
  onSelectRailNetworkPlan,
  onSelectBuildPlan,
  onSelectDevelopPlan,
  onSelectSellNextOption,
  onSelectMerchantFreeDevelop,
  onPass,
  onLoan,
  onScout,
  onNetwork,
  onAppendRailNetworkPlan,
  onClearRailNetwork,
  onBuild,
  onDevelop,
  onAppendSellSale,
  onClearSell,
  onSell,
  onResolveMerchantFreeDevelop,
  onAcknowledgeLiquidation,
  onLiquidateIndustry,
  onClearLiquidation,
  onSettleRound,
  onResolveEra,
}: GameV2HotseatPrototypeProps) {
  const game = model.public;
  const selectedCardId = model.private?.selectedCardId ?? null;
  const selectedScoutCardIds = model.private?.selectedScoutCardIds ?? [];
  const selectedDevelopPlan = model.private?.legal.develop.plans.find(
    (plan) => plan.id === model.private?.selectedDevelopPlanId,
  ) ?? null;
  const selectedSellNextOption = model.private?.legal.sell.nextOptions.find(
    (option) => option.id === model.private?.selectedSellNextOptionId,
  ) ?? null;
  const selectedRailNextPlan = model.private?.legal.railNetwork.nextPlans.find(
    (plan) => plan.id === model.private?.legal.railNetwork.selectedNextPlanId,
  ) ?? null;

  return (
    <div className="space-y-5">
      <section className={panel}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="rounded border border-emerald-600 bg-emerald-50 px-2 py-1 text-xs font-bold tracking-wide text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                HOT-SEAT ALPHA
              </span>
              <span className="rounded border border-slate-400 px-2 py-1 text-xs font-bold tracking-wide">
                BUILD + DEVELOP + SELL + PASS + LOAN + SCOUT + CANAL + RAIL NETWORK
              </span>
            </div>
            <h1 className="text-2xl font-bold">Brass: Birmingham playable prototype</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">
              Pass the device between players. Only the revealed player&apos;s hand is mounted.
            </p>
          </div>
          <div className="text-right font-mono text-xs text-slate-500 dark:text-neutral-400">
            <p>{game.identity.gameId}</p>
            <p>revision {game.identity.revision}</p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Era", game.turn.era],
            ["Round", game.turn.round],
            ["Turn", game.turn.turnNumber],
            ["Current", game.turn.currentSeat],
            ["Actions", `${game.turn.actionsUsed}/${game.turn.actionLimit}`],
            ["Phase", game.progress.phase],
          ].map(([label, value]) => (
            <div className={inset} key={label}>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                {label}
              </dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {model.feedback?.kind === "error" ? (
        <section
          className="rounded-lg border border-red-500 bg-red-50 p-4 text-red-950 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          <p className="font-bold">Action rejected</p>
          <p className="mt-1 text-sm">{model.feedback.message}</p>
          <p className="mt-2 font-mono text-xs">
            {model.feedback.source}:{model.feedback.code} · {model.feedback.commandId}
          </p>
        </section>
      ) : null}

      {model.feedback?.kind === "accepted" ? (
        <section
          aria-live="polite"
          className="rounded-lg border border-emerald-500 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
          role="status"
        >
          <p className="font-bold">{model.feedback.message}</p>
          <p className="mt-1 font-mono text-xs">{model.feedback.commandId}</p>
        </section>
      ) : null}

      {model.handoff ? (
        <section className={`${panel} text-center`} aria-labelledby="handoff-title">
          <p className="text-4xl"><Emoji>🙈</Emoji></p>
          <h2 className="mt-2 text-2xl font-bold" id="handoff-title">
            Pass the device to {model.handoff.nextSeat}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-neutral-300">
            No private hand, draft, or follow-up choices are visible. When everyone else is looking away, reveal the current player&apos;s view.
          </p>
          <button autoFocus className={`${primaryButton} mt-4`} onClick={onReveal} type="button">
            <Emoji>👁️</Emoji> Reveal {model.handoff.nextSeat}&apos;s private view
          </button>
        </section>
      ) : null}

      {model.boundary?.kind === "round_settlement" ? (
        <section className={panel} aria-labelledby="round-settlement-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold" id="round-settlement-title">
                <Emoji>💷</Emoji> Round complete
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-neutral-300">
                Settle negative income publicly. When cash is short, choose one
                industry at a time to liquidate; no private hand is revealed.
              </p>
            </div>
            <button
              className={secondaryButton}
              onClick={onClearLiquidation}
              type="button"
            >
              Clear / restart settlement
            </button>
          </div>

          {model.boundary.draftIssue !== null ? (
            <div
              className="mt-4 rounded border border-red-500 bg-red-50 p-3 text-sm text-red-950 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100"
              role="alert"
            >
              <p className="font-bold">Settlement draft cannot be used</p>
              <p className="mt-1">{model.boundary.draftIssue}</p>
              <p className="mt-1">Clear the draft to restart from the authoritative state.</p>
            </div>
          ) : null}

          {model.boundary.liquidation?.availability === "disabled" ? (
            <div
              className="mt-4 rounded border border-red-500 bg-red-50 p-3 text-sm text-red-950 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100"
              role="alert"
            >
              <p className="font-bold">Settlement choices are invalid</p>
              <p className="mt-1">{model.boundary.liquidation.reason?.message}</p>
            </div>
          ) : null}

          {model.boundary.liquidation?.availability === "exact" &&
              model.boundary.liquidation.finalRailIncomeSkipped ? (
            <div className={`${inset} mt-4`}>
              <p className="font-semibold">Final Rail round</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">
                Income and liquidation are skipped. Continue with the exact empty settlement.
              </p>
            </div>
          ) : null}

          {model.boundary.liquidation?.availability === "exact" &&
              !model.boundary.liquidation.finalRailIncomeSkipped ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {model.boundary.liquidation.seats.length === 0 ? (
                <div className={inset}>
                  <p className="font-semibold">No negative income payments</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">
                    No player needs to liquidate an industry this round.
                  </p>
                </div>
              ) : null}

              {model.boundary.liquidation.seats.map((seat) => (
                <article className={inset} key={seat.seat}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold">{seat.seat}</h3>
                      <p className="mt-1 text-sm">
                        Income {seat.incomeLevel} · owes £{seat.requiredPayment} · cash £{seat.cashBefore}
                      </p>
                    </div>
                    <span
                      className={`rounded border px-2 py-1 text-xs font-bold ${
                        seat.ready
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                          : "border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                      }`}
                    >
                      {seat.ready
                        ? "READY"
                        : seat.coverage === "covered_by_cash"
                          ? "CONFIRM PAYMENT"
                          : seat.coverage === "assets_exhausted"
                            ? "CONFIRM SHORTFALL"
                            : `£${seat.remainingShortfall} SHORT`}
                    </span>
                  </div>

                  {seat.selectedAssets.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                        Industries selected for liquidation
                      </p>
                      <ol className="mt-1 grid gap-1 text-sm">
                        {seat.selectedAssets.map((asset, index) => (
                          <li key={asset.buildSpaceId}>
                            {index + 1}. {asset.locationLabel} · {asset.industry} level {asset.level} · £{asset.liquidationValue}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-neutral-400">Sale proceeds</dt>
                      <dd className="font-semibold">£{seat.liquidationProceeds}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-neutral-400">Cash after</dt>
                      <dd className="font-semibold">£{seat.preview.moneyAfter}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-neutral-400">VP after</dt>
                      <dd className="font-semibold">
                        {seat.preview.victoryPointsAfter}
                        {seat.preview.victoryPointsLost > 0
                          ? ` (-${seat.preview.victoryPointsLost})`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-neutral-400">Unpaid</dt>
                      <dd className="font-semibold">£{seat.preview.unpaidShortfall}</dd>
                    </div>
                  </dl>

                  {!seat.acknowledged && seat.coverage !== "shortfall" ? (
                    <button
                      className={`${secondaryButton} mt-3`}
                      onClick={() => onAcknowledgeLiquidation(seat.seat)}
                      type="button"
                    >
                      {seat.coverage === "covered_by_cash"
                        ? `Confirm ${seat.seat} pays from cash`
                        : `Confirm ${seat.seat} has no useful assets`}
                    </button>
                  ) : null}

                  {seat.nextChoices.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                        Choose one next industry
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {seat.nextChoices.map((choice) => (
                          <button
                            className={secondaryButton}
                            key={choice.buildSpaceId}
                            onClick={() =>
                              onLiquidateIndustry(
                                seat.seat,
                                choice.buildSpaceId,
                              )}
                            type="button"
                          >
                            Liquidate {choice.locationLabel} {choice.industry} level {choice.level} for £{choice.liquidationValue}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          <button
            className={`${primaryButton} mt-4`}
            disabled={
              model.boundary.liquidation?.availability !== "exact" ||
              !model.boundary.liquidation.ready
            }
            onClick={onSettleRound}
            type="button"
          >
            Apply settlement and continue
          </button>
        </section>
      ) : null}

      {model.boundary?.kind === "era_transition" ? (
        <section className={panel}>
          <h2 className="text-xl font-bold"><Emoji>🏁</Emoji> Era complete</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-neutral-300">
            Score links and flipped industries, then continue to the next era or final standings.
          </p>
          <button className={`${primaryButton} mt-4`} onClick={onResolveEra} type="button">
            Score era and continue
          </button>
        </section>
      ) : null}

      {model.boundary?.kind === "merchant_free_develop" &&
          model.handoff === null && model.private === null ? (
        <section className={panel}>
          <h2 className="text-xl font-bold"><Emoji>🛒</Emoji> Merchant free Develop pending</h2>
          <p className="mt-2 text-sm">
            {model.boundary.seat} must remove {model.boundary.count} industry tile(s).
            Pass the device to that player to resolve the pending Sell follow-up.
          </p>
        </section>
      ) : null}

      {model.boundary?.kind === "ended" ? (
        <section className={panel}>
          <h2 className="text-2xl font-bold"><Emoji>🏆</Emoji> Final standings</h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {model.boundary.standings.map((standing) => (
              <li className={inset} key={standing.playerId}>
                <strong>#{standing.rank} {standing.playerId}</strong>
                <p className="mt-1 text-sm">
                  {standing.victoryPoints} VP · income {standing.incomeLevel} · £{standing.cash}
                  {standing.tied ? " · tied" : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {model.private?.mode === "merchant_free_develop" &&
          model.private.merchantFreeDevelop !== null ? (
        <section className={panel} aria-labelledby="merchant-develop-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold" id="merchant-develop-title">
                <Emoji>🛒</Emoji> {model.private.seat}&apos;s free Develop
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">
                Resolve the Merchant bonus before the parent Sell completes.
                Choose {model.private.merchantFreeDevelop.requiredCount} eligible top tile{model.private.merchantFreeDevelop.requiredCount === 1 ? "" : "s"} when available.
              </p>
            </div>
            <button className={secondaryButton} onClick={onHide} type="button">
              <Emoji>🙈</Emoji> Hide choices
            </button>
          </div>

          {model.private.merchantFreeDevelop.availability === "exact" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="grid gap-1 text-sm font-semibold">
                Free Develop selection
                <select
                  aria-label="Merchant free Develop selection"
                  className="rounded border border-slate-400 bg-white px-3 py-2 font-normal text-slate-950 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                  onChange={(event) =>
                    onSelectMerchantFreeDevelop(event.target.value)}
                  value={model.private.merchantFreeDevelop.selectedSelectionId ?? ""}
                >
                  <option value="">Choose an exact tile selection…</option>
                  {model.private.merchantFreeDevelop.selections.map((selection) => (
                    <option key={selection.id} value={selection.id}>
                      {selection.tiles.length === 0
                        ? `Skip ${selection.skippedCount} unavailable bonus${selection.skippedCount === 1 ? "" : "es"}`
                        : selection.tiles.map((tile) =>
                            `${tile.industryEmoji} ${tile.industryLabel} level ${tile.level}`
                          ).join(" + ")}
                      {selection.skippedCount > 0 && selection.tiles.length > 0
                        ? ` · skip ${selection.skippedCount} unavailable`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={primaryButton}
                disabled={!model.private.merchantFreeDevelop.selectionIsLegal}
                onClick={onResolveMerchantFreeDevelop}
                type="button"
              >
                <Emoji>⬆️</Emoji> Resolve free Develop
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm">
              <strong>Free Develop unavailable:</strong>{" "}
              {model.private.merchantFreeDevelop.reason?.message ??
                "No legal follow-up selection is available."}
            </p>
          )}
          <p aria-live="polite" className="mt-2 text-xs text-slate-600 dark:text-neutral-300">
            {model.private.merchantFreeDevelop.selectionIsLegal
              ? "Free Develop selection ready."
              : "Choose one complete selector-approved option."}
          </p>
        </section>
      ) : null}

      {model.private?.mode === "action" ? (
        <section className={panel} aria-labelledby="private-hand-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold" id="private-hand-title">
                <Emoji>🃏</Emoji> {model.private.seat}&apos;s private hand
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">
                Choose one action card for Build, Develop, Sell, Pass, Loan, or Canal Network; or toggle exactly three regular cards to Scout.
              </p>
            </div>
            <button className={secondaryButton} onClick={onHide} type="button">
              <Emoji>🙈</Emoji> Hide hand
            </button>
          </div>

          <fieldset className="mt-4">
            <legend className="text-sm font-bold">Choose cards</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {model.private.cards.map((card, index) => {
                const selected = card.id === selectedCardId;
                const selectedForScout = selectedScoutCardIds.includes(card.id);
                const scoutLimitReached = selectedScoutCardIds.length >= 3 &&
                  !selectedForScout;
                return (
                  <article
                    className={`rounded border p-2 text-sm transition ${
                      selected || selectedForScout
                        ? "border-amber-500 bg-amber-50 ring-2 ring-amber-300 dark:border-amber-600 dark:bg-amber-950/40 dark:ring-amber-800"
                        : "border-slate-300 bg-white hover:border-slate-500 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-500"
                    }`}
                    key={`${card.id}:${index}`}
                  >
                    <p className="px-1 pt-1 font-semibold"><Emoji>🃏</Emoji> {card.label}</p>
                    <span className="mt-1 block truncate font-mono text-[10px] text-slate-500 dark:text-neutral-400">
                      {card.id}
                    </span>
                    <div className="mt-2 grid gap-1">
                      <button
                        aria-label={`Use ${card.label} as the action card`}
                        aria-pressed={selected}
                        className={secondaryButton}
                        disabled={!card.canPass && !card.canLoan && !card.canNetwork && !card.canDevelop && !card.canSell}
                        onClick={() => onSelectCard(card.id)}
                        type="button"
                      >
                        {selected ? <Emoji>✅</Emoji> : <Emoji>⬜</Emoji>} Action card
                      </button>
                      <button
                        aria-label={`${selectedForScout ? "Remove" : "Add"} ${card.label} ${selectedForScout ? "from" : "to"} Scout selection`}
                        aria-pressed={selectedForScout}
                        className={secondaryButton}
                        disabled={!card.canScout || scoutLimitReached}
                        onClick={() => onToggleScoutCard(card.id)}
                        type="button"
                      >
                        {selectedForScout ? <Emoji>✅</Emoji> : <Emoji>⬜</Emoji>} Scout
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </fieldset>

          <fieldset className={`${inset} mt-4`}>
            <legend className="px-1 text-sm font-bold">
              <Emoji>⬆️</Emoji> Develop industry tiles
            </legend>
            {model.private.legal.develop.availability === "exact" ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="grid gap-1 text-sm font-semibold">
                  Exact Develop plan
                  <select
                    aria-label="Develop plan"
                    className="rounded border border-slate-400 bg-white px-3 py-2 font-normal text-slate-950 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                    onChange={(event) => onSelectDevelopPlan(event.target.value)}
                    value={model.private.selectedDevelopPlanId ?? ""}
                  >
                    <option value="">Choose ordered tiles and an iron source…</option>
                    {model.private.legal.develop.plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.tiles.map((tile) =>
                          `${tile.industryEmoji} ${tile.industryLabel} level ${tile.level}`
                        ).join(" → ")} · {plan.ironSummary} · £{plan.totalCost}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={primaryButton}
                  disabled={!model.private.legal.develop.selectionIsLegal}
                  onClick={onDevelop}
                  type="button"
                >
                  <Emoji>⬆️</Emoji> Develop selected tiles
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm">
                <strong>Develop unavailable:</strong>{" "}
                {model.private.legal.develop.reason?.message ??
                  "No exact Develop choices are available."}
              </p>
            )}
            {selectedDevelopPlan !== null ? (
              <div className="mt-3 rounded border border-slate-300 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                  Ordered removals
                </p>
                <ol className="mt-2 flex flex-wrap gap-2">
                  {selectedDevelopPlan.tiles.map((tile, index) => (
                    <li className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-neutral-700" key={`${tile.id}:${index}`}>
                      {index + 1}. <span aria-hidden="true">{tile.industryEmoji}</span>{" "}
                      {tile.industryLabel} level {tile.level}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs">
                  <strong>Iron:</strong> {selectedDevelopPlan.ironSummary} · <strong>Cost:</strong> £{selectedDevelopPlan.totalCost}
                </p>
              </div>
            ) : model.private.legal.develop.availability === "exact" ? (
              <p aria-live="polite" className="mt-2 text-xs text-slate-600 dark:text-neutral-300">
                Choose one complete selector-approved Develop plan.
              </p>
            ) : null}
          </fieldset>

          <fieldset className={`${inset} mt-4`}>
            <legend className="px-1 text-sm font-bold">
              <Emoji>📦</Emoji> Sell industries
            </legend>

            {model.private.legal.sell.currentPlan !== null ? (
              <div className="mt-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                  Accepted ordered sales
                </p>
                <ol className="mt-2 grid gap-2">
                  {model.private.legal.sell.currentPlan.sales.map((sale, index) => (
                    <li className="rounded border border-slate-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950" key={`${sale.productIndustryId}:${index}`}>
                      <strong>
                        {index + 1}. <span aria-hidden="true">{sale.productEmoji}</span>{" "}
                        {sale.productLabel} level {sale.productLevel} at {sale.productLocationLabel}
                      </strong>
                      <p className="mt-1 text-xs">
                        Product → Merchant at {sale.merchantLabel} → {sale.beerSummary}
                      </p>
                      <p className="mt-1 text-xs">Income: {sale.incomeSummary}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs">
                  <strong>Combined rewards:</strong>{" "}
                  {model.private.legal.sell.currentPlan.rewardSummary}
                  {model.private.legal.sell.currentPlan.pendingFreeDevelopCount > 0
                    ? ` · pending ${model.private.legal.sell.currentPlan.pendingFreeDevelopCount} free Develop`
                    : ""}
                </p>
              </div>
            ) : null}

            {model.private.legal.sell.availability === "exact" &&
                model.private.legal.sell.nextOptions.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="grid gap-1 text-sm font-semibold">
                  Next exact sale
                  <select
                    aria-label="Next Sell option"
                    className="rounded border border-slate-400 bg-white px-3 py-2 font-normal text-slate-950 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                    onChange={(event) => onSelectSellNextOption(event.target.value)}
                    value={model.private.selectedSellNextOptionId ?? ""}
                  >
                    <option value="">Choose product, Merchant, and mandatory beer…</option>
                    {model.private.legal.sell.nextOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.sale.productEmoji} {option.sale.productLabel} level {option.sale.productLevel} at {option.sale.productLocationLabel} → {option.sale.merchantLabel} → {option.sale.beerSummary} · {option.sale.incomeSummary}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={secondaryButton}
                  disabled={!model.private.legal.sell.selectedNextIsLegal}
                  onClick={onAppendSellSale}
                  type="button"
                >
                  <Emoji>➕</Emoji> Add this sale
                </button>
              </div>
            ) : model.private.legal.sell.availability === "disabled" ? (
              <p className="mt-2 text-sm">
                <strong>Sell unavailable:</strong>{" "}
                {model.private.legal.sell.reason?.message ??
                  "No exact Sell choices are available."}
              </p>
            ) : (
              <p className="mt-2 text-sm">No additional sale can be appended.</p>
            )}

            {selectedSellNextOption !== null ? (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs dark:border-amber-800 dark:bg-amber-950/30">
                <p>
                  <strong>Next:</strong>{" "}
                  {selectedSellNextOption.sale.productEmoji}{" "}
                  {selectedSellNextOption.sale.productLabel} → {selectedSellNextOption.sale.merchantLabel} → {selectedSellNextOption.sale.beerSummary}
                </p>
                <p className="mt-1">
                  Resulting rewards: {selectedSellNextOption.plan.rewardSummary}
                  {selectedSellNextOption.plan.pendingFreeDevelopCount > 0
                    ? ` · triggers ${selectedSellNextOption.plan.pendingFreeDevelopCount} free Develop`
                    : ""}
                </p>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={primaryButton}
                disabled={model.private.legal.sell.currentPlan === null}
                onClick={onSell}
                type="button"
              >
                <Emoji>📦</Emoji> Submit {model.private.legal.sell.currentPlan?.sales.length ?? 0} sale{model.private.legal.sell.currentPlan?.sales.length === 1 ? "" : "s"}
              </button>
              <button
                className={secondaryButton}
                disabled={model.private.legal.sell.currentPlan === null &&
                  model.private.selectedSellNextOptionId === null &&
                  model.private.legal.sell.reason?.code !== "INVALID_SALE_PREFIX"}
                onClick={onClearSell}
                type="button"
              >
                Clear / restart Sell
              </button>
            </div>
          </fieldset>

          <fieldset className={`${inset} mt-4`}>
            <legend className="px-1 text-sm font-bold">
              <Emoji>🏗️</Emoji> Build industry
            </legend>
            {model.private.legal.build.availability === "exact" ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="grid gap-1 text-sm font-semibold">
                  Exact Build plan
                  <select
                    aria-label="Build plan"
                    className="rounded border border-slate-400 bg-white px-3 py-2 font-normal text-slate-950 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                    onChange={(event) => onSelectBuildPlan(event.target.value)}
                    value={model.private.selectedBuildPlanId ?? ""}
                  >
                    <option value="">Choose a legal target and resource plan…</option>
                    {model.private.legal.build.plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.industryEmoji} {plan.locationLabel} {plan.buildSpaceLabel} · {plan.industryLabel} level {plan.tileLevel} · {plan.sourceSummary} · £{plan.totalCost}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={primaryButton}
                  disabled={!model.private.legal.build.selectionIsLegal}
                  onClick={onBuild}
                  type="button"
                >
                  <Emoji>🏗️</Emoji> Build selected industry
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm">
                <strong>Build unavailable:</strong>{" "}
                {model.private.legal.build.reason?.message ??
                  "No exact Build choices are available."}
              </p>
            )}
            {model.private.legal.build.availability === "exact" ? (
              <p aria-live="polite" className="mt-2 text-xs text-slate-600 dark:text-neutral-300">
                {model.private.selectedBuildPlanId === null
                  ? "Choose one complete target and resource-source plan."
                  : "Build selection ready. The authoritative engine will recheck it."}
              </p>
            ) : null}
          </fieldset>

          <fieldset className={`${inset} mt-4`}>
            <legend className="px-1 text-sm font-bold">
              {game.turn.era === "rail" ? (
                <><Emoji>🚂</Emoji> Rail Network</>
              ) : (
                <><Emoji>🛶</Emoji> Canal Network</>
              )}
            </legend>
            {game.turn.era === "rail" ? (
              model.private.legal.railNetwork.availability === "exact" ? (
                <div className="mt-2 space-y-3">
                  {model.private.legal.railNetwork.currentPlan === null ? null : (
                    <div className="rounded border border-emerald-400 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
                      <p className="font-bold">First link ready</p>
                      <p className="mt-1">
                        {model.private.legal.railNetwork.currentPlan.links[0].endpointLabel}
                        {" · "}
                        {model.private.legal.railNetwork.currentPlan.coalSources[0].summary}
                        {" · "}
                        {model.private.legal.railNetwork.currentPlan.outcomeSummary}
                      </p>
                      <p className="mt-1 text-xs">
                        Submit this one-link action now, or choose an exact second-link extension below.
                      </p>
                    </div>
                  )}

                  <label className="grid gap-1 text-sm font-semibold">
                    {model.private.legal.railNetwork.currentPlan === null
                      ? "Exact first-link plan"
                      : "Optional exact second-link extension"}
                    <select
                      aria-label={model.private.legal.railNetwork.currentPlan === null
                        ? "Rail first-link plan"
                        : "Rail second-link extension"}
                      className="rounded border border-slate-400 bg-white px-3 py-2 font-normal text-slate-950 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                      onChange={(event) =>
                        onSelectRailNetworkPlan(event.target.value)}
                      value={model.private.legal.railNetwork.selectedNextPlanId ?? ""}
                    >
                      <option value="">
                        {model.private.legal.railNetwork.currentPlan === null
                          ? "Choose one link and its coal source…"
                          : "Keep one link, or choose a two-link plan…"}
                      </option>
                      {model.private.legal.railNetwork.nextPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.links.map((link) =>
                            `${link.order}. ${link.endpointLabel}`
                          ).join(" then ")}
                          {" · "}
                          {plan.coalSources.map((source) => source.summary).join(" + ")}
                          {plan.beerSource === null
                            ? ""
                            : ` + ${plan.beerSource.summary}`}
                          {" · "}{plan.outcomeSummary}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedRailNextPlan === null ? null : (
                    <div className="grid gap-2 rounded border border-slate-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-950 sm:grid-cols-2">
                      <div>
                        <p className="font-bold">Selected route</p>
                        <ol className="mt-1 list-inside list-decimal">
                          {selectedRailNextPlan.links.map((link) => (
                            <li key={`${link.order}:${link.linkId}`}>
                              {link.endpointLabel}
                            </li>
                          ))}
                        </ol>
                        <p className="mt-1">
                          Coal: {selectedRailNextPlan.coalSources.map((source) =>
                            source.summary
                          ).join("; ")}
                        </p>
                        <p>
                          Beer: {selectedRailNextPlan.beerSource?.summary ??
                            "none for one link"}
                        </p>
                      </div>
                      <dl className="grid grid-cols-2 gap-1">
                        <dt>Total cost</dt>
                        <dd className="font-semibold">£{selectedRailNextPlan.costs.total}</dd>
                        <dt>Money after</dt>
                        <dd className="font-semibold">£{selectedRailNextPlan.playerResult.money}</dd>
                        <dt>Link tokens after</dt>
                        <dd className="font-semibold">{selectedRailNextPlan.playerResult.linkTokensRemaining}</dd>
                        <dt>Market coal after</dt>
                        <dd className="font-semibold">{selectedRailNextPlan.marketResult.coalAfter}</dd>
                        <dt>Industries flipped</dt>
                        <dd className="font-semibold">{selectedRailNextPlan.flippedIndustryIds.length}</dd>
                        <dt>Income awards</dt>
                        <dd className="font-semibold">{selectedRailNextPlan.incomeAwards.length}</dd>
                      </dl>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {model.private.legal.railNetwork.currentPlan === null ? (
                      <button
                        className={secondaryButton}
                        disabled={selectedRailNextPlan?.linkCount !== 1}
                        onClick={onAppendRailNetworkPlan}
                        type="button"
                      >
                        <Emoji>➕</Emoji> Keep first link and consider a second
                      </button>
                    ) : null}
                    <button
                      className={primaryButton}
                      disabled={model.private.legal.railNetwork.submissionPlan === null}
                      onClick={onNetwork}
                      type="button"
                    >
                      <Emoji>🚂</Emoji>{" "}
                      {model.private.legal.railNetwork.submissionPlan === null
                        ? "Build selected Rail plan"
                        : `Build ${model.private.legal.railNetwork.submissionPlan.linkCount} Rail link${model.private.legal.railNetwork.submissionPlan.linkCount === 1 ? "" : "s"}`}
                    </button>
                    <button
                      className={secondaryButton}
                      onClick={onClearRailNetwork}
                      type="button"
                    >
                      Clear Rail plan
                    </button>
                  </div>
                  <p aria-live="polite" className="text-xs text-slate-600 dark:text-neutral-300">
                    {model.private.legal.railNetwork.submissionPlan === null
                      ? "Choose an exact one-link plan. You may submit it directly or inspect legal two-link extensions."
                      : `Ready: ${model.private.legal.railNetwork.submissionPlan.outcomeSummary}. The authoritative engine will recheck it.`}
                  </p>
                </div>
              ) : (
                <div className="mt-2 text-sm">
                  <p>
                    <strong>Rail Network unavailable:</strong>{" "}
                    {model.private.legal.railNetwork.reason?.message ??
                      "No exact Rail Network choices are available."}
                  </p>
                  {model.private.legal.railNetwork.savedPrefixStatus === "empty"
                    ? null
                    : (
                      <button
                        className={`${secondaryButton} mt-2`}
                        onClick={onClearRailNetwork}
                        type="button"
                      >
                        Clear stale Rail plan
                      </button>
                    )}
                </div>
              )
            ) : model.private.legal.network.availability === "exact" ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="grid gap-1 text-sm font-semibold">
                  Link to build
                  <select
                    aria-label="Canal link"
                    className="rounded border border-slate-400 bg-white px-3 py-2 font-normal text-slate-950 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                    onChange={(event) => onSelectNetworkLink(event.target.value)}
                    value={model.private.selectedNetworkLinkId ?? ""}
                  >
                    <option value="">Choose a reachable Canal link…</option>
                    {model.private.legal.network.links.map((link) => (
                      <option key={link.linkId} value={link.linkId}>
                        {link.endpointLabel} · £{link.cost}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={primaryButton}
                  disabled={!model.private.legal.network.selectionIsLegal}
                  onClick={onNetwork}
                  type="button"
                >
                  <Emoji>🛶</Emoji> Build Canal link (£3)
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm">
                <strong>Canal Network unavailable:</strong>{" "}
                {model.private.legal.network.reason?.message ??
                  "No exact Canal Network choices are available."}
              </p>
            )}
            {game.turn.era === "canal" &&
                model.private.legal.network.availability === "exact" ? (
                  <p aria-live="polite" className="mt-2 text-xs text-slate-600 dark:text-neutral-300">
                    {!model.private.legal.network.selectedCardIsLegal
                      ? "Choose a selector-approved action card from your hand."
                      : model.private.selectedNetworkLinkId === null
                        ? "Choose one reachable link. Canal Network costs £3."
                        : "Canal Network selection ready."}
                  </p>
                ) : null}
          </fieldset>

          <div aria-live="polite" className="mt-4 space-y-1 text-sm">
            {model.private.legal.pass.reason ? (
              <p><strong>Pass unavailable:</strong> {model.private.legal.pass.reason.message}</p>
            ) : null}
            {model.private.legal.loan.reason ? (
              <p><strong>Loan unavailable:</strong> {model.private.legal.loan.reason.message}</p>
            ) : null}
            {model.private.legal.scout.reason ? (
              <p><strong>Scout unavailable:</strong> {model.private.legal.scout.reason.message}</p>
            ) : selectedScoutCardIds.length < 3 ? (
              <p>
                Scout: choose {3 - selectedScoutCardIds.length} more regular card{3 - selectedScoutCardIds.length === 1 ? "" : "s"}.
              </p>
            ) : model.private.legal.scout.selectionIsLegal ? (
              <p>Scout selection ready: exchange these three cards for both Wild cards.</p>
            ) : (
              <p>Scout unavailable: that three-card combination is not legal.</p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className={secondaryButton}
              disabled={!model.private.legal.pass.selectedIsLegal}
              onClick={onPass}
              type="button"
            >
              <Emoji>⏭️</Emoji> Pass
            </button>
            <button
              className={primaryButton}
              disabled={!model.private.legal.loan.selectedIsLegal}
              onClick={onLoan}
              type="button"
            >
              <Emoji>💰</Emoji> Take Loan (£30)
            </button>
            <button
              className={primaryButton}
              disabled={!model.private.legal.scout.selectionIsLegal}
              onClick={onScout}
              type="button"
            >
              <Emoji>🧭</Emoji> Scout (3 → 2 Wilds)
            </button>
          </div>
        </section>
      ) : null}

      <section className={panel}>
        <h2 className="text-lg font-bold"><Emoji>👥</Emoji> Public player state</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {game.players.map((player) => {
            const inventory = model.playerIndustryInventories.find(
              (candidate) => candidate.seat === player.seat,
            );
            return (
              <article
                className={`${inset} ${player.isCurrent ? "ring-2 ring-amber-400 dark:ring-amber-700" : ""}`}
                key={player.seat}
              >
                <h3 className="font-bold">{player.isCurrent ? "▶️ " : ""}{player.seat}</h3>
                <p className="mt-1 text-sm">
                  £{player.money} · income marker {player.incomeMarkerSpace} · {player.victoryPoints} VP
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                  {player.handCount} hidden cards · {player.linkTokensRemaining} links
                </p>
                {inventory !== undefined ? (
                  <ul className="mt-2 grid grid-cols-2 gap-1 text-[11px]" aria-label={`${player.seat} industry inventory`}>
                    {inventory.industries.map((industry) => (
                      <li className="rounded border border-slate-200 px-1.5 py-1 dark:border-neutral-700" key={industry.kind}>
                        <span aria-hidden="true">{industry.industryEmoji}</span>{" "}
                        {industry.industryLabel}: {industry.remaining}
                        {industry.nextTileLevel === null
                          ? " · empty"
                          : ` · next level ${industry.nextTileLevel}`}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={panel}>
          <h2 className="text-lg font-bold"><Emoji>📦</Emoji> Public board summary</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className={inset}><dt className="text-xs">Built links</dt><dd className="font-mono font-bold">{game.board.builtLinks.length}</dd></div>
            <div className={inset}><dt className="text-xs">Industries</dt><dd className="font-mono font-bold">{game.board.placedIndustries.length}</dd></div>
            <div className={inset}><dt className="text-xs">Coal market</dt><dd className="font-mono font-bold">{game.market.coal}</dd></div>
            <div className={inset}><dt className="text-xs">Iron market</dt><dd className="font-mono font-bold">{game.market.iron}</dd></div>
          </dl>
          <p className="mt-3 text-sm text-slate-600 dark:text-neutral-300">
            Draw {game.cards.drawCount} · discard {game.cards.discardCount} · wild location {game.cards.wildLocationCount} · wild industry {game.cards.wildIndustryCount}
          </p>
          {model.placedIndustries.length > 0 ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Built industries">
              {model.placedIndustries.map((industry) => (
                <article className={inset} key={industry.buildSpaceId}>
                  <h3 className="font-semibold">
                    <span aria-hidden="true">{industry.industryEmoji}</span>{" "}
                    {industry.locationLabel} · {industry.industryLabel} level {industry.tileLevel}
                  </h3>
                  <p className="mt-1 text-xs">
                    {industry.owner} · {industry.resourceSummary}
                    {industry.flipped ? " · flipped" : " · active"}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500 dark:text-neutral-400">
              No industries have been built yet.
            </p>
          )}
        </section>

        <section className={panel}>
          <h2 className="text-lg font-bold"><Emoji>🧾</Emoji> Public event types</h2>
          <ol className="mt-3 space-y-1 font-mono text-xs">
            {game.recentEvents.map((event) => (
              <li className={inset} key={event.sequence}>
                #{event.sequence} {event.type}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
