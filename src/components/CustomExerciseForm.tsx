import { useState } from 'react';
import { db, uid } from '../db';
import { EQUIPMENT, MUSCLES, cap } from '../exercises';
import type { Exercise } from '../types';

/** Saves a user-made exercise and hands it back. Used by the page and inline from a search that found nothing. */
export function CustomExerciseForm({ initialName = '', initialMuscle = '', onSaved }: {
  initialName?: string;
  initialMuscle?: string;
  onSaved: (e: Exercise) => void;
}) {
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState(initialMuscle || 'chest');
  const [equipment, setEquipment] = useState('machine');
  const [kind, setKind] = useState<'compound' | 'isolation' | 'cardio'>('isolation');
  const [videoUrl, setVideoUrl] = useState('');
  const [notes, setNotes] = useState('');

  const save = async () => {
    if (!name.trim()) return;
    const ex: Exercise = {
      id: `custom-${uid()}`, name: name.trim(), equipment,
      // Drives the calorie estimate and the suggested starting weight.
      category: kind === 'cardio' ? 'cardio' : 'custom', mechanic: kind === 'cardio' ? undefined : kind,
      primaryMuscles: [muscle], secondaryMuscles: [],
      instructions: notes.trim() ? notes.trim().split('\n').filter(Boolean) : [],
      images: [], videoUrl: videoUrl.trim() || undefined, custom: true,
    };
    await db.customExercises.put(ex);
    onSaved(ex);
  };

  return (
    <div className="form">
      <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hammer Strength Row" /></label>
      <label>Main muscle
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          {MUSCLES.map((m) => <option key={m} value={m}>{cap(m)}</option>)}
        </select>
      </label>
      <label>Equipment
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          {EQUIPMENT.map((m) => <option key={m} value={m}>{cap(m)}</option>)}
        </select>
      </label>
      <label>Type
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="compound">Compound (several muscles, e.g. squat, row)</option>
          <option value="isolation">Isolation (one muscle, e.g. curl, raise)</option>
          <option value="cardio">Cardio</option>
        </select>
      </label>
      <label>Video link (optional)<input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/…" /></label>
      <label>Notes (optional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Seat height 4, one step per line" /></label>
      <button className="wide" disabled={!name.trim()} onClick={save}>Save exercise</button>
    </div>
  );
}

/** Title-cases what was typed in the search box, for a new exercise's name. */
export const nameFromQuery = (q: string) => q.trim().replace(/\s+/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase());
