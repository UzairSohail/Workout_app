/** Small dependency-free SVG charts. Colors come from currentColor / CSS. */
import { useState } from 'react';

export function LineChart({ points, label, format }: {
  points: { t: number; v: number }[];
  label: string;
  format: (v: number) => string;
}) {
  if (points.length < 2) return null;
  const W = 320, H = 120, P = 10;
  const vs = points.map((p) => p.v);
  const min = Math.min(...vs), max = Math.max(...vs);
  const span = max - min || 1;
  const t0 = points[0].t, tSpan = points[points.length - 1].t - t0 || 1;
  const xy = points.map((p) => [P + ((p.t - t0) / tSpan) * (W - 2 * P), H - P - ((p.v - min) / span) * (H - 2 * P)]);
  return (
    <figure className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <polyline points={xy.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="currentColor" />)}
      </svg>
      <figcaption className="muted small">{label}: {format(vs[0])} → {format(vs[vs.length - 1])}</figcaption>
    </figure>
  );
}

export function BarChart({ bars, label, format }: {
  bars: { key: string | number; label: string; value: number }[];
  label: string;
  format: (v: number) => string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <figure className="bars" aria-label={label}>
      <div className="bar-row">
        {bars.map((b) => (
          <div key={b.key} className="bar-col" title={`${b.label}: ${format(b.value)}`}>
            <span className="bar-value">{b.value ? format(b.value) : ''}</span>
            <span className="bar" style={{ height: `${(b.value / max) * 100}%` }} />
            <span className="bar-label">{b.label}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function HBars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul className="hbars">
      {rows.map(([name, v]) => (
        <li key={name}>
          <span className="hbar-name">{name}</span>
          <span className="hbar-track"><span className="hbar" style={{ width: `${(v / max) * 100}%` }} /></span>
          <span className="hbar-value">{v}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * One point per bucket (e.g. a week), with its value written above it and its label below.
 * The y axis fits the data instead of starting at zero, so small changes (like body weight) show.
 * Empty buckets (null) leave a gap in the line.
 */
export function LabelledLineChart({ points, label, format }: {
  points: { key: string | number; label: string; v: number | null }[];
  label: string;
  format: (v: number) => string;
}) {
  const vs = points.map((p) => p.v).filter((v): v is number => v != null);
  if (!vs.length) return null;
  const W = 320, H = 150, PX = 16, TOP = 22, BOTTOM = 22;
  let min = Math.min(...vs), max = Math.max(...vs);
  if (max - min < 1) { const mid = (max + min) / 2; min = mid - 0.5; max = mid + 0.5; }
  const n = points.length;
  const x = (i: number) => (n === 1 ? W / 2 : PX + (i / (n - 1)) * (W - 2 * PX));
  const y = (v: number) => TOP + (1 - (v - min) / (max - min)) * (H - TOP - BOTTOM);
  // Split into runs of consecutive non-empty points.
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];
  points.forEach((p, i) => {
    if (p.v == null) { if (run.length) runs.push(run); run = []; } else run.push([x(i), y(p.v)]);
  });
  if (run.length) runs.push(run);
  // Value labels on every point would overlap on a phone, so label every other one plus the last.
  const labelled = (i: number) => n <= 6 || i === n - 1 || (n - 1 - i) % 2 === 0;
  return (
    <figure className="trend labelled">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {runs.map((r, i) => r.length > 1 && (
          <polyline key={i} points={r.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        ))}
        {points.map((p, i) => p.v != null && (
          <g key={p.key}>
            <circle cx={x(i)} cy={y(p.v)} r={i === n - 1 ? 4.5 : 3.5} fill="currentColor" />
            {labelled(i) && <text x={x(i)} y={y(p.v) - 9} textAnchor="middle" className="pt-value">{format(p.v)}</text>}
          </g>
        ))}
        {points.map((p, i) => labelled(i) && (
          <text key={p.key} x={x(i)} y={H - 6} textAnchor="middle" className="pt-label">{p.label}</text>
        ))}
      </svg>
    </figure>
  );
}

/**
 * Body weight over a fixed time window. Points sit at their real dates (so a 1-week view spreads
 * its days out), dates run along the bottom, and tapping a point shows its date and value.
 */
export function TimeChart({ points, from, to, label, format, dateLabel, pointDate = dateLabel, valueLabel = format }: {
  points: { t: number; v: number }[];
  from: number;
  to: number;
  label: string;
  format: (v: number) => string;
  dateLabel: (t: number) => string;
  pointDate?: (t: number) => string;
  valueLabel?: (v: number) => string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  if (!points.length) return null;
  const sel = picked != null && picked < points.length ? picked : points.length - 1;
  const W = 320, H = 160, PX = 18, TOP = 24, BOTTOM = 24;
  const vs = points.map((p) => p.v);
  let min = Math.min(...vs), max = Math.max(...vs);
  if (max - min < 1) { const mid = (max + min) / 2; min = mid - 0.5; max = mid + 0.5; }
  const pad = (max - min) * 0.1;
  min -= pad; max += pad;
  const tSpan = to - from || 1;
  const x = (t: number) => PX + ((t - from) / tSpan) * (W - 2 * PX);
  const y = (v: number) => TOP + (1 - (v - min) / (max - min)) * (H - TOP - BOTTOM);
  const xy = points.map((p) => [x(p.t), y(p.v)] as const);
  // Label the tapped point, then any others with room to spare so the numbers never overlap.
  const labelled = new Set([sel]);
  const taken = [xy[sel][0]];
  xy.forEach(([cx], i) => {
    if (taken.every((tx) => Math.abs(tx - cx) >= 34)) { labelled.add(i); taken.push(cx); }
  });
  const ticks = [0, 1 / 3, 2 / 3, 1].map((f) => from + f * tSpan);
  const s = points[sel];
  return (
    <figure className="trend labelled">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PX} x2={W - PX} y1={TOP + f * (H - TOP - BOTTOM)} y2={TOP + f * (H - TOP - BOTTOM)} className="grid" />
        ))}
        {xy.length > 1 && <polyline points={xy.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />}
        <line x1={xy[sel][0]} x2={xy[sel][0]} y1={TOP - 6} y2={H - BOTTOM} className="grid sel" />
        {xy.map(([cx, cy], i) => (
          <g key={points[i].t} onClick={() => setPicked(i)} style={{ cursor: 'pointer' }}>
            <circle cx={cx} cy={cy} r="14" fill="transparent" />
            <circle cx={cx} cy={cy} r={i === sel ? 5 : 3.5} fill="currentColor" />
            {labelled.has(i) && (
              <text x={Math.min(W - 14, Math.max(14, cx))} y={cy - 10} textAnchor="middle" className={i === sel ? 'pt-value' : 'pt-value dim'}>{valueLabel(points[i].v)}</text>
            )}
          </g>
        ))}
        {ticks.map((t, i) => (
          <text key={i} x={x(t)} y={H - 6} textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'} className="pt-label">{dateLabel(t)}</text>
        ))}
      </svg>
      <figcaption className="small"><strong>{pointDate(s.t)}</strong> · {format(s.v)}<span className="muted"> · tap a dot to see its day</span></figcaption>
    </figure>
  );
}
