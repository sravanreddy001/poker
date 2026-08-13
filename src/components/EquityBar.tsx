import React from 'react';
import { DEFINITIONS, money } from '../analysis';
import type { MathRow } from '../analysis';
import { preflopTierTable } from '../engine/equity';
import type { EquityMethod } from '../engine/equity';

export interface EquityBarProps {
  /** Win odds 0..1, counted rather than simulated. */
  winOdds: number;
  /** The arithmetic behind `winOdds`, in one line. */
  winOddsWorking: string;
  /** The same working, one step per line. */
  winOddsMath: MathRow[];
  winOddsMethod: EquityMethod;
  breakEvenOdds?: number;
  /** The price itself, so the break-even line shows real dollars. */
  toCall?: number;
  pot?: number;
  /** The hand being held, so the chart can point at its own row. */
  handName?: string;
  handRank?: number;
  handOf?: number;
  /** Which chart row the hand landed in: 'premium' … 'trash'. */
  tierKey?: string;
}

const METHOD_TITLE: Record<EquityMethod, string> = {
  tier: 'Starting-hand chart',
  showdown: 'Hands you already beat',
  outs: 'Rule of 4 and 2',
};

/** Where the number comes from, before the arithmetic that produces it. */
const METHOD_HOW: Record<EquityMethod, string> = {
  tier: 'No board yet, so there is nothing to count. The number is read off a starting-hand chart: which tier your two cards fall in, and how that tier scores against the range this opponent opens.',
  showdown:
    'You are already ahead, so the count is exact. Deal every hand the opponent can still hold against this board, and see how many of them your five cards beat. Ties count as half.',
  outs: 'You are behind, so the number is about improving. Count the cards that would put you in front, then use the Rule of 4 and 2: × 4 on the flop (two cards to come), × 2 on the turn (one card).',
};

/** The chart is the same every hand, so it is built once. */
const TIER_ROWS = preflopTierTable();

export const EquityBar: React.FC<EquityBarProps> = ({
  winOdds,
  winOddsWorking,
  winOddsMath,
  winOddsMethod,
  breakEvenOdds,
  toCall = 0,
  pot = 0,
  handName,
  handRank,
  handOf,
  tierKey,
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

      {winOddsMethod === 'tier' && (
        <div className="tier-chart-card">
          <div className="tier-chart-header">
            <span>The chart this number came from</span>
            {handName && handRank && handOf && (
              <span className="tier-chart-hand">
                {handName} — #{handRank} of {handOf}
              </span>
            )}
          </div>
          <table className="tier-chart">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Slice of all hands</th>
                <th>Combos</th>
                <th>Starts at</th>
                <th>Win odds</th>
              </tr>
            </thead>
            <tbody>
              {TIER_ROWS.map((row) => {
                const mine = row.tier === tierKey;
                return (
                  <tr key={row.tier} className={mine ? 'tier-row-mine' : ''}>
                    <td>
                      {mine && <span className="tier-row-dot" aria-hidden="true" />}
                      {row.label}
                    </td>
                    <td>
                      {row.fromPct}–{row.toPct}%
                    </td>
                    <td>{row.combos}</td>
                    <td>{row.examples.join(' ')}</td>
                    <td className="tier-row-equity">{Math.round(row.equity * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="equity-method-note">
            Every hand is ranked by strength, then cut into five slices. Yours falls in the{' '}
            <b>{TIER_ROWS.find((r) => r.tier === tierKey)?.label ?? 'listed'}</b> slice, so the chart's number for that slice is your win
            odds. These five figures are the one thing the trainer does not count out — before the
            flop there is no board to count against, so a chart is what you would use at the table
            too. Everything from the flop on is counted from the cards in front of you.
          </p>
        </div>
      )}

      <div className="learning-card">
        <div className="learning-card-header">
          <span>💡 Do this yourself</span>
        </div>
        <p className="equity-working-lede">{winOddsWorking}</p>
        <div className="learning-card-body">
          <p className="equity-method-note">{METHOD_HOW[winOddsMethod]}</p>

          <div className="coach-math-block">
            <div className="coach-math-title">1. Your win odds</div>
            {winOddsMath.map((row) => (
              <div key={row.label} className={`coach-math ${row.answer ? 'coach-math-answer' : ''}`}>
                <span className="coach-math-label">{row.label}</span>
                <span className="coach-math-expr">{row.expr}</span>
              </div>
            ))}
          </div>

          {breakEvenPct !== null && breakEvenPct > 0 && (
            <>
              <div className="coach-math-block">
                <div className="coach-math-title">2. The price</div>
                <div className="coach-math">
                  <span className="coach-math-label">Break-even</span>
                  <span className="coach-math-expr">
                    {toCall > 0
                      ? `${money(toCall)} ÷ (${money(pot)} + ${money(toCall)}) = ${money(pot + toCall)} pot`
                      : 'call ÷ (pot + call)'}
                  </span>
                </div>
                <div className="coach-math coach-math-answer">
                  <span className="coach-math-label">Needed to call</span>
                  <span className="coach-math-expr">{breakEvenPct}%</span>
                </div>
                <p className="equity-method-note">
                  That share of the final pot is what the call costs you, so it is the lowest win
                  rate that breaks even.
                </p>
              </div>

              <div className="coach-math-block">
                <div className="coach-math-title">3. Compare</div>
                <div className="coach-math coach-math-answer">
                  <span className="coach-math-label">{clears ? 'Call' : 'Fold'}</span>
                  <span className="coach-math-expr">
                    {winPct}% {clears ? '≥' : '<'} {breakEvenPct}% —{' '}
                    {clears ? 'calling is profitable.' : 'calling loses money over time.'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
