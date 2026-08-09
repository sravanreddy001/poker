import React from 'react';

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
  const isDecisionGood = totalEvLost < 0.1; // EV lost near 0

  // Outcome Classification:
  // Variance: +EV decision & lost anyway
  // Consequence: -EV decision & lost
  // Won-Despite: -EV decision & won anyway
  // Clean Win: +EV decision & won
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

  // Leak tag identification
  let leakTag = '';
  if (!isDecisionGood) {
    const worstDecision = [...decisions].sort((a, b) => b.evLost - a.evLost)[0];
    if (worstDecision) {
      if (worstDecision.chosen === 'call') {
        leakTag = 'Overcalled draw out of position';
      } else if (worstDecision.chosen === 'fold') {
        leakTag = 'Overfolded to river aggression';
      } else {
        leakTag = 'Suboptimal bet sizing';
      }
    }
  }

  return (
    <div className="review-modal-backdrop">
      <div className="review-modal-card">
        {/* Outcome Header Banner */}
        <div className={`outcome-banner ${outcomeType.toLowerCase()}`}>
          <span className="outcome-icon">
            {outcomeType === 'CLEAN_WIN'
              ? '🏆'
              : outcomeType === 'VARIANCE'
                ? '🛡️'
                : outcomeType === 'WON_DESPITE'
                  ? '⚠️'
                  : '💥'}
          </span>
          <div className="outcome-text-group">
            <span className="outcome-title">
              {outcomeType === 'CLEAN_WIN' && 'Clean Win (+EV & Won)'}
              {outcomeType === 'VARIANCE' && 'Variance (+EV & Lost Runout)'}
              {outcomeType === 'WON_DESPITE' && 'Won Despite (-EV Mistake)'}
              {outcomeType === 'CONSEQUENCE' && 'Consequence (-EV Earned Loss)'}
            </span>
            <span className="outcome-subtitle">
              {outcomeType === 'VARIANCE' && 'Your play was mathematically optimal; runout variance caused the loss.'}
              {outcomeType === 'WON_DESPITE' && 'You won the pot, but your action was sub-optimal in EV.'}
              {outcomeType === 'CONSEQUENCE' && `Surrendered ${totalEvLost.toFixed(2)} BB in expected value.`}
              {outcomeType === 'CLEAN_WIN' && 'Optimal play and a winning result!'}
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
                    {d.evLost > 0 ? `-${d.evLost.toFixed(2)} BB` : '0.00 BB'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leak Tag Warning Badge */}
        {leakTag && (
          <div className="leak-badge">
            <span className="leak-icon">⚠️</span>
            <span className="leak-text">Leak Identified: <b>{leakTag}</b></span>
          </div>
        )}

        {/* Actions */}
        <div className="review-modal-actions">
          <button type="button" className="replay-btn" onClick={onReplay}>
            🔄 What-If Replay Hand (Seed #{seed})
          </button>
          <button type="button" className="next-hand-btn" onClick={onNextHand}>
            Next Hand →
          </button>
        </div>
      </div>
    </div>
  );
};
