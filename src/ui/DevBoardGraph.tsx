import type { GameState } from "@/engine";
import { cityMapZone } from "@/engine/board/topology";
import type { CityId, MapZone, NodeId } from "@/engine/board/topology";

type DevBoardGraphProps = {
  state: GameState;
  selectedNodes: NodeId[];
  selectedCity: CityId | null;
  onSelectNode: (node: NodeId) => void;
  onSelectCity: (city: CityId) => void;
};

const WIDTH = 980;
const HEIGHT = 620;
const CITY_SPACING_X = 70;
const CITY_SPACING_Y = 58;

const ZONE_ANCHORS: Record<MapZone, { x: number; y: number }> = {
  northwest: { x: 230, y: 120 },
  north: { x: 500, y: 115 },
  northeast: { x: 760, y: 120 },
  west: { x: 215, y: 265 },
  center: { x: 500, y: 300 },
  east: { x: 785, y: 300 },
  southwest: { x: 250, y: 455 },
  south: { x: 500, y: 505 },
  southeast: { x: 760, y: 470 },
};

const PORT_POSITIONS: Record<string, { x: number; y: number }> = {
  Gloucester: { x: 420, y: 600 },
  Warrington: { x: 360, y: 28 },
  Nottingham: { x: 930, y: 130 },
  Shrewsbury: { x: 45, y: 420 },
  Oxford: { x: 690, y: 595 },
};

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

function orientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function segmentsCross(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
): boolean {
  const o1 = orientation(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y);
  const o2 = orientation(a1.x, a1.y, a2.x, a2.y, b2.x, b2.y);
  const o3 = orientation(b1.x, b1.y, b2.x, b2.y, a1.x, a1.y);
  const o4 = orientation(b1.x, b1.y, b2.x, b2.y, a2.x, a2.y);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function countEdgeCrossings(
  edges: readonly { nodes: readonly [NodeId, NodeId] }[],
  positions: Map<NodeId, { x: number; y: number }>,
): number {
  let crossings = 0;
  for (let i = 0; i < edges.length; i += 1) {
    const [a1, a2] = edges[i].nodes;
    const a1Pos = positions.get(a1);
    const a2Pos = positions.get(a2);
    if (!a1Pos || !a2Pos) continue;

    for (let j = i + 1; j < edges.length; j += 1) {
      const [b1, b2] = edges[j].nodes;
      if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) continue;

      const b1Pos = positions.get(b1);
      const b2Pos = positions.get(b2);
      if (!b1Pos || !b2Pos) continue;

      if (segmentsCross(a1Pos, a2Pos, b1Pos, b2Pos)) {
        crossings += 1;
      }
    }
  }
  return crossings;
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
  const nodeZone = new Map<CityId, MapZone>();

  const positions = new Map<NodeId, { x: number; y: number }>();
  const cityBuckets = new Map<MapZone, CityId[]>();
  const cityNeighbors = new Map<CityId, Set<NodeId>>();

  topology.cities.forEach((city) => {
    const zone = cityMapZone(city);
    nodeZone.set(city, zone);
    cityBuckets.set(zone, [...(cityBuckets.get(zone) ?? []), city]);
    cityNeighbors.set(city, new Set());
  });

  topology.edges.forEach((edge) => {
    const [a, b] = edge.nodes;
    if (citySet.has(a as CityId)) {
      cityNeighbors.get(a as CityId)?.add(b);
    }
    if (citySet.has(b as CityId)) {
      cityNeighbors.get(b as CityId)?.add(a);
    }
  });

  cityBuckets.forEach((cities, zone) => {
    const anchor = ZONE_ANCHORS[zone];
    const sorted = [...cities].sort((left, right) => {
      const leftNeighbors = [...(cityNeighbors.get(left) ?? [])];
      const rightNeighbors = [...(cityNeighbors.get(right) ?? [])];

      const leftAvgX =
        leftNeighbors.length === 0
          ? anchor.x
          : leftNeighbors.reduce((sum, neighbor) => {
              if (citySet.has(neighbor as CityId)) {
                return sum + ZONE_ANCHORS[nodeZone.get(neighbor as CityId) ?? zone].x;
              }
              return sum + (PORT_POSITIONS[String(neighbor)]?.x ?? anchor.x);
            }, 0) / leftNeighbors.length;

      const rightAvgX =
        rightNeighbors.length === 0
          ? anchor.x
          : rightNeighbors.reduce((sum, neighbor) => {
              if (citySet.has(neighbor as CityId)) {
                return sum + ZONE_ANCHORS[nodeZone.get(neighbor as CityId) ?? zone].x;
              }
              return sum + (PORT_POSITIONS[String(neighbor)]?.x ?? anchor.x);
            }, 0) / rightNeighbors.length;

      if (leftAvgX !== rightAvgX) {
        return leftAvgX - rightAvgX;
      }
      return left.localeCompare(right);
    });
    const columns = sorted.length <= 2 ? sorted.length : 2;

    sorted.forEach((city, index) => {
      const column = columns > 0 ? index % columns : 0;
      const row = columns > 0 ? Math.floor(index / columns) : index;
      const colOffset = (column - (columns - 1) / 2) * CITY_SPACING_X;
      const rowOffset = row * CITY_SPACING_Y;
      positions.set(city, {
        x: anchor.x + colOffset,
        y: anchor.y + rowOffset,
      });
    });
  });

  topology.ports.forEach((node, index) => {
    const preset = PORT_POSITIONS[node];
    if (preset) {
      positions.set(node, preset);
      return;
    }

    const fallbackX = 40 + (index * (WIDTH - 80)) / Math.max(1, topology.ports.length - 1);
    positions.set(node, { x: fallbackX, y: 32 });
  });

  // Greedy local optimization: swap city positions inside each zone when it reduces total crossings.
  for (let pass = 0; pass < 4; pass += 1) {
    let improved = false;
    let currentCrossings = countEdgeCrossings(topology.edges, positions);

    cityBuckets.forEach((cities) => {
      if (cities.length < 2) return;

      for (let i = 0; i < cities.length; i += 1) {
        for (let j = i + 1; j < cities.length; j += 1) {
          const a = cities[i];
          const b = cities[j];
          const posA = positions.get(a);
          const posB = positions.get(b);
          if (!posA || !posB) continue;

          positions.set(a, posB);
          positions.set(b, posA);
          const next = countEdgeCrossings(topology.edges, positions);

          if (next < currentCrossings) {
            currentCrossings = next;
            improved = true;
          } else {
            positions.set(a, posA);
            positions.set(b, posB);
          }
        }
      }
    });

    if (!improved) {
      break;
    }
  }

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
