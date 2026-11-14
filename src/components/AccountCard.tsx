import { useState } from 'react';
import { resetPassword, signIn, signOutNow, syncAgain, useAccount } from '../sync';
import { fmtDate } from '../format';

const ago = (t?: number) => {
  if (!t) return 'not yet';
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return fmtDate(t);
};

/** Sign in so workouts, settings and weigh-ins follow you to any phone. */
export function AccountCard() {
  const a = useAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  if (!a.available) {
    return (
      <section className="card form">
        <p className="muted small">Cloud sync isn't switched on for this app yet. Your data is on this phone only.</p>
      </section>
    );
  }

  const act = async (fn: () => Promise<void>, done = '') => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await fn();
      setMsg(done);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (a.signedIn) {
    return (
      <section className="card form">
        <p>Signed in as <strong>{a.email}</strong></p>
        <p className="muted small">
          {a.syncing || busy ? 'Syncing…' : a.pending ? `${a.pending} change${a.pending === 1 ? '' : 's'} waiting to upload. Last synced ${ago(a.lastSyncAt)}.` : `Everything is saved to your account. Last synced ${ago(a.lastSyncAt)}.`}
        </p>
        {a.error && <p className="error small">{a.error}</p>}
        <button className="secondary wide" disabled={busy || a.syncing} onClick={() => act(syncAgain)}>Sync now</button>
        <button className="ghost wide" disabled={busy} onClick={() => act(signOutNow)}>Sign out</button>
        <p className="muted small">Signing out keeps your data on this phone; it just stops syncing.</p>
      </section>
    );
  }

  return (
    <section className="card form">
      <p className="muted small">
        {create
          ? 'Make an account to keep your workouts, settings and weight history safe, and see them on any phone you sign in on. What\'s on this phone now is uploaded.'
          : 'Sign in to keep your workouts, settings and weight history on every phone. Anything already on this phone is added to your account.'}
      </p>
      <form className="form" onSubmit={(e) => { e.preventDefault(); act(() => signIn(email, password, create)); }}>
        <label>Email<input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete={create ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></label>
        <button className="wide" type="submit" disabled={busy}>{busy ? 'One moment…' : create ? 'Create account' : 'Sign in'}</button>
      </form>
      {err && <p className="error small">{err}</p>}
      {msg && <p className="small">{msg}</p>}
      <button className="link" onClick={() => { setCreate(!create); setErr(''); }}>{create ? 'I already have an account' : 'New here? Create an account'}</button>
      {!create && (
        <button className="link" disabled={busy} onClick={() => email ? act(() => resetPassword(email), 'Check your email for a link to reset your password.') : setErr('Enter your email first.')}>
          Forgot password?
        </button>
      )}
    </section>
  );
}
