import { Card, fullDeck } from './cards';
import { categoryName, evaluate } from './evaluator';
import { botAct, DEFAULT_BOT } from './bot';
import { Combo, rangeTopPercent } from './ranges';
import { makeRng, shuffled, Rng } from './rng';
import type { Action, Street } from './types';

export interface Player {
  id: number;
  stack: number;
  hole: Combo | null;
  folded: boolean;
  /** Chips put in on the current street only. */
  committed: number;
  isHuman: boolean;
  /** True if player has bust (0 stack) and sits out this hand. */
  busted?: boolean;
}

export interface LogEntry {
  playerId: number;
  street: Street;
  action: Action;
  pot: number;
}

/**
 * Snapshot of all-in state with cards still to come. Captured when the hero
 * and at least one live opponent are all-in with remaining board cards.
 * Used to compute all-in adjusted EV.
 */
export interface AllInSnapshot {
  /** Hero's hole cards (seat 0) */
  heroHole: Combo;
  /** Actual hole cards of all live opponents at all-in point */
  villainHoles: Combo[];
  /** Community cards at the time of all-in */
  board: Card[];
  /** Total chips hero contributed to this pot */
  heroContribution: number;
  /** Final pot size when hand completed */
  finalPot: number;
  /** Street on which all-in occurred */
  street: Street;
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
  /** Bets plus raises made on the current street; capped to end re-raise wars. */
  raisesThisStreet: number;
  bigBlind: number;
  btnSeat: number;
  log: LogEntry[];
  complete: boolean;
  winners: number[];
  /** Size of the pot at the moment it was awarded. `pot` itself drops to 0. */
  awardedPot: number;
  /** Winning hand category at showdown, e.g. "Flush" — unset on a fold win. */
  winnerHandName?: string;
  /** Snapshot of all-in with cards to come, if applicable. */
  allInSnapshot?: AllInSnapshot;
  /** Hero's starting stack for this hand (used for all-in snapshot computation). */
  heroStartStack?: number;
}

const NEXT_STREET: Record<Street, Street | null> = {
  preflop: 'flop',
  flop: 'turn',
  turn: 'river',
  river: null,
};

/**
 * Maximum bets plus raises on one street. Without a cap, two bots holding
 * premium hands re-raise each other forever, and because every raise reopens
 * the action the street can never complete.
 */
const MAX_RAISES_PER_STREET = 4;

export function startHand(
  seed: number,
  opts: { players: number; stack: number; bigBlind: number },
  buttonIndex = 0,
  existingStacks?: number[],
): HandState {
  const rng = makeRng(seed);
  const deck = shuffled(fullDeck(), rng);
  let drawn = 0;

  const n = opts.players;
  const btnSeat = ((buttonIndex % n) + n) % n;
  const sbSeat = (btnSeat + 1) % n;
  const bbSeat = (btnSeat + 2) % n;
  const utgSeat = (btnSeat + 3) % n;

  const players: Player[] = [];
  for (let id = 0; id < n; id++) {
    const prevStack = existingStacks && existingStacks[id] !== undefined ? existingStacks[id] : opts.stack;
    const isBusted = prevStack <= 0;
    let hole: Combo | null = null;

    if (!isBusted) {
      hole = [deck[drawn++], deck[drawn++]] as Combo;
    }

    players.push({
      id,
      stack: prevStack,
      hole,
      folded: isBusted,
      committed: 0,
      isHuman: id === 0,
      busted: isBusted,
    });
  }

  // Blinds: SB posted at (btn+1), BB posted at (btn+2)
  // If a player is busted, they don't post a blind
  const sb = opts.bigBlind / 2;
  if (!players[sbSeat].busted) {
    players[sbSeat].stack -= sb;
    players[sbSeat].committed = sb;
  }
  if (!players[bbSeat].busted) {
    players[bbSeat].stack -= opts.bigBlind;
    players[bbSeat].committed = opts.bigBlind;
  }

  // Calculate actual pot from blinds that were posted
  let pot = 0;
  if (!players[sbSeat].busted) pot += sb;
  if (!players[bbSeat].busted) pot += opts.bigBlind;

  return {
    seed,
    rng,
    players,
    board: [],
    deck,
    drawn,
    pot,
    street: 'preflop',
    toAct: utgSeat,
    currentBet: opts.bigBlind,
    actedThisStreet: new Set(),
    raisesThisStreet: 1, // the big blind is the opening bet
    bigBlind: opts.bigBlind,
    btnSeat,
    log: [],
    complete: false,
    winners: [],
    awardedPot: 0,
    heroStartStack: players[0].stack + (sb > 0 && players[sbSeat].id === 0 ? sb : 0) + (opts.bigBlind > 0 && players[bbSeat].id === 0 ? opts.bigBlind : 0),
  };
}

