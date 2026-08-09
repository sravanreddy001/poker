import { useCallback, useEffect, useMemo, useState } from 'react';
import { startHand, applyAction, stepBots, HandState } from './engine/game';
import type { Action } from './engine/types';
import { analyseSpot, cardLabel, chips, pct, HeroAnalysis, VILLAIN_RANGE_PCT } from './analysis';
import type { Card } from './engine/cards';
import { EquityGauge } from './components/EquityGauge';
import { EVBarChart } from './components/EVBarChart';
import { RangeHeatmap } from './components/RangeHeatmap';
import { BottomSheet } from './components/BottomSheet';
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

function CardView({ card, hidden, fourColor }: { card?: Card; hidden?: boolean; fourColor?: boolean }) {
  if (hidden || card === undefined) return <span className="card back" aria-label="hidden card" />;
  const { rank, suit, red } = cardLabel(card);

  let suitClass = red ? 'red' : 'black';
  if (fourColor) {
    if (suit === '♠') suitClass = 'spades';
    else if (suit === '♥') suitClass = 'hearts';
    else if (suit === '♦') suitClass = 'diamonds';
    else if (suit === '♣') suitClass = 'clubs';
  }

  return (
    <span className={`card ${suitClass}`} aria-label={`${rank}${suit}`}>
      <b>{rank}</b>
      <i>{suit}</i>
    </span>
  );
}

