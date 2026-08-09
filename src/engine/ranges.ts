import { Card, RANKS, makeCard, rankOf, suitOf } from './cards';

export type Combo = [Card, Card];

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
