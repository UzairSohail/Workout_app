import { liveQuery } from 'dexie';
import { db } from './db';

/** The app's colour themes. The colours themselves live in styles.css under :root[data-theme='…']. */
export const THEMES = [
  { id: 'pink', name: 'Ink & Pink', blurb: 'Near-black with a pink accent', bg: '#09090f', card: '#12121a', accent: '#ec4899' },
  { id: 'ocean', name: 'Ocean', blurb: 'Deep navy with a sky-blue accent', bg: '#060a13', card: '#0e1524', accent: '#38bdf8' },
  { id: 'forest', name: 'Forest', blurb: 'Dark green with a lime accent', bg: '#070c09', card: '#0f1712', accent: '#a3e635' },
  { id: 'ember', name: 'Ember', blurb: 'Warm charcoal with an orange accent', bg: '#0f0a07', card: '#19120e', accent: '#fb923c' },
  { id: 'daylight', name: 'Daylight', blurb: 'Light and bright with a violet accent', bg: '#f3f3f7', card: '#ffffff', accent: '#7c3aed' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export const DEFAULT_THEME: ThemeId = 'pink';
const KEY = 'theme';

export const themeOf = (id?: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

/** Paints the page in a theme and remembers it on this phone, so the next launch opens in it with no flash. */
export function applyTheme(id?: string) {
  const t = themeOf(id);
  const root = document.documentElement;
  if (t.id === DEFAULT_THEME) delete root.dataset.theme;
  else root.dataset.theme = t.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
  try {
    localStorage.setItem(KEY, t.id);
  } catch {
    /* private mode */
  }
}

/** Follows the theme in Settings, including a change that arrives from another phone through sync. */
export function watchTheme() {
  liveQuery(() => db.settings.get('me')).subscribe({ next: (s) => applyTheme(s?.theme), error: () => {} });
}
