import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { joinSplit, useAccount } from '../sync';
import { ChevronLeft } from '../components/Icons';
import { toast } from '../components/UndoBar';

/** Follow a partner's split from the code they sent. */
export function JoinSplit() {
  const a = useAccount();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const join = async () => {
    setBusy(true);
    setErr('');
    try {
      const p = await joinSplit(code);
      toast(`You're now training with "${p.name}"`);
      navigate('/');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate('/programs')}><ChevronLeft />Splits</button>
        <h1>Join a partner's split</h1>
      </header>
      <section className="card form">
        {!a.available ? (
          <p className="muted small">Cloud sync isn't switched on for this app, so splits can't be shared.</p>
        ) : !a.signedIn ? (
          <p className="muted small">
            Sign in with your own account first. Your workouts and weights stay yours; only the exercises are shared.{' '}
            <Link to="/settings/account">Go to Account and sync</Link>
          </p>
        ) : (
          <form className="form" onSubmit={(e) => { e.preventDefault(); join(); }}>
            <p className="muted small">
              Type the code your partner sent. You'll get the same exercises, and any changes either of you make show on both phones.
              Your workouts, weights and progress stay your own.
            </p>
            <label>Code
              <input className="share-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD-2345"
                autoCapitalize="characters" autoComplete="off" spellCheck={false} required />
            </label>
            <button className="wide" type="submit" disabled={busy}>{busy ? 'One moment…' : 'Join split'}</button>
          </form>
        )}
        {err && <p className="error small">{err}</p>}
      </section>
    </>
  );
}
