# Mobile round-table layout — design spec

**Date:** 2026-08-09
**Status:** awaiting approval
**Mocks:** https://claude.ai/code/artifact/e9c82735-b53b-4e28-97c8-dd452e412f22

---

## 1. Problem

The trainer renders every teaching surface at once, stacked, in one scroll. On a 390×844 viewport this puts the action buttons — the only controls the user touches — below the fold, behind a 180px equity donut and a 169-cell range matrix.

Three defects cause it:

| # | Defect | Location |
|---|---|---|
| 1 | Action buttons are inline in the felt, above an expanded drawer. Opening the drawer pushes them out of the viewport. | `src/App.tsx:254` |
| 2 | `BottomSheet` is a static block (`margin-top: 16px`) with no fixed position, scrim, snap points, or safe-area inset — and ships `defaultExpanded={true}`. | `src/components/BottomSheet.tsx:17`, `src/styles.css:651`, `src/App.tsx:282` |
| 3 | Every figure renders twice: equity in the gauge *and* "Your Equity Details"; outs in the hint pill *and* "Outs Shortcut"; advice in `EVBarChart` *and* "Advisor Peek" — the last of which is supposed to be gated behind a logged reveal. | `src/App.tsx:283-296` vs `src/App.tsx:303-360` |

Defect 3 is the root cause. The desktop layout keeps two parallel homes for the same data (the sheet and the `aside`), and the mobile breakpoint just stacks both. The fix is one home per fact, not more media queries.

Two smaller correctness bugs surfaced while auditing and are in scope because the new layout makes them visible:

- `VILLAIN_RANGE_PCT = 0.25` (`src/analysis.ts:12`), but `RangeHeatmap` defaults `rangePct` to `0.3` and its inclusion rule is an invented heuristic. The matrix disagrees with the engine and never reflects the actual hand.
- `inPosition: true` is hardcoded (`src/analysis.ts:59`). Hero position is asserted, not derived from the seat. The round table draws a dealer button, so a wrong value becomes a visible contradiction.

## 2. Goals

- Board, pot, hero cards and action buttons simultaneously visible at every decision point, at 390×844 and above.
- Detail reachable without leaving the table; expandable in graded steps rather than all-or-nothing.
- Each figure has exactly one rendering component and one container per breakpoint.
- Table reads as a poker table: oval felt, seats around the rail, visible dealer button.
- Palette restricted to black, red, and card-bone. Two-color deck.
- All money displayed in dollars.

## 3. Non-goals

- Landscape orientation. Portrait only for this pass.
- Changing the engine, equity math, or bot logic. Display layer only, except the two correctness bugs named in §1.
- Multi-table, tournament structures, or variable blind levels.
- A desktop redesign. Desktop reuses the same components in a right rail; its layout is otherwise untouched.

## 4. Visual system

### 4.1 Palette

| Token | Value | Use |
|---|---|---|
| `--felt-out` | `#120A0B` | Felt edge, table gradient outer stop |
| `--felt-in` | `#34181A` | Felt centre, gradient inner stop |
| `--rail` | `#241819` | Oval border |
| `--red` | `#D92D20` | Single accent: active seat, best-line marker, break-even threshold, EV loss, in-range combos, primary action |
| `--red-dim` | `#7D1E18` | Bet chip borders, mixed-frequency combos |
| `--bone` | `#F4F1EC` | Card faces, primary text, positive-magnitude bars |
| `#C62222` | — | Hearts and diamonds pips (card faces only) |

Greys are derived as `rgba(255,255,255,α)` over the felt, not defined separately.

**Semantic encoding rule.** With one accent, good/bad cannot both be hues. Magnitude is carried by luminance — bright bone for the strongest line, dimmed bone for weaker ones — and red is reserved for what costs the player: the break-even threshold, negative EV, the villain's continuing range. The best line is marked with a bone outline, not a colour substitution.

This is an improvement on the old teal/gold pairing for the equity bar specifically: the user's bone bar either clears the red line or it does not, and that reads without a legend.

### 4.2 Deck

