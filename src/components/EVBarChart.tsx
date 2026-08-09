import React from 'react';

export interface AdviceItem {
  label: string;
  amount: number;
  ev: number;
}

interface EVBarChartProps {
  advice: AdviceItem[];
  potOddsEvOfCall?: number;
  toCall?: number;
  chosenLabel?: string;
}

export const EVBarChart: React.FC<EVBarChartProps> = ({
  advice,
  potOddsEvOfCall = 0,
  toCall = 0,
  chosenLabel,
}) => {
  // Build a complete candidate list including Fold, Call (if toCall > 0), and Bet sizes
  const candidates: { label: string; ev: number }[] = [];

  // Fold is always EV 0
  candidates.push({ label: 'fold', ev: 0 });

  if (toCall > 0) {
    candidates.push({ label: 'call', ev: potOddsEvOfCall });
  }

  advice.forEach((item) => {
    // avoid duplication if label exists
    if (!candidates.some((c) => c.label === item.label)) {
      candidates.push({ label: item.label, ev: item.ev });
    }
  });

  // Sort descending by EV
  candidates.sort((a, b) => b.ev - a.ev);

  const maxEv = Math.max(...candidates.map((c) => Math.abs(c.ev)), 1);

  return (
    <div className="ev-barchart-container">
      <div className="ev-barchart-header">
        <span className="ev-barchart-title">Candidate Action EV Comparison</span>
        <span className="ev-barchart-unit">(in Big Blinds)</span>
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
                {isChosen && <span className="chosen-badge">Your Choice</span>}
              </div>

              <div className="ev-bar-track">
                <div
                  className={`ev-bar-fill ${isBest ? 'bar-best' : isNegative ? 'bar-neg' : 'bar-neutral'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <span className={`ev-bar-val ${item.ev > 0 ? 'pos-ev' : item.ev < 0 ? 'neg-ev' : ''}`}>
                {item.ev >= 0 ? `+${item.ev.toFixed(2)}` : item.ev.toFixed(2)} BB
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
