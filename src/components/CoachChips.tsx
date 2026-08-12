import React, { useState } from 'react';
import type { HeroAnalysis } from '../analysis';
import { pct, money } from '../analysis';
import { CoachChip } from './CoachChip';
import { streetOf } from '../engine/types';

export interface CoachChipsProps {
  analysis: HeroAnalysis | null;
  state: {
    board: number[];
    pot: number;
  };
  coachDensity: 'full' | 'focus' | 'off';
  toCall: number;
}

type Anchor = 'CARDS' | 'POT' | 'VILLAIN' | 'STACK';

export const CoachChips: React.FC<CoachChipsProps> = ({
  analysis,
  state,
  coachDensity,
  toCall,
}) => {
  const [openPopover, setOpenPopover] = useState<Anchor | null>(null);

  if (!analysis || coachDensity === 'off') {
    return null;
  }

  const street = streetOf(state.board.length);
  const isPreflop = street === 'preflop';
  const isRiver = street === 'river';

  // Determine which anchors have live decisions this street
  const liveAnchors: Set<Anchor> = new Set();
  if (!isRiver) liveAnchors.add('CARDS'); // Outs are live on non-river streets
  if (toCall > 0) liveAnchors.add('VILLAIN'); // Defense decision when facing a bet
  if (toCall > 0) liveAnchors.add('POT'); // Call decision
  if (!isPreflop) liveAnchors.add('STACK'); // Commitment matters postflop

  // Filter chips based on coach density
  const visibleAnchors: Anchor[] = coachDensity === 'focus'
    ? Array.from(liveAnchors)
    : ['CARDS', 'POT', 'VILLAIN', 'STACK'];

  // Build chip content per spec table
  type ChipContent = {
    value: string;
    state: 'idle' | 'live' | 'good' | 'violated' | 'dimmed';
    popover: React.ReactNode;
  };

  const getChipContent = (anchor: Anchor): ChipContent => {
    switch (anchor) {
      case 'CARDS': {
        // Preflop: hand tier + top-%, Flop/Turn: outs + ×4/2 estimate, River: dimmed
        if (isRiver) {
          return {
            value: '—',
            state: 'dimmed',
            popover: <div className="coach-popover-text">No cards to come on the river.</div>,
          };
        }

        if (isPreflop) {
          const tier = analysis.preflopTier;
          if (!tier) {
            return {
              value: '?',
              state: 'idle',
              popover: <div className="coach-popover-text">Hand tier unknown.</div>,
            };
          }
          return {
            value: `${tier.label.split(' ')[0]} (${tier.topPct}%)`,
            state: liveAnchors.has('CARDS') ? 'live' : 'idle',
            popover: (
              <div className="coach-popover-content">
                <div className="coach-popover-line">
                  <b>{tier.label}</b>
                </div>
                <div className="coach-popover-line">Your hand strength preflop.</div>
                <div className="coach-popover-line coach-popover-table">
                  At the table: "{tier.label}"
                </div>
              </div>
            ),
          };
        }

        // Flop or Turn: show outs + estimate
        const multiplier = analysis.cardsToCome === 2 ? 4 : 2;
        const estimate = analysis.ruleOfNEstimate ? pct(analysis.ruleOfNEstimate) : '—';
        return {
          value: `${analysis.outs.length} outs × ${multiplier}`,
          state: liveAnchors.has('CARDS') ? 'live' : 'idle',
          popover: (
            <div className="coach-popover-content">
              <div className="coach-popover-line">
                <b>{analysis.outs.length} outs</b> need {estimate}
              </div>
              <div className="coach-popover-line">Cards to come: {analysis.cardsToCome}</div>
              <div className="coach-popover-line coach-popover-table">
                At the table: "I have {analysis.outs.length} outs"
              </div>
            </div>
          ),
        };
      }

      case 'POT': {
        // Preflop: price of call if facing raise, else dimmed
        // Flop+: toCall, ratio, break-even %
        if (isPreflop) {
          if (toCall === 0) {
            return {
              value: '—',
              state: 'dimmed',
              popover: <div className="coach-popover-text">No bet to call preflop (open decision).</div>,
            };
          }
          const odds = analysis.potOdds.required;
          return {
            value: `${pct(odds)}`,
            state: liveAnchors.has('POT') ? 'live' : 'idle',
            popover: (
              <div className="coach-popover-content">
                <div className="coach-popover-line">
                  Call {money(toCall)} to win {money(state.pot + toCall)}
                </div>
                <div className="coach-popover-line">Need {pct(odds)} to break even</div>
                <div className="coach-popover-table">
                  At the table: "They bet {money(toCall)}, I need {pct(odds)}"
                </div>
              </div>
            ),
          };
        }

        // Flop, Turn, River: toCall, ratio, break-even %
        const ratio = state.pot > 0 ? toCall / state.pot : 0;
        const odds = analysis.potOdds.required;
        return {
          value: `${money(toCall)} · ${pct(odds)}`,
          state: liveAnchors.has('POT') ? 'live' : 'idle',
          popover: (
            <div className="coach-popover-content">
              <div className="coach-popover-line">
                <b>Call: {money(toCall)}</b>
              </div>
              <div className="coach-popover-line">Pot odds: {pct(odds)}</div>
              <div className="coach-popover-line">Pot ratio: 1:{(ratio > 0 ? 1 / ratio : 0).toFixed(1)}</div>
              <div className="coach-popover-table">
                At the table: "Price is {pct(odds)}"
              </div>
            </div>
          ),
        };
      }

      case 'VILLAIN': {
        // Preflop: dimmed
        // Flop/Turn: MDF if facing bet; bluff price if checked to
        // River: MDF — the pure bluff-catcher spot
        if (isPreflop) {
          return {
            value: '—',
            state: 'dimmed',
            popover: <div className="coach-popover-text">Defense decisions are postflop.</div>,
          };
        }

        if (isRiver) {
          // River: pure bluff-catcher MDF
          return {
            value: `${pct(analysis.mdfFacing)}`,
            state: liveAnchors.has('VILLAIN') ? 'live' : 'idle',
            popover: (
              <div className="coach-popover-content">
                <div className="coach-popover-line">
                  <b>Defend {pct(analysis.mdfFacing)}</b> of the time
                </div>
                <div className="coach-popover-line">Pure bluff-catcher spot on river</div>
                <div className="coach-popover-table">
                  At the table: "Defend {pct(analysis.mdfFacing)} here"
                </div>
              </div>
            ),
          };
        }

        // Flop/Turn: MDF if facing a bet; bluff price if checked to
        if (toCall > 0) {
          // Facing a bet: show MDF
          return {
            value: `${pct(analysis.mdfFacing)}`,
            state: 'live',
            popover: (
              <div className="coach-popover-content">
                <div className="coach-popover-line">
                  <b>Defend {pct(analysis.mdfFacing)}</b> if they bet
                </div>
                <div className="coach-popover-line">
                  Minimum frequency to make them indifferent to bluffing
                </div>
                <div className="coach-popover-table">
                  At the table: "Defend {pct(analysis.mdfFacing)}"
                </div>
              </div>
            ),
          };
        }

        // Checked to: show bluff price
        return {
          value: `${pct(analysis.bluffPriceAtPot)}`,
          state: 'idle',
          popover: (
            <div className="coach-popover-content">
              <div className="coach-popover-line">
                <b>Need {pct(analysis.bluffPriceAtPot)} folds</b> to bluff 3/4 pot
              </div>
              <div className="coach-popover-line">Opponent must fold to break even</div>
              <div className="coach-popover-table">
                At the table: "If I bet, I need {pct(analysis.bluffPriceAtPot)} folds"
              </div>
            </div>
          ),
        };
      }

      case 'STACK': {
        // Preflop: SPR after call, dimmed
        // Flop+: SPR + commitment tier
        const spr = analysis.spr;
        const commitment = analysis.commitment;

        if (isPreflop) {
          // After call SPR
          const callAmount = toCall > 0 ? toCall : 0;
          const potAfterCall = state.pot + callAmount + callAmount; // both players call
          const sprAfterCall = (analysis.spr * state.pot - callAmount) / potAfterCall;
          return {
            value: `${sprAfterCall.toFixed(1)}:1`,
            state: 'idle',
            popover: (
              <div className="coach-popover-content">
                <div className="coach-popover-line">
                  <b>SPR after call: {sprAfterCall.toFixed(2)}</b>
                </div>
                <div className="coach-popover-line">Stack depth postflop</div>
                <div className="coach-popover-table">
                  At the table: "If called, stack-to-pot is {sprAfterCall.toFixed(1)}"
                </div>
              </div>
            ),
          };
        }

        // Postflop: show tier and SPR
        const tierState =
          commitment.tier === 'committed' || commitment.tier === 'shallow' ? 'live' : 'idle';
        return {
          value: `${spr.toFixed(1)}:1`,
          state: tierState,
          popover: (
            <div className="coach-popover-content">
              <div className="coach-popover-line">
                <b>{commitment.label}</b>
              </div>
              <div className="coach-popover-line">SPR: {spr.toFixed(2)}</div>
              <div className="coach-popover-line">{commitment.note}</div>
              <div className="coach-popover-table">
                At the table: "{commitment.label}"
              </div>
            </div>
          ),
        };
      }
    }
  };

  const chipPositions: Record<Anchor, string> = {
    CARDS: 'coach-chip-cards',     // bottom-left
    POT: 'coach-chip-pot',         // bottom-centre
    VILLAIN: 'coach-chip-villain', // right mid
    STACK: 'coach-chip-stack',     // bottom-right
  };

  const chipHues: Record<Anchor, string> = {
    CARDS: 'var(--sky)',
    POT: 'var(--amber)',
    VILLAIN: 'var(--coral)',
    STACK: 'var(--emerald)',
  };

  return (
    <div className="coach-chips-container">
      {visibleAnchors.map((anchor) => {
        const content = getChipContent(anchor);
        return (
          <div key={anchor} className={`coach-chip-slot ${chipPositions[anchor]}`}>
            <CoachChip
              anchor={anchor}
              value={content.value}
              hue={chipHues[anchor]}
              state={content.state}
              onOpenPopover={() => setOpenPopover(openPopover === anchor ? null : anchor)}
              popoverContent={content.popover}
              isPopoverOpen={openPopover === anchor}
              onPopoverClose={() => setOpenPopover(null)}
            />
          </div>
        );
      })}
    </div>
  );
};
