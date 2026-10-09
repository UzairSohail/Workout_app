import type { Units } from '../types';

export const KG_PER_LB = 0.45359237;

export function toDisplay(kg: number, units: Units): number {
  const v = units === 'kg' ? kg : kg / KG_PER_LB;
  return Math.round(v * 100) / 100;
}

export function fromDisplay(value: number, units: Units): number {
  return units === 'kg' ? value : value * KG_PER_LB;
}

/** Rounds a display-unit weight to the nearest multiple of step. */
export function roundTo(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(Math.round(value / step) * step * 100) / 100;
}

export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function fmtWeight(kg: number | null | undefined, units: Units): string {
  if (kg == null) return '–';
  return `${fmt(toDisplay(kg, units))} ${units}`;
}
