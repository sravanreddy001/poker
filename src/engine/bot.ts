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

  // Nothing to call and no value hand — bluff at the disclosed frequency, in position only.
  const noShowdownValue = equity < 0.35;
  if (noShowdownValue && ctx.inPosition && rng.next() < cfg.bluffFreq[ctx.street]) {
    const amount = clampBet(ctx.pot * 0.66, ctx);
    if (amount > 0) return { type: 'bet', amount };
  }

  return { type: 'check' };
}
