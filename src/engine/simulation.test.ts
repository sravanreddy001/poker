import { describe, it, expect } from 'vitest';
import { startHand, applyAction, stepBots, HandState } from './game';
import { makeRng } from './rng';
import type { Action } from './types';

const opts = { players: 6, stack: 100, bigBlind: 1 };
const HANDS = 100;

/** Every invariant that must hold at every step of every hand. */
function checkInvariants(s: HandState, seed: number, step: number) {
  const where = `seed ${seed} step ${step}`;

  for (const p of s.players) {
    expect(p.stack, `${where}: negative stack for player ${p.id}`).toBeGreaterThanOrEqual(0);
    expect(p.committed, `${where}: negative commitment for ${p.id}`).toBeGreaterThanOrEqual(0);
  }

  expect(s.pot, `${where}: negative pot`).toBeGreaterThanOrEqual(0);

  // No card may appear twice across hole cards and board.
  const dealt = [...s.players.flatMap((p) => p.hole ?? []), ...s.board];
  expect(new Set(dealt).size, `${where}: duplicate card dealt`).toBe(dealt.length);

  expect(s.board.length, `${where}: oversized board`).toBeLessThanOrEqual(5);

  expect(s.players.filter((p) => !p.folded).length, `${where}: nobody live`).toBeGreaterThan(0);
}

/** Plays one hand to completion with a scripted hero policy. */
function playHand(seed: number, heroPolicy: (s: HandState) => Action): HandState {
  let s = startHand(seed, opts);
  let step = 0;

  while (!s.complete && step++ < 400) {
    checkInvariants(s, seed, step);
    s = stepBots(s);
    if (s.complete) break;
    checkInvariants(s, seed, step);
    s = applyAction(s, heroPolicy(s));
  }

  return s;
}

const callOrCheck = (s: HandState): Action =>
  s.currentBet > s.players[s.toAct].committed ? { type: 'call' } : { type: 'check' };

const alwaysFold = (): Action => ({ type: 'fold' });

const aggressive = (s: HandState): Action => {
  const p = s.players[s.toAct];
  const owed = s.currentBet - p.committed;
  if (p.stack <= owed) return { type: 'call' };
  const target = Math.min(p.stack + p.committed, Math.max(s.currentBet * 2, s.pot));
  return target > s.currentBet ? { type: 'raise', amount: target } : { type: 'call' };
};

describe(`${HANDS}-hand simulation`, () => {
  const policies: [string, (s: HandState) => Action][] = [
    ['calling station', callOrCheck],
    ['always folds', alwaysFold],
    ['aggressive', aggressive],
  ];

  for (const [name, policy] of policies) {
    it(`completes ${HANDS} hands and conserves chips — hero ${name}`, () => {
      const startTotal = opts.players * opts.stack;

      for (let seed = 0; seed < HANDS; seed++) {
        const final = playHand(seed, policy);

        expect(final.complete, `seed ${seed}: hand did not complete`).toBe(true);
        expect(final.winners.length, `seed ${seed}: no winner`).toBeGreaterThanOrEqual(1);
        expect(final.pot, `seed ${seed}: pot not distributed`).toBe(0);

        const endTotal = final.players.reduce((n, p) => n + p.stack, 0);
        expect(endTotal, `seed ${seed}: chips not conserved`).toBeCloseTo(startTotal, 6);
      }
    }, 600000);
  }

  it('replays identically from the same seed', () => {
    for (let seed = 0; seed < 20; seed++) {
      const a = playHand(seed, callOrCheck);
      const b = playHand(seed, callOrCheck);
      expect(a.board).toEqual(b.board);
      expect(a.winners).toEqual(b.winners);
      expect(a.players.map((p) => p.stack)).toEqual(b.players.map((p) => p.stack));
    }
  }, 300000);

  it('never awards the pot to a folded player', () => {
    let showdowns = 0;
    for (let seed = 0; seed < HANDS; seed++) {
      const final = playHand(seed, callOrCheck);
      if (final.players.filter((p) => !p.folded).length >= 2) showdowns++;
      for (const w of final.winners) {
        expect(final.players[w].folded, `seed ${seed}: folded player won`).toBe(false);
      }
    }
    expect(showdowns, 'no showdowns occurred across the sweep').toBeGreaterThan(0);
  }, 600000);

  it('keeps the rng stream deterministic', () => {
    const a = makeRng(1);
    const b = makeRng(1);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});
