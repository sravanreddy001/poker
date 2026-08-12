import { useCallback, useEffect, useMemo, useState } from 'react';
import { startHand, applyAction, stepBots, HandState } from './engine/game';
import type { Action } from './engine/types';
import { analyseSpot, money, HeroAnalysis, VILLAIN_RANGE_PCT, getOptimalActionRationale } from './analysis';
import { matchActionToCandidate } from './evScoring';
import { handResult } from './sessionUtils';
import { computeAllInAdjustedResult } from './allInAdjustedEV';
import { PokerTable } from './components/PokerTable';
import { ActionBar } from './components/ActionBar';
import { PeekStrip } from './components/PeekStrip';
import { EquityBar } from './components/EquityBar';
import { OutsStrip } from './components/OutsStrip';
import { EVBarChart } from './components/EVBarChart';
import { RangeHeatmap } from './components/RangeHeatmap';
import { BottomSheet, SnapPoint } from './components/BottomSheet';
import { PostRoundReview, ReviewRecord } from './components/PostRoundReview';
import { TerminologyModal } from './components/TerminologyModal';
import { HandRankingsModal } from './components/HandRankingsModal';
import { EducationalModal } from './components/EducationalModal';

const OPTS = { players: 6, stack: 100, bigBlind: 1 };
const STORAGE_KEY = 'poker-trainer-session';

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
  rawEquity: number;
  realizedEquity: number;
  chosen: string;
  best: string;
  evLost: number;
  rationale?: string;
}

