import React from 'react';

interface HandRankingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface HandRankInfo {
  rank: number;
  name: string;
  example: string;
  dealProb: string;
  avgWinRate: string;
  description: string;
}

export const HAND_RANKINGS: HandRankInfo[] = [
  {
    rank: 1,
    name: 'Royal Flush',
    example: 'A♠ K♠ Q♠ J♠ 10♠',
    dealProb: '0.00015%',
    avgWinRate: '100%',
    description: 'A, K, Q, J, 10 all of the same suit. The highest possible hand in poker.',
  },
  {
    rank: 2,
    name: 'Straight Flush',
    example: '9♥ 8♥ 7♥ 6♥ 5♥',
    dealProb: '0.00139%',
    avgWinRate: '99.9%',
    description: 'Five consecutive cards of the same suit.',
  },
  {
    rank: 3,
    name: 'Four of a Kind (Quads)',
    example: '8♠ 8♥ 8♦ 8♣ K♦',
    dealProb: '0.0240%',
    avgWinRate: '99.5%',
    description: 'Four cards of the exact same numerical rank.',
  },
  {
    rank: 4,
    name: 'Full House',
    example: 'J♠ J♥ J♦ 4♣ 4♠',
    dealProb: '0.1441%',
    avgWinRate: '97.2%',
    description: 'Three of a kind combined with a pair (e.g., Jacks full of Fours).',
  },
  {
    rank: 5,
    name: 'Flush',
    example: 'A♦ J♦ 8♦ 6♦ 3♦',
    dealProb: '0.1965%',
    avgWinRate: '95.8%',
    description: 'Any five cards of the same suit, not in sequential order.',
  },
  {
    rank: 6,
    name: 'Straight',
    example: '10♠ 9♥ 8♦ 7♣ 6♠',
    dealProb: '0.3925%',
    avgWinRate: '91.4%',
    description: 'Five consecutive numerical cards of mixed suits.',
  },
  {
    rank: 7,
    name: 'Three of a Kind (Set / Trips)',
    example: 'Q♠ Q♥ Q♦ 9♣ 4♠',
    dealProb: '2.1128%',
    avgWinRate: '82.3%',
    description: 'Three cards of the same numerical rank.',
  },
  {
    rank: 8,
    name: 'Two Pair',
    example: 'K♠ K♥ 7♦ 7♣ A♠',
    dealProb: '4.7539%',
    avgWinRate: '76.1%',
    description: 'Two distinct pairs of matching ranks.',
  },
  {
    rank: 9,
    name: 'One Pair',
    example: 'A♠ A♥ J♦ 8♣ 3♠',
    dealProb: '42.2569%',
    avgWinRate: '49.8%',
    description: 'Two cards of the exact same numerical rank.',
  },
  {
    rank: 10,
    name: 'High Card',
    example: 'A♠ K♥ Q♦ 8♣ 2♠',
    dealProb: '50.1177%',
    avgWinRate: '17.4%',
    description: 'No made pair or combination. Hand value is determined by highest card.',
  },
];

export const HandRankingsModal: React.FC<HandRankingsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="review-modal-backdrop" onClick={onClose}>
      <div className="review-modal-card hand-ladder-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-bar">
          <span className="modal-header-title">🪜 Hand Rankings & Win Probabilities</span>
          <button type="button" className="modal-close-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="ladder-list">
          {HAND_RANKINGS.map((h) => (
            <div key={h.rank} className={`ladder-item rank-${h.rank}`}>
              <div className="ladder-rank-badge">#{h.rank}</div>
              <div className="ladder-info">
                <div className="ladder-name-row">
                  <span className="ladder-name">{h.name}</span>
                  <span className="ladder-example">{h.example}</span>
                </div>
                <div className="ladder-desc">{h.description}</div>
                <div className="ladder-stats-row">
                  <span>Deal Probability: <b>{h.dealProb}</b></span>
                  <span className="ladder-divider">•</span>
                  <span>Avg Win Rate: <b className="win-rate-text">{h.avgWinRate}</b></span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="next-hand-btn modal-done-btn" onClick={onClose}>
          Close Hand Ladder
        </button>
      </div>
    </div>
  );
};
