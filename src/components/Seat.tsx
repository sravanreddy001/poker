import React from 'react';
import type { Player } from '../engine/game';
import { money } from '../analysis';
import { CardView } from './CardView';
import { SLOT_COORDS, getSeatSlot } from './seatSlots';

export interface SeatProps {
  player: Player;
  totalPlayers: number;
  isCurrentToAct: boolean;
  isComplete: boolean;
  isWinner: boolean;
}

export const Seat: React.FC<SeatProps> = ({
  player,
  totalPlayers,
  isCurrentToAct,
  isComplete,
  isWinner,
}) => {
  const slotIndex = getSeatSlot(player.id, totalPlayers);
  const coord = SLOT_COORDS[slotIndex];

  const isHero = player.id === 0;
  const name = isHero ? 'You (Hero)' : `Bot ${player.id}`;
  const statusText = player.folded
    ? 'Folded'
    : isWinner
      ? 'Won'
      : isCurrentToAct && !isComplete
        ? 'Thinking...'
        : '';

  const ariaLabel = `${name}, stack ${money(player.stack)}${
    player.folded ? ', folded' : isWinner ? ', won' : ''
  }`;

  return (
    <div
      className={`seat-slot slot-${slotIndex} ${player.folded ? 'folded' : ''} ${
        isCurrentToAct && !isComplete ? 'active' : ''
      } ${isHero ? 'hero-seat' : ''}`}
      style={{ left: coord.left, top: coord.top }}
      aria-label={ariaLabel}
    >
      <div className="seat-badge">
        <div className="seat-name">
          {name}
          {player.id === 1 && <span className="seat-bluff-tag">Bluff 30%</span>}
        </div>
        <div className="seat-cards">
          <CardView card={player.hole?.[0]} hidden={!isHero && (!isComplete || player.folded)} />
          <CardView card={player.hole?.[1]} hidden={!isHero && (!isComplete || player.folded)} />
        </div>
        <div className="seat-stack">{money(player.stack)}</div>
        {player.committed > 0 && !isComplete && (
          <div className="seat-bet">bet {money(player.committed)}</div>
        )}
        {statusText && (
          <div className={`seat-tag ${isWinner ? 'won' : player.folded ? 'folded' : ''}`}>
            {statusText}
          </div>
        )}
      </div>
    </div>
  );
};