export default function App() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [state, setState] = useState<HandState>(() => stepBots(startHand(seed, OPTS)));
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<DecisionRecord | null>(null);
  const [stats, setStats] = useState<SessionStats>(loadStats);
  const [fourColorDeck, setFourColorDeck] = useState(true);

  const hero = state.players[0];
  const heroTurn = !state.complete && state.toAct === 0 && !hero.folded;

  const analysis: HeroAnalysis | null = useMemo(
    () => (heroTurn ? analyseSpot(state) : null),
    [heroTurn, state],
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }, [stats]);

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
      setState((s) => stepBots(applyAction(s, action)));
    },
    [analysis, state.street],
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
  }, [decisions, hero.stack, seed]);

  const replayHand = useCallback(() => {
    setState(stepBots(startHand(seed, OPTS)));
    setDecisions([]);
    setLastFeedback(null);
    setRevealed(false);
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

  return (
    <div className="app">
      <header>
        <h1>
          Poker Probability Trainer
          <button
            type="button"
            className="deck-toggle-btn"
            onClick={() => setFourColorDeck((p) => !p)}
          >
            {fourColorDeck ? '🎨 4-Color Deck ON' : '♠ 2-Color Deck'}
          </button>
        </h1>
        <div className="session">
          <span className="session-stat-item">Hands <b>{stats.hands}</b></span>
          <span className="session-stat-item">Actual <b>{chips(stats.actual)}bb</b></span>
          <span className="session-stat-item">Expected <b>{chips(stats.expected)}bb</b></span>
          <span className="session-stat-item">EV lost <b>{chips(stats.evLost)}bb</b></span>
          <span className="session-stat-item">Reveals <b>{stats.reveals}</b></span>
        </div>
      </header>

      <main>
        <section className="table-area">
          <div className="opponents">
            {state.players.slice(1).map((p) => (
              <div
                key={p.id}
                className={`seat ${p.folded ? 'folded' : ''} ${
                  state.toAct === p.id && !state.complete ? 'active' : ''
                }`}
              >
                <div className="seat-name">
                  Bot {p.id}
                  {p.id === 1 && <span className="seat-bluff-tag">Bluff 30%</span>}
                </div>
                <div className="seat-cards">
                  <CardView card={p.hole?.[0]} hidden={!state.complete || p.folded} fourColor={fourColorDeck} />
                  <CardView card={p.hole?.[1]} hidden={!state.complete || p.folded} fourColor={fourColorDeck} />
                </div>
                <div className="seat-stack">{chips(p.stack)}bb</div>
                {p.committed > 0 && !state.complete && (
                  <div className="seat-bet">bet {chips(p.committed)}</div>
                )}
                {p.folded && <div className="seat-tag">folded</div>}
                {state.complete && state.winners.includes(p.id) && (
                  <div className="seat-tag won">won</div>
                )}
              </div>
            ))}
          </div>

          <div className="board">
            <div className="street-label">{state.street.toUpperCase()}</div>
            <div className="board-cards">
              {state.board.map((c, i) => (
                <CardView key={i} card={c} fourColor={fourColorDeck} />
              ))}
              {Array.from({ length: 5 - state.board.length }).map((_, i) => (
                <span key={`e${i}`} className="card empty" />
              ))}
            </div>
            <div className="pot-badge">
              {state.complete
                ? `Final Pot: ${chips(state.awardedPot)}bb`
                : `Pot: ${chips(state.pot)}bb`}
            </div>
          </div>

          <div className="hero-wrapper">
            {heroTurn && analysis && (
              <div className="quick-hint-pill">
                ⚡ {analysis.outs.length} Outs x {analysis.cardsToCome === 2 ? 4 : 2} ={' '}
                {analysis.ruleOfNEstimate !== null ? pct(analysis.ruleOfNEstimate) : ''} Rule
                (Actual: {pct(analysis.rawEquity)})
              </div>
            )}

            <div className="hero">
              <div className="seat-name">You (Hero)</div>
              <div className="seat-cards">
                <CardView card={hero.hole?.[0]} fourColor={fourColorDeck} />
                <CardView card={hero.hole?.[1]} fourColor={fourColorDeck} />
              </div>
              <div className="seat-stack">{chips(hero.stack)}bb</div>
              {hero.folded && <div className="seat-tag">folded</div>}
            </div>
          </div>

          {heroTurn && analysis && (
            <div className="actions">
              {analysis.toCall > 0 ? (
                <>
                  <button className="danger" onClick={() => act({ type: 'fold' }, 'fold')}>Fold</button>
                  <button className="success" onClick={() => act({ type: 'call' }, 'call')}>
                    Call {chips(analysis.toCall)}bb
                  </button>
                </>
              ) : (
                <button className="success" onClick={() => act({ type: 'check' }, 'check')}>Check</button>
              )}
              {sizeButtons.map((o) => (
                <button
                  key={o.label}
                  className="primary"
                  onClick={() =>
                    act({ type: analysis.toCall > 0 ? 'raise' : 'bet', amount: o.amount }, o.label)
                  }
                >
                  {analysis.toCall > 0 ? 'Raise to' : 'Bet'} {chips(o.amount)}bb ({o.label})
                </button>
              ))}
            </div>
          )}

          {/* Expandable Bottom Sheet for Mobile Math & Deep Analysis */}
          {heroTurn && analysis && (
            <BottomSheet title="Math & Deep Analysis" defaultExpanded={true}>
              <EquityGauge
                rawEquity={analysis.rawEquity}
                realizedEquity={analysis.realizedEquity}
              />

              <EVBarChart
                advice={analysis.advice}
                potOddsEvOfCall={analysis.potOdds.evOfCall}
                toCall={analysis.toCall}
                chosenLabel={lastFeedback?.chosen}
              />

              <RangeHeatmap rangePct={VILLAIN_RANGE_PCT} />
            </BottomSheet>
          )}
        </section>

        <aside className="panels">
          {heroTurn && analysis && (
            <>
              <div className="panel">
                <h2>Your Equity Details</h2>
                <div className="stat-row">
                  <span>Raw Equity</span>
                  <b>{pct(analysis.rawEquity)}{analysis.exact ? '' : ' ±'}</b>
                </div>
                <div className="stat-row">
                  <span>Realized Equity</span>
                  <b>{pct(analysis.realizedEquity)}</b>
                </div>
                <div className="stat-row muted">
                  <span>Realization Multiplier</span>
                  <b>{pct(analysis.realizationFactor)}</b>
                </div>
              </div>

              {analysis.outs.length > 0 && (
                <div className="panel">
                  <h2>Outs Shortcut</h2>
                  <div className="stat-row">
                    <span>Outs Count</span>
                    <b>{analysis.outs.length} cards</b>
                  </div>
                  {analysis.ruleOfNEstimate !== null && (
                    <div className="stat-row">
                      <span>Shortcut ({analysis.outs.length} × {analysis.cardsToCome === 2 ? 4 : 2})</span>
                      <b>{pct(analysis.ruleOfNEstimate)}</b>
                    </div>
                  )}
                </div>
              )}

              <div className="panel">
                <h2>Advisor Peek</h2>
                {revealed ? (
                  <ul className="advice">
                    {analysis.advice.map((o, i) => (
                      <li key={o.label} className={i === 0 ? 'best' : ''}>
                        <span>{o.label}</span>
                        <b>
                          {o.ev >= 0 ? '+' : ''}
                          {chips(o.ev)}bb
                        </b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <button
                    className="ghost"
                    onClick={() => {
                      setRevealed(true);
                      setStats((st) => ({ ...st, reveals: st.reveals + 1 }));
                    }}
                  >
                    Show Advice (Logged)
                  </button>
                )}
              </div>
            </>
          )}

          {lastFeedback && !heroTurn && !state.complete && (
            <div className="panel">
              <h2>Last decision</h2>
              <div className="stat-row">
                <span>You chose</span>
                <b>{lastFeedback.chosen}</b>
              </div>
              <div className="stat-row">
                <span>Max EV line</span>
                <b>{lastFeedback.best}</b>
              </div>
              <div className="stat-row">
                <span>EV lost</span>
                <b className={lastFeedback.evLost < 0.5 ? 'good' : 'bad'}>
                  {chips(lastFeedback.evLost)}bb
                </b>
              </div>
            </div>
          )}
        </aside>
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
  );
}
