import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db, updateSettings } from '../db';
import { useExercises } from '../exercises';
import { useFinished, useSettings } from '../hooks';
import { ask, CHECKIN_SCHEMA, checkInFacts, checkInPrompt, coachOn, parseCheckIn, type CheckIn } from '../logic/coach';
import { deloadActive } from '../logic/deload';
import { weekStart } from '../logic/progress';
import { ChevronLeft, SparkIcon } from '../components/Icons';

const STORE = 'coach-checkin';

interface Saved { week: number; at: number; data: CheckIn }

/** This week's check-in, kept on the phone so it's one Gemini call per week unless you ask again. */
export function savedCheckIn(now = Date.now()): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Saved | null;
    return s && s.week === weekStart(now) ? s : null;
  } catch {
    return null;
  }
}

function store(data: CheckIn) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ week: weekStart(Date.now()), at: Date.now(), data }));
  } catch {
    // Private mode: it just isn't kept.
  }
}

export function CheckInPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const finished = useFinished();
  const { byId } = useExercises();
  const [saved, setSaved] = useState(savedCheckIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const on = coachOn();
  const started = useRef(false);

  const run = async () => {
    if (!finished) return;
    setBusy(true);
    setError('');
    try {
      const facts = checkInFacts(finished, byId, settings, await db.bodyWeight.toArray());
      const data = await ask(checkInPrompt(facts), CHECKIN_SCHEMA, parseCheckIn, 30000);
      if (!data) throw new Error('Gemini didn\'t send a usable check-in');
      store(data);
      setSaved(savedCheckIn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const enough = (finished?.length ?? 0) >= 3;
  useEffect(() => {
    if (on && enough && !saved && !started.current && byId.size && finished) {
      started.current = true;
      run();
    }
  }, [on, enough, saved, byId.size, finished]);

  const c = saved?.data;
  const deloading = deloadActive(settings);
  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate(-1)}><ChevronLeft />Back</button>
        <h1>Weekly check-in</h1>
      </header>

      {!on && (
        <section className="card accent">
          <p style={{ marginTop: 0 }}>Once a week the AI coach looks for lifts that have stalled, muscles you're skipping and whether a lighter week would help. Add a free Gemini key to turn it on.</p>
          <Link className="button wide" to="/settings/ai">Set up the AI coach</Link>
        </section>
      )}
      {on && !enough && <p className="muted">Log a few workouts first. The check-in compares your last few weeks.</p>}
      {on && busy && <section className="card"><p className="muted" style={{ margin: 0 }}>Your coach is looking over the last 6 weeks…</p></section>}
      {on && error && !busy && (
        <section className="card">
          <p className="muted small" style={{ marginTop: 0 }}>No check-in: {error}.</p>
          <button className="secondary" onClick={run}>Try again</button>
        </section>
      )}

      {c && !busy && (
        <>
          <section className="card accent">
            <p className="eyebrow">Week of {new Date(saved!.week).toLocaleDateString([], { day: 'numeric', month: 'short' })}</p>
            <h2 style={{ marginBottom: 0 }}>{c.headline}</h2>
          </section>
          {c.points.length > 0 && (
            <section className="card">
              <ul className="checkin-points">
                {c.points.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </section>
          )}
          {c.action === 'deload' && (
            <section className="card">
              <h2>Take a lighter week</h2>
              {deloading
                ? <p className="muted small" style={{ margin: 0 }}>Your deload week is on: half the sets, about 10% lighter.</p>
                : <>
                  <p className="muted small">Half the sets at about 10% less weight for 7 days, then back to normal.</p>
                  <button className="wide" onClick={() => { const now = Date.now(); updateSettings({ deloadUntil: now + 7 * 864e5, lastDeloadAt: now }); }}>Start a deload week</button>
                </>}
            </section>
          )}
          {c.action === 'focus' && c.focus && (
            <section className="card">
              <h2>Focus this week: {c.focus}</h2>
              <p className="muted small">Ask for a workout that puts it first.</p>
              <Link className="button wide" to="/describe" state={{ text: `Focus on ${c.focus.toLowerCase()} today` }}>Build a {c.focus.toLowerCase()} workout</Link>
            </section>
          )}
          <button className="ghost wide" onClick={run}><SparkIcon />Check again</button>
        </>
      )}
    </>
  );
}
