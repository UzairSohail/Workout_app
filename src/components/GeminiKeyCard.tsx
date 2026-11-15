import { useState } from 'react';
import { updateSettings } from '../db';
import { useSettings } from '../hooks';
import { geminiKey, setGeminiKey } from '../logic/gemini';

/** Settings for the AI coach: the optional free Gemini key, and which coach features are on. */
export function GeminiKeyCard() {
  const [saved, setSaved] = useState(geminiKey);
  const [draft, setDraft] = useState(saved);
  const s = useSettings();
  const save = (k: string) => {
    setGeminiKey(k);
    setSaved(k.trim());
    setDraft(k.trim());
  };
  return (
    <>
      <section className="card form">
        <h2>{saved ? 'AI coach is on' : 'Turn on the AI coach'}</h2>
        <p className="muted small">
          With a free key from Google's Gemini, the app adds a short coach note after each workout, fine-tunes your
          weights from how your last sessions felt, builds a workout from a sentence, explains swaps, and does a weekly
          check-in. It also double-checks plans copied from screenshots. If one Gemini model is busy, the same key tries
          Google's other free models. Without a key, everything works as before.
        </p>
        <ol className="muted small">
          <li>Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a> and sign in with a Google account.</li>
          <li>Tap “Create API key”, then copy it. It's free, no card needed.</li>
          <li>Paste it here and tap Save.</li>
        </ol>
        <label>Gemini API key
          <input type="password" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Paste your key" />
        </label>
        <div className="row">
          <button className="secondary" disabled={draft.trim() === saved} onClick={() => save(draft)}>Save</button>
          {saved && <button className="ghost danger" onClick={() => save('')}>Remove key</button>}
        </div>
        <p className="muted small">
          When a coach feature runs, the workout numbers it needs (and screenshots you import) go to Google. On the free
          plan Google may use them to improve its products. The key stays on this phone and isn't synced or backed up.
        </p>
      </section>
      {saved && (
        <section className="card form">
          <label className="toggle big">
            <input type="checkbox" checked={s.aiTune !== false} onChange={(e) => updateSettings({ aiTune: e.target.checked })} />
            <span>
              <strong>Coach tunes my weights</strong>
              <small className="muted">When a workout starts, Gemini adjusts the suggested weights using how your last sessions felt, missed reps, breaks and body weight. It stays within one step of the usual rule, and the rule is used whenever you're offline.</small>
            </span>
          </label>
        </section>
      )}
    </>
  );
}
