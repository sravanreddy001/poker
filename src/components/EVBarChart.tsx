import React from 'react';
import { EvOption } from '../engine/ev';
import { money, DEFINITIONS } from '../analysis';

export interface EVBarChartProps {
  advice: EvOption[];
  potOddsEvOfCall?: number;
  toCall?: number;
  chosenLabel?: string;
  revealed: boolean;
  onReveal: () => void;
}

export const EVBarChart: React.FC<EVBarChartProps> = ({
  advice,
  potOddsEvOfCall = 0,
  toCall = 0,
  chosenLabel,
  revealed,
  onReveal,
}) => {
  const candidates: { label: string; ev: number }[] = [];

  candidates.push({ label: 'fold', ev: 0 });

  if (toCall > 0) {
    candidates.push({ label: 'call', ev: potOddsEvOfCall });
  }

  advice.forEach((item) => {
    if (!candidates.some((c) => c.label === item.label)) {
      candidates.push({ label: item.label, ev: item.ev });
    }
  });

  candidates.sort((a, b) => b.ev - a.ev);

  const maxEv = Math.max(...candidates.map((c) => Math.abs(c.ev)), 1);
  const bestOption = candidates[0];

  return (
    <div className="ev-barchart-card">
      <div className="ev-barchart-header">
        <span className="ev-barchart-title" title={DEFINITIONS.ev}>
          Action Expected Profit ($ EV)
        </span>
        {!revealed ? (
          <button type="button" className="reveal-btn" onClick={onReveal}>
            🔓 Reveal EV Values (Logged)
          </button>
        ) : (
          <span className="ev-barchart-unit">(in Dollars)</span>
        )}
      </div>

      <div className="ev-barchart-rows">
        {candidates.map((item) => {
          const isBest = candidates[0].label === item.label;
          const isChosen = chosenLabel?.toLowerCase() === item.label.toLowerCase();
          const pct = Math.min(100, Math.max(8, (Math.abs(item.ev) / maxEv) * 100));
          const isNegative = item.ev < 0;

          return (
            <div
              key={item.label}
              className={`ev-bar-row ${isBest ? 'best-line' : ''} ${isChosen ? 'chosen-line' : ''}`}
            >
              <div className="ev-bar-label-area">
                <span className="ev-bar-label">{item.label}</span>
                {isBest && <span className="best-marker-badge">BEST</span>}
                {isChosen && <span className="chosen-badge">YOUR CHOICE</span>}
              </div>

              <div className="ev-bar-track">
                <div
                  className={`ev-bar-fill ${
                    isBest ? 'bar-best' : isNegative ? 'bar-neg' : 'bar-neutral'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <span className={`ev-bar-val ${item.ev > 0 ? 'pos-ev' : item.ev < 0 ? 'neg-ev' : ''}`}>
                {revealed ? money(item.ev, { sign: true }) : '••••'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Educational Definition Card */}
      <div className="learning-card">
        <div className="learning-card-header">
          <span>🎯 Definition: Expected Value ($ EV) & Pot Odds</span>
        </div>
        <div className="learning-card-body">
          <b>Expected Value ($ EV)</b> is the average long-term dollar outcome of each action.<br />
          <b>Best Action</b>: <b>{bestOption.label}</b> yields the highest expected profit ({money(bestOption.ev, { sign: true })}).
        </div>
      </div>
    </div>
  );
};
