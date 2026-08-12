import React, { useEffect, useState } from 'react';
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
  // The answer stays covered until asked for: seeing the best line before you
  // have committed to one turns the drill into copying rather than deciding.
  const [bestLineShown, setBestLineShown] = useState(false);
  useEffect(() => setBestLineShown(false), [bestLineLabel]);

  const realizedPct = Math.round(realizedEquity * 100);
  const rawPct = Math.round(rawEquity * 100);
  const factorPct = Math.round(realizationFactor * 100);
  const bePct = Math.round(breakEvenOdds * 100);

  const tooltipText = `🧮 Playable Odds Math Breakdown (${realizedPct}%):\n• Raw Showdown Equity (${rawPct}%): Pure win odds if all cards dealt now.\n• Position Retention (${factorPct}%): How much card strength you claim based on position.\n• Formula: ${rawPct}% Raw × ${factorPct}% Position = ${realizedPct}% Playable Odds.\n• Call Odds Threshold (${bePct}%): Minimum win % to call.\n• Verdict: ${
    realizedPct >= bePct ? `+${realizedPct - bePct}% Profit Margin (+EV Call)` : `-${bePct - realizedPct}% Deficit (-EV Fold)`
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
            <span className="math-hover-title">🧮 Playable Odds Math Breakdown</span>
            <span className="math-hover-line">
              🔹 <b>Raw Equity ({rawPct}%)</b>: Pure card win odds at showdown if no more bets occurred.
            </span>
            <span className="math-hover-line">
              🔹 <b>Position Retention ({factorPct}%)</b>: Claim factor based on seat position (In position = 100%, Out of position = 80%).
            </span>
            <span className="math-hover-line highlight-line">
              🎯 <b>Playable Odds Formula</b>: {rawPct}% Raw × {factorPct}% Position = <b>{realizedPct}% Realized</b>
            </span>
            <span className="math-hover-line sub-line">
              ⚖️ <b>Break-Even Call Odds ({bePct}%)</b>: Minimum win % needed to call (Call ÷ Total Pot).
            </span>
            <span className="math-hover-line verdict-line">
              {realizedPct >= bePct
                ? `✅ Profit Margin: ${realizedPct}% > ${bePct}% (+${realizedPct - bePct}% +EV Call!)`
                : `⚠️ Deficit: ${realizedPct}% < ${bePct}% (-${bePct - realizedPct}% -EV Fold!)`}
            </span>
          </span>
        </span>
        <span className="peek-divider">•</span>
        <span className="peek-item" title={DEFINITIONS.ev}>
          Best Line:{' '}
          {bestLineShown ? (
            <b className="peek-gold">{bestLineLabel}</b>
          ) : (
            <span
              role="button"
              tabIndex={0}
              className="peek-reveal"
              onClick={(e) => {
                // The whole strip opens the Deep Math drawer, so the reveal has
                // to claim the click before it bubbles up to that handler.
                e.stopPropagation();
                setBestLineShown(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  e.preventDefault();
                  setBestLineShown(true);
                }
              }}
            >
              tap to reveal
            </span>
          )}
        </span>
      </div>
      <div className="peek-trigger">
        <span>Deep Math</span>
        <span className="peek-chevron">▲</span>
      </div>
    </button>
  );
};
