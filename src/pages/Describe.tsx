import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { useExercises } from '../exercises';
import { useFinished, useSettings } from '../hooks';
import { ask, coachOn, parsePlan, PLAN_SCHEMA, planCandidates, planPrompt, weightTrend, type PlanAnswer } from '../logic/coach';
import { muscleBalance } from '../logic/balance';
import { estimateMinutes } from '../logic/generator';
import { startWorkout } from '../logic/session';
import { fmtReps } from '../format';
import { ExerciseImage } from '../components/ExerciseImage';
import { ChevronLeft, SparkIcon } from '../components/Icons';

const EXAMPLES = ['45 min, sore shoulders, no barbell', 'Quick 30 min arms and abs', 'Legs, gym is packed, dumbbells only'];
const HOUR = 3600e3;

/** Type what you want today in your own words; Gemini builds a workout from the exercises the app knows. */
export function DescribePage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const finished = useFinished();
  const { byId } = useExercises();
  const initial = (useLocation().state as { text?: string } | null)?.text ?? '';
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<PlanAnswer | null>(null);
  const on = coachOn();

  const build = async () => {
    if (!text.trim() || !finished) return;
    setBusy(true);
    setError('');
    setPlan(null);
    try {
      const now = Date.now();
      const candidates = planCandidates(byId, finished, settings.missingEquipment, now);
      const fmtGroups = (since: number) => muscleBalance(finished, byId, since).groups.filter((g) => g.sets > 0).map((g) => `${g.name} ${g.sets}`).join(', ') || 'nothing';
      const known = [...new Set(finished.slice(0, 15).flatMap((w) => w.exercises.map((e) => byId.get(e.exerciseId)?.name)).filter(Boolean))];
      const context = [
        `Working sets in the last 48 hours: ${fmtGroups(now - 48 * HOUR)}.`,
        `Working sets in the last 7 days (10–20 per muscle is the usual target): ${fmtGroups(now - 168 * HOUR)}.`,
        known.length ? `Lifts they do often (prefer these when they fit): ${known.slice(0, 20).join(', ')}.` : 'No workouts logged yet.',
        settings.experience ? `Experience: ${settings.experience}.` : '',
        settings.sessionMinutes ? `If no time is given, aim for about ${settings.sessionMinutes} minutes.` : 'If no time is given, aim for about 60 minutes.',
        weightTrend(await db.bodyWeight.toArray(), settings.units, now),
      ];
      const answer = await ask(planPrompt(text, candidates, context), PLAN_SCHEMA, (t) => parsePlan(t, candidates), 30000);
      if (!answer) throw new Error('Gemini didn\'t send a usable workout');
      setPlan(answer);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!plan) return;
    setBusy(true);
    const day = { id: 'described', name: plan.name, exercises: plan.exercises.map(({ why: _why, ...p }) => p) };
    await startWorkout({ day, generated: true, notes: new Map(plan.exercises.map((e) => [e.exerciseId, e.why])) }, byId);
    navigate('/workout', { replace: true });
  };

  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate(-1)}><ChevronLeft />Back</button>
        <h1>Describe your workout</h1>
      </header>

      {!on && (
        <section className="card accent">
          <p style={{ marginTop: 0 }}>This uses the free AI coach. Add a Gemini key first; it takes about a minute.</p>
          <Link className="button wide" to="/settings/ai">Set up the AI coach</Link>
        </section>
      )}

      {on && !plan && (
        <section className="card form">
          <label>What do you want to do today?
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLES[0]} maxLength={400} />
          </label>
          <div className="chips" style={{ marginTop: 0 }}>
            {EXAMPLES.map((x) => <button key={x} className="chip" onClick={() => setText(x)}>{x}</button>)}
          </div>
          {error && <p className="notice">Couldn't build it: {error}.</p>}
          <button className="wide" disabled={!text.trim() || busy || !finished || !byId.size} onClick={build}>
            <SparkIcon />{busy ? 'Building your workout…' : 'Build my workout'}
          </button>
          <p className="muted small" style={{ margin: 0 }}>Uses exercises your gym has and what you trained this week. Weights come from your own history.</p>
        </section>
      )}

      {plan && (
        <>
          <section className="card">
            <p className="eyebrow">“{text.trim()}” · about {estimateMinutes({ exercises: plan.exercises })} min</p>
            <h2>{plan.name}</h2>
            <ul className="list plain">
              {plan.exercises.map((e) => (
                <li key={e.exerciseId} className="list-item" style={{ cursor: 'default' }}>
                  <ExerciseImage exercise={byId.get(e.exerciseId)} />
                  <span>
                    <strong>{byId.get(e.exerciseId)?.name ?? e.exerciseId}</strong>
                    <small className="muted">{e.sets} × {fmtReps(e.repMin, e.repMax)}{e.why ? ` · ${e.why}` : ''}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <button className="wide" disabled={busy} onClick={start}>Start workout</button>
          <button className="ghost wide" disabled={busy} onClick={() => setPlan(null)}>Change my request</button>
        </>
      )}
    </>
  );
}
