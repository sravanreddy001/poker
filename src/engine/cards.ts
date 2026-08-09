export type Card = number; // 0..51

export const RANKS = '23456789TJQKA';
export const SUITS = 'cdhs';

export function makeCard(rank: number, suit: number): Card {
  return (rank << 2) | suit;
}

export function rankOf(c: Card): number {
  return c >> 2;
}

export function suitOf(c: Card): number {
  return c & 3;
}

export function cardToString(c: Card): string {
  return RANKS[rankOf(c)] + SUITS[suitOf(c)];
}

export function parseCard(s: string): Card {
  const rank = RANKS.indexOf(s[0].toUpperCase());
  const suit = SUITS.indexOf(s[1].toLowerCase());
  if (rank < 0 || suit < 0) throw new Error(`bad card: ${s}`);
  return makeCard(rank, suit);
}

export function parseCards(s: string): Card[] {
  return s.trim().split(/\s+/).map(parseCard);
}

export function fullDeck(): Card[] {
  return Array.from({ length: 52 }, (_, i) => i);
}
