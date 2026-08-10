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

  const foldLossPct = Math.max(0, rawPct - realizedPct);

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
          title={DEFINITIONS.rawEquity}
        />
        {/* Realized Equity Bar (Emerald Green overlay) */}
        <div
          className="equity-fill realized-fill"
          style={{ width: `${realizedPct}%` }}
          title={DEFINITIONS.realizedEquity}
        />
        {/* Break-even threshold line (Red rule) */}
        {breakEvenPct !== null && (
          <div
            className="break-even-rule"
            style={{ left: `${breakEvenPct}%` }}
            title={DEFINITIONS.potOdds}
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

      {/* Expanded Educational Explanation Card */}
      <div className="learning-card">
        <div className="learning-card-header">
          <span>💡 Clear Definition: Raw vs Realized Equity</span>
        </div>
        <div className="learning-card-body">
          <p style={{ margin: '0 0 6px 0' }}>
            <b>1. Showdown Win Odds (Raw Equity = {rawPct}%)</b>:<br />
            If all remaining board cards were dealt right now with <i>NO further betting allowed</i>, your hand wins <b>{rawPct} out of 100</b> times at showdown.
          </p>
          <p style={{ margin: '0 0 6px 0' }}>
            <b>2. Playable Win Odds (Realized Equity = {realizedPct}%)</b>:<br />
            In real poker, future betting rounds happen. Facing aggressive bets out of position will force you to fold early ~<b>{foldLossPct}%</b> of the time before seeing the river, leaving you with <b>{realizedPct}%</b> actual win odds.
          </p>
          <p style={{ margin: 0 }}>
            <b>3. Position Retention ({pct(realizationFactor)})</b>:<br />
            Calculated as Realized ÷ Raw ({realizedPct}% / {rawPct}%). Measures how efficiently you can claim your raw win odds based on position.
          </p>
        </div>
      </div>
    </div>
  );
};
