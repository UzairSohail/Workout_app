import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ExerciseImage } from '../components/ExerciseImage';
import { MuscleTags } from '../components/MuscleTags';
import { ExercisePicker } from '../components/ExercisePicker';
import { NumInput } from '../components/NumInput';
import { RestTimer, startRest, stopRest } from '../components/RestTimer';
import { saveExerciseNote, StickyNote } from '../components/ExerciseNote';
import { SetTimer } from '../components/SetTimer';
import { exerciseName, useExercises } from '../exercises';
import { fmtDuration, fmtSecs } from '../format';
import { useActiveWorkout, useFinished, useSettings } from '../hooks';
import { defaultMode, finishWorkout, historyFor, newLoggedExercise, suggestionFor, withWarmups } from '../logic/session';
import { plateText } from '../logic/plates';
import { workoutCalories } from '../logic/calories';
import { freshAlternatives, isStale } from '../logic/variety';
import { wantsWarmup } from '../logic/warmup';
import { SCHEME_LABEL } from '../logic/schemes';
import { countedSets, recordsFor, sessionPrs, type PrKind } from '../logic/stats';
import { fmt, fromDisplay, toDisplay } from '../logic/units';
import type { Exercise, ExerciseNote, LoggedExercise, LogMode, SetType, Workout } from '../types';

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
  const { all, byId } = useExercises();
  const navigate = useNavigate();
  const [picker, setPicker] = useState(false);
  /** Index of the exercise a new superset partner goes after. */
  const [supersetAfter, setSupersetAfter] = useState<number | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const notes = useLiveQuery(
    async () => new Map<string, ExerciseNote>((await db.exerciseNotes.toArray()).map((n) => [n.exerciseId, n])),
    [],
  ) ?? new Map<string, ExerciseNote>();
  const modeFor = (id: string) => defaultMode(byId.get(id), notes.get(id)?.mode);
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

  /** Replaces exercise `i`, keeping any sets already done under the old one. */
  const swapTo = (i: number, ex: Exercise) => mutate((d) => {
    const old = d.exercises[i];
    const done = old.sets.filter((x) => x.done);
    const todo = old.sets.filter((x) => !x.done && x.type !== 'warmup').length || 1;
    // Keep anything already logged; fresh sets for the rest, weighted from the new exercise's history.
    const mode = modeFor(ex.id);
    const [repMin, repMax] = old.mode === 'time' && mode === 'reps' ? [8, 12] : [old.repMin, old.repMax];
    const fresh = newLoggedExercise(ex.id, done.length ? todo : old.sets.filter((x) => x.type !== 'warmup').length || 3,
      repMin, repMax, old.rest, finished ?? [], byId, settings, mode);
    if (old.supersetWithNext) fresh.supersetWithNext = true;
    d.exercises[i] = done.length
      ? { ...old, sets: done }
      : { ...fresh, note: undefined };
    if (done.length) d.exercises.splice(i + 1, 0, fresh);
  });

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
          <p className="muted small">
            <Elapsed since={w.startedAt} /> · <span className="kcal" aria-label="Calories burned">🔥 {workoutCalories(w, byId, settings.bodyWeight)} kcal</span>
            {!settings.bodyWeight && <> · <Link to="/settings">add your weight</Link> for accuracy</>}
          </p>
        )}
      </header>

      {w.exercises.map((le, ei) => {
        const ex = byId.get(le.exerciseId);
        const info = prev.get(le.exerciseId);
        const last = info?.history[0];
        const timed = le.mode === 'time';
        const s = finished && !le.scheme && !timed ? suggestionFor(le, finished, byId, settings, w.id) : null;
        const note = notes.get(le.exerciseId)?.note ?? '';
        const inSuperset = !!le.supersetWithNext && ei < w.exercises.length - 1;
        const afterSuperset = !!w.exercises[ei - 1]?.supersetWithNext;
        const nextSet = le.sets.findIndex((x) => !x.done);
        const plateSet = ex?.equipment === 'barbell' && !timed ? le.sets[nextSet] : undefined;
        // Same lift every time this muscle was trained lately: offer a change before the first set.
        const ideas = !editing && ex && finished && !le.sets.some((x) => x.done) && isStale(ex, finished, byId)
          ? freshAlternatives(ex, all, finished, settings.missingEquipment, 2)
          : [];
        const fmtLast = (x: { weight: number; reps: number }) =>
          timed ? (x.weight ? `${fmt(toDisplay(x.weight, units))}×${fmtSecs(x.reps)}` : fmtSecs(x.reps)) : `${fmt(toDisplay(x.weight, units))}×${x.reps}`;
        const markDone = (si: number, reps?: number) => {
          mutate((d) => {
            const x = d.exercises[ei].sets[si];
            x.done = true;
            if (reps != null) x.reps = reps;
            if (x.reps == null) x.reps = x.target ?? s?.reps ?? (timed ? le.repMax : le.repMin);
            if (x.weight == null && s?.weight != null) x.weight = s.weight;
          });
          // In a superset, go straight to the next exercise; rest after the last one.
          if (!editing && !inSuperset) startRest(le.sets[si].type === 'warmup' ? Math.min(60, le.rest) : le.rest);
        };
        const setMode = (mode: LogMode) => {
          saveExerciseNote(le.exerciseId, { mode });
          mutate((d) => {
            const e = d.exercises[ei];
            e.mode = mode;
            if (mode === 'time' && e.repMax < 20) { e.repMin = 30; e.repMax = 60; }
            if (mode === 'reps' && e.repMin >= 20) { e.repMin = 8; e.repMax = 12; }
          });
        };
        const hasHistory = (info?.history.length ?? 0) > 0;
        let workingIndex = 0;
        const prsBySet = info ? sessionPrs(le.sets, info.records, hasHistory) : [];
        return (
          <section key={ei} className={`card exercise ${inSuperset ? 'superset-start' : ''} ${afterSuperset ? 'superset-cont' : ''}`}>
            {inSuperset && !afterSuperset && <span className="superset-tag">Superset</span>}
            <div className="exercise-head">
              <Link to={`/exercises/${le.exerciseId}`}><ExerciseImage exercise={ex} /></Link>
              <div className="grow">
                <strong>{exerciseName(byId, le.exerciseId)}</strong>
                <MuscleTags exercise={ex} />
                <small className="muted">
                  {le.scheme ? SCHEME_LABEL[le.scheme] : timed ? `Target ${le.repMin}–${le.repMax} sec` : `Target ${le.repMin}–${le.repMax} reps`}
                  {last && <> · Last: {countedSets(last.sets).map(fmtLast).join(', ')}</>}
                </small>
              </div>
              <details className="menu">
                <summary aria-label="Exercise options">⋯</summary>
                <div>
                  <button className="ghost" onClick={(ev) => { ev.currentTarget.closest('details')?.removeAttribute('open'); setSwapIndex(ei); }}>Swap exercise</button>
                  <button className="ghost" onClick={(ev) => { ev.currentTarget.closest('details')?.removeAttribute('open'); setNoteFor(ei); }}>{note ? 'Edit note' : 'Add note'}</button>
                  {!le.scheme && (
                    <button className="ghost" onClick={(ev) => { ev.currentTarget.closest('details')?.removeAttribute('open'); setMode(timed ? 'reps' : 'time'); }}>
                      {timed ? 'Log reps instead of time' : 'Log time instead of reps'}
                    </button>
                  )}
                  {ei < w.exercises.length - 1 && (
                    <button className="ghost" onClick={(ev) => { ev.currentTarget.closest('details')?.removeAttribute('open'); mutate((d) => { d.exercises[ei].supersetWithNext = !le.supersetWithNext || undefined; }); }}>
                      {le.supersetWithNext ? 'Unlink superset' : 'Superset with next'}
                    </button>
                  )}
                  {wantsWarmup(ex, true) && !le.sets.some((x) => x.type === 'warmup') && (
                    <button className="ghost" disabled={!le.sets.some((x) => x.weight)} onClick={(ev) => {
                      ev.currentTarget.closest('details')?.removeAttribute('open');
                      mutate((d) => { d.exercises[ei] = withWarmups(d.exercises[ei], ex, true, settings); });
                    }}>Add warm-up sets</button>
                  )}
                  <button className="ghost" disabled={ei === 0} onClick={() => mutate((d) => { [d.exercises[ei - 1], d.exercises[ei]] = [d.exercises[ei], d.exercises[ei - 1]]; })}>Move up</button>
                  <button className="ghost" disabled={ei === w.exercises.length - 1} onClick={() => mutate((d) => { [d.exercises[ei + 1], d.exercises[ei]] = [d.exercises[ei], d.exercises[ei + 1]]; })}>Move down</button>
                  <button className="ghost danger" onClick={() => confirm('Remove this exercise?') && mutate((d) => { d.exercises.splice(ei, 1); })}>Remove</button>
                </div>
              </details>
            </div>

            {s && s.kind !== 'new' && <p className={`suggestion ${s.kind}`}>{s.kind === 'increase' ? '⬆️ ' : s.kind === 'deload' ? '⬇️ ' : '➡️ '}{s.message}</p>}
            {s && s.kind === 'new' && <p className="suggestion">{s.message}</p>}
            {le.scheme && le.note && <p className="suggestion program">📋 {le.note}</p>}
            {ideas.length > 0 && (
              <div className="suggestion variety">
                🔄 You've done this the last 4 times you trained {ex!.primaryMuscles[0]}. Mix it up with:
                <div className="chips">
                  {ideas.map((alt) => <button key={alt.id} className="chip" onClick={() => swapTo(ei, alt)}>{alt.name}</button>)}
                </div>
              </div>
            )}
            <StickyNote exerciseId={le.exerciseId} note={note} editing={noteFor === ei} setEditing={(v) => setNoteFor(v ? ei : null)} />
            {plateSet?.weight != null && plateSet.weight > 0 && (
              <p className="plates muted small">🏋️ {fmt(toDisplay(plateSet.weight, units))} {units}: {plateText(toDisplay(plateSet.weight, units), units)}</p>
            )}

            <div className="sets">
              <div className="set-row head">
                <span>Set</span><span>{units}</span><span>{timed ? 'Sec' : 'Reps'}</span><span />
              </div>
              {le.sets.map((set, si) => {
                const label = TYPE_LABEL[set.type] || String(++workingIndex);
                // A timed set's only meaningful record is the longest hold.
                const prs = (prsBySet[si] ?? []).filter((p) => !timed || p === 'reps');
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
                      ariaLabel={`Set ${si + 1} ${timed ? 'seconds' : 'reps'}`}
                      value={set.reps}
                      placeholder={set.target != null ? `${set.target}${set.amrap ? '+' : ''}` : String(s?.reps ?? (timed ? le.repMax : le.repMin))}
                      onChange={(v) => mutate((d) => { d.exercises[ei].sets[si].reps = v; })}
                    />
                    <button
                      className={`check ${set.done ? 'on' : ''}`}
                      aria-label={set.done ? 'Mark set not done' : 'Mark set done'}
                      onClick={() => (set.done ? mutate((d) => { d.exercises[ei].sets[si].done = false; }) : markDone(si))}
                    >✓</button>
                    {prs.length > 0 && <span className="pr-badge">🏆 {prs.map((p) => (timed ? 'Longest' : PR_LABEL[p])).join(' · ')}</span>}
                  </div>
                );
              })}
            </div>
            {timed && !editing && nextSet >= 0 && (
              <SetTimer key={nextSet} label={`set ${nextSet + 1}`} target={le.sets[nextSet].reps ?? le.repMax} onStop={(sec) => markDone(nextSet, sec)} />
            )}
            <div className="row">
              <button className="secondary grow" onClick={() => mutate((d) => {
                const sets = d.exercises[ei].sets;
                const lastSet = sets[sets.length - 1];
                sets.push({ weight: lastSet?.weight ?? s?.weight ?? null, reps: null, type: 'working', done: false });
              })}>+ Set</button>
              {le.sets.length > 1 && (
                <button className="ghost" onClick={() => mutate((d) => { d.exercises[ei].sets.pop(); })}>− Set</button>
              )}
              {!le.supersetWithNext && (
                <button className="ghost" onClick={() => setSupersetAfter(ei)} aria-label="Add a superset exercise">+ Superset</button>
              )}
            </div>
          </section>
        );
      })}

      <button className="secondary wide" onClick={() => setPicker(true)}>+ Add exercise</button>
      <textarea placeholder="Workout notes" value={w.notes ?? ''} onChange={(e) => mutate((d) => { d.notes = e.target.value; })} />
      {!editing && <button className="ghost danger wide" onClick={() => discard()}>Discard workout</button>}

      {!editing && <RestTimer />}

      {swapIndex !== null && w.exercises[swapIndex] && (
        <ExercisePicker
          title="Swap for…"
          initialMuscle={byId.get(w.exercises[swapIndex].exerciseId)?.primaryMuscles[0] ?? ''}
          excludeId={w.exercises[swapIndex].exerciseId}
          onClose={() => setSwapIndex(null)}
          onPick={(ex) => {
            swapTo(swapIndex, ex);
            setSwapIndex(null);
          }}
        />
      )}

      {supersetAfter !== null && w.exercises[supersetAfter] && (
        <ExercisePicker
          title="Superset with…"
          onClose={() => setSupersetAfter(null)}
          onPick={(ex) => {
            mutate((d) => {
              const prev = d.exercises[supersetAfter];
              const next = newLoggedExercise(ex.id, prev.sets.filter((x) => x.type !== 'warmup').length || 3, 8, 12, prev.rest,
                finished ?? [], byId, settings, modeFor(ex.id));
              // Keep the chain intact when inserting into the middle of an existing superset.
              if (prev.supersetWithNext) next.supersetWithNext = true;
              prev.supersetWithNext = true;
              d.exercises.splice(supersetAfter + 1, 0, next);
            });
            setSupersetAfter(null);
          }}
        />
      )}

      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onPick={(ex) => {
            mutate((d) => {
              d.exercises.push(newLoggedExercise(ex.id, 3, 8, 12, settings.defaultRest, finished ?? [], byId, settings, modeFor(ex.id)));
            });
            setPicker(false);
          }}
        />
      )}
    </>
  );
}
