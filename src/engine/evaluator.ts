import { Card, rankOf, suitOf } from './cards';

export enum Cat {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  Trips = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  Quads = 7,
  StraightFlush = 8,
}

/** Rank-bitmask patterns for every straight, lowest first. `high` is the rank index of the top card. */
const STRAIGHTS: { mask: number; high: number }[] = (() => {
  const out: { mask: number; high: number }[] = [];
  // Wheel: A,5,4,3,2 — the ace plays low, so the five is the high card.
  out.push({ mask: (1 << 12) | (1 << 3) | (1 << 2) | (1 << 1) | 1, high: 3 });
  for (let high = 4; high <= 12; high++) {
    let mask = 0;
    for (let i = 0; i < 5; i++) mask |= 1 << (high - i);
    out.push({ mask, high });
  }
  return out;
})();

function straightHigh(rankMask: number): number {
  for (let i = STRAIGHTS.length - 1; i >= 0; i--) {
    if ((rankMask & STRAIGHTS[i].mask) === STRAIGHTS[i].mask) return STRAIGHTS[i].high;
  }
  return -1;
}

function topN(mask: number, n: number): number[] {
  const out: number[] = [];
  for (let r = 12; r >= 0 && out.length < n; r--) {
    if (mask & (1 << r)) out.push(r);
  }
  while (out.length < n) out.push(0);
  return out;
}

function score(cat: Cat, r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0): number {
  return (cat << 20) | (r1 << 16) | (r2 << 12) | (r3 << 8) | (r4 << 4) | r5;
}

export function categoryOf(s: number): Cat {
  return (s >> 20) as Cat;
}

const CATEGORY_NAME: Record<Cat, string> = {
  [Cat.HighCard]: 'High Card',
  [Cat.Pair]: 'Pair',
  [Cat.TwoPair]: 'Two Pair',
  [Cat.Trips]: 'Three of a Kind',
  [Cat.Straight]: 'Straight',
  [Cat.Flush]: 'Flush',
  [Cat.FullHouse]: 'Full House',
  [Cat.Quads]: 'Four of a Kind',
  [Cat.StraightFlush]: 'Straight Flush',
};

export function categoryName(s: number): string {
  return CATEGORY_NAME[categoryOf(s)];
}

/**
 * Score the best five-card hand available in `cards` (5 to 7 cards).
 * Higher is better; equal scores are genuine ties.
 *
 * Category order matters: straight flush, quads, full house, flush, straight,
 * trips, two pair, pair, high card. Checking flush before full house is a real
 * bug that picks the wrong winner on paired boards.
 */
export function evaluate(cards: Card[]): number {
  const counts = new Array<number>(13).fill(0);
  const suitMask = [0, 0, 0, 0];
  const suitCount = [0, 0, 0, 0];
  let rankMask = 0;

  for (const c of cards) {
    const r = rankOf(c);
    const s = suitOf(c);
    counts[r]++;
    suitCount[s]++;
    suitMask[s] |= 1 << r;
    rankMask |= 1 << r;
  }

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCount[s] >= 5) flushSuit = s;

  // 1. Straight flush
  if (flushSuit >= 0) {
    const sf = straightHigh(suitMask[flushSuit]);
    if (sf >= 0) return score(Cat.StraightFlush, sf);
  }

  let quad = -1;
  const trips: number[] = [];
  const pairs: number[] = [];
  for (let r = 12; r >= 0; r--) {
    if (counts[r] === 4) quad = r;
    else if (counts[r] === 3) trips.push(r);
    else if (counts[r] === 2) pairs.push(r);
  }

  // 2. Quads
  if (quad >= 0) {
    const kicker = topN(rankMask & ~(1 << quad), 1)[0];
    return score(Cat.Quads, quad, kicker);
  }

  // 3. Full house — must precede the flush check.
  if (trips.length > 0 && (trips.length > 1 || pairs.length > 0)) {
    const t = trips[0];
    const p = Math.max(trips.length > 1 ? trips[1] : -1, pairs.length > 0 ? pairs[0] : -1);
    return score(Cat.FullHouse, t, p);
  }

  // 4. Flush
  if (flushSuit >= 0) {
    const t = topN(suitMask[flushSuit], 5);
    return score(Cat.Flush, t[0], t[1], t[2], t[3], t[4]);
  }

  // 5. Straight
  const st = straightHigh(rankMask);
  if (st >= 0) return score(Cat.Straight, st);

  // 6. Trips
  if (trips.length === 1) {
    const k = topN(rankMask & ~(1 << trips[0]), 2);
    return score(Cat.Trips, trips[0], k[0], k[1]);
  }

  // 7. Two pair
  if (pairs.length >= 2) {
    const [p1, p2] = pairs;
    const k = topN(rankMask & ~(1 << p1) & ~(1 << p2), 1)[0];
    return score(Cat.TwoPair, p1, p2, k);
  }

  // 8. Pair
  if (pairs.length === 1) {
    const k = topN(rankMask & ~(1 << pairs[0]), 3);
    return score(Cat.Pair, pairs[0], k[0], k[1], k[2]);
  }

  // 9. High card
  const k = topN(rankMask, 5);
  return score(Cat.HighCard, k[0], k[1], k[2], k[3], k[4]);
}
