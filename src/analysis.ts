import { Card, rankOf, suitOf } from './engine/cards';
import { countOuts, ruleOf42, tableEquity, EquityMethod } from './engine/equity';
import { evaluateSizes, potOddsVerdict, EvOption, bluffPrice, minDefenseFrequency, commitmentTier } from './engine/ev';
import { rangeTopPercent, Combo, tierOf, HandTier } from './engine/ranges';
import { makeRng } from './engine/rng';
import { DEFAULT_BOT } from './engine/bot';
import type { HandState } from './engine/game';
import { streetOf } from './engine/types';

/** The opponent range the trainer assumes and discloses on screen. */
export const VILLAIN_RANGE_PCT = 0.25;

export interface HeroAnalysis {
  /** Win odds 0..1 — the single number the trainer shows and acts on. */
  winOdds: number;
  /** Which hand-checkable calculation produced `winOdds`. */
  winOddsMethod: EquityMethod;
  /** One line of arithmetic the player can redo at the table. */
  winOddsWorking: string;
  outs: Card[];
  ruleOfNEstimate: number | null;
  cardsToCome: number;
  toCall: number;
  potOdds: { required: number; actual: number; evOfCall: number };
  advice: EvOption[];
  spr: number;
  bluffFreq: number;
  bluffPriceAtPot: number;
  mdfFacing: number;
  commitment: { tier: 'committed' | 'shallow' | 'medium' | 'deep'; label: string; note: string };
  preflopTier: { tier: HandTier; label: string; topPct: number } | null;
}

