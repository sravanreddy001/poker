import { describe, it, expect } from 'vitest';
import { parseCards, suitOf } from './cards';
import { combosOf } from './ranges';
import { countOuts, ruleOf42, showdownEquity, structuralOuts, tableEquity } from './equity';

const hole = (s: string) => parseCards(s) as [number, number];

describe('showdown equity', () => {
  it('is certain with the nuts on a finished board', () => {
    const villain = { combos: combosOf('22') };
    expect(showdownEquity(hole('As Ks'), parseCards('Qs Js Ts 7h 8d'), villain)).toBe(1);
  });

  it('splits when the board plays', () => {
    const villain = { combos: [hole('2h 3s')] };
    expect(showdownEquity(hole('2c 3d'), parseCards('As Ks Qh Jd Tc'), villain)).toBe(0.5);
  });

  it('rates a set ahead of a big-card range', () => {
    const villain = { combos: combosOf('KQs') };
    expect(showdownEquity(hole('As Ah'), parseCards('Ad 7h 2c'), villain)).toBe(1);
  });

  it('is deterministic — no sampling, so repeats match exactly', () => {
    const villain = { combos: combosOf('TT') };
    const a = showdownEquity(hole('As Ks'), parseCards('2s 7s 9h'), villain);
    const b = showdownEquity(hole('As Ks'), parseCards('2s 7s 9h'), villain);
    expect(a).toBe(b);
  });
});

describe('rule of 4 and 2', () => {
  it('multiplies by four with two cards to come', () => {
    expect(ruleOf42(9, 2)).toBeCloseTo(0.36, 10);
  });

  it('multiplies by two with one card to come', () => {
    expect(ruleOf42(9, 1)).toBeCloseTo(0.18, 10);
  });

  it('is zero without outs or without cards to come', () => {
    expect(ruleOf42(0, 2)).toBe(0);
    expect(ruleOf42(9, 0)).toBe(0);
  });

  it('caps below certainty', () => {
    expect(ruleOf42(25, 2)).toBe(0.95);
  });
});

describe('outs counted from the shape of the hand', () => {
  it('gives a flush draw nine', () => {
    expect(structuralOuts(hole('As Ks'), parseCards('2s 7s 9h'))).toBeGreaterThanOrEqual(9);
  });

  it('gives an open-ended straight draw eight', () => {
    expect(structuralOuts(hole('9h 8c'), parseCards('7d 6s 2c'))).toBeGreaterThanOrEqual(8);
  });

  it('gives a gutshot four when nothing else is live', () => {
    // 98 under a king-high board: no overcards to add, just the seven.
    expect(structuralOuts(hole('9h 8c'), parseCards('6d 5s Kc'))).toBe(4);
  });

  it('counts nothing preflop or on a finished board', () => {
    expect(structuralOuts(hole('As Ks'), [])).toBe(0);
    expect(structuralOuts(hole('As Ks'), parseCards('2s 7s 9h 3d 4c'))).toBe(0);
  });
});

describe('range-aware outs', () => {
  it('counts the flush outs for a flush draw', () => {
    const villain = { combos: combosOf('TT') };
    const { outs } = countOuts(hole('As Ks'), parseCards('2s 7s 9h'), villain);
    const spades = outs.filter((c) => suitOf(c) === 3);
    expect(spades.length).toBeGreaterThanOrEqual(9);
  });

  it('reports no outs when already far ahead', () => {
    const villain = { combos: combosOf('72o') };
    const { outs } = countOuts(hole('As Ah'), parseCards('Ad 7h 2c'), villain);
    expect(outs).toHaveLength(0);
  });

  it('reports no outs preflop or on a complete board', () => {
    const villain = { combos: combosOf('TT') };
    expect(countOuts(hole('As Ks'), [], villain).outs).toHaveLength(0);
    expect(countOuts(hole('As Ks'), parseCards('2s 7s 9h 3d 4c'), villain).outs).toHaveLength(0);
  });
});

describe('the one win-odds number', () => {
  it('reads preflop off the hand tier', () => {
    const r = tableEquity(hole('As Ah'), [], { combos: combosOf('72o') });
    expect(r.method).toBe('tier');
    expect(r.equity).toBeGreaterThan(0.6);
  });

  it('uses hands-beaten when already ahead', () => {
    const r = tableEquity(hole('As Ah'), parseCards('Ad 7h 2c'), { combos: combosOf('KQs') });
    expect(r.method).toBe('showdown');
    expect(r.ahead).toBe(true);
  });

  it('uses outs × 4 on the flop when behind', () => {
    const r = tableEquity(hole('As Ks'), parseCards('2s 7s 9h'), { combos: combosOf('TT') });
    expect(r.method).toBe('outs');
    expect(r.outs).toBeGreaterThanOrEqual(9);
    expect(r.equity).toBeCloseTo(ruleOf42(r.outs, 2), 10);
  });

  it('repeats exactly — nothing here is sampled', () => {
    const spot = () =>
      tableEquity(hole('As Ks'), parseCards('2s 7s 9h'), { combos: combosOf('TT') });
    expect(spot().equity).toBe(spot().equity);
  });
});
