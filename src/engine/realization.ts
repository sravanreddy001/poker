import { Card, fullDeck } from './cards';
import { evaluate } from './evaluator';
import { equityVsRange } from './equity';
import { botAct, DEFAULT_BOT } from './bot';
import { Combo, Range, removeDead } from './ranges';
import { Rng, shuffled } from './rng';
import { streetOf } from './types';

export interface RealizationInput {
  hole: Combo;
  board: Card[];
  pot: number;
  stack: number;
  bigBlind: number;
  inPosition: boolean;
  villainRange: Range;
}

export interface RealizationResult {
  /** Share of the pot won at showdown if all cards are dealt and nobody folds. */
  raw: number;
  /** Share actually collected once folding and further betting are accounted for. */
  realized: number;
  /** realized / raw. */
  factor: number;
}

/**
 * Fixed default continuation policy for the hero. Deliberately simple and
 * independent of the advisor — the advisor consumes realized equity, so using
 * the advisor here would be circular.
 */
function heroContinues(equity: number, toCall: number, pot: number): boolean {
  if (toCall === 0) return true;
  return equity > toCall / (pot + toCall);
}

export function realizedEquity(
  input: RealizationInput,
  rng: Rng,
  samples = 400,
): RealizationResult {
  const raw = equityVsRange(input.hole, input.board, input.villainRange, rng, 2000).equity;

  const live = removeDead(input.villainRange, [...input.hole, ...input.board]);
  if (live.combos.length === 0 || raw === 0) {
    return { raw, realized: raw, factor: 1 };
  }


  let collected = 0;

  for (let i = 0; i < samples; i++) {
    const villain = live.combos[rng.nextInt(live.combos.length)];
    const blocked = new Set<Card>([...input.hole, ...input.board, ...villain]);
    const deck = shuffled(
      fullDeck().filter((c) => !blocked.has(c)),
      rng,
    );

    let board = [...input.board];
    let pot = input.pot;
    let invested = 0;
    let folded = false;
    let drawn = 0;

    while (board.length < 5) {
      const street = streetOf(board.length);

      // No preflop betting round inside the simulation. The hero is already
      // being priced on the preflop bet they actually face in the real hand;
      // opening a second one here made them fold out of nearly every sample and
      // produced realization factors around 20% for perfectly playable hands.
      // Realization measures how much preflop equity survives *postflop* play.
      if (board.length < 3) {
        board = [...board, deck[drawn++], deck[drawn++], deck[drawn++]];
        continue;
      }

      const equity = equityVsRange(input.hole, board, { combos: [villain] }, rng, 120).equity;

      const villainAction = botAct(
        {
          hole: villain,
          board,
          pot,
          toCall: 0,
          stack: input.stack,
          bigBlind: input.bigBlind,
          street,
          inPosition: !input.inPosition,
          villainRange: { combos: [input.hole] },
        },
        DEFAULT_BOT,
        rng,
      );

      if (villainAction.type === 'bet') {
        const toCall = Math.min(villainAction.amount, input.stack - invested);
        if (!heroContinues(equity, toCall, pot)) {
          folded = true;
          break;
        }
        pot += toCall * 2;
        invested += toCall;
      }

      board = [...board, deck[drawn++]];
    }

    if (folded) continue; // Hero surrenders and collects nothing further.

    const hero = evaluate([...input.hole, ...board]);
    const vill = evaluate([...villain, ...board]);
    const share = hero > vill ? 1 : hero === vill ? 0.5 : 0;
    // Net winnings, expressed as a fraction of the pot the hero started with.
    collected += (share * pot - invested) / pot;
  }

  const realized = Math.max(0, Math.min(raw, collected / samples));
  return { raw, realized, factor: realized / raw };
}
