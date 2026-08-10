import React from 'react';
import type { HandState } from '../engine/game';
import { Card, fullDeck } from '../engine/cards';
import { evaluate } from '../engine/evaluator';
import { makeRng } from '../engine/rng';

export interface PlayerStreetEquity {
  playerId: number;
  equityPct: number;
  folded: boolean;
}

export interface StreetDataPoint {
  street: string;
  players: PlayerStreetEquity[];
}

const PLAYER_COLORS = [
  '#10b981', // Hero: Emerald
  '#38bdf8', // Bot 1: Sky
  '#f59e0b', // Bot 2: Amber
  '#ec4899', // Bot 3: Pink
  '#a855f7', // Bot 4: Purple
  '#f97316', // Bot 5: Orange
];

/**
 * Calculates raw equity across all completed streets for active players.
 */
export function computeEquityHistory(state: HandState): StreetDataPoint[] {
  const result: StreetDataPoint[] = [];
  const rng = makeRng(12345);

  const streetsData: { name: string; boardCount: number }[] = [
    { name: 'Preflop', boardCount: 0 },
  ];
  if (state.board.length >= 3) streetsData.push({ name: 'Flop', boardCount: 3 });
  if (state.board.length >= 4) streetsData.push({ name: 'Turn', boardCount: 4 });
  if (state.board.length >= 5) streetsData.push({ name: 'River', boardCount: 5 });

  for (const st of streetsData) {
    const currentBoard = state.board.slice(0, st.boardCount);
    const activePlayers = state.players.filter((p) => p.hole && p.hole.length === 2);

    const wins: Record<number, number> = {};
    const ties: Record<number, number> = {};
    activePlayers.forEach((p) => {
      wins[p.id] = 0;
      ties[p.id] = 0;
    });

    const deadCards = new Set<Card>();
    currentBoard.forEach((c) => deadCards.add(c));
    activePlayers.forEach((p) => {
      if (p.hole) {
        p.hole.forEach((c) => deadCards.add(c));
      }
    });

    const deck = fullDeck().filter((c) => !deadCards.has(c));
    const needed = 5 - currentBoard.length;
    const samples = 600;

    for (let s = 0; s < samples; s++) {
      const sampledDeck = [...deck];
      for (let i = sampledDeck.length - 1; i > 0; i--) {
        const j = rng.nextInt(i + 1);
        const temp = sampledDeck[i];
        sampledDeck[i] = sampledDeck[j];
        sampledDeck[j] = temp;
      }

      const runout = sampledDeck.slice(0, needed);
      const fullBoard = [...currentBoard, ...runout];

      let bestScore = -1;
      let winners: number[] = [];

      for (const p of activePlayers) {
        if (!p.hole) continue;
        const score = evaluate([...p.hole, ...fullBoard]);
        if (score > bestScore) {
          bestScore = score;
          winners = [p.id];
        } else if (score === bestScore) {
          winners.push(p.id);
        }
      }

      if (winners.length === 1) {
        wins[winners[0]]++;
      } else if (winners.length > 1) {
        winners.forEach((id) => {
          ties[id] += 1 / winners.length;
        });
      }
    }

    const playerPoints: PlayerStreetEquity[] = state.players.map((p) => {
      const totalScore = (wins[p.id] || 0) + (ties[p.id] || 0);
      const pct = Math.round((totalScore / samples) * 100);
      return {
        playerId: p.id,
        equityPct: pct,
        folded: p.folded,
      };
    });

    result.push({
      street: st.name,
      players: playerPoints,
    });
  }

  return result;
}

interface EquityGraphProps {
  state: HandState;
}

export const EquityGraph: React.FC<EquityGraphProps> = ({ state }) => {
  const history = computeEquityHistory(state);
  if (history.length === 0) return null;

  const width = 420;
  const height = 180;
  const paddingLeft = 36;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const graphWidth = width - paddingLeft - paddingRight;
  const graphHeight = height - paddingTop - paddingBottom;

  const numStreets = history.length;

  const getX = (index: number) => {
    if (numStreets <= 1) return paddingLeft + graphWidth / 2;
    return paddingLeft + (index / (numStreets - 1)) * graphWidth;
  };

  const getY = (pct: number) => {
    return paddingTop + graphHeight - (pct / 100) * graphHeight;
  };

  // Build SVG path lines for each player up until they fold
  const playerPaths: {
    playerId: number;
    pathD: string;
    points: { x: number; y: number; pct: number; street: string }[];
    color: string;
    isHero: boolean;
  }[] = [];

  state.players.forEach((p) => {
    const isHero = p.id === 0;
    const color = PLAYER_COLORS[p.id % PLAYER_COLORS.length];
    const points: { x: number; y: number; pct: number; street: string }[] = [];

    for (let i = 0; i < history.length; i++) {
      const stPoint = history[i];
      const pEq = stPoint.players.find((item) => item.playerId === p.id);
      if (!pEq) break;

      points.push({
        x: getX(i),
        y: getY(pEq.equityPct),
        pct: pEq.equityPct,
        street: stPoint.street,
      });

      if (pEq.folded) {
        // Player folded on or before this street, terminate line!
        break;
      }
    }

    if (points.length > 0) {
      let pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
      }
      playerPaths.push({
        playerId: p.id,
        pathD,
        points,
        color,
        isHero,
      });
    }
  });

  return (
    <div className="equity-graph-container">
      <div className="equity-graph-header">
        <span className="section-label">📈 Win Probability Progression Graph</span>
        <span className="section-sub-label">(Lines terminate when a player folds)</span>
      </div>

      {/* SVG Line Chart */}
      <div className="svg-wrapper">
        <svg viewBox={`0 0 ${width} ${height}`} className="equity-svg">
          {/* Y Axis Grid lines */}
          {[0, 25, 50, 75, 100].map((val) => {
            const y = getY(val);
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 6}
                  y={y + 3}
                  fill="#94a3b8"
                  fontSize="9"
                  textAnchor="end"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* X Axis Labels */}
          {history.map((st, i) => (
            <text
              key={st.street}
              x={getX(i)}
              y={height - 8}
              fill="#cbd5e1"
              fontSize="10"
              fontWeight="700"
              textAnchor="middle"
            >
              {st.street}
            </text>
          ))}

          {/* Player Lines */}
          {playerPaths.map((pPath) => (
            <g key={pPath.playerId}>
              <path
                d={pPath.pathD}
                fill="none"
                stroke={pPath.color}
                strokeWidth={pPath.isHero ? '3' : '1.8'}
                strokeOpacity={pPath.isHero ? '1' : '0.75'}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {pPath.points.map((pt, idx) => (
                <g key={idx}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={pPath.isHero ? '4' : '3'}
                    fill={pPath.color}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                  <text
                    x={pt.x}
                    y={pt.y - 7}
                    fill={pPath.color}
                    fontSize="9"
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    {pt.pct}%
                  </text>
                </g>
              ))}
            </g>
          ))}
        </svg>
      </div>

      {/* Legend Footer */}
      <div className="graph-legend">
        {state.players.map((p) => {
          const color = PLAYER_COLORS[p.id % PLAYER_COLORS.length];
          const isHero = p.id === 0;
          const label = isHero ? 'You (Hero)' : `Bot ${p.id}`;

          return (
            <div key={p.id} className={`legend-pill ${p.folded ? 'folded' : ''}`}>
              <span className="legend-dot" style={{ background: color }} />
              <span className="legend-name">{label}</span>
              {p.folded && <span className="legend-folded-tag">(Folded)</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
