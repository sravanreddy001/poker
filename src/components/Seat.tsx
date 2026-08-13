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
  positionTag?: string;
}

export const Seat: React.FC<SeatProps> = ({
  player,
  totalPlayers,
  isCurrentToAct,
  isComplete,
  isWinner,
  positionTag = '',
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

  // Style read: kept off the badge so the seat shows table facts only, and
  // surfaced on hover for when you actually want to profile the opponent.
  const styleNote = player.id === 1 ? 'Bluffs about 30% of the time when checked to' : '';

  const ariaLabel = `${name}, stack ${money(player.stack)}${
    player.folded ? ', folded' : isWinner ? ', won' : ''
  }${styleNote ? `. ${styleNote}` : ''}`;

  return (
    <div
      className={`seat-slot slot-${slotIndex} ${player.folded ? 'folded' : ''} ${
        isCurrentToAct && !isComplete ? 'active' : ''
      } ${isHero ? 'hero-seat' : ''}`}
      style={{ left: coord.left, top: coord.top }}
      aria-label={ariaLabel}
      title={styleNote || undefined}
    >
      <div className="seat-badge">
        <div className="seat-name">
          <span>{name}</span>
          {positionTag && (
            <span className={`position-badge ${positionTag.toLowerCase()}`}>
              {positionTag}
            </span>
          )}
        </div>
        <div className="seat-cards">
          <CardView card={player.hole?.[0]} hidden={!isHero && !isComplete} />
          <CardView card={player.hole?.[1]} hidden={!isHero && !isComplete} />
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
