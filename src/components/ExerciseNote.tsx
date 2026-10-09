import { useState } from 'react';
import { db } from '../db';
import type { ExerciseNote } from '../types';

/** Merges into the exercise's saved note/preferences; drops the row once it holds nothing. */
export async function saveExerciseNote(exerciseId: string, patch: Partial<Omit<ExerciseNote, 'exerciseId'>>) {
  const cur = await db.exerciseNotes.get(exerciseId);
  const next: ExerciseNote = { note: '', ...cur, ...patch, exerciseId };
  next.note = next.note.trim();
  if (!next.note && !next.mode) await db.exerciseNotes.delete(exerciseId);
  else await db.exerciseNotes.put(next);
}

export function NoteEditor({ exerciseId, note, onClose }: { exerciseId: string; note: string; onClose: () => void }) {
  const [text, setText] = useState(note);
  return (
    <div className="note-editor">
      <textarea autoFocus aria-label="Exercise note" placeholder="e.g. seat on 4, use the rope" value={text}
        onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <button className="grow" onClick={async () => { await saveExerciseNote(exerciseId, { note: text }); onClose(); }}>Save note</button>
        <button className="ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

/** The saved note, tap to edit; or an editor while editing. */
export function StickyNote({ exerciseId, note, editing, setEditing, emptyLabel }: {
  exerciseId: string;
  note: string;
  editing: boolean;
  setEditing: (v: boolean) => void;
  /** Shown when there is no note; omit to render nothing. */
  emptyLabel?: string;
}) {
  if (editing) return <NoteEditor exerciseId={exerciseId} note={note} onClose={() => setEditing(false)} />;
  if (note) return <button className="sticky-note" onClick={() => setEditing(true)} aria-label="Edit note">📝 {note}</button>;
  return emptyLabel ? <button className="ghost" onClick={() => setEditing(true)}>{emptyLabel}</button> : null;
}
