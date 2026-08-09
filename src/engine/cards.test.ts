import { describe, it, expect } from 'vitest';
import { makeCard, rankOf, suitOf, cardToString, parseCard, fullDeck } from './cards';

describe('cards', () => {
  it('round-trips rank and suit', () => {
    const c = makeCard(12, 3); // Ace of spades
    expect(rankOf(c)).toBe(12);
    expect(suitOf(c)).toBe(3);
  });

  it('formats and parses', () => {
    expect(cardToString(makeCard(12, 3))).toBe('As');
    expect(cardToString(makeCard(0, 0))).toBe('2c');
    expect(parseCard('As')).toBe(makeCard(12, 3));
    expect(parseCard('Td')).toBe(makeCard(8, 1));
  });

  it('builds a 52-card deck with no duplicates', () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
  });
});
