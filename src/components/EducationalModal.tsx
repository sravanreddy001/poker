import React from 'react';

interface EducationalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EducationalModal: React.FC<EducationalModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const guides = [
    {
      title: '🎴 Counting Outs Visual Guide (Flush, Open-Ended, Gutshot)',
      desc: 'An "Out" is any unseen card remaining in the deck that completes your drawing hand into a winner:\n• 💧 Flush Draw (9 Outs): You hold 4 cards of one suit (e.g. 4 Hearts). 13 total hearts in deck minus 4 visible = 9 unseen hearts remaining. (9 × 4 = 36% win chance on Flop).\n• 🛣️ Open-Ended Straight Draw (8 Outs): 4 consecutive cards in a row (e.g. 5-6-7-8). Completed on EITHER END by 4 Nines or 4 Fours. (4 + 4 = 8 outs = 32% win chance on Flop).\n• 🎯 Gutshot Straight Draw (4 Outs): 4 cards with a missing gap in the middle (e.g. 4-5-[gap 6]-7-8). Only 4 Sixes in the deck fill the hole (4 outs = 16% win chance on Flop).\n• 🌟 Monster Combo Draw (15 Outs): Flush Draw + Open-Ended Straight Draw = 9 + 6 = 15 outs (15 × 4 = 60% win chance right on the Flop!).',
    },
    {
      title: '🎲 How the Engine Calculates Playable Odds (Monte Carlo Engine)',
      desc: 'Behind the scenes, Playable Odds (Realized Equity) are calculated in 3 steps:\n1. Raw Equity Runouts: The engine runs 2,000 random card deals comparing your hand against opponent\'s estimated starting range to find your pure showdown win % (e.g. 45% Raw Equity).\n2. Postflop Decision Simulation: The engine runs 400 full postflop hand playouts. In each playout, board cards are dealt and the GTO bot engine simulates opponent bets. If opponent bets aggressively out of position, your hand evaluates whether to call or fold early.\n3. Realized Winnings Formula: Playable Odds % = (Net Chips Collected Across All 400 Playouts ÷ Initial Pot). If you fold early in 60 out of 400 playouts, your 45% Raw Equity realizes down to 38% Playable Odds!',
    },
    {
      title: '🧮 Playable Odds Math Terminology Breakdown (Plain English)',
      desc: '• 1. Raw Showdown Equity (%): Your pure card strength if all board cards were dealt right now with NO future betting.\n• 2. Position Retention Factor (%): In real poker, future bets happen. Acting in position (BTN) lets you claim ~100% of your raw equity. Acting out of position (SB/UTG) forces you to fold early ~15%–20% of the time before seeing the river.\n• 3. Playable Odds Formula: Raw Equity % × Position Retention % = Playable Odds %.\n  (Example: 45% Raw Equity × 85% Retention = 38% Playable Odds).\n• 4. Break-Even Call Odds (Pot Odds %): Call Price ÷ (Total Pot + Call Price). Minimum win rate required to make calling break-even.\n• 5. Profit Margin (+EV): When your Playable Odds (38%) exceed Break-Even Call Odds (15%), calling makes long-term dollar profit (+23% +EV)!',
    },
    {
      title: '📍 6-Max Table Positions & Strategy Guide',
      desc: 'Position dictates action order on every street:\n• 🔴 UTG (Under The Gun): First to act preflop. Must play tightest range since 5 players act after you.\n• 🟠 MP (Middle Position / Hijack): Second to act preflop. Slightly wider opening range than UTG.\n• 🟢 CO (Cutoff): Acts right before the Button. Premium position for stealing blinds.\n• 🟡 BTN (Button / Dealer): Best position at the table! Acts last on every postflop street, maximizing control & equity realization.\n• 🔷 SB (Small Blind): Posts $0.50 blind. Worst postflop position (acts first on every street).\n• 🟣 BB (Big Blind): Posts $1.00 blind. Closes preflop action; gets discounted pot odds to defend.',
    },
    {
      title: '🎯 Bet Sizing Strategy (Why Choose a Specific Size?)',
      desc: 'Sizing choices are driven by board texture and hand equity:\n• ⚡ Small Sizing (1/3 Pot / 33%): High-frequency probe bet on dry boards. Risks minimal chips while forcing opponent to fold low-equity hands.\n• 🎯 Medium Sizing (1/2 Pot / 50%): Standard value bet. Extracts value from second-best pairs while keeping opponent\'s calling range wide.\n• 💥 Large Sizing (3/4 Pot / 75%): Used on wet/draw-heavy textures with strong equity to charge draws a high price to see future cards.\n• 👑 Overbet / All-In (100%+ Pot / Shove): Used with monster hands to extract maximum dollar value or polarize your bluffing range.',
    },
    {
      title: '👑 Why Overbet 2x Pot? (The Goldilocks EV Curve)',
      desc: 'Expected Value ($ EV) follows a curve: EV = [Call Amount × Calling Frequency].\n• Why NOT Lower (1x Pot)? Betting smaller leaves dollar profit on the table. Opponent would still call 2x pot with their strong catchers.\n• Why NOT Higher (4x Pot)? Betting 4x pot exceeds opponent\'s elastic calling threshold, forcing them to fold everything except hands that beat you (making you get called only when losing).\n• The 2x Sweet Spot: Maximizes total dollar extraction (+ $4.14 EV) while keeping opponent\'s catchers in the pot!',
    },
    {
      title: '🧮 How to Calculate Playable Odds & Pot Odds Yourself (5 Steps)',
      desc: '1. Count Outs: Flush draw = 9 outs, Open-Ended Straight = 8 outs, Gutshot = 4 outs.\n2. Rule of 4/2 (Raw Equity): Multiply outs by 4 on Flop or by 2 on Turn. (e.g. 9 outs × 4 = 36% Raw Equity).\n3. Position Realization (Playable Equity): Multiply by 1.0 if In Position (36%) or by 0.8 if Out of Position (29%).\n4. Required Pot Odds %: Call ÷ (Pot + Call). (e.g. $10 call into $30 pot = $10/$40 = 25%).\n5. Decision Verdict: If Playable Equity (29%) > Pot Odds (25%), CALL IS PROFITABLE (+EV)!',
    },
    {
      title: '📊 Playable Equity & Benchmark Tiers',
      desc: 'Your realistic chance of winning the pot when factoring in future betting rounds:\n• 🔴 Weak Equity (< 35%): Unimproved high cards or weak pairs out of position. Requires cheap pot odds or folding.\n• 🟡 Medium Equity (35% – 55%): Coin-flip hands, middle pair, or strong draws. Calling is +EV when equity exceeds required pot odds.\n• 🟢 Strong Equity (55%+): Dominant top pairs, sets, straights, and flushes. Primary range for value betting and raising.',
    },
  ];

  return (
    <div className="review-modal-backdrop" onClick={onClose}>
      <div className="review-modal-card terminology-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-bar">
          <span className="modal-header-title">ℹ️ Informational Strategy & How-To Guides</span>
          <button type="button" className="modal-close-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="glossary-list">
          {guides.map((g, idx) => (
            <div key={idx} className="glossary-item">
              <div className="glossary-term-title">{g.title}</div>
              <div className="glossary-term-desc" style={{ whiteSpace: 'pre-line' }}>{g.desc}</div>
            </div>
          ))}
        </div>

        <button type="button" className="next-hand-btn modal-done-btn" onClick={onClose}>
          Close Strategy Guide
        </button>
      </div>
    </div>
  );
};
