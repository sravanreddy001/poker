import { describe, it, expect } from 'vitest';
import { money, isHeroInPosition } from './analysis';
import { startHand } from './engine/game';

describe('money formatter', () => {
  it('formats integers correctly', () => {
    expect(money(10)).toBe('$10');
    expect(money(0)).toBe('$0');
  });

  it('formats decimals to two places', () => {
    expect(money(4.5)).toBe('$4.50');
    expect(money(0.25)).toBe('$0.25');
  });

  it('handles explicit sign option', () => {
    expect(money(5, { sign: true })).toBe('+$5');
    expect(money(4.5, { sign: true })).toBe('+$4.50');
    expect(money(-2.5, { sign: true })).toBe('-$2.50');
    expect(money(-10, { sign: true })).toBe('-$10');
    expect(money(0, { sign: true })).toBe('$0');
  });
});

describe('inPosition derivation', () => {
  it('derives hero in position when hero is BTN (seat 0)', () => {
    const s = startHand(1, { players: 6, stack: 100, bigBlind: 1 });
    expect(isHeroInPosition(s, 0, 0)).toBe(true);
  });

  it('derives out of position when hero is SB (seat 1) vs BB (seat 2)', () => {
    const s = startHand(1, { players: 6, stack: 100, bigBlind: 1 });
    expect(isHeroInPosition(s, 1, 0)).toBe(false);
  });

  it('derives hero in position if all later position players have folded', () => {
    const s = startHand(1, { players: 6, stack: 100, bigBlind: 1 });
    // Fold BTN (seat 0) and CO (seat 5)
    s.players[0].folded = true;
    s.players[5].folded = true;
    // Hero is seat 4 (HJ). Active remaining opponents are SB (1), BB (2), UTG (3)
    // HJ acts after SB, BB, UTG postflop, so hero is in position relative to remaining active actors
    expect(isHeroInPosition(s, 4, 0)).toBe(true);
  });
});
