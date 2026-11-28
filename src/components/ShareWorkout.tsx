import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { shareWorkoutNow, useAccount } from '../sync';
import { showCode } from '../sync/share';
import type { Workout } from '../types';

/** Shares this workout's exercises with a partner: they get it in Saved workouts and log their own weights. */
export function ShareWorkout({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const a = useAccount();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!a.signedIn) return;
    shareWorkoutNow(workout.id).then(setCode, (e) => setErr((e as Error).message));
    // Share once when opened; later edits are sent by sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.signedIn]);

  const send = async () => {
    const text = `Do "${workout.name}" with me in the Workout app: Today > More ways > Get your partner's workout, code ${showCode(code)}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(showCode(code));
      setCopied(true);
    } catch {
      /* the code is on screen */
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-head">
        <h2>Share this workout</h2>
        <button className="ghost" onClick={onClose}>Close</button>
      </div>
      <div className="modal-body form">
        {!a.signedIn ? (
          <p className="muted small">
            Sign in first so your partner can get it. <Link to="/settings/account">Go to Account and sync</Link>
          </p>
        ) : code ? (
          <>
            <p className="share-code" aria-label="Share code">{showCode(code)}</p>
            <p className="muted small">
              Your partner taps More ways on Today, then Get your partner's workout, and types this code. "{workout.name}" goes into their saved workouts
              with the same exercises, sets and rep ranges. They log their own weights and keep their own history.
            </p>
            <p className="muted small">
              If you add, remove or reorder exercises before they start it, their copy updates too.
            </p>
            <button className="wide" onClick={send}>{copied ? 'Code copied' : 'Send code'}</button>
          </>
        ) : err ? null : (
          <p className="muted">Getting a code…</p>
        )}
        {err && <p className="error small">{err}</p>}
      </div>
    </div>
  );
}
