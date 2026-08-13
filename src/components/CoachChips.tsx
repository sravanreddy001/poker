import React, { useEffect, useRef, useState } from 'react';
import type { HeroAnalysis } from '../analysis';
import { pct, money, cardLabel } from '../analysis';
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
  const popoverRef = useRef<HTMLDivElement>(null);

  // Dismissal lives here rather than in the chip, since the panel is no longer a
  // child of the chip that opened it.
  useEffect(() => {
    if (!openPopover) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (popoverRef.current?.contains(target)) return;
      // A click on any chip is that chip's own toggle; let it through.
      if (target.closest?.('.coach-chip')) return;
      setOpenPopover(null);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPopover(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openPopover]);

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
          const shape = analysis.shape;
          return {
            value: tier.label.split(' ')[0],
            state: liveAnchors.has('CARDS') ? 'live' : 'idle',
            popover: (
              <div className="coach-popover-content">
                <div className="coach-popover-line">
                  <b>
                    {shape.name} — {tier.label}
                  </b>
                </div>
                <div className="coach-popover-line">
                  {tier.tier === 'trash'
                    ? `Ranked ${shape.rank} of ${shape.of} starting hands — below the top 35%, which is the widest range worth opening.`
                    : `Ranked ${shape.rank} of ${shape.of} starting hands — inside the top ${tier.topPct}%.`}
                </div>
                <ul className="coach-popover-reasons">
                  {shape.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>

                {/* The chart neighbours, seen every single hand: this is how the
                    169-hand order gets learned without sitting down to memorise it. */}
                <div className="coach-ladder" aria-label="Neighbouring hands in the chart">
                  <span className="coach-ladder-caption">Stronger</span>
                  {shape.better.map((h) => (
                    <span key={h} className="coach-ladder-hand">
                      {h}
                    </span>
                  ))}
                  <span className="coach-ladder-hand coach-ladder-you">{shape.name}</span>
                  {shape.worse.map((h) => (
                    <span key={h} className="coach-ladder-hand">
                      {h}
                    </span>
                  ))}
                  <span className="coach-ladder-caption">Weaker</span>
                </div>
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
          value: `${analysis.outs.length} outs`,
          state: liveAnchors.has('CARDS') ? 'live' : 'idle',
          popover: (
            <div className="coach-popover-content">
              <div className="coach-popover-line">
                <b>
                  {analysis.outs.length} outs × {multiplier} = {estimate}
                </b>
              </div>
              <div className="coach-popover-line">
                {analysis.cardsToCome} card{analysis.cardsToCome === 1 ? '' : 's'} to come, so each
                out is worth about {multiplier}%.
              </div>
              {/* Name the cards. "9 outs" is a number to trust; the nine cards
                  are a pattern that shows up again on the next flush draw. */}
              {analysis.outs.length > 0 && (
                <div className="coach-ladder" aria-label="The cards that win it">
                  {analysis.outs.map((c) => {
                    const l = cardLabel(c);
                    return (
                      <span
                        key={c}
                        className={`coach-ladder-hand ${l.red ? 'coach-out-red' : 'coach-out-black'}`}
                      >
                        {l.rank}
                        {l.suit}
                      </span>
                    );
                  })}
                </div>
              )}
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
        // The bet is already in state.pot, so measure it against what it was
        // bet into — otherwise a pot-sized bet reads as half pot.
        const potBeforeBet = Math.max(0, state.pot - toCall);
        const ratio = potBeforeBet > 0 ? toCall / potBeforeBet : 0;
        const odds = analysis.potOdds.required;
        return {
          value: pct(odds),
          state: liveAnchors.has('POT') ? 'live' : 'idle',
          popover: (
            <div className="coach-popover-content">
              <div className="coach-popover-line">
                <b>Call: {money(toCall)}</b>
              </div>
              <div className="coach-popover-line">
                {money(toCall)} ÷ ({money(state.pot)} pot + {money(toCall)}) = {pct(odds)} — the
                share of the final pot your call buys.
              </div>
              <div className="coach-popover-line">
                You have to win this about 1 hand in{' '}
                {odds > 0 ? Math.round(1 / odds) : '—'} to break even. They are betting{' '}
                {ratio > 0 ? `${Math.round(ratio * 100)}%` : '—'} of the pot.
              </div>
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
                  Pot ÷ (pot + bet) = {pct(analysis.mdfFacing)}. Fold more often than{' '}
                  {pct(1 - analysis.mdfFacing)} and their bluff prints money with any two cards.
                </div>
                <div className="coach-popover-line">
                  It applies to your whole range, not this hand: keep roughly{' '}
                  {pct(analysis.mdfFacing)} of the hands you would have here, strongest first.
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
                <div className="coach-popover-line">
                  SPR is stack ÷ pot — how many more pot-sized bets you still have behind. Low
                  means one big bet gets it all in; high means there is room to be pushed off a
                  hand.
                </div>
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
              <div className="coach-popover-line">
                Stack {money(analysis.spr * state.pot)} ÷ pot {money(state.pot)} ={' '}
                {spr.toFixed(2)} — how many more pot-sized bets you have behind.
              </div>
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

  /* A bare number tells the player nothing about which number it is: "29%" and
     "71%" were only distinguishable by hue. Each chip carries its own word. */
  const labelOf = (anchor: Anchor): string => {
    switch (anchor) {
      case 'CARDS':
        return isPreflop ? 'Hand' : 'Outs';
      case 'POT':
        return 'Price';
      case 'VILLAIN':
        return !isPreflop && !isRiver && toCall === 0 ? 'Folds needed' : 'Defend';
      case 'STACK':
        return 'SPR';
    }
  };

  const chipHues: Record<Anchor, string> = {
    CARDS: 'var(--sky)',
    POT: 'var(--amber)',
    VILLAIN: 'var(--coral)',
    STACK: 'var(--emerald)',
  };

  return (
    <div className="coach-chips-container">
      <div className="coach-chip-row">
        {visibleAnchors.map((anchor) => {
          const content = getChipContent(anchor);
          return (
            <button
              key={anchor}
              type="button"
              className={`coach-chip coach-chip-${content.state}`}
              style={{ ['--chip-hue' as string]: chipHues[anchor] }}
              aria-expanded={openPopover === anchor}
              aria-label={`${labelOf(anchor)}: ${content.value}. Tap for the working.`}
              onClick={() => setOpenPopover(openPopover === anchor ? null : anchor)}
            >
              <span className="coach-chip-label">{labelOf(anchor)}</span>
              <span className="coach-chip-value">{content.value}</span>
            </button>
          );
        })}
      </div>

      {openPopover && (
        <div
          ref={popoverRef}
          className="coach-chip-popover coach-chip-popover-docked"
          role="dialog"
          aria-label={`${openPopover} details`}
        >
          <div className="coach-popover-head">
            <span className="coach-popover-anchor" style={{ background: chipHues[openPopover] }} />
            {labelOf(openPopover)}
            <button
              type="button"
              className="coach-popover-close"
              onClick={() => setOpenPopover(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {getChipContent(openPopover).popover}
        </div>
      )}
    </div>
  );
};
