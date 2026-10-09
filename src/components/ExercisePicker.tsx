import { useMemo, useState } from 'react';
import { EQUIPMENT, MUSCLES, cap, useExercises } from '../exercises';
import { useFinished, useSettings } from '../hooks';
import { hasGear } from '../logic/equipment';
import { freshAlternatives } from '../logic/variety';
import type { Exercise } from '../types';
import { CustomExerciseForm, nameFromQuery } from './CustomExerciseForm';
import { ExerciseImage } from './ExerciseImage';
import { MuscleTags } from './MuscleTags';

const STRENGTH = new Set(['strength', 'powerlifting', 'olympic weightlifting', 'strongman', 'custom']);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** Everyday shorthand people type, mapped to the words the library uses. */
const SYNONYMS: Record<string, string> = { db: 'dumbbell', bb: 'barbell', kb: 'kettlebell' };
// "presses" -> "press", "crunches" -> "crunch", "curls" -> "curl", so plurals still match.
const stem = (w: string) => {
  if (w.length < 4) return w;
  if (/(ss|sh|ch|x)es$/.test(w)) return w.slice(0, -2);
  return w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
};
const queryWords = (q: string) => norm(q).split(' ').filter(Boolean).flatMap((w) => (SYNONYMS[w] ?? stem(w)).split(' '));

/**
 * Every query word must appear in the exercise's name, an everyday alias, or its equipment, so
 * "machine leg press" finds "Leg Press" (a machine) and "db curls" finds "Dumbbell Bicep Curl".
 * Best matches first: exact name, then names starting with the query, then the rest.
 */
export function filterExercises(all: Exercise[], q: string, muscle: string, equipment: string, strengthOnly: boolean, missing?: readonly string[]) {
  const words = queryWords(q);
  const phrase = words.join(' ');
  const rank = (e: Exercise) => {
    const names = [e.name, ...(e.aliases ?? [])].map(norm);
    if (names.some((n) => n === phrase)) return 0;
    if (names.some((n) => n.startsWith(phrase))) return 1;
    if (names.some((n) => words.every((w) => n.includes(w)))) return 2;
    return 3;
  };
  const list = all.filter((e) => {
    if (strengthOnly && !e.custom && !STRENGTH.has(e.category)) return false;
    if (muscle && !e.primaryMuscles.includes(muscle)) return false;
    if (equipment && e.equipment !== equipment) return false;
    if (!hasGear(e, missing)) return false;
    if (!words.length) return true;
    const gear = e.equipment === 'cable' ? 'cable machine' : norm(e.equipment);
    return [e.name, ...(e.aliases ?? [])].some((n) => {
      const text = `${norm(n)} ${gear}`;
      return words.every((w) => text.includes(w));
    });
  });
  if (!words.length) return list;
  const ranks = new Map(list.map((e) => [e, rank(e)]));
  return list.sort((a, b) => ranks.get(a)! - ranks.get(b)!);
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

/** "Only equipment I have" switch; renders nothing until some equipment is marked missing in Settings. */
export function MyGearToggle({ missing, on, setOn }: { missing?: string[]; on: boolean; setOn: (v: boolean) => void }) {
  if (!missing?.length) return null;
  return (
    <label className="toggle">
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
      Only equipment my gym has
    </label>
  );
}

export function ExercisePicker({ onPick, onClose, title = 'Add exercise', initialMuscle = '', excludeId }: {
  onPick: (e: Exercise) => void;
  onClose: () => void;
  title?: string;
  initialMuscle?: string;
  excludeId?: string;
}) {
  const { all, byId, loading } = useExercises();
  const finished = useFinished();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState(initialMuscle);
  const [equipment, setEquipment] = useState('');
  const { missingEquipment } = useSettings();
  const [mine, setMine] = useState(true);
  const [limit, setLimit] = useState(40);
  const [creating, setCreating] = useState(false);
  const results = useMemo(
    () => {
      const list = filterExercises(all, q, muscle, equipment, true, mine ? missingEquipment : undefined).filter((e) => e.id !== excludeId);
      // When swapping, show common gym equipment first.
      return excludeId ? [...list].sort((a, b) => equipmentRank(a) - equipmentRank(b)) : list;
    },
    [all, q, muscle, equipment, excludeId, mine, missingEquipment],
  );
  const swapping = excludeId ? byId.get(excludeId) : undefined;
  const fresh = useMemo(
    () => (swapping ? freshAlternatives(swapping, all, finished ?? [], missingEquipment) : []),
    [swapping, all, finished, missingEquipment],
  );
  const pickRow = (e: Exercise) => (
    <li key={e.id}>
      <button className="list-item" onClick={() => onPick(e)}>
        <ExerciseImage exercise={e} />
        <span>
          <strong>{e.name}</strong>
          <small className="muted"><MuscleTags exercise={e} compact /> {e.equipment}</small>
        </span>
      </button>
    </li>
  );

  if (creating) {
    return (
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>New exercise</h2>
          <button className="ghost" onClick={() => setCreating(false)}>Back</button>
        </div>
        <div className="modal-body">
          <CustomExerciseForm initialName={nameFromQuery(q)} initialMuscle={muscle} onSaved={onPick} />
        </div>
      </div>
    );
  }

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="ghost" onClick={onClose}>Close</button>
      </div>
      <ExerciseFilters {...{ q, setQ, muscle, setMuscle, equipment, setEquipment }} />
      {initialMuscle && (
        <label className="toggle">
          <input type="checkbox" checked={muscle === initialMuscle} onChange={(e) => setMuscle(e.target.checked ? initialMuscle : '')} />
          Only {cap(initialMuscle)} exercises
        </label>
      )}
      <MyGearToggle missing={missingEquipment} on={mine} setOn={setMine} />
      <div className="modal-body">
        {loading && <p className="muted">Loading exercises…</p>}
        {fresh.length > 0 && !q && (
          <>
            <h3 className="list-head">🔄 Something different</h3>
            <ul className="list">{fresh.map(pickRow)}</ul>
            <h3 className="list-head">All matches</h3>
          </>
        )}
        <ul className="list">
          {results.slice(0, limit).map(pickRow)}
        </ul>
        {results.length > limit && (
          <button className="secondary wide" onClick={() => setLimit(limit + 40)}>Show more</button>
        )}
        {!loading && results.length === 0 && <p className="muted">No matches.</p>}
        {!loading && q.trim() && (
          <button className="secondary wide create-it" onClick={() => setCreating(true)}>
            Can't find it? Create “{nameFromQuery(q)}”
          </button>
        )}
      </div>
    </div>
  );
}
