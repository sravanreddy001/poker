import { ruleOf42, showdownEquity, structuralOuts } from './equity';
import { removeDead } from './ranges';
import { canonicalName, HAND_ORDER } from './ranges';
import type { Rng } from './rng';
import type { Action, BotConfig, BotContext } from './types';

export const DEFAULT_BOT: BotConfig = {
  openPercent: 0.25,
  bluffFreq: { preflop: 0, flop: 0.2, turn: 0.25, river: 0.3 },
  valueThreshold: 0.62,
};

/**
 * Extra equity a bot demands per unit of bet-to-pot ratio, and the ceiling on
 * it. A pot-sized bet costs 10 points of equity over the raw pot odds; anything
 * from 2.5x pot upward costs the full 25.
 */
const SIZE_PREMIUM_RATE = 0.1;
const MAX_SIZE_PREMIUM = 0.25;

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

/**
 * Postflop hand strength the way a player reads it at the table: the share of
 * the opponent's range the made hand already beats, or — when behind — the
 * Rule of 4/2 on the outs the hand's shape gives it. No sampling, so a spot
 * always plays the same way and every input is one a human can recount.
 */
function handStrength(ctx: BotContext): number {
  const live = removeDead(ctx.villainRange, [...ctx.hole, ...ctx.board]);
  const showdown = showdownEquity(ctx.hole, ctx.board, live);
  if (showdown > 0.5) return showdown;
  const outs = structuralOuts(ctx.hole, ctx.board);
  return Math.max(showdown, ruleOf42(outs, 5 - ctx.board.length));
}

export function botAct(ctx: BotContext, cfg: BotConfig, rng: Rng): Action {
  if (ctx.street === 'preflop') return preflopAction(ctx, cfg);

  const equity = handStrength(ctx);
  const potOdds = ctx.toCall > 0 ? ctx.toCall / (ctx.pot + ctx.toCall) : 0;

  // Raw pot odds price the chips but not the message. A bet many times the pot
  // represents a far stronger range than the one the bettor opened with, and
  // calling it risks a lot to win a little. Charge a premium over pot odds that
  // grows with the bet's size relative to the pot; on raw odds alone these bots
  // called off a 97bb stack into a 6.5bb pot with a marginal hand, which made
  // the advisor rate a 15x-pot shove as the best line every time we were ahead.
  const potBeforeBet = Math.max(0, ctx.pot - ctx.toCall);
  const sizeRatio = ctx.toCall > 0 && potBeforeBet > 0 ? ctx.toCall / potBeforeBet : 0;
  const required = potOdds + Math.min(MAX_SIZE_PREMIUM, SIZE_PREMIUM_RATE * sizeRatio);

  // Value: strong enough to bet or raise — and, facing a bet, strong enough for
  // the size of it.
  if (equity >= cfg.valueThreshold && equity >= required) {
    const target = clampBet(ctx.pot * 0.66 + ctx.toCall, ctx);
    if (ctx.toCall === 0) return target > 0 ? { type: 'bet', amount: target } : { type: 'check' };
    return target > ctx.toCall ? { type: 'raise', amount: target } : { type: 'call' };
  }

  // Facing a bet without a value hand: continue only at the right price.
  if (ctx.toCall > 0) {
    return equity > required ? { type: 'call' } : { type: 'fold' };
  }

  // Nothing to call and no value hand — bluff at the disclosed frequency, in position only.
  const noShowdownValue = equity < 0.35;
  if (noShowdownValue && ctx.inPosition && rng.next() < cfg.bluffFreq[ctx.street]) {
    const amount = clampBet(ctx.pot * 0.66, ctx);
    if (amount > 0) return { type: 'bet', amount };
  }

  return { type: 'check' };
}
