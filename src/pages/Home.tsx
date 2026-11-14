import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { backupDue, backupNow } from '../backup';
import { useAccount } from '../sync';
import { db, getProgramState, logBodyWeight, updateSettings } from '../db';
import { exerciseName, useExercises } from '../exercises';
import { useActiveWorkout, useFinished, useSettings } from '../hooks';
import { liftKey, SCHEME_LABEL, uses531, WEEKS_531 } from '../logic/schemes';
import { startWorkout } from '../logic/session';
import { fmt, fromDisplay, toDisplay } from '../logic/units';
import { EVERY_DAY, todaysEntry, weighInDay, weighInDue } from '../logic/weighIn';
import { dayKey, weekStart, weeklySummary, weekStreaks } from '../logic/progress';
import { changeText, weekStats } from '../components/WeightSummary';
import { initials } from '../format';
import { InstallTip } from '../components/InstallTip';
import { ExerciseImage } from '../components/ExerciseImage';
import { BoxIcon, FlameIcon, MoonIcon, MoreIcon, PlayIcon, PlusIcon, ScaleIcon, SparkIcon, UserIcon } from '../components/Icons';
import { muscleBalance } from '../logic/balance';
import { deloadActive, deloadDue, DELOAD_AFTER_WEEKS } from '../logic/deload';
import { fresherDay, recentLoad, recoveryNote, tiredGroups } from '../logic/recovery';
import { NumInput } from '../components/NumInput';
import { hasGear } from '../logic/equipment';
import { fitDay, lastSplitDay, nextDayIndex, sessionSize } from '../logic/generator';
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
        <h2 className="row"><span className="lead-ico"><ScaleIcon /></span>{daily ? "Today's weight" : 'Weigh-in day'}</h2>
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

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const compact = (n: number) => (n >= 1000 ? `${fmt(Math.round(n / 100) / 10)}k` : String(Math.round(n)));

