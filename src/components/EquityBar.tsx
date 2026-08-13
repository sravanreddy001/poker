import React from 'react';
import { DEFINITIONS } from '../analysis';
import type { EquityMethod } from '../engine/equity';

export interface EquityBarProps {
  /** Win odds 0..1, counted rather than simulated. */
  winOdds: number;
  /** The arithmetic behind `winOdds`, in one line. */
  winOddsWorking: string;
  winOddsMethod: EquityMethod;
  breakEvenOdds?: number;
}

const METHOD_TITLE: Record<EquityMethod, string> = {
  tier: 'Starting-hand chart',
  showdown: 'Hands you already beat',
  outs: 'Rule of 4 and 2',
};

export const EquityBar: React.FC<EquityBarProps> = ({
  winOdds,
  winOddsWorking,
  winOddsMethod,
  breakEvenOdds,
}) => {
  const winPct = Math.min(100, Math.max(0, Math.round(winOdds * 100)));
  const breakEvenPct =
    breakEvenOdds !== undefined ? Math.min(100, Math.max(0, Math.round(breakEvenOdds * 100))) : null;
  const clears = breakEvenPct === null || winPct >= breakEvenPct;

  return (
    <div className="equity-bar-card">
      <div className="equity-bar-header">
        <span className="equity-bar-title" title={DEFINITIONS.winOdds}>
          Win Odds
        </span>
        <span className="equity-factor-badge">{METHOD_TITLE[winOddsMethod]}</span>
      </div>

      <div className="equity-bar-track">
        <div className="equity-fill realized-fill" style={{ width: `${winPct}%` }} />
        {breakEvenPct !== null && breakEvenPct > 0 && (
          <div
            className="break-even-rule"
            style={{ left: `${breakEvenPct}%` }}
            title={DEFINITIONS.potOdds}
          >
            <span className="break-even-tag">{breakEvenPct}% needed</span>
          </div>
        )}
      </div>

      <div className="equity-bar-legend">
        <div className="legend-item" title={DEFINITIONS.winOdds}>
          <span className="legend-swatch emerald" />
          <span>
            Win odds: <b>{winPct}%</b>
          </span>
        </div>
        {breakEvenPct !== null && breakEvenPct > 0 && (
          <div className="legend-item" title={DEFINITIONS.potOdds}>
            <span className="legend-swatch red" />
            <span>
              Needed to call: <b>{breakEvenPct}%</b>
            </span>
          </div>
        )}
      </div>

      <div className="learning-card">
        <div className="learning-card-header">
          <span>💡 Do this yourself</span>
        </div>
        <div className="learning-card-body">
          <p style={{ margin: '0 0 6px 0' }}>
            <b>1. Your win odds ({winPct}%)</b>:<br />
            {winOddsWorking}
          </p>
          {breakEvenPct !== null && breakEvenPct > 0 && (
            <>
              <p style={{ margin: '0 0 6px 0' }}>
                <b>2. The price ({breakEvenPct}%)</b>:<br />
                Call ÷ (pot + call). That share of the final pot is what the call costs you, so it is
                the minimum win rate that breaks even.
              </p>
              <p style={{ margin: 0 }}>
                <b>3. Compare</b>:<br />
                {winPct}% {clears ? '≥' : '<'} {breakEvenPct}% —{' '}
                {clears ? 'calling is profitable.' : 'calling loses money over time.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
