import { filterExercises } from '../components/ExercisePicker';
import type { Exercise, LogMode } from '../types';

/** One exercise read off a workout plan screenshot (Fitbod and similar apps). Weights are ignored on purpose. */
export interface PlanRow {
  /** The name as read from the screenshot. */
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** 'time' when the plan gives seconds or minutes instead of reps; repMin/repMax are then seconds. */
  mode: LogMode;
  /** Done back to back with the next exercise (the plan grouped them as a superset). */
  supersetWithNext?: boolean;
}

export interface ParsedPlan {
  /** The workout's title when the screenshot shows one, e.g. "Upper Body". */
  title?: string;
  rows: PlanRow[];
}

// App chrome that shows up on plan screens and is never an exercise name.
const CHROME = /^(start|begin|resume|log|finish|edit|add|replace|swap|done|cancel|save|share|back|next|skip|today|workout|workouts|recovery|profile|explore|gym|settings|history|progress|exercises?|warm ?up|cool ?down|superset|circuit|options|more|sets?|reps?|weight|duration|muscle|target)\b/i;
// Header lines such as "6 exercises · 55 min" or "Total volume".
const SUMMARY = /\bexercises?\b|\bworkout\b|\btotal\b|\bvolume\b|\bcalories\b|\bkcal\b|\bmuscles?\b/i;

interface Detail {
  sets?: number;
  repMin?: number;
  repMax?: number;
  mode: LogMode;
}

