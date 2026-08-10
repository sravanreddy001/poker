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
  if (!isDecisionGood) {
    const worstDecision = [...decisions].sort((a, b) => b.evLost - a.evLost)[0];
    if (worstDecision) {
      if (worstDecision.chosen === 'call') {
        leakTag = 'Overcalled draw out of position (Surrendered Realized Equity)';
      } else if (worstDecision.chosen === 'fold') {
        leakTag = 'Overfolded to aggression (Folded +EV hand)';
      } else {
        leakTag = 'Suboptimal bet sizing (Missed Max Expected Value)';
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
              {outcomeType === 'WON_DESPITE' && 'You won the pot, but your action was sub-optimal in long-term Expected Value ($ EV).'}
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

        {/* Leak Tag Warning Badge */}
        {leakTag && (
          <div className="leak-badge">
            <span className="leak-text">Leak Identified: <b>{leakTag}</b></span>
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
