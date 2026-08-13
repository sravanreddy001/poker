import { botAct, DEFAULT_BOT } from './bot';
import { tableEquity } from './equity';
import type { Card } from './cards';
import { Combo, Range, rangeTopPercent, removeDead } from './ranges';
import type { Rng } from './rng';
import { streetOf } from './types';

/** The spot the advisor prices: the hero's cards, the board and the money. */
export interface SpotInput {
  hole: Combo;
  board: Card[];
  pot: number;
  stack: number;
  bigBlind: number;
  inPosition: boolean;
  villainRange: Range;
}

/**
 * The range a simulated opponent puts the hero on. It has to be a range: give
 * the bot the hero's exact two cards and it folds every hand that loses to
 * them, which makes value betting look worthless. Matches the band the real
 * bots use in `game.ts`.
 */
export const PERCEIVED_HERO_RANGE_PCT = 0.3;

export interface SizeOption {
  label: string;
  /** Fraction of the pot. `Infinity` means all-in. */
  fraction: number;
}

/**
 * Commitment tier from stack-to-pot ratio.
 * SPR < 1: committed, < 3: shallow, < 6: medium, else deep.
 */
export function commitmentTier(spr: number): {
  tier: 'committed' | 'shallow' | 'medium' | 'deep';
  label: string;
  note: string;
} {
  if (spr < 1) {
    return {
      tier: 'committed',
      label: 'All-In Territory',
      note: 'Stack is pot-committed; expect all chips in the middle.',
    };
  }
  if (spr < 3) {
    return {
      tier: 'shallow',
      label: 'Shallow Stack',
      note: 'Limited room for further betting; decisions are simplified.',
    };
  }
  if (spr < 6) {
    return {
      tier: 'medium',
      label: 'Medium Stack',
      note: 'Moderate play; position and playable hands matter most.',
    };
  }
  return {
    tier: 'deep',
    label: 'Deep Stack',
    note: 'Plenty of room to maneuver; complex post-flop play likely.',
  };
}

/**
 * The sizes the advisor is allowed to name, kept in step with the buttons in
 * ActionBar: recommending a line the player has no button for teaches a move
 * they cannot make. 1/3 pot went with the preset row it belonged to.
 */
export const SIZES: SizeOption[] = [
  { label: 'check', fraction: 0 },
  { label: '1/2 pot', fraction: 0.5 },
  { label: '3/4 pot', fraction: 0.75 },
  { label: 'pot', fraction: 1 },
  { label: 'all-in', fraction: Infinity },
];

export interface EvOption {
  label: string;
  amount: number;
  ev: number;
}

/**
 * Break-even equity for a call, the hero's win odds, and the resulting EV.
 * `required` is the share of the final pot the call costs.
 */
export function potOddsVerdict(toCall: number, pot: number, winOdds: number) {
  const required = toCall === 0 ? 0 : toCall / (pot + toCall);
  const evOfCall = winOdds * (pot + toCall) - toCall;
  return { required, actual: winOdds, evOfCall };
}

/**
 * Share of folds a bluff must win to break even: bet / (pot + bet).
 * Returns 0 when bet <= 0.
 */
export function bluffPrice(bet: number, pot: number): number {
  if (bet <= 0) return 0;
  return bet / (pot + bet);
}

/**
 * Minimum defense frequency vs a bet: pot / (pot + bet).
 * Returns 0 when bet <= 0.
 */
export function minDefenseFrequency(bet: number, pot: number): number {
  if (bet <= 0) return 0;
  return pot / (pot + bet);
}

export function evaluateSizes(input: SpotInput & { toCall: number }, rng: Rng): EvOption[] {
  const winOdds = tableEquity(input.hole, input.board, input.villainRange).equity;
  const live = removeDead(input.villainRange, [...input.hole, ...input.board]);
  const street = streetOf(input.board.length);

  // What the opponent can see: a range, not our two cards. Handing the bot our
  // exact hand made it fold everything that loses to us, so value betting looked
  // worthless and checking down a monster looked correct.
  const perceived = removeDead(rangeTopPercent(PERCEIVED_HERO_RANGE_PCT), [
    ...input.hole,
    ...input.board,
  ]);

  // A bet must be at least one big blind; a raise must at least double the
  // amount owed. Without this floor, small pots produce "raises" equal to the
  // current bet, which are not raises at all.
  const minTarget = input.toCall > 0 ? input.toCall * 2 : input.bigBlind;

  const options: EvOption[] = SIZES.map((size) => {
    let amount = 0;
    if (size.fraction === 0) {
      amount = 0;
    } else if (size.fraction === Infinity) {
      // Preflop deep stacks: cap over-shoving to 4x pot / 3-bet size so candidates remain realistic
      if (street === 'preflop' && input.toCall <= 3 * input.bigBlind && input.stack > 25 * input.bigBlind) {
        amount = Math.min(input.stack, Math.max(minTarget, Math.round(input.pot * 3)));
      } else {
        amount = input.stack;
      }
    } else {
      amount = Math.min(input.stack, Math.max(minTarget, Math.round(input.pot * size.fraction)));
    }

    if (amount === 0) {
      // Checking keeps our share of the current pot; folding to a live bet
      // forfeits it. Facing a bet there is no check to offer, so name it a fold.
      return input.toCall > 0
        ? { label: 'fold', amount: 0, ev: 0 }
        : { label: size.label, amount: 0, ev: winOdds * input.pot };
    }

    // Partition the range by how it answers this size. Equity against the hands
    // that continue is not equity against the whole range — the bigger the bet,
    // the stronger the hands that call it. Pricing a bet against the unnarrowed
    // range is what makes a 99bb shove into a 4bb pot look profitable.
    let folds = 0;
    const callers: Combo[] = [];
    const raisers: Combo[] = [];
    let raiseTotal = 0;

    for (const villain of live.combos) {
      const response = botAct(
        {
          hole: villain,
          board: input.board,
          pot: input.pot + amount,
          toCall: amount,
          stack: input.stack,
          bigBlind: input.bigBlind,
          street,
          inPosition: !input.inPosition,
          villainRange: perceived,
        },
        DEFAULT_BOT,
        rng,
      );

      if (response.type === 'fold') {
        folds++;
      } else if (response.type === 'raise') {
        raisers.push(villain);
        raiseTotal += Math.min(response.amount, input.stack);
      } else {
        callers.push(villain);
      }
    }

    const n = live.combos.length || 1;
    const equityAgainst = (combos: Combo[]) =>
      tableEquity(input.hole, input.board, { combos }).equity;

    // Fold equity: we take the pot as it stands, risking nothing.
    let ev = folds * input.pot;

    if (callers.length > 0) {
      const eq = equityAgainst(callers);
      ev += callers.length * (eq * (input.pot + 2 * amount) - amount);
    }

    if (raisers.length > 0) {
      // Cap the tree at one re-raise: treat our continuation as a call.
      const eq = equityAgainst(raisers);
      const raiseTo = raiseTotal / raisers.length;
      ev += raisers.length * (eq * (input.pot + 2 * raiseTo) - raiseTo);
    }

    return { label: size.label, amount, ev: ev / n };
  });

  return options.sort((a, b) => b.ev - a.ev);
}
