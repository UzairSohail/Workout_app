import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { BarChart } from '../components/Charts';
import { changeText, kgText, weekStats } from '../components/WeightSummary';
import { db } from '../db';
import { useExercises } from '../exercises';
import { useFinished, useSettings } from '../hooks';
import { allBests } from '../logic/records';
import { muscleBalance } from '../logic/balance';
import { MuscleBalance } from '../components/MuscleBalance';
import { daysAgo, weeklySummary, weekStreaks } from '../logic/progress';
import { toDisplay } from '../logic/units';
import { ScaleIcon, TrophyIcon } from '../components/Icons';

const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' });
const compact = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
export function ProgressView() {
  const finished = useFinished();
  const { units } = useSettings();
  const { byId } = useExercises();
  const weeks = useMemo(() => weeklySummary(finished ?? [], 12), [finished]);
  const balance = useMemo(() => muscleBalance(finished ?? [], byId, daysAgo(7)), [finished, byId]);
  const trainedThisWeek = (finished ?? []).some((w) => w.startedAt >= daysAgo(7));
  const streak = useMemo(() => weekStreaks(finished ?? []).current, [finished]);
  const thisWeek = weeks[weeks.length - 1];
  const toUnits = (kg: number) => toDisplay(kg, units);
  const bests = useMemo(() => allBests(finished ?? []), [finished]);
  const monthAgo = daysAgo(30);
  const recentPrs = bests.filter((b) => b.lastPrAt >= monthAgo).length;
  const weights = useLiveQuery(() => db.bodyWeight.toArray(), []);
  const wk = weekStats(weights ?? []);
  const weightLine = wk.thisWeek.avg != null ? `This week avg ${kgText(wk.thisWeek.avg, units)}${wk.thisWeekChange != null ? ` · ${changeText(wk.thisWeekChange, units)} vs last week` : ''}`
    : wk.lastWeek.avg != null ? `Last week avg ${kgText(wk.lastWeek.avg, units)}` : 'Log your weight daily and see the weekly average';

  return (
    <>
      <div className="stats">
        <div><strong>{thisWeek?.workouts ?? 0}</strong><small>Workouts this week</small></div>
        <div><strong>{streak}</strong><small>Week streak</small></div>
        <div><strong>{finished?.length ?? 0}</strong><small>All time</small></div>
      </div>

      <Link className="list-item" to="/records">
        <span className="pr-link-icon" aria-hidden><TrophyIcon /></span>
        <span>
          <strong>Personal records</strong>
          <small className="muted">{bests.length ? `Bests on ${bests.length} exercise${bests.length === 1 ? '' : 's'} · ${recentPrs} with a new best in the last 30 days` : 'Your bests show up after your first workout'}</small>
        </span>
      </Link>

      <Link className="list-item" to="/weight">
        <span className="pr-link-icon" aria-hidden><ScaleIcon /></span>
        <span>
          <strong>Body weight</strong>
          <small className="muted">{weightLine}</small>
        </span>
      </Link>

      <section className="card">
        <h2>Workouts per week</h2>
        <BarChart label="Workouts per week" format={String}
          bars={weeks.map((w) => ({ key: w.start, label: shortDate(w.start), value: w.workouts }))} />
      </section>

      <section className="card">
        <p className="muted small" style={{ margin: 0 }}>Weekly volume</p>
        <p className="tile-value" style={{ margin: '4px 0 0', fontSize: '1.85rem' }}>{compact(toUnits(thisWeek?.volume ?? 0))}<small> {units}</small></p>
        <p className="small" style={{ margin: '2px 0 0', color: 'var(--faint)' }}>Weight × reps across all working sets</p>
        <BarChart label="Weekly volume" format={(v) => compact(v)}
          bars={weeks.map((w) => ({ key: w.start, label: shortDate(w.start), value: Math.round(toUnits(w.volume)) }))} />
      </section>

      <section className="card">
        <div className="section-head"><h2 style={{ margin: 0 }}>Muscle balance</h2><span className="mono small" style={{ color: 'var(--faint)' }}>sets · last 7 days</span></div>
        {trainedThisWeek ? <MuscleBalance balance={balance} /> : <p className="muted">No workouts in the last 7 days.</p>}
      </section>

    </>
  );
}
