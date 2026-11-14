import { useEffect, useSyncExternalStore } from 'react';

/** A short message at the bottom of the screen, with an Undo button when the action can be taken back. */
type Toast = { id: number; text: string; undo?: () => unknown };

let current: Toast | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Shows `text` for a few seconds. With `undo`, the bar has an Undo button that runs it once. */
export function toast(text: string, undo?: () => unknown) {
  current = { id: ++seq, text, undo };
  emit();
}

/** Runs a delete straight away and offers to take it back, instead of asking "Are you sure?" first. */
export async function undoable(text: string, run: () => unknown, undo: () => unknown) {
  await run();
  toast(text, undo);
}

const dismiss = (id: number) => {
  if (current?.id !== id) return;
  current = null;
  emit();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export function UndoBar() {
  const t = useSyncExternalStore(subscribe, () => current);
  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(() => dismiss(t.id), t.undo ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [t]);
  if (!t) return null;
  return (
    <div className="undo-bar" role="status" aria-live="polite">
      <span>{t.text}</span>
      {t.undo && (
        <button className="link" onClick={async () => { const fn = t.undo!; dismiss(t.id); await fn(); }}>Undo</button>
      )}
    </div>
  );
}
