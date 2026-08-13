import React from 'react';
import type { HandState } from '../engine/game';
import { money } from '../analysis';
import { EquityGraph } from './EquityGraph';

export interface ReviewRecord {
  street: string;
  winOdds: number;
  chosen: string;
  best: string;
  evLost: number;
  rationale?: string;
  pot: number;
  toCall: number;
  priceNeeded: number;
}

interface PostRoundReviewProps {
  decisions: ReviewRecord[];
  state: HandState;
  heroWon: boolean;
  onReplay: () => void;
  onNextHand: () => void;
  onClose?: () => void;
  seed: number;
}

export const PostRoundReview: React.FC<PostRoundReviewProps> = ({
  decisions,
  state,
  heroWon,
  onReplay,
  onNextHand,
  onClose,
  seed,
}) => {
  const totalEvLost = decisions.reduce((acc, d) => acc + d.evLost, 0);
  const isDecisionGood = totalEvLost < 0.1;

  let outcomeType: 'VARIANCE' | 'CONSEQUENCE' | 'WON_DESPITE' | 'CLEAN_WIN' = 'CLEAN_WIN';
  if (isDecisionGood && heroWon) {
    outcomeType = 'CLEAN_WIN';
  } else if (isDecisionGood && !heroWon) {
    outcomeType = 'VARIANCE';
  } else if (!isDecisionGood && heroWon) {
    outcomeType = 'WON_DESPITE';
  } else {
    outcomeType = 'CONSEQUENCE';
  }

  let headline = '';
  let subtext = '';

  switch (outcomeType) {
    case 'CLEAN_WIN':
      headline = '🎉 Perfect Play & Win!';
      subtext = 'You made optimal +EV choices across all streets and claimed the pot.';
      break;
    case 'VARIANCE':
      headline = '🛡️ Optimal Play (Bad Beat)';
      subtext = 'Your decisions were mathematically sound, but short-term card variance went to your opponent.';
      break;
    case 'WON_DESPITE':
      headline = '⚠️ Lucky Win (Sub-optimal Play)';
      subtext = 'You won this pot, but surrendered expected EV along the way. Focus on long-term EV math!';
      break;
    case 'CONSEQUENCE':
      headline = '🛑 Sub-optimal Play Cost Chips';
      subtext = 'Strategic mistakes left profit on the table. Review the street-by-street analysis below to fix leaks.';
      break;
  }

  // The bet is already in the recorded pot, so the pot it was bet into is
  // pot - toCall, and bet / pot is exactly the bluff's break-even fold rate.
  const bluffSpots = decisions
    .filter((d) => d.toCall > 0 && d.pot > 0)
    .map((d) => ({
      street: d.street,
      bet: d.toCall,
      potBefore: Math.max(0, d.pot - d.toCall),
      bluffNeeded: d.toCall / d.pot,
      mdf: (d.pot - d.toCall) / d.pot,
    }));

  // Leak Detector logic
  let leakTag = '';
  let leakExplanation = '';

  const preflopEvLost = decisions.filter((d) => d.street === 'preflop').reduce((acc, d) => acc + d.evLost, 0);
  const postflopEvLost = decisions.filter((d) => d.street !== 'preflop').reduce((acc, d) => acc + d.evLost, 0);

  if (preflopEvLost > 0.5) {
    leakTag = 'Preflop Over-calling / Loose Opening';
    leakExplanation = `You lost ${money(preflopEvLost)} in expected value preflop by entering pots with insufficient playable odds. Tighten opening ranges.`;
  } else if (postflopEvLost > 1.0) {
    leakTag = 'Postflop Value Mis-Sizing or Over-folding';
    leakExplanation = `You surrendered ${money(postflopEvLost)} in expected profit on flop/turn/river decisions. Pay attention to pot odds required vs realized equity.`;
  }

  return (
    <div className="review-modal-backdrop" onClick={onClose}>
      <div className="review-modal-card" onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <button type="button" className="modal-close-icon" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        )}

        <div className={`review-headline-bar ${outcomeType.toLowerCase()}`}>
          <div className="headline-title">{headline}</div>
          <div className="headline-sub">{subtext}</div>
        </div>

        {/* EV Summary Stat Pill */}
        <div className="ev-summary-bar">
          <div className="ev-stat-item">
            <span className="stat-label">Total EV Surrendered:</span>
            <span className={`stat-val ${totalEvLost > 0.1 ? 'ev-neg' : 'ev-pos'}`}>
              {totalEvLost > 0.1 ? `-${money(totalEvLost)}` : '$0.00 (Optimal)'}
            </span>
          </div>
        </div>

        {/* Multi-Player Win Probability Progression Graph */}
        <EquityGraph state={state} />

        {/* Street-by-Street Decision Timeline */}
        {decisions.length > 0 && (
          <div className="street-timeline-container">
            <div className="section-label">📜 Street-by-Street Decision Analysis</div>
            <div className="timeline-cards">
              {decisions.map((dec, idx) => {
                const isOptimal = dec.evLost < 0.05;

                return (
                  <div key={idx} className={`timeline-card ${isOptimal ? 'optimal' : 'suboptimal'}`}>
                    <div className="timeline-card-header">
                      <span className="street-tag">{dec.street.toUpperCase()}</span>
                      <span className={`ev-result-pill ${isOptimal ? 'pos' : 'neg'}`}>
                        {isOptimal ? '✅ Optimal (+EV)' : `⚠️ Profit Left: -${money(dec.evLost)}`}
                      </span>
                    </div>

                    <div className="action-compare-row">
                      <div className="action-box user-action">
                        <span className="box-label">Your Action</span>
                        <span className="box-val">{dec.chosen}</span>
                      </div>
                      <div className="action-arrow">➔</div>
                      <div className="action-box optimal-action">
                        <span className="box-label">Optimal Move ($ EV)</span>
                        <span className="box-val">{dec.best}</span>
                      </div>
                    </div>

                    {dec.rationale && (
                      <div className="tactical-rationale-box">
                        <span className="rationale-icon">🎯</span>
                        <span className="rationale-text">{dec.rationale}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Leak Tag Warning Badge with Detailed Explanation */}
        {leakTag && (
          <div className="leak-badge">
            <div className="leak-title">⚠️ Leak Identified: <b>{leakTag}</b></div>
            <div className="leak-explanation">{leakExplanation}</div>
          </div>
        )}

        {/* What one hand can actually teach: the comparison you made at each
            decision, and whether it was the right one regardless of the result. */}
        <div className="review-panel">
          <div className="section-label">📊 The comparison, street by street</div>
          <div className="review-table">
            <span className="review-th">Street</span>
            <span className="review-th">You had</span>
            <span className="review-th">Price needed</span>
            <span className="review-th">Edge</span>
            {decisions.map((d, i) => {
              const had = Math.round(d.winOdds * 100);
              const needed = Math.round(d.priceNeeded * 100);
              const free = d.toCall <= 0;
              return (
                <React.Fragment key={i}>
                  <span className="review-td review-street">{d.street}</span>
                  <span className="review-td">{had}%</span>
                  <span className="review-td">{free ? 'nothing owed' : `${needed}%`}</span>
                  <span className={`review-td ${free || had >= needed ? 'edge-yes' : 'edge-no'}`}>
                    {free ? '—' : had >= needed ? `+${had - needed}` : `${had - needed}`}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
          <div className="review-note">
            This is the whole statistical game: one number you counted, one number the price
            demanded, and the difference between them. Being ahead of the price every time is what
            makes money — <b>this hand's result does not tell you whether you were</b>. The pot
            swung {money(state.awardedPot)}; your decisions were worth{' '}
            {totalEvLost > 0.01 ? `-${money(totalEvLost)}` : money(0)}. Only the second number
            repeats over the next thousand hands.
          </div>
        </div>

        {/* The bluff side of the same arithmetic, which is where most of the
            money in a no-limit game actually moves. */}
        {bluffSpots.length > 0 && (
          <div className="review-panel">
            <div className="section-label">🎭 The bluff angle</div>
            <div className="review-table review-table-bluff">
              <span className="review-th">Street</span>
              <span className="review-th">They bet</span>
              <span className="review-th">Their bluff needed</span>
              <span className="review-th">So you defend</span>
              {bluffSpots.map((s, i) => (
                <React.Fragment key={i}>
                  <span className="review-td review-street">{s.street}</span>
                  <span className="review-td">
                    {money(s.bet)} into {money(s.potBefore)}
                  </span>
                  <span className="review-td">{Math.round(s.bluffNeeded * 100)}% folds</span>
                  <span className="review-td">{Math.round(s.mdf * 100)}%</span>
                </React.Fragment>
              ))}
            </div>
            <div className="review-note">
              A bluff is priced exactly like a call, from the other side: <b>bet ÷ (pot + bet)</b>{' '}
              is the share of the time it has to work. Those two columns always add to 100% — the
              folds their bluff needs and the hands you have to keep are the same number seen from
              opposite chairs. Fold more than that and their bet prints money holding anything;
              defend more and they can stop bluffing and only value bet you.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="review-modal-actions">
          <button type="button" className="replay-btn" onClick={onReplay}>
            Replay Hand (Seed #{seed})
          </button>
          <button type="button" className="next-hand-btn" onClick={onNextHand}>
            Next Hand →
          </button>
        </div>
      </div>
    </div>
  );
};
