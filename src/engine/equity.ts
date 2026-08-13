import { Card, fullDeck, rankOf, suitOf } from './cards';
import { evaluate } from './evaluator';
import { Combo, Range, removeDead, tierOf, HAND_ORDER, combosOf, rangeTopPercent } from './ranges';

function deadDeck(dead: Card[]): Card[] {
  const blocked = new Set(dead);
  return fullDeck().filter((c) => !blocked.has(c));
}

/**
 * Showdown-now equity: how often the hero's current five-card hand beats the
 * villain range on the board as it stands, with no further cards. Exhaustive
 * over the range and free of randomness — the same spot always produces the
 * same number, and the number is a plain "I beat X of the hands you can have".
 */
export function showdownEquity(hero: Combo, board: Card[], live: Range): number {
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
export function countOuts(hero: Combo, board: Card[], villain: Range): { outs: Card[] } {
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

/**
 * The Rule of 4 and 2: each out is worth about 4% with two cards to come and
 * about 2% with one. Capped at 95% — no draw is a certainty.
 */
export function ruleOf42(outs: number, cardsToCome: number): number {
  if (outs <= 0 || cardsToCome <= 0) return 0;
  return Math.min(0.95, (outs * (cardsToCome >= 2 ? 4 : 2)) / 100);
}

/**
 * Outs counted the way a player counts them at the table: from the shape of
 * the hand, not from the opponent's range. Flush draw nine, open-ended eight,
 * gutshot four, two overcards six. Only the biggest draw counts, plus half
 * credit for overcards alongside it, which is the usual table discount for
 * outs that can pair the opponent instead.
 */
export function structuralOuts(hero: Combo, board: Card[]): number {
  if (board.length < 3 || board.length >= 5) return 0;
  const cards = [...hero, ...board];

  const bySuit = [0, 0, 0, 0];
  for (const c of cards) bySuit[suitOf(c)]++;
  const flushDraw = bySuit.some((n) => n === 4) ? 9 : 0;

  // Slot 0 is the ace playing low for the wheel; slots 1..13 are 2 through ace.
  const present = new Array(14).fill(false);
  for (const c of cards) {
    present[rankOf(c) + 1] = true;
    if (rankOf(c) === 12) present[0] = true;
  }

  let straightDraw = 0;
  // Any five-card window holding four of its ranks is at least a gutshot.
  for (let low = 0; low + 4 < 14; low++) {
    let have = 0;
    for (let i = 0; i < 5; i++) if (present[low + i]) have++;
    if (have === 4) straightDraw = Math.max(straightDraw, 4);
  }
  // Open-ended: four consecutive ranks with a live slot at both ends.
  for (let low = 1; low + 3 < 13; low++) {
    let run = true;
    for (let i = 0; i < 4; i++) if (!present[low + i]) run = false;
    if (run) straightDraw = Math.max(straightDraw, 8);
  }

  const boardHigh = board.reduce((hi, c) => Math.max(hi, rankOf(c)), -1);
  const overcards = hero.filter((c) => rankOf(c) > boardHigh).length * 3;

  const draw = Math.max(flushDraw, straightDraw);
  return Math.min(15, draw > 0 ? draw + Math.floor(overcards / 2) : overcards);
}

/**
 * The starting-hand chart the trainer uses preflop, and the only place these
 * five numbers live. They are round-number equities for the middle of each
 * tier against a typical 25% opening range — a chart, which is what a player
 * works from before the flop. Everything after the flop is counted instead.
 */
export const PREFLOP_TIER_EQUITY: Record<string, number> = {
  premium: 0.68,
  strong: 0.58,
  speculative: 0.5,
  marginal: 0.44,
  trash: 0.36,
};

export interface TierRow {
  tier: string;
  label: string;
  /** Where the tier starts and stops in the ranking, in percent of all combos. */
  fromPct: number;
  toPct: number;
  equity: number;
  /** How many of the 1326 two-card combos fall inside the tier. */
  combos: number;
  /** The hands at the top of the tier, for recognition. */
  examples: string[];
}

/**
 * The whole chart, laid out so it can be read rather than trusted: each tier,
 * the slice of the 169-hand ranking it covers, how many combos that is, and
 * the win odds the trainer scores it at.
 */
export function preflopTierTable(): TierRow[] {
  const bands = [
    { tier: 'premium', label: 'Premium', from: 0, to: 3 },
    { tier: 'strong', label: 'Strong', from: 3, to: 10 },
    { tier: 'speculative', label: 'Speculative', from: 10, to: 20 },
    { tier: 'marginal', label: 'Marginal', from: 20, to: 35 },
    { tier: 'trash', label: 'Trash', from: 35, to: 100 },
  ];
  // The names in a band are the ones the smaller range stops short of, which
  // is the same walk down HAND_ORDER that rangeTopPercent itself makes.
  const namesUpTo = (pct: number): string[] => {
    const target = Math.round(1326 * pct);
    const names: string[] = [];
    let count = 0;
    for (const name of HAND_ORDER) {
      if (count >= target) break;
      names.push(name);
      count += combosOf(name).length;
    }
    return names;
  };

  return bands.map(({ tier, label, from, to }) => {
    const below = namesUpTo(from / 100);
    const upTo = namesUpTo(to / 100);
    return {
      tier,
      label,
      fromPct: from,
      toPct: to,
      equity: PREFLOP_TIER_EQUITY[tier],
      combos:
        rangeTopPercent(to / 100).combos.length - rangeTopPercent(from / 100).combos.length,
      examples: upTo.slice(below.length, below.length + 3),
    };
  });
}

export type EquityMethod = 'tier' | 'showdown' | 'outs';

export interface TableEquity {
  /** Win odds 0..1. */
  equity: number;
  /** Which hand-checkable calculation produced it. */
  method: EquityMethod;
  /** Outs behind an `outs` estimate; 0 otherwise. */
  outs: number;
  cardsToCome: number;
  /** True when the hero already beats more than half the villain range. */
  ahead: boolean;
}

/**
 * The one win-odds number the trainer shows, and the only one it acts on.
 * Every branch is arithmetic a player can redo at the table:
 *
 * - preflop — hand tier read off a starting-hand chart;
 * - already ahead — the share of the opponent's range the made hand beats;
 * - drawing — outs × 4 (flop) or outs × 2 (turn).
 */
export function tableEquity(hero: Combo, board: Card[], villain: Range): TableEquity {
  const cardsToCome = Math.max(0, 5 - board.length);

  if (board.length === 0) {
    return {
      equity: PREFLOP_TIER_EQUITY[tierOf(hero).tier],
      method: 'tier',
      outs: 0,
      cardsToCome,
      ahead: false,
    };
  }

  const live = removeDead(villain, [...hero, ...board]);
  const showdown = showdownEquity(hero, board, live);
  if (showdown > 0.5 || cardsToCome === 0) {
    return { equity: showdown, method: 'showdown', outs: 0, cardsToCome, ahead: showdown > 0.5 };
  }

  const outs = countOuts(hero, board, villain).outs.length;
  if (outs === 0) {
    return { equity: showdown, method: 'showdown', outs: 0, cardsToCome, ahead: false };
  }
  return { equity: ruleOf42(outs, cardsToCome), method: 'outs', outs, cardsToCome, ahead: false };
}
