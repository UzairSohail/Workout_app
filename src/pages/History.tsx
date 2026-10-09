import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, fmtDuration } from '../format';
import { useFinished, useSettings } from '../hooks';
import { workoutVolume } from '../logic/stats';
import { fmtWeight } from '../logic/units';

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

function Calendar({ days }: { days: Set<string> }) {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const count = cells.filter((d) => d && days.has(`${first.getFullYear()}-${first.getMonth()}-${d}`)).length;

  return (
    <section className="card">
      <div className="section-head">
        <button className="ghost" onClick={() => setOffset(offset - 1)} aria-label="Previous month">‹</button>
        <strong>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · {count} workout{count === 1 ? "" : "s"}</strong>
        <button className="ghost" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="Next month">›</button>
      </div>
      <div className="calendar">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="muted">{d}</span>)}
        {cells.map((d, i) => {
          const isToday = offset === 0 && d === now.getDate();
          const hit = d != null && days.has(`${first.getFullYear()}-${first.getMonth()}-${d}`);
          return <span key={i} className={`${hit ? 'hit' : ''} ${isToday ? 'today' : ''}`}>{d ?? ''}</span>;
        })}
      </div>
    </section>
  );
}

export function History() {
  const finished = useFinished();
  const { units } = useSettings();
  const days = useMemo(() => new Set((finished ?? []).map((w) => dayKey(w.startedAt))), [finished]);

  return (
    <>
      <header className="page-head">
        <h1>History</h1>
        <p className="muted">{finished?.length ?? 0} workouts logged</p>
      </header>
      <Calendar days={days} />
      {finished?.length === 0 && <p className="muted">Finish your first workout and it will show up here.</p>}
      <ul className="list">
        {finished?.map((w) => (
          <li key={w.id}>
            <Link className="list-item" to={`/history/${w.id}`}>
              <span>
                <strong>{w.name}</strong>
                <small className="muted">
                  {fmtDate(w.startedAt)} · {fmtDuration(w.finishedAt! - w.startedAt)} · {fmtWeight(workoutVolume(w), units)} volume
                </small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
