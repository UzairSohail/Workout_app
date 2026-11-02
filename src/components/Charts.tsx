/** Small dependency-free SVG charts. Colors come from currentColor / CSS. */

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
