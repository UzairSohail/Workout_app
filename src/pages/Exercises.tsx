import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { nameFromQuery } from '../components/CustomExerciseForm';
import { ExerciseImage } from '../components/ExerciseImage';
import { MuscleTags } from '../components/MuscleTags';
import { ExerciseFilters, filterExercises, MyGearToggle } from '../components/ExercisePicker';
import { useSettings } from '../hooks';
import { PlusIcon } from '../components/Icons';
import { cap, useExercises } from '../exercises';

export function Exercises() {
  const { all, loading, error } = useExercises();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [strengthOnly, setStrengthOnly] = useState(true);
  const { missingEquipment } = useSettings();
  const [mine, setMine] = useState(true);
  const [limit, setLimit] = useState(50);
  const results = useMemo(
    () => filterExercises(all, q, muscle, equipment, strengthOnly, mine ? missingEquipment : undefined),
    [all, q, muscle, equipment, strengthOnly, mine, missingEquipment],
  );

  return (
    <>
      <header className="page-head row-head">
        <h1>Exercises</h1>
        <Link className="button pill-btn" to="/exercises/new"><PlusIcon />Custom</Link>
      </header>
      <ExerciseFilters {...{ q, setQ, muscle, setMuscle, equipment, setEquipment }} />
      <label className="toggle">
        <input type="checkbox" checked={!strengthOnly} onChange={(e) => setStrengthOnly(!e.target.checked)} />
        Include stretches, cardio and plyometrics
      </label>
      <MyGearToggle missing={missingEquipment} on={mine} setOn={setMine} />
      {loading && <p className="muted">Loading exercises…</p>}
      {error && <p className="error">{error}</p>}
      <h2 className="section-label" style={{ margin: '6px 2px 0' }}>{results.length.toLocaleString()} exercises</h2>
      <ul className="list" style={{ gap: 0 }}>
        {results.slice(0, limit).map((e) => (
          <li key={e.id}>
            <Link className="lib-row" to={`/exercises/${e.id}`}>
              <ExerciseImage exercise={e} />
              <span className="grow">
                <strong>{e.name}</strong>
                <span className="meta"><MuscleTags exercise={e} compact /> {cap(e.equipment)}{e.custom ? ' · custom' : ''}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {results.length > limit && <button className="secondary wide" onClick={() => setLimit(limit + 50)}>Show more</button>}
      {!loading && q.trim() && (
        <Link className="button secondary wide create-it"
          to={`/exercises/new?${new URLSearchParams({ name: nameFromQuery(q), ...(muscle ? { muscle } : {}) })}`}>
          Can't find it? Create “{nameFromQuery(q)}”
        </Link>
      )}
    </>
  );
}
