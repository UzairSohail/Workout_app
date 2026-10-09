import { useEffect, useRef, useState } from 'react';
import { fmtClock } from '../format';

/** Stopwatch for a timed set. Buzzes at the target, hands the seconds back on stop. */
export function SetTimer({ label, target, onStop }: { label: string; target: number; onStop: (sec: number) => void }) {
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const buzzed = useRef(false);

  useEffect(() => {
    if (start == null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [start]);

  const sec = start == null ? 0 : Math.floor((now - start) / 1000);
  useEffect(() => {
    if (start != null && !buzzed.current && sec >= target) {
      buzzed.current = true;
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [sec, start, target]);

  if (start == null) {
    return (
      <button className="secondary wide set-timer" onClick={() => { buzzed.current = false; setStart(Date.now()); setNow(Date.now()); }}>
        ▶ Start timer · {label}
      </button>
    );
  }
  return (
    <button className={`wide set-timer running ${sec >= target ? 'hit' : ''}`} onClick={() => { setStart(null); onStop(Math.max(1, sec)); }}>
      ■ Stop · {fmtClock(sec)} <small>/ {fmtClock(target)}</small>
    </button>
  );
}
