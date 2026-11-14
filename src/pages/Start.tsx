import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { exerciseName, useExercises } from '../exercises';
import { useActiveWorkout } from '../hooks';
import { startWorkout } from '../logic/session';
import { CalendarIcon, CameraIcon, ChevronLeft, PlusIcon, SparkIcon, XIcon } from '../components/Icons';
import type { Workout } from '../types';
import { toast } from '../components/UndoBar';

/** Every way to start a workout other than the split's next day, kept off Today so it stays simple. */
export function StartPage() {
  const navigate = useNavigate();
  const active = useActiveWorkout();
  const { byId } = useExercises();
  const saved = useLiveQuery(() => db.savedWorkouts.orderBy('name').toArray(), []);

  const start = async (copyOf?: Workout) => {
    await startWorkout(copyOf ? { copyOf } : {}, byId);
    navigate('/workout', { replace: true });
  };

  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate(-1)}><ChevronLeft />Back</button>
        <h1>Other ways to train</h1>
      </header>

      {active ? (
        <section className="card accent">
          <h2>Workout in progress</h2>
          <p className="muted small">Finish or discard {active.name} before starting another.</p>
          <Link className="button wide" to="/workout">Resume</Link>
        </section>
      ) : (
        <ul className="list">
          <li>
            <Link className="list-item" to="/programs/generate?mode=today">
              <span className="lead-ico" aria-hidden><SparkIcon /></span>
              <span><strong>Make today's workout for me</strong><small className="muted">Built from your history, sized to the time you have</small></span>
            </Link>
          </li>
          <li>
            <button className="list-item" onClick={() => start()}>
              <span className="lead-ico" aria-hidden><PlusIcon /></span>
              <span><strong>Empty workout</strong><small className="muted">Add exercises as you go</small></span>
            </button>
          </li>
          <li>
            <Link className="list-item" to="/import">
              <span className="lead-ico" aria-hidden><CameraIcon /></span>
              <span><strong>Copy a plan from a screenshot</strong><small className="muted">Turn a photo of a workout into one you can log</small></span>
            </Link>
          </li>
          <li>
            <Link className="list-item" to="/programs">
              <span className="lead-ico" aria-hidden><CalendarIcon /></span>
              <span><strong>Change my split</strong><small className="muted">Pick, build or edit a weekly routine</small></span>
            </Link>
          </li>
        </ul>
      )}

      {!active && saved && saved.length > 0 && (
        <section>
          <h2>Saved workouts</h2>
          <ul className="list">
            {saved.map((t) => (
              <li key={t.id} className="saved-row">
                <button className="list-item" onClick={() => start(t)} aria-label={`Start ${t.name}`}>
                  <span>
                    <strong>{t.name}</strong>
                    <small className="muted">{t.exercises.length} exercise{t.exercises.length === 1 ? '' : 's'} · {t.exercises.slice(0, 3).map((e) => exerciseName(byId, e.exerciseId)).join(', ')}{t.exercises.length > 3 ? '…' : ''}</small>
                  </span>
                </button>
                <button className="ghost danger" aria-label={`Delete ${t.name}`}
                  onClick={async () => { await db.savedWorkouts.delete(t.id); toast(`Deleted "${t.name}"`, () => db.savedWorkouts.put(t)); }}><XIcon /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
