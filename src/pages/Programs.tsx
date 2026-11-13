import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db, getProgramState, uid, updateSettings } from '../db';
import { CheckIcon, PlusIcon, SparkIcon } from '../components/Icons';
import { useSettings } from '../hooks';
import { programUsesSchemes } from '../logic/schemes';
import type { Program } from '../types';

export async function copyProgram(p: Program): Promise<string> {
  const id = uid();
  await db.programs.put({
    ...structuredClone(p),
    id,
    name: p.builtIn ? `My ${p.name}` : `${p.name} (copy)`,
    builtIn: false,
    createdAt: Date.now(),
    days: p.days.map((d) => ({ ...structuredClone(d), id: uid() })),
  });
  return id;
}

export function Programs() {
  const settings = useSettings();
  const programs = useLiveQuery(() => db.programs.orderBy('createdAt').toArray(), []);
  const navigate = useNavigate();

  const create = async () => {
    const id = uid();
    await db.programs.put({
      id, name: 'My split', createdAt: Date.now(),
      days: [{ id: uid(), name: 'Day 1', exercises: [] }],
    });
    navigate(`/programs/${id}`);
  };

  const activate = async (p: Program) => {
    await updateSettings({ activeProgramId: p.id, nextDayIndex: 0 });
    // Programs with their own progression need starting weights first.
    if (programUsesSchemes(p.days)) navigate(`/programs/${p.id}`);
  };

  const active = programs?.find((p) => p.id === settings.activeProgramId);
  const others = programs?.filter((p) => p.id !== settings.activeProgramId) ?? [];
  const state = useLiveQuery(() => (active ? getProgramState(active.id) : undefined), [active?.id]);
  const nextIndex = active ? settings.nextDayIndex % Math.max(1, active.days.length) : -1;
  const dayCount = (p: Program) => `${p.days.length} day${p.days.length === 1 ? '' : 's'}`;

  return (
    <>
      <header className="page-head row-head">
        <h1>Splits</h1>
        <button className="icon-btn" onClick={create} aria-label="Build your own split"><PlusIcon /></button>
      </header>

      {active && (
        <section className="card accent splits" onClick={() => navigate(`/programs/${active.id}`)}>
          <div className="section-head">
            <p className="eyebrow" style={{ color: 'var(--accent-2)' }}>Active split</p>
            <Link className="small" to={`/programs/${active.id}`} onClick={(e) => e.stopPropagation()}>Edit</Link>
          </div>
          <h2 style={{ fontSize: '1.5rem', letterSpacing: '-0.03em', margin: '6px 0 4px' }}>{active.name}</h2>
          {active.description && <p className="muted small">{active.description}</p>}
          <div className="day-tiles">
            {active.days.map((d, i) => {
              const done = state?.doneDays.includes(d.id);
              const isNext = i === nextIndex && !done;
              return (
                <div key={d.id} className={`day-tile ${isNext ? 'next' : ''}`}>
                  <span className="state">{done ? <span className="tick" aria-label="Done this week"><CheckIcon /></span> : isNext ? 'NEXT' : ''}</span>
                  <strong>{d.name}</strong>
                  <small>{d.exercises.length} ex</small>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <Link className="list-item" to="/programs/generate?mode=week">
        <span className="lead-ico" aria-hidden><SparkIcon /></span>
        <span><strong>Build a routine for me</strong><small>Goal, time and equipment → a weekly plan</small></span>
      </Link>

      <section>
        <h2 className="section-label" style={{ marginBottom: 2 }}>{active ? 'Other splits' : 'Pick a split'}</h2>
        {others.map((p) => (
          <div key={p.id} className="split-row">
            <div className="grow" role="link" tabIndex={0} onClick={() => navigate(`/programs/${p.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/programs/${p.id}`)}>
              <strong>{p.name}</strong>
              <small>{p.description || p.days.map((d) => d.name).join(' · ') || 'No days yet'}</small>
            </div>
            <span className="days">{dayCount(p)}</span>
            <button className="secondary" onClick={() => activate(p)} aria-label={`Use ${p.name}`}>Use</button>
          </div>
        ))}
      </section>
      <button className="wide dashed" onClick={create}><PlusIcon />Build your own split</button>
    </>
  );
}
