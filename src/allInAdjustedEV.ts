import { Combo } from './engine/ranges';
import { fullDeck } from './engine/cards';
import { evaluate } from './engine/evaluator';
import { makeRng, shuffled } from './engine/rng';

/**
 * Runouts sampled when the board is too incomplete to enumerate. A preflop
 * all-in leaves C(45,5) ≈ 1.2M runouts, too slow to run between hands; 20k
 * samples hold the equity estimate to a few tenths of a percent, far finer
 * than the chip amounts it gets multiplied by.
 */
const SAMPLED_RUNOUTS = 20000;

/**
 * Computes the all-in adjusted EV result for a hand where the hero went all-in
 * with cards still to come.
 *
 * When the hero and at least one live opponent are all-in with cards remaining,
 * the hero's result is booked as their equity share of the final pot, not the
 * actual runout result. This removes luck from coolers.
 *
 * Uses exact enumeration of remaining board cards (when feasible) to compute
 * true multiway equity: the hero's share across all possible runouts.
 *
 * @param heroHole - Hero's hole cards (two-card combo)
 * @param villainHoles - Actual hole cards of all live opponents at all-in point
 * @param board - Community cards at the time of all-in
 * @param heroContribution - Total chips the hero put into the pot
 * @param finalPot - Size of the pot when the hand ended
 * @returns The adjusted result (chip gain/loss after all-in adjustment), or null if not computable
 *
 * Positive means hero gained chips; negative means hero lost chips.
 * Formula: adjustedResult = (heroEquity * finalPot) - heroContribution
 */
export function computeAllInAdjustedResult(
  heroHole: Combo,
  villainHoles: Combo[],
  board: number[],
  heroContribution: number,
  finalPot: number,
): number | null {
  if (villainHoles.length === 0) {
    // No opponents (uncontested pot), hero wins all-in
    return finalPot - heroContribution;
  }

  const toCome = 5 - board.length;
  if (toCome <= 0) {
    // Board is complete, use current result as equity
    return null;
  }

  // Use exact enumeration for <= 2 cards to come (fast enough)
  const allCards = new Set<number>([...heroHole, ...board, ...villainHoles.flat()]);
  const deck = fullDeck().filter((c: number) => !allCards.has(c));

  let heroWinShare = 0;
  let runoutCount = 0;

  /**
   * The hero's share of one finished board: 1 when they beat every opponent,
   * 1/n when n players tie for best, 0 when anyone is ahead.
   */
  const shareOf = (finalBoard: number[]): number => {
    const heroScore = evaluate([...heroHole, ...finalBoard]);
    let tiedCount = 1;
    for (const villainHole of villainHoles) {
      const villainScore = evaluate([...villainHole, ...finalBoard]);
      if (villainScore > heroScore) return 0;
      if (villainScore === heroScore) tiedCount++;
    }
    return 1 / tiedCount;
  };

  // Generate all possible runouts exactly
  if (toCome === 1) {
    // 1 card to come: enumerate all remaining cards
    for (const card of deck) {
      heroWinShare += shareOf([...board, card]);
      runoutCount++;
    }
  } else if (toCome === 2) {
    // 2 cards to come: enumerate all combinations
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        heroWinShare += shareOf([...board, deck[i], deck[j]]);
        runoutCount++;
      }
    }
  } else {
    // 3+ cards to come (a preflop all-in, the most common cooler of all).
    // Exhaustive enumeration is far too slow here, so sample runouts instead.
    // The seed is derived from the cards themselves, so the same spot always
    // yields the same number — replaying a hand never shifts its adjustment.
    const seed = [...heroHole, ...board, ...villainHoles.flat()].reduce(
      (acc, c) => (acc * 31 + c) >>> 0,
      villainHoles.length + 17,
    );
    const rng = makeRng(seed);
    for (let s = 0; s < SAMPLED_RUNOUTS; s++) {
      const drawn = shuffled(deck, rng).slice(0, toCome);
      heroWinShare += shareOf([...board, ...drawn]);
      runoutCount++;
    }
  }

  const heroEquity = runoutCount > 0 ? heroWinShare / runoutCount : 0;
  const heroEquityShare = heroEquity * finalPot;
  return heroEquityShare - heroContribution;
}