export default function App() {
  const [btnSeat, setBtnSeat] = useState(0);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [state, setState] = useState<HandState>(() => stepBots(startHand(seed, OPTS, 0)));
  const [heroStackAtHandStart, setHeroStackAtHandStart] = useState(OPTS.stack); // All players start with OPTS.stack
  // Stacks no longer top up between hands, so a session can actually end: either
  // the hero runs out of chips, or they take everyone else's.
  const [sessionOver, setSessionOver] = useState<null | 'busted' | 'swept'>(null);
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

  const analysis: HeroAnalysis | null = useMemo(
    () => (heroTurn ? analyseSpot(state) : null),
    [heroTurn, state],
  );

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
        rawEquity: analysis.rawEquity,
        realizedEquity: analysis.realizedEquity,
        toCall: analysis.toCall,
        pot: state.pot,
        outsCount: analysis.outs.length,
        evVal: topBest.ev,
        spr: analysis.spr,
      });

      const record: DecisionRecord = {
        street: state.street,
        rawEquity: analysis.rawEquity,
        realizedEquity: analysis.realizedEquity,
        chosen: userOpt ? userOpt.label : (action.type === 'bet' || action.type === 'raise' ? `${action.type} ${action.amount}` : action.type),
        best: topBest.label,
        evLost,
        rationale,
      };

      setDecisions((d) => [...d, record]);
      setLastFeedback(record);
      setRevealed(false);

      if (snapMemory !== 'peek') {
        setSnap(snapMemory);
      } else {
        setSnap('peek');
      }

      setState((s) => stepBots(applyAction(s, action)));
    },
    [analysis, allCandidates, snapMemory, state.street, state.pot],
  );

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
    setState(stepBots(startHand(next, OPTS, nextBtn, nextHandStartStacks)));
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
    setState(stepBots(startHand(seed, OPTS, btnSeat, currentStacks)));
    setDecisions([]);
    setLastFeedback(null);
    setRevealed(false);
    setShowReviewModal(false);
    setSnap('peek');
    setSnapMemory('peek');
  }, [btnSeat, seed, state.players]);

  const resetSession = useCallback(() => {
    const emptyStats = { hands: 0, evLost: 0, actual: 0, adjusted: 0, reveals: 0 };
    setStats(emptyStats);
    localStorage.removeItem(STORAGE_KEY);
    const nextSeed = Math.floor(Math.random() * 1e9);
    setSeed(nextSeed);
    setBtnSeat(0);
    setState(stepBots(startHand(nextSeed, OPTS, 0)));
    setHeroStackAtHandStart(OPTS.stack);
    setSessionOver(null);
    setDecisions([]);
    setLastFeedback(null);
    setRevealed(false);
    setShowReviewModal(false);
  }, []);

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
          <div className="header-icon-group">
            <button
              type="button"
              className="header-icon-btn"
              onClick={toggleCoachDensity}
              title={`Coach Chips: ${coachDensity.toUpperCase()} (💎)`}
              aria-label="Toggle Coach Chips density"
            >
              💎
            </button>
            <button
              type="button"
              className="header-icon-btn"
              onClick={resetSession}
              title="Reset Session Stats & Stacks (🔄)"
              aria-label="Reset Session Stats & Stacks"
            >
              🔄
            </button>
            <button
              type="button"
              className="header-icon-btn"
              onClick={() => setShowEducational(true)}
              title="Informational & Strategy Guides (ℹ️)"
              aria-label="Open Informational Strategy Guides"
            >
              ℹ️
            </button>
            <button
              type="button"
              className="header-icon-btn"
              onClick={() => setShowTerminology(true)}
              title="Pure Glossary & Vocabulary (?)"
              aria-label="Open Terminology Glossary"
            >
              ❓
            </button>
            <button
              type="button"
              className="header-icon-btn"
              onClick={() => setShowHandRankings(true)}
              title="Hand Rankings Ladder & Odds (🪜)"
              aria-label="Open Hand Rankings Ladder"
            >
              🪜
            </button>
          </div>
        </header>

        {/* 2. Main Table & Action Layout */}
        <main className="main-layout">
          {/* Table Zone (Flex: 1) */}
          <section className="table-zone">
            <PokerTable state={state} analysis={analysis} coachDensity={coachDensity} />
          </section>

          {/* Peek Strip (Above Action Bar) */}
          {heroTurn && analysis && (
            <PeekStrip
              realizedEquity={analysis.realizedEquity}
              rawEquity={analysis.rawEquity}
              realizationFactor={analysis.realizationFactor}
              breakEvenOdds={analysis.potOdds.required}
              bestLineLabel={bestLineLabel}
              onOpenSheet={() => handleSnapChange(snapMemory === 'peek' ? 'half' : snapMemory)}
            />
          )}

          {/* Fixed Action Bar Footer */}
          {heroTurn && analysis && (
            <ActionBar
              toCall={analysis.toCall}
              pot={state.pot}
              stack={hero.stack}
              bigBlind={state.bigBlind}
              sizeButtons={sizeButtons}
              onAct={act}
            />
          )}

          {/* Expandable Bottom Sheet */}
          {heroTurn && analysis && (
            <BottomSheet
              snap={snap}
              onSnapChange={handleSnapChange}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            >
              {activeTab === 'equity' && (
                <>
                  <EquityBar
                    rawEquity={analysis.rawEquity}
                    realizedEquity={analysis.realizedEquity}
                    realizationFactor={analysis.realizationFactor}
                    breakEvenOdds={
                      analysis.toCall > 0 ? analysis.toCall / (state.pot + analysis.toCall) : undefined
                    }
                  />
                  <OutsStrip
                    outs={analysis.outs}
                    ruleOfNEstimate={analysis.ruleOfNEstimate}
                    cardsToCome={analysis.cardsToCome}
                    rawEquity={analysis.rawEquity}
                  />
                </>
              )}

              {activeTab === 'lines' && (
                <EVBarChart
                  advice={analysis.advice}
                  potOddsEvOfCall={analysis.potOdds.evOfCall}
                  toCall={analysis.toCall}
                  chosenLabel={lastFeedback?.chosen}
                  revealed={revealed}
                  onReveal={handleReveal}
                  pot={state.pot}
                  realizedEquity={analysis.realizedEquity}
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