/** Reads "3 sets • 10 reps • 135 lb", "3 × 8–12", "10 reps × 50 lb" or "3 sets · 45 sec". */
export function parseDetail(line: string): Detail | null {
  const l = line.toLowerCase().replace(/[–—]/g, '-');
  // Unit next to a number marks a weight; drop those so "10 x 135 lb" isn't read as 10 sets of 135.
  const noWeight = l.replace(/\d+(?:\.\d+)?\s*(?:lbs?|ibs?|1bs?|kgs?|kilos?)\b/g, ' ');
  const sets = /(\d{1,2})\s*sets?/.exec(noWeight);
  const reps = /(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*reps?/.exec(noWeight);
  const cross = /(\d{1,2})\s*[x×]\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?(?!\s*(?:sec|s\b|min))/.exec(noWeight);
  const time = /(\d{1,3})\s*(sec|secs|seconds|s\b|min|mins|minutes)/.exec(noWeight);
  const d: Detail = { mode: 'reps' };
  if (sets) d.sets = +sets[1];
  if (reps) {
    d.repMin = +reps[1];
    d.repMax = reps[2] ? +reps[2] : +reps[1];
  } else if (cross) {
    d.sets ??= +cross[1];
    d.repMin = +cross[2];
    d.repMax = cross[3] ? +cross[3] : +cross[2];
  } else if (time) {
    const secs = +time[1] * (time[2].startsWith('m') ? 60 : 1);
    d.mode = 'time';
    d.repMin = d.repMax = secs;
  }
  if (d.repMin == null && d.sets == null) return null;
  if (d.repMin != null && (d.repMin < 1 || d.repMax! < d.repMin)) return null;
  if (d.sets != null && (d.sets < 1 || d.sets > 20)) return null;
  return d;
}

// Plan apps write names in Title Case; small joining words stay lower case ("Squat to Press").
const NAME_WORD = /^(?:[A-Z][a-zA-Z']*(?:-[A-Za-z]+)*|\d+(?:\.\d+)?|\([A-Za-z -]+\)|to|and|with|on|of|the|in|over|or)$/;
const JOINER = /^(?:to|and|with|on|of|the|in|over|or|\d+(?:\.\d+)?)$/;

/**
 * Pulls the exercise name out of an OCR line, dropping the noise that thumbnails and menu dots leave
 * on either side ("hl 8 Machine Row i." -> "Machine Row"). Keeps the longest run of name-like words.
 */
export function cleanName(line: string): string | null {
  const tokens = line.replace(/[“”"’`]/g, "'").split(/\s+/).map((t) => t.replace(/^'+|'+$/g, '')).filter(Boolean);
  let best: string[] = [];
  let run: string[] = [];
  const close = () => {
    while (run.length && JOINER.test(run[0])) run.shift();
    while (run.length && JOINER.test(run[run.length - 1])) run.pop();
    if (run.join(' ').length > best.join(' ').length) best = run;
    run = [];
  };
  for (const t of tokens) {
    // Single capital letters are almost always icon fragments, except a hyphenated "T-Bar".
    if (NAME_WORD.test(t) && (t.length > 1 || /\d/.test(t))) run.push(t);
    else close();
  }
  close();
  const s = best.join(' ');
  if (s.replace(/[^A-Za-z]/g, '').length < 3 || !/[aeiouy]/i.test(s)) return null;
  return s;
}

/**
 * Turns the text read from one or more plan screenshots into exercises with set and rep targets.
 * A name is the line just above its "sets · reps" line; a long name that wrapped onto two lines is joined.
 * Detail lines with no set count straight after an exercise ("10 reps × 50 lb" per set) add a set each.
 */
export function parsePlan(text: string): ParsedPlan {
  const rows: PlanRow[] = [];
  let pending: string[] = [];
  let title: string | undefined;
  let titleCandidate: string | undefined;
  let titleFromHeader = false;
  let lastWasDetail = false;
  // Row index where the latest "Superset · 3 Rounds" group starts.
  let supersetFrom: number | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const detail = SUMMARY.test(line) ? null : parseDetail(line);
    if (detail) {
      const name = pending.length > 1 && pending[pending.length - 1].split(' ').length === 1
        ? pending.slice(-2).join(' ')
        : pending[pending.length - 1];
      pending = [];
      if (name) {
        if (!rows.length && !title) title = titleCandidate;
        rows.push({
          name,
          sets: detail.sets ?? 1,
          repMin: detail.repMin ?? 10,
          repMax: detail.repMax ?? detail.repMin ?? 10,
          mode: detail.mode,
        });
        // A superset in the plan pairs the next two exercises.
        if (supersetFrom != null && rows.length - 1 === supersetFrom + 1) {
          rows[supersetFrom].supersetWithNext = true;
          supersetFrom = null;
        }
      } else if (lastWasDetail && rows.length && detail.sets == null) {
        rows[rows.length - 1].sets++;
      }
      lastWasDetail = true;
      continue;
    }
    lastWasDetail = false;
    if (/\bsuper ?set\b/i.test(line)) supersetFrom = rows.length;
    const name = CHROME.test(line) || SUMMARY.test(line) ? null : cleanName(line);
    if (!name) {
      // A header like "6 exercises · 55 min" follows the title, so remember the name above it.
      if (SUMMARY.test(line) && pending.length && !titleFromHeader) {
        titleCandidate = pending[pending.length - 1];
        titleFromHeader = true;
      }
      // App labels end a name; stray thumbnail scraps ("| ele") between a name and its sets don't.
      if (CHROME.test(line) || SUMMARY.test(line)) pending = [];
      continue;
    }
    if (!rows.length) titleCandidate ??= name;
    pending.push(name);
  }
  return { title, rows: dedupe(rows) };
}

/** Overlapping screenshots repeat the exercise at the seam; keep one. */
function dedupe(rows: PlanRow[]): PlanRow[] {
  return rows.filter((r, i) => {
    const prev = rows[i - 1];
    return !prev || prev.name.toLowerCase() !== r.name.toLowerCase() || prev.sets !== r.sets || prev.repMin !== r.repMin;
  });
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
// Words that name how a machine is loaded. Plan apps say "Machine Fly" where this app may say
// "… (Plate-Loaded)" or "Machine …", so they count as the same thing when matching.
const MACHINE_WORDS = new Set(['machine', 'plate', 'loaded', 'pin', 'selectorized', 'lever', 'leverage', 'stack']);
const EQUIPMENT_WORDS = new Set([...MACHINE_WORDS, 'dumbbell', 'barbell', 'cable', 'kettlebell', 'band', 'smith', 'ez', 'bar', 'db', 'bb', 'kb']);
const GEAR_OF: Record<string, string> = { dumbbell: 'dumbbell', db: 'dumbbell', barbell: 'barbell', bb: 'barbell', cable: 'cable', kettlebell: 'kettlebells', kb: 'kettlebells' };
const COMMON_GEAR = new Set(['barbell', 'dumbbell', 'cable', 'machine', 'body only', 'e-z curl bar', 'kettlebells']);
const stemWord = (w: string) => {
  if (/^fl(y|ie|ye)s?$/.test(w)) return 'fly';
  return w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
};

/**
 * Finds the catalog exercise for a name read off a screenshot. In order:
 *  1. an exact name or alias,
 *  2. the app's own search (aliases, shorthand, plurals), picking the closest fit,
 *  3. for machines, the same search without the loading words, so "Machine Fly" finds a
 *     plate-loaded or pin-loaded fly and the other way round,
 *  4. fuzzy word overlap, so names worded differently or small OCR slips still land somewhere sensible.
 * `used` holds exercise ids from the user's history, preferred when several fit equally well.
 */
export function matchExercise(all: Exercise[], name: string, used?: ReadonlySet<string>): Exercise | undefined {
  // OCR can leave an icon fragment in front of the name ("Fl Seated Dumbbell Curl"), so also try without it.
  // Only short scraps are dropped, never a real word like "Machine" in "Machine Calf Raise".
  const tokens = name.split(' ');
  const scrap = (t: string) => t.length <= 3 && !EQUIPMENT_WORDS.has(t.toLowerCase()) && !/^(ab|abs|leg|arm|hip|row|fly|t-bar)$/i.test(t);
  const variants = [name];
  for (let n = 1; n <= 2 && tokens.length - n >= 2 && scrap(tokens[n - 1]); n++) variants.push(tokens.slice(n).join(' '));
  for (const v of variants) {
    const exact = all.find((e) => [e.name, ...(e.aliases ?? [])].some((n) => n.toLowerCase() === v.toLowerCase()));
    if (exact) return exact;
  }
  for (const v of variants) {
    const found = searchMatch(all, v, used);
    if (found) return found;
  }
  for (const v of variants) {
    const w = words(v);
    const core = w.filter((x) => !MACHINE_WORDS.has(x));
    if (core.length === w.length || !core.length) continue;
    const found = searchMatch(all.filter((e) => e.equipment === 'machine' || e.custom), core.join(' '), used, true);
    if (found) return found;
  }
  for (const v of variants) {
    const found = fuzzyMatch(all, v);
    if (found) return found;
  }
  return undefined;
}

function searchMatch(all: Exercise[], name: string, used?: ReadonlySet<string>, machine = false): Exercise | undefined {
  const found = filterExercises(all, name, '', '', false);
  if (!found.length) return undefined;
  const qw = words(name);
  const q = new Set(qw.map(stemWord));
  const wantsMachine = machine || qw.some((w) => MACHINE_WORDS.has(w));
  const wantsGear = qw.map((w) => GEAR_OF[w]).find(Boolean);
  // Fewest words the plan didn't mention (loading words don't count), so "Lat Pulldown" doesn't land on
  // a niche variation; gear the plan named wins; bands and odd gear only when nothing else fits;
  // exercises already in the history win ties.
  const extra = (e: Exercise) =>
    Math.min(...[e.name, ...(e.aliases ?? [])].map((n) => words(n).map(stemWord).filter((w) => !q.has(w) && !MACHINE_WORDS.has(w)).length)) +
    (wantsMachine && e.equipment !== 'machine' ? 1 : 0) +
    (wantsGear && e.equipment !== wantsGear ? 1 : 0) +
    (COMMON_GEAR.has(e.equipment) || e.custom ? 0 : 1) -
    (used?.has(e.id) ? 0.5 : 0);
  const top = found.slice(0, 30);
  return [...top].sort((a, b) => extra(a) - extra(b) || top.indexOf(a) - top.indexOf(b))[0];
}

/** Share of words in common, ignoring equipment and loading words for the "is it the same movement" test. */
function fuzzyMatch(all: Exercise[], name: string): Exercise | undefined {
  const q = words(name).map(stemWord);
  if (!q.length) return undefined;
  const wantsMachine = q.some((w) => MACHINE_WORDS.has(w));
  let best: Exercise | undefined;
  let bestScore = 0;
  for (const e of all) {
    for (const n of [e.name, ...(e.aliases ?? [])]) {
      const w = words(n).map(stemWord);
      const hits = q.filter((x) => w.some((y) => y === x || (x.length >= 4 && (y.startsWith(x) || x.startsWith(y)))));
      if (!hits.some((h) => !EQUIPMENT_WORDS.has(h))) continue;
      const qCore = q.filter((x) => !MACHINE_WORDS.has(x)).length;
      const wCore = w.filter((x) => !MACHINE_WORDS.has(x)).length;
      const coreHits = hits.filter((h) => !MACHINE_WORDS.has(h)).length;
      const score = coreHits / Math.max(qCore, wCore, 1) + (wantsMachine && e.equipment === 'machine' ? 0.1 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
  }
  return bestScore >= 0.5 ? best : undefined;
}