function livePlayers(s: HandState): Player[] {
  return s.players.filter((p) => !p.folded);
}

/** A player can act only if they are still in the hand and have chips behind. */
function canAct(p: Player): boolean {
  return !p.folded && p.stack > 0;
}

function actors(s: HandState): Player[] {
  return s.players.filter(canAct);
}

function nextToAct(s: HandState, from: number): number {
  for (let i = 1; i <= s.players.length; i++) {
    const idx = (from + i + s.players.length) % s.players.length;
    if (canAct(s.players[idx])) return idx;
  }
  return from;
}

function streetComplete(s: HandState): boolean {
  if (livePlayers(s).length <= 1) return true;
  const able = actors(s);
  if (able.length === 0) return true;
  // A player who is all-in for less than the current bet is exempt — they
  // cannot match it and must not block the street from closing.
  return able.every((p) => s.actedThisStreet.has(p.id) && p.committed === s.currentBet);
}

/**
 * Captures all-in snapshot when hero and at least one opponent are all-in
 * with cards still to come. Returns null if conditions not met.
 * heroStartStack should be passed from App.tsx where it's tracked.
 */
function captureAllInSnapshot(s: HandState, heroStartStack: number, heroId: number = 0): AllInSnapshot | null {
  const live = livePlayers(s);

  // Need 2+ live players and hero must be one of them
  if (live.length < 2 || !live.some((p) => p.id === heroId)) return null;

  const hero = s.players[heroId];

  // Hero must be all-in (stack = 0) and not folded
  if (hero.stack !== 0 || hero.folded) return null;

  // At least one other live player must also be all-in
  const otherAllIn = live.filter((p) => p.id !== heroId && p.stack === 0);
  if (otherAllIn.length === 0) return null;

  // Must have cards to come
  if (s.street === 'river' || s.board.length === 5) return null;

  // Get villain combos (all live opponents except hero)
  const villainHoles = live
    .filter((p) => p.id !== heroId && p.hole)
    .map((p) => p.hole as Combo);

  // Hero contribution = starting stack (since now at 0)
  const heroContribution = heroStartStack;

  return {
    heroHole: hero.hole as Combo,
    villainHoles,
    board: s.board,
    heroContribution,
    finalPot: s.pot,
    street: s.street,
  };
}

function showdown(s: HandState): HandState {
  const live = livePlayers(s).filter((p) => p.hole); // Only count players with hole cards
  if (live.length === 0) return { ...s, complete: true, winners: [], awardedPot: s.pot };

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
    awardedPot: s.pot,
    complete: true,
    winners,
    winnerHandName: categoryName(best),
  };
}

