import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startHand, applyAction, stepBotOnce, HandState } from './engine/game';
import type { Action } from './engine/types';
import { analyseSpot, money, HeroAnalysis, VILLAIN_RANGE_PCT, getOptimalActionRationale } from './analysis';
import { matchActionToCandidate } from './evScoring';
import { handResult } from './sessionUtils';
import { computeAllInAdjustedResult } from './allInAdjustedEV';
import { PokerTable } from './components/PokerTable';
import { ActionBar } from './components/ActionBar';
import { PeekStrip } from './components/PeekStrip';
import { CoachChips } from './components/CoachChips';
import { EquityBar } from './components/EquityBar';
import { OutsStrip } from './components/OutsStrip';
import { EVBarChart } from './components/EVBarChart';
import { RangeHeatmap } from './components/RangeHeatmap';
import { BottomSheet, SnapPoint } from './components/BottomSheet';
import { PostRoundReview, ReviewRecord } from './components/PostRoundReview';
import { TerminologyModal } from './components/TerminologyModal';
import { HandRankingsModal } from './components/HandRankingsModal';
import { EducationalModal } from './components/EducationalModal';

const OPTS = { players: 6, stack: 200, bigBlind: 1 };
const STORAGE_KEY = 'poker-trainer-session';
/** Beat between opponent decisions. Long enough to read, short enough to not wait on. */
const BOT_ACTION_MS = 850;

interface SessionStats {
  hands: number;
  evLost: number;
  actual: number;
  adjusted: number;
  reveals: number;
  coachDensity?: 'full' | 'focus' | 'off';
}

function loadStats(): SessionStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { hands: 0, evLost: 0, actual: 0, adjusted: 0, reveals: 0, coachDensity: 'full' };
    const parsed = JSON.parse(raw);
    // Migrate old 'expected' key to 'adjusted' for backwards compatibility
    const adjusted = parsed.adjusted !== undefined ? parsed.adjusted : (parsed.expected || 0);
    return { ...parsed, adjusted, coachDensity: parsed.coachDensity || 'full' };
  } catch {
    return { hands: 0, evLost: 0, actual: 0, adjusted: 0, reveals: 0, coachDensity: 'full' };
  }
}

export interface DecisionRecord {
  street: string;
  winOdds: number;
  chosen: string;
  best: string;
  evLost: number;
  rationale?: string;
  /** The pot as the decision was made, and what it cost to continue. */
  pot: number;
  toCall: number;
  /** Break-even win rate the price demanded; 0 when nothing was owed. */
  priceNeeded: number;
}

