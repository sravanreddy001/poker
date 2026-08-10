import { useCallback, useEffect, useMemo, useState } from 'react';
import { startHand, applyAction, stepBots, HandState } from './engine/game';
import type { Action } from './engine/types';
import { analyseSpot, money, HeroAnalysis, VILLAIN_RANGE_PCT } from './analysis';
import { PokerTable } from './components/PokerTable';
import { ActionBar } from './components/ActionBar';
import { PeekStrip } from './components/PeekStrip';
import { EquityBar } from './components/EquityBar';
import { OutsStrip } from './components/OutsStrip';
import { EVBarChart } from './components/EVBarChart';
import { RangeHeatmap } from './components/RangeHeatmap';
import { BottomSheet, SnapPoint } from './components/BottomSheet';
import { PostRoundReview, ReviewRecord } from './components/PostRoundReview';

const OPTS = { players: 6, stack: 100, bigBlind: 1 };
const STORAGE_KEY = 'poker-trainer-session';

interface SessionStats {
  hands: number;
  evLost: number;
  actual: number;
  expected: number;
  reveals: number;
}

const EMPTY_STATS: SessionStats = { hands: 0, evLost: 0, actual: 0, expected: 0, reveals: 0 };

function loadStats(): SessionStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATS;
    return { ...EMPTY_STATS, ...JSON.parse(raw) };
  } catch {
    return EMPTY_STATS;
  }
}

interface DecisionRecord {
  street: string;
  rawEquity: number;
  realizedEquity: number;
  chosen: string;
  best: string;
  evLost: number;
}

export default function App() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [state, setState] = useState<HandState>(() => stepBots(startHand(seed, OPTS)));
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<DecisionRecord | null>(null);
  const [stats, setStats] = useState<SessionStats>(loadStats);

  // Sheet state
  const [snap, setSnap] = useState<SnapPoint>('peek');
  const [snapMemory, setSnapMemory] = useState<SnapPoint>('peek');
  const [activeTab, setActiveTab] = useState<'equity' | 'lines' | 'villain'>('equity');

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
    if (newSnap !== 'peek') {
      setSnapMemory(newSnap);
    }
  }, []);

  const handleReveal = useCallback(() => {
    if (!revealed) {
      setRevealed(true);
      setStats((st) => ({ ...st, reveals: st.reveals + 1 }));
    }
  }, [revealed]);

  const act = useCallback(
    (action: Action, label: string) => {
      if (!analysis) return;

      const checkEv = analysis.advice.find((o) => o.amount === 0)?.ev ?? 0;
      const chosenEv =
        label === 'fold'
          ? 0
          : label === 'call'
            ? analysis.potOdds.evOfCall
            : label === 'check'
              ? checkEv
              : (analysis.advice.find((o) => o.label === label)?.ev ?? 0);

      const bestSize = analysis.advice[0];
      const candidates: { label: string; ev: number }[] = [
        { label: 'fold', ev: 0 },
        ...(analysis.toCall > 0
          ? [{ label: 'call', ev: analysis.potOdds.evOfCall }]
          : [{ label: 'check', ev: checkEv }]),
        { label: bestSize.label, ev: bestSize.ev },
      ];
      const best = candidates.reduce((a, b) => (b.ev > a.ev ? b : a));
      const evLost = Math.max(0, best.ev - chosenEv);

      const record: DecisionRecord = {
        street: state.street,
        rawEquity: analysis.rawEquity,
        realizedEquity: analysis.realizedEquity,
        chosen: label,
        best: best.label,
        evLost,
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
    [analysis, snapMemory, state.street],
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

    const next = seed + 1;
    setSeed(next);
    setState(stepBots(startHand(next, OPTS)));
    setDecisions([]);
    setLastFeedback(null);
    setRevealed(false);
    setSnap('peek');
    setSnapMemory('peek');
  }, [decisions, hero.stack, seed]);

  const replayHand = useCallback(() => {
    setState(stepBots(startHand(seed, OPTS)));
    setDecisions([]);
    setLastFeedback(null);
    setRevealed(false);
    setSnap('peek');
    setSnapMemory('peek');
  }, [seed]);

  const sizeButtons = useMemo(() => {
    if (!analysis) return [];
    const seen = new Set<number>();
    return analysis.advice
      .filter((o) => o.amount > 0 && o.amount > analysis.toCall)
      .sort((a, b) => a.amount - b.amount)
      .filter((o) => (seen.has(o.amount) ? false : (seen.add(o.amount), true)));
  }, [analysis]);

  const heroWon = state.complete && state.winners.includes(0);
  const bestLineLabel = analysis?.advice[0]?.label ?? 'Check';

  return (
    <div className="device-container">
      <div className="app-root">
        {/* 1. Stat Strip Header */}
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
        </header>

        {/* 2. Main Table & Action Layout */}
        <main className="main-layout">
          {/* Table Zone (Flex: 1) */}
          <section className="table-zone">
            <PokerTable state={state} btnSeat={0} />
          </section>

          {/* Peek Strip (Above Action Bar) */}
          {heroTurn && analysis && (
            <PeekStrip
              realizedEquity={analysis.realizedEquity}
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
                />
              )}

              {activeTab === 'villain' && <RangeHeatmap rangePct={VILLAIN_RANGE_PCT} />}
            </BottomSheet>
          )}
        </main>

        {/* Post-Round Feedback Modal Overlay */}
        {state.complete && (
          <PostRoundReview
            decisions={decisions as ReviewRecord[]}
            heroWon={heroWon}
            onReplay={replayHand}
            onNextHand={nextHand}
            seed={seed}
          />
        )}
      </div>
    </div>
  );
}