Two colours only. Spades and clubs `#14100F`; hearts and diamonds `#C62222`.

Consequence: `fourColorDeck` state (`src/App.tsx:71`), the `deck-toggle-btn` control (`src/App.tsx:170`), the `fourColor` prop threaded through every `CardView` call site, and the `.spades/.hearts/.diamonds/.clubs` rules (`src/styles.css:219-231`) are all deleted. `CardView` reduces to `{ card?, hidden? }`.

### 4.3 Currency

The engine stays in big blinds. Conversion happens at the display boundary only.

```ts
// src/analysis.ts — replaces chips()
export const BLIND_SIZE = 1; // dollars per big blind

export function money(bb: number, opts?: { sign?: boolean }): string {
  const v = bb * BLIND_SIZE;
  const body = Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
  if (!opts?.sign) return body;
  return v > 0 ? `+${body}` : v < 0 ? `-$${Math.abs(v).toFixed(2)}` : body;
}
```

`chips()` is removed. Every call site becomes `money()`. EV values pass `{ sign: true }`. No equity or EV computation touches dollars.

### 4.4 Table geometry

Six fixed seat slots as absolutely-positioned children of the oval, each `transform: translate(-50%, -50%)` so it straddles the rail.

| Seat | `left` | `top` |
|---|---|---|
| Hero | 50% | 100% |
| Left-lower | 0% | 74% |
| Left-upper | 0% | 26% |
| Top | 50% | 0% |
| Right-upper | 100% | 26% |
| Right-lower | 100% | 74% |

Oval: `196 × 288`, `border-radius: 50%`, radial gradient `--felt-in` → `--felt-out`, 5px `--rail` border. Seat width 54px, so the widest point measures 250px — fits 320px minus 2×24px padding with margin to spare.

Board cards `27 × 37` centred at 31% height; hole cards `34 × 47` centred at 76%. Both sit inside the ellipse's available width at those heights (181px and 167px respectively) with room over.

Bet chips and the dealer button are siblings of the seats at their own coordinates. **The dealer button position is derived from the button seat, not hardcoded** — this is what makes position legible, and it is why §1's `inPosition` bug must be fixed alongside.

Cost: the oval needs ~330px of vertical, roughly 40px more than a flat rail, taken from the sheet's budget. Paid for by making position visible rather than stated.

## 5. Layout architecture

Three fixed-purpose zones, top to bottom, in a `100dvh` flex column:

```
┌──────────────────────────────┐
│ stat strip          ~30px    │  hands · net · surrendered
├──────────────────────────────┤
│                              │
│ table (flex: 1)   ~330px     │  oval, seats, board, pot, hole cards
│                              │
├──────────────────────────────┤
│ peek                ~38px    │  realized equity · best line · "Math ▲"
├──────────────────────────────┤
│ action bar         ~106px    │  2×2 grid, safe-area padded
└──────────────────────────────┘
```

The table zone is the only one that flexes. Everything else is fixed height, so the buttons cannot move.

The sheet overlays this stack at three snap points:

| Snap | Height | Contains |
|---|---|---|
| `peek` | 38px (the strip above; sheet not presented) | Realized equity, best-line label |
| `half` | 64% of screen | Equity bar, outs, EV lines |
| `full` | 78% of screen | Adds villain range, narrowing trace |

At `half` and above a scrim covers the table and the sheet takes focus.

### 5.1 Height budget at 390×844

| Zone | Budget |
|---|---|
| Browser chrome (worst case, `dvh` accounted) | ~120 |
| Stat strip | 30 |
| Table | flex, ≥330 |
| Peek | 38 |
| Action bar incl. safe area | 106 |
| **Remaining slack** | ~220 |

The table absorbs slack. Below ~600px of usable height the oval scales down via `clamp()` on its width/height rather than clipping.

## 6. Component inventory

### New

