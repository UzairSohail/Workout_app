/**
 * Optional second opinion from Google's Gemini when copying a plan screenshot. Gemini sees the
 * screenshot itself, so it can tell a rope pushdown from an overhead extension by the thumbnail,
 * and picks each exercise from a short list the app suggests. Free with a personal key from
 * Google AI Studio; the key is kept on this phone only (not synced, not in backups).
 */
import type { Exercise } from '../types';

const KEY = 'gemini-key';
/**
 * Free Gemini models to try in order, all on the same key (each has its own free allowance). When one is
 * busy, rate limited, retired or failing, the next one answers instead. The "latest" names follow Google's
 * newest free models, the numbered ones are backups in case those names ever stop working.
 */
export const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
/** How long a busy model is skipped before it is tried first again. */
const COOLDOWN_MS = 2 * 60 * 1000;
const busyUntil = new Map<string, number>();
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function geminiKey(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function setGeminiKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem(KEY, key.trim());
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode: the key just isn't remembered.
  }
}

export interface PickRequest {
  /** The name as read from the screenshot. */
  name: string;
  candidates: Exercise[];
}

async function toBase64(file: Blob): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function buildPrompt(rows: PickRequest[]): string {
  const list = rows.map((r, i) =>
    `${i + 1}. "${r.name}"\n${r.candidates.map((c) => `   - ${c.id}: ${c.name} (${c.equipment})`).join('\n')}`,
  ).join('\n');
  return [
    'These screenshots show a workout plan from a fitness app. Each exercise has a name and a small photo of someone doing it.',
    'For each numbered exercise below, look at its name and its photo, and pick the candidate that is the same exercise:',
    'same equipment (dumbbell, barbell, cable, machine, bodyweight), same attachment (rope, bar), same body position',
    '(standing, seated, lying, incline, decline) and same movement (for example a triceps pushdown is not an overhead extension).',
    'Prefer the plain standard version when the plan does not say otherwise. If no candidate is the same exercise, answer with an empty pick.',
    '',
    list,
  ].join('\n');
}

/**
 * Asks Gemini to choose an exercise for each row. Returns the chosen id per row (undefined where
 * Gemini found no fit or picked something not on the list). Throws with a readable message on failure.
 */
export async function pickWithGemini(key: string, images: Blob[], rows: PickRequest[]): Promise<(string | undefined)[]> {
  const parts: object[] = [{ text: buildPrompt(rows) }];
  for (const img of images) parts.push({ inline_data: { mime_type: img.type || 'image/jpeg', data: await toBase64(img) } });
  const schema = {
    type: 'OBJECT',
    properties: {
      picks: {
        type: 'ARRAY',
        items: { type: 'OBJECT', properties: { row: { type: 'INTEGER' }, pick: { type: 'STRING' } }, required: ['row', 'pick'] },
      },
    },
    required: ['picks'],
  };
  const text = await askGemini(key, parts, schema, { temperature: 0, timeoutMs: 60000 });
  return parsePicks(text, rows);
}

/** Errors where another model may well answer: busy, rate limited, model missing or retired, server trouble. */
export function worthTryingAnother(status: number): boolean {
  return status === 404 || status === 408 || status === 429 || status >= 500;
}

/** Models in the order to try now: ones that were busy a moment ago go last instead of first. */
export function modelOrder(now = Date.now()): string[] {
  const ready = MODELS.filter((m) => (busyUntil.get(m) ?? 0) <= now);
  const resting = MODELS.filter((m) => (busyUntil.get(m) ?? 0) > now);
  return [...ready, ...resting];
}

/** Test helper: forget which models were busy. */
export function resetBusyModels() {
  busyUntil.clear();
}

class GeminiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Sends one request to Gemini and returns its JSON answer as text. If the model is overloaded, rate limited
 * or failing, it tries the other free models on the same key before giving up. Throws a readable message on
 * failure (bad key, free limit used up everywhere, offline, too slow). The timeout covers all tries together.
 */
export async function askGemini(
  key: string,
  parts: object[],
  schema: object,
  opts: { temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const deadline = Date.now() + (opts.timeoutMs ?? 20000);
  const body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: opts.temperature ?? 0.4, responseMimeType: 'application/json', responseSchema: schema },
  });
  let last: GeminiError | undefined;
  const order = modelOrder();
  for (const [i, model] of order.entries()) {
    const left = deadline - Date.now();
    if (left < 1000) break;
    // A model that is slow under load gets most of the time, but leaves some for a backup.
    const slice = i < order.length - 1 ? Math.round(left * 0.6) : left;
    try {
      return await askModel(key, model, body, slice);
    } catch (e) {
      if (!(e instanceof GeminiError) || !worthTryingAnother(e.status)) throw e;
      busyUntil.set(model, Date.now() + COOLDOWN_MS);
      last = e;
    }
  }
  if (!last || last.status === 408) throw new Error('Gemini took too long, try again');
  if (last.status === 429) throw new Error('the free limit is used up for now, try again later');
  if (last.status === 404) throw new Error('Gemini models were not found for this key');
  throw new Error('Gemini is busy right now, try again in a minute');
}

async function askModel(key: string, model: string, body: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${URL_BASE}/${model}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new GeminiError('Gemini took too long, try again', 408);
    throw new Error('no connection to Gemini');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let msg = `error ${res.status}`;
    try {
      msg = ((await res.json()) as { error?: { message?: string } }).error?.message ?? msg;
    } catch {
      // keep the status
    }
    if (res.status === 400 && /api key/i.test(msg)) msg = 'the key was not accepted';
    if (res.status === 429) msg = 'the free limit is used up for now, try again later';
    throw new GeminiError(msg, res.status);
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
}

/** Reads Gemini's answer, keeping only picks that are on that row's candidate list. */
export function parsePicks(text: string, rows: PickRequest[]): (string | undefined)[] {
  const out: (string | undefined)[] = rows.map(() => undefined);
  let picks: { row?: number; pick?: string }[] = [];
  try {
    picks = (JSON.parse(text) as { picks?: typeof picks }).picks ?? [];
  } catch {
    return out;
  }
  for (const p of picks) {
    const i = (p.row ?? 0) - 1;
    if (i < 0 || i >= rows.length || !p.pick) continue;
    if (rows[i].candidates.some((c) => c.id === p.pick)) out[i] = p.pick;
  }
  return out;
}