function advanceStreet(s: HandState): HandState {
  let cur = s;

  // Capture all-in snapshot before advancing if applicable
  if (!cur.allInSnapshot && actors(cur).length === 0 && livePlayers(cur).length >= 2 && cur.heroStartStack) {
    const snapshot = captureAllInSnapshot(cur, cur.heroStartStack, 0);
    if (snapshot) {
      cur = { ...cur, allInSnapshot: snapshot };
    }
  }

  // Keep dealing until a street has at least two players able to bet. When
  // everyone left is all-in there is no more betting, so the board simply runs
  // out to showdown.
  for (;;) {
    const next = NEXT_STREET[cur.street];
    if (next === null) return showdown(cur);

    const deal = next === 'flop' ? 3 : 1;
    cur = {
      ...cur,
      board: [...cur.board, ...cur.deck.slice(cur.drawn, cur.drawn + deal)],
      drawn: cur.drawn + deal,
      street: next,
      currentBet: 0,
      actedThisStreet: new Set(),
      raisesThisStreet: 0,
      players: cur.players.map((p) => ({ ...p, committed: 0 })),
      allInSnapshot: cur.allInSnapshot,
      heroStartStack: cur.heroStartStack,
    };

    if (actors(cur).length >= 2) return { ...cur, toAct: nextToAct(cur, cur.btnSeat) };
  }
}

function awardUncontested(s: HandState): HandState {
  const winner = livePlayers(s)[0];
  return {
    ...s,
    players: s.players.map((p) => (p.id === winner.id ? { ...p, stack: p.stack + s.pot } : p)),
    pot: 0,
    awardedPot: s.pot,
    complete: true,
    winners: [winner.id],
  };
}

export function applyAction(state: HandState, action: Action): HandState {
  if (state.complete) return state;

  const players = state.players.map((p) => ({ ...p }));
  const actor = players[state.toAct];
  let { pot, currentBet, raisesThisStreet } = state;
  const actedThisStreet = new Set(state.actedThisStreet);

  // Once the street's raise cap is reached, an attempted raise becomes a call.
  if (
    (action.type === 'bet' || action.type === 'raise') &&
    raisesThisStreet >= MAX_RAISES_PER_STREET
  ) {
    action = currentBet > actor.committed ? { type: 'call' } : { type: 'check' };
  }

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
      // `action.amount` is an absolute target for the street. Clamp it to the
      // player's means, and never below what they have already committed — a
      // bet must not pull chips back out of the pot.
      const target = Math.max(
        actor.committed,
        Math.min(action.amount, actor.stack + actor.committed),
      );

      if (target <= currentBet) {
        // Not a genuine raise. Resolve it as a call, or a check when nothing is owed.
        const owed = Math.min(currentBet - actor.committed, actor.stack);
        actor.stack -= owed;
        actor.committed += owed;
        pot += owed;
        break;
      }

      const delta = target - actor.committed;
      actor.stack -= delta;
      actor.committed = target;
      pot += delta;
      currentBet = target;
      raisesThisStreet++;
      // A genuine raise reopens the action for everyone else.
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
    raisesThisStreet,
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

/**
 * Resolve exactly one bot decision. The UI drives this on a timer so the table
 * plays out seat by seat the way a live game does, instead of every opponent
 * acting in the same frame. Returns the state unchanged when it is the hero's
 * turn or the hand is over.
 */
export function stepBotOnce(state: HandState): HandState {
  if (state.complete || state.players[state.toAct].isHuman) return state;

  const p = state.players[state.toAct];
  if (!canAct(p)) return { ...state, toAct: nextToAct(state, state.toAct) };

  const action = botAct(
    {
      hole: p.hole as Combo,
      board: state.board,
      pot: state.pot,
      toCall: Math.max(0, state.currentBet - p.committed),
      stack: p.stack,
      bigBlind: state.bigBlind,
      street: state.street,
      inPosition: state.toAct > 0,
      villainRange: rangeTopPercent(0.3),
    },
    DEFAULT_BOT,
    state.rng,
  );
  return applyAction(state, action);
}

export function stepBots(state: HandState): HandState {
  let s = state;
  let guard = 0;
  while (!s.complete && !s.players[s.toAct].isHuman && guard++ < 200) {
    const p = s.players[s.toAct];
    // Skip if player cannot act (busted or folded)
    if (!canAct(p)) {
      s = { ...s, toAct: nextToAct(s, s.toAct) };
      continue;
    }
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
