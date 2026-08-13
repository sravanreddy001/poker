import React, { useEffect, useState } from 'react';
import { pct, DEFINITIONS } from '../analysis';

export interface PeekStripProps {
  /** Win odds 0..1, worked out by counting — never simulated. */
  winOdds: number;
  /** One line of arithmetic the player can redo at the table. */
  winOddsWorking: string;
  breakEvenOdds?: number;
  bestLineLabel: string;
  onOpenSheet: () => void;
}

export const PeekStrip: React.FC<PeekStripProps> = ({
  winOdds,
  winOddsWorking,
  breakEvenOdds = 0,
  bestLineLabel,
  onOpenSheet,
}) => {
  // The answer stays covered until asked for: seeing the best line before you
  // have committed to one turns the drill into copying rather than deciding.
  const [bestLineShown, setBestLineShown] = useState(false);
  useEffect(() => setBestLineShown(false), [bestLineLabel]);

  const winPct = Math.round(winOdds * 100);
  const bePct = Math.round(breakEvenOdds * 100);
  const clears = winPct >= bePct;

  return (
    <button
      type="button"
      className="peek-strip"
      onClick={onOpenSheet}
      aria-label="Open win odds and expected value analysis drawer"
      title={`${winOddsWorking}\n\n${DEFINITIONS.winOdds}`}
    >
      <div className="peek-content">
        <span className="peek-item">
          Win odds: <b className="peek-highlight">{pct(winOdds)}</b>
        </span>
        <span className="peek-divider">vs</span>
        <span className="peek-item" title={DEFINITIONS.potOdds}>
          Need:{' '}
          {breakEvenOdds > 0 ? (
            <b className={clears ? 'peek-good' : 'peek-bad'}>{pct(breakEvenOdds)}</b>
          ) : (
            <b className="peek-highlight">—</b>
          )}
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
