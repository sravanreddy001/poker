import { describe, it, expect } from 'vitest';
import { parseCards } from './cards';
import { makeRng } from './rng';
import { rangeTopPercent } from './ranges';
import { botAct, DEFAULT_BOT } from './bot';
import type { BotContext } from './types';

const hole = (s: string) => parseCards(s) as [number, number];

const base = (over: Partial<BotContext>): BotContext => ({
  hole: hole('As Ah'),
  board: [],
  pot: 3,
  toCall: 0,
  stack: 100,
  bigBlind: 1,
  street: 'preflop',
  inPosition: true,
  villainRange: rangeTopPercent(0.3),
  ...over,
});

describe('bot policy', () => {
  it('is deterministic for a given seed', () => {
    const ctx = base({ hole: hole('9s 4d'), board: parseCards('As Kh 2c'), street: 'flop' });
    expect(botAct(ctx, DEFAULT_BOT, makeRng(11))).toEqual(botAct(ctx, DEFAULT_BOT, makeRng(11)));
  });

  it('raises with a premium hand preflop', () => {
    const a = botAct(base({ hole: hole('As Ah') }), DEFAULT_BOT, makeRng(1));
    expect(['bet', 'raise']).toContain(a.type);
  });

  it('folds trash preflop facing a raise', () => {
    const a = botAct(base({ hole: hole('7h 2c'), toCall: 3 }), DEFAULT_BOT, makeRng(1));
    expect(a.type).toBe('fold');
  });

  it('value bets a strong made hand on the flop', () => {
    const ctx = base({
      hole: hole('As Ah'),
      board: parseCards('Ad 7h 2c'),
      street: 'flop',
      toCall: 0,
    });
    const a = botAct(ctx, DEFAULT_BOT, makeRng(3));
    expect(a.type).toBe('bet');
    if (a.type === 'bet') expect(a.amount).toBeGreaterThan(0);
  });

  it('folds air facing a large river bet', () => {
    const ctx = base({
      hole: hole('7h 3c'),
      board: parseCards('As Kd Qh 9s 4c'),
      street: 'river',
      toCall: 20,
      pot: 20,
      inPosition: false,
    });
    expect(botAct(ctx, DEFAULT_BOT, makeRng(4)).type).toBe('fold');
  });

  it('bluffs at approximately the configured frequency', () => {
    const cfg = { ...DEFAULT_BOT, bluffFreq: { preflop: 0, flop: 0, turn: 0, river: 0.3 } };
    const ctx = base({
      hole: hole('7h 3c'),
      board: parseCards('As Kd Qh 9s 4c'),
      street: 'river',
      toCall: 0,
      pot: 20,
      inPosition: true,
    });
    let bluffs = 0;
    const trials = 1500;
    for (let i = 0; i < trials; i++) {
      if (botAct(ctx, cfg, makeRng(i)).type === 'bet') bluffs++;
    }
    expect(bluffs / trials).toBeGreaterThan(0.24);
    expect(bluffs / trials).toBeLessThan(0.36);
  });

  it('never bluffs when the frequency is zero', () => {
    const cfg = { ...DEFAULT_BOT, bluffFreq: { preflop: 0, flop: 0, turn: 0, river: 0 } };
    const ctx = base({
      hole: hole('7h 3c'),
      board: parseCards('As Kd Qh 9s 4c'),
      street: 'river',
      toCall: 0,
      pot: 20,
      inPosition: true,
    });
    for (let i = 0; i < 200; i++) {
      expect(botAct(ctx, cfg, makeRng(i)).type).not.toBe('bet');
    }
  });

  /**
   * Regression: on raw pot odds a marginal hand called a 10x-pot overbet,
   * because 100 to win 210 only needs 48% equity. A hand that calls a half-pot
   * bet must not automatically call a shove for the same pot.
   */
  it('demands more equity as the bet grows relative to the pot', () => {
    // Second pair on a K-high turn: 53% against a top-30% range, so it beats
    // the price of a half-pot bet but not the premium a shove carries.
    const spot = {
      hole: hole('Ts 9s'),
      board: parseCards('Kh 7s 2c 9d'),
      street: 'turn' as const,
      stack: 100,
      inPosition: false,
    };
    const small = botAct(base({ ...spot, pot: 15, toCall: 5 }), DEFAULT_BOT, makeRng(21));
    const shove = botAct(base({ ...spot, pot: 110, toCall: 100 }), DEFAULT_BOT, makeRng(21));
    expect(small.type).not.toBe('fold');
    expect(shove.type).toBe('fold');
  });

  it('never bets more than its stack', () => {
    const ctx = base({
      hole: hole('As Ah'),
      board: parseCards('Ad 7h 2c'),
      street: 'flop',
      stack: 5,
      pot: 50,
    });
    const a = botAct(ctx, DEFAULT_BOT, makeRng(5));
    if (a.type === 'bet' || a.type === 'raise') expect(a.amount).toBeLessThanOrEqual(5);
  });
});
