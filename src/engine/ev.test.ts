import { describe, it, expect } from 'vitest';
import { parseCards } from './cards';
import { makeRng } from './rng';
import { rangeTopPercent } from './ranges';
import { evaluateSizes, potOddsVerdict, SIZES } from './ev';

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
});
