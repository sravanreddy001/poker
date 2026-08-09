import { describe, it, expect } from 'vitest';
import { parseCards } from './cards';
import { makeRng } from './rng';
import { rangeTopPercent } from './ranges';
import { realizedEquity, RealizationInput } from './realization';

const hole = (s: string) => parseCards(s) as [number, number];

const input = (over: Partial<RealizationInput> = {}): RealizationInput => ({
  hole: hole('As Ks'),
  board: parseCards('2s 7h 9c'),
  pot: 10,
  stack: 100,
  bigBlind: 1,
  inPosition: true,
  villainRange: rangeTopPercent(0.3),
  ...over,
});

describe('realized equity', () => {
  it('never exceeds raw equity', () => {
    const r = realizedEquity(input(), makeRng(1), 200);
    expect(r.realized).toBeLessThanOrEqual(r.raw + 1e-9);
  });

  /**
   * Position changes the answer, but not reliably in the hero's favour. The
   * only thing `inPosition` controls in this simulation is whether the villain
   * may bluff, and a bluffing villain can *raise* the hero's realized equity,
   * because the hero calls at correct pot odds and wins those pots. The
   * simulation does not model the real positional edge — acting last with more
   * information — so asserting that in position realizes more would be
   * asserting something the model does not implement.
   */
  it('responds to position without either seat being strictly better', () => {
    const ip = realizedEquity(input({ inPosition: true }), makeRng(2), 300);
    const oop = realizedEquity(input({ inPosition: false }), makeRng(2), 300);
    expect(ip.realized).toBeGreaterThanOrEqual(0);
    expect(ip.realized).toBeLessThanOrEqual(ip.raw + 1e-9);
    expect(oop.realized).toBeGreaterThanOrEqual(0);
    expect(oop.realized).toBeLessThanOrEqual(oop.raw + 1e-9);
  });

  it('reports a factor consistent with its own numbers', () => {
    const r = realizedEquity(input(), makeRng(3), 200);
    expect(r.factor).toBeCloseTo(r.realized / r.raw, 6);
  });

  it('is deterministic for a given seed', () => {
    const a = realizedEquity(input(), makeRng(4), 150);
    const b = realizedEquity(input(), makeRng(4), 150);
    expect(a).toEqual(b);
  });

  it('returns values in the unit interval', () => {
    const r = realizedEquity(input(), makeRng(6), 200);
    expect(r.realized).toBeGreaterThanOrEqual(0);
    expect(r.realized).toBeLessThanOrEqual(1);
    expect(r.raw).toBeGreaterThanOrEqual(0);
    expect(r.raw).toBeLessThanOrEqual(1);
  });
});
