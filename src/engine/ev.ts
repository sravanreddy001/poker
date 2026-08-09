import { botAct, DEFAULT_BOT } from './bot';
import { realizedEquity, RealizationInput } from './realization';
import { removeDead } from './ranges';
import type { Rng } from './rng';
import { streetOf } from './types';

export interface SizeOption {
  label: string;
  /** Fraction of the pot. `Infinity` means all-in. */
  fraction: number;
}

export const SIZES: SizeOption[] = [
  { label: 'check', fraction: 0 },
  { label: '1/3 pot', fraction: 1 / 3 },
  { label: '1/2 pot', fraction: 0.5 },
  { label: '3/4 pot', fraction: 0.75 },
  { label: 'pot', fraction: 1 },
  { label: '2x pot', fraction: 2 },
  { label: 'all-in', fraction: Infinity },
];

export interface EvOption {
  label: string;
  amount: number;
  ev: number;
}

/**
 * Break-even equity for a call, the hero's actual (realized) equity, and the
 * resulting EV. `required` is the share of the final pot the call costs.
 */
export function potOddsVerdict(toCall: number, pot: number, realized: number) {
  const required = toCall === 0 ? 0 : toCall / (pot + toCall);
  const evOfCall = realized * (pot + toCall) - toCall;
  return { required, actual: realized, evOfCall };
}

export function evaluateSizes(
  input: RealizationInput & { toCall: number },
  rng: Rng,
): EvOption[] {
  const { realized } = realizedEquity(input, rng, 150);
  const live = removeDead(input.villainRange, [...input.hole, ...input.board]);
  const street = streetOf(input.board.length);

  const options: EvOption[] = SIZES.map((size) => {
    const amount =
      size.fraction === 0
        ? 0
        : size.fraction === Infinity
          ? input.stack
          : Math.min(input.stack, Math.round(input.pot * size.fraction));

    if (amount === 0) {
      // Checking keeps our share of the current pot; folding to a live bet forfeits it.
      return { label: size.label, amount: 0, ev: input.toCall > 0 ? 0 : realized * input.pot };
    }

    let ev = 0;
    const n = live.combos.length || 1;

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
          villainRange: { combos: [input.hole] },
        },
        DEFAULT_BOT,
        rng,
      );

      if (response.type === 'fold') {
        ev += input.pot;
      } else if (response.type === 'raise') {
        // Cap the tree at one re-raise: treat our continuation as a call.
        const raiseTo = Math.min(response.amount, input.stack);
        ev += realized * (input.pot + 2 * raiseTo) - raiseTo;
      } else {
        ev += realized * (input.pot + 2 * amount) - amount;
      }
    }

    return { label: size.label, amount, ev: ev / n };
  });

  return options.sort((a, b) => b.ev - a.ev);
}
