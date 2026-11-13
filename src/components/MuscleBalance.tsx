import type { Balance, BalanceStatus } from '../logic/balance';
import { HIGH, LOW } from '../logic/balance';

const LABEL: Record<BalanceStatus, string> = { skipped: 'Skipped', low: 'Light', good: 'On target', high: 'A lot' };

/** Every main muscle group with its working sets, including the ones you skipped. */
export function MuscleBalance({ balance }: { balance: Balance }) {
  const max = Math.max(HIGH, ...balance.groups.map((g) => g.sets));
  return (
    <>
      {balance.skipped.length > 0 && (
        <p className="notice small">Not trained yet: {balance.skipped.join(', ')}.</p>
      )}
      {balance.tip && <p className="notice small">{balance.tip}</p>}
      <ul className="hbars balance">
        {balance.groups.map((g) => (
          <li key={g.name} className={g.status}>
            <span className="hbar-name">{g.name}</span>
            <span className="hbar-track">
              <span className="hbar" style={{ width: `${(g.sets / max) * 100}%` }} />
              <span className="target-zone" style={{ left: `${(LOW / max) * 100}%`, width: `${((HIGH - LOW) / max) * 100}%` }} />
            </span>
            <span className="hbar-value">{g.sets}</span>
            <span className={`balance-tag ${g.status}`}>{LABEL[g.status]}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">Shaded band: {LOW}–{HIGH} working sets a week, a good range for growth. Sets count half for muscles an exercise only helps with.</p>
    </>
  );
}
