import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getProgramState } from '../db';
import { exerciseName, useExercises } from '../exercises';
import { useFinished, useSettings } from '../hooks';
import { emptyLift, GZCL_STAGES, liftKey, plateStep, SCHEME_LABEL, WEEKS_531 } from '../logic/schemes';
import { lastTopWeight } from '../logic/session';
import { recordsFor } from '../logic/stats';
import { fmt, fromDisplay, roundTo, toDisplay } from '../logic/units';
import type { Program, SchemeKind } from '../types';
import { NumInput } from './NumInput';

/** Lifts in a program that follow a scheme, one entry per scheme + exercise. */
export function schemeLifts(program: Program) {
  const seen = new Map<string, { key: string; scheme: SchemeKind; exerciseId: string }>();
  for (const d of program.days) {
    for (const e of d.exercises) {
      if (!e.scheme) continue;
      const key = liftKey(e.scheme, e.exerciseId);
      if (!seen.has(key)) seen.set(key, { key, scheme: e.scheme, exerciseId: e.exerciseId });
    }
  }
  return [...seen.values()];
}

/** Training maxes / starting weights for a program's scheme lifts, plus the 5/3/1 week. */
export function StartingWeights({ program }: { program: Program }) {
  const { byId } = useExercises();
  const finished = useFinished();
  const { units } = useSettings();
  const state = useLiveQuery(() => getProgramState(program.id), [program.id]);
  const lifts = useMemo(() => schemeLifts(program), [program]);
  const [draft, setDraft] = useState<Record<string, number | null>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!state) return;
    setDraft(Object.fromEntries(lifts.map((l) => {
      const w = state.lifts[l.key]?.weight;
      return [l.key, w == null ? null : toDisplay(w, units)];
    })));
  }, [state, lifts, units]);

  if (!state || lifts.length === 0) return null;
  const has531 = lifts.some((l) => l.scheme === '531');

  const guess = (l: (typeof lifts)[number]): number | null => {
    if (!finished) return null;
    if (l.scheme === '531') {
      const best = recordsFor(l.exerciseId, finished).bestE1rm;
      return best > 0 ? roundTo(toDisplay(best * 0.9, units), plateStep(units)) : null;
    }
    const last = lastTopWeight(l.exerciseId, finished);
    return last == null ? null : toDisplay(last, units);
  };

  const save = async () => {
    const next = { ...state, lifts: { ...state.lifts } };
    for (const l of lifts) {
      const v = draft[l.key];
      next.lifts[l.key] = { ...(state.lifts[l.key] ?? emptyLift()), weight: v == null ? null : fromDisplay(v, units) };
    }
    await db.programState.put(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="card form">
      <h2>{has531 ? 'Training maxes' : 'Starting weights'}</h2>
      <p className="muted small">
        {has531
          ? 'Use about 90% of your one-rep max. Not sure? Use a weight you can lift about 3–5 times with good form. It goes up automatically after each 4-week cycle.'
          : 'Start lighter than you think. The program adds weight for you. Leave one blank to use your last logged weight, or enter it in your first workout.'}
      </p>
      {lifts.map((l) => {
        const g = guess(l);
        const lift = state.lifts[l.key];
        const stages = l.scheme in GZCL_STAGES ? GZCL_STAGES[l.scheme as keyof typeof GZCL_STAGES] : null;
        const stage = stages && lift ? stages[Math.min(lift.stage, stages.length - 1)] : null;
        return (
          <div key={l.key} className="lift-row">
            <span className="grow">
              <strong>{exerciseName(byId, l.exerciseId)}</strong>
              <small className="muted">
                {SCHEME_LABEL[l.scheme]}
                {stage && lift!.stage > 0 && ` · now ${stage[0]}×${stage[1]}`}
                {g != null && draft[l.key] == null && (
                  <> · <button className="link" onClick={() => setDraft({ ...draft, [l.key]: g })}>use {fmt(g)} {units}</button></>
                )}
              </small>
            </span>
            <NumInput decimal className="weight" ariaLabel={`${exerciseName(byId, l.exerciseId)} weight`} value={draft[l.key] ?? null}
              placeholder={units} onChange={(v) => setDraft({ ...draft, [l.key]: v })} />
          </div>
        );
      })}
      {has531 && (
        <div>
          <span className="label">Current week</span>
          <div className="segmented">
            {WEEKS_531.map((wk, i) => (
              <button key={i} className={state.week === i ? 'on' : ''} title={wk.name}
                onClick={() => db.programState.put({ ...state, week: i, doneDays: [] })}>{i + 1}</button>
            ))}
          </div>
        </div>
      )}
      <button className="wide" onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
    </section>
  );
}
