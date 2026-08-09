import React from 'react';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

interface RangeHeatmapProps {
  rangePct?: number; // percentage of hands open e.g. 0.30 -> 30%
}

export const RangeHeatmap: React.FC<RangeHeatmapProps> = ({ rangePct = 0.3 }) => {
  return (
    <div className="range-heatmap-container">
      <div className="range-heatmap-header">
        <span className="range-title">13x13 Opponent Range Matrix</span>
        <span className="range-pct-badge">{Math.round(rangePct * 100)}% of Combos</span>
      </div>

      <div className="range-grid">
        {RANKS.map((r1, i) =>
          RANKS.map((r2, j) => {
            const isPair = i === j;
            const isSuited = i < j;
            const label = isPair ? `${r1}${r2}` : isSuited ? `${r1}${r2}s` : `${r2}${r1}o`;

            // Simple combo inclusion heuristic based on rangePct for visual heatmap representation
            const pairRankVal = 14 - i;
            const isInRange =
              isPair
                ? pairRankVal >= 14 - rangePct * 13
                : isSuited
                  ? pairRankVal + (14 - j) >= 22 - rangePct * 20
                  : pairRankVal + (14 - j) >= 24 - rangePct * 18;

            return (
              <div
                key={label}
                className={`range-cell ${isPair ? 'pair-cell' : isSuited ? 'suited-cell' : 'offsuit-cell'} ${isInRange ? 'in-range' : 'out-range'}`}
                title={label}
              >
                {label}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
};
