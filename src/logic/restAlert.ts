import type { Settings } from '../types';

/**
 * Sound, vibration and notification for the end of a rest.
 *
 * Browsers only allow audio after a tap, so the AudioContext is unlocked when a set is ticked off
 * (which starts the rest), and the beep is scheduled on it ahead of time. Audio scheduled that way
 * can still play when the app is in the background on Android; iPhone pauses web apps that aren't
 * on screen, so there the alert only works with the app open.
 */

export interface AlertPrefs { sound: boolean; vibrate: boolean; notify: boolean }

export const alertPrefs = (s: Settings): AlertPrefs => ({
  sound: s.restSound !== false,
  vibrate: s.restVibrate !== false,
  notify: !!s.restNotify,
});

export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;
export const canNotify = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
export const isIos = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

let ctx: AudioContext | null = null;
let scheduled: OscillatorNode[] = [];
/** AudioContext time the scheduled beep starts at. */
let scheduledAt = 0;
/** Bumped on every cancel, so a schedule waiting on resume() can tell it was cancelled. */
let gen = 0;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx();
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a tap so later beeps are allowed (iOS needs this). */
export function unlockAudio() {
  const c = audio();
  if (c && c.state !== 'running') c.resume().catch(() => {});
}

function tones(c: AudioContext, start: number): OscillatorNode[] {
  // Three short high beeps, then a longer one.
  return [[0, 0.18], [0.3, 0.18], [0.6, 0.18], [0.95, 0.5]].map(([t, len]) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.value = t > 0.9 ? 1175 : 880;
    g.gain.setValueAtTime(0.0001, start + t);
    g.gain.exponentialRampToValueAtTime(0.25, start + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + t + len);
    o.connect(g).connect(c.destination);
    o.start(start + t);
    o.stop(start + t + len + 0.05);
    return o;
  });
}

export function cancelBeep() {
  for (const o of scheduled) {
    try { o.stop(); } catch { /* already stopped */ }
  }
  scheduled = [];
  scheduledAt = 0;
  gen++;
}

/** Schedules the end-of-rest beep for `endAt` (ms since epoch). */
export function scheduleBeep(endAt: number) {
  cancelBeep();
  const c = audio();
  if (!c) return;
  const mine = gen;
  const plan = () => {
    const left = (endAt - Date.now()) / 1000;
    if (mine !== gen || c.state !== 'running' || left <= 0.05) return;
    scheduledAt = c.currentTime + left;
    scheduled = tones(c, scheduledAt);
  };
  if (c.state === 'running') plan();
  else c.resume().then(plan, () => {});
}

/** True if a scheduled beep has played (or is playing) on time. */
export function beepPlayed(): boolean {
  return !!ctx && ctx.state === 'running' && scheduled.length > 0 && ctx.currentTime >= scheduledAt - 0.3;
}

export function beepNow() {
  cancelBeep();
  const c = audio();
  if (!c) return;
  if (c.state !== 'running') c.resume().catch(() => {});
  tones(c, c.currentTime + 0.05);
}

export const VIBRATE_PATTERN = [300, 150, 300, 150, 500];

export function vibrate() {
  try { navigator.vibrate?.(VIBRATE_PATTERN); } catch { /* unsupported */ }
}

export async function notify(title: string, body: string) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body, tag: 'rest-timer', icon: 'icon-192.png', badge: 'icon-192.png',
      // Not in every TypeScript DOM lib yet, but supported on Android.
      ...({ renotify: true, vibrate: VIBRATE_PATTERN, requireInteraction: false } as object),
    });
  } catch {
    /* no service worker (dev) or blocked */
  }
}

/** Asks for notification permission. Returns whether notifications are allowed. */
export async function askNotify(): Promise<boolean> {
  if (!canNotify()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** The full alert, as when a rest ends with the app open. */
export function restOver(prefs: AlertPrefs, opts: { hidden: boolean; beepScheduled: boolean }) {
  if (prefs.sound && !opts.beepScheduled) beepNow();
  if (prefs.vibrate) vibrate();
  if (prefs.notify && opts.hidden) notify('Rest is over', 'Time for your next set 💪');
}
