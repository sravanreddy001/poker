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

        {/* Educational Definition Note */}
        <div className="learning-card">
          <div className="learning-card-header">
            <span>💡 Core Teaching Criterion</span>
          </div>
          <div className="learning-card-body">
            Separate decision quality from short-term outcome. Focus on choosing <b>+EV actions</b> over time, as variance evens out over large hand volume.
          </div>
        </div>

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
