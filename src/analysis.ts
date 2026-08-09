import { Card, rankOf, suitOf, RANKS } from './engine/cards';
import { equityVsRange, countOuts } from './engine/equity';
import { realizedEquity } from './engine/realization';
import { evaluateSizes, potOddsVerdict, EvOption } from './engine/ev';
import { rangeTopPercent, Combo } from './engine/ranges';
import { makeRng } from './engine/rng';
import { DEFAULT_BOT } from './engine/bot';
import type { HandState } from './engine/game';
import { streetOf } from './engine/types';

/** The opponent range the trainer assumes and discloses on screen. */
export const VILLAIN_RANGE_PCT = 0.25;

export interface HeroAnalysis {
  rawEquity: number;
  realizedEquity: number;
  realizationFactor: number;
  exact: boolean;
  outs: Card[];
  ruleOfNEstimate: number | null;
  cardsToCome: number;
  toCall: number;
  potOdds: { required: number; actual: number; evOfCall: number };
  advice: EvOption[];
  spr: number;
  bluffFreq: number;
}

/** Suit indices are c,d,h,s — diamonds and hearts render red. */
export function cardLabel(c: Card): { rank: string; suit: string; red: boolean } {
  const suit = suitOf(c);
  return {
    rank: RANKS[rankOf(c)],
    suit: ['♣', '♦', '♥', '♠'][suit],
    red: suit === 1 || suit === 2,
  };
}

/**
 * Analyse the hero's current spot. Deterministic: seeded from the hand seed and
 * the board, so the same spot always produces the same numbers.
 */
export function analyseSpot(s: HandState): HeroAnalysis {
  const hero = s.players[0];
  const hole = hero.hole as Combo;
  const rng = makeRng(s.seed * 7919 + s.board.length * 31 + Math.round(s.pot * 10));

  const villainRange = rangeTopPercent(VILLAIN_RANGE_PCT);
  const toCall = Math.max(0, s.currentBet - hero.committed);

  const raw = equityVsRange(hole, s.board, villainRange, rng, 4000);

  const input = {
    hole,
    board: s.board,
    pot: s.pot,
    stack: hero.stack,
    bigBlind: s.bigBlind,
    inPosition: true,
    villainRange,
  };

  const realization = realizedEquity(input, rng, 60);
  const { outs } = countOuts(hole, s.board, villainRange);

  // The 2/4 rule: outs x 4 with two cards to come, outs x 2 with one.
  const cardsToCome = 5 - s.board.length;
  const ruleOfNEstimate =
    outs.length > 0 && cardsToCome >= 1 && cardsToCome <= 2
      ? Math.min(1, (outs.length * (cardsToCome === 2 ? 4 : 2)) / 100)
      : null;

  const advice = evaluateSizes({ ...input, toCall }, rng);

  return {
    rawEquity: raw.equity,
    realizedEquity: realization.realized,
    realizationFactor: realization.factor,
    exact: raw.exact,
    outs,
    ruleOfNEstimate,
    cardsToCome,
    toCall,
    potOdds: potOddsVerdict(toCall, s.pot, realization.realized),
    advice,
    spr: s.pot > 0 ? hero.stack / s.pot : 0,
    bluffFreq: DEFAULT_BOT.bluffFreq[streetOf(s.board.length)],
  };
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function chips(x: number): string {
  return Number.isInteger(x) ? `${x}` : x.toFixed(1);
}
