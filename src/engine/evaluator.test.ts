import { describe, it, expect } from 'vitest';
import { parseCards, fullDeck } from './cards';
import { evaluate, categoryOf, Cat } from './evaluator';

const ev = (s: string) => evaluate(parseCards(s));

describe('evaluator categories', () => {
  it('identifies each hand class', () => {
    expect(categoryOf(ev('As Ks Qs Js Ts 2c 3d'))).toBe(Cat.StraightFlush);
    expect(categoryOf(ev('As Ah Ad Ac Ks 2c 3d'))).toBe(Cat.Quads);
    expect(categoryOf(ev('As Ah Ad Ks Kh 2c 3d'))).toBe(Cat.FullHouse);
    expect(categoryOf(ev('As Ks 9s 5s 2s 3d 4c'))).toBe(Cat.Flush);
    expect(categoryOf(ev('9s 8h 7d 6c 5s 2c 3d'))).toBe(Cat.Straight);
    expect(categoryOf(ev('As Ah Ad Ks Qh 2c 3d'))).toBe(Cat.Trips);
    expect(categoryOf(ev('As Ah Ks Kh Qd 2c 3d'))).toBe(Cat.TwoPair);
    expect(categoryOf(ev('As Ah Ks Qh Jd 2c 3d'))).toBe(Cat.Pair);
    expect(categoryOf(ev('As Kh Qd Js 9c 3d 2h'))).toBe(Cat.HighCard);
  });

  it('ranks a full house above a flush on a paired board', () => {
    // The classic ordering bug: both hands are available in the same 7 cards.
    expect(categoryOf(ev('As Ah Ad Ks Kh 2s 3s'))).toBe(Cat.FullHouse);
  });

  it('reads the wheel as a five-high straight', () => {
    const wheel = ev('As 2h 3d 4c 5s Kh Qd');
    expect(categoryOf(wheel)).toBe(Cat.Straight);
    // Five-high straight loses to six-high straight.
    expect(wheel).toBeLessThan(ev('2h 3d 4c 5s 6h Kh Qd'));
  });

  it('reads the steel wheel as a straight flush', () => {
    expect(categoryOf(ev('As 2s 3s 4s 5s Kh Qd'))).toBe(Cat.StraightFlush);
  });
});

describe('evaluator tie-breaks', () => {
  it('compares kickers on one pair', () => {
    expect(ev('As Ah Ks 7d 4c 2h 3d')).toBeGreaterThan(ev('As Ah Qs 7d 4c 2h 3d'));
  });

  it('compares the higher pair first on two pair', () => {
    expect(ev('As Ah 2s 2h Kd 7c 8h')).toBeGreaterThan(ev('Ks Kh Qs Qh Ad 7c 8h'));
  });

  it('handles counterfeited two pair via the fifth card', () => {
    expect(ev('As Ah Ks Kh Qd 2c 3h')).toBeGreaterThan(ev('As Ah Ks Kh Jd 2c 3h'));
  });

  it('ties identical hands regardless of suit', () => {
    expect(ev('As Ah Ks Qh Jd 2c 3h')).toBe(ev('Ad Ac Kd Qc Jh 2s 3d'));
  });

  it('ranks quads by the quad rank then the kicker', () => {
    expect(ev('As Ah Ad Ac Ks 2c 3d')).toBeGreaterThan(ev('Ks Kh Kd Kc As 2c 3d'));
    expect(ev('As Ah Ad Ac Ks 2c 3d')).toBeGreaterThan(ev('As Ah Ad Ac Qs 2c 3d'));
  });
});

describe('evaluator invariants', () => {
  it('orders categories monotonically', () => {
    const ordered = [
      ev('As Kh Qd Js 9c 3d 2h'), // high card
      ev('2s 2h Ks Qh Jd 9c 3d'), // pair
      ev('2s 2h 3s 3h Kd 9c 5d'), // two pair
      ev('2s 2h 2d Ks Qh 9c 5d'), // trips
      ev('9s 8h 7d 6c 5s 2c 3d'), // straight
      ev('As Ks 9s 5s 2s 3d 4c'), // flush
      ev('2s 2h 2d Ks Kh 9c 5d'), // full house
      ev('2s 2h 2d 2c Kh 9c 5d'), // quads
      ev('As Ks Qs Js Ts 2c 3d'), // straight flush
    ];
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i]).toBeGreaterThan(ordered[i - 1]);
    }
  });

  it('never lets extra cards lower a hand', () => {
    expect(ev('As Ah Ad Ks Kh 2c 3d')).toBeGreaterThanOrEqual(ev('As Ah Ad Ks Kh'));
  });
});

describe('evaluator exhaustive sweep', () => {
  it('scores every 5-card hand and matches known class frequencies', () => {
    const deck = fullDeck();
    const freq = new Map<number, number>();
    for (let a = 0; a < 48; a++)
      for (let b = a + 1; b < 49; b++)
        for (let c = b + 1; c < 50; c++)
          for (let d = c + 1; d < 51; d++)
            for (let e = d + 1; e < 52; e++) {
              const cat = categoryOf(evaluate([deck[a], deck[b], deck[c], deck[d], deck[e]]));
              freq.set(cat, (freq.get(cat) ?? 0) + 1);
            }
    // Published 5-card frequencies out of C(52,5) = 2,598,960.
    expect(freq.get(Cat.StraightFlush)).toBe(40);
    expect(freq.get(Cat.Quads)).toBe(624);
    expect(freq.get(Cat.FullHouse)).toBe(3744);
    expect(freq.get(Cat.Flush)).toBe(5108);
    expect(freq.get(Cat.Straight)).toBe(10200);
    expect(freq.get(Cat.Trips)).toBe(54912);
    expect(freq.get(Cat.TwoPair)).toBe(123552);
    expect(freq.get(Cat.Pair)).toBe(1098240);
    expect(freq.get(Cat.HighCard)).toBe(1302540);
  }, 120000);
});
