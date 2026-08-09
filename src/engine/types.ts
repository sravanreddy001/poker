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

/** The street implied by how many board cards are dealt. */
export function streetOf(boardLen: number): Street {
  if (boardLen < 3) return 'preflop';
  if (boardLen === 3) return 'flop';
  if (boardLen === 4) return 'turn';
  return 'river';
}