| Component | Responsibility |
|---|---|
| `PokerTable` | Oval felt, seat placement, dealer button, bet chips, board, pot, hero hole cards. Pure presentation from `HandState`. |
| `Seat` | One seat badge: name, card backs or revealed cards, stack, folded/active state. |
| `ActionBar` | Fixed footer. Fold / Call / bet-size buttons with dollar subtitles. Owns safe-area padding. |
| `PeekStrip` | One-line always-visible readout. Realized equity and best-line label. Tap target opens the sheet to `half`. |
| `EquityBar` | Replaces `EquityGauge`. Stacked horizontal bar: raw (dim bone), realized (bone), break-even (red rule). |
| `OutsStrip` | Renders each out as a card face. Shows the Rule-of-4 estimate against the true figure. |

### Changed

| Component | Change |
|---|---|
| `BottomSheet` | Becomes a real sheet: `position: fixed`, scrim, three snap points, drag-to-resize, focus trap, `Escape` to dismiss. Prop becomes `snap: 'peek' \| 'half' \| 'full'` with `onSnapChange`, controlled by `App`. |
| `EVBarChart` | Bone/dim-bone/red fills per §4.1. Dollar values. Best line marked by outline. |
| `RangeHeatmap` | Fed the real narrowed range and a live combo count. Red / dim-red / empty cells. Default prop removed — `rangePct` becomes required so it cannot silently disagree with the engine. |
| `PostRoundReview` | Internal scroll (`max-height: 85dvh; overflow-y: auto`). Emoji replaced with a bone/red left rule. Dollar values. |
| `CardView` | `fourColor` prop and four-colour branch removed. |

### Deleted

- `EquityGauge` and its `.equity-gauge-*` rules (`src/styles.css:424-509`).
- `aside.panels` and its three duplicate blocks (`src/App.tsx:303-360`).
- `.quick-hint-pill` (`src/App.tsx:236`) — superseded by `PeekStrip`.
- `deck-toggle-btn`, `fourColorDeck` state, four-colour CSS.
- `chips()`.

## 7. Single source of truth

Each figure gets exactly one component. Container varies by breakpoint; the component does not.

| Figure | Component | Mobile container | Desktop container |
|---|---|---|---|
| Raw / realized / break-even equity | `EquityBar` | Sheet, `half` | Right rail |
| Realization multiplier and its causes | `EquityBar` detail rows | Sheet, `half` | Right rail |
| Outs | `OutsStrip` | Sheet, `half` | Right rail |
| Pot odds | `EVBarChart` header | Sheet, `half` | Right rail |
| EV per line | `EVBarChart` | Sheet, `half` | Right rail |
| Villain range | `RangeHeatmap` | Sheet, `full` | Right rail |
| Realized equity + best line (summary) | `PeekStrip` | Peek zone | Right rail header |
| Session totals | `SessionStats` | Stat strip (3 of 5) + review modal | Header |

**The advisor gate.** Today `EVBarChart` renders full EV per line in the sheet while "Advisor Peek" charges a logged reveal for the same data. One of the two has to give. Decision: `EVBarChart` renders bar *shapes* with values masked until revealed; `PeekStrip` shows the best-line *label* only, never its EV. The reveal unmasks values and increments `stats.reveals`. This keeps the teaching loop honest — the learner sees that lines differ before being told by how much.

## 8. Sheet interaction

- **Gestures:** drag the grabber or sheet header to move between snaps; velocity over threshold skips a snap. Tap scrim → `peek`. `Escape` → `peek`.
- **Default snap:** `peek` on every new decision. Never `full` on first paint.
- **Snap memory:** if the user opened to `half` or `full` on the previous street, reopen there for the rest of the hand; reset to `peek` on `nextHand()`.
- **Tabs within the sheet:** Equity / Lines / Villain. Selecting Villain from `half` promotes to `full` automatically, since the matrix does not fit at `half`.
- **Reduced motion:** `prefers-reduced-motion: reduce` replaces the spring transition with an instant snap.

## 9. Accessibility