/** Monday to Sunday of this week, with the days you trained filled in pink. */
function WeekStrip({ workouts }: { workouts: Workout[] }) {
  const start = weekStart(Date.now());
  const todayKey = dayKey(Date.now());
  const hits = new Set(workouts.filter((w) => w.startedAt >= start).map((w) => dayKey(w.startedAt)));
  return (
    <div className="week-strip" role="list" aria-label="This week">
      {DAY_LETTERS.map((letter, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const k = dayKey(d.getTime());
        const hit = hits.has(k);
        const isToday = k === todayKey;
        const future = !isToday && d.getTime() > Date.now();
        return (
          <div key={i} role="listitem" aria-label={`${d.toLocaleDateString([], { weekday: 'long' })}${hit ? ', trained' : ''}`}>
            <span className={isToday ? 'is-today' : ''}>{letter}</span>
            <span className={`wd ${hit ? 'hit' : ''} ${isToday ? 'today' : ''} ${future ? 'future' : ''}`}>{d.getDate()}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Home() {
  const settings = useSettings();
  const finished = useFinished();
  const active = useActiveWorkout();
  const account = useAccount();
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
  const thisWeek = finished?.filter((w) => w.startedAt >= weekStart(Date.now())).length ?? 0;
  const streak = finished ? weekStreaks(finished).current : 0;
  // Only nag about skipped muscles once there's a few workouts' worth of data this week.
  const recent = finished?.filter((w) => w.startedAt > weekAgo).length ?? 0;
  const skipped = finished && byId.size > 0 && recent >= 2 ? muscleBalance(finished, byId, weekAgo).skipped : [];
  // Rotate from the last split day finished, however many times a week you train.
  const planned = program ? program.days[nextDayIndex(program, finished, settings.nextDayIndex)] : undefined;
  const lastDay = program ? lastSplitDay(program, finished) : undefined;
  // Show the day the way it will start: trimmed or filled to the session size, plus the core finisher.
  const next = useMemo(() => planned && byId.size
    ? fitDay(planned, {
      size: sessionSize(settings), finisher: !!settings.coreFinisher, finished,
      available: (id) => byId.has(id) && hasGear(byId.get(id), settings.missingEquipment),
    })
    : planned,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [planned, byId, finished, settings.sessionSize, settings.sessionExercises, settings.sessionMinutes, settings.coreFinisher, settings.missingEquipment]);
  // 5/3/1 has its own deload week built in.
  const deloadNow = deloadActive(settings);
  const suggestDeload = !is531 && !!finished && deloadDue(finished, settings);
  // Don't hammer muscles that were trained hard in the last two days; offer a rested day instead.
  const load = finished ? recentLoad(finished, byId) : new Map();
  const tired = program && next ? tiredGroups(next, load, byId) : [];
  const fresher = tired.length && program && next ? fresherDay(program.days, next, load, byId) : undefined;

  const weighIn = !active && !!weights && weighInDue(weights, settings);
  const today = weights ? todaysEntry(weights) : undefined;
  const latest = weights?.length ? weights.reduce((a, b) => (b.date > a.date ? b : a)) : undefined;
  const wk = weekStats(weights ?? []);
  const weeks = finished ? weeklySummary(finished, 6) : [];
  const volumeNow = weeks[weeks.length - 1]?.volume ?? 0;
  const volumeMax = Math.max(1, ...weeks.map((w) => w.volume));
  const nextSets = next?.exercises.reduce((a, e) => a + e.sets, 0) ?? 0;

  return (
    <>
      <header className="home-head">
        <div className="page-head">
          <p className="greeting">{new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          <h1>{greeting()}{settings.name ? `, ${settings.name}` : ''}</h1>
        </div>
        <Link className="avatar" to="/settings/profile" aria-label={settings.name ? 'Profile' : 'Add your name'}>{settings.name ? initials(settings.name) : <UserIcon />}</Link>
      </header>

      {finished && (
        <Link className="plain-link" to="/history" aria-label="History">
          <WeekStrip workouts={finished} />
          <p className="week-line">
            <span><strong>{thisWeek}</strong> session{thisWeek === 1 ? '' : 's'} this week</span>
            {streak > 1 && <span className="streak"><FlameIcon />{streak}-week streak</span>}
          </p>
        </Link>
      )}

      {active && (
        <section className="card accent">
          <p className="eyebrow">In progress</p>
          <h2>{active.name}</h2>
          <p className="muted small">Started {new Date(active.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
          <Link className="button wide" to="/workout"><PlayIcon />Resume</Link>
        </section>
      )}

      {!active && suggestDeload && (
        <section className="card accent">
          <h2 className="row"><span className="lead-ico"><MoonIcon /></span>Time for a lighter week</h2>
          <p className="muted small">You've trained hard for {DELOAD_AFTER_WEEKS}+ weeks in a row. A deload week (half the sets, about 10% lighter) lets your body catch up, and you usually come back stronger.</p>
          <button className="wide" onClick={() => { const now = Date.now(); updateSettings({ deloadUntil: now + 7 * 864e5, lastDeloadAt: now }); }}>Start a deload week</button>
          <button className="ghost wide" onClick={() => updateSettings({ deloadSnoozedAt: Date.now() })}>Not now</button>
        </section>
      )}

      {weighIn && <WeightCard settings={settings} />}

      {!active && program && next && (
        <section className="card hero-card" aria-label="Next workout">
          <div className="hero-top">
            <div>
              <p className="eyebrow">Next up · {program.name}{is531 && state ? ` · wk ${state.week + 1} (${WEEKS_531[state.week].name})` : ''}</p>
              <h2 className="hero-title">{next.name}</h2>
              {lastDay && <p className="muted small" style={{ margin: 0 }}>Last time: {program.days[lastDay.index].name}, {new Date(lastDay.at).toLocaleDateString([], { weekday: 'long' })}</p>}
            </div>
            <div className="thumb-stack" aria-hidden>
              {next.exercises.slice(0, 3).map((e, i) => <ExerciseImage key={i} exercise={byId.get(e.exerciseId)} />)}
              {next.exercises.length > 3 && <span className="more">+{next.exercises.length - 3}</span>}
            </div>
          </div>
          <div className="hero-meta">
            <span><strong>{next.exercises.length}</strong> exercise{next.exercises.length === 1 ? '' : 's'}</span>
            <span><strong>{nextSets}</strong> sets</span>
            <Link className="small" to="/settings/training#size" aria-label="Change workout size">Change size</Link>
          </div>
          {missingTm && (
            <p className="notice">Set your training maxes first so the app can work out your weights. <Link to={`/programs/${program.id}`}>Set them</Link></p>
          )}
          {deloadNow && <p className="notice">Deload week until {new Date(settings.deloadUntil!).toLocaleDateString([], { weekday: 'long' })}: half the sets, about 10% lighter. <button className="link small" onClick={() => updateSettings({ deloadUntil: Date.now() })}>End it</button></p>}
          {tired.length > 0 && (
            <div className="notice">
              {recoveryNote(tired, load)} {fresher ? <>{fresher.name} is fresher today.</> : <>A rest day or a lighter session would help.</>}
              {fresher && <button className="secondary wide" onClick={() => start({ program, day: fresher })}>Do {fresher.name} instead</button>}
            </div>
          )}
          <ul className="hero-list">
            {next.exercises.slice(0, 3).map((e, i) => (
              <li key={i}><span>{exerciseName(byId, e.exerciseId)}</span><span className="mono">{e.scheme ? SCHEME_LABEL[e.scheme] : `${e.sets} × ${e.repMin}–${e.repMax}`}</span></li>
            ))}
          </ul>
          {next.exercises.length > 3 && (
            <details className="peek">
              <summary className="muted small">{next.exercises.length - 3} more</summary>
              <ul className="hero-list" style={{ marginTop: 10 }}>
                {next.exercises.slice(3).map((e, i) => (
                  <li key={i}><span>{exerciseName(byId, e.exerciseId)}</span><span className="mono">{e.scheme ? SCHEME_LABEL[e.scheme] : `${e.sets} × ${e.repMin}–${e.repMax}`}</span></li>
                ))}
              </ul>
            </details>
          )}
          <button className="wide" onClick={() => start({ program, day: planned ?? next })}><PlayIcon />Start {next.name}</button>
          {program.days.length > 1 && (
            <div className="chips" style={{ marginTop: 0 }}>
              <span className="chips-label">Or swap to</span>
              {program.days.filter((d) => d.id !== next.id).map((d) => (
                <button key={d.id} className="chip" onClick={() => start({ program, day: d })}>{d.name}</button>
              ))}
            </div>
          )}
        </section>
      )}

      {!active && !program && (
        <section className="card hero-card">
          <p className="eyebrow">Get started</p>
          <h2 className="hero-title" style={{ fontSize: '2rem' }}>Pick a split</h2>
          <p className="muted">Choose a built-in program or build your own, and the app will line up each day for you.</p>
          <Link className="button wide" to="/programs/generate?mode=week"><SparkIcon />Build a routine for me</Link>
          <Link className="button secondary wide" to="/programs">Choose a split</Link>
        </section>
      )}

      {finished && finished.length > 0 && (
        <section className="tiles">
          <Link className="tile" to="/weight">
            <span className="tile-label">Body weight</span>
            {latest ? (
              <>
                <span className="tile-value">{fmt(Math.round(toDisplay(latest.weight, settings.units) * 10) / 10)}<small> {settings.units}</small></span>
                <span className={`tile-note ${wk.thisWeekChange != null && wk.thisWeekChange < 0 ? 'up' : ''}`}>
                  {wk.thisWeekChange != null ? `${changeText(wk.thisWeekChange, settings.units)} vs last wk` : today ? 'Logged today' : 'Tap to log'}
                </span>
              </>
            ) : (
              <><span className="tile-value">–</span><span className="tile-note">Tap to log</span></>
            )}
          </Link>
          <Link className="tile" to="/history?tab=progress">
            <span className="tile-label">Volume this week</span>
            <span className="tile-value">{compact(toDisplay(volumeNow, settings.units))}<small> {settings.units}</small></span>
            <span className="mini-bars" aria-hidden>
              {weeks.map((w) => <span key={w.start} style={{ height: `${Math.max(8, (w.volume / volumeMax) * 100)}%` }} />)}
            </span>
          </Link>
        </section>
      )}

      {skipped.length > 0 && <p className="small muted" style={{ margin: 0 }}>Not trained this week: {skipped.join(', ')}</p>}

      {!active && (
        <nav className="quick" aria-label="Other ways to train">
          <Link to="/programs/generate?mode=today"><span className="ico"><SparkIcon /></span>Build for today</Link>
          <button onClick={() => start({})}><span className="ico"><PlusIcon /></span>Empty workout</button>
          <Link to="/start"><span className="ico"><MoreIcon /></span>More ways</Link>
        </nav>
      )}

      {!active && <InstallTip />}

      {!active && finished && !account.signedIn && backupDue(settings.lastBackupAt, finished.length) && (
        <section className="card backup-nudge">
          <span className="lead-ico neutral"><BoxIcon /></span>
          {account.available ? (
            <>
              <span className="grow small">Your history only lives on this phone. Sign in to keep it safe and on every phone.</span>
              <Link className="button secondary" to="/settings/account">Sign in</Link>
            </>
          ) : (
            <>
              <span className="grow small">Your history only lives on this phone. Save a backup now and then.</span>
              <button className="secondary" onClick={() => backupNow().catch(() => {})}>Back up</button>
            </>
          )}
        </section>
      )}
    </>
  );
}
