import { Link, useSearchParams } from 'react-router-dom';
import { ProgressView } from './Progress';
import { TrainingCalendar } from '../components/TrainingCalendar';
import { fmtDuration } from '../format';
import { weekStart } from '../logic/progress';
import type { Workout } from '../types';
import { useFinished, useSettings } from '../hooks';
import { workoutVolume } from '../logic/stats';
import { fmtWeight, toDisplay } from '../logic/units';

export function History() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'progress' ? 'progress' : 'log';

  return (
    <>
      <header className="page-head row-head">
        <h1>{tab === 'progress' ? 'Progress' : 'History'}</h1>
        <div className="segmented" role="tablist">
          <button className={tab === 'log' ? 'on' : ''} onClick={() => setParams({}, { replace: true })}>Log</button>
          <button className={tab === 'progress' ? 'on' : ''} onClick={() => setParams({ tab: 'progress' }, { replace: true })}>Progress</button>
        </div>
      </header>
      {tab === 'progress' ? <ProgressView /> : <HistoryLog />}
    </>
  );
}

const weekLabel = (t: number, now = Date.now()) => {
  const diff = Math.round((weekStart(now) - weekStart(t)) / (7 * 864e5));
  if (diff === 0) return 'This week';
  if (diff === 1) return 'Last week';
  return `Week of ${new Date(weekStart(t)).toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
};
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

function HistoryLog() {
  const finished = useFinished();
  const { units } = useSettings();
  // Group by calendar week, newest first.
  const groups: { label: string; items: Workout[] }[] = [];
  for (const w of finished ?? []) {
    const label = weekLabel(w.startedAt);
    if (groups[groups.length - 1]?.label === label) groups[groups.length - 1].items.push(w);
    else groups.push({ label, items: [w] });
  }
  return (
    <>
      {finished && finished.length > 0 && <TrainingCalendar workouts={finished} />}
      {finished?.length === 0 && <p className="muted">Finish your first workout and it will show up here.</p>}
      {groups.map((g) => (
        <section key={g.label}>
          <h2 className="section-label" style={{ marginBottom: 2 }}>{g.label}</h2>
          {g.items.map((w) => {
            const d = new Date(w.startedAt);
            return (
              <Link key={w.id} className="log-row" to={`/history/${w.id}`}>
                <span className="log-date"><small>{d.toLocaleDateString([], { weekday: 'short' })}</small><strong>{d.getDate()}</strong></span>
                <span className="grow">
                  <strong>{w.name}</strong>
                  <small>{fmtDuration(w.finishedAt! - w.startedAt)} · {w.exercises.length} exercises</small>
                </span>
                <span className="log-vol" aria-label={`${fmtWeight(workoutVolume(w), units)} volume`}>{compact(toDisplay(workoutVolume(w), units))} {units}</span>
              </Link>
            );
          })}
        </section>
      ))}
    </>
  );
}
