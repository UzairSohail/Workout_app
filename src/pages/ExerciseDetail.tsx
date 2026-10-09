import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db';
import { ExerciseImage } from '../components/ExerciseImage';
import { MuscleTags } from '../components/MuscleTags';
import { StickyNote } from '../components/ExerciseNote';
import { cap, useExercises } from '../exercises';
import { fmtDate, fmtSecs } from '../format';
import { useFinished, useSettings } from '../hooks';
import { countedSets, e1rm, recordsFor } from '../logic/stats';
import { fmt, fmtWeight, toDisplay } from '../logic/units';
import type { Units } from '../types';

function Trend({ points, units }: { points: { t: number; v: number }[]; units: Units }) {
  if (points.length < 2) return <p className="muted small">Log this exercise twice to see your trend.</p>;
  const W = 320, H = 110, P = 8;
  const vs = points.map((p) => toDisplay(p.v, units));
  const min = Math.min(...vs), max = Math.max(...vs);
  const span = max - min || 1;
  const xy = vs.map((v, i) => [P + (i / (vs.length - 1)) * (W - 2 * P), H - P - ((v - min) / span) * (H - 2 * P)]);
  return (
    <figure className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Estimated one-rep max over time">
        <polyline points={xy.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="currentColor" />)}
      </svg>
      <figcaption className="muted small">
        Estimated 1RM: {fmt(Math.round(vs[0]))} → {fmt(Math.round(vs[vs.length - 1]))} {units}
      </figcaption>
    </figure>
  );
}

export function ExerciseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { byId, loading } = useExercises();
  const finished = useFinished();
  const { units } = useSettings();
  const ex = byId.get(id!);
  const note = useLiveQuery(async () => (await db.exerciseNotes.get(id!))?.note ?? '', [id]) ?? '';
  const [editingNote, setEditingNote] = useState(false);

  const sessions = useMemo(() => {
    const out: { t: number; workoutId: string; timed: boolean; sets: { weight: number; reps: number }[] }[] = [];
    for (const w of finished ?? []) {
      for (const e of w.exercises) {
        if (e.exerciseId !== id) continue;
        const sets = countedSets(e.sets);
        if (sets.length) out.push({ t: w.startedAt, workoutId: w.id, timed: e.mode === 'time', sets });
      }
    }
    return out;
  }, [finished, id]);
  const timed = sessions[0]?.timed ?? false;
  const records = useMemo(() => recordsFor(id!, finished ?? []), [finished, id]);
  const trend = useMemo(
    () => [...sessions].reverse()
      .map((s) => ({ t: s.t, v: Math.max(...s.sets.map((x) => e1rm(x.weight, x.reps))) }))
      .filter((p) => p.v > 0),
    [sessions],
  );

  if (!ex) return loading ? <p className="muted">Loading…</p> : <p>Exercise not found.</p>;

  const video = ex.videoUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} exercise form`)}`;

  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate(-1)}>‹ Back</button>
        <h1>{ex.name}</h1>
        <MuscleTags exercise={ex} />
        <p className="muted small">Equipment: {cap(ex.equipment)}</p>
      </header>

      <ExerciseImage exercise={ex} animate className="hero" />
      <a className="button secondary wide" href={video} target="_blank" rel="noreferrer">
        ▶ {ex.videoUrl ? 'Watch video' : 'Find a form video on YouTube'}
      </a>

      <section className="card">
        <h2>Your notes</h2>
        <StickyNote exerciseId={ex.id} note={note} editing={editingNote} setEditing={setEditingNote} emptyLabel="+ Add a note (seat height, grip…)" />
      </section>

      {sessions.length > 0 && timed && (
        <section className="card">
          <h2>Personal records</h2>
          <div className="stats">
            <div><strong>{fmtSecs(records.maxReps)}</strong><small>Longest</small></div>
          </div>
        </section>
      )}
      {sessions.length > 0 && !timed && (
        <section className="card">
          <h2>Personal records</h2>
          <div className="stats">
            <div><strong>{fmtWeight(records.maxWeight, units)}</strong><small>Heaviest × {records.maxWeightReps}</small></div>
            <div><strong>{fmtWeight(Math.round(records.bestE1rm * 10) / 10, units)}</strong><small>Best est. 1RM</small></div>
            <div><strong>{fmtWeight(records.maxVolume, units)}</strong><small>Best session volume</small></div>
          </div>
          <Trend points={trend} units={units} />
        </section>
      )}

      {ex.instructions.length > 0 && (
        <section className="card">
          <h2>How to do it</h2>
          <ol>{ex.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </section>
      )}

      {sessions.length > 0 && (
        <section className="card">
          <h2>History</h2>
          <ul className="plain">
            {sessions.slice(0, 20).map((s) => (
              <li key={s.workoutId}>
                <strong>{fmtDate(s.t)}</strong>{' '}
                <span className="muted">{s.sets.map((x) => {
                  const r = s.timed ? fmtSecs(x.reps) : `${x.reps}`;
                  return x.weight ? `${fmt(toDisplay(x.weight, units))}×${r}` : s.timed ? r : `${r} reps`;
                }).join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ex.custom && (
        <button className="ghost danger wide" onClick={async () => {
          if (!confirm('Delete this custom exercise? Logged sets stay in your history.')) return;
          await db.customExercises.delete(ex.id);
          navigate('/exercises', { replace: true });
        }}>Delete custom exercise</button>
      )}
      {!ex.custom && ex.images.length > 0 && <p className="muted small credit">Images and instructions: free-exercise-db (public domain).</p>}
      {!ex.custom && ex.images.length === 0 && <p className="muted small credit">No photos for this one yet. Use the form video link above.</p>}
    </>
  );
}
