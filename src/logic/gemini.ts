/**
 * Optional second opinion from Google's Gemini when copying a plan screenshot. Gemini sees the
 * screenshot itself, so it can tell a rope pushdown from an overhead extension by the thumbnail,
 * and picks each exercise from a short list the app suggests. Free with a personal key from
 * Google AI Studio; the key is kept on this phone only (not synced, not in backups).
 */
import type { Exercise } from '../types';

const KEY = 'gemini-key';
const MODEL = 'gemini-flash-latest';
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
  const res = await fetch(`${URL_BASE}/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            picks: {
              type: 'ARRAY',
              items: { type: 'OBJECT', properties: { row: { type: 'INTEGER' }, pick: { type: 'STRING' } }, required: ['row', 'pick'] },
            },
          },
          required: ['picks'],
        },
      },
    }),
  });
  if (!res.ok) {
    let msg = `error ${res.status}`;
    try {
      msg = ((await res.json()) as { error?: { message?: string } }).error?.message ?? msg;
    } catch {
      // keep the status
    }
    if (res.status === 400 && /api key/i.test(msg)) msg = 'the key was not accepted';
    if (res.status === 429) msg = 'the free limit is used up for now, try again later';
    throw new Error(msg);
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return parsePicks(text, rows);
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
