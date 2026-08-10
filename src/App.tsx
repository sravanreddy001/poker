import { useCallback, useEffect, useMemo, useState } from 'react';
import { startHand, applyAction, stepBots, HandState } from './engine/game';
import type { Action } from './engine/types';
import { analyseSpot, money, HeroAnalysis, VILLAIN_RANGE_PCT, getOptimalActionRationale } from './analysis';
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
  expected: number;
  reveals: number;
}

function loadStats(): SessionStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { hands: 0, evLost: 0, actual: 0, expected: 0, reveals: 0 };
    return JSON.parse(raw);
  } catch {
    return { hands: 0, evLost: 0, actual: 0, expected: 0, reveals: 0 };
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
      const label =
        action.type === 'bet' || action.type === 'raise'
          ? `${action.type} ${action.amount}`
          : action.type;

      const userOpt = allCandidates.find((c) => c.label.toLowerCase() === label.toLowerCase());
      const topBest = allCandidates[0] ?? { label: 'check', ev: 0 };
      const userEv = userOpt ? userOpt.ev : -10;
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
        chosen: label,
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
    const won = hero.stack - OPTS.stack;
    const evLost = decisions.reduce((n, d) => n + d.evLost, 0);

    setStats((st) => ({
      hands: st.hands + 1,
      evLost: st.evLost + evLost,
      actual: st.actual + won,
      expected: st.expected + won + evLost,
      reveals: st.reveals,
    }));

    const nextBtn = (btnSeat + 1) % OPTS.players;
    setBtnSeat(nextBtn);
    const next = seed + 1;
    setSeed(next);
    setState(stepBots(startHand(next, OPTS, nextBtn)));
    setDecisions([]);
    setLastFeedback(null);
    setRevealed(false);
    setShowReviewModal(false);
    setSnap('peek');
    setSnapMemory('peek');
  }, [btnSeat, decisions, hero.stack, seed]);

  const replayHand = useCallback(() => {
    setState(stepBots(startHand(seed, OPTS, btnSeat)));
    setDecisions([]);
    setLastFeedback(null);
    setRevealed(false);
    setShowReviewModal(false);
    setSnap('peek');
    setSnapMemory('peek');
  }, [btnSeat, seed]);

  const sizeButtons = useMemo(() => {
    if (!analysis) return [];
    return analysis.advice;
  }, [analysis]);

  return (
    <div className="app-viewport">
      <div className="app-device-container">
        {/* 1. Fixed Header Navigation */}
        <header className="stat-strip">
          <div className="stat-item">
            Hands <b>{stats.hands}</b>
          </div>
          <div className="stat-item">
            Net <b>{money(stats.actual, { sign: true })}</b>
          </div>
          <div className="stat-item">
            EV Lost <b>{money(stats.evLost)}</b>
          </div>
          <div className="header-icon-group">
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
            <PokerTable state={state} />
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
      </div>
    </div>
  );
}
