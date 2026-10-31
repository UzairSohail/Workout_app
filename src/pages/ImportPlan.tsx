import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveForLater, uid } from '../db';
import { ExercisePicker } from '../components/ExercisePicker';
import { NumInput } from '../components/NumInput';
import { exerciseName, useExercises } from '../exercises';
import { useActiveWorkout, useFinished, useSettings } from '../hooks';
import { matchExercise, parsePlan, type PlanRow } from '../logic/planImport';
import { historyFor, startWorkout, suggestionFor } from '../logic/session';
import { fmtWeight } from '../logic/units';
import type { LoggedExercise, Workout } from '../types';

interface Row extends PlanRow {
  key: string;
  exerciseId?: string;
}

export function ImportPlan() {
  const navigate = useNavigate();
  const settings = useSettings();
  const finished = useFinished();
  const active = useActiveWorkout();
  const { all, byId, loading } = useExercises();
  const [status, setStatus] = useState<'idle' | 'reading' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const read = async (list: FileList | null) => {
    // Copy now: the input is cleared right after this starts, which empties the live FileList.
    const files = [...(list ?? [])];
    if (!files.length) return;
    setStatus('reading');
    setProgress(0);
    setError('');
    try {
      const { readText } = await import('../logic/ocr');
      const text = await readText(files, setProgress);
      const plan = parsePlan(text);
      // Exercises already in the history win when several catalog entries fit.
      const used = new Set((finished ?? []).flatMap((w) => w.exercises.map((e) => e.exerciseId)));
      setRows(plan.rows.map((r) => ({ ...r, key: uid(), exerciseId: matchExercise(all, r.name, used)?.id })));
      setName(plan.title ?? 'Imported workout');
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const ready = rows.filter((r) => r.exerciseId);

  /** The plan as a workout to copy: same exercises, sets, reps and supersets; weights come from history when it starts. */
  const draft = (): Workout => ({
    id: uid(),
    name: name.trim() || 'Imported workout',
    startedAt: Date.now(),
    exercises: ready.map((r): LoggedExercise => ({
      exerciseId: r.exerciseId!,
      repMin: r.repMin,
      repMax: Math.max(r.repMin, r.repMax),
      rest: settings.defaultRest,
      mode: r.mode,
      ...(r.supersetWithNext ? { supersetWithNext: true } : {}),
      sets: Array.from({ length: Math.max(1, r.sets) }, () => ({ weight: null, reps: null, type: 'working' as const, done: false })),
    })),
  });

  const start = async () => {
    await startWorkout({ copyOf: draft() }, byId);
    navigate('/workout');
  };
  const save = async () => {
    const replaced = await saveForLater(draft());
    alert(`${replaced ? 'Updated' : 'Saved'} "${name.trim() || 'Imported workout'}" in your saved workouts on the Today tab.`);
    navigate('/', { replace: true });
  };

  // What the first working set will be, so it's clear the weights are the app's own.
  const weightNote = useMemo(() => {
    const out = new Map<string, string>();
    for (const r of rows) {
      if (!r.exerciseId || r.mode === 'time') continue;
      const s = suggestionFor({ exerciseId: r.exerciseId, repMin: r.repMin, repMax: r.repMax }, finished ?? [], byId, settings);
      const seen = historyFor(r.exerciseId, finished ?? []).length > 0;
      out.set(r.key, s.weight == null
        ? (seen ? 'Weight from your last session' : 'No history yet, you pick the weight')
        : `${fmtWeight(s.weight, settings.units)} ${seen ? 'from your history' : 'starting estimate'}`);
    }
    return out;
  }, [rows, finished, byId, settings]);

  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate(-1)}>‹ Back</button>
        <h1>Copy a plan</h1>
        <p className="muted">
          Take a screenshot of a workout in Fitbod (or a similar app) and the app copies its exercises, sets and reps.
          Weights come from your own history here, not from the screenshot.
        </p>
      </header>

      {status !== 'done' && (
        <section className="card form">
          <label className="button wide file-button">
            📷 Choose screenshot{status === 'reading' ? '…' : ''}
            <input type="file" accept="image/*" multiple hidden disabled={status === 'reading' || loading}
              onChange={(e) => { read(e.target.files); e.target.value = ''; }} />
          </label>
          <p className="muted small">Long plan? Pick two or more screenshots at once, in order. Reading happens on this phone; nothing is uploaded.</p>
          {status === 'reading' && (
            <>
              <p className="muted small">Reading the screenshot… {Math.round(progress * 100)}%{progress === 0 ? ' (the first time takes a little longer)' : ''}</p>
              <div className="meter"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            </>
          )}
          {status === 'error' && <p className="notice">Couldn't read that screenshot ({error}). Check you're online for the first import and try again.</p>}
        </section>
      )}

      {status === 'done' && (
        <>
          <section className="card">
            <input className="title-input" aria-label="Workout name" value={name} onChange={(e) => setName(e.target.value)} />
            {rows.length === 0
              ? <p className="notice">No exercises found in that screenshot. Try one that shows the exercise names with their sets and reps.</p>
              : <p className="muted small">Check each exercise below. Tap a name to change it.</p>}
            <ol className="plan">
              {rows.map((r, i) => (
                <li key={r.key} className={r.supersetWithNext || rows[i - 1]?.supersetWithNext ? 'in-superset' : undefined}>
                  <div className="section-head">
                    <button className="link import-name" onClick={() => setPickerFor(r.key)}>
                      {r.exerciseId ? <strong>{exerciseName(byId, r.exerciseId)}</strong> : <strong className="danger">Not found, tap to choose</strong>}
                    </button>
                    <button className="ghost danger" aria-label={`Remove ${r.name}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>✕</button>
                  </div>
                  <p className="muted small">
                    Plan says “{r.name}”{r.supersetWithNext ? ' · superset with the next one' : ''}
                    {weightNote.get(r.key) ? ` · ${weightNote.get(r.key)}` : ''}
                  </p>
                  <div className="row">
                    <label className="mini-field"><span>Sets</span>
                      <NumInput ariaLabel={`Sets for ${r.name}`} value={r.sets} onChange={(n) => update(r.key, { sets: n ?? 1 })} />
                    </label>
                    {r.mode === 'time' ? (
                      <label className="mini-field"><span>Seconds</span>
                        <NumInput ariaLabel={`Seconds for ${r.name}`} value={r.repMin} onChange={(n) => update(r.key, { repMin: n ?? 30, repMax: n ?? 30 })} />
                      </label>
                    ) : (
                      <>
                        <label className="mini-field"><span>Min reps</span>
                          <NumInput ariaLabel={`Min reps for ${r.name}`} value={r.repMin} onChange={(n) => update(r.key, { repMin: n ?? 1 })} />
                        </label>
                        <label className="mini-field"><span>Max reps</span>
                          <NumInput ariaLabel={`Max reps for ${r.name}`} value={r.repMax} onChange={(n) => update(r.key, { repMax: n ?? 1 })} />
                        </label>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <button className="secondary wide" onClick={() => setPickerFor('new')}>+ Add exercise</button>
          </section>

          {active && <p className="notice">Finish or discard the workout in progress to start this one now, or save it for later.</p>}
          <button className="wide" disabled={!ready.length || !!active} onClick={start}>Start workout</button>
          <button className="secondary wide" disabled={!ready.length} onClick={save}>Save for later</button>
          <button className="ghost wide" onClick={() => { setRows([]); setStatus('idle'); }}>Use a different screenshot</button>
          {ready.length < rows.length && <p className="muted small">Exercises marked “not found” are left out unless you choose one.</p>}
        </>
      )}

      {pickerFor && (
        <ExercisePicker
          title={pickerFor === 'new' ? 'Add exercise' : 'Choose exercise'}
          onClose={() => setPickerFor(null)}
          onPick={(ex) => {
            if (pickerFor === 'new') {
              setRows((rs) => [...rs, { key: uid(), name: ex.name, exerciseId: ex.id, sets: 3, repMin: 8, repMax: 12, mode: 'reps' }]);
            } else update(pickerFor, { exerciseId: ex.id });
            setPickerFor(null);
          }}
        />
      )}
    </>
  );
}
