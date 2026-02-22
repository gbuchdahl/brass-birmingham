import type { GameState } from "@/engine";
import type { CityId, NodeId } from "@/engine/board/topology";

type DevBoardGraphProps = {
  state: GameState;
  selectedNodes: NodeId[];
  selectedCity: CityId | null;
  onSelectNode: (node: NodeId) => void;
  onSelectCity: (city: CityId) => void;
};

const WIDTH = 980;
const HEIGHT = 620;

function ownerColor(owner?: string): string {
  if (!owner) return "#9ca3af";
  const table: Record<string, string> = {
    A: "#2563eb",
    B: "#dc2626",
    C: "#059669",
    D: "#7c3aed",
  };
  return table[owner] ?? "#f59e0b";
}

export function DevBoardGraph({
  state,
  selectedNodes,
  selectedCity,
  onSelectNode,
  onSelectCity,
}: DevBoardGraphProps) {
  const { topology } = state.board;
  const citySet = new Set(topology.cities);

  const positions = new Map<NodeId, { x: number; y: number }>();
  const cityRadius = 220;
  const portRadius = 285;
  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;

  topology.cities.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / topology.cities.length - Math.PI / 2;
    positions.set(node, {
      x: centerX + Math.cos(angle) * cityRadius,
      y: centerY + Math.sin(angle) * cityRadius,
    });
  });

  topology.ports.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / topology.ports.length - Math.PI / 2;
    positions.set(node, {
      x: centerX + Math.cos(angle) * portRadius,
      y: centerY + Math.sin(angle) * portRadius,
    });
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[560px] w-full rounded bg-gray-50 dark:bg-neutral-900">
        {topology.edges.map((edge, index) => {
          const [a, b] = edge.nodes;
          const from = positions.get(a);
          const to = positions.get(b);
          if (!from || !to) {
            return null;
          }
          const builtBy = state.board.linkStates[index].builtBy;
          return (
            <line
              key={`${a}-${b}-${index}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={builtBy ? ownerColor(builtBy) : "#cbd5e1"}
              strokeWidth={builtBy ? 5 : 2}
              strokeDasharray={builtBy ? "0" : edge.kind === "rail" ? "8 4" : "0"}
              opacity={edge.kind === "canal" ? 0.8 : 1}
            />
          );
        })}

        {[...topology.cities, ...topology.ports].map((node) => {
          const pos = positions.get(node);
          if (!pos) {
            return null;
          }
          const isCity = citySet.has(node as CityId);
          const isNodeSelected = selectedNodes.includes(node);
          const isCitySelected = isCity && selectedCity === node;
          return (
            <g key={node}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isCity ? 18 : 14}
                fill={isCity ? "#111827" : "#334155"}
                stroke={isNodeSelected || isCitySelected ? "#f59e0b" : "#e5e7eb"}
                strokeWidth={isNodeSelected || isCitySelected ? 4 : 2}
                className="cursor-pointer"
                onClick={() => {
                  onSelectNode(node);
                  if (isCity) {
                    onSelectCity(node as CityId);
                  }
                }}
              />
              <text
                x={pos.x}
                y={pos.y + (isCity ? 34 : 28)}
                textAnchor="middle"
                fontSize={11}
                fill="#111827"
                className="select-none dark:fill-gray-100"
              >
                {node}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
