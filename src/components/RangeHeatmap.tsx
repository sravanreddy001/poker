import React from 'react';
import { DEFINITIONS } from '../analysis';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export interface RangeHeatmapProps {
  rangePct: number;
  comboCount?: number;
}

export const RangeHeatmap: React.FC<RangeHeatmapProps> = ({ rangePct, comboCount }) => {
  const calculatedCombos = comboCount ?? Math.round(1326 * rangePct);

  return (
    <div className="range-heatmap-card">
      <div className="range-heatmap-header">
        <span className="range-title" title={DEFINITIONS.villainRange}>
          Opponent Opening Range (13×13 Matrix)
        </span>
        <span className="range-pct-badge">
          Top {Math.round(rangePct * 100)}% ({calculatedCombos} combos)
        </span>
      </div>

      <div className="range-grid">
        {RANKS.map((r1, i) =>
          RANKS.map((r2, j) => {
            const isPair = i === j;
            const isSuited = i < j;
            const label = isPair ? `${r1}${r2}` : isSuited ? `${r1}${r2}s` : `${r2}${r1}o`;

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
          <span>🔍 Shorthand Notation Guide: Suited (s) vs Offsuit (o)</span>
        </div>
        <div className="learning-card-body">
          <b>AKs (Suited)</b>: Ace-King of the <b>same suit</b> (e.g. A♠ K♠). 4 combos total.<br />
          <b>AKo (Offsuit)</b>: Ace-King of <b>different suits</b> (e.g. A♠ K♥). 12 combos total.<br />
          Top-Right cells (<b>s</b>) = Suited | Bottom-Left cells (<b>o</b>) = Offsuit | Diagonal = Pairs.
        </div>
      </div>
    </div>
  );
};
