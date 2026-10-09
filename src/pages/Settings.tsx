import { useState } from 'react';
import { backupNow, saveFile } from '../backup';
import { db, importBackup, logBodyWeight, updateSettings, type Backup } from '../db';
import { DAYS, weighInDay } from '../logic/weighIn';
import { fmtDate } from '../format';
import { NumInput } from '../components/NumInput';
import { exerciseName, useExercises } from '../exercises';
import { useSettings } from '../hooks';
import { BAR, platesPerSide } from '../logic/plates';
import { fmt, fromDisplay, toDisplay } from '../logic/units';
import type { Units } from '../types';
import { GEAR } from '../logic/equipment';


const csvCell = (v: string | number) => (typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v));

function PlateCalculator({ units }: { units: Units }) {
  const [total, setTotal] = useState<number | null>(units === 'kg' ? 60 : 135);
  const [bar, setBar] = useState<number | null>(BAR[units]);
  const r = platesPerSide(total ?? 0, bar ?? 0, units);
  return (
    <section className="card">
      <h2>Plate calculator</h2>
      <div className="row">
        <label className="mini-field"><span>Total ({units})</span><NumInput decimal value={total} onChange={setTotal} /></label>
        <label className="mini-field"><span>Bar ({units})</span><NumInput decimal value={bar} onChange={setBar} /></label>
      </div>
      <p>
        {r.plates.length ? <>Each side: <strong>{r.plates.map(fmt).join(' + ')}</strong></> : 'Just the bar.'}
        {r.remainder > 0 && <span className="muted"> ({fmt(r.remainder)} {units} per side can't be made with standard plates)</span>}
      </p>
    </section>
  );
}

export function SettingsPage() {
  const s = useSettings();
  const { byId } = useExercises();
  const [msg, setMsg] = useState('');

  const setUnits = (units: Units) => {
    if (units === s.units) return;
    updateSettings(units === 'kg'
      ? { units, upperIncrement: 2.5, lowerIncrement: 5 }
      : { units, upperIncrement: 5, lowerIncrement: 10 });
  };

  const exportJson = async () => {
    try {
      await backupNow();
    } catch {
      /* cancelled */
    }
  };

  const exportCsv = async () => {
    const workouts = (await db.workouts.orderBy('startedAt').toArray()).filter((w) => w.finishedAt);
    const rows = [['date', 'workout', 'exercise', 'set', 'type', `weight_${s.units}`, 'reps', 'seconds']];
    for (const w of workouts) {
      for (const e of w.exercises) {
        e.sets.forEach((set, i) => rows.push([
          new Date(w.startedAt).toISOString(), w.name, exerciseName(byId, e.exerciseId), String(i + 1), set.type,
          set.weight == null ? '' : String(toDisplay(set.weight, s.units)),
          e.mode === 'time' ? '' : String(set.reps ?? ''), e.mode === 'time' ? String(set.reps ?? '') : '',
        ]));
      }
    }
    await saveFile('workouts.csv', rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv').catch(() => {});
  };

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Backup;
      await importBackup(data);
      setMsg(`Imported ${data.workouts?.length ?? 0} workouts.`);
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <header className="page-head"><h1>Settings</h1></header>

      <section className="card form">
        <label>Your name<input value={s.name} onChange={(e) => updateSettings({ name: e.target.value })} placeholder="Shown on the Today screen" /></label>
        <div>
          <span className="label">Units</span>
          <div className="segmented">
            {(['kg', 'lb'] as Units[]).map((u) => (
              <button key={u} className={s.units === u ? 'on' : ''} onClick={() => setUnits(u)}>{u}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="card form">
        <h2>About you</h2>
        <p className="muted small">Used to suggest a starting weight the first time you do an exercise. You can always change it, and after one session the app goes by what you actually lifted.</p>
        <div className="row">
          <label className="mini-field"><span>Body weight ({s.units})</span>
            <NumInput decimal ariaLabel="Your body weight" value={s.bodyWeight ? Math.round(toDisplay(s.bodyWeight, s.units) * 10) / 10 : null}
              onChange={(v) => v != null && v > 0 && logBodyWeight(fromDisplay(v, s.units))} />
          </label>
          <label className="mini-field"><span>Height ({s.units === 'kg' ? 'cm' : 'in'})</span>
            <NumInput decimal ariaLabel="Your height" value={s.height ? Math.round((s.units === 'kg' ? s.height : s.height / 2.54) * 10) / 10 : null}
              onChange={(v) => updateSettings({ height: v ? (s.units === 'kg' ? v : v * 2.54) : undefined })} />
          </label>
        </div>
        <div>
          <span className="label">Sex (strength estimates differ a lot)</span>
          <div className="segmented">
            {([['male', 'Male'], ['female', 'Female'], [undefined, 'Skip']] as const).map(([v, t]) => (
              <button key={t} className={s.sex === v ? 'on' : ''} onClick={() => updateSettings({ sex: v })}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Lifting experience</span>
          <div className="segmented">
            {([['beginner', 'Under 1 year'], ['intermediate', '1–3 years'], ['advanced', '3+ years']] as const).map(([v, t]) => (
              <button key={v} className={(s.experience ?? 'beginner') === v ? 'on' : ''} onClick={() => updateSettings({ experience: v })}>{t}</button>
            ))}
          </div>
        </div>
        <label>Weekly weigh-in reminder
          <select value={weighInDay(s)} onChange={(e) => updateSettings({ weighInDay: Number(e.target.value) })}>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}s</option>)}
            <option value={-1}>Off</option>
          </select>
        </label>
        <p className="muted small">On that day, Home asks for your weight. You can log it any other day too, on Home or in Progress.</p>
      </section>

      <section className="card form">
        <h2>Progression</h2>
        <p className="muted small">When you hit the top of your rep range on every set, the next workout suggests adding this much.</p>
        <div className="row">
          <label className="mini-field"><span>Upper body ({s.units})</span>
            <NumInput decimal value={s.upperIncrement} onChange={(v) => v != null && updateSettings({ upperIncrement: v })} />
          </label>
          <label className="mini-field"><span>Lower body ({s.units})</span>
            <NumInput decimal value={s.lowerIncrement} onChange={(v) => v != null && updateSettings({ lowerIncrement: v })} />
          </label>
          <label className="mini-field"><span>Default rest (s)</span>
            <NumInput value={s.defaultRest} onChange={(v) => v != null && updateSettings({ defaultRest: v })} />
          </label>
        </div>
      </section>

      <section className="card form">
        <label className="toggle big">
          <input type="checkbox" checked={s.warmups !== false} onChange={(e) => updateSettings({ warmups: e.target.checked })} />
          <span>
            <strong>Warm-up sets</strong>
            <small className="muted">Add lighter ramp-up sets before heavy barbell lifts and the first exercise of each workout.</small>
          </span>
        </label>
      </section>

      <section className="card form">
        <h2>My gym's equipment</h2>
        <p className="muted small">Untick anything your gym doesn't have. Exercise lists, swap suggestions and the routine builder will leave those exercises out.</p>
        <div className="gear-list">
          {GEAR.map(([key, label]) => {
            const missing = s.missingEquipment ?? [];
            const have = !missing.includes(key);
            return (
              <label key={key} className="toggle">
                <input type="checkbox" checked={have} onChange={(e) => updateSettings({
                  missingEquipment: e.target.checked ? missing.filter((m) => m !== key) : [...missing, key],
                })} />
                {label}
              </label>
            );
          })}
        </div>
      </section>

      <PlateCalculator key={s.units} units={s.units} />

      <section className="card form">
        <h2>Your data</h2>
        <p className="muted small">
          Everything is stored on this phone only. Export a backup now and then so you never lose your history.
          {s.lastBackupAt ? ` Last backup: ${fmtDate(s.lastBackupAt)}.` : ' No backup yet.'}
        </p>
        <button className="secondary wide" onClick={exportJson}>Export backup (JSON)</button>
        <button className="secondary wide" onClick={exportCsv}>Export spreadsheet (CSV)</button>
        <label className="button secondary wide file">
          Import backup
          <input type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </label>
        {msg && <p>{msg}</p>}
      </section>

      <p className="muted small credit">
        Exercise images and instructions from free-exercise-db (public domain). This app is free and has no ads or accounts.
      </p>
    </>
  );
}
