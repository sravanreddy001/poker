import { describe, it, expect } from 'vitest';
import { computeAllInAdjustedResult } from './allInAdjustedEV';
import { parseCard } from './engine/cards';

describe('computeAllInAdjustedResult', () => {
  it('returns correct value with no opponents (uncontested)', () => {
    // Hero wins uncontested all-in
    const heroHole = [parseCard('Ks'), parseCard('Kh')] as [number, number];
    const board: number[] = [];
    const heroContribution = 50;
    const finalPot = 100;

    const adjusted = computeAllInAdjustedResult(
      heroHole,
      [], // No opponents
      board,
      heroContribution,
      finalPot,
    );

    // Hero should win the full pot
    expect(adjusted).toBe(50);
  });

  it('handles turn all-in with one card to come', () => {
    // Hero: 99, Villain: AA, Board: A K 5 6 (hero is very weak with 1 card to come)
    const heroHole = [parseCard('9s'), parseCard('9h')] as [number, number];
    const villainHole = [parseCard('As'), parseCard('Ad')] as [number, number];
    const board = [parseCard('Ah'), parseCard('Kd'), parseCard('5c'), parseCard('6c')];
    const heroContribution = 50;
    const finalPot = 100;

    const adjusted = computeAllInAdjustedResult(
      heroHole,
      [villainHole],
      board,
      heroContribution,
      finalPot,
    );

    // Hero is weak, should get negative adjusted result
    expect(typeof adjusted).toBe('number');
    expect(adjusted).toBeLessThan(0);
  });

  it('adjusts a preflop all-in, the most common cooler', () => {
    // AQs is roughly a 34% underdog to KK. Committing 50 into a 100 pot at 34%
    // is worth about 34 - 50 = -16, so the adjustment must be clearly negative
    // even though a preflop shove leaves five cards to come.
    const heroHole = [parseCard('As'), parseCard('Qs')] as [number, number];
    const villainHole = [parseCard('Ks'), parseCard('Kh')] as [number, number];

    const adjusted = computeAllInAdjustedResult(heroHole, [villainHole], [], 50, 100);

    expect(adjusted).not.toBeNull();
    expect(adjusted as number).toBeGreaterThan(-22);
    expect(adjusted as number).toBeLessThan(-10);
  });

  it('books a positive result for a favourite who lost the runout', () => {
    // The headline case: KK all-in preflop against AQs. The hand may have lost
    // at the table, but the adjustment credits the ~66% equity share.
    const heroHole = [parseCard('Ks'), parseCard('Kh')] as [number, number];
    const villainHole = [parseCard('Ad'), parseCard('Qd')] as [number, number];

    const adjusted = computeAllInAdjustedResult(heroHole, [villainHole], [], 50, 100);

    expect(adjusted).not.toBeNull();
    expect(adjusted as number).toBeGreaterThan(0);
  });

  it('is deterministic: the same spot always adjusts to the same number', () => {
    const heroHole = [parseCard('As'), parseCard('Qs')] as [number, number];
    const villainHole = [parseCard('Ks'), parseCard('Kh')] as [number, number];

    const first = computeAllInAdjustedResult(heroHole, [villainHole], [], 50, 100);
    const second = computeAllInAdjustedResult(heroHole, [villainHole], [], 50, 100);

    expect(first).toBe(second);
  });

  it('multiway equity is strictly below the average of the pairwise equities', () => {
    // Hero: 84o against AK, AK, A9 four-way preflop. Beating one of them is far
    // easier than beating all three at once, so averaging the heads-up numbers
    // (the old bug) overstates the hero's share badly.
    const heroHole = [parseCard('8s'), parseCard('4h')] as [number, number];
    const villain1 = [parseCard('As'), parseCard('Kd')] as [number, number];
    const villain2 = [parseCard('Ah'), parseCard('Ks')] as [number, number];
    const villain3 = [parseCard('Ac'), parseCard('9d')] as [number, number];
    const contribution = 100;
    const pot = 400;

    const multiway = computeAllInAdjustedResult(
      heroHole,
      [villain1, villain2, villain3],
      [],
      contribution,
      pot,
    );

    const pairwise = [villain1, villain2, villain3].map(
      (v) => computeAllInAdjustedResult(heroHole, [v], [], contribution, pot) as number,
    );
    const averagedPairwise = pairwise.reduce((a, b) => a + b, 0) / pairwise.length;

    expect(multiway).not.toBeNull();
    expect(multiway as number).toBeLessThan(averagedPairwise);
  });

  it('multiway all-in with 1 card to come enumerates exactly', () => {
    // Hero: 84o turn, Villains: AK, AK (2-way all-in, 1 card to come)
    const heroHole = [parseCard('8s'), parseCard('4h')] as [number, number];
    const villain1 = [parseCard('As'), parseCard('Kd')] as [number, number];
    const villain2 = [parseCard('Ah'), parseCard('Ks')] as [number, number];
    const board = [parseCard('2c'), parseCard('3d'), parseCard('5h'), parseCard('7s')];
    const heroContribution = 50;
    const finalPot = 100;

    const result = computeAllInAdjustedResult(
      heroHole,
      [villain1, villain2],
      board,
      heroContribution,
      finalPot,
    );

    // With 1 card to come, exact enumeration should work
    expect(result).not.toBeNull();
    expect(typeof result).toBe('number');
    // 84o is weak, should be significantly negative
    expect(result).toBeLessThan(0);
  });
});
