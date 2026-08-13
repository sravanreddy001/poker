import React, { useState, useEffect } from 'react';
import type { Action } from '../engine/types';
import type { EvOption } from '../engine/ev';
import { money } from '../analysis';

export interface ActionBarProps {
  toCall: number;
  pot: number;
  stack: number;
  bigBlind: number;
  sizeButtons: EvOption[];
  onAct: (action: Action, label: string) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  toCall,
  pot,
  stack,
  bigBlind,
  sizeButtons,
  onAct,
}) => {
  const isRaise = toCall > 0;
  const minAmount = isRaise ? Math.min(stack, Math.max(toCall * 2, bigBlind * 2)) : Math.min(stack, bigBlind);
  const maxAmount = stack;

  const defaultSelected = sizeButtons.length > 0 ? sizeButtons[0].amount : minAmount;
  const [selectedAmount, setSelectedAmount] = useState<number>(defaultSelected);

  useEffect(() => {
    const init = sizeButtons.length > 0 ? sizeButtons[0].amount : minAmount;
    setSelectedAmount(Math.min(maxAmount, Math.max(minAmount, init)));
  }, [sizeButtons, minAmount, maxAmount]);

  const handleStep = (delta: number) => {
    setSelectedAmount((prev) => Math.min(maxAmount, Math.max(minAmount, prev + delta)));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedAmount(Number(e.target.value));
  };

  const verb = isRaise ? 'Raise to' : 'Bet';

  // Quick Preset Sizing Options. Min and the sub-half sizes are gone: they
  // crowded the row without teaching a different decision, and the slider
  // still reaches every amount between them.
  const presets = [
    { label: '1/2 Pot', amount: Math.min(stack, Math.max(minAmount, Math.round(pot / 2))) },
    { label: '3/4 Pot', amount: Math.min(stack, Math.max(minAmount, Math.round((pot * 3) / 4))) },
    { label: 'Pot', amount: Math.min(stack, Math.max(minAmount, Math.round(pot))) },
    { label: 'All-In', amount: stack },
  ];

  return (
    <div className="action-bar-container extended">
      {/* 1. Quick Preset Sizing Pills */}
      <div className="preset-pills-row">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            className={`preset-pill ${selectedAmount === p.amount ? 'active' : ''}`}
            onClick={() => setSelectedAmount(p.amount)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 2. Custom Amount Slider + Steppers (- / +) */}
      <div className="slider-controls-row">
        <button
          type="button"
          className="step-btn"
          onClick={() => handleStep(-bigBlind)}
          disabled={selectedAmount <= minAmount}
          aria-label="Decrease bet"
        >
          -
        </button>
        <input
          type="range"
          className="bet-slider"
          min={minAmount}
          max={maxAmount}
          step={bigBlind}
          value={selectedAmount}
          onChange={handleSliderChange}
          aria-label="Custom bet slider"
        />
        <button
          type="button"
          className="step-btn"
          onClick={() => handleStep(bigBlind)}
          disabled={selectedAmount >= maxAmount}
          aria-label="Increase bet"
        >
          +
        </button>
        <span className="selected-amount-badge">{money(selectedAmount)}</span>
      </div>

      {/* 3. Primary Action Buttons */}
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
            className="action-btn btn-check"
            onClick={() => onAct({ type: 'check' }, 'check')}
            aria-label="Check"
          >
            <span className="btn-title">Check</span>
            <span className="btn-sub">$0</span>
          </button>
        )}

        {/* Dynamic Raise / Bet Button for Selected Amount */}
        <button
          type="button"
          className="action-btn btn-bet-primary span-raise"
          onClick={() =>
            onAct(
              { type: isRaise ? 'raise' : 'bet', amount: selectedAmount },
              `${verb.toLowerCase()} ${selectedAmount}`,
            )
          }
          aria-label={`${verb} ${money(selectedAmount)}`}
        >
          <span className="btn-title">{verb} {money(selectedAmount)}</span>
          <span className="btn-sub">Custom Amount</span>
        </button>
      </div>
    </div>
  );
};