export default function App() {
  const [btnSeat, setBtnSeat] = useState(0);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [state, setState] = useState<HandState>(() => startHand(seed, OPTS, 0));
  const [heroStackAtHandStart, setHeroStackAtHandStart] = useState(OPTS.stack); // All players start with OPTS.stack
  // Stacks no longer top up between hands, so a session can actually end: either
  // the hero runs out of chips, or they take everyone else's.
  const [sessionOver, setSessionOver] = useState<null | 'busted' | 'swept'>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Armed ahead of the hero's turn so a check-or-fold decision fires the
  // instant it's legal, instead of waiting on a click. Stays armed across
  // hands until the player turns it off or takes a different action.
  const [autoCheckFold, setAutoCheckFold] = useState(false);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<DecisionRecord | null>(null);
  const [stats, setStats] = useState<SessionStats>(loadStats);

  // Sheet state
  const [snap, setSnap] = useState<SnapPoint>('peek');
  const [snapMemory, setSnapMemory] = useState<SnapPoint>('peek');
  const [activeTab, setActiveTab] = useState<'equity' | 'lines' | 'villain'>('equity');

  // Modal states
  const [showEducational, setShowEducational] = useState(false);
  const [showTerminology, setShowTerminology] = useState(false);
  const [showHandRankings, setShowHandRankings] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const coachDensity = (stats.coachDensity || 'full') as 'full' | 'focus' | 'off';
  const toggleCoachDensity = useCallback(() => {
    const next = coachDensity === 'full' ? 'focus' : coachDensity === 'focus' ? 'off' : 'full';
    setStats((st) => ({ ...st, coachDensity: next }));
  }, [coachDensity]);

  const hero = state.players[0];
  const heroTurn = !state.complete && state.toAct === 0 && !hero.folded;

  // Analysed whenever the hero still has a hand, not only on their turn: the
  // bottom panel stays mounted while the bots act instead of blinking out and
  // back, which was shifting the whole layout between every action.
  const analysis: HeroAnalysis | null = useMemo(
    () => (!state.complete && !hero.folded && hero.hole ? analyseSpot(state) : null),
    [state, hero.folded, hero.hole],
  );

  // The coach row, peek strip and sheet render from the last analysis that
  // existed rather than unmounting the moment one is unavailable — after a
  // fold, at showdown, and in the gap between hands. Panels that come and go
  // resize the layout under the cursor, which is the flicker.
  // The state is kept with it: the numbers behind the chips are read off the
  // pot and the board, so a live state under a frozen analysis would show a
  // price for a pot that has already been awarded.
  const retained = useRef<{ analysis: HeroAnalysis; state: HandState } | null>(null);
  if (analysis) retained.current = { analysis, state };
  const shown = analysis ? { analysis, state } : retained.current;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }, [stats]);

  const handleSnapChange = useCallback((newSnap: SnapPoint) => {
    setSnap(newSnap);
    if (newSnap !== 'peek') setSnapMemory(newSnap);
  }, []);

  const handleReveal = useCallback(() => {
    if (!revealed) {
      setRevealed(true);
      setStats((st) => ({ ...st, reveals: st.reveals + 1 }));
    }
  }, [revealed]);

  const allCandidates = useMemo(() => {
    if (!analysis) return [];
    const list: { label: string; ev: number; amount?: number }[] = [];
    list.push({ label: 'fold', ev: 0 });
    if (analysis.toCall > 0) {
      list.push({ label: 'call', ev: analysis.potOdds.evOfCall });
    }
    analysis.advice.forEach((item) => {
      if (!list.some((c) => c.label === item.label)) {
        list.push({ label: item.label, ev: item.ev, amount: item.amount });
      }
    });
    list.sort((a, b) => b.ev - a.ev);
    return list;
  }, [analysis]);

  const bestLineLabel = useMemo(() => {
    return allCandidates[0]?.label ?? 'check';
  }, [allCandidates]);

  const heroWon = state.complete && state.winners.includes(0);

  const act = useCallback(
    (action: Action) => {
      if (!analysis) return;

      const hero = state.players[0];
      const userOpt = matchActionToCandidate(
        action.type as 'fold' | 'check' | 'call' | 'bet' | 'raise',
        action.type === 'bet' || action.type === 'raise' ? action.amount : undefined,
        allCandidates,
        hero.stack,
        hero.committed,
      );

      const topBest = allCandidates[0] ?? { label: 'check', ev: 0 };
      const userEv = userOpt?.ev ?? 0;
      const rawEvLost = Math.max(0, topBest.ev - userEv);
      const evLost = rawEvLost < 0.1 ? 0 : rawEvLost;

      const rationale = getOptimalActionRationale({
        actionLabel: topBest.label,
        winOdds: analysis.winOdds,
        toCall: analysis.toCall,
        pot: state.pot,
        outsCount: analysis.outs.length,
        evVal: topBest.ev,
        spr: analysis.spr,
      });

      const record: DecisionRecord = {
        street: state.street,
        winOdds: analysis.winOdds,
        chosen: userOpt ? userOpt.label : (action.type === 'bet' || action.type === 'raise' ? `${action.type} ${action.amount}` : action.type),
        best: topBest.label,
        evLost,
        rationale,
        pot: state.pot,
        toCall: analysis.toCall,
        priceNeeded: analysis.potOdds.required,
      };

      setDecisions((d) => [...d, record]);
      setLastFeedback(record);
      setRevealed(false);

      if (snapMemory !== 'peek') {
        setSnap(snapMemory);
      } else {
        setSnap('peek');
      }

      setState((s) => applyAction(s, action));
    },
    [analysis, allCandidates, snapMemory, state.street, state.pot],
  );

  // Auto-fires the moment it's legal: check with nothing to call, fold facing
  // one. Skips a beat so the felt reads before the decision resolves, same as
  // a bot turn does.
  useEffect(() => {
    if (!autoCheckFold || !heroTurn || !analysis) return;
    const timer = setTimeout(() => {
      act(analysis.toCall > 0 ? { type: 'fold' } : { type: 'check' });
    }, BOT_ACTION_MS);
    return () => clearTimeout(timer);
  }, [autoCheckFold, heroTurn, analysis, act]);

  // Fit the 420x880 frame into whatever window the player has, rather than
  // letting a short laptop viewport crush the table into the cards.
  useEffect(() => {
    const fit = () => {
      const scale = Math.min(1, window.innerWidth / 440, window.innerHeight / 900);
      document.documentElement.style.setProperty('--frame-scale', String(scale));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // Opponents act one seat at a time on a fixed beat, so the hand reads like a
  // real table instead of resolving in a single frame. A seat that cannot act
  // is skipped immediately — no dead pause for a player who already folded.
  useEffect(() => {
    if (state.complete || state.players[state.toAct].isHuman) return;
    const p = state.players[state.toAct];
    const canAct = !p.folded && !p.busted && p.stack > 0;
    const timer = setTimeout(() => setState((s) => stepBotOnce(s)), canAct ? BOT_ACTION_MS : 0);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.('.header-menu-wrap')) setMenuOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [menuOpen]);

  const nextHand = useCallback(() => {
    // Compute the win for the CURRENT hand using the hero's stack from the START of this hand.
    const won = handResult(heroStackAtHandStart, hero.stack);
    const evLost = decisions.reduce((n, d) => n + d.evLost, 0);

    // Compute adjusted result: use all-in adjusted EV if snapshot exists, otherwise actual result
    let adjusted = won;
    if (state.allInSnapshot) {
      const adjustedResult = computeAllInAdjustedResult(
        state.allInSnapshot.heroHole,
        state.allInSnapshot.villainHoles,
        state.allInSnapshot.board,
        state.allInSnapshot.heroContribution,
        state.allInSnapshot.finalPot,
      );
      // If computation is not feasible (null), fall back to actual result
      adjusted = adjustedResult !== null ? adjustedResult : won;
    }

    setStats((st) => ({
      hands: st.hands + 1,
      evLost: st.evLost + evLost,
      actual: st.actual + won,
      adjusted: st.adjusted + adjusted,
      reveals: st.reveals,
    }));

    // Stacks carry over without top-up: use current stacks as-is for next hand
    const nextHandStartStacks = state.players.map((p) => p.stack);
    const nextHeroStartStack = nextHandStartStacks[0];

    // A player who cannot post the big blind is out. Dealing on regardless is what
    // produced the "$0 FOLDED forever" seat, so stop the session instead and let
    // the player decide to rebuy.
    const funded = nextHandStartStacks.filter((s) => s >= OPTS.bigBlind).length;
    if (nextHeroStartStack < OPTS.bigBlind) {
      setSessionOver('busted');
      return;
    }
    if (funded < 2) {
      setSessionOver('swept');
      return;
    }

    const nextBtn = (btnSeat + 1) % OPTS.players;
    setBtnSeat(nextBtn);
    const next = seed + 1;
    setSeed(next);
    setState(startHand(next, OPTS, nextBtn, nextHandStartStacks));
    setHeroStackAtHandStart(nextHeroStartStack);
    setDecisions([]);
    setLastFeedback(null);
    setRevealed(false);
    setShowReviewModal(false);
    setSnap('peek');
    setSnapMemory('peek');
  }, [btnSeat, decisions, hero.stack, seed, state.players, heroStackAtHandStart]);

  const replayHand = useCallback(() => {
    const currentStacks = state.players.map((p) => p.stack);
    setState(startHand(seed, OPTS, btnSeat, currentStacks));
    setDecisions([]);
    setLastFeedback(null);
    setRevealed(false);
    setShowReviewModal(false);
    setSnap('peek');
    setSnapMemory('peek');
  }, [btnSeat, seed, state.players]);

  const resetSession = useCallback(() => {
    const emptyStats = { hands: 0, evLost: 0, actual: 0, adjusted: 0, reveals: 0, coachDensity };
    setStats(emptyStats);
    localStorage.removeItem(STORAGE_KEY);
    const nextSeed = Math.floor(Math.random() * 1e9);
    setSeed(nextSeed);
    setBtnSeat(0);
    setState(startHand(nextSeed, OPTS, 0));
    setHeroStackAtHandStart(OPTS.stack);
    setSessionOver(null);
    setDecisions([]);
    setLastFeedback(null);
    setRevealed(false);
    setShowReviewModal(false);
  }, [coachDensity]);

  const sizeButtons = useMemo(() => {
    if (!analysis) return [];
    return analysis.advice;
  }, [analysis]);

  return (
    <div className="device-container">
      <div className="app-root">
        {/* 1. Fixed Header Navigation */}
        <header className="stat-strip">
          <div className="stat-item" title="Total hands played in this training session">
            Hands <b>{stats.hands}</b>
          </div>
          <div className="stat-item" title="Net chip profit or loss across session">
            Net <b style={{ color: stats.actual > 0 ? 'var(--emerald)' : stats.actual < 0 ? 'var(--coral)' : 'var(--text-main)' }}>
              {money(stats.actual, { sign: true })}
            </b>
          </div>
          <div
            className="stat-item"
            title="Your results with all-in coolers smoothed out. When the money went in with cards to come, you are credited your equity share of the pot instead of whatever the board happened to bring. Over time this converges with Net; a large gap means you have been running above or below expectation."
          >
            Adjusted <b style={{ color: stats.adjusted > 0 ? 'var(--emerald)' : stats.adjusted < 0 ? 'var(--coral)' : 'var(--text-main)' }}>
              {stats.hands === 0 ? '—' : money(stats.adjusted, { sign: true })}
            </b>
          </div>
          <div
            className="stat-item"
            title="Cumulative dollar EV surrendered across all hands in this session (increases whenever a sub-optimal move is made)"
          >
            EV Lost <b>{money(stats.evLost)}</b>
          </div>
          {/* One-tap switch between practice (chips hidden, plays like a real
              table) and coach (chips back for the working behind each spot),
              sitting right in the strip instead of a menu tap away. */}
          <button
            type="button"
            className="header-icon-btn coach-toggle-btn"
            onClick={() => setStats((st) => ({ ...st, coachDensity: coachDensity === 'off' ? 'full' : 'off' }))}
            aria-pressed={coachDensity !== 'off'}
            aria-label={coachDensity === 'off' ? 'Coach chips hidden — tap to show' : 'Coach chips visible — tap to hide'}
            title={coachDensity === 'off' ? 'Practice mode — tap to show coach chips' : 'Coach mode — tap to hide coach chips'}
          >
            {coachDensity === 'off' ? '🎯' : '🧠'}
          </button>

          {/* Five emoji buttons competed with the four numbers for the same
              36px strip. One menu, with the actions named in words instead. */}
          <div className="header-menu-wrap">
            <button
              type="button"
              className="header-icon-btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label="Menu"
              title="Menu"
            >
              ☰
            </button>
            {menuOpen && (
              <div className="header-menu" role="menu">
                <button type="button" role="menuitem" onClick={toggleCoachDensity}>
                  <span>Coach chips</span>
                  <span className="header-menu-value">{coachDensity}</span>
                </button>
                <button type="button" role="menuitem" onClick={() => { setShowEducational(true); setMenuOpen(false); }}>
                  Strategy guides
                </button>
                <button type="button" role="menuitem" onClick={() => { setShowTerminology(true); setMenuOpen(false); }}>
                  Glossary
                </button>
                <button type="button" role="menuitem" onClick={() => { setShowHandRankings(true); setMenuOpen(false); }}>
                  Hand rankings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="header-menu-danger"
                  onClick={() => { resetSession(); setMenuOpen(false); }}
                >
                  Reset session
                </button>
              </div>
            )}
          </div>
        </header>

        {/* 2. Main Table & Action Layout */}
        <main className="main-layout">
          {/* Table Zone (Flex: 1) */}
          <section className="table-zone">
            <PokerTable state={state} />
          </section>

          {/* Every coach number in one labelled row, directly above the peek
              strip — they used to be scattered around the outside of the felt. */}
          {shown && (
            <CoachChips
              analysis={shown.analysis}
              state={shown.state}
              coachDensity={coachDensity}
              toCall={shown.analysis.toCall}
            />
          )}

          {/* Peek Strip (Above Action Bar) — one of the "advanced details",
              hidden in practice mode along with the coach chips. */}
          {shown && coachDensity !== 'off' && (
            <PeekStrip
              winOdds={shown.analysis.winOdds}
              winOddsWorking={shown.analysis.winOddsWorking}
              breakEvenOdds={shown.analysis.potOdds.required}
              bestLineLabel={bestLineLabel}
              onOpenSheet={() => handleSnapChange(snapMemory === 'peek' ? 'half' : snapMemory)}
            />
          )}

          {/* Fixed Action Bar Footer */}
          {shown && !state.complete && (
            <ActionBar
              toCall={shown.analysis.toCall}
              pot={shown.state.pot}
              stack={hero.stack}
              bigBlind={shown.state.bigBlind}
              sizeButtons={sizeButtons}
              onAct={(action) => {
                // A manual call/bet/raise overrides autopilot for good — it means
                // the player wants the wheel back, not just this one street.
                if (action.type === 'call' || action.type === 'bet' || action.type === 'raise') {
                  setAutoCheckFold(false);
                }
                act(action);
              }}
              disabled={!heroTurn || !analysis}
              hidePresets={coachDensity === 'off'}
              autoCheckFold={autoCheckFold}
              onToggleAutoCheckFold={() => setAutoCheckFold((v) => !v)}
            />
          )}

          {/* Expandable Bottom Sheet */}
          {shown && (
            <BottomSheet
              snap={snap}
              onSnapChange={handleSnapChange}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            >
              {activeTab === 'equity' && (
                <>
                  <EquityBar
                    winOdds={shown.analysis.winOdds}
                    winOddsWorking={shown.analysis.winOddsWorking}
                    winOddsMath={shown.analysis.winOddsMath}
                    winOddsMethod={shown.analysis.winOddsMethod}
                    breakEvenOdds={
                      shown.analysis.toCall > 0 ? shown.analysis.toCall / (shown.state.pot + shown.analysis.toCall) : undefined
                    }
                    toCall={shown.analysis.toCall}
                    pot={shown.state.pot}
                    handName={shown.analysis.shape.name}
                    handRank={shown.analysis.shape.rank}
                    handOf={shown.analysis.shape.of}
                    tierKey={shown.analysis.preflopTier?.tier}
                  />
                  <OutsStrip
                    outs={shown.analysis.outs}
                    ruleOfNEstimate={shown.analysis.ruleOfNEstimate}
                    cardsToCome={shown.analysis.cardsToCome}
                  />
                </>
              )}

              {activeTab === 'lines' && (
                <EVBarChart
                  advice={shown.analysis.advice}
                  potOddsEvOfCall={shown.analysis.potOdds.evOfCall}
                  toCall={shown.analysis.toCall}
                  chosenLabel={lastFeedback?.chosen}
                  revealed={revealed}
                  onReveal={handleReveal}
                  pot={shown.state.pot}
                  winOdds={shown.analysis.winOdds}
                />
              )}

              {activeTab === 'villain' && <RangeHeatmap rangePct={VILLAIN_RANGE_PCT} />}
            </BottomSheet>
          )}

          {/* Post-Hand Completion Bar (Shows table & cards first!) */}
          {state.complete && (
            <div className="hand-complete-bar">
              <div className="hand-complete-summary">
                <span className="complete-title">
                  {heroWon
                    ? `🎉 You won ${money(state.awardedPot)}!`
                    : `Hand Complete • ${money(state.awardedPot)} Pot Awarded`}
                </span>
                <span className="complete-sub">Hole cards revealed in place on table</span>
              </div>
              {/* The bar takes the action bar's slot and its height, so nothing
                  above it moves when the hand ends. The space the buttons leave
                  behind carries the numbers from the hand instead. */}
              <div className="hand-complete-facts">
                <div className="complete-fact">
                  <span className="complete-fact-label">Final win odds</span>
                  <span className="complete-fact-value">
                    {shown ? `${Math.round(shown.analysis.winOdds * 100)}%` : '—'}
                  </span>
                </div>
                <div className="complete-fact">
                  <span className="complete-fact-label">Decisions</span>
                  <span className="complete-fact-value">{decisions.length}</span>
                </div>
                <div className="complete-fact">
                  <span className="complete-fact-label">EV lost</span>
                  <span className="complete-fact-value">
                    {money(decisions.reduce((sum, d) => sum + d.evLost, 0))}
                  </span>
                </div>
              </div>
              <div className="hand-complete-actions">
                <button
                  type="button"
                  className="deep-math-btn"
                  onClick={() => setShowReviewModal(true)}
                >
                  📊 Deep Math Analysis
                </button>
                <button type="button" className="replay-hand-btn" onClick={replayHand}>
                  🔄 Replay
                </button>
                <button type="button" className="next-hand-primary-btn" onClick={nextHand}>
                  Next Hand →
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Informational & Strategy Guides Modal */}
        <EducationalModal
          isOpen={showEducational}
          onClose={() => setShowEducational(false)}
        />

        {/* Terminology Glossary Modal */}
        <TerminologyModal
          isOpen={showTerminology}
          onClose={() => setShowTerminology(false)}
        />

        {/* Hand Rankings Ladder Modal */}
        <HandRankingsModal
          isOpen={showHandRankings}
          onClose={() => setShowHandRankings(false)}
        />

        {/* Post-Round Deep Math Review Modal (Opened on demand via button) */}
        {state.complete && showReviewModal && (
          <PostRoundReview
            decisions={decisions as ReviewRecord[]}
            state={state}
            heroWon={heroWon}
            onReplay={replayHand}
            onNextHand={nextHand}
            onClose={() => setShowReviewModal(false)}
            seed={seed}
          />
        )}

        {sessionOver && (
          <div className="session-over-overlay" role="dialog" aria-modal="true">
            <div className="session-over-card">
              <h2>{sessionOver === 'busted' ? 'You are out of chips' : 'You have every chip at the table'}</h2>
              <p>
                {sessionOver === 'busted'
                  ? 'Stacks carry over between hands, so there is nothing left to post a blind with.'
                  : 'Nobody else can post a blind, so the game cannot continue.'}
              </p>
              <dl className="session-over-stats">
                <div><dt>Hands</dt><dd>{stats.hands}</dd></div>
                <div><dt>Net</dt><dd>{money(stats.actual, { sign: true })}</dd></div>
                <div><dt>Adjusted</dt><dd>{money(stats.adjusted, { sign: true })}</dd></div>
                <div><dt>EV Lost</dt><dd>{money(stats.evLost)}</dd></div>
              </dl>
              <p className="session-over-note">
                {stats.adjusted > stats.actual
                  ? 'Adjusted sits above Net: the all-ins went in fine and the boards did not cooperate.'
                  : 'Adjusted sits at or below Net: the run-outs were kind to you, so lean on EV Lost to judge the play.'}
              </p>
              <button type="button" className="session-over-btn" onClick={resetSession}>
                Rebuy for {money(OPTS.stack)} and clear stats
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
