import React from 'react';
import type { HandState } from '../engine/game';
import { money } from '../analysis';
import { Seat } from './Seat';
import { getBtnCoord } from './seatSlots';
import { CardView } from './CardView';

export interface PokerTableProps {
  state: HandState;
}

export const PokerTable: React.FC<PokerTableProps> = ({ state }) => {
  const btnSeat = state.btnSeat ?? 0;
  const n = state.players.length;
  const sbSeat = (btnSeat + 1) % n;
  const bbSeat = (btnSeat + 2) % n;
  const btnCoord = getBtnCoord(btnSeat, n);

  return (
    <div className="poker-table-wrapper">
      <div className="poker-oval-table">
        {/* Seats around the rail */}
        <div className="table-seats">
          {state.players.map((p) => {
            const posTag =
              p.id === btnSeat ? 'BTN' : p.id === sbSeat ? 'SB' : p.id === bbSeat ? 'BB' : '';

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
