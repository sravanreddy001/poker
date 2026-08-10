import React from 'react';

interface TerminologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TerminologyModal: React.FC<TerminologyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const terms = [
    {
      title: 'Community Cards (The Board)',
      desc: 'The 5 shared cards dealt face-up in the center of the table across 3 rounds (Flop, Turn, River). All players combine these with their 2 private hole cards to form their best 5-card poker hand.',
    },
    {
      title: 'The Flop',
      desc: 'The 1st round of community cards: 3 cards dealt face-up all at once after preflop betting.',
    },
    {
      title: 'The Turn',
      desc: 'The 2nd round of community cards: the 4th card dealt face-up after Flop betting completes.',
    },
    {
      title: 'The River',
      desc: 'The 3rd and final round of community cards: the 5th card dealt face-up after Turn betting completes.',
    },
    {
      title: 'Showdown Win Odds (Raw Equity)',
      desc: 'If all remaining community cards were dealt right now with NO further betting allowed, this is how often your cards would win the pot at showdown (e.g. 58% = winning 58 out of 100 card runouts).',
    },
    {
      title: 'Playable Win Odds (Realized Equity) & Equity Tiers',
      desc: 'Your realistic chance of winning the pot when factoring in future betting rounds. Benchmark Tiers:\n• 🔴 Weak Equity (< 35%): Unimproved high cards or weak pairs out of position. Requires cheap pot odds or folding.\n• 🟡 Medium Equity (35% – 55%): Coin-flip hands, middle pair, or strong draws. Calling is +EV when equity exceeds required pot odds.\n• 🟢 Strong Equity (55%+): Dominant top pairs, sets, straights, and flushes. Primary range for value betting and raising.',
    },
    {
      title: 'Bet Sizing Strategy (Why Choose a Specific Size?)',
      desc: 'Sizing choices are driven by board texture and hand equity:\n• ⚡ Small Sizing (1/3 Pot / 33%): High-frequency probe bet on dry boards. Risks minimal chips while forcing opponent to fold low-equity hands.\n• 🎯 Medium Sizing (1/2 Pot / 50%): Standard value bet. Extracts value from second-best pairs while keeping opponent\'s calling range wide.\n• 💥 Large Sizing (3/4 Pot / 75%): Used on wet/draw-heavy textures with strong equity to charge draws a high price to see future cards.\n• 👑 Overbet / All-In (100%+ Pot / Shove): Used with monster hands to extract maximum dollar value or polarize your bluffing range.',
    },
    {
      title: 'Why Overbet 2x Pot? (The Goldilocks EV Curve)',
      desc: 'Expected Value ($ EV) follows a curve: EV = [Call Amount × Calling Frequency].\n• Why NOT Lower (1x Pot)? Betting smaller leaves dollar profit on the table. Opponent would still call 2x pot with their strong catchers.\n• Why NOT Higher (4x Pot)? Betting 4x pot exceeds opponent\'s elastic calling threshold, forcing them to fold everything except hands that beat you (making you get called only when losing).\n• The 2x Sweet Spot: Maximizes total dollar extraction (+ $4.14 EV) while keeping opponent\'s catchers in the pot!',
    },
    {
      title: 'Position Retention (Realization Factor)',
      desc: 'Calculated as Realized Equity ÷ Raw Equity. Measures what percentage of your raw card strength you actually get to claim based on table position and opponent betting.',
    },
    {
      title: 'Break-Even Call Odds (Pot Odds)',
      desc: 'The ratio of the call price to the total pot size. Formula: Call ÷ (Pot + Call). Tells you the minimum win rate required to make calling profitable long-term.',
    },
    {
      title: 'Action Expected Profit ($ EV)',
      desc: 'The average dollar profit or loss of an action calculated over thousands of identical poker hands.',
    },
    {
      title: 'Winning Cards (Outs) & Rule of 4/2',
      desc: 'Outs are unseen cards remaining in the deck that improve your hand to a winner. Multiply outs by 4 on the Flop (2 cards to come) or 2 on the Turn (1 card to come) to quickly estimate your win percentage in your head.',
    },
    {
      title: 'Stack-to-Pot Ratio (SPR)',
      desc: 'Your remaining chip stack divided by the pot size. High SPR means deep stacks (careful play); low SPR means committed stacks.',
    },
    {
      title: 'Opponent Starting Range',
      desc: 'The full 13×13 grid of starting hand combinations your opponent is estimated to play based on their position and action history.',
    },
  ];

  return (
    <div className="review-modal-backdrop" onClick={onClose}>
      <div className="review-modal-card terminology-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-bar">
          <span className="modal-header-title">❓ Poker Trainer Glossary & Terminology</span>
          <button type="button" className="modal-close-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="glossary-list">
          {terms.map((t, idx) => (
            <div key={idx} className="glossary-item">
              <div className="glossary-term-title">{t.title}</div>
              <div className="glossary-term-desc" style={{ whiteSpace: 'pre-line' }}>{t.desc}</div>
            </div>
          ))}
        </div>

        <button type="button" className="next-hand-btn modal-done-btn" onClick={onClose}>
          Close Glossary
        </button>
      </div>
    </div>
  );
};
