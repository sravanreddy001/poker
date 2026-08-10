import React from 'react';
import type { Action } from '../engine/types';
import type { EvOption } from '../engine/ev';
import { money } from '../analysis';

export interface ActionBarProps {
  toCall: number;
  sizeButtons: EvOption[];
  onAct: (action: Action, label: string) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({ toCall, sizeButtons, onAct }) => {
  return (
    <div className="action-bar-container">
      <div className="action-grid">
        {toCall > 0 ? (
          <>
            <button
              type="button"
              className="action-btn btn-fold"
              onClick={() => onAct({ type: 'fold' }, 'fold')}
              aria-label="Fold hand"
            >
              <span className="btn-title">Fold</span>
              <span className="btn-sub">$0</span>
            </button>
            <button
              type="button"
              className="action-btn btn-call"
              onClick={() => onAct({ type: 'call' }, 'call')}
              aria-label={`Call ${money(toCall)}`}
            >
              <span className="btn-title">Call</span>
              <span className="btn-sub">{money(toCall)}</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="action-btn btn-check span-half"
            onClick={() => onAct({ type: 'check' }, 'check')}
            aria-label="Check"
          >
            <span className="btn-title">Check</span>
            <span className="btn-sub">$0</span>
          </button>
        )}

        {sizeButtons.slice(0, 2).map((o, idx) => {
          const isRaise = toCall > 0;
          const verb = isRaise ? 'Raise to' : 'Bet';
          const labelText = `${verb} ${money(o.amount)}`;
          const subText = o.label;
          const btnClass = idx === 0 ? 'btn-bet-primary' : 'btn-bet-secondary';

          return (
            <button
              key={o.label}
              type="button"
              className={`action-btn ${btnClass}`}
              onClick={() => onAct({ type: isRaise ? 'raise' : 'bet', amount: o.amount }, o.label)}
              aria-label={`${labelText}, ${subText}`}
            >
              <span className="btn-title">{labelText}</span>
              <span className="btn-sub">{subText}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
