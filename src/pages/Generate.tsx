import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { db, uid, updateSettings } from '../db';
import { exerciseName, useExercises } from '../exercises';
import { useFinished, useSettings } from '../hooks';
import { startWorkout, suggestionFor } from '../logic/session';
import { fmtWeight } from '../logic/units';
import type { Day } from '../types';
import { GEAR, generatorEquipment, hasGear } from '../logic/equipment';
import { GROUP_LABEL, mainTargets, TARGETS } from '../logic/targets';
import { estimateMinutes, generateProgram, generateToday, isFinisherMove, SESSION_MINUTES, weekCoverage, weeklySets, WEEKLY_SETS, type Equipment, type Experience, type GeneratorInput, type Goal } from '../logic/generator';
import { MOVE_BY_ID } from '../logic/targets';

function Choice<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="choice">
      <span className="label">{label}</span>
      <div className="segmented wrap">
        {options.map(([v, text]) => (
          <button key={String(v)} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

export function Generate() {
  const [params, setParams] = useSearchParams();
  const today = params.get('mode') !== 'week';
  return (
    <>
      <header className="page-head">
        <BackButton />
        <h1>{today ? "Today's workout" : 'Build my routine'}</h1>
        <p className="muted small">{today
          ? 'Rested muscles first, weights from your last sessions.'
          : 'A weekly split you can tweak afterwards.'}</p>
        <div className="segmented">
          <button className={today ? 'on' : ''} onClick={() => setParams({ mode: 'today' }, { replace: true })}>Just today</button>
          <button className={today ? '' : 'on'} onClick={() => setParams({ mode: 'week' }, { replace: true })}>Weekly routine</button>
        </div>
      </header>
      {today ? <TodayGenerator /> : <WeekGenerator />}
    </>
  );
}

const GOAL_TEXT: Record<Goal, string> = { muscle: 'Build muscle', strength: 'Get stronger', general: 'General fitness' };
const GEAR_TEXT: Record<Equipment, string> = { gym: 'Full gym', dumbbells: 'Dumbbells', bodyweight: 'Bodyweight' };
const minutesText = (m: number) => (m < 120 ? `${m} min` : '2 hours');

/** Keeps the questions folded into one line so the result is the first thing you see. */
function OptionsFold({ summary, children }: { summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card form">
      <div className="options-line">
        <span className="small"><span className="muted">Options:</span> {summary}</span>
        <button className="link small" onClick={() => setOpen(!open)}>{open ? 'Done' : 'Change'}</button>
      </div>
      {open && children}
    </section>
  );
}

function BackButton() {
  const navigate = useNavigate();
  return <button className="ghost back" onClick={() => navigate(-1)}>‹ Back</button>;
}

function GearNote({ missingEquipment }: { missingEquipment?: string[] }) {
  return (
    <p className="muted small">
      {missingEquipment?.length
        ? <>Leaving out {missingEquipment.map((m) => (GEAR.find(([k]) => k === m)?.[1] ?? m).toLowerCase()).join(', ')}. </>
        : <>Missing something, like a cable machine? </>}
      <Link to="/settings/gym">Set your gym's equipment in Settings</Link>.
    </p>
  );
}

const groupList = (gs: string[]) => {
  const names = gs.map((g) => GROUP_LABEL[g as keyof typeof GROUP_LABEL].toLowerCase());
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
};

function TodayGenerator() {
  const navigate = useNavigate();
  const { byId } = useExercises();
  const settings = useSettings();
  const { missingEquipment } = settings;
  const finished = useFinished();
  const [input, setInput] = useState<Omit<GeneratorInput, 'days'>>({ goal: 'muscle', experience: 'beginner', equipment: 'gym', minutes: 60 });
  useEffect(() => setInput((i) => ({
    ...i,
    equipment: generatorEquipment(missingEquipment),
    experience: settings.experience && settings.experience !== 'beginner' ? 'intermediate' : i.experience,
  })), [missingEquipment, settings.experience]);
  const [now] = useState(Date.now);
  const plan = useMemo(
    () => finished && generateToday(input, finished, byId, now, (exId) => byId.has(exId) && hasGear(byId.get(exId), missingEquipment)),
    [input, finished, byId, now, missingEquipment],
  );
  const set = <K extends keyof typeof input>(k: K) => (v: (typeof input)[K]) => setInput({ ...input, [k]: v });
  const [starting, setStarting] = useState(false);
  const start = async (day: Day) => {
    setStarting(true);
    await startWorkout({ day, generated: true }, byId);
    navigate('/workout', { replace: true });
  };
  const finisher = (id: string) => { const mv = MOVE_BY_ID.get(id); return !!mv && isFinisherMove(mv); };

  return (
    <>
      <OptionsFold summary={`${GOAL_TEXT[input.goal]} · ${minutesText(input.minutes)} · ${GEAR_TEXT[input.equipment]}`}>
        <Choice<Goal> label="Main goal" value={input.goal} onChange={set('goal')}
          options={[['muscle', 'Build muscle'], ['strength', 'Get stronger'], ['general', 'General fitness']]} />
        <Choice<number> label="How long have you got?" value={input.minutes} onChange={set('minutes')}
          options={SESSION_MINUTES.map((m) => [m, m < 120 ? `${m} min` : '2 hours'] as [number, string])} />
        <Choice<Experience> label="Experience" value={input.experience} onChange={set('experience')}
          options={[['beginner', 'New / under 1 year'], ['intermediate', '1+ years']]} />
        <Choice<Equipment> label="Equipment" value={input.equipment} onChange={set('equipment')}
          options={[['gym', 'Full gym'], ['dumbbells', 'Dumbbells'], ['bodyweight', 'Bodyweight']]} />
        <GearNote missingEquipment={missingEquipment} />
      </OptionsFold>

      {plan && (
        <section className="card">
          <p className="eyebrow">Today · about {estimateMinutes(plan.day)} min</p>
          <h2>{plan.kind}</h2>
          {finished!.length === 0 && <p className="small">No workouts logged yet, so this is a full-body start. It gets smarter with every workout you log.</p>}
          {plan.resting.length > 0 && <p className="small">💤 Resting your {groupList(plan.resting)}: trained hard in the last 2 days.</p>}
          {plan.behind.length > 0 && finished!.length > 0 && <p className="small">🎯 Catching up your {groupList(plan.behind)}, the furthest behind this week.</p>}
          {plan.restDay && <p className="notice">Almost everything was trained hard in the last 2 days. A rest day would probably do more for you than this session.</p>}
          <ul className="plain">
            {plan.day.exercises.map((e, i) => {
              const s = !finisher(e.exerciseId) && e.mode !== 'time' ? suggestionFor(e, finished!, byId, settings) : null;
              const arrow = s?.kind === 'increase' ? '⬆️ ' : s?.kind === 'deload' ? '⬇️ ' : '';
              return (
                <li key={e.exerciseId}>
                  {i > 0 && finisher(e.exerciseId) && !finisher(plan.day.exercises[i - 1].exerciseId) && <p className="small eyebrow">Core finisher</p>}
                  {exerciseName(byId, e.exerciseId)} <span className="muted">{e.sets} × {e.repMin}–{e.repMax}{e.mode === 'time' ? ' s' : ''}</span>
                  {s?.weight != null && <span> · {arrow}{fmtWeight(s.weight, settings.units)}</span>}
                  {mainTargets(e.exerciseId).length > 0 && <div className="muted small">{mainTargets(e.exerciseId).join(' · ')}</div>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {plan && <button className="wide" disabled={starting} onClick={() => start(plan.day)}>Start this workout</button>}
    </>
  );
}

function WeekGenerator() {
  const navigate = useNavigate();
  const { byId } = useExercises();
  const { missingEquipment } = useSettings();
  const [input, setInput] = useState<GeneratorInput>({ goal: 'muscle', days: 3, experience: 'beginner', equipment: 'gym', minutes: 60 });
  // Start from what the gym has once settings load.
  useEffect(() => setInput((i) => ({ ...i, equipment: generatorEquipment(missingEquipment) })), [missingEquipment]);
  const [id] = useState(uid);
  const program = useMemo(
    () => generateProgram(input, id, Date.now(), (exId) => hasGear(byId.get(exId), missingEquipment)),
    [input, id, byId, missingEquipment],
  );
  const coverage = useMemo(() => weekCoverage(program), [program]);
  // Muscles with real work (a few sets or more), biggest first. Lower back and traps only get spill-over
  // from big lifts, and abs are the daily core finisher, so they aren't counted against the 10–20 range.
  const sets = useMemo(() => [...weeklySets(program)].filter(([g, n]) => n >= 3 && g !== 'lowerBack' && g !== 'traps' && g !== 'core').sort((a, b) => b[1] - a[1]), [program]);
  const finisher = (id: string) => { const mv = MOVE_BY_ID.get(id); return !!mv && isFinisherMove(mv); };
  const shortDays = program.days.filter((d) => estimateMinutes(d) <= input.minutes - 15);
  const set = <K extends keyof GeneratorInput>(k: K) => (v: GeneratorInput[K]) => setInput({ ...input, [k]: v });

  const save = async () => {
    await db.programs.put({ ...program, createdAt: Date.now() });
    await updateSettings({ activeProgramId: program.id, nextDayIndex: 0 });
    navigate('/', { replace: true });
  };

  return (
    <>
      <OptionsFold summary={`${input.days} days · ${minutesText(input.minutes)} · ${GOAL_TEXT[input.goal]} · ${GEAR_TEXT[input.equipment]}`}>
        <Choice<Goal> label="Main goal" value={input.goal} onChange={set('goal')}
          options={[['muscle', 'Build muscle'], ['strength', 'Get stronger'], ['general', 'General fitness']]} />
        <Choice<number> label="Days per week" value={input.days} onChange={set('days')}
          options={[[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']]} />
        <Choice<number> label="How long is each session?" value={input.minutes} onChange={set('minutes')}
          options={SESSION_MINUTES.map((m) => [m, m < 120 ? `${m} min` : '2 hours'] as [number, string])} />
        <p className="muted small">Longer sessions get more exercises. Every workout ends with a core finisher: 2 ab exercises and 1 lower back exercise.</p>
        <Choice<Experience> label="Experience" value={input.experience} onChange={set('experience')}
          options={[['beginner', 'New / under 1 year'], ['intermediate', '1+ years']]} />
        <Choice<Equipment> label="Equipment" value={input.equipment} onChange={set('equipment')}
          options={[['gym', 'Full gym'], ['dumbbells', 'Dumbbells'], ['bodyweight', 'Bodyweight']]} />
        <GearNote missingEquipment={missingEquipment} />
      </OptionsFold>

      <section className="card">
        <p className="eyebrow">Your routine</p>
        <h2>{program.name}</h2>
        <p className="muted small">{program.description}</p>
        <details className="peek">
          <summary className="muted small">Why this routine</summary>
        <p className="small">
          Picked so each muscle gets hit from different angles over the week: covers {coverage.covered.length} muscle areas
          {coverage.missing.length
            ? <>, but not {coverage.missing.map((t) => TARGETS[t].label.toLowerCase()).join(', ')}. More days, more time or more equipment fills the gaps.</>
            : <>, with nothing important left out.</>}
        </p>
        <p className="small eyebrow">Hard sets per week (aim {WEEKLY_SETS.low}–{WEEKLY_SETS.high})</p>
        <div className="chips">
          {sets.map(([g, n]) => (
            <span key={g} className={`balance-tag ${n < WEEKLY_SETS.low ? 'low' : n > WEEKLY_SETS.high ? 'high' : 'good'}`}>{GROUP_LABEL[g]} {n}</span>
          ))}
        </div>
        {sets.some(([, n]) => n < WEEKLY_SETS.low) && (
          <p className="muted small">Yellow ones are under {WEEKLY_SETS.low} because there's only so much you can fit in {input.minutes} minutes. More time or another day per week brings them up.</p>
        )}
        {shortDays.length > 0 && (
          <p className="muted small">
            {shortDays.map((d) => d.name).join(', ')} {shortDays.length === 1 ? 'comes' : 'come'} in under {input.minutes} minutes: those muscles already
            get a full week of sets, and piling on more exercises past that doesn't build more muscle.
          </p>
        )}
        </details>
        {program.days.map((d) => {
          const item = (e: (typeof d.exercises)[number], i: number) => (
            <li key={i}>
              {exerciseName(byId, e.exerciseId)} <span className="muted">{e.sets} × {e.repMin}–{e.repMax}{e.mode === 'time' ? ' s' : ''}</span>
              {mainTargets(e.exerciseId).length > 0 && <div className="muted small">{mainTargets(e.exerciseId).join(' · ')}</div>}
            </li>
          );
          const core = d.exercises.filter((e) => finisher(e.exerciseId));
          return (
            <div key={d.id} className="preview-day">
              <strong>{d.name}</strong> <span className="muted small">about {estimateMinutes(d)} min</span>
              <ul className="plain">{d.exercises.filter((e) => !finisher(e.exerciseId)).map(item)}</ul>
              {core.length > 0 && <>
                <p className="small eyebrow">Core finisher</p>
                <ul className="plain">{core.map(item)}</ul>
              </>}
            </div>
          );
        })}
      </section>

      <button className="wide" onClick={save}>Save and start using it</button>
    </>
  );
}
