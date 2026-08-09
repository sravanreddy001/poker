# Poker Probability Trainer — Design

Date: 2026-08-09
Status: approved

## Purpose

Learn poker by playing the board, not the player. The app deals real Texas
Hold'em hands, shows the probabilities behind every decision, recommends how
much to bet or call based on equity and pot size, and after each hand explains
the win or loss in probabilistic terms — separating decision quality from
outcome.

The central teaching claim: **a good decision can lose and a bad decision can
win.** Every part of the design exists to make that visible.

## Scope

### In scope (v1)

- Texas Hold'em, no-limit, 6-max: one human vs five bots.
- Deterministic bot policy driven by hand strength and pot odds. No bluffing,
  no player modeling, no adaptation to the human.
- Live equity display against the bots' derived ranges.
- Bet-sizing advisor: expected value of each candidate size, ranked.
- Post-hand review grading every decision the human made.
- Session history with actual-vs-expected winnings chart, persisted locally.

### Out of scope (v1)

- Side pots. All players start with equal stacks; if a player busts, stacks
  reset. Side pots are bookkeeping with no probability content.
- Multiway EV. The advisor computes against the single most-live opponent and
  states on screen when other players remain in the hand.
- Bluffing bots, mixed/GTO strategies, opponent modeling, multiplayer,
  accounts, or any network traffic. Nothing leaves the machine.

## Platform

React + TypeScript, built with Vite. No backend. Heavy computation runs in a
Web Worker so the table stays responsive. Persistence is `localStorage`.

## Architecture

Nine modules, each with one purpose and a defined interface.

| Module | Responsibility | Depends on |
|---|---|---|
| `cards.ts` | 52-card model, integer encoding `0..51`, deck and dealing | — |
| `evaluator.ts` | 7-card hand → comparable integer score | `cards` |
| `ranges.ts` | 169 canonical starting hands; a range is a set of concrete combos | `cards` |
| `bot.ts` | Pure policy: `(hole, board, pot, toCall, position) → action` | `evaluator` |
| `equity.ts` | Human equity vs a range, given a board | `evaluator`, `ranges` |
| `ev.ts` | Expected value of each candidate bet size | `bot`, `equity` |
| `game.ts` | Betting state machine, blinds, street progression, showdown | `bot`, `cards` |
| `review.ts` | Per-decision grading; classifies outcomes | `ev`, `equity` |
| `history.ts` | Session persistence and aggregate statistics | — |

### The load-bearing decision

`bot.ts` is a **pure function**. Everything else depends on that property:

- **Range narrowing** is a query, not a guess: "which combos would this policy
  have bet, given this board and this action?"
- **Fold probability** against a candidate bet size is likewise a lookup: run
  the policy and read the answer.

Because the opponents are rules rather than minds, the numbers the app shows
are derived rather than estimated. This is what keeps the exercise board math
while still producing figures that genuinely predict outcomes.

## Equity computation

Method varies by street. The app must never misrepresent its own precision.

| Street | Method | Exactness |
|---|---|---|
| Preflop | Precomputed table: 169 hands × range buckets | Exact |
| Flop | Full enumeration: C(45,2)=990 runouts × villain combos | Exact |
| Turn | 44 runouts × villain combos | Exact |
| River | No runouts; direct comparison | Exact |

These are exact **heads-up**. With three or more players live, joint
enumeration is intractable, so multiway equity uses Monte Carlo sampling at
100,000 samples (approximately ±0.3%).

**UI requirement:** exact figures render plainly; sampled figures render with a
`±` margin. The user must always be able to tell which kind of number they are
reading.

## Bet-sizing advisor

Candidate sizes: check/fold, ⅓ pot, ½ pot, ¾ pot, pot, 2× pot, all-in.

For each candidate size `s`, and each combo in the opponent's range:

1. Run `bot.ts` to obtain the response — fold, call, or raise.
2. Accumulate expected value:
   - fold → win the current pot
   - call → `equity × (pot + 2s) − s`
   - raise → recurse, capped at one re-raise, then resolve as call
3. Weight by combo probability within the range.

Output is a bar chart of EV per size with the maximum highlighted, alongside
the pot-odds verdict: break-even equity required, actual equity, and the
resulting EV of calling in big blinds.

## Post-hand review

Every decision point the human faced is replayed as a row: equity at that
moment, pot odds at that moment, action taken, maximum-EV action, and EV
surrendered in big blinds.

The hand outcome is then classified:

- **Variance** — the decision was +EV and lost anyway. Displays the exact
  probability of the runout that won it for the opponent.
- **Consequence** — the decision was −EV and the loss was earned. Identifies
  the leaking decision.
- **Won despite** — the decision was −EV and won regardless. Called out
  explicitly, because unexamined this is what quietly teaches bad habits.

### Session view

A line chart of actual stack against EV-expected stack across all hands
played. The two lines diverge in the short run and converge over volume. This
is the primary anti-tilt device: variance becomes something you watch shrink
rather than something you feel.

## Testing strategy

**`evaluator.ts` is tested first and hardest.** Every downstream number is
meaningless if hand comparison is wrong.

- Evaluator: known-hand fixtures covering every hand class and every tie-break
  edge (kickers, counterfeited two pair, wheel straights, straight flushes);
  property tests asserting ordering invariants across enumerated hand classes.
- Equity: validated against published figures — AA vs KK = 81.9%, AKs vs QQ =
  46.0%, and a table of similar reference matchups.
- EV: hand-built scenarios with pencil-checkable answers.
- Game state machine: street progression, blind posting, betting-round
  termination, all-in resolution, showdown ordering.
- Review classification: constructed hands that must yield each of the three
  outcome labels.

## Risks

1. **Evaluator correctness** — highest impact, fully mitigable by tests. Front-
   load it.
2. **Flop enumeration cost** — approximately one million evaluations per
   update. Mitigated by Web Worker execution and a fast evaluator; if it proves
   too slow, fall back to sampling with the `±` label already specified.
3. **Bot policy realism** — a policy too naive makes derived equities
   misleading in practice. Mitigated by grounding the policy in pot odds and
   draw equity rather than raw hand rank alone.

## Deferred

Side pots, multiway EV, bluffing bots, mixed strategies, additional variants
(Omaha, Stud), and the vs-random-hands equity comparison view.
