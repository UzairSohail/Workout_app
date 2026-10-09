import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { db, uid, updateSettings } from '../db';
import { ExercisePicker } from '../components/ExercisePicker';
import { exerciseName, useExercises } from '../exercises';
import { useSettings } from '../hooks';
import type { Program } from '../types';
import { copyProgram } from './Programs';

function NumberField({ label, value, onChange, disabled }: {
  label: string; value: number; onChange: (n: number) => void; disabled?: boolean;
}) {
  return (
    <label className="mini-field">
      <span>{label}</span>
      <input
        type="number" inputMode="numeric" min={0} value={value} disabled={disabled}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
    </label>
  );
}

export function ProgramEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const settings = useSettings();
  const { byId } = useExercises();
  const stored = useLiveQuery(() => db.programs.get(id!), [id]);
  const [p, setP] = useState<Program | null>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  useEffect(() => {
    if (stored && (!p || p.id !== stored.id)) setP(structuredClone(stored));
  }, [stored, p]);

  if (stored === undefined && !p) return <p className="muted">Loading…</p>;
  if (!p) return <p>Split not found.</p>;

  const ro = !!p.builtIn;
  const save = (next: Program) => {
    setP(next);
    if (!ro) db.programs.put(next);
  };
  const mutate = (fn: (draft: Program) => void) => {
    const next = structuredClone(p);
    fn(next);
    save(next);
  };

  const remove = async () => {
    if (!confirm(`Delete "${p.name}"? Past workouts are kept.`)) return;
    await db.programs.delete(p.id);
    if (settings.activeProgramId === p.id) await updateSettings({ activeProgramId: undefined, nextDayIndex: 0 });
    navigate('/programs');
  };

  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate('/programs')}>‹ Splits</button>
        {ro ? <h1>{p.name}</h1> : (
          <input className="title-input" value={p.name} onChange={(e) => mutate((d) => { d.name = e.target.value; })} />
        )}
        {ro && (
          <div className="notice">
            Built-in splits can't be edited.{' '}
            <button className="link" onClick={async () => navigate(`/programs/${await copyProgram(p)}`)}>Make a copy to customise</button>
          </div>
        )}
      </header>

      {p.days.map((day, di) => (
        <section key={day.id} className="card">
          <div className="section-head">
            {ro ? <h2>{day.name}</h2> : (
              <input className="day-input" value={day.name} onChange={(e) => mutate((d) => { d.days[di].name = e.target.value; })} />
            )}
            {!ro && (
              <span className="row tight">
                <button className="ghost" disabled={di === 0} onClick={() => mutate((d) => { [d.days[di - 1], d.days[di]] = [d.days[di], d.days[di - 1]]; })}>↑</button>
                <button className="ghost danger" onClick={() => confirm(`Remove ${day.name}?`) && mutate((d) => { d.days.splice(di, 1); })}>✕</button>
              </span>
            )}
          </div>
          {day.exercises.length === 0 && <p className="muted">No exercises yet.</p>}
          <ol className="plan">
            {day.exercises.map((e, ei) => (
              <li key={ei}>
                <div className="section-head">
                  <strong>{exerciseName(byId, e.exerciseId)}</strong>
                  {!ro && (
                    <span className="row tight">
                      <button className="ghost" disabled={ei === 0} onClick={() => mutate((d) => { const xs = d.days[di].exercises; [xs[ei - 1], xs[ei]] = [xs[ei], xs[ei - 1]]; })}>↑</button>
                      <button className="ghost danger" onClick={() => mutate((d) => { d.days[di].exercises.splice(ei, 1); })}>✕</button>
                    </span>
                  )}
                </div>
                <div className="row">
                  <NumberField label="Sets" value={e.sets} disabled={ro} onChange={(n) => mutate((d) => { d.days[di].exercises[ei].sets = Math.max(1, n); })} />
                  <NumberField label="Min reps" value={e.repMin} disabled={ro} onChange={(n) => mutate((d) => { d.days[di].exercises[ei].repMin = n; })} />
                  <NumberField label="Max reps" value={e.repMax} disabled={ro} onChange={(n) => mutate((d) => { d.days[di].exercises[ei].repMax = n; })} />
                  <NumberField label="Rest (s)" value={e.rest} disabled={ro} onChange={(n) => mutate((d) => { d.days[di].exercises[ei].rest = n; })} />
                </div>
              </li>
            ))}
          </ol>
          {!ro && <button className="secondary wide" onClick={() => setPickerFor(di)}>+ Add exercise</button>}
        </section>
      ))}

      {!ro && (
        <>
          <button className="secondary wide" onClick={() => mutate((d) => { d.days.push({ id: uid(), name: `Day ${d.days.length + 1}`, exercises: [] }); })}>
            + Add day
          </button>
          <button className="ghost danger wide" onClick={remove}>Delete split</button>
        </>
      )}

      {pickerFor !== null && (
        <ExercisePicker
          onClose={() => setPickerFor(null)}
          onPick={(ex) => {
            mutate((d) => {
              d.days[pickerFor].exercises.push({ exerciseId: ex.id, sets: 3, repMin: 8, repMax: 12, rest: settings.defaultRest });
            });
            setPickerFor(null);
          }}
        />
      )}
    </>
  );
}
