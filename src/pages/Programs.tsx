import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db, uid, updateSettings } from '../db';
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

  return (
    <>
      <header className="page-head">
        <h1>Splits</h1>
        <p className="muted">Pick the program you're running. Copy a built-in one to change it.</p>
      </header>
      <button className="wide" onClick={create}>+ Build your own split</button>
      <ul className="stack">
        {programs?.map((p) => {
          const active = p.id === settings.activeProgramId;
          return (
            <li key={p.id} className={`card ${active ? 'accent' : ''}`}>
              <div className="section-head">
                <h2>{p.name}</h2>
                {active && <span className="badge">Active</span>}
              </div>
              {p.description && <p className="muted">{p.description}</p>}
              <p className="small">{p.days.map((d) => d.name).join(' · ') || 'No days yet'}</p>
              <div className="row">
                {!active && <button onClick={() => activate(p)}>Use this</button>}
                <Link className="button secondary" to={`/programs/${p.id}`}>{p.builtIn ? 'View' : 'Edit'}</Link>
                <button className="secondary" onClick={async () => navigate(`/programs/${await copyProgram(p)}`)}>Copy</button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
