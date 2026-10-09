import type { Units } from '../types';

export const PLATES: Record<Units, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};
export const BAR: Record<Units, number> = { kg: 20, lb: 45 };

/** Plates for one side of the bar (greedy). remainder > 0 means the exact weight can't be made. */
export function platesPerSide(total: number, bar: number, units: Units) {
  let side = Math.round(((total - bar) / 2) * 1000) / 1000;
  const plates: number[] = [];
  if (side <= 0) return { plates, remainder: Math.max(0, side) };
  for (const p of PLATES[units]) {
    while (side + 1e-9 >= p) {
      plates.push(p);
      side = Math.round((side - p) * 1000) / 1000;
    }
  }
  return { plates, remainder: side };
}
