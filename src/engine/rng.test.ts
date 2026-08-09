import { describe, it, expect } from 'vitest';
import { makeRng, shuffled } from './rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    expect(makeRng(1).next()).not.toBe(makeRng(2).next());
  });

  it('nextInt stays in range', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextInt(52);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(52);
    }
  });

  it('shuffles deterministically without losing elements', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = shuffled(items, makeRng(99));
    const s2 = shuffled(items, makeRng(99));
    expect(s1).toEqual(s2);
    expect([...s1].sort((x, y) => x - y)).toEqual(items);
  });
});
