import React, { useMemo } from 'react';
import { DEFINITIONS } from '../analysis';
import { canonicalName, rangeTopPercent } from '../engine/ranges';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export interface RangeHeatmapProps {
  rangePct: number;
}

export const RangeHeatmap: React.FC<RangeHeatmapProps> = ({ rangePct }) => {
  // Shade the grid from the same range object the engine deals against. The
  // old rank-sum approximation lit up cells the opponent was never holding.
  const { names, comboCount } = useMemo(() => {
    const range = rangeTopPercent(rangePct);
    return {
      names: new Set(range.combos.map(([a, b]) => canonicalName(a, b))),
      comboCount: range.combos.length,
    };
  }, [rangePct]);

  return (
    <div className="range-heatmap-card">
      <div className="range-heatmap-header">
        <span className="range-title" title={DEFINITIONS.villainRange}>
          The hands they can have
        </span>
        <span className="range-pct-badge">
          Top {Math.round(rangePct * 100)}% · {comboCount} combos
        </span>
      </div>

      <p className="range-lede">
        Every hand the trainer assumes this opponent opens. The lit cells are exactly what your win
        odds are measured against — nothing outside them is in their range.
      </p>

      <div className="range-grid">
        {RANKS.map((r1, i) =>
          RANKS.map((r2, j) => {
            const isPair = i === j;
            const isSuited = i < j;
            const label = isPair ? `${r1}${r2}` : isSuited ? `${r1}${r2}s` : `${r2}${r1}o`;

            const isInRange = names.has(label);

            return (
              <div
                key={label}
                className={`range-cell ${
                  isPair ? 'pair-cell' : isSuited ? 'suited-cell' : 'offsuit-cell'
                } ${isInRange ? 'in-range' : 'out-range'}`}
                title={label}
              >
                {label}
              </div>
            );
          }),
        )}
      </div>

      {/* Educational Definition Card */}
      <div className="learning-card">
        <div className="learning-card-header">
          <span>💡 Reading the grid</span>
        </div>
        <div className="learning-card-body">
          <b>Diagonal</b> = pairs. <b>Above it</b> = suited (AKs, both cards one suit, 4 combos).{' '}
          <b>Below it</b> = offsuit (AKo, different suits, 12 combos).
          <br />
          That 4-vs-12 split is why offsuit hands make up most of a range: count combos, not cells.
        </div>
      </div>
    </div>
  );
};
