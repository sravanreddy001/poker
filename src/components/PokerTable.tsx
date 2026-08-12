import React from 'react';
import type { HandState } from '../engine/game';
import type { HeroAnalysis } from '../analysis';
import { money } from '../analysis';
import { Seat } from './Seat';
import { getBtnCoord } from './seatSlots';
import { CardView } from './CardView';
import { CoachChips } from './CoachChips';

export interface PokerTableProps {
  state: HandState;
  analysis?: HeroAnalysis | null;
  coachDensity?: 'full' | 'focus' | 'off';
}

const POS_NAMES_6MAX = [
  { short: 'BTN', full: 'Button (BTN)' },
  { short: 'SB', full: 'Small Blind (SB)' },
  { short: 'BB', full: 'Big Blind (BB)' },
  { short: 'UTG', full: 'Under The Gun (UTG)' },
  { short: 'MP', full: 'Middle Position (MP)' },
  { short: 'CO', full: 'Cutoff (CO)' },
];

export const PokerTable: React.FC<PokerTableProps> = ({ state, analysis, coachDensity = 'full' }) => {
  const btnSeat = state.btnSeat ?? 0;
  const n = state.players.length;
  const btnCoord = getBtnCoord(btnSeat, n);

  const heroOffset = (0 - btnSeat + n) % n;
  const heroPosLabel = POS_NAMES_6MAX[heroOffset % POS_NAMES_6MAX.length]?.full ?? 'Position';
  const toCall = Math.max(0, state.currentBet - state.players[0].committed);

  return (
    <div className="poker-table-wrapper">
      {/* Coach Chips - positioned absolutely relative to table-zone/app-root */}
      {analysis && (
        <CoachChips
          analysis={analysis}
          state={state}
          coachDensity={coachDensity}
          toCall={toCall}
        />
      )}
      <div className="poker-oval-table">
        {/* Seats around the rail */}
        <div className="table-seats">
          {state.players.map((p) => {
            const offset = (p.id - btnSeat + n) % n;
            const posTag = POS_NAMES_6MAX[offset % POS_NAMES_6MAX.length]?.short ?? '';

            return (
              <Seat
                key={p.id}
                player={p}
                totalPlayers={n}
                isCurrentToAct={state.toAct === p.id}
                isComplete={state.complete}
                isWinner={state.winners.includes(p.id)}
                positionTag={posTag}
              />
            );
          })}
        </div>

        {/* Dealer Button derived from button seat */}
        <div
          className="dealer-btn"
          style={{ left: btnCoord.left, top: btnCoord.top }}
          aria-label={`Dealer button at seat ${btnSeat}`}
        >
          D
        </div>

        {/* Table Center: Community Board Cards & Pot */}
        <div className="table-center">
          <div className="hero-pos-banner">
            📍 You: <b>{heroPosLabel}</b>
          </div>
          <div className="street-badge">{state.street.toUpperCase()}</div>
          <div className="board-cards">
            {state.board.map((c, i) => (
              <CardView key={i} card={c} />
            ))}
            {Array.from({ length: 5 - state.board.length }).map((_, i) => (
              <span key={`empty-${i}`} className="card empty" />
            ))}
          </div>
          <div className="pot-chip-badge">
            <span className="pot-icon">🪙</span>
            <span className="pot-text">
              {state.complete
                ? `Final Pot: ${money(state.awardedPot)}`
                : `Pot: ${money(state.pot)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
