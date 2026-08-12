# Coach Chips — Design Spec

Status: approved for build. Source mocks: `surfacing-mocks.html`, `teachable-mocks.html`.

## Principle

Every number surfaced during a live hand must be **reachable by counting or by a
division a person can do in their head at a real table**. Monte Carlo output
(4000-run `equityVsRange`) is demoted to a "check your work" role — it may
confirm a hand-computed estimate, never lead it.

## The unifying insight

Call price, bluff price and defense frequency are the same division read three
ways, against bet size as a fraction of pot:

| Bet | Call needs | Bluff needs folds | Defend (MDF) |
|-----|-----------|-------------------|--------------|
| 1/4 pot | 20% | 20% | 80% |
| 1/3 pot | 25% | 25% | 75% |
| 1/2 pot | 25% | 33% | 67% |
| 3/4 pot | 30% | 43% | 57% |
| pot | 33% | 50% | 50% |
| 2x pot | 40% | 67% | 33% |

Call: `toCall / (pot + toCall)` — already implemented as `potOddsVerdict`.
Bluff: `bet / (pot + bet)`. MDF: `pot / (pot + bet)`.

## Spatial anchors — "look where the money is"

Four chips, fixed positions, one hue each. Fill encodes anchor identity; border
encodes state. Position never changes; only the value does.

| Anchor | Hue token | Position | Teaches |
|--------|-----------|----------|---------|
| CARDS | `--sky` | bottom-left | outs count, Rule of 4/2, hand tier preflop |
| POT | `--amber` | bottom-centre (under board) | price of a call, break-even % |
| VILLAIN | `--coral` | right, mid | defense frequency, price of a bluff |
| STACK | `--emerald` | bottom-right | SPR, commitment threshold |

State grammar (border only, never fill):
- idle — 1px `rgba(255,255,255,.14)`
- live (decision pending on this anchor) — 1px anchor hue, plus a soft ring
- good (hero's line clears the threshold) — 1px `--emerald`
- violated (line fails the threshold) — 1px `--coral`
- dimmed (not applicable this street) — whole chip at 34% opacity, not removed

## Three-level progressive disclosure

1. **Chip** — one number, always visible. e.g. `9 outs`, `3:1 · need 25%`.
2. **Popover** — tap the chip. Shows *the working*: the count, the division, the
   comparison, and the verdict. Max ~5 lines. Dismiss on outside click / Esc.
3. **BottomSheet** — existing component, deep-linked to the right tab
   (`equity` | `lines` | `villain`). Full math, charts, sim confirmation.

Each popover ends with a one-line "at the table" restatement — the thing to
remember when the app isn't there.

## Coach density setting

Persisted alongside session stats. Three modes:
- **Full** — all four chips.
- **Focus** — only the chip whose anchor has a live decision this street.
- **Off** — no chips; PeekStrip and BottomSheet unchanged.

## Engine work (new, pure, unit-tested)

Add to `src/engine/ev.ts`:

```ts
/** Share of folds a bluff must win to break even: bet / (pot + bet). */
export function bluffPrice(bet: number, pot: number): number;

/** Minimum defense frequency vs a bet: pot / (pot + bet). */
export function minDefenseFrequency(bet: number, pot: number): number;

/** Commitment tier from stack-to-pot ratio. */
export function commitmentTier(spr: number):
  { tier: 'committed' | 'shallow' | 'medium' | 'deep'; label: string; note: string };
```

- `spr < 1` committed, `< 3` shallow, `< 6` medium, else deep.
- Both frequency functions return 0 when `bet <= 0`, and clamp to `[0, 1]`.
- `bluffPrice` and `potOddsVerdict(...).required` are the same formula; keep both
  named, since the teaching point is that they coincide.

Add to `src/engine/ranges.ts`:

```ts
export type HandTier = 'premium' | 'strong' | 'speculative' | 'marginal' | 'trash';
/** Preflop tier by membership in top-N% opening ranges. */
export function tierOf(combo: Combo): { tier: HandTier; label: string; topPct: number };
```

Boundaries by top-percent membership: premium ≤ 3%, strong ≤ 10%,
speculative ≤ 20%, marginal ≤ 35%, else trash. Implement by testing membership
in `rangeTopPercent(n)` at each boundary, ascending, first match wins.

Extend `HeroAnalysis` in `src/analysis.ts` with the derived fields so the UI
never recomputes: `bluffPriceAtPot`, `mdfFacing`, `commitment`, `preflopTier`.
`mdfFacing` is `minDefenseFrequency(toCall, pot)`; `bluffPriceAtPot` is
`bluffPrice(pot * 0.75, pot)` (the default suggested semi-bluff size).
`preflopTier` is `null` once `board.length > 0`.

## Session EV — surface `expected`

`SessionStats.expected` is accumulated at `App.tsx:175` and never rendered. Add
a header stat next to "Session EV Lost":

- Label: **EV-Adjusted**, value `money(stats.expected)`.
- Tooltip: "What your decisions were worth, before luck. Net is what actually
  landed in your stack. The gap between the two is variance — over a long
  session it shrinks toward zero, so EV-Adjusted is the honest scoreboard."
- When `hands === 0`, render `—` rather than `$0`, so an empty session doesn't
  read as a result.

Colour Net and EV-Adjusted independently by sign (`--emerald` / `--coral`).

## Per-street chip content

| Street | CARDS | POT | VILLAIN | STACK |
|--------|-------|-----|---------|-------|
| preflop | hand tier + top-% | price of the call if facing a raise, else dimmed | dimmed | SPR after call |
| flop | outs + `×4` estimate | `toCall`, ratio, break-even % | MDF if facing a bet; bluff price if checked to | SPR + commitment tier |
| turn | outs + `×2` estimate | same | same | same |
| river | dimmed (no cards to come) | same | MDF — the pure bluff-catcher spot | committed / not |

## Reframing existing surfaces

- `OutsStrip.tsx` — currently prints `9 × 4 = 36% (Actual: 34%)`, which lets the
  sim win the comparison. Invert it: the counted estimate is the headline, the
  sim is a smaller "sim confirms 34%" line beneath, styled as secondary.
- `PeekStrip.tsx` — leave the Playable Odds hover card as-is. It is the existing
  Level-1 surface and its formula is already explained.

## Constraints

- No new dependencies.
- **Preserve the mobile viewport on desktop.** The app renders inside the
  existing `device-container` / `app-root` phone frame (commit 9b7dbed). Chips
  and popovers must be positioned relative to that frame, never the browser
  viewport — no `position: fixed` against the window, no `100vw`/`100vh`. A
  popover that would overflow the frame flips its side rather than widening it.
- Match `src/styles.css` tokens exactly: `--sky #38bdf8`, `--amber #f59e0b`,
  `--coral #ef4444`, `--emerald #10b981`, `--text-gold #fbbf24`.
- Chips must not overlap seats. Seats are laid out by
  `src/components/seatSlots.ts` — read it before choosing positions.
- Chips `z-index: 4`; popovers `z-index: 8`; BottomSheet must still sit above
  both.
- Keyboard reachable: each chip is a `<button>` with `aria-expanded` and an
  `aria-label` naming the anchor and its value.
- Every new engine function gets unit tests in the matching `*.test.ts`,
  including the boundary rows of the price table above.
