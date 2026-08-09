import { useCallback, useEffect, useMemo, useState } from 'react';
import { startHand, applyAction, stepBots, HandState } from './engine/game';
import type { Action } from './engine/types';
import { analyseSpot, cardLabel, chips, pct, HeroAnalysis, VILLAIN_RANGE_PCT } from './analysis';
import type { Card } from './engine/cards';

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

function CardView({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (hidden || card === undefined) return <span className="card back" aria-label="hidden card" />;
  const { rank, suit, red } = cardLabel(card);
  return (
    <span className={`card ${red ? 'red' : 'black'}`} aria-label={`${rank}${suit}`}>
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

      // EV of what was actually chosen. Calling is not one of the bet sizes, so
      // it is scored from the pot-odds verdict rather than the size sweep.
      const checkEv = analysis.advice.find((o) => o.amount === 0)?.ev ?? 0;
      const chosenEv =
        label === 'fold'
          ? 0
          : label === 'call'
            ? analysis.potOdds.evOfCall
            : label === 'check'
              ? checkEv
              : (analysis.advice.find((o) => o.label === label)?.ev ?? 0);

      // The best available line includes folding and calling, not just betting.
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

  /**
   * One button per distinct amount. Small pots collapse several pot fractions
   * onto the same number of chips, and identical buttons are just noise.
   */
  const sizeButtons = useMemo(() => {
    if (!analysis) return [];
    const seen = new Set<number>();
    return analysis.advice
      .filter((o) => o.amount > 0 && o.amount > analysis.toCall)
      .sort((a, b) => a.amount - b.amount)
      .filter((o) => (seen.has(o.amount) ? false : (seen.add(o.amount), true)));
  }, [analysis]);

  const showdownReached = state.complete && state.players.filter((p) => !p.folded).length > 1;
  const heroWon = state.complete && state.winners.includes(0);
  const totalEvLost = decisions.reduce((n, d) => n + d.evLost, 0);

  // Folding is not a loss to explain away as variance — there was no showdown to
  // run bad in. A fold is judged only on whether it was the highest-EV line.
  const verdict = !state.complete
    ? null
    : hero.folded
      ? totalEvLost < 0.5
        ? { kind: 'earned', text: 'Disciplined fold — the price was wrong. Nothing lost.' }
        : {
            kind: 'consequence',
            text: `Loose fold — continuing was worth ${chips(totalEvLost)} more. See the review.`,
          }
      : totalEvLost < 0.5 && !heroWon
        ? { kind: 'variance', text: 'Variance — your decisions were sound. This one was luck.' }
        : totalEvLost >= 0.5 && !heroWon
          ? { kind: 'consequence', text: 'Consequence — this loss was earned. See the review.' }
          : totalEvLost >= 0.5 && heroWon
            ? { kind: 'won-despite', text: 'Won despite — you were −EV and got away with it.' }
            : { kind: 'earned', text: 'Earned — good decisions, good result.' };

  return (
    <div className="app">
      <header>
        <h1>Poker Probability Trainer</h1>
        <div className="session">
          <span>Hands {stats.hands}</span>
          <span>Actual {chips(stats.actual)}bb</span>
          <span>Expected {chips(stats.expected)}bb</span>
          <span>EV lost {chips(stats.evLost)}bb</span>
          <span>Reveals {stats.reveals}</span>
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
                <div className="seat-name">Bot {p.id}</div>
                <div className="seat-cards">
                  <CardView card={p.hole?.[0]} hidden={!state.complete || p.folded} />
                  <CardView card={p.hole?.[1]} hidden={!state.complete || p.folded} />
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
                <CardView key={i} card={c} />
              ))}
              {Array.from({ length: 5 - state.board.length }).map((_, i) => (
                <span key={`e${i}`} className="card empty" />
              ))}
            </div>
            <div className="pot">
              {state.complete
                ? `Final pot ${chips(state.awardedPot)}bb`
                : `Pot ${chips(state.pot)}bb`}
            </div>
          </div>

          <div className="hero">
            <div className="seat-name">You</div>
            <div className="seat-cards">
              <CardView card={hero.hole?.[0]} />
              <CardView card={hero.hole?.[1]} />
            </div>
            <div className="seat-stack">{chips(hero.stack)}bb</div>
            {hero.folded && <div className="seat-tag">folded</div>}
          </div>

          {heroTurn && analysis && (
            <div className="actions">
              {/* Folding for free is never right, and offering it is a misclick trap. */}
              {analysis.toCall > 0 ? (
                <>
                  <button onClick={() => act({ type: 'fold' }, 'fold')}>Fold</button>
                  <button onClick={() => act({ type: 'call' }, 'call')}>
                    Call {chips(analysis.toCall)}
                  </button>
                </>
              ) : (
                <button onClick={() => act({ type: 'check' }, 'check')}>Check</button>
              )}
              {sizeButtons.map((o) => (
                <button
                  key={o.label}
                  onClick={() =>
                    act({ type: analysis.toCall > 0 ? 'raise' : 'bet', amount: o.amount }, o.label)
                  }
                >
                  {analysis.toCall > 0 ? 'Raise to' : 'Bet'} {chips(o.amount)}
                  <small> · {o.label}</small>
                </button>
              ))}
            </div>
          )}

          {state.complete && (
            <div className="hand-over">
              <div className={`verdict ${verdict?.kind}`}>{verdict?.text}</div>
              <div className="result">
                {heroWon
                  ? `You won ${chips(state.awardedPot)}bb.`
                  : hero.folded
                    ? `You folded ${chips(OPTS.stack - hero.stack)}bb into the pot.`
                    : `You lost ${chips(OPTS.stack - hero.stack)}bb.`}{' '}
                {showdownReached ? 'Showdown.' : 'No showdown.'}
              </div>
              <button className="primary" onClick={nextHand}>
                Next hand
              </button>
            </div>
          )}
        </section>

        <aside className="panels">
          {heroTurn && analysis && (
            <>
              <div className="panel">
                <h2>Your equity</h2>
                <div className="stat-row">
                  <span>Raw</span>
                  <b>
                    {pct(analysis.rawEquity)}
                    {analysis.exact ? '' : ' ±'}
                  </b>
                </div>
                <div className="stat-row">
                  <span>Realized</span>
                  <b>{pct(analysis.realizedEquity)}</b>
                </div>
                <div className="stat-row muted">
                  <span>Realization</span>
                  <b>{pct(analysis.realizationFactor)}</b>
                </div>
                <p className="note">
                  Raw is what you win at showdown. Realized is what you actually collect once
                  folding and later betting are counted. Pot odds use realized.
                </p>
              </div>

              {analysis.outs.length > 0 && (
                <div className="panel">
                  <h2>Outs</h2>
                  <div className="stat-row">
                    <span>Cards that put you ahead</span>
                    <b>{analysis.outs.length}</b>
                  </div>
                  {analysis.ruleOfNEstimate !== null && (
                    <>
                      <div className="stat-row">
                        <span>
                          {analysis.outs.length} × {analysis.cardsToCome === 2 ? 4 : 2}
                        </span>
                        <b>{pct(analysis.ruleOfNEstimate)}</b>
                      </div>
                      <div className="stat-row muted">
                        <span>Shortcut error</span>
                        <b>{pct(Math.abs(analysis.ruleOfNEstimate - analysis.rawEquity))}</b>
                      </div>
                    </>
                  )}
                  <p className="note">
                    At a real table there is no readout. Count outs, then multiply by 4 with two
                    cards to come or 2 with one.
                  </p>
                </div>
              )}

              <div className="panel">
                {/*
                  With nothing to call there are no pot odds to compute — every
                  row would read zero and the EV line would price a call that is
                  not on offer. Show the share of the pot equity is worth instead.
                */}
                <h2>{analysis.toCall > 0 ? 'Pot odds' : 'Pot equity'}</h2>
                {analysis.toCall > 0 ? (
                  <>
                    <div className="stat-row">
                      <span>To call</span>
                      <b>{chips(analysis.toCall)}bb</b>
                    </div>
                    <div className="stat-row">
                      <span>Equity needed</span>
                      <b>{pct(analysis.potOdds.required)}</b>
                    </div>
                    <div className="stat-row">
                      <span>You have</span>
                      <b>{pct(analysis.potOdds.actual)}</b>
                    </div>
                    <div className="stat-row">
                      <span>EV of calling</span>
                      <b className={analysis.potOdds.evOfCall >= 0 ? 'good' : 'bad'}>
                        {analysis.potOdds.evOfCall >= 0 ? '+' : ''}
                        {chips(analysis.potOdds.evOfCall)}bb
                      </b>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="stat-row">
                      <span>Pot</span>
                      <b>{chips(state.pot)}bb</b>
                    </div>
                    <div className="stat-row">
                      <span>Your share of it</span>
                      <b>{pct(analysis.potOdds.actual)}</b>
                    </div>
                    <div className="stat-row">
                      <span>Worth to you if checked down</span>
                      <b className="good">
                        {chips(analysis.potOdds.actual * state.pot)}bb
                      </b>
                    </div>
                  </>
                )}
                <div className="stat-row muted">
                  <span>SPR</span>
                  <b>{analysis.spr.toFixed(1)}</b>
                </div>
              </div>

              <div className="panel">
                <h2>Opponents</h2>
                <div className="stat-row">
                  <span>Assumed range</span>
                  <b>top {pct(VILLAIN_RANGE_PCT)}</b>
                </div>
                {analysis.bluffFreq > 0 && (
                  <div className="stat-row">
                    <span>Bluff frequency here</span>
                    <b>{pct(analysis.bluffFreq)}</b>
                  </div>
                )}
                <p className="note">
                  {analysis.bluffFreq > 0
                    ? 'Bots are mechanical. Their bluff frequency is published, so calling is arithmetic, not mind-reading.'
                    : 'Bots do not bluff preflop — any aggression here is a real hand from the top of that range.'}
                </p>
                <p className="note">
                  They call on pot odds plus a premium that grows with your bet: 10 points of
                  equity per pot-sized bet, capped at 25. Big bets fold out more hands, but the
                  ones that call are stronger.
                </p>
              </div>

              <div className="panel advisor">
                <h2>Advisor</h2>
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
                  <>
                    <p className="note">
                      Hidden on purpose. Decide first — a visible recommendation trains you to read
                      a screen, and there is no screen at a real table.
                    </p>
                    <button
                      className="ghost"
                      onClick={() => {
                        setRevealed(true);
                        setStats((st) => ({ ...st, reveals: st.reveals + 1 }));
                      }}
                    >
                      Show me (logged)
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {lastFeedback && !heroTurn && !state.complete && (
            <div className="panel">
              <h2>Last decision</h2>
              <div className="stat-row">
                <span>You</span>
                <b>{lastFeedback.chosen}</b>
              </div>
              <div className="stat-row">
                <span>Max EV</span>
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

          {state.complete && decisions.length > 0 && (
            <div className="panel">
              <h2>Hand review</h2>
              <table className="review">
                <thead>
                  <tr>
                    <th>Street</th>
                    <th>Raw</th>
                    <th>Real</th>
                    <th>You</th>
                    <th>Best</th>
                    <th>Lost</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((d, i) => (
                    <tr key={i}>
                      <td>{d.street}</td>
                      <td>{pct(d.rawEquity)}</td>
                      <td>{pct(d.realizedEquity)}</td>
                      <td>{d.chosen}</td>
                      <td>{d.best}</td>
                      <td className={d.evLost < 0.5 ? 'good' : 'bad'}>{chips(d.evLost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
