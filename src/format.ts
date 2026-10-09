export const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtDateLong = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function fmtDuration(ms: number) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function fmtClock(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Seconds as "45s" or "1:30". */
export function fmtSecs(sec: number) {
  return sec < 60 ? `${sec}s` : fmtClock(sec);
}
