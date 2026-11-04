import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { backupDue, backupNow } from '../backup';
import { db, getProgramState, logBodyWeight, updateSettings } from '../db';
import { exerciseName, useExercises } from '../exercises';
import { fmtDate, fmtDuration } from '../format';
import { useActiveWorkout, useFinished, useSettings } from '../hooks';
import { liftKey, SCHEME_LABEL, uses531, WEEKS_531 } from '../logic/schemes';
import { startWorkout } from '../logic/session';
import { fromDisplay } from '../logic/units';
import { EVERY_DAY, todaysEntry, weighInDay, weighInDue } from '../logic/weighIn';
import { changeText, kgText, weekStats } from '../components/WeightSummary';
import { weekStreaks } from '../logic/progress';
import { muscleBalance } from '../logic/balance';
import { deloadActive, deloadDue, DELOAD_AFTER_WEEKS } from '../logic/deload';
import { fresherDay, recentLoad, recoveryNote, tiredGroups } from '../logic/recovery';
import { NumInput } from '../components/NumInput';
import type { BodyWeight, Day, Program, Settings, Workout } from '../types';
import { DumbbellIcon, HistoryIcon, PlusIcon, ScaleIcon } from '../components/Icons';

const greeting = (h = new Date().getHours()) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

/** Always on Home: asks for today's weight when it's due, otherwise shows the weekly averages. */
function WeightCard({ settings, entries }: { settings: Settings; entries: BodyWeight[] }) {
  const [value, setValue] = useState<number | null>(null);
  const units = settings.units;
  const due = weighInDue(entries, settings);
  const today = todaysEntry(entries);
  const daily = weighInDay(settings) === EVERY_DAY;
  const { thisWeek, lastWeek, lastWeekChange } = weekStats(entries);
  const summary = [
    thisWeek.avg != null && `This week avg ${kgText(thisWeek.avg, units)}`,
    lastWeek.avg != null && `last week ${kgText(lastWeek.avg, units)}${lastWeekChange != null ? ` (${changeText(lastWeekChange, units)})` : ''}`,
  ].filter(Boolean).join(' · ').replace(/^l/, 'L');
  return (
    <section className={`card${due ? ' accent' : ''}`}>
      <div className="section-head">
        <h2>⚖️ {due ? (daily ? "Today's weight" : 'Weigh-in day') : 'Body weight'}</h2>
        <Link to="/weight">Graph ›</Link>
      </div>
      {due ? (
        <>
          <div className="row">
            <label className="mini-field"><span>Weight ({units})</span>
              <NumInput decimal ariaLabel="Today's weight" value={value} onChange={setValue} />
            </label>
          </div>
          <button className="wide" disabled={!value || value <= 0} onClick={() => value && logBodyWeight(fromDisplay(value, units))}>Save weight</button>
          {summary && <p className="muted small">{summary}</p>}
          <button className="ghost wide" onClick={() => updateSettings({ weighInSkippedAt: Date.now() })}>{daily ? 'Not today' : 'Skip this week'}</button>
        </>
      ) : (
        <Link to="/weight" className="weight-link">
          {today && <span className="weight-today">{kgText(today.weight, units)} <small className="muted">today</small></span>}
          <span className="muted small">{summary || 'Log your weight every day to see your weekly average.'}</span>
        </Link>
      )}
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

  const saved = useLiveQuery(() => db.savedWorkouts.orderBy('name').toArray(), []);
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

  return (
    <>
      <header className="page-head">
        <p className="greeting">{greeting()}{settings.name ? ',' : ''}</p>
        <h1>{settings.name || 'Ready to train?'}</h1>
        <p className="muted small">{new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</p>
      </header>

      <section className="card week-card">
        <div className="section-head">
          <strong>This week</strong>
          <span className="muted small">{thisWeek} / {weekTarget} workouts</span>
        </div>
        <div className="meter"><span style={{ width: `${Math.min(100, (thisWeek / weekTarget) * 100)}%` }} /></div>
        {skipped.length > 0 && (
          <p className="small week-note muted">Not trained this week: {skipped.join(', ')}. <Link to="/history?tab=progress">Muscle balance</Link></p>
        )}
        {streak > 1 && <p className="small week-note">🔥 {streak}-week streak. <Link to="/history">See your calendar</Link></p>}
      </section>

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
          <p className="muted small">You've trained hard for {DELOAD_AFTER_WEEKS}+ weeks in a row. A deload week (half the sets, about 10% lighter) lets your joints and muscles catch up, and you usually come back stronger.</p>
          <button className="wide" onClick={() => { const now = Date.now(); updateSettings({ deloadUntil: now + 7 * 864e5, lastDeloadAt: now }); }}>Start a deload week</button>
          <button className="ghost wide" onClick={() => updateSettings({ deloadSnoozedAt: Date.now() })}>Not now</button>
        </section>
      )}
      {deloadNow && (
        <section className="card">
          <h2>🧘 Deload week</h2>
          <p className="muted small">Until {new Date(settings.deloadUntil!).toLocaleDateString([], { weekday: 'long' })}: workouts start with half the sets at about 10% less weight. Normal training after that.</p>
          <button className="ghost wide" onClick={() => updateSettings({ deloadUntil: Date.now() })}>End it early</button>
        </section>
      )}

      {!active && weights && <WeightCard settings={settings} entries={weights} />}

      {!active && program && next && (
        <section className="card hero-card">
          <p className="eyebrow">{program.name}{is531 && state ? ` · week ${state.week + 1} (${WEEKS_531[state.week].name})` : ''} · next up</p>
          {missingTm && (
            <p className="notice">Set your training maxes first so the app can work out your weights. <Link to={`/programs/${program.id}`}>Set them</Link></p>
          )}
          <h2>{next.name}</h2>
          {tired.length > 0 && (
            <div className="notice">
              💤 {recoveryNote(tired, load)} {fresher ? <>{fresher.name} is fresher today.</> : <>A rest day or a lighter session would help.</>}
              {fresher && <button className="secondary wide" onClick={() => start({ program, day: fresher })}>Do {fresher.name} instead</button>}
            </div>
          )}
          <ul className="plain">
            {next.exercises.map((e, i) => (
              <li key={i}>{exerciseName(byId, e.exerciseId)} <span className="muted">{e.scheme ? SCHEME_LABEL[e.scheme] : `${e.sets} × ${e.repMin}–${e.repMax}`}</span></li>
            ))}
          </ul>
          <button className="wide" onClick={() => start({ program, day: next })}>Start {next.name}</button>
          {program.days.length > 1 && (
            <div className="chips">
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
          <Link className="button wide" to="/programs/generate">✨ Build a routine for me</Link>
          <Link className="button secondary wide" to="/programs">Choose a split</Link>
        </section>
      )}

      {!active && saved && saved.length > 0 && (
        <section>
          <h2>Saved workouts</h2>
          <ul className="list">
            {saved.map((t) => (
              <li key={t.id} className="saved-row">
                <button className="list-item" onClick={() => start({ copyOf: t })} aria-label={`Start ${t.name}`}>
                  <span>
                    <strong>{t.name}</strong>
                    <small className="muted">{t.exercises.length} exercise{t.exercises.length === 1 ? '' : 's'} · {t.exercises.slice(0, 3).map((e) => exerciseName(byId, e.exerciseId)).join(', ')}{t.exercises.length > 3 ? '…' : ''}</small>
                  </span>
                </button>
                <button className="ghost danger" aria-label={`Delete ${t.name}`}
                  onClick={() => confirm(`Delete the saved workout "${t.name}"?`) && db.savedWorkouts.delete(t.id)}>✕</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Quick actions</h2>
        <div className="quick">
          {!active && (
            <button onClick={() => start({})}><span className="ico"><PlusIcon /></span>Empty workout</button>
          )}
          <Link to="/exercises"><span className="ico"><DumbbellIcon /></span>Exercises</Link>
          <Link to="/weight"><span className="ico"><ScaleIcon /></span>Weight</Link>
          <Link to="/history?tab=progress"><span className="ico"><HistoryIcon /></span>Progress</Link>
        </div>
        <Link className="button secondary wide" to="/import">📷 Copy a plan from a screenshot</Link>
      </section>

      {!active && finished && backupDue(settings.lastBackupAt, finished.length) && (
        <section className="card">
          <h2>💾 Back up your workouts</h2>
          <p className="muted small">Your history only lives on this phone. Save a backup file (to Files, Drive or email) so a lost or reset phone doesn't wipe it.</p>
          <button className="secondary wide" onClick={() => backupNow().catch(() => {})}>Save backup</button>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>Recent</h2>
          <Link to="/history">See all</Link>
        </div>
        {finished?.length === 0 && <p className="muted">No workouts yet. Your history will show up here.</p>}
        <ul className="list">
          {finished?.slice(0, 3).map((w) => (
            <li key={w.id}>
              <Link className="list-item" to={`/history/${w.id}`}>
                <span>
                  <strong>{w.name}</strong>
                  <small className="muted">{fmtDate(w.startedAt)} · {fmtDuration(w.finishedAt! - w.startedAt)} · {w.exercises.length} exercises</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
