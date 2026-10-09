import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, uid } from '../db';
import { EQUIPMENT, MUSCLES, cap } from '../exercises';

export function CustomExercise() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('chest');
  const [equipment, setEquipment] = useState('machine');
  const [videoUrl, setVideoUrl] = useState('');
  const [notes, setNotes] = useState('');

  const save = async () => {
    if (!name.trim()) return;
    const id = `custom-${uid()}`;
    await db.customExercises.put({
      id, name: name.trim(), category: 'custom', equipment,
      primaryMuscles: [muscle], secondaryMuscles: [],
      instructions: notes.trim() ? notes.trim().split('\n').filter(Boolean) : [],
      images: [], videoUrl: videoUrl.trim() || undefined, custom: true,
    });
    navigate(`/exercises/${id}`, { replace: true });
  };

  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate(-1)}>‹ Back</button>
        <h1>Custom exercise</h1>
      </header>
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
        <label>Video link (optional)<input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/…" /></label>
        <label>Notes (optional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Seat height 4, one step per line" /></label>
        <button className="wide" disabled={!name.trim()} onClick={save}>Save exercise</button>
      </div>
    </>
  );
}
