import { useMemo, useState } from 'react';
import { EQUIPMENT, MUSCLES, cap, useExercises } from '../exercises';
import type { Exercise } from '../types';
import { ExerciseImage } from './ExerciseImage';

const STRENGTH = new Set(['strength', 'powerlifting', 'olympic weightlifting', 'strongman', 'custom']);

export function filterExercises(all: Exercise[], q: string, muscle: string, equipment: string, strengthOnly: boolean) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return all.filter((e) => {
    if (strengthOnly && !e.custom && !STRENGTH.has(e.category)) return false;
    if (muscle && !e.primaryMuscles.includes(muscle)) return false;
    if (equipment && e.equipment !== equipment) return false;
    const name = e.name.toLowerCase();
    return words.every((w) => name.includes(w));
  });
}

const COMMON = new Set(['barbell', 'dumbbell', 'cable', 'machine']);
const equipmentRank = (e: Exercise) => (e.custom ? -1 : COMMON.has(e.equipment) ? 0 : e.equipment === 'body only' ? 1 : 2);

export function ExerciseFilters({ q, setQ, muscle, setMuscle, equipment, setEquipment }: {
  q: string; setQ: (v: string) => void;
  muscle: string; setMuscle: (v: string) => void;
  equipment: string; setEquipment: (v: string) => void;
}) {
  return (
    <div className="filters">
      <input type="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row">
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">All muscles</option>
          {MUSCLES.map((m) => <option key={m} value={m}>{cap(m)}</option>)}
        </select>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          <option value="">All equipment</option>
          {EQUIPMENT.map((m) => <option key={m} value={m}>{cap(m)}</option>)}
        </select>
      </div>
    </div>
  );
}

export function ExercisePicker({ onPick, onClose, title = 'Add exercise', initialMuscle = '', excludeId }: {
  onPick: (e: Exercise) => void;
  onClose: () => void;
  title?: string;
  initialMuscle?: string;
  excludeId?: string;
}) {
  const { all, loading } = useExercises();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState(initialMuscle);
  const [equipment, setEquipment] = useState('');
  const [limit, setLimit] = useState(40);
  const results = useMemo(
    () => {
      const list = filterExercises(all, q, muscle, equipment, true).filter((e) => e.id !== excludeId);
      // When swapping, show common gym equipment first.
      return excludeId ? [...list].sort((a, b) => equipmentRank(a) - equipmentRank(b)) : list;
    },
    [all, q, muscle, equipment, excludeId],
  );

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="ghost" onClick={onClose}>Close</button>
      </div>
      <ExerciseFilters {...{ q, setQ, muscle, setMuscle, equipment, setEquipment }} />
      <div className="modal-body">
        {loading && <p className="muted">Loading exercises…</p>}
        <ul className="list">
          {results.slice(0, limit).map((e) => (
            <li key={e.id}>
              <button className="list-item" onClick={() => onPick(e)}>
                <ExerciseImage exercise={e} />
                <span>
                  <strong>{e.name}</strong>
                  <small className="muted">{cap(e.primaryMuscles[0] ?? '')} · {e.equipment}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {results.length > limit && (
          <button className="secondary wide" onClick={() => setLimit(limit + 40)}>Show more</button>
        )}
        {!loading && results.length === 0 && <p className="muted">No matches.</p>}
      </div>
    </div>
  );
}
