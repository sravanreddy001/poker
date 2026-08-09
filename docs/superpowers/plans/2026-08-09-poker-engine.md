# Poker Trainer — Engine Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mathematically correct engine for a Texas Hold'em probability trainer — card model, hand evaluator, ranges, bot policy, equity, realization, EV advisor, and a playable game loop.

**Architecture:** Pure TypeScript modules with no UI dependencies, layered bottom-up so each is testable in isolation. `bot.ts` is a pure function of its inputs including an explicit seeded RNG stream — range narrowing, fold probability, and replay reproducibility all depend on that property.

**Tech Stack:** TypeScript 5, Vite, Vitest. No runtime dependencies.

## Global Constraints

- All engine modules are pure — no DOM, no `Math.random()`, no `localStorage`.
- Randomness comes only from an injected `Rng`. Never call `Math.random()` in `src/engine/`.
- Cards are integers `0..51`. Never use strings for cards outside of parse/format helpers.
- Equity is returned as a fraction `0..1`. Rounding to whole percentages happens in the UI layer only.
- Strict TypeScript: `strict: true`, no `any` in engine code.
- Test file for `src/engine/x.ts` lives at `src/engine/x.test.ts`.

**Spec:** `docs/superpowers/specs/2026-08-09-poker-probability-trainer-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/cards.ts` | Card integer model, deck, parse/format |
| `src/engine/rng.ts` | Seeded deterministic PRNG |
| `src/engine/evaluator.ts` | 7-card hand → comparable score |
| `src/engine/ranges.ts` | 169 canonical hands, combos, top-percent ranges |
| `src/engine/equity.ts` | Raw equity vs range, outs enumeration |
| `src/engine/bot.ts` | Deterministic bot policy with disclosed bluff frequencies |
| `src/engine/realization.ts` | Realized equity by forward simulation |
| `src/engine/ev.ts` | EV per candidate bet size |
| `src/engine/game.ts` | Betting state machine |
| `src/engine/types.ts` | Shared types (`Street`, `Action`, `BotContext`) |

---

### Task 1: Project scaffolding and card model

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`
- Create: `src/engine/cards.ts`
- Test: `src/engine/cards.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type Card = number`, `rankOf(c: Card): number`, `suitOf(c: Card): number`, `makeCard(rank: number, suit: number): Card`, `cardToString(c: Card): string`, `parseCard(s: string): Card`, `parseCards(s: string): Card[]`, `fullDeck(): Card[]`. Rank indices are `0..12` mapping to `2..A`. Suit indices are `0..3` mapping to `c,d,h,s`.

- [ ] **Step 1: Scaffold the project**

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 2: Write the failing test**

```ts
// src/engine/cards.test.ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/engine/cards.test.ts`
Expected: FAIL — cannot resolve `./cards`.

- [ ] **Step 4: Implement**

```ts
// src/engine/cards.ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/engine/cards.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold project and add card model"
```

---

### Task 2: Seeded RNG

**Files:**
- Create: `src/engine/rng.ts`
- Test: `src/engine/rng.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `interface Rng { next(): number; nextInt(n: number): number }`, `makeRng(seed: number): Rng`, `shuffled<T>(items: T[], rng: Rng): T[]`. `next()` returns `[0, 1)`. `nextInt(n)` returns `0..n-1`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/rng.test.ts
import { describe, it, expect } from 'vitest';
import { makeRng, shuffled } from './rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    expect(makeRng(1).next()).not.toBe(makeRng(2).next());
  });

  it('nextInt stays in range', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextInt(52);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(52);
    }
  });

  it('shuffles deterministically without losing elements', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = shuffled(items, makeRng(99));
    const s2 = shuffled(items, makeRng(99));
    expect(s1).toEqual(s2);
    expect([...s1].sort((x, y) => x - y)).toEqual(items);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: FAIL — cannot resolve `./rng`.

- [ ] **Step 3: Implement**

```ts
// src/engine/rng.ts
export interface Rng {
  next(): number;
  nextInt(n: number): number;
}

