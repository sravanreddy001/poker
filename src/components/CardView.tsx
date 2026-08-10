import type { Card } from '../engine/cards';
import { cardLabel } from '../analysis';

export function CardView({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (hidden || card === undefined) {
    return <span className="card back" aria-label="hidden card" />;
  }
  const { rank, suit, red } = cardLabel(card);
  const suitClass = red ? 'red' : 'black';

  return (
    <span className={`card ${suitClass}`} aria-label={`${rank}${suit}`}>
      <b>{rank}</b>
      <i>{suit}</i>
    </span>
  );
}
