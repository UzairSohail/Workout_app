import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, uid, updateSettings } from '../db';
import { exerciseName, useExercises } from '../exercises';
import { generateProgram, type Equipment, type Experience, type GeneratorInput, type Goal } from '../logic/generator';

function Choice<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="choice">
      <span className="label">{label}</span>
      <div className="segmented wrap">
        {options.map(([v, text]) => (
          <button key={String(v)} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

export function Generate() {
  const navigate = useNavigate();
  const { byId } = useExercises();
  const [input, setInput] = useState<GeneratorInput>({ goal: 'muscle', days: 3, experience: 'beginner', equipment: 'gym', minutes: 60 });
  const [id] = useState(uid);
  const program = useMemo(() => generateProgram(input, id), [input, id]);
  const set = <K extends keyof GeneratorInput>(k: K) => (v: GeneratorInput[K]) => setInput({ ...input, [k]: v });

  const save = async () => {
    await db.programs.put({ ...program, createdAt: Date.now() });
    await updateSettings({ activeProgramId: program.id, nextDayIndex: 0 });
    navigate('/', { replace: true });
  };

  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate(-1)}>‹ Back</button>
        <h1>Build my routine</h1>
        <p className="muted">Answer a few questions and get a split you can start today. You can tweak it afterwards.</p>
      </header>

      <section className="card form">
        <Choice<Goal> label="Main goal" value={input.goal} onChange={set('goal')}
          options={[['muscle', 'Build muscle'], ['strength', 'Get stronger'], ['general', 'General fitness']]} />
        <Choice<number> label="Days per week" value={input.days} onChange={set('days')}
          options={[[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']]} />
        <Choice<number> label="Time per workout" value={input.minutes} onChange={set('minutes')}
          options={[[30, '30 min'], [45, '45 min'], [60, '60 min'], [90, '90 min']]} />
        <Choice<Experience> label="Experience" value={input.experience} onChange={set('experience')}
          options={[['beginner', 'New / under 1 year'], ['intermediate', '1+ years']]} />
        <Choice<Equipment> label="Equipment" value={input.equipment} onChange={set('equipment')}
          options={[['gym', 'Full gym'], ['dumbbells', 'Dumbbells'], ['bodyweight', 'Bodyweight']]} />
      </section>

      <section className="card">
        <p className="eyebrow">Your routine</p>
        <h2>{program.name}</h2>
        <p className="muted small">{program.description}</p>
        {program.days.map((d) => (
          <div key={d.id} className="preview-day">
            <strong>{d.name}</strong>
            <ul className="plain">
              {d.exercises.map((e, i) => (
                <li key={i}>{exerciseName(byId, e.exerciseId)} <span className="muted">{e.sets} × {e.repMin}–{e.repMax}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <button className="wide" onClick={save}>Save and start using it</button>
    </>
  );
}
