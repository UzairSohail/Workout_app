import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { backupNow, saveFile } from '../backup';
import { db, importBackup, logBodyWeight, updateSettings, type Backup } from '../db';
import { DAYS, EVERY_DAY, weighInDay } from '../logic/weighIn';
import { fmtDate } from '../format';
import { NumInput } from '../components/NumInput';
import { cap, exerciseName, useExercises } from '../exercises';
import { kgText } from '../components/WeightSummary';
import { useSettings } from '../hooks';
import { BAR, platesPerSide } from '../logic/plates';
import { fmt, fromDisplay, toDisplay } from '../logic/units';
import type { Settings, Units } from '../types';
import { GEAR } from '../logic/equipment';
import { SESSION_MINUTES } from '../logic/generator';
import { AccountCard } from '../components/AccountCard';
import { useAccount } from '../sync';
import { cloudAvailable } from '../sync/config';
import { BoxIcon, CheckIcon, ChevronLeft, CloudIcon, PaletteIcon, DumbbellIcon, PlateIcon, TimerIcon, TrendIcon, UserIcon } from '../components/Icons';
import { THEMES, themeOf } from '../theme';
import { alertPrefs, askNotify, beepNow, canNotify, canVibrate, isIos, unlockAudio, vibrate } from '../logic/restAlert';

function RestAlertCard({ s }: { s: Settings }) {
  const prefs = alertPrefs(s);
  const ios = isIos();
  const [notifyMsg, setNotifyMsg] = useState('');
  const toggleNotify = async (on: boolean) => {
    setNotifyMsg('');
    if (!on) return updateSettings({ restNotify: false });
    const ok = await askNotify();
    await updateSettings({ restNotify: ok });
    if (!ok) setNotifyMsg(canNotify()
      ? 'Notifications are blocked. Allow them for this app in your phone settings, then try again.'
      : 'This browser does not support notifications.');
  };
  const test = () => {
    unlockAudio();
    if (prefs.sound) beepNow();
    if (prefs.vibrate) vibrate();
  };
  return (
    <section className="card form rest-alert">
      <h2>Rest timer alert</h2>
      <label className="toggle">
        <input type="checkbox" checked={prefs.sound} onChange={(e) => updateSettings({ restSound: e.target.checked })} />
        <span>Beep when rest is over</span>
      </label>
      {canVibrate() && (
        <label className="toggle">
          <input type="checkbox" checked={prefs.vibrate} onChange={(e) => updateSettings({ restVibrate: e.target.checked })} />
          <span>Vibrate</span>
        </label>
      )}
      {/* iPhone pauses web apps in the background, so a notification could never fire there. */}
      {!ios && (
        <label className="toggle">
          <input type="checkbox" checked={prefs.notify} onChange={(e) => toggleNotify(e.target.checked)} />
          <span>Notify me if I've switched to another app</span>
        </label>
      )}
      {notifyMsg && <p className="error small">{notifyMsg}</p>}
      <button className="secondary" onClick={test}>Test the alert</button>
      <p className="muted small">
        The workout screen keeps your phone awake, so leave the app open between sets for the alert to work every time.
        {ios
          ? ' On iPhone the silent switch mutes the beep, iPhone does not let web apps vibrate, and nothing can play while the phone is locked or the app is in the background.'
          : ' If you lock the phone or switch apps, the beep and a notification usually still come through, but Android may pause the app after a few minutes.'}
      </p>
    </section>
  );
}


