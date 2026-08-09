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

  it('realizes no more out of position than in position', () => {
    const ip = realizedEquity(input({ inPosition: true }), makeRng(2), 300);
    const oop = realizedEquity(input({ inPosition: false }), makeRng(2), 300);
    expect(oop.realized).toBeLessThanOrEqual(ip.realized + 1e-9);
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
