import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { backupDue, backupNow } from '../backup';
import { db, getProgramState, logBodyWeight, updateSettings } from '../db';
import { exerciseName, useExercises } from '../exercises';
import { useActiveWorkout, useFinished, useSettings } from '../hooks';
import { liftKey, SCHEME_LABEL, uses531, WEEKS_531 } from '../logic/schemes';
import { startWorkout } from '../logic/session';
import { fromDisplay } from '../logic/units';
import { EVERY_DAY, todaysEntry, weighInDay, weighInDue } from '../logic/weighIn';
import { kgText } from '../components/WeightSummary';
import { weekStreaks } from '../logic/progress';
import { muscleBalance } from '../logic/balance';
import { deloadActive, deloadDue, DELOAD_AFTER_WEEKS } from '../logic/deload';
import { fresherDay, recentLoad, recoveryNote, tiredGroups } from '../logic/recovery';
import { NumInput } from '../components/NumInput';
import type { Day, Program, Settings, Workout } from '../types';

const greeting = (h = new Date().getHours()) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

/** Shown on Home only when a weigh-in is due; the graph and averages live on the Weight page. */
function WeightCard({ settings }: { settings: Settings }) {
  const [value, setValue] = useState<number | null>(null);
  const units = settings.units;
  const daily = weighInDay(settings) === EVERY_DAY;
  return (
    <section className="card accent">
      <div className="section-head">
        <h2>⚖️ {daily ? "Today's weight" : 'Weigh-in day'}</h2>
        <button className="link small" onClick={() => updateSettings({ weighInSkippedAt: Date.now() })}>{daily ? 'Not today' : 'Skip'}</button>
      </div>
      <div className="row tight-gap">
        <label className="mini-field grow"><span>Weight ({units})</span>
          <NumInput decimal ariaLabel="Today's weight" value={value} onChange={setValue} />
        </label>
        <button className="align-end" disabled={!value || value <= 0} onClick={() => value && logBodyWeight(fromDisplay(value, units))}>Save</button>
      </div>
    </section>
  );
}

