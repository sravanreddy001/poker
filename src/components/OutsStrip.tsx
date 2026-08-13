import React from 'react';
import type { Card } from '../engine/cards';
import { CardView } from './CardView';
import { pct, DEFINITIONS } from '../analysis';

export interface OutsStripProps {
  outs: Card[];
  ruleOfNEstimate: number | null;
  cardsToCome: number;
}

export const OutsStrip: React.FC<OutsStripProps> = ({
  outs,
  ruleOfNEstimate,
  cardsToCome,
}) => {
  if (outs.length === 0) return null;

  const multiplier = cardsToCome === 2 ? 4 : 2;
  const streetName = cardsToCome === 2 ? 'Flop' : 'Turn';

  return (
    <div className="outs-strip-container">
      <div className="outs-strip-header">
        <span className="outs-title" title={DEFINITIONS.outs}>
          The cards that win it
        </span>
        <span className="outs-rule" title={DEFINITIONS.ruleOf42}>
          {outs.length} × {multiplier} ={' '}
          <b>{ruleOfNEstimate !== null ? pct(ruleOfNEstimate) : '—'}</b>
        </span>
      </div>

      <div className="outs-cards-row">
        {outs.map((card, i) => (
          <CardView key={i} card={card} />
        ))}
      </div>

      {/* Counting these by hand is the whole drill, so name what to count. */}
      <div className="outs-note">
        Count the cards above, not the percentage: on the <b>{streetName}</b> there {multiplier === 4 ? 'are 2 cards' : 'is 1 card'} to
        come, so each one is worth about <b>{multiplier}%</b>.
      </div>
    </div>
  );
};
