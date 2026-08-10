import React from 'react';
import { pct, DEFINITIONS } from '../analysis';

export interface PeekStripProps {
  realizedEquity: number;
  rawEquity?: number;
  realizationFactor?: number;
  breakEvenOdds?: number;
  bestLineLabel: string;
  onOpenSheet: () => void;
}

export const PeekStrip: React.FC<PeekStripProps> = ({
  realizedEquity,
  rawEquity = 0.45,
  realizationFactor = 0.85,
  breakEvenOdds = 0.15,
  bestLineLabel,
  onOpenSheet,
}) => {
  const realizedPct = Math.round(realizedEquity * 100);
  const rawPct = Math.round(rawEquity * 100);
  const factorPct = Math.round(realizationFactor * 100);
  const bePct = Math.round(breakEvenOdds * 100);

  const tooltipText = `🧮 Playable Odds Math Breakdown (${realizedPct}%):\n• Raw Showdown Equity: ${rawPct}%\n• Position Realization: ${factorPct}%\n• Math: Raw (${rawPct}%) × Realization (${factorPct}%) = ${realizedPct}%\n• Threshold vs Call Odds (${bePct}%): ${
    realizedPct >= bePct ? `+${realizedPct - bePct}% Profit Margin (+EV)` : `-${bePct - realizedPct}% Deficit (-EV)`
  }`;

  return (
    <button
      type="button"
      className="peek-strip"
      onClick={onOpenSheet}
      aria-label="Open win odds and expected value analysis drawer"
    >
      <div className="peek-content">
        <span className="peek-item peek-tooltip-trigger" title={tooltipText}>
          Playable Odds: <b className="peek-highlight">{pct(realizedEquity)}</b>
          <span className="peek-math-hover-card">
            <span className="math-hover-title">🧮 Playable Odds Math</span>
            <span className="math-hover-line">
              <b>Raw Equity</b>: {rawPct}% (Showdown)
            </span>
            <span className="math-hover-line">
              <b>Position Retention</b>: {factorPct}%
            </span>
            <span className="math-hover-line highlight-line">
              <b>Math</b>: {rawPct}% × {factorPct}% = <b>{realizedPct}%</b>
            </span>
            <span className="math-hover-line sub-line">
              <b>Call Threshold</b>: {bePct}% BE ({realizedPct >= bePct ? `+${realizedPct - bePct}% +EV` : `-${bePct - realizedPct}% -EV`})
            </span>
          </span>
        </span>
        <span className="peek-divider">•</span>
        <span className="peek-item" title={DEFINITIONS.ev}>
          Best Line: <b className="peek-gold">{bestLineLabel}</b>
        </span>
      </div>
      <div className="peek-trigger">
        <span>Deep Math</span>
        <span className="peek-chevron">▲</span>
      </div>
    </button>
  );
};