export const DEFINITIONS = {
  winOdds:
    'Win Odds: How often you win this pot, worked out the way you would at the table — preflop from your starting-hand tier, after the flop either from the share of the opponent’s hands you already beat or from your outs × 4 (flop) / × 2 (turn). Nothing is simulated: every number can be recounted by hand. 🔴 Weak (< 35%), 🟡 Medium (35%–55%), 🟢 Strong (55%+). An action is profitable when Win Odds exceed the pot-odds threshold.',
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

export function getOptimalActionRationale(opts: {
  actionLabel: string;
  evVal: number;
  winOdds: number;
  toCall: number;
  pot?: number;
  potOddsRequired?: number;
  outsCount?: number;
  spr?: number;
}): string {
  const labelLower = opts.actionLabel.toLowerCase();
  const relPct = Math.round(opts.winOdds * 100);
  const reqPct = opts.potOddsRequired ? Math.round(opts.potOddsRequired * 100) : 0;

  if (labelLower.includes('all-in') || labelLower.includes('all in') || (opts.spr !== undefined && opts.spr < 1.5)) {
    if (relPct >= 70) {
      return `Monster Hand Strength (${relPct}% equity): Shoving All-In extracts maximum dollar value from second-best made hands and sets before future board cards.`;
    } else if (reqPct > 0 && relPct >= reqPct) {
      return `Pot-Committed Shove: Pot odds require ${reqPct}% equity. Your ${relPct}% equity makes Calling/Shoving All-In strongly +EV (${money(opts.evVal, { sign: true })}).`;
    }
  }

  if (labelLower.includes('fold')) {
    return `Weak Win Odds (${relPct}%): Facing this bet, your win odds do not clear the required pot odds threshold. Calling surrenders dollar EV.`;
  }

  if (labelLower.includes('call')) {
    return `Profitable Call (+EV): Pot odds require ${reqPct}% equity to break even. Your ${relPct}% win odds beat the threshold by +${Math.max(0, relPct - reqPct)}%. Calling is superior to raising here because calling realizes your equity cheaply, whereas raising over-bloats the pot with a speculative hand.`;
  }

  if (labelLower.includes('check')) {
    return `Pot Control / Trap: Checking controls pot size out of position and keeps opponent's bluffing range active.`;
  }

  if (labelLower.includes('bet') || labelLower.includes('raise')) {
    const amountMatch = opts.actionLabel.match(/\d+(\.\d+)?/);
    const amount = amountMatch ? parseFloat(amountMatch[0]) : 0;
    const pot = opts.toCall > 0 ? opts.toCall * 2 : 10;
    const pctOfPot = pot > 0 ? Math.round((amount / pot) * 100) : 50;

    if (relPct >= 70 || pctOfPot >= 80) {
      return `Large Value Sizing (${pctOfPot > 0 ? `${pctOfPot}% Pot` : 'Heavy'}): Chosen with monster equity (${relPct}%) to build a large pot and charge draws maximum price to see future cards.`;
    } else if (pctOfPot <= 35) {
      return `Small Sizing (${pctOfPot}% Pot): High-frequency probe bet. Risks minimal chips while forcing opponent to fold low-equity high-card hands.`;
    } else if ((opts.outsCount ?? 0) >= 8) {
      return `Semi-Bluff Aggression (${pctOfPot}% Pot): Bet puts pressure on opponent while retaining ${opts.outsCount} outs to hit a winning hand on future streets.`;
    } else {
      return `Medium Value Sizing (${pctOfPot}% Pot): Standard value bet. Balances pot building against worse hands while keeping opponent's calling range wide.`;
    }
  }

  return `Highest Expected Profit (${money(opts.evVal, { sign: true })}): Maximizes long-term profit against opponent's action frequencies.`;
}

export function getSizingRationale(amount: number, pot: number, winOdds: number): string {
  if (amount <= 0 || pot <= 0) return '';
  const pctOfPot = Math.round((amount / pot) * 100);
  const relPct = Math.round(winOdds * 100);

  if (pctOfPot >= 150) {
    return `2x Pot Overbet (${pctOfPot}% Pot): The mathematical EV sweet spot! Smaller bets (1x pot) leave money on the table against opponent's catchers, while larger bets (4x pot) force opponent to fold everything except hands that beat you. 2x pot maximizes [Call Amount × Calling Frequency].`;
  }
  if (pctOfPot >= 90) {
    return `Large / All-In (${pctOfPot}% Pot): Best for monster hands (${relPct}% equity) to extract maximum dollar value or polarize your bluffing range against catchers.`;
  }
  if (pctOfPot >= 65) {
    return `Large Sizing (${pctOfPot}% Pot): Best on wet/draw-heavy textures to charge draws a high price to see future cards.`;
  }
  if (pctOfPot >= 40) {
    return `Medium Sizing (${pctOfPot}% Pot): Standard value bet. Balances extracting value from second-best pairs while keeping opponent's calling range wide.`;
  }
  return `Small Sizing (${pctOfPot}% Pot): High-frequency probe bet. Risks minimal chips while forcing opponent to fold low-equity high-card hands.`;
}

const DISPLAY_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** Suit indices are c,d,h,s — diamonds and hearts render red. */
export function cardLabel(c: Card): { rank: string; suit: string; red: boolean } {
  const suit = suitOf(c);
  return {
    rank: DISPLAY_RANKS[rankOf(c)],
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
export function analyseSpot(s: HandState): HeroAnalysis | null {
  const hero = s.players[0];
  if (!hero.hole) return null; // Hero busted or not dealt in
  const hole: Combo = hero.hole;
  const rng = makeRng(s.seed * 7919 + s.board.length * 31 + Math.round(s.pot * 10));

  const villainRange = rangeTopPercent(VILLAIN_RANGE_PCT);
  const toCall = Math.max(0, s.currentBet - hero.committed);

  const input = {
    hole,
    board: s.board,
    pot: s.pot,
    stack: hero.stack,
    bigBlind: s.bigBlind,
    inPosition: isHeroInPosition(s, 0, 0),
    villainRange,
  };

  const { outs } = countOuts(hole, s.board, villainRange);

  // The 2/4 rule: outs x 4 with two cards to come, outs x 2 with one.
  const cardsToCome = 5 - s.board.length;
  const ruleOfNEstimate =
    outs.length > 0 && cardsToCome >= 1 && cardsToCome <= 2 ? ruleOf42(outs.length, cardsToCome) : null;

  // Preflop tier only when board is empty
  const preflopTier = s.board.length === 0 ? tierOf(hole) : null;

  const win = tableEquity(hole, s.board, villainRange);
  const winPct = Math.round(win.equity * 100);
  const winOddsWorking =
    win.method === 'tier'
      ? `${preflopTier?.label ?? 'Starting hand'} → about ${winPct}% against a ${Math.round(
          VILLAIN_RANGE_PCT * 100,
        )}% opening range.`
      : win.method === 'outs'
        ? `${win.outs} outs × ${cardsToCome >= 2 ? 4 : 2} = ${winPct}% by the ${
            cardsToCome >= 2 ? 'river' : 'river card'
          }.`
        : `Your hand already beats ${winPct}% of the hands they can hold on this board.`;

  const advice = evaluateSizes({ ...input, toCall }, rng);

  // Coach chips data
  const bluffPriceAtPot = bluffPrice(s.pot * 0.75, s.pot); // 3/4 pot is default semi-bluff size
  const mdfFacing = minDefenseFrequency(toCall, s.pot);
  const commitment = commitmentTier(s.pot > 0 ? hero.stack / s.pot : 0);

  return {
    winOdds: win.equity,
    winOddsMethod: win.method,
    winOddsWorking,
    outs,
    ruleOfNEstimate,
    cardsToCome,
    toCall,
    potOdds: potOddsVerdict(toCall, s.pot, win.equity),
    advice,
    spr: s.pot > 0 ? hero.stack / s.pot : 0,
    bluffFreq: DEFAULT_BOT.bluffFreq[streetOf(s.board.length)],
    bluffPriceAtPot,
    mdfFacing,
    commitment,
    preflopTier,
  };
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

