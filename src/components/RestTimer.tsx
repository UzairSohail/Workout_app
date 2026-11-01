import { useEffect, useRef, useState } from 'react';
import { fmtClock } from '../format';
import { useSettings } from '../hooks';
import { alertPrefs, beepPlayed, cancelBeep, restOver, scheduleBeep, unlockAudio } from '../logic/restAlert';

/** An alert noticed later than this (e.g. coming back to the app) is skipped, the bar just says Go. */
const STALE_MS = 20_000;

const KEY = 'rest-timer';

interface TimerState { endAt: number; total: number }

function read(): TimerState | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}
function write(s: TimerState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(KEY));
}

export const startRest = (seconds: number) => {
  // Called from the tap that ticks a set off, which is when browsers let us unlock audio.
  unlockAudio();
  if (seconds > 0) write({ endAt: Date.now() + seconds * 1000, total: seconds });
};
export const stopRest = () => {
  cancelBeep();
  write(null);
};

export function RestTimer() {
  const [state, setState] = useState<TimerState | null>(read);
  const [now, setNow] = useState(Date.now());
  const fired = useRef<number | null>(null);
  const prefs = alertPrefs(useSettings());
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    const sync = () => setState(read());
    window.addEventListener(KEY, sync);
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.removeEventListener(KEY, sync);
      clearInterval(t);
    };
  }, []);

  // Schedule the beep ahead of time so it plays on the dot, even if the page is in the background.
  const endAt = state?.endAt;
  useEffect(() => {
    const plan = () => {
      if (endAt == null || !prefsRef.current.sound) return cancelBeep();
      if (endAt > Date.now()) scheduleBeep(endAt);
      else cancelBeep();
    };
    plan();
    // Audio time stops while iOS has the app paused, so plan again on return.
    const onShow = () => document.visibilityState === 'visible' && plan();
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [endAt, prefs.sound]);

  const remaining = state ? (state.endAt - now) / 1000 : 0;
  useEffect(() => {
    if (state && remaining <= 0 && fired.current !== state.endAt) {
      fired.current = state.endAt;
      if (Date.now() - state.endAt > STALE_MS) return cancelBeep();
      restOver(prefsRef.current, { hidden: document.visibilityState === 'hidden', beepScheduled: beepPlayed() });
    }
  }, [state, remaining]);

  if (!state || remaining < -5) return null;
  const adjust = (d: number) => write({ endAt: state.endAt + d * 1000, total: Math.max(1, state.total + d) });
  const pct = Math.max(0, Math.min(100, (remaining / state.total) * 100));

  return (
    <div className={`rest-bar ${remaining <= 0 ? 'done' : ''}`}>
      <div className="rest-progress" style={{ width: `${pct}%` }} />
      <span className="rest-label">{remaining > 0 ? `Rest ${fmtClock(remaining)}` : 'Go!'}</span>
      <button className="ghost" onClick={() => adjust(-15)}>−15</button>
      <button className="ghost" onClick={() => adjust(15)}>+15</button>
      <button className="ghost" onClick={stopRest}>Skip</button>
    </div>
  );
}
