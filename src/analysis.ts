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

export const DEFINITIONS = {
  rawEquity:
    'Showdown Win Odds (Raw Equity): If all remaining community cards were dealt right now with NO further betting, this is how often your cards would win the pot at showdown (e.g. winning 58 out of 100 card runouts = 58%).',
  realizedEquity:
    'Playable Win Odds (Realized Equity): Your realistic chance of actually winning the pot when factoring in future betting rounds. Out of position or with draws, aggressive opponent bets will sometimes force you to fold before reaching showdown.',
  realizationFactor:
    'Position Retention (Realization Factor): Realized Equity ÷ Raw Equity. Measures what percentage of your raw card strength you actually get to claim based on table position and opponent betting.',
  potOdds:
    'Break-Even Call Odds (Pot Odds): The ratio of the call price to the total pot. Tells you the minimum win rate required to make calling profitable long-term.',
  ev:
    'Expected Value ($ EV): The average dollar profit or loss of an action calculated over thousands of identical poker hands.',
  outs:
    'Winning Cards (Outs): The specific unseen cards remaining in the deck that will improve your current hand into the best hand.',
  ruleOf42:
    'Rule of 4/2 Math Shortcut: Multiply your count of winning cards (outs) by 4 on the Flop (2 cards remaining) or by 2 on the Turn (1 card remaining) to quickly estimate your win percentage in your head.',
  spr:
    'Stack-to-Pot Ratio (SPR): Your remaining chip stack divided by the current pot size. High SPR means deep stacks (careful play); low SPR means committed stacks.',
  villainRange:
    'Opponent Opening Range: The full 13×13 grid of starting hand combinations your opponent is estimated to play based on their position.',
  communityCards:
    'Community Cards (The Board): The 5 shared cards dealt face-up in the center of the table across 3 rounds — Flop (3 cards), Turn (1 card), and River (1 card). All players combine these with their 2 private hole cards to make their best 5-card poker hand.',
};

/** Suit indices are c,d,h,s — diamonds and hearts render red. */
export function cardLabel(c: Card): { rank: string; suit: string; red: boolean } {
  const suit = suitOf(c);
  return {
    rank: RANKS[rankOf(c)],
    suit: ['♣', '♦', '♥', '♠'][suit],
    red: suit === 1 || suit === 2,
  };
}

export const BLIND_SIZE = 1; // dollars per big blind

export function money(bb: number, opts?: { sign?: boolean }): string {
  const v = bb * BLIND_SIZE;
  const absV = Math.abs(v);
  const body = Number.isInteger(absV) ? `$${absV}` : `$${absV.toFixed(2)}`;
  if (!opts?.sign) return v < 0 ? `-${body}` : body;
  return v > 0 ? `+${body}` : v < 0 ? `-${body}` : body;
}

export function isHeroInPosition(s: HandState, heroSeat = 0, btnSeat = 0): boolean {
  const activeOpponents = s.players.filter((p) => !p.folded && p.id !== heroSeat);
  if (activeOpponents.length === 0) return true;
  const N = s.players.length;
  const heroRank = (heroSeat - btnSeat - 1 + N) % N;
  return activeOpponents.every((p) => {
    const oppRank = (p.id - btnSeat - 1 + N) % N;
    return heroRank > oppRank;
  });
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
    inPosition: isHeroInPosition(s, 0, 0),
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

