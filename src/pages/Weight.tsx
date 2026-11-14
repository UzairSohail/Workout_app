import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { TimeChart } from '../components/Charts';
import { NumInput } from '../components/NumInput';
import { changeText, kgText, weekStats } from '../components/WeightSummary';
import { db, logBodyWeight } from '../db';
import { fmtDate } from '../format';
import { useSettings } from '../hooks';
import { fmt, fromDisplay, toDisplay } from '../logic/units';
import { ChevronLeft, XIcon } from '../components/Icons';
import { todaysEntry } from '../logic/weighIn';
import { toast } from '../components/UndoBar';

const dayMonth = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const weekdayDate = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const DAY = 864e5;
const RANGES = [
  { key: '1W', label: '1W', days: 7 },
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 91 },
  { key: 'All', label: 'All', days: null },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];
const dateInput = (t = Date.now()) => {
  const d = new Date(t);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Daily body weight log with weekly averages. */
export function WeightPage() {
  const { units } = useSettings();
  const navigate = useNavigate();
  const entries = useLiveQuery(() => db.bodyWeight.orderBy('date').toArray(), []);
  const [value, setValue] = useState<number | null>(null);
  const [date, setDate] = useState(() => dateInput());
  const [showAll, setShowAll] = useState(false);
  const [range, setRange] = useState<RangeKey>('1M');

  const list = entries ?? [];
  const today = todaysEntry(list);
  const stats = weekStats(list);
  const days = RANGES.find((r) => r.key === range)!.days;
  const endOfToday = new Date().setHours(23, 59, 59, 999);
  const rangeFrom = days == null
    ? (list.length ? new Date(list[0].date).setHours(0, 0, 0, 0) : endOfToday - 7 * DAY)
    : new Date(endOfToday - days * DAY + 1).getTime();
  const recent = list.filter((e) => e.date >= rangeFrom);
  const disp = (kg: number) => Math.round(toDisplay(kg, units) * 10) / 10;

  const save = async () => {
    if (value == null || value <= 0) return;
    // Noon local time, so the date never slips across a timezone boundary.
    const t = new Date(`${date}T12:00:00`).getTime();
    await logBodyWeight(fromDisplay(value, units), Number.isNaN(t) ? Date.now() : t);
    setValue(null);
    setDate(dateInput());
  };

  const pastDay = date !== dateInput();
  const shown = [...list].reverse().slice(0, showAll ? undefined : 14);

  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate(-1)}><ChevronLeft />Back</button>
        <h1>Body weight</h1>
        <p className="muted small">Weigh yourself every day, ideally in the morning before eating. Daily numbers jump around, so the weekly average is the one to watch.</p>
      </header>

      <section className="card form">
        <div className="section-head">
          <h2>{pastDay ? `Weight on ${fmtDate(new Date(`${date}T12:00:00`).getTime())}` : 'Today'}</h2>
          {today && !pastDay && <strong>{kgText(today.weight, units)} logged</strong>}
        </div>
        <div className="row">
          <label className="mini-field"><span>Weight ({units})</span>
            <NumInput decimal value={value} onChange={setValue} ariaLabel="Body weight" placeholder={today && !pastDay ? String(disp(today.weight)) : undefined} />
          </label>
          <label className="mini-field"><span>Date</span>
            <input type="date" value={date} max={dateInput()} onChange={(e) => setDate(e.target.value || dateInput())} />
          </label>
        </div>
        <button className="wide" onClick={save} disabled={value == null || value <= 0}>
          {(pastDay ? list.some((e) => dateInput(e.date) === date) : today) ? 'Update weight' : 'Save weight'}
        </button>
      </section>

      <div className="stats">
        <div>
          <strong>{stats.thisWeek.avg != null ? kgText(stats.thisWeek.avg, units) : '–'}</strong>
          <small>This week avg{stats.thisWeek.count ? ` (${stats.thisWeek.count} day${stats.thisWeek.count === 1 ? '' : 's'})` : ''}</small>
        </div>
        <div>
          <strong>{stats.lastWeek.avg != null ? kgText(stats.lastWeek.avg, units) : '–'}</strong>
          <small>Last week avg</small>
        </div>
        <div>
          <strong className="weight-change">{stats.lastWeekChange != null ? changeText(stats.lastWeekChange, units) : '–'}</strong>
          <small>Last week vs before</small>
        </div>
      </div>

      {list.length > 0 && (
        <section className="card">
          <h2>Every day</h2>
          <div className="segmented range-chips" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.key} className={range === r.key ? 'on' : ''} aria-pressed={range === r.key} onClick={() => setRange(r.key)}>{r.label}</button>
            ))}
          </div>
          {recent.length > 0 ? (
            <TimeChart label="Daily body weight" from={rangeFrom} to={endOfToday} dateLabel={dayMonth} pointDate={weekdayDate}
              points={recent.map((e) => ({ t: e.date, v: toDisplay(e.weight, units) }))}
              format={(v) => `${fmt(Math.round(v * 10) / 10)} ${units}`} valueLabel={(v) => fmt(Math.round(v * 10) / 10)} />
          ) : <p className="muted">No weigh-ins in this range. Try a longer one.</p>}
        </section>
      )}

      {list.length > 0 && (
        <section className="card">
          <h2>Log</h2>
          <ul className="plain">
            {shown.map((e) => (
              <li key={e.id} className="section-head">
                <span>{fmtDate(e.date)} · {kgText(e.weight, units)}</span>
                <button className="ghost danger" aria-label={`Delete ${fmtDate(e.date)}`}
                  onClick={async () => { await db.bodyWeight.delete(e.id); toast(`Deleted the weigh-in from ${fmtDate(e.date)}`, () => db.bodyWeight.put(e)); }}><XIcon /></button>
              </li>
            ))}
          </ul>
          {!showAll && list.length > 14 && <button className="ghost wide" onClick={() => setShowAll(true)}>Show all {list.length}</button>}
        </section>
      )}
    </>
  );
}
