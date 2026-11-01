import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExerciseImage } from '../components/ExerciseImage';
import { exerciseName, useExercises } from '../exercises';
import { fmtDate, fmtSecs } from '../format';
import { useFinished, useSettings } from '../hooks';
import { allBests, exerciseSort, type ExerciseBests } from '../logic/records';
import { fmt, toDisplay } from '../logic/units';

/** Every exercise's bests: heaviest set, estimated 1RM, most reps or longest hold, best session volume. */
export function RecordsPage() {
  const finished = useFinished();
  const { byId } = useExercises();
  const { units } = useSettings();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');

  const bests = useMemo(() => {
    const list = allBests(finished ?? []);
    return sort === 'name' ? [...list].sort(exerciseSort(byId)) : list;
  }, [finished, sort, byId]);
  const needle = q.trim().toLowerCase();
  const shown = needle ? bests.filter((b) => exerciseName(byId, b.exerciseId).toLowerCase().includes(needle)) : bests;
  const w = (kg: number) => `${fmt(Math.round(toDisplay(kg, units) * 10) / 10)} ${units}`;

  const lines = (b: ExerciseBests) => {
    const r = b.records;
    const out: string[] = [];
    if (b.timed) {
      out.push(`Longest: ${fmtSecs(r.maxReps)}${r.maxRepsDate ? ` · ${fmtDate(r.maxRepsDate)}` : ''}`);
      if (r.maxWeight > 0) out.push(`Heaviest: ${w(r.maxWeight)}`);
      return out;
    }
    if (r.maxWeight > 0) {
      out.push(`Heaviest: ${w(r.maxWeight)} × ${r.maxWeightReps}${r.maxWeightDate ? ` · ${fmtDate(r.maxWeightDate)}` : ''}`);
      out.push(`Best est. 1RM: ${w(r.bestE1rm)}`);
      out.push(`Best session volume: ${w(r.maxVolume)}`);
    } else {
      out.push(`Most reps: ${r.maxReps}${r.maxRepsDate ? ` · ${fmtDate(r.maxRepsDate)}` : ''}`);
    }
    return out;
  };

  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate(-1)}>‹ Back</button>
        <h1>Personal records</h1>
        <p className="muted small">Your best on every exercise you've logged. Warm-up sets don't count.</p>
      </header>
      {finished && bests.length === 0 && <p className="muted">Finish a workout and your bests will show up here.</p>}
      {bests.length > 0 && (
        <>
          <input type="search" placeholder="Search your exercises" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="segmented">
            <button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>Latest PR</button>
            <button className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}>A–Z</button>
          </div>
        </>
      )}
      <ul className="list">
        {shown.map((b) => (
          <li key={b.exerciseId}>
            <Link className="list-item" to={`/exercises/${b.exerciseId}`}>
              <ExerciseImage exercise={byId.get(b.exerciseId)} />
              <span>
                <strong>{exerciseName(byId, b.exerciseId)}</strong>
                {lines(b).map((l) => <small key={l} className="muted record-line">{l}</small>)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
