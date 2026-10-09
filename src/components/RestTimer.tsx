import { useEffect, useRef, useState } from 'react';
import { fmtClock } from '../format';

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
  if (seconds > 0) write({ endAt: Date.now() + seconds * 1000, total: seconds });
};
export const stopRest = () => write(null);

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {
    /* audio unavailable */
  }
}

export function RestTimer() {
  const [state, setState] = useState<TimerState | null>(read);
  const [now, setNow] = useState(Date.now());
  const fired = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => setState(read());
    window.addEventListener(KEY, sync);
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.removeEventListener(KEY, sync);
      clearInterval(t);
    };
  }, []);

  const remaining = state ? (state.endAt - now) / 1000 : 0;
  useEffect(() => {
    if (state && remaining <= 0 && fired.current !== state.endAt) {
      fired.current = state.endAt;
      navigator.vibrate?.([300, 150, 300]);
      beep();
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
