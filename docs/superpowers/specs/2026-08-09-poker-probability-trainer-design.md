# Poker Probability Trainer — Design

Date: 2026-08-09
Status: approved (revised after coaching review)

## Purpose

Learn poker by playing the board rather than the player. The app deals real
Texas Hold'em hands, teaches the probability behind every decision, recommends
how much to bet or call, and after each hand explains the win or loss in
probabilistic terms — separating decision quality from outcome.

The central teaching claim: **a good decision can lose and a bad decision can
win.** Every part of the design exists to make that visible.

## Decision criterion

This project optimizes for **learning and practice**, not realism,
completeness, or entertainment. Where a choice is contested, the option that
produces more skill per hand played wins. Concretely:

- **Commit before feedback.** The user acts first, then sees the analysis. A
  recommendation visible during the decision trains screen-reading, not poker.
- **Prefer active recall over passive display.** A number the user predicted
  teaches more than the same number shown to them.
- **Prefer techniques that transfer to a live table.** At a real table there is
  no equity readout. Anything the app teaches must be reproducible in the
  user's head.
- **Prefer volume and fast iteration.** More hands means more reps and faster
  convergence of variance.
- **Cut bookkeeping.** Anything that is accounting rather than reasoning goes.

## Scope

### In scope (v1)

- Texas Hold'em, no-limit, 6-max: one human vs five bots.
- Mechanical bot policy: hand strength and pot odds, plus **bluffing at fixed,
  disclosed frequencies**. No adaptation to the human, no tells, no modeling.
- Raw equity **and realized equity**, with pot-odds verdicts computed on
  realized.
- Outs counting with the 2/4 shortcut taught as the primary mental method.
- Bet-sizing advisor, **hidden until the user has acted**.
- Preflop opening-range drill by position.
- Post-hand review grading every decision, with leak categorization.
- Equity self-estimate prompt with running calibration score.
- What-if replay of any decision under a different action.
- Session history: actual-vs-expected winnings chart, top leaks, persisted
  locally.

### Out of scope (v1)

- Side pots. All players start at equal stacks; if a player busts, stacks
  reset. Side pots are bookkeeping with no probability content.
- Multiway EV. The advisor computes against the single most-live opponent and
  says so on screen when other players remain.
- Adaptive or exploitative bots, opponent modeling, mixed/GTO solving,
  multiplayer, accounts, or any network traffic. Nothing leaves the machine.

## Platform

React + TypeScript, built with Vite. No backend. Heavy computation runs in a
Web Worker so the table stays responsive. Persistence is `localStorage`.

## Architecture

| Module | Responsibility | Depends on |
|---|---|---|
| `cards.ts` | 52-card model, integer encoding `0..51`, deck and dealing | — |
| `rng.ts` | Seeded deterministic RNG; every hand records its seed | — |
| `evaluator.ts` | 7-card hand → comparable integer score | `cards` |
| `ranges.ts` | 169 canonical starting hands; a range is a set of concrete combos | `cards` |
| `bot.ts` | Policy: `(hole, board, pot, toCall, position, rng) → action` | `evaluator`, `rng` |
| `equity.ts` | Raw equity vs a range, given a board; outs enumeration | `evaluator`, `ranges` |
| `realization.ts` | Realized equity by forward simulation | `bot`, `equity` |
| `ev.ts` | Expected value of each candidate bet size | `bot`, `realization` |
| `game.ts` | Betting state machine, blinds, streets, showdown | `bot`, `cards`, `rng` |
| `review.ts` | Per-decision grading; outcome classification | `ev`, `realization` |
| `leaks.ts` | Clusters errors into named leak categories | `review` |
| `drills.ts` | Preflop range drill, self-estimate prompts | `ranges`, `equity` |
| `history.ts` | Session persistence and aggregate statistics | `leaks` |

### The load-bearing decision

`bot.ts` is a **pure function of its inputs including an explicit RNG stream.**
Everything else depends on this:

- **Range narrowing** is a query, not a guess: "which combos would this policy
  have bet here?"
- **Fold probability** against a candidate size is a lookup, not an estimate.
- **Reproducibility.** Because the RNG is seeded and the seed is recorded per
  hand, any hand replays identically — which is what makes what-if replay
  meaningful rather than a fresh roll of the dice.

