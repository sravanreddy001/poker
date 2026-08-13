import { Card, RANKS, makeCard, rankOf, suitOf } from './cards';

export type Combo = [Card, Card];

export type HandTier = 'premium' | 'strong' | 'speculative' | 'marginal' | 'trash';

export interface Range {
  combos: Combo[];
}

export function canonicalName(a: Card, b: Card): string {
  const [hi, lo] = rankOf(a) >= rankOf(b) ? [a, b] : [b, a];
  const hr = RANKS[rankOf(hi)];
  const lr = RANKS[rankOf(lo)];
  if (rankOf(hi) === rankOf(lo)) return hr + lr;
  return hr + lr + (suitOf(hi) === suitOf(lo) ? 's' : 'o');
}

export function combosOf(name: string): Combo[] {
  const hi = RANKS.indexOf(name[0]);
  const lo = RANKS.indexOf(name[1]);
  const out: Combo[] = [];
  if (hi === lo) {
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = s1 + 1; s2 < 4; s2++) out.push([makeCard(hi, s1), makeCard(lo, s2)]);
    }
    return out;
  }
  const suited = name[2] === 's';
  for (let s1 = 0; s1 < 4; s1++) {
    for (let s2 = 0; s2 < 4; s2++) {
      if (suited ? s1 === s2 : s1 !== s2) out.push([makeCard(hi, s1), makeCard(lo, s2)]);
    }
  }
  return out;
}

/** Heuristic preflop strength — high-card weight, pair bonus, suited and connected bonuses. */
function strength(name: string): number {
  const hi = RANKS.indexOf(name[0]);
  const lo = RANKS.indexOf(name[1]);
  if (hi === lo) return 100 + hi * 10;
  const gap = hi - lo;
  const suited = name[2] === 's';
  let s = hi * 4 + lo * 2;
  s -= Math.max(0, gap - 1) * 3; // gaps hurt
  if (suited) s += 12; // suitedness is worth roughly a rank
  if (hi === 12) s += 6; // ace-high playability
  return s;
}

export const HAND_ORDER: string[] = (() => {
  const names: string[] = [];
  for (let hi = 12; hi >= 0; hi--) {
    for (let lo = hi; lo >= 0; lo--) {
      if (hi === lo) names.push(RANKS[hi] + RANKS[lo]);
      else {
        names.push(RANKS[hi] + RANKS[lo] + 's');
        names.push(RANKS[hi] + RANKS[lo] + 'o');
      }
    }
  }
  return names.sort((a, b) => strength(b) - strength(a));
})();

export function rangeTopPercent(pct: number): Range {
  const target = Math.round(1326 * Math.max(0, Math.min(1, pct)));
  const combos: Combo[] = [];
  for (const name of HAND_ORDER) {
    if (combos.length >= target) break;
    combos.push(...combosOf(name));
  }
  return { combos };
}

export function removeDead(r: Range, dead: Card[]): Range {
  const blocked = new Set(dead);
  return { combos: r.combos.filter(([a, b]) => !blocked.has(a) && !blocked.has(b)) };
}

/**
 * Preflop tier by membership in top-N% opening ranges.
 * Boundaries: premium ≤ 3%, strong ≤ 10%, speculative ≤ 20%, marginal ≤ 35%, else trash.
 */
export interface HandShape {
  /** Canonical name, e.g. "94o". */
  name: string;
  /** 1 = best starting hand. */
  rank: number;
  /** Always 169 — every distinct starting hand. */
  of: number;
  /** Why the hand sits where it does, in the terms a player uses at the table. */
  reasons: string[];
  /** The hands ranked immediately above this one, strongest first. */
  better: string[];
  /** The hands ranked immediately below this one. */
  worse: string[];
}

/**
 * How many neighbours either side of the hand the chip panel shows. Seeing the
 * same handful of hands on either side of yours, hand after hand, is how the
 * starting-hand chart gets learned without sitting down to memorise it.
 */
const NEIGHBOUR_SPAN = 4;

/**
 * The reasons behind a hand's tier. A label like "Trash" only teaches once;
 * the properties that produced it — pair, suits, connectedness, high cards —
 * are what a player can look for on the next hand.
 */
export function handShape(combo: Combo): HandShape {
  const name = canonicalName(combo[0], combo[1]);
  const hi = Math.max(rankOf(combo[0]), rankOf(combo[1]));
  const lo = Math.min(rankOf(combo[0]), rankOf(combo[1]));
  const suited = suitOf(combo[0]) === suitOf(combo[1]);
  const gap = hi - lo - 1;
  const reasons: string[] = [];

  if (hi === lo) {
    reasons.push('Pocket pair — already made, and flops a set about 1 in 8 times.');
  } else {
    reasons.push(
      suited
        ? 'Suited — a flush draw is live.'
        : 'Offsuit — no flush to draw to.',
    );
    if (gap === 0) reasons.push('Connected — straights come from both ends.');
    else if (gap <= 2) reasons.push(`${gap}-gapper — a straight needs the gap filled.`);
    else reasons.push('Disconnected — no straight without running cards.');

    // Ten and above: the cards that make top pair worth playing for.
    const broadway = [hi, lo].filter((r) => r >= 8).length;
    reasons.push(
      broadway === 2
        ? 'Two Broadway cards — top pair here is usually the best pair.'
        : broadway === 1
          ? 'One Broadway card — the other card pairs into second best.'
          : 'No Broadway card — pairing it still loses to a bigger pair.',
    );
  }

  const index = HAND_ORDER.indexOf(name);
  return {
    name,
    rank: index + 1,
    of: HAND_ORDER.length,
    reasons,
    better: HAND_ORDER.slice(Math.max(0, index - NEIGHBOUR_SPAN), index),
    worse: HAND_ORDER.slice(index + 1, index + 1 + NEIGHBOUR_SPAN),
  };
}

export function tierOf(combo: Combo): { tier: HandTier; label: string; topPct: number } {
  const name = canonicalName(combo[0], combo[1]);

  // Test membership in increasing range sizes
  const boundaries = [
    { pct: 0.03, tier: 'premium' as HandTier, label: 'Premium (Top 3%)', topPct: 3 },
    { pct: 0.1, tier: 'strong' as HandTier, label: 'Strong (Top 10%)', topPct: 10 },
    { pct: 0.2, tier: 'speculative' as HandTier, label: 'Speculative (Top 20%)', topPct: 20 },
    { pct: 0.35, tier: 'marginal' as HandTier, label: 'Marginal (Top 35%)', topPct: 35 },
  ];

  for (const { pct, tier, label, topPct } of boundaries) {
    const range = rangeTopPercent(pct);
    if (range.combos.some(([a, b]) => canonicalName(a, b) === name)) {
      return { tier, label, topPct };
    }
  }

  return { tier: 'trash', label: 'Trash (Below 35%)', topPct: 100 };
}
