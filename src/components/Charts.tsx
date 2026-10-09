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