function ThemePicker({ current }: { current: string }) {
  return (
    <>
      <ul className="group-list theme-list">
        {THEMES.map((t) => (
          <li key={t.id}>
            <button className={`list-item theme-option${t.id === current ? ' on' : ''}`} aria-pressed={t.id === current} onClick={() => updateSettings({ theme: t.id })}>
              <span className="theme-swatch" aria-hidden style={{ background: t.bg }}>
                <i style={{ background: t.card }} /><b style={{ background: t.accent }} />
              </span>
              <span><strong>{t.name}</strong><small className="muted">{t.blurb}</small></span>
              {t.id === current && <span className="theme-tick" aria-hidden><CheckIcon /></span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="muted small">If you're signed in, your theme follows you to your other phones.</p>
    </>
  );
}

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

const SECTIONS = [
  { key: 'account', icon: <CloudIcon />, group: 'Data', title: 'Account and sync', blurb: 'Sign in to keep your data on every phone' },
  { key: 'profile', icon: <UserIcon />, group: 'me', title: 'Profile', blurb: 'Name, units, body weight, height, age, weigh-in reminder' },
  { key: 'training', icon: <TrendIcon />, group: 'Training', title: 'Training', blurb: 'Workout size, abs finisher, weight increases, warm-ups' },
  { key: 'rest', icon: <TimerIcon />, group: 'Training', title: 'Rest timer alert', blurb: 'Beep, vibrate or notify when rest is over' },
  { key: 'gym', icon: <DumbbellIcon />, group: 'Training', title: "My gym's equipment", blurb: 'Hide exercises your gym can\'t do' },
  { key: 'plates', icon: <PlateIcon />, group: 'Training', title: 'Plate calculator', blurb: 'Which plates go on each side' },
  { key: 'theme', icon: <PaletteIcon />, group: 'Appearance', title: 'Theme', blurb: 'Colours for the whole app' },
  { key: 'data', icon: <BoxIcon />, group: 'Data', title: 'Backup and data', blurb: 'Export, import and spreadsheet' },
];

export function SettingsPage() {
  const s = useSettings();
  const { section: sectionKey } = useParams();
  const navigate = useNavigate();
  const { byId } = useExercises();
  const [msg, setMsg] = useState('');
  const account = useAccount();

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

  const section = SECTIONS.find((x) => x.key === sectionKey);
  if (!section) {
    return (
      <>
        <header className="page-head"><h1>Settings</h1></header>
        <Link className="list-item profile-card" to="/settings/profile">
          <span className="avatar big" aria-hidden>{s.name ? s.name.charAt(0).toUpperCase() : <UserIcon />}</span>
          <span>
            <strong>{s.name || 'Your profile'}</strong>
            <small className="mono">{[s.bodyWeight ? kgText(s.bodyWeight, s.units) : null, s.height ? `${s.height} cm` : null, s.experience ? cap(s.experience) : null].filter(Boolean).join(' · ') || 'Name, units, body weight, height'}</small>
          </span>
        </Link>
        {['Training', 'Appearance', 'Data'].map((g) => (
          <section key={g}>
            <h2 className="section-label" style={{ marginBottom: 8 }}>{g}</h2>
            <ul className="group-list settings-list">
              {SECTIONS.filter((x) => x.group === g && (x.key !== 'account' || cloudAvailable)).map((x) => (
                <li key={x.key}>
                  <Link className="list-item" to={`/settings/${x.key}`}>
                    <span className="ico" aria-hidden>{x.icon}</span>
                    <span><strong>{x.title}</strong><small className="muted">{x.key === 'account' && account.signedIn ? `Syncing as ${account.email}` : x.key === 'theme' ? themeOf(s.theme).name : x.key === 'data' && s.lastBackupAt ? `Last backup ${fmtDate(s.lastBackupAt)}` : x.blurb}</small></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="muted small credit">
          Exercise images and instructions from free-exercise-db (public domain). This app is free and has no ads.
        </p>
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate('/settings')}><ChevronLeft />Settings</button>
        <h1>{section.title}</h1>
      </header>
      {section.key === 'profile' && (
        <>
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
            <p className="muted small">Used to suggest a starting weight the first time you do an exercise, and to estimate calories burned. You can always change it, and after one session the app goes by what you actually lifted.</p>
            <div className="row">
              <label className="mini-field"><span>Body weight ({s.units})</span>
                <NumInput decimal ariaLabel="Your body weight" value={s.bodyWeight ? Math.round(toDisplay(s.bodyWeight, s.units) * 10) / 10 : null}
                  onChange={(v) => v != null && v > 0 && logBodyWeight(fromDisplay(v, s.units))} />
              </label>
              <label className="mini-field"><span>Height ({s.units === 'kg' ? 'cm' : 'in'})</span>
                <NumInput decimal ariaLabel="Your height" value={s.height ? Math.round((s.units === 'kg' ? s.height : s.height / 2.54) * 10) / 10 : null}
                  onChange={(v) => updateSettings({ height: v ? (s.units === 'kg' ? v : v * 2.54) : undefined })} />
              </label>
              <label className="mini-field"><span>Age</span>
                <NumInput ariaLabel="Your age" value={s.birthYear ? new Date().getFullYear() - s.birthYear : null}
                  onChange={(v) => updateSettings({ birthYear: v && v > 0 ? new Date().getFullYear() - v : undefined })} />
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
            <label>Weigh-in reminder
              <select value={weighInDay(s)} onChange={(e) => updateSettings({ weighInDay: Number(e.target.value) })}>
                <option value={EVERY_DAY}>Every day</option>
                {DAYS.map((d, i) => <option key={d} value={i}>Once a week, {d}s</option>)}
                <option value={-1}>Off</option>
              </select>
            </label>
            <p className="muted small">Home asks for your weight until you've logged it. Your weekly averages are under History, Progress.</p>
          </section>
        </>
      )}
      {section.key === 'training' && (
        <>
          <section className="card form" id="size">
            <h2>Workout size</h2>
            <p className="muted small">Fits every day of your split to this. Shorter drops exercises from the end, longer adds ones for the parts of the day's muscles it misses.</p>
            <label className="mini-field"><span>Size</span>
              <select value={s.sessionSize ?? 'plan'} onChange={(e) => updateSettings({ sessionSize: e.target.value as Settings['sessionSize'] })}>
                <option value="plan">As the split plans it</option>
                <option value="exercises">Number of exercises</option>
                <option value="minutes">Time</option>
              </select>
            </label>
            {s.sessionSize === 'exercises' && (
              <label className="mini-field"><span>Exercises per workout</span>
                <select value={s.sessionExercises ?? 6} onChange={(e) => updateSettings({ sessionExercises: Number(e.target.value) })}>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => <option key={n} value={n}>{n} exercises</option>)}
                </select>
              </label>
            )}
            {s.sessionSize === 'minutes' && (
              <label className="mini-field"><span>About how long</span>
                <select value={s.sessionMinutes ?? 60} onChange={(e) => updateSettings({ sessionMinutes: Number(e.target.value) })}>
                  {SESSION_MINUTES.map((n) => <option key={n} value={n}>{n} min</option>)}
                </select>
              </label>
            )}
            <label className="toggle big">
              <input type="checkbox" checked={!!s.coreFinisher} onChange={(e) => updateSettings({ coreFinisher: e.target.checked })} />
              <span>
                <strong>Abs + lower back finisher</strong>
                <small className="muted">End every workout with 2 ab exercises and 1 lower back exercise. They change from session to session{s.sessionSize === 'exercises' ? ' and come on top of the exercise count' : ''}.</small>
              </span>
            </label>
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
            <label className="toggle big">
              <input type="checkbox" checked={s.catchUp !== false} onChange={(e) => updateSettings({ catchUp: e.target.checked })} />
              <span>
                <strong>Catch up on missed areas</strong>
                <small className="muted">If your last push day (or pull, legs…) skipped part of a muscle, like upper chest, the next one does it first or adds an exercise for it.</small>
              </span>
            </label>
            <label className="toggle big">
              <input type="checkbox" checked={s.rotate !== false} onChange={(e) => updateSettings({ rotate: e.target.checked })} />
              <span>
                <strong>Rotate accessories</strong>
                <small className="muted">After about 5 weeks of the same isolation exercise on a day, swap it for one that hits the same area. Main lifts stay so you keep progressing.</small>
              </span>
            </label>
          </section>
        </>
      )}
      {section.key === 'rest' && <RestAlertCard s={s} />}
      {section.key === 'gym' && (
        <>
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
        </>
      )}
      {section.key === 'plates' && <PlateCalculator key={s.units} units={s.units} />}
      {section.key === 'account' && <AccountCard />}
      {section.key === 'theme' && <ThemePicker current={themeOf(s.theme).id} />}
      {section.key === 'data' && (
        <>
          <section className="card form">
            <h2>Your data</h2>
            <p className="muted small">
              {account.signedIn ? 'Your data is saved to your account and synced to your other phones. You can still export a copy.' : 'Everything is stored on this phone only. Export a backup now and then so you never lose your history.'}
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
        </>
      )}
    </>
  );
}
