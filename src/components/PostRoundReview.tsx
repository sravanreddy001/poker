import React from 'react';
import { money } from '../analysis';

export interface ReviewRecord {
  street: string;
  rawEquity: number;
  realizedEquity: number;
  chosen: string;
  best: string;
  evLost: number;
}

interface PostRoundReviewProps {
  decisions: ReviewRecord[];
  heroWon: boolean;
  onReplay: () => void;
  onNextHand: () => void;
  seed: number;
}

export const PostRoundReview: React.FC<PostRoundReviewProps> = ({
  decisions,
  heroWon,
  onReplay,
  onNextHand,
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

  let leakTag = '';
  let leakExplanation = '';
  if (!isDecisionGood) {
    const worstDecision = [...decisions].sort((a, b) => b.evLost - a.evLost)[0];
    if (worstDecision) {
      if (worstDecision.chosen === 'call') {
        leakTag = 'Unprofitable Call with Draw Out of Position';
        leakExplanation =
          'You paid to call a bet with an incomplete drawing hand while acting first (out of position). Future opponent bets will force you to fold before seeing the river, making this call a long-term loss.';
      } else if (worstDecision.chosen === 'fold') {
        leakTag = 'Folded a Profitable Hand to Opponent Bet';
        leakExplanation =
          'Your hand had sufficient win odds and pot odds to make calling or betting profitable, but you folded.';
      } else {
        leakTag = 'Sub-optimal Bet Size Selected';
        leakExplanation =
          'Your bet size was too small or too large compared to the optimal size, surrendering dollar profit ($ EV).';
      }
    }
  }

  return (
    <div className="review-modal-backdrop">
      <div className="review-modal-card">
        {/* Outcome Header Banner */}
        <div className={`outcome-banner ${outcomeType.toLowerCase()}`}>
          <div className="outcome-indicator" />
          <div className="outcome-text-group">
            <span className="outcome-title">
              {outcomeType === 'CLEAN_WIN' && 'Clean Win (+EV & Won)'}
              {outcomeType === 'VARIANCE' && 'Variance (+EV & Lost Runout)'}
              {outcomeType === 'WON_DESPITE' && 'Won Despite (-EV Mistake)'}
              {outcomeType === 'CONSEQUENCE' && 'Consequence (-EV Earned Loss)'}
            </span>
            <span className="outcome-subtitle">
              {outcomeType === 'VARIANCE' && 'Your play was mathematically optimal (+EV); short-term runout variance caused the loss.'}
              {outcomeType === 'WON_DESPITE' && 'You won the pot, but your action surrendered expected profit ($ EV).'}
              {outcomeType === 'CONSEQUENCE' && `Surrendered ${money(totalEvLost)} in expected value due to sub-optimal decisions.`}
              {outcomeType === 'CLEAN_WIN' && 'Optimal play (+EV) and a winning result!'}
            </span>
          </div>
        </div>

        {/* 2x2 Outcome vs Decision Quality Matrix */}
        <div className="matrix-section">
          <span className="section-label">Decision Quality vs Outcome Matrix</span>
          <div className="matrix-grid">
            <div className={`matrix-cell ${outcomeType === 'CLEAN_WIN' ? 'active-cell' : ''}`}>
              <span className="matrix-cell-title">+EV & Won</span>
              <span className="matrix-cell-tag">Clean Win</span>
            </div>
            <div className={`matrix-cell ${outcomeType === 'VARIANCE' ? 'active-cell' : ''}`}>
              <span className="matrix-cell-title">+EV & Lost</span>
              <span className="matrix-cell-tag">Variance</span>
            </div>
            <div className={`matrix-cell ${outcomeType === 'WON_DESPITE' ? 'active-cell' : ''}`}>
              <span className="matrix-cell-title">-EV & Won</span>
              <span className="matrix-cell-tag">Won Despite</span>
            </div>
            <div className={`matrix-cell ${outcomeType === 'CONSEQUENCE' ? 'active-cell' : ''}`}>
              <span className="matrix-cell-title">-EV & Lost</span>
              <span className="matrix-cell-tag">Consequence</span>
            </div>
          </div>
        </div>

        {/* Street-by-Street EV Waterfall */}
        {decisions.length > 0 && (
          <div className="waterfall-section">
            <span className="section-label">Street-by-Street EV Surrendered</span>
            <div className="waterfall-rows">
              {decisions.map((d, idx) => (
                <div key={idx} className="waterfall-row">
                  <span className="waterfall-street">{d.street}</span>
                  <span className="waterfall-chosen">Action: {d.chosen} (Best: {d.best})</span>
                  <span className={`waterfall-ev ${d.evLost > 0 ? 'ev-loss' : 'ev-perfect'}`}>
                    {d.evLost > 0 ? `-${money(d.evLost)}` : money(0)}
                  </span>
                </div>
              ))}
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
