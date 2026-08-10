import React from 'react';
import { pct, DEFINITIONS } from '../analysis';

export interface PeekStripProps {
  realizedEquity: number;
  bestLineLabel: string;
  onOpenSheet: () => void;
}

export const PeekStrip: React.FC<PeekStripProps> = ({
  realizedEquity,
  bestLineLabel,
  onOpenSheet,
}) => {
  return (
    <button
      type="button"
      className="peek-strip"
      onClick={onOpenSheet}
      aria-label="Open win odds and expected value analysis drawer"
    >
      <div className="peek-content">
        <span className="peek-item" title={DEFINITIONS.realizedEquity}>
          Playable Odds: <b className="peek-highlight">{pct(realizedEquity)}</b>
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
