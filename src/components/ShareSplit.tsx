import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db, getProgramState, getSettings, uid, updateSettings } from '../db';
import { nextDayIndex } from '../logic/generator';
import { shareSplit, unshareSplit, useAccount } from '../sync';
import { showCode } from '../sync/share';
import type { Program } from '../types';

/** Share a split with a partner: same exercises on both phones, each person's logs and weights stay their own. */
export function ShareSplit({ program, startOpen = false }: { program: Program; startOpen?: boolean }) {
  const a = useAccount();
  const navigate = useNavigate();
  const [open, setOpen] = useState(startOpen);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const code = program.shareCode;
  const box = useRef<HTMLElement>(null);
  // Opened from a "Share" link: bring the panel into view, since it sits below the split's days.
  useEffect(() => {
    if (startOpen) box.current?.scrollIntoView({ block: 'center' });
  }, [startOpen]);

  if (!a.available) return null;
  if (!open) {
    return (
      <button className="secondary wide" onClick={() => setOpen(true)}>
        {code ? 'Shared with partner' : 'Share with partner'}
      </button>
    );
  }

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = `Join my workout split "${program.name}" in the Workout app: Splits > Join a partner's split, code ${showCode(code!)}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      return; // closed the share sheet
    }
    try {
      await navigator.clipboard.writeText(showCode(code!));
      setCopied(true);
    } catch {
      /* the code is on screen anyway */
    }
  };

  return (
    <section className="card form" ref={box}>
      <h2>Share with partner</h2>
      {!a.signedIn ? (
        <p className="muted small">
          Sign in first so your partner's phone can get your changes.{' '}
          <Link to="/settings/account">Go to Account and sync</Link>
        </p>
      ) : code ? (
        <>
          <p className="share-code" aria-label="Share code">{showCode(code)}</p>
          <p className="muted small">
            Your partner signs in with their own account, then opens Splits, taps Join a partner's split and types this code.
            You both see the same exercises, and changes either of you make show on both phones. Workouts, weights and progress stay separate.
          </p>
          <button className="wide" onClick={send}>{copied ? 'Code copied' : 'Send code'}</button>
          <button className="ghost danger wide" disabled={busy} onClick={() => act(() => unshareSplit(program.id))}>
            Stop sharing
          </button>
          <p className="muted small">Stopping keeps a copy of the split on both phones; it just stops updating.</p>
        </>
      ) : program.builtIn ? (
        <>
          <p className="muted small">
            Built-in splits can't be changed, so sharing makes it your own split first, with the same exercises and your place in it kept.
            You'll both train with the same exercises and keep your own workouts, weights and progress.
          </p>
          <button className="wide" disabled={busy} onClick={() => act(async () => {
            const id = await ownCopy(program);
            await shareSplit(id);
            navigate(`/programs/${id}?share=1`, { replace: true });
          })}>
            {busy ? 'One moment…' : 'Get share code'}
          </button>
        </>
      ) : (
        <>
          <p className="muted small">
            Get a code for your partner. You'll both train with the same exercises and keep your own workouts, weights and progress.
          </p>
          <button className="wide" disabled={busy} onClick={() => act(() => shareSplit(program.id))}>
            {busy ? 'One moment…' : 'Get share code'}
          </button>
        </>
      )}
      {err && <p className="error small">{err}</p>}
    </section>
  );
}

/**
 * Turns a built-in split into the person's own, keeping day ids, starting weights and their place in it,
 * and makes it active if the built-in one was. Returns the new split's id.
 */
async function ownCopy(p: Program): Promise<string> {
  const settings = await getSettings();
  const finished = (await db.workouts.toArray()).filter((w) => w.finishedAt);
  const id = uid();
  await db.programs.put({ ...structuredClone(p), id, name: `Our ${p.name}`, builtIn: false, shareCode: undefined, createdAt: Date.now() });
  const state = await getProgramState(p.id);
  await db.programState.put({ ...structuredClone(state), programId: id });
  if (settings.activeProgramId === p.id) {
    await updateSettings({ activeProgramId: id, nextDayIndex: nextDayIndex(p, finished, settings.nextDayIndex) });
  }
  return id;
}