The opponents are rules, so the app's numbers are derived rather than
estimated. That is what keeps this board math while still predicting outcomes.

## Bot policy

Bots act on made-hand strength and draw equity against pot odds. On top of
that they **bluff at fixed frequencies**, for example: with a missed draw on
the river, in position, bluff 30% of the time.

Frequencies are **published in the opponent panel.** There is nothing to read
in a bot's behavior beyond a number the app already told you. Calling therefore
reduces to arithmetic: *he bluffs 30% here, I need 25% equity to call, so I
call.*

This is deliberate, and it is the correction to the original design. Bots that
never bluff would teach three habits that lose money against real players:
overfolding to aggression, over-bluffing into opponents who cannot fold, and —
worst — never developing the ability to call down, since a bluff would never
arrive to be caught. Disclosed frequencies preserve "play the board" while
keeping bluff-catching learnable.

## Equity: raw versus realized

**Raw equity** is the share of the pot you win at showdown if all remaining
cards are dealt and nobody folds.

**Realized equity** is what you actually collect. It is almost always lower.
Out of position with no initiative you will face bets that make you fold before
the river, and you will not get paid the times you hit. A gutshot with
king-high has raw equity it will rarely collect.

**Pot-odds verdicts and all EV figures use realized equity.** Raw equity is
displayed alongside it, and the gap between the two is itself a teaching
surface — it is where most beginner losses come from.

### Computing realization

Realized equity is measured by **forward simulation**, not by a fudge factor.
The hand is played out to completion against the bot policy and the result
averaged over runouts.

This requires an assumed continuation strategy for the human. It **cannot** be
the advisor's recommendation — the advisor consumes realized equity, so that
would be circular. Instead, realization simulations use a **fixed default
continuation policy**: call when raw pot odds justify it, fold otherwise, never
raise. Simple, stable, and independent of the advisor.

The reported realization factor is `realized ÷ raw`, surfaced as a percentage
so the user can see position and initiative changing it directly.

### Precision

Exact enumeration where cheap — turn (44 runouts), river (direct comparison),
and flop (C(45,2) = 990 runouts). Sampling elsewhere, including all realization
simulation and any multiway spot.

**Equity is displayed rounded to whole percentages.** No player needs a third
of a percent; they need "about a third." Sampling noise is far smaller than the
error introduced by ignoring realization, so precision theatre is not worth
screen space.

## Outs and the 2/4 rule

The app computes equity in a worker. At a table the user has no worker, so the
worker's number is useless unless the underlying technique is taught.

Every draw is therefore shown as **its outs count first**, then the shortcut:

- Two cards to come: `outs × 4` ≈ equity %
- One card to come: `outs × 2` ≈ equity %

The exact figure appears next to the estimate along with the shortcut's error,
so the user learns both the method and where it breaks down — the 4× rule
overshoots with many outs, which the display shows rather than explains away.

Outs are enumerated concretely and named: "9 outs — any heart."

## Bet-sizing advisor

Candidate sizes: check/fold, ⅓ pot, ½ pot, ¾ pot, pot, 2× pot, all-in.

For each candidate size `s`, and each combo in the opponent's range:

1. Run `bot.ts` to get the response — fold, call, or raise.
2. Accumulate expected value:
   - fold → win the current pot
   - call → `realizedEquity × (pot + 2s) − s`
   - raise → recurse, capped at one re-raise, then resolve as a call
3. Weight by combo probability within the range.

Because the sweep plays the hand forward through the bot policy, **implied and
reverse implied odds fall out of the calculation naturally**: a draw that will
get paid on later streets scores higher than its immediate odds justify, and a
dominated hand that will keep paying scores lower. Both are named in the UI
when they materially move the verdict, since they are concepts the user needs,
not just mechanics.

### Hidden by default

**The advisor does not display until the user has acted.** This is the most
important pedagogical constraint in the design. A visible recommendation trains
the user to read a screen, and screens are not available at a table.

After acting, the user sees the ranked EV of every size and what their choice
cost. A "show me" button reveals the advice early, and **every use is logged** —
how often the crutch was needed is itself a progress metric, reported in the
session view as a declining curve.

## Preflop drill

Preflop is where most money is made and lost, and it is the most mechanical
part of the game — which is why coaches start there.

