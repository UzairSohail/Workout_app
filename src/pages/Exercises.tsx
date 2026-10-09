import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExerciseImage } from '../components/ExerciseImage';
import { ExerciseFilters, filterExercises } from '../components/ExercisePicker';
import { cap, useExercises } from '../exercises';

export function Exercises() {
  const { all, loading, error } = useExercises();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [strengthOnly, setStrengthOnly] = useState(true);
  const [limit, setLimit] = useState(50);
  const results = useMemo(
    () => filterExercises(all, q, muscle, equipment, strengthOnly),
    [all, q, muscle, equipment, strengthOnly],
  );

  return (
    <>
      <header className="page-head">
        <div className="section-head">
          <h1>Exercises</h1>
          <Link className="button secondary" to="/exercises/new">+ Custom</Link>
        </div>
      </header>
      <ExerciseFilters {...{ q, setQ, muscle, setMuscle, equipment, setEquipment }} />
      <label className="toggle">
        <input type="checkbox" checked={!strengthOnly} onChange={(e) => setStrengthOnly(!e.target.checked)} />
        Include stretches, cardio and plyometrics
      </label>
      {loading && <p className="muted">Loading exercises…</p>}
      {error && <p className="error">{error}</p>}
      <p className="muted small">{results.length} exercises</p>
      <ul className="list">
        {results.slice(0, limit).map((e) => (
          <li key={e.id}>
            <Link className="list-item" to={`/exercises/${e.id}`}>
              <ExerciseImage exercise={e} />
              <span>
                <strong>{e.name}</strong>
                <small className="muted">{e.primaryMuscles.map(cap).join(', ')} · {e.equipment}{e.custom ? ' · custom' : ''}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {results.length > limit && <button className="secondary wide" onClick={() => setLimit(limit + 50)}>Show more</button>}
    </>
  );
}
