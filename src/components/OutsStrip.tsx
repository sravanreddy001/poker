import React from 'react';
import type { Card } from '../engine/cards';
import { CardView } from './CardView';
import { pct, DEFINITIONS } from '../analysis';

export interface OutsStripProps {
  outs: Card[];
  ruleOfNEstimate: number | null;
  cardsToCome: number;
  rawEquity: number;
}

export const OutsStrip: React.FC<OutsStripProps> = ({
  outs,
  ruleOfNEstimate,
  cardsToCome,
  rawEquity,
}) => {
  if (outs.length === 0) return null;

  const multiplier = cardsToCome === 2 ? 4 : 2;
  const streetName = cardsToCome === 2 ? 'Flop' : 'Turn';

  return (
    <div className="outs-strip-container">
      <div className="outs-strip-header">
        <span className="outs-title" title={DEFINITIONS.ruleOf42}>
          Rule-of-{multiplier} ({streetName}): {outs.length} × {multiplier} ={' '}
          <b>{ruleOfNEstimate !== null ? pct(ruleOfNEstimate) : '—'}</b>
        </span>
        <span className="outs-rule" title={DEFINITIONS.outs}>
          Hand Strength ({outs.length} Outs) • Sim confirms {pct(rawEquity)}
        </span>
      </div>

      <div className="outs-cards-row">
        {outs.map((card, i) => (
          <CardView key={i} card={card} />
        ))}
      </div>

      {/* Educational Definition Card */}
      <div className="learning-card">
        <div className="learning-card-header">
          <span>⚡ Definition: Outs & Rule of {multiplier}</span>
        </div>
        <div className="learning-card-body">
          <b>Outs</b> are unseen cards remaining in the deck that make your hand a winner.<br />
          On the <b>{streetName}</b>, multiply outs by <b>{multiplier}</b> ({outs.length} × {multiplier} = <b>{ruleOfNEstimate !== null ? pct(ruleOfNEstimate) : ''}</b>) for an instant mental estimate of your win percentage.
        </div>
      </div>
    </div>
  );
};
