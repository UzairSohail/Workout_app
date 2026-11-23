import { useEffect, useMemo, useState } from 'react';
import { EQUIPMENT, MUSCLES, cap, useExercises } from '../exercises';
import { useFinished, useSettings } from '../hooks';
import { hasGear } from '../logic/equipment';
import { freshAlternatives, sameAreaAlternatives } from '../logic/variety';
import { MOVES, mainTargets } from '../logic/targets';
import { ask, coachOn, parseSwap, SWAP_SCHEMA, swapPrompt, type SwapPick } from '../logic/coach';
import type { Exercise } from '../types';
import { CustomExerciseForm, nameFromQuery } from './CustomExerciseForm';
import { ExerciseImage } from './ExerciseImage';
import { SearchIcon, ShuffleIcon, SparkIcon, TargetIcon } from './Icons';
import { MuscleTags } from './MuscleTags';

const STRENGTH = new Set(['strength', 'powerlifting', 'olympic weightlifting', 'strongman', 'custom']);

/** Everyday shorthand, mapped to the words the library uses. Applied to queries and names alike. */
// Gym shorthand, expanded in both the query and the names, so "sl rdl" finds "Single-Leg Romanian Deadlift".
const SYNONYMS: Record<string, string> = {
  db: 'dumbbell', bb: 'barbell', kb: 'kettlebell', hex: 'trap', sl: 'single leg',
  rdl: 'romanian deadlift', sldl: 'stiff legged deadlift', cgbp: 'close grip bench press',
  rfess: 'bulgarian split squat', ghr: 'glute ham raise', ohp: 'overhead press',
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').map((w) => SYNONYMS[w] ?? w).join(' ');
/**
 * Words people add that names often leave out ("incline dumbbell bench press", "flat dumbbell press",
 * "standard grip"). When nothing matches with them, search again without them.
 */
const OPTIONAL = new Set(['bench', 'flat', 'standard', 'regular', 'normal', 'grip', 'overhand']);
// "presses" -> "press", "crunches" -> "crunch", "curls" -> "curl", so plurals still match.
const stem = (w: string) => {
  if (w.length < 4) return w;
  if (/(ss|sh|ch|x)es$/.test(w)) return w.slice(0, -2);
  return w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
};
// Words match from their start, so "row" finds "rows" but not "narrow". Longer queries also match
// with spaces ignored, so "pull down", "chinup" and "stair master" still find their exercises.
const hasWord = (text: string, w: string) => ` ${text}`.includes(` ${w}`);
const squash = (s: string) => s.replace(/ /g, '');
const matches = (text: string, words: string[], joined: string) =>
  words.every((w) => hasWord(text, w)) || (joined.length >= 4 && squash(text).includes(joined));
const queryWords = (q: string) => norm(q).split(' ').filter(Boolean).flatMap((w) => (SYNONYMS[w] ?? stem(w)).split(' '));

/**
 * Every query word must appear in the exercise's name, an everyday alias, or its equipment, so
 * "machine leg press" finds "Leg Press" (a machine) and "db curls" finds "Dumbbell Bicep Curl".
 * Best matches first: exact name, then names starting with the query, then the rest.
 */
export function filterExercises(all: Exercise[], q: string, muscle: string, equipment: string, strengthOnly: boolean, missing?: readonly string[]): Exercise[] {
  const found = filterWords(all, queryWords(q), muscle, equipment, strengthOnly, missing);
  if (found.length) return found;
  const core = queryWords(q).filter((w) => !OPTIONAL.has(w));
  return core.length ? filterWords(all, core, muscle, equipment, strengthOnly, missing) : found;
}

function filterWords(all: Exercise[], words: string[], muscle: string, equipment: string, strengthOnly: boolean, missing?: readonly string[]) {
  const phrase = words.join(' ');
  const joined = squash(phrase);
  const rank = (e: Exercise) => {
    const names = [e.name, ...(e.aliases ?? [])].map(norm);
    if (names.some((n) => n === phrase)) return 0;
    if (names.some((n) => n.startsWith(phrase))) return 1;
    if (names.some((n) => matches(n, words, joined))) return 2;
    return 3;
  };
  const list = all.filter((e) => {
    if (strengthOnly && !e.custom && !STRENGTH.has(e.category)) return false;
    if (muscle && !e.primaryMuscles.includes(muscle)) return false;
    if (equipment && e.equipment !== equipment) return false;
    if (!hasGear(e, missing)) return false;
    if (!words.length) return true;
    const gear = e.equipment === 'cable' ? 'cable machine' : norm(e.equipment);
    return [e.name, ...(e.aliases ?? [])].some((n) => {
      const text = `${norm(n)} ${gear}`;
      return matches(text, words, joined);
    });
  });
  if (!words.length) return list;
  const ranks = new Map(list.map((e) => [e, rank(e)]));
  return list.sort((a, b) => ranks.get(a)! - ranks.get(b)!);
}

const COMMON = new Set(['barbell', 'dumbbell', 'cable', 'machine']);
const equipmentRank = (e: Exercise) => (e.custom ? -1 : COMMON.has(e.equipment) ? 0 : e.equipment === 'body only' ? 1 : 2);

export function ExerciseFilters({ q, setQ, muscle, setMuscle, equipment, setEquipment }: {
  q: string; setQ: (v: string) => void;
  muscle: string; setMuscle: (v: string) => void;
  equipment: string; setEquipment: (v: string) => void;
}) {
  return (
    <div className="filters">
      <label className="search-field">
        <SearchIcon />
        <input type="search" aria-label="Search exercises" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="row">
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">All muscles</option>
          {MUSCLES.map((m) => <option key={m} value={m}>{cap(m)}</option>)}
        </select>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          <option value="">All equipment</option>
          {EQUIPMENT.map((m) => <option key={m} value={m}>{cap(m)}</option>)}
        </select>
      </div>
    </div>
  );
}

/** "Only equipment I have" switch; renders nothing until some equipment is marked missing in Settings. */
export function MyGearToggle({ missing, on, setOn }: { missing?: string[]; on: boolean; setOn: (v: boolean) => void }) {
  if (!missing?.length) return null;
  return (
    <label className="toggle">
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
      Only equipment my gym has
    </label>
  );
}

/** Gemini's swap picks, remembered for this visit so reopening the list doesn't ask again. */
const swapCache = new Map<string, SwapPick[]>();

export function ExercisePicker({ onPick, onClose, title = 'Add exercise', initialMuscle = '', excludeId, today = [], lastTime = '' }: {
  onPick: (e: Exercise) => void;
  onClose: () => void;
  title?: string;
  initialMuscle?: string;
  excludeId?: string;
  /** When swapping: names of the other exercises in today's workout, and the last sets of the one being swapped. */
  today?: string[];
  lastTime?: string;
}) {
  const { all, byId, loading } = useExercises();
  const finished = useFinished();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState(initialMuscle);
  const [equipment, setEquipment] = useState('');
  const { missingEquipment } = useSettings();
  const [mine, setMine] = useState(true);
  const [limit, setLimit] = useState(40);
  const [creating, setCreating] = useState(false);
  const results = useMemo(
    () => {
      const list = filterExercises(all, q, muscle, equipment, true, mine ? missingEquipment : undefined).filter((e) => e.id !== excludeId);
      // When swapping, show common gym equipment first.
      return excludeId ? [...list].sort((a, b) => equipmentRank(a) - equipmentRank(b)) : list;
    },
    [all, q, muscle, equipment, excludeId, mine, missingEquipment],
  );
  const swapping = excludeId ? byId.get(excludeId) : undefined;
  const fresh = useMemo(
    () => (swapping ? freshAlternatives(swapping, all, finished ?? [], missingEquipment) : []),
    [swapping, all, finished, missingEquipment],
  );
  const sameArea = useMemo(
    () => (swapping ? sameAreaAlternatives(swapping, byId, missingEquipment) : []),
    [swapping, byId, missingEquipment],
  );
  const different = fresh.filter((e) => !sameArea.includes(e));
  const ai = useCoachSwap(swapping, sameArea, fresh, all, byId, missingEquipment, today, lastTime);
  const pickRow = (e: Exercise) => (
    <li key={e.id}>
      <button className="list-item" onClick={() => onPick(e)}>
        <ExerciseImage exercise={e} />
        <span>
          <strong>{e.name}</strong>
          <small className="muted"><MuscleTags exercise={e} compact /> {e.equipment}</small>
        </span>
      </button>
    </li>
  );

  if (creating) {
    return (
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>New exercise</h2>
          <button className="ghost" onClick={() => setCreating(false)}>Back</button>
        </div>
        <div className="modal-body">
          <CustomExerciseForm initialName={nameFromQuery(q)} initialMuscle={muscle} onSaved={onPick} />
        </div>
      </div>
    );
  }

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="ghost" onClick={onClose}>Close</button>
      </div>
      <ExerciseFilters {...{ q, setQ, muscle, setMuscle, equipment, setEquipment }} />
      {initialMuscle && (
        <label className="toggle">
          <input type="checkbox" checked={muscle === initialMuscle} onChange={(e) => setMuscle(e.target.checked ? initialMuscle : '')} />
          Only {cap(initialMuscle)} exercises
        </label>
      )}
      <MyGearToggle missing={missingEquipment} on={mine} setOn={setMine} />
      <div className="modal-body">
        {loading && <p className="muted">Loading exercises…</p>}
        {swapping && ai.state !== 'off' && !q && (
          <>
            <h3 className="list-head"><SparkIcon />Coach's pick</h3>
            {ai.state === 'busy' && <p className="muted small">Asking the coach which swap fits best…</p>}
            {ai.state === 'error' && <p className="muted small">No coach pick right now: {ai.error}.</p>}
            {ai.picks.length > 0 && (
              <ul className="list">
                {ai.picks.map((p) => {
                  const e = byId.get(p.id)!;
                  return (
                    <li key={e.id}>
                      <button className="list-item" onClick={() => onPick(e)}>
                        <ExerciseImage exercise={e} />
                        <span>
                          <strong>{e.name}</strong>
                          <small className="muted">{p.why || e.equipment}</small>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
        {sameArea.length > 0 && !q && (
          <>
            <h3 className="list-head"><TargetIcon />Same area: {mainTargets(swapping!.id).join(' · ').toLowerCase()}</h3>
            <ul className="list">{sameArea.map(pickRow)}</ul>
          </>
        )}
        {different.length > 0 && !q && (
          <>
            <h3 className="list-head"><ShuffleIcon />Something different</h3>
            <ul className="list">{different.map(pickRow)}</ul>
            <h3 className="list-head">All matches</h3>
          </>
        )}
        <ul className="list">
          {results.slice(0, limit).map(pickRow)}
        </ul>
        {results.length > limit && (
          <button className="secondary wide" onClick={() => setLimit(limit + 40)}>Show more</button>
        )}
        {!loading && results.length === 0 && <p className="muted">No matches.</p>}
        {!loading && q.trim() && (
          <button className="secondary wide create-it" onClick={() => setCreating(true)}>
            Can't find it? Create “{nameFromQuery(q)}”
          </button>
        )}
      </div>
    </div>
  );
}

/** With a Gemini key, asks for the best 3 swaps from the app's own shortlist, each with a one-line reason. */
function useCoachSwap(
  swapping: Exercise | undefined, sameArea: Exercise[], fresh: Exercise[], all: Exercise[], byId: Map<string, Exercise>,
  missing: string[] | undefined, today: string[], lastTime: string,
) {
  const on = !!swapping && coachOn();
  const key = swapping ? `${swapping.id}|${today.join(',')}` : '';
  const [state, setState] = useState<{ state: 'off' | 'busy' | 'done' | 'error'; picks: SwapPick[]; error?: string }>(
    () => (on ? { state: swapCache.has(key) ? 'done' : 'busy', picks: swapCache.get(key) ?? [] } : { state: 'off', picks: [] }),
  );
  useEffect(() => {
    if (!on || !swapping || swapCache.has(key) || !all.length) return;
    let live = true;
    const muscle = swapping.primaryMuscles[0];
    const pool = new Map<string, Exercise>();
    for (const e of [...sameArea, ...fresh]) pool.set(e.id, e);
    for (const m of MOVES) {
      const e = byId.get(m.id);
      if (pool.size >= 16) break;
      if (e && e.id !== swapping.id && e.primaryMuscles[0] === muscle && hasGear(e, missing)) pool.set(e.id, e);
    }
    const candidates = [...pool.values()];
    if (!candidates.length) { setState({ state: 'off', picks: [] }); return; }
    setState({ state: 'busy', picks: [] });
    ask(swapPrompt(swapping, candidates, today, lastTime), SWAP_SCHEMA, (t) => parseSwap(t, candidates), 15000)
      .then((picks) => {
        swapCache.set(key, picks);
        if (live) setState(picks.length ? { state: 'done', picks } : { state: 'off', picks: [] });
      })
      .catch((e) => live && setState({ state: 'error', picks: [], error: (e as Error).message }));
    return () => { live = false; };
  }, [key, all.length > 0]);
  return state;
}
