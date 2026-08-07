import type {
  GameV2DevBoardLocation,
  GameV2DevModel,
} from "@/ui/game-v2-dev-model";

type GameV2DevInspectorProps = {
  readonly model: GameV2DevModel;
};

const panel =
  "rounded-lg border border-slate-300 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-950";
const inset =
  "rounded border border-slate-200 bg-slate-50 p-2 dark:border-neutral-800 dark:bg-neutral-900";

function Metric({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <div className={inset}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-sm font-semibold">{value}</dd>
    </div>
  );
}

function LocationCard({ location }: { readonly location: GameV2DevBoardLocation }) {
  return (
    <article className={`${inset} space-y-2`}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{location.label}</h3>
          <p className="font-mono text-[10px] text-slate-500 dark:text-neutral-400">
            {location.id}
          </p>
        </div>
        <div className="flex gap-1 text-xs" aria-label="Location properties">
          {location.baseLinkIcons > 0 ? (
            <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 dark:border-neutral-700 dark:bg-neutral-950">
              🔗 {location.baseLinkIcons}
            </span>
          ) : null}
          {location.coalMarketAccess ? (
            <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 dark:border-neutral-700 dark:bg-neutral-950">
              ⚫ market
            </span>
          ) : null}
        </div>
      </header>

      {location.buildSpaces.map((space) => (
        <div
          className="rounded border border-dashed border-slate-300 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-950"
          key={space.id}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-slate-500 dark:text-neutral-400">
              {space.id}
            </span>
            <span className="flex flex-wrap gap-1" aria-label="Allowed industries">
              {space.allowed.map((industry) => (
                <span
                  className="rounded border border-slate-200 px-1.5 py-0.5 text-xs dark:border-neutral-800"
                  key={industry.kind}
                  title={industry.label}
                >
                  {industry.emoji} {industry.label}
                </span>
              ))}
            </span>
          </div>
          {space.placement ? (
            <div className="mt-2 rounded border border-amber-400 bg-amber-50 p-2 text-xs dark:border-amber-700 dark:bg-amber-950/30">
              {space.placement.emoji} {space.placement.label} L{space.placement.level}
              {" · "}{space.placement.owner}
              {space.placement.flipped ? " · flipped" : " · face up"}
              <div className="mt-1 font-mono text-[10px]">
                {space.placement.tileId} · ⚫{space.placement.resources.coal}
                {" "}🔩{space.placement.resources.iron}
                {" "}🍺{space.placement.resources.beer}
              </div>
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Empty</p>
          )}
        </div>
      ))}

      {location.merchantSpaceIds.length > 0 ? (
        <div className="flex flex-wrap gap-1 text-xs">
          {location.merchantSpaceIds.map((id) => (
            <span
              className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] dark:border-neutral-700 dark:bg-neutral-950"
              key={id}
            >
              🛒 {id}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function GameV2DevInspector({ model }: GameV2DevInspectorProps) {
  const progress = model.progress;
  return (
    <div className="space-y-5">
      <section className={panel}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="rounded border border-amber-500 bg-amber-50 px-2 py-1 text-xs font-bold tracking-wide text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                ENGINE ALPHA
              </span>
              <span className="rounded border border-slate-400 px-2 py-1 text-xs font-bold tracking-wide">
                READ ONLY
              </span>
            </div>
            <h1 className="text-2xl font-bold">GameStateV2 progress inspector</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-neutral-300">
              Deterministic engine snapshot. This page exposes setup and authoritative state;
              full game actions are not interactive here yet.
            </p>
          </div>
          <div className="text-right font-mono text-xs text-slate-500 dark:text-neutral-400">
            <p>{model.identity.gameId}</p>
            <p>schema v{model.identity.schemaVersion}</p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          <Metric label="Era" value={progress.era} />
          <Metric label="Round" value={progress.round} />
          <Metric label="Turn" value={progress.turnNumber} />
          <Metric label="Current seat" value={progress.currentSeat} />
          <Metric label="Actions" value={`${progress.actionsUsed}/${progress.actionLimit}`} />
          <Metric label="Revision" value={progress.revision} />
          <Metric label="Seed" value={model.identity.seed} />
        </dl>
      </section>

      <section className={panel}>
        <h2 className="text-lg font-bold">👥 Players</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          {model.players.map((player) => (
            <article
              className={`${inset} ${
                player.isCurrent
                  ? "ring-2 ring-amber-400 dark:ring-amber-600"
                  : ""
              }`}
              key={player.seat}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold">{player.isCurrent ? "▶️ " : ""}{player.seat}</h3>
                <span className="text-xs text-slate-500 dark:text-neutral-400">
                  {player.hand.length} cards
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                <Metric label="Money" value={`£${player.money}`} />
                <Metric label="Income" value={`${player.incomeLevel} (@${player.incomeMarkerSpace})`} />
                <Metric label="Victory points" value={player.victoryPoints} />
                <Metric label="Link tokens" value={player.linkTokensRemaining} />
              </dl>

              <h4 className="mt-3 text-xs font-bold uppercase tracking-wide">Hand</h4>
              <div className="mt-1 flex flex-wrap gap-1">
                {player.hand.map((card) => (
                  <span
                    className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                    key={card.id}
                    title={card.id}
                  >
                    🃏 {card.label}
                  </span>
                ))}
              </div>

              <h4 className="mt-3 text-xs font-bold uppercase tracking-wide">Industry mat</h4>
              <div className="mt-1 grid grid-cols-2 gap-1 text-xs sm:grid-cols-3">
                {player.inventory.map((row) => (
                  <div className="rounded border border-slate-200 p-1.5 dark:border-neutral-800" key={row.kind}>
                    <div>{row.emoji} {row.label}</div>
                    <div className="font-mono text-[10px] text-slate-500 dark:text-neutral-400">
                      {row.remaining} left · next {row.nextLevel === null ? "—" : `L${row.nextLevel}`}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
                Removed tiles: {player.removedIndustryTiles}
              </p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={panel}>
          <h2 className="text-lg font-bold">📦 Markets & card zones</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {model.markets.map((market) => (
              <div className={inset} key={market.kind}>
                <h3 className="font-semibold">{market.emoji} {market.kind}</h3>
                <p className="mt-1 text-sm">
                  {market.units}/{market.capacity} cubes · next £{market.nextPrice}
                </p>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  External market fallback £{market.fallbackPrice}
                </p>
              </div>
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Metric label="Draw" value={model.cards.draw} />
            <Metric label="Discard" value={model.cards.discard} />
            <Metric label="In hands" value={model.cards.inHands} />
            <Metric label="Wild location" value={model.cards.wildLocation} />
            <Metric label="Wild industry" value={model.cards.wildIndustry} />
          </dl>
        </section>

        <section className={panel}>
          <h2 className="text-lg font-bold">🛒 Merchant spaces</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {model.merchants.map((merchant) => (
              <article className={`${inset} ${merchant.active ? "" : "opacity-55"}`} key={merchant.id}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{merchant.locationLabel}</h3>
                  <span className="text-xs">{merchant.active ? "active" : "inactive"}</span>
                </div>
                <p className="font-mono text-[10px] text-slate-500 dark:text-neutral-400">
                  {merchant.id} · {merchant.tileId ?? "no tile"}
                </p>
                <div className="mt-1 flex flex-wrap gap-1 text-xs">
                  {merchant.demands.length > 0
                    ? merchant.demands.map((demand) => (
                        <span className="rounded border border-slate-300 px-1.5 py-0.5 dark:border-neutral-700" key={demand.kind}>
                          {demand.emoji} {demand.label}
                        </span>
                      ))
                    : <span>No demand</span>}
                </div>
                <p className="mt-1 text-xs">🍺 {merchant.beer} · bonus {merchant.bonus}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className={panel}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">🗺️ Authoritative board spaces</h2>
            <p className="text-sm text-slate-600 dark:text-neutral-300">
              {model.board.locations.length} locations · {model.board.occupiedBuildSpaces}/
              {model.board.buildSpaceCount} build spaces occupied
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            Icons inside each dashed box are the allowed Industry types.
          </p>
        </div>
        <div className="mt-3 grid items-start gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {model.board.locations.map((location) => (
            <LocationCard key={location.id} location={location} />
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={panel}>
          <h2 className="text-lg font-bold">🔗 Link summary</h2>
          <p className="mt-1 text-sm">
            {model.links.built}/{model.links.total} physical links built · {model.links.availableInEra}
            {" "}available in the {model.progress.era} era
          </p>
          <div className="mt-3 space-y-1 text-xs">
            {model.links.entries.length === 0 ? (
              <p className="text-slate-500 dark:text-neutral-400">No links have been built.</p>
            ) : model.links.entries.map((link) => (
              <div className={inset} key={link.id}>
                <span className="font-mono">{link.id}</span>
                {" · "}{link.owner}{" · "}{link.locations.join(" ↔ ")}
              </div>
            ))}
          </div>
        </section>

        <section className={panel}>
          <h2 className="text-lg font-bold">🧾 Recent events</h2>
          <div className="mt-3 space-y-2 text-xs">
            {model.events.map((event) => (
              <details className={inset} key={event.sequence}>
                <summary className="cursor-pointer font-semibold">
                  #{event.sequence} {event.type}
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px]">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