export function Home() {
  const settings = useSettings();
  const finished = useFinished();
  const active = useActiveWorkout();
  const { byId } = useExercises();
  const navigate = useNavigate();
  const program = useLiveQuery(
    () => (settings.activeProgramId ? db.programs.get(settings.activeProgramId) : undefined),
    [settings.activeProgramId],
  );

  const state = useLiveQuery(
    () => (settings.activeProgramId ? getProgramState(settings.activeProgramId) : undefined),
    [settings.activeProgramId],
  );
  const is531 = !!program && uses531(program.days);
  const missingTm = is531 && !!state && program!.days.some((d) =>
    d.exercises.some((e) => e.scheme === '531' && state.lifts[liftKey('531', e.exerciseId)]?.weight == null));

  const weights = useLiveQuery(() => db.bodyWeight.toArray(), []);

  const start = async (opts: { program?: Program; day?: Day; copyOf?: Workout }) => {
    await startWorkout(opts, byId);
    navigate('/workout');
  };

  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = finished?.filter((w) => w.startedAt > weekAgo).length ?? 0;
  const weekTarget = Math.max(1, program?.days.length ?? 3);
  const streak = finished ? weekStreaks(finished).current : 0;
  // Only nag about skipped muscles once there's a few workouts' worth of data this week.
  const skipped = finished && byId.size > 0 && thisWeek >= 2 ? muscleBalance(finished, byId, weekAgo).skipped : [];
  const next = program?.days[settings.nextDayIndex % Math.max(1, program.days.length)];
  // 5/3/1 has its own deload week built in.
  const deloadNow = deloadActive(settings);
  const suggestDeload = !is531 && !!finished && deloadDue(finished, settings);
  // Don't hammer muscles that were trained hard in the last two days; offer a rested day instead.
  const load = finished ? recentLoad(finished, byId) : new Map();
  const tired = program && next ? tiredGroups(next, load, byId) : [];
  const fresher = tired.length && program && next ? fresherDay(program.days, next, load, byId) : undefined;

  const weighIn = !active && !!weights && weighInDue(weights, settings);
  const today = weights ? todaysEntry(weights) : undefined;

  return (
    <>
      <header className="page-head">
        <p className="greeting">{greeting()}{settings.name ? ',' : ''}</p>
        <h1>{settings.name || 'Ready to train?'}</h1>
        <p className="muted small">{new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</p>
      </header>

      {active && (
        <section className="card accent">
          <h2>Workout in progress</h2>
          <p className="muted">{active.name}, started {new Date(active.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
          <Link className="button wide" to="/workout">Resume</Link>
        </section>
      )}

      {!active && suggestDeload && (
        <section className="card accent">
          <h2>🧘 Time for a lighter week</h2>
          <p className="muted small">You've trained hard for {DELOAD_AFTER_WEEKS}+ weeks in a row. A deload week (half the sets, about 10% lighter) lets your body catch up, and you usually come back stronger.</p>
          <button className="wide" onClick={() => { const now = Date.now(); updateSettings({ deloadUntil: now + 7 * 864e5, lastDeloadAt: now }); }}>Start a deload week</button>
          <button className="ghost wide" onClick={() => updateSettings({ deloadSnoozedAt: Date.now() })}>Not now</button>
        </section>
      )}

      {weighIn && <WeightCard settings={settings} />}

      {!active && program && next && (
        <section className="card hero-card">
          <p className="eyebrow">Next up · {program.name}{is531 && state ? ` · week ${state.week + 1} (${WEEKS_531[state.week].name})` : ''}</p>
          {missingTm && (
            <p className="notice">Set your training maxes first so the app can work out your weights. <Link to={`/programs/${program.id}`}>Set them</Link></p>
          )}
          <h2 className="hero-title">{next.name}</h2>
          {deloadNow && <p className="small">🧘 Deload week until {new Date(settings.deloadUntil!).toLocaleDateString([], { weekday: 'long' })}: half the sets, about 10% lighter. <button className="link small" onClick={() => updateSettings({ deloadUntil: Date.now() })}>End it</button></p>}
          {tired.length > 0 && (
            <div className="notice">
              💤 {recoveryNote(tired, load)} {fresher ? <>{fresher.name} is fresher today.</> : <>A rest day or a lighter session would help.</>}
              {fresher && <button className="secondary wide" onClick={() => start({ program, day: fresher })}>Do {fresher.name} instead</button>}
            </div>
          )}
          <details className="peek">
            <summary className="muted small">{next.exercises.length} exercise{next.exercises.length === 1 ? '' : 's'}: {next.exercises.slice(0, 3).map((e) => exerciseName(byId, e.exerciseId)).join(', ')}{next.exercises.length > 3 ? '…' : ''}</summary>
            <ul className="plain">
              {next.exercises.map((e, i) => (
                <li key={i}>{exerciseName(byId, e.exerciseId)} <span className="muted">{e.scheme ? SCHEME_LABEL[e.scheme] : `${e.sets} × ${e.repMin}–${e.repMax}`}</span></li>
              ))}
            </ul>
          </details>
          <button className="wide" onClick={() => start({ program, day: next })}>Start {next.name}</button>
          {program.days.length > 1 && (
            <div className="chips">
              <span className="muted small chips-label">Or do</span>
              {program.days.filter((d) => d.id !== next.id).map((d) => (
                <button key={d.id} className="chip" onClick={() => start({ program, day: d })}>{d.name}</button>
              ))}
            </div>
          )}
        </section>
      )}

      {!active && !program && (
        <section className="card">
          <h2>Pick a split</h2>
          <p className="muted">Choose a built-in program or build your own, and the app will line up each day for you.</p>
          <Link className="button wide" to="/programs/generate?mode=week">✨ Build a routine for me</Link>
          <Link className="button secondary wide" to="/programs">Choose a split</Link>
        </section>
      )}

      {!active && (
        <Link className="list-item" to="/start">
          <span>
            <strong>Other ways to train</strong>
            <small className="muted">Make one for today, saved workouts, empty workout, from a screenshot</small>
          </span>
        </Link>
      )}

      <Link className="card week-card plain-link" to="/history">
        <div className="section-head">
          <strong>This week</strong>
          <span className="muted small">{thisWeek} / {weekTarget} workouts{streak > 1 ? ` · 🔥 ${streak} weeks` : ''}</span>
        </div>
        <div className="meter"><span style={{ width: `${Math.min(100, (thisWeek / weekTarget) * 100)}%` }} /></div>
        {skipped.length > 0 && <p className="small week-note muted">Not trained yet: {skipped.join(', ')}</p>}
        {!weighIn && today && <p className="small week-note muted">⚖️ {kgText(today.weight, settings.units)} today</p>}
      </Link>

      {!active && finished && backupDue(settings.lastBackupAt, finished.length) && (
        <section className="card row backup-nudge">
          <span className="grow small">💾 Your history only lives on this phone. Save a backup now and then.</span>
          <button className="secondary" onClick={() => backupNow().catch(() => {})}>Back up</button>
        </section>
      )}
    </>
  );
}
