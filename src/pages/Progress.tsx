import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, HBars, LineChart } from '../components/Charts';
import { NumInput } from '../components/NumInput';
import { db, logBodyWeight } from '../db';
import { cap, useExercises } from '../exercises';
import { fmtDate } from '../format';
import { useFinished, useSettings } from '../hooks';
import { daysAgo, setsPerMuscle, weeklySummary, weekStreak } from '../logic/progress';
import { fmt, fromDisplay, toDisplay } from '../logic/units';

const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' });
const compact = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const todayInput = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function BodyWeightCard() {
  const { units } = useSettings();
  const entries = useLiveQuery(() => db.bodyWeight.orderBy('date').toArray(), []);
  const [value, setValue] = useState<number | null>(null);
  const [date, setDate] = useState(todayInput);

  const add = async () => {
    if (value == null || value <= 0) return;
    // Noon local time, so the date never slips across a timezone boundary.
    const t = new Date(`${date}T12:00:00`).getTime();
    await logBodyWeight(fromDisplay(value, units), Number.isNaN(t) ? Date.now() : t);
    setValue(null);
  };

  const latest = entries?.[entries.length - 1];
  return (
    <section className="card form">
      <div className="section-head">
        <h2>Body weight</h2>
        {latest && <strong>{fmt(Math.round(toDisplay(latest.weight, units) * 10) / 10)} {units}</strong>}
      </div>
      <div className="row">
        <label className="mini-field"><span>Weight ({units})</span><NumInput decimal value={value} onChange={setValue} ariaLabel="Body weight" /></label>
        <label className="mini-field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <button onClick={add} disabled={value == null}>Add</button>
      </div>
      {entries && entries.length >= 2 && (
        <LineChart
          label="Body weight"
          points={entries.map((e) => ({ t: e.date, v: toDisplay(e.weight, units) }))}
          format={(v) => `${fmt(Math.round(v * 10) / 10)} ${units}`}
        />
      )}
      {entries && entries.length > 0 && (
        <ul className="plain">
          {[...entries].reverse().slice(0, 5).map((e) => (
            <li key={e.id} className="section-head">
              <span>{fmtDate(e.date)} · {fmt(Math.round(toDisplay(e.weight, units) * 10) / 10)} {units}</span>
              <button className="ghost danger" aria-label="Delete entry" onClick={() => db.bodyWeight.delete(e.id)}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProgressView() {
  const finished = useFinished();
  const { units } = useSettings();
  const { byId } = useExercises();
  const weeks = useMemo(() => weeklySummary(finished ?? [], 12), [finished]);
  const muscles = useMemo(() => setsPerMuscle(finished ?? [], byId, daysAgo(7)), [finished, byId]);
  const streak = weekStreak(weeks);
  const thisWeek = weeks[weeks.length - 1];
  const toUnits = (kg: number) => toDisplay(kg, units);

  return (
    <>
      <div className="stats">
        <div><strong>{thisWeek?.workouts ?? 0}</strong><small>Workouts this week</small></div>
        <div><strong>{streak}</strong><small>Week streak</small></div>
        <div><strong>{finished?.length ?? 0}</strong><small>All time</small></div>
      </div>

      <section className="card">
        <h2>Workouts per week</h2>
        <BarChart label="Workouts per week" format={String}
          bars={weeks.map((w) => ({ key: w.start, label: shortDate(w.start), value: w.workouts }))} />
      </section>

      <section className="card">
        <h2>Weekly volume ({units})</h2>
        <p className="muted small">Weight × reps across all working sets.</p>
        <BarChart label="Weekly volume" format={(v) => compact(v)}
          bars={weeks.map((w) => ({ key: w.start, label: shortDate(w.start), value: Math.round(toUnits(w.volume)) }))} />
      </section>

      <section className="card">
        <h2>Sets per muscle, last 7 days</h2>
        <p className="muted small">Around 10–20 working sets per muscle each week is a good target for growth.</p>
        {muscles.length ? <HBars rows={muscles.map(([m, n]) => [cap(m), n])} /> : <p className="muted">No workouts in the last 7 days.</p>}
      </section>

      <BodyWeightCard />
    </>
  );
}
