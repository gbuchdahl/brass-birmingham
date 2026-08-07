"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createGameV2, type GameStateV2 } from "@/engine/game-v2/state";
import type { PlayableCardId } from "@/engine/cards-v2/types";
import { GameV2HotseatPrototype } from "@/ui/GameV2HotseatPrototype";
import { submitSelectedHotseatSell } from "@/ui/hotseat-prototype-controller";
import {
  clearHotseatSessionStorage,
  loadHotseatSessionFromStorage,
  saveHotseatSessionToStorage,
} from "@/ui/browser-hotseat-storage";
import { HotseatPersistenceError } from "@/ui/hotseat-persistence";
import {
  gameV2DevSeats,
  type GameV2DevPlayerCount,
} from "@/ui/game-v2-dev-model";
import {
  createHotseatSession,
  hideHotseatHand,
  resetHotseatSession,
  revealHotseatHand,
  setHotseatDraft,
  submitHotseatCommand,
  toHotseatViewModel,
} from "@/ui/hotseat-session";
import {
  appendSelectedHotseatSellSale,
  clearHotseatSellDraft,
  normalizeHotseatBuildDraft,
  normalizeHotseatDevelopDraft,
  selectHotseatActionCard,
  selectHotseatBuildPlan,
  selectHotseatDevelopPlan,
  selectHotseatMerchantFreeDevelopSelection,
  selectHotseatNetworkLink,
  selectHotseatSellNextOption,
  selectedHotseatBuildCommand,
  selectedHotseatDevelopCommand,
  selectedHotseatCardId,
  selectedHotseatNetworkCommand,
  selectedHotseatMerchantFreeDevelopCommand,
  toggleHotseatScoutCard,
  toHotseatPrototypeModel,
  type HotseatSimpleCardAction,
} from "@/ui/hotseat-prototype-model";

const DEFAULT_SEED = "game-v2-dev-alpha";

type HotseatSaveStatus = {
  readonly kind: "checking" | "saved" | "restored" | "corrupt" | "unavailable";
  readonly message: string;
};

function newGame(playerCount: GameV2DevPlayerCount, seed: string): GameStateV2 {
  return createGameV2(gameV2DevSeats(playerCount), seed);
}

