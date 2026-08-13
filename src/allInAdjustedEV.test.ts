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

  it('declines to adjust a preflop all-in rather than estimate one', () => {
    // Five cards to come is over a million runouts: too slow to enumerate
    // between hands, and the only alternative — sampling them — would put a
    // number on screen that the player cannot check. The actual result stands.
    const heroHole = [parseCard('As'), parseCard('Qs')] as [number, number];
    const villainHole = [parseCard('Ks'), parseCard('Kh')] as [number, number];

    expect(computeAllInAdjustedResult(heroHole, [villainHole], [], 50, 100)).toBeNull();
  });

  it('books a positive result for a flopped favourite who lost the runout', () => {
    // KK all-in on a dry flop against AQs. The hand may have lost at the table,
    // but the adjustment credits the equity share — enumerated, not sampled.
    const heroHole = [parseCard('Ks'), parseCard('Kh')] as [number, number];
    const villainHole = [parseCard('Ad'), parseCard('Qd')] as [number, number];
    const board = [parseCard('2c'), parseCard('7h'), parseCard('9s')];

    const adjusted = computeAllInAdjustedResult(heroHole, [villainHole], board, 50, 100);

    expect(adjusted).not.toBeNull();
    expect(adjusted as number).toBeGreaterThan(0);
  });

  it('is deterministic: the same spot always adjusts to the same number', () => {
    const heroHole = [parseCard('As'), parseCard('Qs')] as [number, number];
    const villainHole = [parseCard('Ks'), parseCard('Kh')] as [number, number];
    const board = [parseCard('2c'), parseCard('7h'), parseCard('9d')];

    const first = computeAllInAdjustedResult(heroHole, [villainHole], board, 50, 100);
    const second = computeAllInAdjustedResult(heroHole, [villainHole], board, 50, 100);

    expect(first).toBe(second);
  });

  it('multiway equity is strictly below the average of the pairwise equities', () => {
    // Hero: 84o against AK, AK, A9 four-way on the flop. Beating one of them is
    // far easier than beating all three at once, so averaging the heads-up
    // numbers (the old bug) overstates the hero's share badly.
    const heroHole = [parseCard('8s'), parseCard('4h')] as [number, number];
    const villain1 = [parseCard('As'), parseCard('Kd')] as [number, number];
    const villain2 = [parseCard('Ah'), parseCard('Ks')] as [number, number];
    const villain3 = [parseCard('Ac'), parseCard('9d')] as [number, number];
    const contribution = 100;
    const pot = 400;
    const board = [parseCard('8d'), parseCard('4c'), parseCard('2h')];

    const multiway = computeAllInAdjustedResult(
      heroHole,
      [villain1, villain2, villain3],
      board,
      contribution,
      pot,
    );

    const pairwise = [villain1, villain2, villain3].map(
      (v) => computeAllInAdjustedResult(heroHole, [v], board, contribution, pot) as number,
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
