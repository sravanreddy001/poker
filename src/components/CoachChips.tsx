import React, { useEffect, useRef, useState } from 'react';
import type { HeroAnalysis } from '../analysis';
import { pct, money, cardLabel } from '../analysis';
import { streetOf } from '../engine/types';
import { commitmentTier } from '../engine/ev';

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
                {/* Trash + "best line: call" reads as a contradiction until you
                    see that the two chips answer different questions. */}
                <div className="coach-popover-line">
                  This tier answers <b>would I open this?</b> — not <b>can I call?</b> A hand down
                  here is still a call when the price is low enough; check the Price chip before
                  folding it.
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
        // Nothing to price until someone bets; every street works the same way
        // after that, so preflop shares the arithmetic below.
        if (toCall === 0) {
          return {
            value: '—',
            state: 'dimmed',
            popover: (
              <div className="coach-popover-text">
                No bet to call — there is no price on the pot until someone makes one.
              </div>
            ),
          };
        }

        // The bet is already in state.pot, so measure it against what it was
        // bet into — otherwise a pot-sized bet reads as half pot.
        const potBeforeBet = Math.max(0, state.pot - toCall);
        const ratio = potBeforeBet > 0 ? toCall / potBeforeBet : 0;
        const odds = analysis.potOdds.required;
        const finalPot = state.pot + toCall;
        // Pot odds as a ratio, the form it is usually said out loud in.
        const against = odds > 0 ? (1 - odds) / odds : 0;

        return {
          value: pct(odds),
          state: liveAnchors.has('POT') ? 'live' : 'idle',
          popover: (
            <div className="coach-popover-content">
              {/* Four lines of arithmetic, every step shown. The sum is simple
                  on purpose: the point is to run it the same way each time
                  until it stops needing to be run on screen at all. */}
              <div className="coach-math">
                <span className="coach-math-step">They bet</span>
                <span className="coach-math-work">
                  {money(toCall)} into {money(potBeforeBet)}
                </span>
                <span className="coach-math-out">
                  {ratio > 0 ? `${Math.round(ratio * 100)}% pot` : '—'}
                </span>

                <span className="coach-math-step">Pot if you call</span>
                <span className="coach-math-work">
                  {money(state.pot)} + {money(toCall)}
                </span>
                <span className="coach-math-out">{money(finalPot)}</span>

                <span className="coach-math-step">Your share of it</span>
                <span className="coach-math-work">
                  {money(toCall)} ÷ {money(finalPot)}
                </span>
                <span className="coach-math-out coach-math-answer">{pct(odds)}</span>

                <span className="coach-math-step">Said out loud</span>
                <span className="coach-math-work">{against.toFixed(1)} to 1</span>
                <span className="coach-math-out">
                  win 1 in {odds > 0 ? Math.round(1 / odds) : '—'}
                </span>
              </div>
              <div className="coach-popover-line">
                That {pct(odds)} is the minimum you must win to break even — beat it and calling
                makes money, miss it and it loses.
              </div>
              <div className="coach-popover-table">At the table: "Price is {pct(odds)}"</div>
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

        // Checked to: the price of a bluff, from the bettor's side.
        const bluffBet = state.pot * 0.75;
        const folds = analysis.bluffPriceAtPot;
        return {
          value: `${pct(folds)}`,
          state: 'idle',
          popover: (
            <div className="coach-popover-content">
              <div className="coach-math">
                <span className="coach-math-step">If you bet</span>
                <span className="coach-math-work">
                  {money(bluffBet)} into {money(state.pot)}
                </span>
                <span className="coach-math-out">3/4 pot</span>

                <span className="coach-math-step">You risk</span>
                <span className="coach-math-work">
                  {money(bluffBet)} to win {money(state.pot)}
                </span>
                <span className="coach-math-out">right now</span>

                <span className="coach-math-step">Break-even folds</span>
                <span className="coach-math-work">
                  {money(bluffBet)} ÷ {money(state.pot + bluffBet)}
                </span>
                <span className="coach-math-out coach-math-answer">{pct(folds)}</span>
              </div>

              <div className="coach-popover-line">
                <b>How to get it at the table:</b> bet ÷ (pot + bet) — the same division as pot
                odds, done from the bettor's chair. Half pot needs 33%, three-quarters 43%, pot
                50%. Three numbers worth knowing cold.
              </div>

              {/* The three standard sizes, seen every hand they apply. */}
              <div className="coach-ladder" aria-label="Break-even folds by bet size">
                <span className="coach-ladder-hand">1/2 pot = 33%</span>
                <span className="coach-ladder-hand coach-ladder-you">3/4 pot = 43%</span>
                <span className="coach-ladder-hand">pot = 50%</span>
              </div>

              <div className="coach-popover-line">
                <b>What it means:</b> fold them out more often than {pct(folds)} and the bet profits
                holding any two cards. Below that it needs real equity to be worth making — which
                is why a bluff with outs is worth more than a bluff without.
              </div>

              <div className="coach-popover-table">
                At the table: "If I bet, I need {pct(folds)} folds"
              </div>
            </div>
          ),
        };
      }

      case 'STACK': {
        const stack = analysis.spr * state.pot;

        // Preflop the pot is about to change, so the number worth knowing is
        // the one you will be playing the flop with, not the one on screen now.
        const callAmount = toCall > 0 ? toCall : 0;
        const potAfterCall = state.pot + callAmount * 2;
        const spr = isPreflop
          ? potAfterCall > 0
            ? (stack - callAmount) / potAfterCall
            : 0
          : analysis.spr;

        // Read the tier off the SPR actually shown, so the band, the note and
        // the number can never describe different stack depths.
        const commitment = commitmentTier(spr);
        const tierState =
          !isPreflop && (commitment.tier === 'committed' || commitment.tier === 'shallow')
            ? 'live'
            : 'idle';

        return {
          // One number: SPR is already a ratio to one, so ":1" only adds noise.
          value: spr.toFixed(1),
          state: tierState,
          popover: (
            <div className="coach-popover-content">
              <div className="coach-math">
                <span className="coach-math-step">Your stack</span>
                <span className="coach-math-work">{money(stack - callAmount)}</span>
                <span className="coach-math-out">behind</span>

                <span className="coach-math-step">{isPreflop ? 'Pot if called' : 'Pot now'}</span>
                <span className="coach-math-work">
                  {money(isPreflop ? potAfterCall : state.pot)}
                </span>
                <span className="coach-math-out">in the middle</span>

                <span className="coach-math-step">Stack ÷ pot</span>
                <span className="coach-math-work">
                  {money(stack - callAmount)} ÷ {money(isPreflop ? potAfterCall : state.pot)}
                </span>
                <span className="coach-math-out coach-math-answer">{spr.toFixed(1)}</span>
              </div>

              <div className="coach-popover-line">
                <b>Why it matters:</b> it decides how much hand you need. At a low SPR the money
                goes in on one pair and there is nothing to fold to. At a high SPR one pair is a
                small hand — the deep stack behind can bet you off it on every street.
              </div>

              {/* The same four rungs every hand, so the number stops needing a
                  lookup and starts reading as a plan. */}
              <div className="coach-ladder" aria-label="Stack-to-pot ratio bands">
                {[
                  { max: 1, label: '<1 all-in' },
                  { max: 3, label: '1–3 shallow' },
                  { max: 6, label: '3–6 medium' },
                  { max: Infinity, label: '6+ deep' },
                ].map((band, i, bands) => {
                  const lower = i === 0 ? 0 : bands[i - 1].max;
                  const here = spr >= lower && spr < band.max;
                  return (
                    <span
                      key={band.label}
                      className={`coach-ladder-hand ${here ? 'coach-ladder-you' : ''}`}
                    >
                      {band.label}
                    </span>
                  );
                })}
              </div>

              <div className="coach-popover-line">
                <b>How to read it:</b> {commitment.note}
              </div>

              <div className="coach-popover-table">
                At the table: "{isPreflop ? `If called, SPR is ${spr.toFixed(1)}` : commitment.label}"
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
