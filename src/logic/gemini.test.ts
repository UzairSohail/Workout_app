import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withExtras } from '../exercises';
import type { Exercise } from '../types';
import { askGemini, buildPrompt, MODELS, modelOrder, parsePicks, resetBusyModels, worthTryingAnother } from './gemini';
import { candidatesFor } from './planImport';

const all = withExtras(JSON.parse(readFileSync(new URL('../../public/exercises.json', import.meta.url), 'utf8')) as Exercise[]);
const names = (name: string) => candidatesFor(all, name).map((e) => e.name);

describe('Gemini double-check', () => {
  it('offers the likely variants of a plan name, the app pick first', () => {
    const rope = names('Cable Rope Tricep Extension');
    expect(rope[0]).toBe('Triceps Pushdown - Rope Attachment');
    expect(rope).toContain('Cable Rope Overhead Triceps Extension');
    expect(names('Low Cable Chest Fly')).toEqual(expect.arrayContaining(['Low-to-High Cable Fly', 'High-to-Low Cable Fly']));
    expect(names('Dip')).toEqual(expect.arrayContaining(['Dips - Triceps Version', 'Dips - Chest Version']));
    expect(names('Push Up').length).toBeLessThanOrEqual(15);
  });

  it('lists every row with its candidates in the prompt', () => {
    const rows = [{ name: 'Dip', candidates: candidatesFor(all, 'Dip') }];
    const p = buildPrompt(rows);
    expect(p).toContain('1. "Dip"');
    expect(p).toContain('Dips_-_Triceps_Version: Dips - Triceps Version (body only)');
  });

  it('offers versions with the equipment the plan names first', () => {
    const list = candidatesFor(all, 'Dumbbell Bench Press');
    const gear = list.map((e) => e.equipment === 'dumbbell');
    expect(gear.slice(0, 3)).toEqual([true, true, true]);
    // Once another kind of equipment shows up, no dumbbell version comes after it.
    expect(gear.slice(gear.indexOf(false) >>> 0)).not.toContain(true);
    const curl = candidatesFor(all, 'Barbell Curl');
    expect(curl[0].equipment).toBe('barbell');
    expect(buildPrompt([{ name: 'Dumbbell Bench Press', candidates: list }])).toMatch(/equipment is binding/);
  });

  it('keeps only picks from the offered list', () => {
    const rows = [
      { name: 'Dip', candidates: candidatesFor(all, 'Dip') },
      { name: 'Push Up', candidates: candidatesFor(all, 'Push Up') },
      { name: 'Hanging Leg Raise', candidates: candidatesFor(all, 'Hanging Leg Raise') },
    ];
    const text = JSON.stringify({ picks: [
      { row: 1, equipment: 'bodyweight', pick: 'Dips_-_Chest_Version' },
      { row: 2, equipment: 'other', pick: 'Not_A_Real_Id' },
      { row: 3, pick: '' },
      { row: 9, pick: 'Pushups' },
    ] });
    expect(parsePicks(text, rows)).toEqual([{ id: 'Dips_-_Chest_Version', gear: 'body only' }, {}, {}]);
    expect(parsePicks('not json', rows)).toEqual([{}, {}, {}]);
  });
});

describe('Gemini backup models', () => {
  const ok = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
  const fail = (status: number) => new Response(JSON.stringify({ error: { message: `status ${status}` } }), { status });
  const called: string[] = [];
  const mockFetch = (answers: Response[]) => {
    called.length = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      called.push(url.split('/models/')[1].split(':')[0]);
      return answers.shift() ?? fail(503);
    });
  };
  beforeEach(() => resetBusyModels());
  afterEach(() => vi.unstubAllGlobals());

  it('moves on to the next free model when one is overloaded or rate limited', async () => {
    mockFetch([fail(503), fail(429), ok('{"a":1}')]);
    expect(await askGemini('k', [], {})).toBe('{"a":1}');
    expect(called).toEqual(MODELS.slice(0, 3));
  });

  it('tries a model that was just busy last next time', async () => {
    mockFetch([fail(503), ok('{}')]);
    await askGemini('k', [], {});
    mockFetch([ok('{}')]);
    await askGemini('k', [], {});
    expect(called).toEqual([MODELS[1]]);
    expect(modelOrder().at(-1)).toBe(MODELS[0]);
  });

  it('does not try other models when the key itself is wrong', async () => {
    mockFetch([fail(400)]);
    await expect(askGemini('k', [], {})).rejects.toThrow('status 400');
    expect(called).toHaveLength(1);
  });

  it('gives a readable message when every model is busy', async () => {
    mockFetch([]);
    await expect(askGemini('k', [], {})).rejects.toThrow('busy');
    expect(called).toEqual(MODELS);
    expect(worthTryingAnother(500)).toBe(true);
  });
});
