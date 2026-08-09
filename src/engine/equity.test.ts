import { describe, it, expect } from 'vitest';
import { parseCards, suitOf } from './cards';
import { makeRng } from './rng';
import { combosOf } from './ranges';
import { equityVsCombo, equityVsRange, countOuts } from './equity';

const hole = (s: string) => parseCards(s) as [number, number];

describe('equity vs a single hand', () => {
  it('matches the published AA vs KK figure', () => {
    const r = equityVsCombo(hole('As Ah'), hole('Ks Kh'), [], makeRng(1));
    expect(r.equity).toBeGreaterThan(0.79);
    expect(r.equity).toBeLessThan(0.85);
  });

  it('matches the published AKs vs QQ figure', () => {
    const r = equityVsCombo(hole('As Ks'), hole('Qh Qd'), [], makeRng(2));
    expect(r.equity).toBeGreaterThan(0.43);
    expect(r.equity).toBeLessThan(0.49);
  });

  it('gives a made flush certain equity on the river', () => {
    const r = equityVsCombo(hole('As Ks'), hole('2c 2d'), parseCards('Qs Js 3s 7h 8d'), makeRng(3));
    expect(r.equity).toBe(1);
    expect(r.exact).toBe(true);
  });

  it('splits a board-plays pot', () => {
    const r = equityVsCombo(hole('2c 3d'), hole('2h 3s'), parseCards('As Ks Qh Jd Tc'), makeRng(4));
    expect(r.equity).toBe(0.5);
  });

  it('enumerates exactly from the flop', () => {
    const r = equityVsCombo(hole('As Ks'), hole('Qh Qd'), parseCards('2s 7h 9c'), makeRng(5));
    expect(r.exact).toBe(true);
    expect(r.total).toBe(990); // C(45,2)
  });

  it('enumerates exactly on the turn', () => {
    const r = equityVsCombo(hole('As Ks'), hole('Qh Qd'), parseCards('2s 7h 9c 4d'), makeRng(6));
    expect(r.exact).toBe(true);
    expect(r.total).toBe(44);
  });
});

describe('equity vs a range', () => {
  it('rates aces well ahead of a weak holding', () => {
    const villain = { combos: combosOf('72o') };
    const r = equityVsRange(hole('As Ah'), [], villain, makeRng(7));
    expect(r.equity).toBeGreaterThan(0.85);
  });

  it('is symmetric — hero and villain equities sum to one', () => {
    const a = equityVsCombo(hole('As Ah'), hole('Ks Kh'), parseCards('2c 7d 9h'), makeRng(8));
    const b = equityVsCombo(hole('Ks Kh'), hole('As Ah'), parseCards('2c 7d 9h'), makeRng(8));
    expect(a.equity + b.equity).toBeCloseTo(1, 6);
  });

  it('is deterministic for a given seed', () => {
    const a = equityVsRange(hole('As Ah'), [], { combos: combosOf('KK') }, makeRng(9));
    const b = equityVsRange(hole('As Ah'), [], { combos: combosOf('KK') }, makeRng(9));
    expect(a.equity).toBe(b.equity);
  });
});

describe('outs', () => {
  it('counts the flush outs for a flush draw', () => {
    const villain = { combos: combosOf('TT') };
    const { outs } = countOuts(hole('As Ks'), parseCards('2s 7s 9h'), villain, makeRng(10));
    const spades = outs.filter((c) => suitOf(c) === 3);
    expect(spades.length).toBeGreaterThanOrEqual(9);
  });

  it('reports no outs when already far ahead', () => {
    const villain = { combos: combosOf('72o') };
    const { outs } = countOuts(hole('As Ah'), parseCards('Ad 7h 2c'), villain, makeRng(11));
    expect(outs).toHaveLength(0);
  });

  it('reports no outs preflop or on a complete board', () => {
    const villain = { combos: combosOf('TT') };
    expect(countOuts(hole('As Ks'), [], villain, makeRng(12)).outs).toHaveLength(0);
    expect(
      countOuts(hole('As Ks'), parseCards('2s 7s 9h 3d 4c'), villain, makeRng(13)).outs,
    ).toHaveLength(0);
  });
});
