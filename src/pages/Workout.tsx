import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ExerciseImage } from '../components/ExerciseImage';
import { ExercisePicker } from '../components/ExercisePicker';
import { NumInput } from '../components/NumInput';
import { RestTimer, startRest, stopRest } from '../components/RestTimer';
import { exerciseName, useExercises } from '../exercises';
import { fmtDuration } from '../format';
import { useActiveWorkout, useFinished, useSettings } from '../hooks';
import { finishWorkout, historyFor, newLoggedExercise, suggestionFor } from '../logic/session';
import { SCHEME_LABEL } from '../logic/schemes';
import { countedSets, recordsFor, sessionPrs, type PrKind } from '../logic/stats';
import { fmt, fromDisplay, toDisplay } from '../logic/units';
import type { LoggedExercise, SetType, Workout } from '../types';

const TYPE_LABEL: Record<SetType, string> = { warmup: 'W', working: '', drop: 'D' };
const NEXT_TYPE: Record<SetType, SetType> = { working: 'warmup', warmup: 'drop', drop: 'working' };
const PR_LABEL: Record<PrKind, string> = { weight: 'Heaviest', e1rm: 'Best 1RM', reps: 'Most reps' };

function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof lock> } };
    const req = async () => {
      try {
        if (document.visibilityState === 'visible') lock = (await nav.wakeLock?.request('screen')) ?? null;
      } catch {
        /* denied or unsupported */
      }
    };
    req();
    document.addEventListener('visibilitychange', req);
    return () => {
      document.removeEventListener('visibilitychange', req);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}