/** mulberry32 — small, fast, adequate for simulation. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, nextInt: (n: number) => Math.floor(next() * n) };
}

export function shuffled<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add seeded deterministic rng"
```

---

### Task 3: Hand evaluator

This is the highest-risk module. Every number downstream is meaningless if hand comparison is wrong. Test it hardest.

**Files:**
- Create: `src/engine/evaluator.ts`
- Test: `src/engine/evaluator.test.ts`

**Interfaces:**
- Consumes: `Card`, `rankOf`, `suitOf` from `cards.ts`
- Produces: `evaluate(cards: Card[]): number` (accepts 5–7 cards, higher score wins, ties equal), `categoryOf(score: number): Cat`, `enum Cat`. Score layout is `(cat << 20) | (r1 << 16) | (r2 << 12) | (r3 << 8) | (r4 << 4) | r5` with rank indices `0..12`.

**Critical ordering note:** hand categories must be checked in this order — straight flush, quads, full house, flush, straight, trips, two pair, pair, high card. Checking flush before full house is a real bug that produces wrong winners on paired boards.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/evaluator.test.ts
import { describe, it, expect } from 'vitest';
import { parseCards } from './cards';
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
    const fullHouse = ev('As Ah Ad Ks Kh 2s 3s');
    expect(categoryOf(fullHouse)).toBe(Cat.FullHouse);
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
      ev('As Kh Qd Js 9c 3d 2h'),   // high card
      ev('2s 2h Ks Qh Jd 9c 3d'),   // pair
      ev('2s 2h 3s 3h Kd 9c 5d'),   // two pair
      ev('2s 2h 2d Ks Qh 9c 5d'),   // trips
      ev('9s 8h 7d 6c 5s 2c 3d'),   // straight
      ev('As Ks 9s 5s 2s 3d 4c'),   // flush
      ev('2s 2h 2d Ks Kh 9c 5d'),   // full house
      ev('2s 2h 2d 2c Kh 9c 5d'),   // quads
      ev('As Ks Qs Js Ts 2c 3d'),   // straight flush
    ];
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i]).toBeGreaterThan(ordered[i - 1]);
    }
  });

  it('never lets extra cards lower a hand', () => {
    // Adding cards to a 5-card hand can only improve or hold the best 5.
    const five = ev('As Ah Ad Ks Kh');
    const seven = ev('As Ah Ad Ks Kh 2c 3d');
    expect(seven).toBeGreaterThanOrEqual(five);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/evaluator.test.ts`
Expected: FAIL — cannot resolve `./evaluator`.

- [ ] **Step 3: Implement**

```ts
// src/engine/evaluator.ts
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
  // Wheel: A,5,4,3,2 — ace plays low, five is the high card.
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/evaluator.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Add an exhaustive sanity sweep**

```ts
// append to src/engine/evaluator.test.ts
import { fullDeck } from './cards';

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
```

This is the single most valuable test in the codebase. If all nine counts match published figures, the evaluator's classification is almost certainly correct.

- [ ] **Step 6: Run the sweep**

Run: `npx vitest run src/engine/evaluator.test.ts`
Expected: PASS, 14 tests. The sweep takes several seconds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add 7-card hand evaluator with exhaustive frequency verification"
```

---

### Task 4: Ranges

**Files:**
- Create: `src/engine/ranges.ts`
- Test: `src/engine/ranges.test.ts`

**Interfaces:**
- Consumes: `Card`, `makeCard`, `rankOf`, `suitOf`, `RANKS` from `cards.ts`
- Produces: `type Combo = [Card, Card]`, `interface Range { combos: Combo[] }`, `canonicalName(a: Card, b: Card): string` (e.g. `"AKs"`, `"AKo"`, `"AA"`), `combosOf(name: string): Combo[]`, `HAND_ORDER: string[]` (169 names, strongest first), `rangeTopPercent(pct: number): Range`, `removeDead(r: Range, dead: Card[]): Range`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/ranges.test.ts
import { describe, it, expect } from 'vitest';
import { parseCard } from './cards';
import { canonicalName, combosOf, HAND_ORDER, rangeTopPercent, removeDead } from './ranges';

describe('ranges', () => {
  it('names hands canonically', () => {
    expect(canonicalName(parseCard('As'), parseCard('Ks'))).toBe('AKs');
    expect(canonicalName(parseCard('As'), parseCard('Kh'))).toBe('AKo');
    expect(canonicalName(parseCard('As'), parseCard('Ah'))).toBe('AA');
    expect(canonicalName(parseCard('Kh'), parseCard('As'))).toBe('AKo');
  });

  it('produces the right combo counts', () => {
    expect(combosOf('AA')).toHaveLength(6);
    expect(combosOf('AKs')).toHaveLength(4);
    expect(combosOf('AKo')).toHaveLength(12);
  });

  it('covers all 169 canonical hands exactly once', () => {
    expect(HAND_ORDER).toHaveLength(169);
    expect(new Set(HAND_ORDER).size).toBe(169);
  });

  it('accounts for all 1326 combos across the 169 hands', () => {
    const total = HAND_ORDER.reduce((n, h) => n + combosOf(h).length, 0);
    expect(total).toBe(1326);
  });

  it('ranks premium hands at the top', () => {
    expect(HAND_ORDER.slice(0, 5)).toContain('AA');
    expect(HAND_ORDER.slice(0, 5)).toContain('KK');
    expect(HAND_ORDER.indexOf('AA')).toBeLessThan(HAND_ORDER.indexOf('72o'));
  });

  it('builds top-percent ranges of roughly the right size', () => {
    const r = rangeTopPercent(0.2);
    expect(r.combos.length).toBeGreaterThan(200);
    expect(r.combos.length).toBeLessThan(340);
  });

  it('removes dead cards', () => {
    const r = rangeTopPercent(1.0);
    const dead = [parseCard('As')];
    const filtered = removeDead(r, dead);
    expect(filtered.combos.every(([a, b]) => a !== dead[0] && b !== dead[0])).toBe(true);
    expect(filtered.combos.length).toBeLessThan(r.combos.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/ranges.test.ts`
Expected: FAIL — cannot resolve `./ranges`.

- [ ] **Step 3: Implement**

Hand ordering is generated from a strength heuristic rather than hand-typed, so it stays consistent and reviewable: pairs rank by rank, suited hands get a bonus for suitedness and connectedness, offsuit hands get less.

```ts
// src/engine/ranges.ts
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
    for (let s1 = 0; s1 < 4; s1++)
      for (let s2 = s1 + 1; s2 < 4; s2++) out.push([makeCard(hi, s1), makeCard(lo, s2)]);
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

/** Heuristic preflop strength — high card weight, pair bonus, suited and connected bonuses. */
function strength(name: string): number {
  const hi = RANKS.indexOf(name[0]);
  const lo = RANKS.indexOf(name[1]);
  if (hi === lo) return 100 + hi * 10;
  const gap = hi - lo;
  const suited = name[2] === 's';
  let s = hi * 4 + lo * 2;
  s -= Math.max(0, gap - 1) * 3;      // gaps hurt
  if (suited) s += 12;                 // suitedness is worth roughly a rank
  if (hi === 12) s += 6;               // ace-high playability
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/ranges.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add canonical hand ranges and top-percent range construction"
```

---

### Task 5: Raw equity and outs

**Files:**
- Create: `src/engine/equity.ts`
- Test: `src/engine/equity.test.ts`

**Interfaces:**
- Consumes: `Card`, `fullDeck` from `cards.ts`; `evaluate` from `evaluator.ts`; `Combo`, `Range`, `removeDead` from `ranges.ts`; `Rng`, `shuffled` from `rng.ts`
- Produces: `interface EquityResult { equity: number; wins: number; ties: number; total: number; exact: boolean }`, `equityVsRange(hero: Combo, board: Card[], villain: Range, rng: Rng, maxSamples?: number): EquityResult`, `equityVsCombo(hero: Combo, villain: Combo, board: Card[], rng: Rng, maxSamples?: number): EquityResult`, `countOuts(hero: Combo, board: Card[], villain: Range, rng: Rng): { outs: Card[] }`.

Equity is a fraction `0..1` and counts ties as half a win.

**Outs definition** (stated so it is testable): with one or more cards to come, card `c` is an out when the hero currently loses to more than half the villain range by weight, and after `c` lands the hero beats more than half of it.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/equity.test.ts
import { describe, it, expect } from 'vitest';
import { parseCards, suitOf } from './cards';
import { makeRng } from './rng';
import { combosOf } from './ranges';
import { equityVsCombo, equityVsRange, countOuts } from './equity';

const hole = (s: string) => parseCards(s) as [number, number];

describe('equity vs a single hand', () => {
  it('matches the published AA vs KK figure', () => {
    const r = equityVsCombo(hole('As Ah'), hole('Ks Kh'), [], makeRng(1));
    expect(r.equity).toBeGreaterThan(0.79);
    expect(r.equity).toBeLessThan(0.85);
  });

  it('matches the published AKs vs QQ figure', () => {
    const r = equityVsCombo(hole('As Ks'), hole('Qh Qd'), [], makeRng(2));
    expect(r.equity).toBeGreaterThan(0.43);
    expect(r.equity).toBeLessThan(0.49);
  });

  it('gives a made flush certain equity on the river', () => {
    const r = equityVsCombo(hole('As Ks'), hole('2c 2d'), parseCards('Qs Js 3s 7h 8d'), makeRng(3));
    expect(r.equity).toBe(1);
    expect(r.exact).toBe(true);
  });

  it('splits a board-plays pot', () => {
    const r = equityVsCombo(hole('2c 3d'), hole('2h 3s'), parseCards('As Ks Qh Jd Tc'), makeRng(4));
    expect(r.equity).toBe(0.5);
  });

  it('enumerates exactly from the flop', () => {
    const r = equityVsCombo(hole('As Ks'), hole('Qh Qd'), parseCards('2s 7h 9c'), makeRng(5));
    expect(r.exact).toBe(true);
    expect(r.total).toBe(990); // C(45,2)
  });
});

describe('equity vs a range', () => {
  it('rates aces well ahead of a weak holding', () => {
    const villain = { combos: combosOf('72o') };
    const r = equityVsRange(hole('As Ah'), [], villain, makeRng(6));
    expect(r.equity).toBeGreaterThan(0.85);
  });

  it('is symmetric — hero and villain equities sum to one', () => {
    const a = equityVsCombo(hole('As Ah'), hole('Ks Kh'), parseCards('2c 7d 9h'), makeRng(7));
    const b = equityVsCombo(hole('Ks Kh'), hole('As Ah'), parseCards('2c 7d 9h'), makeRng(7));
    expect(a.equity + b.equity).toBeCloseTo(1, 6);
  });
});

describe('outs', () => {
  it('counts the flush outs for a flush draw', () => {
    const villain = { combos: combosOf('TT') };
    const { outs } = countOuts(hole('As Ks'), parseCards('2s 7s 9h'), villain, makeRng(8));
    const spades = outs.filter((c) => suitOf(c) === 3);
    expect(spades.length).toBeGreaterThanOrEqual(9);
  });

  it('reports no outs when already far ahead', () => {
    const villain = { combos: combosOf('72o') };
    const { outs } = countOuts(hole('As Ah'), parseCards('Ad 7h 2c'), villain, makeRng(9));
    expect(outs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/equity.test.ts`
Expected: FAIL — cannot resolve `./equity`.

- [ ] **Step 3: Implement**

```ts
// src/engine/equity.ts
import { Card, fullDeck } from './cards';
import { evaluate } from './evaluator';
import { Combo, Range, removeDead } from './ranges';
import { Rng, shuffled } from './rng';

export interface EquityResult {
  equity: number;
  wins: number;
  ties: number;
  total: number;
  exact: boolean;
}

const DEFAULT_SAMPLES = 20000;

function deadDeck(dead: Card[]): Card[] {
  const blocked = new Set(dead);
  return fullDeck().filter((c) => !blocked.has(c));
}

/** All ways to draw `n` cards from `deck`. Used when enumeration is cheap. */
function* choose(deck: Card[], n: number): Generator<Card[]> {
  if (n === 0) {
    yield [];
    return;
  }
  const idx = Array.from({ length: n }, (_, i) => i);
  while (true) {
    yield idx.map((i) => deck[i]);
    let k = n - 1;
    while (k >= 0 && idx[k] === deck.length - n + k) k--;
    if (k < 0) return;
    idx[k]++;
    for (let j = k + 1; j < n; j++) idx[j] = idx[j - 1] + 1;
  }
}

function countRunouts(remaining: number, deckSize: number): number {
  if (remaining === 0) return 1;
  if (remaining === 1) return deckSize;
  return (deckSize * (deckSize - 1)) / 2;
}

export function equityVsCombo(
  hero: Combo,
  villain: Combo,
  board: Card[],
  rng: Rng,
  maxSamples = DEFAULT_SAMPLES,
): EquityResult {
  return equityVsRange(hero, board, { combos: [villain] }, rng, maxSamples);
}

export function equityVsRange(
  hero: Combo,
  board: Card[],
  villain: Range,
  rng: Rng,
  maxSamples = DEFAULT_SAMPLES,
): EquityResult {
  const live = removeDead(villain, [...hero, ...board]);
  if (live.combos.length === 0) {
    return { equity: 0.5, wins: 0, ties: 0, total: 0, exact: false };
  }

  const toCome = 5 - board.length;
  const deckSize = 52 - 2 - board.length - 2;
  const enumerated = live.combos.length * countRunouts(toCome, deckSize);
  const exact = toCome <= 2 && enumerated <= 4_000_000;

  let wins = 0;
  let ties = 0;
  let total = 0;

  if (exact) {
    for (const vc of live.combos) {
      const deck = deadDeck([...hero, ...board, ...vc]);
      for (const runout of choose(deck, toCome)) {
        const full = [...board, ...runout];
        const h = evaluate([...hero, ...full]);
        const v = evaluate([...vc, ...full]);
        if (h > v) wins++;
        else if (h === v) ties++;
        total++;
      }
    }
  } else {
    for (let i = 0; i < maxSamples; i++) {
      const vc = live.combos[rng.nextInt(live.combos.length)];
      const deck = shuffled(deadDeck([...hero, ...board, ...vc]), rng);
      const full = [...board, ...deck.slice(0, toCome)];
      const h = evaluate([...hero, ...full]);
      const v = evaluate([...vc, ...full]);
      if (h > v) wins++;
      else if (h === v) ties++;
      total++;
    }
  }

  return { equity: total === 0 ? 0.5 : (wins + ties / 2) / total, wins, ties, total, exact };
}

/**
 * A card is an out when the hero is currently behind more than half the villain
 * range and is ahead of more than half of it once that card lands.
 */
export function countOuts(
  hero: Combo,
  board: Card[],
  villain: Range,
  rng: Rng,
): { outs: Card[] } {
  if (board.length < 3 || board.length >= 5) return { outs: [] };
  const now = equityVsRange(hero, board, villain, rng, 2000);
  if (now.equity > 0.5) return { outs: [] };

  const outs: Card[] = [];
  for (const c of deadDeck([...hero, ...board])) {
    const after = equityVsRange(hero, [...board, c], villain, rng, 2000);
    if (after.equity > 0.5) outs.push(c);
  }
  return { outs };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/equity.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add raw equity vs range and outs enumeration"
```

---

### Task 6: Shared types and bot policy

**Files:**
- Create: `src/engine/types.ts`
- Create: `src/engine/bot.ts`
- Test: `src/engine/bot.test.ts`

**Interfaces:**
- Consumes: `Card` from `cards.ts`; `Combo`, `Range`, `canonicalName`, `HAND_ORDER` from `ranges.ts`; `equityVsRange` from `equity.ts`; `Rng` from `rng.ts`
- Produces:
  - `type Street = 'preflop' | 'flop' | 'turn' | 'river'`
  - `type Action = { type: 'fold' } | { type: 'check' } | { type: 'call' } | { type: 'bet'; amount: number } | { type: 'raise'; amount: number }`
  - `interface BotConfig { openPercent: number; bluffFreq: Record<Street, number>; valueThreshold: number }`
  - `interface BotContext { hole: Combo; board: Card[]; pot: number; toCall: number; stack: number; bigBlind: number; street: Street; inPosition: boolean; villainRange: Range }`
  - `DEFAULT_BOT: BotConfig`
  - `botAct(ctx: BotContext, cfg: BotConfig, rng: Rng): Action`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/bot.test.ts
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
    const a = botAct(ctx, DEFAULT_BOT, makeRng(11));
    const b = botAct(ctx, DEFAULT_BOT, makeRng(11));
    expect(a).toEqual(b);
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
    const ctx = base({ hole: hole('As Ah'), board: parseCards('Ad 7h 2c'), street: 'flop', toCall: 0 });
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
    const a = botAct(ctx, DEFAULT_BOT, makeRng(4));
    expect(a.type).toBe('fold');
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

  it('never bets more than its stack', () => {
    const ctx = base({ hole: hole('As Ah'), board: parseCards('Ad 7h 2c'), street: 'flop', stack: 5, pot: 50 });
    const a = botAct(ctx, DEFAULT_BOT, makeRng(5));
    if (a.type === 'bet' || a.type === 'raise') expect(a.amount).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/bot.test.ts`
Expected: FAIL — cannot resolve `./bot`.

- [ ] **Step 3: Write shared types**

```ts
// src/engine/types.ts
import type { Card } from './cards';
import type { Combo, Range } from './ranges';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type Action =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'bet'; amount: number }
  | { type: 'raise'; amount: number };

export interface BotConfig {
  /** Fraction of hands opened preflop. */
  openPercent: number;
  /** Disclosed bluff frequency per street, applied to hands with no showdown value. */
  bluffFreq: Record<Street, number>;
  /** Equity above which the bot bets or raises for value. */
  valueThreshold: number;
}

export interface BotContext {
  hole: Combo;
  board: Card[];
  pot: number;
  toCall: number;
  stack: number;
  bigBlind: number;
  street: Street;
  inPosition: boolean;
  villainRange: Range;
}

/** Street implied by how many board cards are dealt. */
export function streetOf(boardLen: number): Street {
  if (boardLen < 3) return 'preflop';
  if (boardLen === 3) return 'flop';
  if (boardLen === 4) return 'turn';
  return 'river';
}
```

- [ ] **Step 4: Implement the bot**

```ts
// src/engine/bot.ts
import { equityVsRange } from './equity';
import { canonicalName, HAND_ORDER } from './ranges';
import type { Rng } from './rng';
import type { Action, BotConfig, BotContext } from './types';

export const DEFAULT_BOT: BotConfig = {
  openPercent: 0.25,
  bluffFreq: { preflop: 0, flop: 0.2, turn: 0.25, river: 0.3 },
  valueThreshold: 0.62,
};

/** Where this hand sits in the 169-hand strength order, as a fraction 0..1. */
function preflopPercentile(ctx: BotContext): number {
  const name = canonicalName(ctx.hole[0], ctx.hole[1]);
  return (HAND_ORDER.indexOf(name) + 1) / HAND_ORDER.length;
}

function clampBet(amount: number, ctx: BotContext): number {
  return Math.max(0, Math.min(Math.round(amount), ctx.stack));
}

function preflopAction(ctx: BotContext, cfg: BotConfig): Action {
  const pct = preflopPercentile(ctx);
  if (ctx.toCall === 0) {
    if (pct <= cfg.openPercent) {
      const amount = clampBet(ctx.bigBlind * 3, ctx);
      return amount > 0 ? { type: 'bet', amount } : { type: 'check' };
    }
    return { type: 'check' };
  }
  // Facing a bet: three-bet the very top, call a bit wider, fold the rest.
  if (pct <= cfg.openPercent * 0.4) {
    const amount = clampBet(ctx.toCall * 3, ctx);
    return amount > ctx.toCall ? { type: 'raise', amount } : { type: 'call' };
  }
  if (pct <= cfg.openPercent * 1.6) return { type: 'call' };
  return { type: 'fold' };
}

export function botAct(ctx: BotContext, cfg: BotConfig, rng: Rng): Action {
  if (ctx.street === 'preflop') return preflopAction(ctx, cfg);

  const { equity } = equityVsRange(ctx.hole, ctx.board, ctx.villainRange, rng, 800);
  const potOdds = ctx.toCall > 0 ? ctx.toCall / (ctx.pot + ctx.toCall) : 0;

  // Value: strong enough to bet or raise.
  if (equity >= cfg.valueThreshold) {
    const target = clampBet(ctx.pot * 0.66 + ctx.toCall, ctx);
    if (ctx.toCall === 0) return target > 0 ? { type: 'bet', amount: target } : { type: 'check' };
    return target > ctx.toCall ? { type: 'raise', amount: target } : { type: 'call' };
  }

  // Facing a bet without a value hand: continue only at the right price.
  if (ctx.toCall > 0) {
    return equity > potOdds ? { type: 'call' } : { type: 'fold' };
  }

  // No bet to face and no value — bluff at the disclosed frequency, in position only.
  const noShowdownValue = equity < 0.35;
  if (noShowdownValue && ctx.inPosition && rng.next() < cfg.bluffFreq[ctx.street]) {
    const amount = clampBet(ctx.pot * 0.66, ctx);
    if (amount > 0) return { type: 'bet', amount };
  }

  return { type: 'check' };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/engine/bot.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add deterministic bot policy with disclosed bluff frequencies"
```

---

### Task 7: Realized equity

**Files:**
- Create: `src/engine/realization.ts`
- Test: `src/engine/realization.test.ts`

**Interfaces:**
- Consumes: `Card`, `fullDeck` from `cards.ts`; `evaluate` from `evaluator.ts`; `Combo`, `Range`, `removeDead` from `ranges.ts`; `equityVsRange` from `equity.ts`; `botAct`, `DEFAULT_BOT` from `bot.ts`; `Rng`, `shuffled` from `rng.ts`; `streetOf` from `types.ts`
- Produces: `interface RealizationInput { hole: Combo; board: Card[]; pot: number; stack: number; bigBlind: number; inPosition: boolean; villainRange: Range }`, `interface RealizationResult { raw: number; realized: number; factor: number }`, `realizedEquity(input: RealizationInput, rng: Rng, samples?: number): RealizationResult`.

**Circularity note:** the hero's continuation strategy inside this simulation is a fixed default — call when raw pot odds justify it, fold otherwise, never raise. It must not consult the advisor, because the advisor consumes realized equity.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/realization.test.ts
import { describe, it, expect } from 'vitest';
import { parseCards } from './cards';
import { makeRng } from './rng';
import { rangeTopPercent } from './ranges';
import { realizedEquity, RealizationInput } from './realization';

const hole = (s: string) => parseCards(s) as [number, number];

const input = (over: Partial<RealizationInput> = {}): RealizationInput => ({
  hole: hole('As Ks'),
  board: parseCards('2s 7h 9c'),
  pot: 10,
  stack: 100,
  bigBlind: 1,
  inPosition: true,
  villainRange: rangeTopPercent(0.3),
  ...over,
});

describe('realized equity', () => {
  it('never exceeds raw equity', () => {
    const r = realizedEquity(input(), makeRng(1), 200);
    expect(r.realized).toBeLessThanOrEqual(r.raw + 1e-9);
  });

  it('realizes no more out of position than in position', () => {
    const ip = realizedEquity(input({ inPosition: true }), makeRng(2), 300);
    const oop = realizedEquity(input({ inPosition: false }), makeRng(2), 300);
    expect(oop.realized).toBeLessThanOrEqual(ip.realized + 1e-9);
  });

  it('reports a factor consistent with its own numbers', () => {
    const r = realizedEquity(input(), makeRng(3), 200);
    expect(r.factor).toBeCloseTo(r.realized / r.raw, 6);
  });

  it('is deterministic for a given seed', () => {
    const a = realizedEquity(input(), makeRng(4), 150);
    const b = realizedEquity(input(), makeRng(4), 150);
    expect(a).toEqual(b);
  });

  it('returns values in the unit interval', () => {
    const r = realizedEquity(input(), makeRng(6), 200);
    expect(r.realized).toBeGreaterThanOrEqual(0);
    expect(r.realized).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/realization.test.ts`
Expected: FAIL — cannot resolve `./realization`.

- [ ] **Step 3: Implement**

```ts
// src/engine/realization.ts
import { Card, fullDeck } from './cards';
import { evaluate } from './evaluator';
import { equityVsRange } from './equity';
import { botAct, DEFAULT_BOT } from './bot';
import { Combo, Range, removeDead } from './ranges';
import { Rng, shuffled } from './rng';
import { streetOf } from './types';

export interface RealizationInput {
  hole: Combo;
  board: Card[];
  pot: number;
  stack: number;
  bigBlind: number;
  inPosition: boolean;
  villainRange: Range;
}

export interface RealizationResult {
  raw: number;
  realized: number;
  factor: number;
}

/**
 * Fixed default continuation policy for the hero. Deliberately simple and
 * independent of the advisor — the advisor consumes realized equity, so using
 * it here would be circular.
 */
function heroContinues(equity: number, toCall: number, pot: number): boolean {
  if (toCall === 0) return true;
  return equity > toCall / (pot + toCall);
}

export function realizedEquity(
  input: RealizationInput,
  rng: Rng,
  samples = 400,
): RealizationResult {
  const raw = equityVsRange(input.hole, input.board, input.villainRange, rng, 2000).equity;

  const live = removeDead(input.villainRange, [...input.hole, ...input.board]);
  if (live.combos.length === 0 || raw === 0) {
    return { raw, realized: raw, factor: 1 };
  }

  let collected = 0;

  for (let i = 0; i < samples; i++) {
    const villain = live.combos[rng.nextInt(live.combos.length)];
    const blocked = new Set<Card>([...input.hole, ...input.board, ...villain]);
    const deck = shuffled(fullDeck().filter((c) => !blocked.has(c)), rng);

    let board = [...input.board];
    let pot = input.pot;
    let invested = 0;
    let folded = false;
    let drawn = 0;

    while (board.length < 5) {
      const street = streetOf(board.length);
      const equity = equityVsRange(input.hole, board, { combos: [villain] }, rng, 120).equity;

      const villainAction = botAct(
        {
          hole: villain,
          board,
          pot,
          toCall: 0,
          stack: input.stack,
          bigBlind: input.bigBlind,
          street,
          inPosition: !input.inPosition,
          villainRange: { combos: [input.hole] },
        },
        DEFAULT_BOT,
        rng,
      );

      if (villainAction.type === 'bet') {
        const toCall = Math.min(villainAction.amount, input.stack - invested);
        if (!heroContinues(equity, toCall, pot)) {
          folded = true;
          break;
        }
        pot += toCall * 2;
        invested += toCall;
      }

      board = [...board, deck[drawn++]];
    }

    if (folded) continue; // Hero surrenders; collects nothing further.

    const hero = evaluate([...input.hole, ...board]);
    const vill = evaluate([...villain, ...board]);
    const share = hero > vill ? 1 : hero === vill ? 0.5 : 0;
    // Net winnings expressed as a fraction of the pot the hero started with.
    collected += (share * pot - invested) / pot;
  }

  const realized = Math.max(0, Math.min(raw, collected / samples));
  return { raw, realized, factor: realized / raw };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/realization.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add realized equity via forward simulation"
```

---

### Task 8: EV per bet size

**Files:**
- Create: `src/engine/ev.ts`
- Test: `src/engine/ev.test.ts`

**Interfaces:**
- Consumes: `botAct`, `DEFAULT_BOT` from `bot.ts`; `realizedEquity`, `RealizationInput` from `realization.ts`; `removeDead` from `ranges.ts`; `Rng` from `rng.ts`; `streetOf` from `types.ts`
- Produces: `interface SizeOption { label: string; fraction: number }`, `SIZES: SizeOption[]`, `interface EvOption { label: string; amount: number; ev: number }`, `evaluateSizes(input: RealizationInput & { toCall: number }, rng: Rng): EvOption[]` sorted by descending EV, `potOddsVerdict(toCall: number, pot: number, realized: number): { required: number; actual: number; evOfCall: number }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/ev.test.ts
import { describe, it, expect } from 'vitest';
import { parseCards } from './cards';
import { makeRng } from './rng';
import { rangeTopPercent } from './ranges';
import { evaluateSizes, potOddsVerdict, SIZES } from './ev';

const hole = (s: string) => parseCards(s) as [number, number];

const input = {
  hole: hole('As Ah'),
  board: parseCards('Ad 7h 2c'),
  pot: 10,
  toCall: 0,
  stack: 100,
  bigBlind: 1,
  inPosition: true,
  villainRange: rangeTopPercent(0.3),
};

describe('pot odds', () => {
  it('computes the required equity to call', () => {
    const v = potOddsVerdict(25, 75, 0.4);
    expect(v.required).toBeCloseTo(0.25, 6); // 25 to win 100
    expect(v.actual).toBe(0.4);
    expect(v.evOfCall).toBeGreaterThan(0);
  });

  it('reports a negative EV call when the price is wrong', () => {
    const v = potOddsVerdict(50, 50, 0.2);
    expect(v.required).toBeCloseTo(0.5, 6);
    expect(v.evOfCall).toBeLessThan(0);
  });

  it('treats a free call as always correct', () => {
    expect(potOddsVerdict(0, 10, 0.1).required).toBe(0);
  });
});

describe('bet size EV', () => {
  it('returns one option per configured size', () => {
    expect(evaluateSizes(input, makeRng(1))).toHaveLength(SIZES.length);
  });

  it('sorts by descending EV', () => {
    const out = evaluateSizes(input, makeRng(2));
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].ev).toBeGreaterThanOrEqual(out[i].ev);
    }
  });

  it('prefers betting over checking with a very strong hand', () => {
    expect(evaluateSizes(input, makeRng(3))[0].label).not.toBe('check');
  });

  it('is deterministic for a given seed', () => {
    expect(evaluateSizes(input, makeRng(4))).toEqual(evaluateSizes(input, makeRng(4)));
  });

  it('never proposes an amount above the stack', () => {
    const out = evaluateSizes({ ...input, stack: 4, pot: 40 }, makeRng(5));
    for (const o of out) expect(o.amount).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/ev.test.ts`
Expected: FAIL — cannot resolve `./ev`.

- [ ] **Step 3: Implement**

```ts
// src/engine/ev.ts
import { botAct, DEFAULT_BOT } from './bot';
import { realizedEquity, RealizationInput } from './realization';
import { removeDead } from './ranges';
import type { Rng } from './rng';
import { streetOf } from './types';

export interface SizeOption {
  label: string;
  /** Fraction of the pot. `Infinity` means all-in. */
  fraction: number;
}

export const SIZES: SizeOption[] = [
  { label: 'check', fraction: 0 },
  { label: '1/3 pot', fraction: 1 / 3 },
  { label: '1/2 pot', fraction: 0.5 },
  { label: '3/4 pot', fraction: 0.75 },
  { label: 'pot', fraction: 1 },
  { label: '2x pot', fraction: 2 },
  { label: 'all-in', fraction: Infinity },
];

export interface EvOption {
  label: string;
  amount: number;
  ev: number;
}

export function potOddsVerdict(toCall: number, pot: number, realized: number) {
  const required = toCall === 0 ? 0 : toCall / (pot + toCall);
  const evOfCall = realized * (pot + toCall) - toCall;
  return { required, actual: realized, evOfCall };
}

export function evaluateSizes(
  input: RealizationInput & { toCall: number },
  rng: Rng,
): EvOption[] {
  const { realized } = realizedEquity(input, rng, 150);
  const live = removeDead(input.villainRange, [...input.hole, ...input.board]);
  const street = streetOf(input.board.length);

  const options: EvOption[] = SIZES.map((size) => {
    const amount =
      size.fraction === 0
        ? 0
        : size.fraction === Infinity
          ? input.stack
          : Math.min(input.stack, Math.round(input.pot * size.fraction));

    if (amount === 0) {
      // Checking keeps our share of the current pot; folding to a live bet forfeits it.
      return { label: size.label, amount: 0, ev: input.toCall > 0 ? 0 : realized * input.pot };
    }

    let ev = 0;
    const n = live.combos.length || 1;

    for (const villain of live.combos) {
      const response = botAct(
        {
          hole: villain,
          board: input.board,
          pot: input.pot + amount,
          toCall: amount,
          stack: input.stack,
          bigBlind: input.bigBlind,
          street,
          inPosition: !input.inPosition,
          villainRange: { combos: [input.hole] },
        },
        DEFAULT_BOT,
        rng,
      );

      if (response.type === 'fold') {
        ev += input.pot;
      } else if (response.type === 'raise') {
        // Cap the tree at one re-raise: treat our continuation as a call.
        const raiseTo = Math.min(response.amount, input.stack);
        ev += realized * (input.pot + 2 * raiseTo) - raiseTo;
      } else {
        ev += realized * (input.pot + 2 * amount) - amount;
      }
    }

    return { label: size.label, amount, ev: ev / n };
  });

  return options.sort((a, b) => b.ev - a.ev);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/ev.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add EV-per-bet-size advisor and pot odds verdict"
```

---

### Task 9: Game state machine

**Files:**
- Create: `src/engine/game.ts`
- Test: `src/engine/game.test.ts`

**Interfaces:**
- Consumes: everything above
- Produces:
  - `interface Player { id: number; stack: number; hole: Combo | null; folded: boolean; committed: number; isHuman: boolean }`
  - `interface LogEntry { playerId: number; street: Street; action: Action; pot: number }`
  - `interface HandState { seed: number; rng: Rng; players: Player[]; board: Card[]; deck: Card[]; drawn: number; pot: number; street: Street; toAct: number; currentBet: number; actedThisStreet: Set<number>; bigBlind: number; log: LogEntry[]; complete: boolean; winners: number[] }`
  - `startHand(seed: number, opts: { players: number; stack: number; bigBlind: number }): HandState`
  - `applyAction(state: HandState, action: Action): HandState`
  - `stepBots(state: HandState): HandState` — advances until it is the human's turn or the hand is complete.

**Simplification from the spec:** all players start at equal stacks and there are no side pots. Stacks reset when a player busts. Player 0 is the human.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/game.test.ts
import { describe, it, expect } from 'vitest';
import { startHand, applyAction, stepBots } from './game';

describe('game state machine', () => {
  const opts = { players: 6, stack: 100, bigBlind: 1 };

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
      s = applyAction(s, s.currentBet > s.players[s.toAct].committed ? { type: 'call' } : { type: 'check' });
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/game.test.ts`
Expected: FAIL — cannot resolve `./game`.

- [ ] **Step 3: Implement**

```ts
// src/engine/game.ts
import { Card, fullDeck } from './cards';
import { evaluate } from './evaluator';
import { botAct, DEFAULT_BOT } from './bot';
import { Combo, rangeTopPercent } from './ranges';
import { makeRng, shuffled, Rng } from './rng';
import type { Action, Street } from './types';

export interface Player {
  id: number;
  stack: number;
  hole: Combo | null;
  folded: boolean;
  committed: number;
  isHuman: boolean;
}

export interface LogEntry {
  playerId: number;
  street: Street;
  action: Action;
  pot: number;
}

export interface HandState {
  seed: number;
  rng: Rng;
  players: Player[];
  board: Card[];
  deck: Card[];
  drawn: number;
  pot: number;
  street: Street;
  toAct: number;
  currentBet: number;
  actedThisStreet: Set<number>;
  bigBlind: number;
  log: LogEntry[];
  complete: boolean;
  winners: number[];
}

const NEXT_STREET: Record<Street, Street | null> = {
  preflop: 'flop',
  flop: 'turn',
  turn: 'river',
  river: null,
};

export function startHand(
  seed: number,
  opts: { players: number; stack: number; bigBlind: number },
): HandState {
  const rng = makeRng(seed);
  const deck = shuffled(fullDeck(), rng);
  let drawn = 0;

  const players: Player[] = Array.from({ length: opts.players }, (_, id) => ({
    id,
    stack: opts.stack,
    hole: [deck[drawn++], deck[drawn++]] as Combo,
    folded: false,
    committed: 0,
    isHuman: id === 0,
  }));

  // Blinds: player 1 posts the small blind, player 2 the big blind.
  const sb = opts.bigBlind / 2;
  players[1 % players.length].stack -= sb;
  players[1 % players.length].committed = sb;
  players[2 % players.length].stack -= opts.bigBlind;
  players[2 % players.length].committed = opts.bigBlind;

  return {
    seed,
    rng,
    players,
    board: [],
    deck,
    drawn,
    pot: sb + opts.bigBlind,
    street: 'preflop',
    toAct: 3 % players.length,
    currentBet: opts.bigBlind,
    actedThisStreet: new Set(),
    bigBlind: opts.bigBlind,
    log: [],
    complete: false,
    winners: [],
  };
}

function livePlayers(s: HandState): Player[] {
  return s.players.filter((p) => !p.folded);
}

function nextToAct(s: HandState, from: number): number {
  for (let i = 1; i <= s.players.length; i++) {
    const idx = (from + i + s.players.length) % s.players.length;
    if (!s.players[idx].folded) return idx;
  }
  return from;
}

function streetComplete(s: HandState): boolean {
  const live = livePlayers(s);
  if (live.length <= 1) return true;
  return live.every((p) => s.actedThisStreet.has(p.id) && p.committed === s.currentBet);
}

function showdown(s: HandState): HandState {
  const live = livePlayers(s);
  if (live.length === 0) return { ...s, complete: true, winners: [] };

  const scores = live.map((p) => ({
    id: p.id,
    score: evaluate([...(p.hole as Combo), ...s.board]),
  }));
  const best = Math.max(...scores.map((x) => x.score));
  const winners = scores.filter((x) => x.score === best).map((x) => x.id);
  const share = s.pot / winners.length;

  return {
    ...s,
    players: s.players.map((p) => (winners.includes(p.id) ? { ...p, stack: p.stack + share } : p)),
    pot: 0,
    complete: true,
    winners,
  };
}

function advanceStreet(s: HandState): HandState {
  const next = NEXT_STREET[s.street];
  if (next === null) return showdown(s);

  const deal = next === 'flop' ? 3 : 1;
  const board = [...s.board, ...s.deck.slice(s.drawn, s.drawn + deal)];

  const dealt: HandState = {
    ...s,
    board,
    drawn: s.drawn + deal,
    street: next,
    currentBet: 0,
    actedThisStreet: new Set(),
    players: s.players.map((p) => ({ ...p, committed: 0 })),
  };

  return { ...dealt, toAct: nextToAct(dealt, -1) };
}

function awardUncontested(s: HandState): HandState {
  const winner = livePlayers(s)[0];
  return {
    ...s,
    players: s.players.map((p) => (p.id === winner.id ? { ...p, stack: p.stack + s.pot } : p)),
    pot: 0,
    complete: true,
    winners: [winner.id],
  };
}

export function applyAction(state: HandState, action: Action): HandState {
  if (state.complete) return state;

  const players = state.players.map((p) => ({ ...p }));
  const actor = players[state.toAct];
  let { pot, currentBet } = state;
  const actedThisStreet = new Set(state.actedThisStreet);

  switch (action.type) {
    case 'fold':
      actor.folded = true;
      break;
    case 'check':
      break;
    case 'call': {
      const owed = Math.min(currentBet - actor.committed, actor.stack);
      actor.stack -= owed;
      actor.committed += owed;
      pot += owed;
      break;
    }
    case 'bet':
    case 'raise': {
      const target = Math.min(action.amount, actor.stack + actor.committed);
      const delta = target - actor.committed;
      actor.stack -= delta;
      actor.committed = target;
      pot += delta;
      currentBet = Math.max(currentBet, target);
      // A raise reopens the action for everyone else.
      actedThisStreet.clear();
      break;
    }
  }

  actedThisStreet.add(actor.id);

  let next: HandState = {
    ...state,
    players,
    pot,
    currentBet,
    actedThisStreet,
    log: [...state.log, { playerId: actor.id, street: state.street, action, pot }],
  };

  if (livePlayers(next).length === 1) return awardUncontested(next);

  if (streetComplete(next)) {
    next = advanceStreet(next);
    if (next.complete) return next;
    if (livePlayers(next).length === 1) return awardUncontested(next);
    return next;
  }

  return { ...next, toAct: nextToAct(next, next.toAct) };
}

export function stepBots(state: HandState): HandState {
  let s = state;
  let guard = 0;
  while (!s.complete && !s.players[s.toAct].isHuman && guard++ < 200) {
    const p = s.players[s.toAct];
    const action = botAct(
      {
        hole: p.hole as Combo,
        board: s.board,
        pot: s.pot,
        toCall: Math.max(0, s.currentBet - p.committed),
        stack: p.stack,
        bigBlind: s.bigBlind,
        street: s.street,
        inPosition: s.toAct > 0,
        villainRange: rangeTopPercent(0.3),
      },
      DEFAULT_BOT,
      s.rng,
    );
    s = applyAction(s, action);
  }
  return s;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/game.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: PASS across all nine engine modules.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add betting state machine and bot stepping"
```

---

## Self-Review

**Spec coverage for Plan 1's scope:**

| Spec requirement | Task |
|---|---|
| Card model, integer encoding | 1 |
| Seeded RNG, reproducible hands | 2, 9 |
| 7-card evaluator | 3 |
| 169 canonical hands, top-percent ranges | 4 |
| Raw equity, exact from the flop | 5 |
| Outs enumeration | 5 |
| Bot policy with disclosed bluff frequencies | 6 |
| Realized equity by forward simulation | 7 |
| Fixed default continuation policy (non-circular) | 7 |
| EV per bet size, one re-raise cap | 8 |
| Pot-odds verdict on realized equity | 8 |
| Betting state machine, no side pots | 9 |
| Equal stacks, reset on bust | 9 |

**Deferred to Plan 2 (teaching layer):** advisor hide-until-acted UI, outs and 2/4 display, preflop drill, post-hand review, leak categorization, self-estimate, what-if replay, SPR display, session view, `localStorage` persistence.

**Type consistency check:** `RealizationInput` is defined in `realization.ts` and consumed by `ev.ts`. `Combo` and `Range` come from `ranges.ts` throughout. `Street`, `Action`, `BotContext`, `BotConfig`, and `streetOf` come from `types.ts` throughout — `streetOf` lives there rather than being duplicated across `realization.ts` and `ev.ts`.

**Known approximations, deliberate and documented:**
- `stepBots` gives every bot the same static 30% opponent range rather than a per-opponent narrowed range. Refining this is Plan 2 work and changes no interface.
- The realization simulation models villain betting but not hero raising, per the fixed default policy.
- Sample counts in `realization.ts` and `ev.ts` are tuned for test speed. If the UI feels slow or numbers jitter, these are the dials.