A dedicated drill deals a hand and a position and asks: open, call, or fold.
Feedback gives the standard action, the reasoning, and the hand's place in the
positional opening range. Range charts are viewable but hidden during the drill.

## Post-hand review

Every decision point is replayed as a row: raw equity, realized equity, pot
odds, outs, action taken, max-EV action, and EV surrendered in big blinds.

The hand outcome is classified:

- **Variance** — the decision was +EV and lost anyway. Shows the exact
  probability of the runout that beat you.
- **Consequence** — the decision was −EV and the loss was earned. Identifies
  the leaking decision.
- **Won despite** — the decision was −EV and won regardless. Called out
  explicitly, because unexamined this is what quietly teaches bad habits.

### Leak categorization

Total EV lost is not coaching. "You overcall flush draws out of position" is.

Every −EV decision is tagged with a category, for example:

- Overcalled a draw without the odds
- Overfolded to river aggression
- Failed to bluff-catch against a disclosed bluffing frequency
- Bet too small for value
- Played too loose from early position
- Ignored reverse implied odds with a dominated hand

The session view surfaces the user's **top three leaks by EV cost**, and the
preflop and self-estimate drills bias toward the situations that generate them.

## Equity self-estimate

Before equity is revealed on a street, the app asks the user to predict it on a
slider, then shows the true value, the error, and a running calibration score
(mean absolute error, trending over hands played).

Frequency is user-controlled: every decision, once per hand, or off. Default is
once per hand on a randomly chosen street.

This is the highest-value feature in the app under the decision criterion. At a
table there is no equity readout, so estimating it yourself is the only part
that transfers. Combined with outs counting, this is the core loop.

## What-if replay

From the review screen, any decision point can be replayed with a different
action. The hand re-runs **from the recorded seed**, so bot behaviour including
bluff decisions is identical, and reports the alternative line's EV plus the
distribution of outcomes across all remaining runouts — not a single re-deal,
which would substitute one anecdote for another.

## Stack depth and SPR

Stack depth is a visible, adjustable parameter (default 100bb). **Stack-to-pot
ratio is displayed and taught**, because correct play at 20bb and at 100bb are
different games, and SPR is the concept that connects them.

## Session view

- Actual stack against EV-expected stack across all hands. The lines diverge in
  the short run and converge over volume — the primary anti-tilt device.
- Calibration score over time.
- Advisor reveals per hundred hands, trending down.
- Top three leaks by EV cost.

## Testing strategy

**`evaluator.ts` is tested first and hardest.** Every number downstream is
meaningless if hand comparison is wrong.

- Evaluator: known-hand fixtures across every hand class and tie-break edge
  (kickers, counterfeited two pair, wheel straights, straight flushes); property
  tests asserting ordering invariants over enumerated hand classes.
- Equity: validated against published figures — AA vs KK = 81.9%, AKs vs QQ =
  46.0%, and a table of comparable reference matchups.
- Outs: enumerated outs must match the equity delta they imply.
- Realization: realized ≤ raw in every position; out-of-position realization
  strictly lower than in-position for the same hand and board.
- EV: hand-built scenarios with pencil-checkable answers.
- Reproducibility: the same seed must produce a byte-identical hand history.
- What-if replay: alternative-line EV must equal the advisor's EV for that same
  action at that decision point. Two paths, one quantity, must agree.
- Game state machine: street progression, blind posting, betting-round
  termination, all-in resolution, showdown ordering.
- Review classification: constructed hands yielding each of the three labels.

## Risks

1. **Evaluator correctness** — highest impact, fully mitigable by tests.
   Front-load it.
2. **Realization simulation cost** — a forward simulation per candidate size
   per decision is the heaviest thing in the app. Mitigated by Web Worker
   execution, caching per decision point, and sampling rather than enumerating.
3. **Bot policy realism** — a policy too naive makes derived equities
   misleading. Mitigated by grounding it in pot odds, draw equity, and
   disclosed bluff frequencies rather than raw hand rank.
4. **Feature weight** — v1 now carries drills, leaks, and realization on top of
   the core game. Build order must deliver a playable, honest core first;
   drills and leak analysis layer on afterward.

## Deferred

Side pots, multiway EV, adaptive bots, mixed strategies, additional variants
(Omaha, Stud), and the vs-random-hands equity comparison view.
