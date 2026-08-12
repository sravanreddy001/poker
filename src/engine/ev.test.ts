import { describe, it, expect } from 'vitest';
import { parseCards } from './cards';
import { makeRng } from './rng';
import { rangeTopPercent } from './ranges';
import { evaluateSizes, potOddsVerdict, SIZES, bluffPrice, minDefenseFrequency, commitmentTier } from './ev';

const hole = (s: string) => parseCards(s) as [number, number];

const input = {
  hole: hole('As Ah'),
  board: parseCards('Ad 7h 2c'),
  pot: 10,
  toCall: 0,
  stack: 100,
  bigBlind: 1,
  inPosition: true,
  villainRange: rangeTopPercent(0.3),
};

describe('pot odds', () => {
  it('computes the required equity to call', () => {
    const v = potOddsVerdict(25, 75, 0.4);
    expect(v.required).toBeCloseTo(0.25, 6); // 25 to win 100
    expect(v.actual).toBe(0.4);
    expect(v.evOfCall).toBeGreaterThan(0);
  });

  it('reports a negative EV call when the price is wrong', () => {
    const v = potOddsVerdict(50, 50, 0.2);
    expect(v.required).toBeCloseTo(0.5, 6);
    expect(v.evOfCall).toBeLessThan(0);
  });

  it('treats a free call as always correct', () => {
    expect(potOddsVerdict(0, 10, 0.1).required).toBe(0);
  });
});

describe('bluff price', () => {
  // Price table from spec: Bluff: bet / (pot + bet)
  it('computes bluff price for 1/4 pot bet', () => {
    const price = bluffPrice(0.25, 1); // bet 0.25 into pot 1
    expect(price).toBeCloseTo(0.2, 6); // 0.25 / 1.25 = 0.2 = 20%
  });

  it('computes bluff price for 1/3 pot bet', () => {
    const price = bluffPrice(1, 3);
    expect(price).toBeCloseTo(0.25, 6); // 1 / 4 = 0.25 = 25%
  });

  it('computes bluff price for 1/2 pot bet', () => {
    const price = bluffPrice(0.5, 1);
    expect(price).toBeCloseTo(0.333, 2); // 0.5 / 1.5 ≈ 0.333 = 33%
  });

  it('computes bluff price for pot-sized bet', () => {
    const price = bluffPrice(1, 1);
    expect(price).toBeCloseTo(0.5, 6); // 1 / 2 = 0.5 = 50%
  });

  it('computes bluff price for 2x pot bet', () => {
    const price = bluffPrice(2, 1);
    expect(price).toBeCloseTo(0.667, 2); // 2 / 3 ≈ 0.667 = 67%
  });

  it('returns 0 when bet is 0', () => {
    expect(bluffPrice(0, 10)).toBe(0);
  });

  it('approaches 1 as bet grows much larger than pot', () => {
    expect(bluffPrice(1000, 1)).toBeCloseTo(0.999, 3);
  });
});

describe('minimum defense frequency', () => {
  // MDF: pot / (pot + bet)
  it('computes MDF for 1/4 pot bet', () => {
    const mdf = minDefenseFrequency(0.25, 1);
    expect(mdf).toBeCloseTo(0.8, 6); // 1 / 1.25 = 0.8 = 80%
  });

  it('computes MDF for 1/3 pot bet', () => {
    const mdf = minDefenseFrequency(1, 3);
    expect(mdf).toBeCloseTo(0.75, 6); // 3 / 4 = 0.75 = 75%
  });

  it('computes MDF for 1/2 pot bet', () => {
    const mdf = minDefenseFrequency(0.5, 1);
    expect(mdf).toBeCloseTo(0.667, 2); // 1 / 1.5 ≈ 0.667 = 67%
  });

  it('computes MDF for pot-sized bet', () => {
    const mdf = minDefenseFrequency(1, 1);
    expect(mdf).toBeCloseTo(0.5, 6); // 1 / 2 = 0.5 = 50%
  });

  it('computes MDF for 2x pot bet', () => {
    const mdf = minDefenseFrequency(2, 1);
    expect(mdf).toBeCloseTo(0.333, 2); // 1 / 3 ≈ 0.333 = 33%
  });

  it('returns 0 when bet is 0', () => {
    expect(minDefenseFrequency(0, 10)).toBe(0);
  });

  it('approaches 0 as bet grows much larger than pot', () => {
    expect(minDefenseFrequency(1000, 1)).toBeCloseTo(0.001, 3);
  });
});

describe('commitment tier', () => {
  it('classifies SPR < 1 as committed', () => {
    const result = commitmentTier(0.5);
    expect(result.tier).toBe('committed');
    expect(result.label).toBe('All-In Territory');
  });

  it('classifies 1 <= SPR < 3 as shallow', () => {
    const result = commitmentTier(2);
    expect(result.tier).toBe('shallow');
    expect(result.label).toBe('Shallow Stack');
  });

  it('classifies 3 <= SPR < 6 as medium', () => {
    const result = commitmentTier(4);
    expect(result.tier).toBe('medium');
    expect(result.label).toBe('Medium Stack');
  });

  it('classifies SPR >= 6 as deep', () => {
    const result = commitmentTier(10);
    expect(result.tier).toBe('deep');
    expect(result.label).toBe('Deep Stack');
  });

  it('includes a note on each tier', () => {
    for (const spr of [0.5, 2, 4, 10]) {
      const result = commitmentTier(spr);
      expect(result.note).toBeTruthy();
      expect(result.note.length).toBeGreaterThan(0);
    }
  });
});

describe('bet size EV', () => {
  it('returns one option per configured size', () => {
    expect(evaluateSizes(input, makeRng(1))).toHaveLength(SIZES.length);
  });

  it('sorts by descending EV', () => {
    const out = evaluateSizes(input, makeRng(2));
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].ev).toBeGreaterThanOrEqual(out[i].ev);
    }
  });

  it('prefers betting over checking with a very strong hand', () => {
    expect(evaluateSizes(input, makeRng(3))[0].label).not.toBe('check');
  });

  it('is deterministic for a given seed', () => {
    expect(evaluateSizes(input, makeRng(4))).toEqual(evaluateSizes(input, makeRng(4)));
  });

  it('never proposes an amount above the stack', () => {
    const out = evaluateSizes({ ...input, stack: 4, pot: 40 }, makeRng(5));
    for (const o of out) expect(o.amount).toBeLessThanOrEqual(4);
  });

  /**
   * Regression: pricing a bet against the whole range instead of against the
   * hands that actually call it made a 99bb shove into a 4bb pot the top line
   * for a marginal hand. Only strong hands call a 25x-pot overbet, so equity
   * against the callers is far below equity against the range.
   */
  it('does not rate a huge overbet above a normal bet with a marginal hand', () => {
    const marginal = {
      ...input,
      hole: hole('7d 5h'),
      board: parseCards('Ah 9c 2s'),
      pot: 4,
      stack: 99,
    };
    const out = evaluateSizes(marginal, makeRng(6));
    const allIn = out.find((o) => o.label === 'all-in')!;
    const potSized = out.find((o) => o.label === 'pot')!;
    expect(allIn.ev).toBeLessThan(potSized.ev);
    expect(out[0].label).not.toBe('all-in');
  });

  it('names the zero-cost option a fold when there is a live bet', () => {
    const out = evaluateSizes({ ...input, toCall: 6 }, makeRng(7));
    const free = out.find((o) => o.amount === 0)!;
    expect(free.label).toBe('fold');
    expect(free.ev).toBe(0);
  });
});
