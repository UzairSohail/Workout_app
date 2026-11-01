import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, fmtDuration } from '../format';
import { dayKey, weekStreaks, workoutsByDay } from '../logic/progress';
import type { Workout } from '../types';

/** Month view of training days with week streaks. Tap a day to see what you did. */
export function TrainingCalendar({ workouts }: { workouts: Workout[] }) {
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const byDay = useMemo(() => workoutsByDay(workouts), [workouts]);
  const streaks = useMemo(() => weekStreaks(workouts), [workouts]);

  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const keyOf = (d: number) => dayKey(new Date(first.getFullYear(), first.getMonth(), d).getTime());
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const inMonth = cells.flatMap((d) => (d ? byDay.get(keyOf(d)) ?? [] : []));
  const trainedDays = cells.filter((d) => d && byDay.has(keyOf(d))).length;
  const time = inMonth.reduce((a, w) => a + (w.finishedAt! - w.startedAt), 0);
  const pickedWorkouts = picked ? byDay.get(picked) ?? [] : [];
  const go = (d: number) => { setOffset(offset + d); setPicked(null); };

  return (
    <section className="card">
      <div className="section-head">
        <button className="ghost" onClick={() => go(-1)} aria-label="Previous month">‹</button>
        <strong>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button className="ghost" onClick={() => go(1)} disabled={offset >= 0} aria-label="Next month">›</button>
      </div>
      <p className="muted small cal-summary">
        {trainedDays} day{trainedDays === 1 ? '' : 's'} trained{time > 0 ? ` · ${fmtDuration(time)}` : ''}
      </p>
      <div className="calendar">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="muted">{d}</span>)}
        {cells.map((d, i) => {
          if (d == null) return <span key={i} />;
          const k = keyOf(d);
          const n = byDay.get(k)?.length ?? 0;
          const isToday = offset === 0 && d === now.getDate();
          const future = offset === 0 && d > now.getDate();
          return (
            <button key={i} type="button" disabled={!n}
              className={`cal-day ${n ? 'hit' : ''} ${n > 1 ? 'multi' : ''} ${isToday ? 'today' : ''} ${future ? 'future' : ''} ${picked === k ? 'picked' : ''}`}
              aria-label={`${d}${n ? `, ${n} workout${n === 1 ? '' : 's'}` : ''}`}
              onClick={() => setPicked(picked === k ? null : k)}>
              {d}
            </button>
          );
        })}
      </div>
      {pickedWorkouts.length > 0 && (
        <ul className="list cal-picked">
          {pickedWorkouts.map((w) => (
            <li key={w.id}>
              <Link className="list-item" to={`/history/${w.id}`}>
                <span>
                  <strong>{w.name}</strong>
                  <small className="muted">{fmtDate(w.startedAt)} · {fmtDuration(w.finishedAt! - w.startedAt)} · {w.exercises.length} exercises</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="streaks">
        <span>🔥 <strong>{streaks.current}</strong> week streak</span>
        <span className="muted">Best: {streaks.best} week{streaks.best === 1 ? '' : 's'}</span>
      </div>
    </section>
  );
}
