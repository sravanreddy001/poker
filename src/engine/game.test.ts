import { describe, it, expect } from 'vitest';
import { startHand, applyAction, stepBots } from './game';

const opts = { players: 6, stack: 100, bigBlind: 1 };

describe('game state machine', () => {
  it('deals two cards to every player and posts blinds', () => {
    const s = startHand(1, opts);
    expect(s.players).toHaveLength(6);
    for (const p of s.players) expect(p.hole).toHaveLength(2);
    expect(s.pot).toBe(1.5); // small blind 0.5 + big blind 1
    expect(s.board).toHaveLength(0);
    expect(s.street).toBe('preflop');
  });

  it('deals no duplicate cards', () => {
    const s = startHand(2, opts);
    const all = [...s.players.flatMap((p) => p.hole ?? []), ...s.board];
    expect(new Set(all).size).toBe(all.length);
  });

  it('is reproducible from its seed', () => {
    const a = startHand(42, opts);
    const b = startHand(42, opts);
    expect(a.players.map((p) => p.hole)).toEqual(b.players.map((p) => p.hole));
  });

  it('completes a hand when the human folds every decision', () => {
    let s = startHand(3, opts);
    let guard = 0;
    while (!s.complete && guard++ < 300) {
      s = stepBots(s);
      if (s.complete) break;
      s = applyAction(s, { type: 'fold' });
    }
    expect(s.complete).toBe(true);
    expect(s.winners.length).toBeGreaterThanOrEqual(1);
  });

  it('conserves chips across a completed hand', () => {
    const start = startHand(4, opts);
    const startTotal = start.players.reduce((n, p) => n + p.stack, 0) + start.pot;
    let s = start;
    let guard = 0;
    while (!s.complete && guard++ < 300) {
      s = stepBots(s);
      if (s.complete) break;
      s = applyAction(s, { type: 'fold' });
    }
    const endTotal = s.players.reduce((n, p) => n + p.stack, 0);
    expect(endTotal).toBeCloseTo(startTotal, 6);
  });

  it('progresses past preflop when action checks and calls around', () => {
    let s = startHand(5, opts);
    const seen = new Set([s.street]);
    let guard = 0;
    while (!s.complete && guard++ < 300) {
      s = stepBots(s);
      if (s.complete) break;
      const owed = s.currentBet - s.players[s.toAct].committed;
      s = applyAction(s, owed > 0 ? { type: 'call' } : { type: 'check' });
      seen.add(s.street);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('records every action in the log', () => {
    let s = startHand(6, opts);
    s = stepBots(s);
    if (!s.complete) s = applyAction(s, { type: 'fold' });
    expect(s.log.length).toBeGreaterThan(0);
    expect(s.log[0]).toHaveProperty('action');
    expect(s.log[0]).toHaveProperty('street');
  });

  it('never leaves a player with a negative stack', () => {
    for (let seed = 0; seed < 20; seed++) {
      let s = startHand(seed, opts);
      let guard = 0;
      while (!s.complete && guard++ < 300) {
        s = stepBots(s);
        if (s.complete) break;
        const owed = s.currentBet - s.players[s.toAct].committed;
        s = applyAction(s, owed > 0 ? { type: 'call' } : { type: 'check' });
      }
      expect(s.complete).toBe(true);
      for (const p of s.players) expect(p.stack).toBeGreaterThanOrEqual(0);
    }
  }, 120000);
});
