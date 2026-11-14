import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withExtras } from '../exercises';
import type { Exercise } from '../types';
import { buildPrompt, parsePicks } from './gemini';
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

  it('keeps only picks from the offered list', () => {
    const rows = [
      { name: 'Dip', candidates: candidatesFor(all, 'Dip') },
      { name: 'Push Up', candidates: candidatesFor(all, 'Push Up') },
      { name: 'Hanging Leg Raise', candidates: candidatesFor(all, 'Hanging Leg Raise') },
    ];
    const text = JSON.stringify({ picks: [{ row: 1, pick: 'Dips_-_Chest_Version' }, { row: 2, pick: 'Not_A_Real_Id' }, { row: 3, pick: '' }, { row: 9, pick: 'Pushups' }] });
    expect(parsePicks(text, rows)).toEqual(['Dips_-_Chest_Version', undefined, undefined]);
    expect(parsePicks('not json', rows)).toEqual([undefined, undefined, undefined]);
  });
});