export default function DevPage() {
  const [playerCount, setPlayerCount] = useState<GameV2DevPlayerCount>(2);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [session, setSession] = useState(() =>
    createHotseatSession(newGame(2, DEFAULT_SEED))
  );
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [saveStatus, setSaveStatus] = useState<HotseatSaveStatus>({
    kind: "checking",
    message: "Checking this browser for a saved game…",
  });
  const preserveRestoreNotice = useRef(false);
  const model = useMemo(
    () => toHotseatPrototypeModel(toHotseatViewModel(session), session.state),
    [session],
  );

  useEffect(() => {
    try {
      const restored = loadHotseatSessionFromStorage(window.localStorage);
      if (restored !== null) {
        preserveRestoreNotice.current = true;
        setSession(restored);
        setPlayerCount(restored.state.turnOrder.length as GameV2DevPlayerCount);
        setSeed(restored.state.seed);
        setSaveStatus({
          kind: "restored",
          message: `Restored revision ${restored.state.revision}. The hand is hidden for privacy.`,
        });
      } else {
        setSaveStatus({
          kind: "saved",
          message: "Local autosave is ready in this browser.",
        });
      }
      setAutosaveEnabled(true);
    } catch (error) {
      setAutosaveEnabled(false);
      setSaveStatus({
        kind: error instanceof HotseatPersistenceError
          ? "corrupt"
          : "unavailable",
        message: error instanceof Error
          ? error.message
          : "The local save could not be read.",
      });
    }
  }, []);

  useEffect(() => {
    if (!autosaveEnabled) return;
    try {
      saveHotseatSessionToStorage(window.localStorage, session);
      if (preserveRestoreNotice.current) {
        preserveRestoreNotice.current = false;
      } else {
        setSaveStatus({
          kind: "saved",
          message: `Saved revision ${session.state.revision} in this browser.`,
        });
      }
    } catch (error) {
      setAutosaveEnabled(false);
      setSaveStatus({
        kind: "unavailable",
        message: error instanceof Error
          ? error.message
          : "The current game could not be saved locally.",
      });
    }
  }, [autosaveEnabled, session]);

  function reset(): void {
    setSession((current) =>
      resetHotseatSession(current, newGame(playerCount, seed))
    );
  }

  function discardBrokenSave(): void {
    try {
      clearHotseatSessionStorage(window.localStorage);
      const fresh = createHotseatSession(newGame(playerCount, seed));
      setSession(fresh);
      setAutosaveEnabled(true);
      setSaveStatus({
        kind: "saved",
        message: "The old save was cleared. Starting a fresh local game.",
      });
    } catch (error) {
      setAutosaveEnabled(false);
      setSaveStatus({
        kind: "unavailable",
        message: error instanceof Error
          ? error.message
          : "The saved game could not be cleared.",
      });
    }
  }

  function selectCard(cardId: PlayableCardId): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      const card = privateModel?.cards.find((candidate) =>
        candidate.id === cardId
      );
      if (
        card === undefined ||
        (!card.canPass && !card.canLoan && !card.canNetwork && !card.canDevelop &&
          !card.canSell)
      ) return current;
      const withCard = setHotseatDraft(
        current,
        selectHotseatActionCard(clearHotseatSellDraft(current.draft), cardId),
      );
      const nextPrivate = toHotseatPrototypeModel(
        toHotseatViewModel(withCard),
        withCard.state,
      ).private;
      const withNormalizedBuild = setHotseatDraft(
        withCard,
        normalizeHotseatBuildDraft(
          withCard.draft,
          nextPrivate?.legal.build.plans.map((plan) => plan.id) ?? [],
        ),
      );
      return setHotseatDraft(
        withNormalizedBuild,
        normalizeHotseatDevelopDraft(
          withNormalizedBuild.draft,
          nextPrivate?.legal.develop.plans.map((plan) => plan.id) ?? [],
        ),
      );
    });
  }

  function toggleScoutCard(cardId: PlayableCardId): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      if (privateModel === null) return current;
      const selectableCardIds = privateModel.cards
        .filter((card) => card.canScout)
        .map((card) => card.id);
      if (!selectableCardIds.includes(cardId)) return current;
      return setHotseatDraft(
        current,
        toggleHotseatScoutCard(
          current.draft,
          cardId,
          selectableCardIds,
        ),
      );
    });
  }

  function submitCardAction(type: HotseatSimpleCardAction): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      if (privateModel === null) return current;
      const cardId = selectedHotseatCardId(current.draft);
      const legal = type === "PASS"
        ? privateModel.legal.pass.selectedIsLegal
        : privateModel.legal.loan.selectedIsLegal;
      if (cardId === null || !legal) return current;
      const withTypedDraft = setHotseatDraft(
        current,
        selectHotseatActionCard(current.draft, cardId, type),
      );
      return submitHotseatCommand(withTypedDraft, { type, cardId });
    });
  }

  function submitScout(): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      if (
        privateModel === null ||
        !privateModel.legal.scout.selectionIsLegal ||
        privateModel.selectedScoutCardIds.length !== 3
      ) return current;
      const [first, second, third] = privateModel.selectedScoutCardIds;
      return submitHotseatCommand(current, {
        type: "SCOUT",
        selection: { cardsToDiscard: [first, second, third] },
      });
    });
  }

  function selectNetworkLink(linkId: string): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      if (privateModel === null) return current;
      const selectableLinkIds = privateModel.legal.network.links.map(
        (link) => link.linkId,
      );
      return setHotseatDraft(
        current,
        selectHotseatNetworkLink(
          current.draft,
          linkId,
          selectableLinkIds,
        ),
      );
    });
  }

  function submitNetwork(): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      if (privateModel === null) return current;
      const command = selectedHotseatNetworkCommand(privateModel);
      return command === null
        ? current
        : submitHotseatCommand(current, command);
    });
  }

  function selectBuildPlan(planId: string): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      if (privateModel === null) return current;
      return setHotseatDraft(
        current,
        selectHotseatBuildPlan(
          current.draft,
          planId,
          privateModel.legal.build.plans.map((plan) => plan.id),
        ),
      );
    });
  }

  function submitBuild(): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      if (privateModel === null) return current;
      const command = selectedHotseatBuildCommand(privateModel);
      return command === null
        ? current
        : submitHotseatCommand(current, command);
    });
  }

  function selectDevelopPlan(planId: string): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      if (privateModel === null) return current;
      return setHotseatDraft(
        current,
        selectHotseatDevelopPlan(
          current.draft,
          planId,
          privateModel.legal.develop.plans.map((plan) => plan.id),
        ),
      );
    });
  }

  function submitDevelop(): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      if (privateModel === null) return current;
      const command = selectedHotseatDevelopCommand(privateModel);
      return command === null
        ? current
        : submitHotseatCommand(current, command);
    });
  }

  function selectMerchantFreeDevelop(selectionId: string): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      const followUp = privateModel?.merchantFreeDevelop;
      if (followUp === null || followUp === undefined) return current;
      return setHotseatDraft(
        current,
        selectHotseatMerchantFreeDevelopSelection(
          current.draft,
          selectionId,
          followUp.selections.map((selection) => selection.id),
        ),
      );
    });
  }

  function resolveMerchantFreeDevelop(): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      if (privateModel === null) return current;
      const command = selectedHotseatMerchantFreeDevelopCommand(privateModel);
      return command === null
        ? current
        : submitHotseatCommand(current, command);
    });
  }

  function selectSellNextOption(optionId: string): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      if (privateModel === null) return current;
      return setHotseatDraft(
        current,
        selectHotseatSellNextOption(
          current.draft,
          optionId,
          privateModel.legal.sell.nextOptions.map((option) => option.id),
        ),
      );
    });
  }

  function appendSellSale(): void {
    setSession((current) => {
      const privateModel = toHotseatPrototypeModel(
        toHotseatViewModel(current),
        current.state,
      ).private;
      return privateModel === null
        ? current
        : setHotseatDraft(
            current,
            appendSelectedHotseatSellSale(current.draft, privateModel),
          );
    });
  }

  function clearSell(): void {
    setSession((current) =>
      setHotseatDraft(current, clearHotseatSellDraft(current.draft))
    );
  }

  function submitSell(): void {
    setSession(submitSelectedHotseatSell);
  }

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 text-slate-950 dark:bg-neutral-900 dark:text-neutral-100 sm:px-5 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <section className="rounded-lg border border-slate-300 bg-white p-3 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-neutral-300">
              Players
              <select
                aria-label="Player count"
                className="rounded border border-slate-400 bg-white px-3 py-2 text-sm font-normal text-slate-950 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
                onChange={(event) => {
                  const count = Number(event.target.value) as GameV2DevPlayerCount;
                  setPlayerCount(count);
                }}
                value={playerCount}
              >
                <option value={2}>2 players</option>
                <option value={3}>3 players</option>
                <option value={4}>4 players</option>
              </select>
            </label>

            <label className="grid min-w-64 flex-1 gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-neutral-300">
              Deterministic seed
              <input
                className="rounded border border-slate-400 bg-white px-3 py-2 font-mono text-sm font-normal text-slate-950 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
                onChange={(event) => setSeed(event.target.value)}
                spellCheck={false}
                value={seed}
              />
            </label>

            <button
              className="rounded border border-slate-500 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:border-neutral-500 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white"
              onClick={reset}
              type="button"
            >
              New / reset game
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
            Player and seed changes apply when you start a new game. Saves are local to this browser and single-tab only.
          </p>
          <div
            aria-live="polite"
            className={`mt-2 rounded border px-3 py-2 text-xs ${
              saveStatus.kind === "corrupt" || saveStatus.kind === "unavailable"
                ? "border-red-400 bg-red-50 text-red-950 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100"
                : "border-slate-300 bg-slate-50 text-slate-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            }`}
            role={saveStatus.kind === "corrupt" ? "alert" : "status"}
          >
            <span>{saveStatus.message}</span>
            {saveStatus.kind === "corrupt" ? (
              <button
                className="ml-3 rounded border border-red-600 px-2 py-1 font-semibold hover:bg-red-100 dark:hover:bg-red-900"
                onClick={discardBrokenSave}
                type="button"
              >
                Discard save and start fresh
              </button>
            ) : null}
          </div>
        </section>

        <GameV2HotseatPrototype
          model={model}
          onAppendSellSale={appendSellSale}
          onBuild={submitBuild}
          onClearSell={clearSell}
          onDevelop={submitDevelop}
          onHide={() => setSession(hideHotseatHand)}
          onLoan={() => submitCardAction("LOAN")}
          onNetwork={submitNetwork}
          onPass={() => submitCardAction("PASS")}
          onResolveEra={() =>
            setSession((current) =>
              submitHotseatCommand(current, { type: "RESOLVE_ERA" })
            )
          }
          onResolveMerchantFreeDevelop={resolveMerchantFreeDevelop}
          onReveal={() => setSession(revealHotseatHand)}
          onScout={submitScout}
          onSell={submitSell}
          onSelectBuildPlan={selectBuildPlan}
          onSelectDevelopPlan={selectDevelopPlan}
          onSelectMerchantFreeDevelop={selectMerchantFreeDevelop}
          onSelectCard={selectCard}
          onSelectNetworkLink={selectNetworkLink}
          onSelectSellNextOption={selectSellNextOption}
          onSettleRound={() =>
            setSession((current) => {
              const choices = model.boundary?.kind === "round_settlement"
                ? model.boundary.automaticLiquidationChoices
                : null;
              return choices === null
                ? current
                : submitHotseatCommand(current, {
                    type: "SETTLE_ROUND",
                    liquidationChoices: choices,
                  });
            })
          }
          onToggleScoutCard={toggleScoutCard}
        />
      </div>
    </main>
  );
}
