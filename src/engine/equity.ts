import { Card, fullDeck } from './cards';
import { evaluate } from './evaluator';
import { Combo, Range, removeDead } from './ranges';
import { Rng, shuffled } from './rng';

export interface EquityResult {
  /** Fraction 0..1. Ties count as half a win. */
  equity: number;
  wins: number;
  ties: number;
  total: number;
  /** True when every runout was enumerated rather than sampled. */
  exact: boolean;
}

const DEFAULT_SAMPLES = 20000;

function deadDeck(dead: Card[]): Card[] {
  const blocked = new Set(dead);
  return fullDeck().filter((c) => !blocked.has(c));
}

/** Every way to draw `n` cards from `deck`, in index order. */
function* choose(deck: Card[], n: number): Generator<Card[]> {
  if (n === 0) {
    yield [];
    return;
  }
  const idx = Array.from({ length: n }, (_, i) => i);
  for (;;) {
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
  const work = live.combos.length * countRunouts(toCome, deckSize);
  const exact = toCome <= 2 && work <= 4_000_000;

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
 * Showdown-now equity: who is ahead if the hand were checked down on the board
 * as it stands, with no further cards. This is deliberately not the same as
 * `equityVsRange`, which includes runouts — a big draw is often already ahead
 * on runout-inclusive equity while still being behind right now.
 */
function showdownEquity(hero: Combo, board: Card[], live: Range): number {
  let wins = 0;
  let ties = 0;
  const h = evaluate([...hero, ...board]);
  for (const vc of live.combos) {
    const v = evaluate([...vc, ...board]);
    if (h > v) wins++;
    else if (h === v) ties++;
  }
  return live.combos.length === 0 ? 0.5 : (wins + ties / 2) / live.combos.length;
}

/**
 * A card is an out when the hero is behind more than half the villain range on
 * the current board, and ahead of more than half of it once that card lands.
 */
export function countOuts(
  hero: Combo,
  board: Card[],
  villain: Range,
  _rng?: Rng,
): { outs: Card[] } {
  if (board.length < 3 || board.length >= 5) return { outs: [] };

  const live = removeDead(villain, [...hero, ...board]);
  if (live.combos.length === 0) return { outs: [] };
  if (showdownEquity(hero, board, live) > 0.5) return { outs: [] };

  const outs: Card[] = [];
  for (const c of deadDeck([...hero, ...board])) {
    const liveNext = removeDead(live, [c]);
    if (liveNext.combos.length === 0) continue;
    if (showdownEquity(hero, [...board, c], liveNext) > 0.5) outs.push(c);
  }
  return { outs };
}
