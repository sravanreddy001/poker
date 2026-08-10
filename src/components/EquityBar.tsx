import React from 'react';
import { pct, DEFINITIONS } from '../analysis';

export interface EquityBarProps {
  rawEquity: number;
  realizedEquity: number;
  realizationFactor: number;
  breakEvenOdds?: number;
}

export const EquityBar: React.FC<EquityBarProps> = ({
  rawEquity,
  realizedEquity,
  realizationFactor,
  breakEvenOdds,
}) => {
  const rawPct = Math.min(100, Math.max(0, Math.round(rawEquity * 100)));
  const realizedPct = Math.min(100, Math.max(0, Math.round(realizedEquity * 100)));
  const breakEvenPct =
    breakEvenOdds !== undefined ? Math.min(100, Math.max(0, Math.round(breakEvenOdds * 100))) : null;

  return (
    <div className="equity-bar-card">
      <div className="equity-bar-header">
        <span className="equity-bar-title" title={DEFINITIONS.realizedEquity}>
          Win Odds & Equity Breakdown
        </span>
        <span className="equity-factor-badge" title={DEFINITIONS.realizationFactor}>
          Position Retention: {pct(realizationFactor)}
        </span>
      </div>

      <div className="equity-bar-track">
        {/* Raw Equity Bar (Sky Blue) */}
        <div
          className="equity-fill raw-fill"
          style={{ width: `${rawPct}%` }}
          title={`Raw Equity (Showdown Win Odds): ${rawPct}%`}
        />
        {/* Realized Equity Bar (Emerald Green overlay) */}
        <div
          className="equity-fill realized-fill"
          style={{ width: `${realizedPct}%` }}
          title={`Realized Equity (Playable Win Odds): ${realizedPct}%`}
        />
        {/* Break-even threshold line (Red rule) */}
        {breakEvenPct !== null && (
          <div
            className="break-even-rule"
            style={{ left: `${breakEvenPct}%` }}
            title={`Break-even Call Odds (Pot Odds): ${breakEvenPct}%`}
          >
            <span className="break-even-tag">{breakEvenPct}% BE</span>
          </div>
        )}
      </div>

      <div className="equity-bar-legend">
        <div className="legend-item" title={DEFINITIONS.realizedEquity}>
          <span className="legend-swatch emerald" />
          <span>Realized (Playable): <b>{realizedPct}%</b></span>
        </div>
        <div className="legend-item" title={DEFINITIONS.rawEquity}>
          <span className="legend-swatch sky" />
          <span>Raw (Showdown): <b>{rawPct}%</b></span>
        </div>
        {breakEvenPct !== null && (
          <div className="legend-item" title={DEFINITIONS.potOdds}>
            <span className="legend-swatch red" />
            <span>Break-Even Call: <b>{breakEvenPct}%</b></span>
          </div>
        )}
      </div>

      {/* Standard Educational Definition Card */}
      <div className="learning-card">
        <div className="learning-card-header">
          <span>💡 Definition: Realized vs Raw Equity</span>
        </div>
        <div className="learning-card-body">
          <b>Raw Equity ({rawPct}%)</b> = your showdown win probability if no further bets occur.<br />
          <b>Realized Equity ({realizedPct}%)</b> = your actual win chance factoring in future bets and folding out of position.
        </div>
      </div>
    </div>
  );
};
