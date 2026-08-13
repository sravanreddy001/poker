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
      title: '🧮 Where the Win Odds Number Comes From (No Simulation)',
      desc: 'Nothing on screen is simulated. The one Win Odds number is produced by whichever of three counts fits the street, and you can redo every one of them at the table:\n1. Preflop — Starting-Hand Tier: your two cards are looked up in a top-N% chart (Premium top 3%, Strong top 10%, Speculative top 20%, Marginal top 35%). Each tier carries a fixed win rate against a typical opening range.\n2. Ahead after the flop — Hands You Already Beat: your made hand is compared against every hand the opponent can still hold. "I beat 62% of their hands" is the number, counted, not estimated.\n3. Behind after the flop — Rule of 4/2: count your outs, multiply by 4 on the flop or 2 on the turn.',
    },
    {
      title: '🧮 The Two Numbers That Decide Every Call (Plain English)',
      desc: '• 1. Win Odds (%): how often you win this pot — from your hand tier preflop, from the share of their range you beat when ahead, or from outs × 4 / × 2 when drawing.\n• 2. Break-Even Call Odds (%): Call Price ÷ (Total Pot + Call Price). The minimum win rate that makes calling break even.\n• 3. The Verdict: Win Odds above Break-Even means calling profits; below means folding does. Example: 9 outs × 4 = 36% against a $10 call into a $30 pot ($10 ÷ $40 = 25%) is an 11-point edge — call.',
    },
    {
      title: '📍 6-Max Table Positions & Strategy Guide',
      desc: 'Position dictates action order on every street:\n• 🔴 UTG (Under The Gun): First to act preflop. Must play tightest range since 5 players act after you.\n• 🟠 MP (Middle Position / Hijack): Second to act preflop. Slightly wider opening range than UTG.\n• 🟢 CO (Cutoff): Acts right before the Button. Premium position for stealing blinds.\n• 🟡 BTN (Button / Dealer): Best position at the table! Acts last on every postflop street, maximizing control & equity realization.\n• 🔷 SB (Small Blind): Posts $0.50 blind. Worst postflop position (acts first on every street).\n• 🟣 BB (Big Blind): Posts $1.00 blind. Closes preflop action; gets discounted pot odds to defend.',
    },
    {
      title: '🎯 Bet Sizing Strategy (Why Choose a Specific Size?)',
      desc: 'The trainer offers the sizes a real table gives you a button for, and each one says something different:\n• 🎯 Half Pot (50%): Standard value bet. Charges second-best pairs while keeping their calling range wide.\n• 💥 Three-Quarter Pot (75%): For wet, draw-heavy boards — makes a draw pay a price worse than its odds.\n• 👑 Pot: Polarised. You have a big hand or a real bluff, and you are happy to fold out everything in between.\n• 🔥 All-In: When the stack-to-pot ratio is low enough that the rest of the money was going in anyway.\nAnything between these sizes is still on the slider — the advisor just will not name a size you have no button for.',
    },
    {
      title: '🧮 How to Calculate Win Odds & Pot Odds Yourself (4 Steps)',
      desc: '1. Count Outs: Flush draw = 9 outs, Open-Ended Straight = 8 outs, Gutshot = 4 outs.\n2. Rule of 4/2 (Win Odds): Multiply outs by 4 on the Flop or by 2 on the Turn. (e.g. 9 outs × 4 = 36%).\n3. Required Pot Odds %: Call ÷ (Pot + Call). (e.g. $10 call into $30 pot = $10/$40 = 25%).\n4. Decision Verdict: If Win Odds (36%) > Pot Odds (25%), CALLING IS PROFITABLE (+EV) by 11 points.',
    },
    {
      title: '📊 Win Odds Benchmark Tiers',
      desc: 'How to read the Win Odds number at a glance:\n• 🔴 Weak Equity (< 35%): Unimproved high cards or weak pairs out of position. Requires cheap pot odds or folding.\n• 🟡 Medium Equity (35% – 55%): Coin-flip hands, middle pair, or strong draws. Calling is +EV when equity exceeds required pot odds.\n• 🟢 Strong Equity (55%+): Dominant top pairs, sets, straights, and flushes. Primary range for value betting and raising.',
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
