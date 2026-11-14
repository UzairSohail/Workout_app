import { useState } from 'react';
import { geminiKey, setGeminiKey } from '../logic/gemini';

/** Settings card for the optional free Gemini key that double-checks plan imports. */
export function GeminiKeyCard() {
  const [saved, setSaved] = useState(geminiKey);
  const [draft, setDraft] = useState(saved);
  const save = (k: string) => {
    setGeminiKey(k);
    setSaved(k.trim());
    setDraft(k.trim());
  };
  return (
    <section className="card form">
      <h2>Gemini key</h2>
      <p className="muted small">
        {saved ? 'On. ' : ''}When you copy a plan from a screenshot, the app also shows Google's Gemini the screenshot so it
        can check each exercise against its photo (for example a rope pushdown versus an overhead extension). The
        screenshot is sent to Google when you import; on the free plan Google may use it to improve its products. The key
        stays on this phone and isn't synced or backed up.
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
    </section>
  );
}