- Sheet is `role="dialog"` `aria-modal="true"` at `half` and `full`, with focus trapped and returned to the peek trigger on close. At `peek` it is not a dialog.
- Action buttons keep a ≥44px touch target and announce the amount: `aria-label="Raise to twelve dollars, pot sized"`.
- Colour is never the sole channel. Best line carries an outline *and* a "best" text marker; EV sign is in the printed value; the break-even threshold is a labelled rule, not a bare colour.
- Contrast: bone on felt is ~14:1; red `#D92D20` on `#120A0B` is ~4.9:1 — passes AA for the ≥14px text it is used on, and it is never used for body copy.
- The oval is decorative; seats expose `aria-label` with name, stack, and state. Board and hole cards are a labelled list.

## 10. Testing

**Unit**

- `money()`: integers, two-decimal cents, explicit sign, zero, negatives.
- Seat slot assignment for 2–6 players — no two seats resolve to the same slot; hero is always bottom.
- Dealer-button position derives from the button seat across a full orbit.
- `inPosition` derives correctly from hero seat vs. remaining actors (regression for the `analysis.ts:59` hardcode).
- `RangeHeatmap` combo count matches the range it was handed (regression for the 0.25/0.3 disagreement).

**Component**

- Sheet: snap transitions, scrim dismiss, `Escape`, focus trap and restore, `peek` default on new decision, snap memory across streets, reset on `nextHand()`.
- Advisor gate: EV values masked before reveal, unmasked after, `stats.reveals` incremented exactly once per reveal.
- `ActionBar` renders one button per available size and never truncates a label.

**Layout regression**

Playwright at 390×844, 360×740, and 320×568:
- action bar fully within viewport at every snap;
- board, pot and hole cards visible at `peek`;
- `document.body.scrollWidth === clientWidth` (no horizontal scroll);
- review modal scrolls internally with four decisions logged.

The existing 77-test suite must stay green; it runs in ~6.9s and that budget should hold.

## 11. Alternatives considered

**B — Segmented deck.** Bottom tab bar: Table / Math / Villain / Session, each full height. Gives the largest oval and the most readable matrix, and is the cheapest to build — no drag physics. Rejected because it costs a tap per street to see any math, which is the wrong friction to add to a trainer's core loop, and because the board and the numbers are never on screen together.

**C — Felt HUD.** Translucent chips on the felt, expanding in place. Rejected: it got worse under the round table, not better. On a flat rail the chips had free horizontal space above and below the board; the ellipse fills that space with cards, pushing chips into a bottom row — at which point they are a less capable version of A's peek strip. Expanding a chip forces the table to shrink anyway, which is what the sheet already does, better.

C's expand-in-place chips remain a plausible refinement of `PeekStrip` once A is stable.

## 12. Open questions

1. **Blind size.** `BLIND_SIZE = 1` makes the 100bb stack read as `$100`. If the intent is a recognisable stake (`$0.50/$1`, `$1/$2`), the constant changes and every displayed figure scales. Needs a decision before the formatter lands.
2. **Seat count.** Slots are specified for 6-max, matching `OPTS.players = 6`. If shorter tables are ever wanted, the slot table becomes a function of player count.
3. **Range narrowing.** §6 assumes a real narrowed range exists to feed `RangeHeatmap`. If the engine cannot yet produce one per street, the Villain tab ships showing the static opening range with an explicit "opening range, not narrowed" label rather than implying precision it does not have.

## 13. Build order

1. `money()` formatter; delete `chips()`; update all call sites. *(No layout risk; unblocks everything else.)*
2. Delete the four-colour deck and `aside.panels`. *(Pure deletion. Largest single reduction in duplicate state.)*
3. `ActionBar` as a fixed footer with safe-area padding; `100dvh`.
4. `PokerTable` + `Seat` — oval, slots, dealer button. Fix `inPosition` derivation in the same change.
5. `EquityBar` replacing `EquityGauge`; `OutsStrip`.
6. `BottomSheet` rewrite: snap points, scrim, gestures, focus management. `PeekStrip`.
7. Advisor gate: mask EV values in `EVBarChart` until revealed.
8. `RangeHeatmap` fed the real range with a required `rangePct`; or the labelled fallback from §12.3.
9. `PostRoundReview` internal scroll and palette pass.
10. Playwright layout regressions at three widths.

Steps 1–3 are independently shippable and fix defect 1 and most of defect 3 on their own.