function Elapsed({ since }: { since: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  return <>{fmtDuration(Date.now() - since)}</>;
}

function useWorkoutToEdit(id: string | undefined) {
  return useLiveQuery(async () => (id ? (await db.workouts.get(id)) ?? null : undefined), [id]);
}

const toLocalInput = (t: number) => {
  const d = new Date(t);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/** Logs the workout in progress, or edits a finished one when the route has an :id. */
export function WorkoutPage() {
  const { id: editId } = useParams();
  const editing = !!editId;
  const active = useActiveWorkout();
  const edited = useWorkoutToEdit(editId);
  const stored = editing ? edited : active;
  const allFinished = useFinished();
  const [w, setW] = useState<Workout | null>(null);
  // Records and suggestions only look at workouts before this one.
  const finished = useMemo(
    () => (w && allFinished ? allFinished.filter((x) => x.id !== w.id && x.startedAt < w.startedAt) : allFinished),
    [allFinished, w?.id, w?.startedAt],
  );
  const settings = useSettings();
  const { byId } = useExercises();
  const navigate = useNavigate();
  const [picker, setPicker] = useState(false);
  useWakeLock(!editing);

  useEffect(() => {
    if (stored && (!w || w.id !== stored.id)) setW(structuredClone(stored));
  }, [stored, w]);

  const units = settings.units;

  const prev = useMemo(() => {
    const m = new Map<string, { records: ReturnType<typeof recordsFor>; history: LoggedExercise[] }>();
    if (!w || !finished) return m;
    for (const e of w.exercises) {
      if (m.has(e.exerciseId)) continue;
      m.set(e.exerciseId, {
        records: recordsFor(e.exerciseId, finished),
        history: historyFor(e.exerciseId, finished, w.id),
      });
    }
    return m;
  }, [w, finished]);

  if (stored === undefined) return <p className="muted">Loading…</p>;
  if (stored === null && !w) {
    if (editing) return <p>Workout not found. <Link to="/history">Back to history</Link></p>;
    return (
      <section className="card">
        <h2>No workout in progress</h2>
        <Link className="button wide" to="/">Go to Today</Link>
      </section>
    );
  }
  if (!w) return null;

  const save = (next: Workout) => {
    setW(next);
    db.workouts.put(next);
  };
  const mutate = (fn: (d: Workout) => void) => {
    const next = structuredClone(w);
    fn(next);
    save(next);
  };

  const finish = async () => {
    const pending = w.exercises.some((e) => e.sets.some((s) => !s.done));
    if (pending && !confirm('Some sets are not ticked off. Unticked sets will be dropped. Finish anyway?')) return;
    if (!w.exercises.some((e) => e.sets.some((s) => s.done))) {
      if (confirm('Nothing was logged. Discard this workout?')) await discard(true);
      return;
    }
    stopRest();
    await finishWorkout(w);
    navigate(`/history/${w.id}?done=1`, { replace: true });
  };

  const saveEdit = async () => {
    // Drop sets left empty while editing, and exercises with nothing logged.
    const exercises = w.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done || x.reps != null).map((x) => ({ ...x, done: x.reps != null })) }))
      .filter((e) => e.sets.length > 0);
    await db.workouts.put({ ...w, exercises });
    navigate(`/history/${w.id}`, { replace: true });
  };

  const discard = async (skipConfirm = false) => {
    if (!skipConfirm && !confirm('Discard this workout? Nothing will be saved.')) return;
    stopRest();
    await db.workouts.delete(w.id);
    navigate('/', { replace: true });
  };

  return (
    <>
      <header className="page-head sticky">
        <div className="section-head">
          <input className="title-input" value={w.name} onChange={(e) => mutate((d) => { d.name = e.target.value; })} />
          <button onClick={editing ? saveEdit : finish}>{editing ? 'Save' : 'Finish'}</button>
        </div>
        {editing ? (
          <div className="row">
            <label className="mini-field"><span>Started</span>
              <input type="datetime-local" value={toLocalInput(w.startedAt)} onChange={(e) => {
                const t = new Date(e.target.value).getTime();
                if (Number.isNaN(t)) return;
                mutate((d) => {
                  const len = (d.finishedAt ?? d.startedAt) - d.startedAt;
                  d.startedAt = t;
                  d.finishedAt = t + len;
                });
              }} />
            </label>
            <label className="mini-field"><span>Minutes</span>
              <NumInput value={Math.round(((w.finishedAt ?? w.startedAt) - w.startedAt) / 60000)}
                onChange={(v) => v != null && mutate((d) => { d.finishedAt = d.startedAt + v * 60000; })} />
            </label>
          </div>
        ) : (
          <p className="muted small"><Elapsed since={w.startedAt} /></p>
        )}
      </header>

      {w.exercises.map((le, ei) => {
        const ex = byId.get(le.exerciseId);
        const info = prev.get(le.exerciseId);
        const last = info?.history[0];
        const s = finished && !le.scheme ? suggestionFor(le, finished, byId, settings, w.id) : null;
        const hasHistory = (info?.history.length ?? 0) > 0;
        let workingIndex = 0;
        const prsBySet = info ? sessionPrs(le.sets, info.records, hasHistory) : [];
        return (
          <section key={ei} className="card exercise">
            <div className="exercise-head">
              <Link to={`/exercises/${le.exerciseId}`}><ExerciseImage exercise={ex} /></Link>
              <div className="grow">
                <strong>{exerciseName(byId, le.exerciseId)}</strong>
                <small className="muted">
                  {le.scheme ? SCHEME_LABEL[le.scheme] : `Target ${le.repMin}–${le.repMax} reps`}
                  {last && <> · Last: {countedSets(last.sets).map((x) => `${fmt(toDisplay(x.weight, units))}×${x.reps}`).join(', ')}</>}
                </small>
              </div>
              <details className="menu">
                <summary aria-label="Exercise options">⋯</summary>
                <div>
                  <button className="ghost" disabled={ei === 0} onClick={() => mutate((d) => { [d.exercises[ei - 1], d.exercises[ei]] = [d.exercises[ei], d.exercises[ei - 1]]; })}>Move up</button>
                  <button className="ghost" disabled={ei === w.exercises.length - 1} onClick={() => mutate((d) => { [d.exercises[ei + 1], d.exercises[ei]] = [d.exercises[ei], d.exercises[ei + 1]]; })}>Move down</button>
                  <button className="ghost danger" onClick={() => confirm('Remove this exercise?') && mutate((d) => { d.exercises.splice(ei, 1); })}>Remove</button>
                </div>
              </details>
            </div>

            {s && s.kind !== 'new' && <p className={`suggestion ${s.kind}`}>{s.kind === 'increase' ? '⬆️ ' : s.kind === 'deload' ? '⬇️ ' : '➡️ '}{s.message}</p>}
            {s && s.kind === 'new' && <p className="suggestion">{s.message}</p>}
            {le.scheme && le.note && <p className="suggestion program">📋 {le.note}</p>}

            <div className="sets">
              <div className="set-row head">
                <span>Set</span><span>{units}</span><span>Reps</span><span />
              </div>
              {le.sets.map((set, si) => {
                const label = TYPE_LABEL[set.type] || String(++workingIndex);
                const prs = prsBySet[si] ?? [];
                return (
                  <div key={si} className={`set-row ${set.done ? 'done' : ''}`}>
                    <button className={`set-type ${set.type}`} title="Tap to change: working / warm-up / drop set"
                      onClick={() => mutate((d) => { d.exercises[ei].sets[si].type = NEXT_TYPE[set.type]; })}>
                      {label}
                    </button>
                    <NumInput
                      decimal ariaLabel={`Set ${si + 1} weight`}
                      value={set.weight == null ? null : toDisplay(set.weight, units)}
                      placeholder={s?.weight != null ? fmt(toDisplay(s.weight, units)) : '0'}
                      onChange={(v) => mutate((d) => {
                        const sets = d.exercises[ei].sets;
                        const old = sets[si].weight;
                        const kg = v == null ? null : fromDisplay(v, units);
                        sets[si].weight = kg;
                        // Carry the new weight to later untouched sets that had the same value.
                        for (let j = si + 1; j < sets.length; j++) {
                          if (!sets[j].done && (sets[j].weight === old || sets[j].weight == null)) sets[j].weight = kg;
                        }
                      })}
                    />
                    <NumInput
                      ariaLabel={`Set ${si + 1} reps`}
                      value={set.reps}
                      placeholder={set.target != null ? `${set.target}${set.amrap ? '+' : ''}` : String(s?.reps ?? le.repMin)}
                      onChange={(v) => mutate((d) => { d.exercises[ei].sets[si].reps = v; })}
                    />
                    <button
                      className={`check ${set.done ? 'on' : ''}`}
                      aria-label={set.done ? 'Mark set not done' : 'Mark set done'}
                      onClick={() => {
                        const done = !set.done;
                        mutate((d) => {
                          const x = d.exercises[ei].sets[si];
                          x.done = done;
                          if (done && x.reps == null) x.reps = x.target ?? s?.reps ?? le.repMin;
                          if (done && x.weight == null && s?.weight != null) x.weight = s.weight;
                        });
                        if (done && !editing) startRest(set.type === 'warmup' ? Math.min(60, le.rest) : le.rest);
                      }}
                    >✓</button>
                    {prs.length > 0 && <span className="pr-badge">🏆 {prs.map((p) => PR_LABEL[p]).join(' · ')}</span>}
                  </div>
                );
              })}
            </div>
            <div className="row">
              <button className="secondary grow" onClick={() => mutate((d) => {
                const sets = d.exercises[ei].sets;
                const lastSet = sets[sets.length - 1];
                sets.push({ weight: lastSet?.weight ?? s?.weight ?? null, reps: null, type: 'working', done: false });
              })}>+ Set</button>
              {le.sets.length > 1 && (
                <button className="ghost" onClick={() => mutate((d) => { d.exercises[ei].sets.pop(); })}>− Set</button>
              )}
            </div>
          </section>
        );
      })}

      <button className="secondary wide" onClick={() => setPicker(true)}>+ Add exercise</button>
      <textarea placeholder="Workout notes" value={w.notes ?? ''} onChange={(e) => mutate((d) => { d.notes = e.target.value; })} />
      {!editing && <button className="ghost danger wide" onClick={() => discard()}>Discard workout</button>}

      {!editing && <RestTimer />}

      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onPick={(ex) => {
            mutate((d) => {
              d.exercises.push(newLoggedExercise(ex.id, 3, 8, 12, settings.defaultRest, finished ?? [], byId, settings));
            });
            setPicker(false);
          }}
        />
      )}
    </>
  );
}
