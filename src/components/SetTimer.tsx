import { useEffect, useRef, useState } from 'react';
import { fmtClock } from '../format';
import { useSettings } from '../hooks';
import { alertPrefs, beepNow, cancelBeep, scheduleBeep, unlockAudio, vibrate } from '../logic/restAlert';
import { stopRest } from './RestTimer';

/** Seconds of "get ready" before the clock starts, to get into position. */
export const LEAD_IN = 3;
const KEY = 'set-timer';

/** Kept in storage so the timer survives leaving the page or the phone locking. */
interface Running { id: string; startAt: number }

function read(id: string): number | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Running | null;
    return r?.id === id ? r.startAt : null;
  } catch {
    return null;
  }
}
function write(r: Running | null) {
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Countdown for a timed set (plank, wall sit, dead hang…). A short lead-in, then counts down to the
 * target, beeps and buzzes when it's reached, and keeps counting the extra seconds until Stop.
 * Hands the seconds held back on stop.
 */
export function SetTimer({ id, label, target, onStop }: { id: string; label: string; target: number; onStop: (sec: number) => void }) {
  const prefs = alertPrefs(useSettings());
  /** When the hold itself starts (after the lead-in), ms. */
  const [startAt, setStartAt] = useState<number | null>(() => read(id));
  const [now, setNow] = useState(Date.now());
  // Already past the target when coming back to the page: don't alert again.
  const alerted = useRef(startAt != null && Date.now() - startAt >= target * 1000);

  useEffect(() => {
    if (startAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [startAt]);

  const elapsed = startAt == null ? 0 : (now - startAt) / 1000;
  const held = Math.max(0, Math.floor(elapsed));
  const reached = startAt != null && elapsed >= target;

  useEffect(() => {
    if (!reached || alerted.current) return;
    alerted.current = true;
    if (prefs.vibrate) vibrate();
    // The beep was scheduled at start; this only covers the case where it couldn't be.
    if (prefs.sound && elapsed - target > 1.5) beepNow();
  }, [reached, elapsed, target, prefs.vibrate, prefs.sound]);

  const start = () => {
    unlockAudio();
    stopRest();
    const at = Date.now() + LEAD_IN * 1000;
    alerted.current = false;
    if (prefs.sound) scheduleBeep(at + target * 1000);
    write({ id, startAt: at });
    setStartAt(at);
    setNow(Date.now());
  };
  const reset = () => {
    cancelBeep();
    write(null);
    setStartAt(null);
  };

  if (startAt == null) {
    return (
      <button className="secondary wide set-timer" onClick={start}>
        ⏱ Start {label} · {fmtClock(target)}
      </button>
    );
  }

  if (elapsed < 0) {
    return (
      <div className="set-timer-box ready">
        <span className="set-timer-label">Get ready</span>
        <span className="set-timer-clock">{Math.ceil(-elapsed)}</span>
        <button className="ghost" onClick={reset}>Cancel</button>
      </div>
    );
  }

  const pct = Math.min(100, (elapsed / Math.max(1, target)) * 100);
  return (
    <div className={`set-timer-box running ${reached ? 'hit' : ''}`} style={{ ['--p' as string]: `${pct}%` }}>
      <span className="set-timer-label">{reached ? `Target hit! Held ${fmtClock(held)}` : `${label} · time left`}</span>
      <span className="set-timer-clock">{reached ? `+${fmtClock(held - target)}` : fmtClock(target - elapsed)}</span>
      <div className="row">
        <button className="grow" onClick={() => { const sec = Math.max(1, held); reset(); onStop(sec); }}>
          ■ Stop and log {fmtClock(held)}
        </button>
        <button className="ghost" onClick={reset}>Cancel</button>
      </div>
    </div>
  );
}
