/** Helps people put the app on their home screen, where rest alerts and full screen work. */
import { useSyncExternalStore } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = 'installTipDismissed';
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Chrome on Android fires this early, so it's caught at startup and kept for the Install button. */
export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => { deferred = null; emit(); });
}

export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone and iPad, including iPads that report themselves as a Mac. */
export const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

export function dismissInstallTip() {
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode: it just shows again next time */ }
  emit();
}

export async function promptInstall() {
  if (!deferred) return;
  const e = deferred;
  deferred = null;
  emit();
  await e.prompt();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = (): 'ios' | 'prompt' | null => {
  if (isInstalled() || read(DISMISS_KEY)) return null;
  if (deferred) return 'prompt';
  return isIos() ? 'ios' : null;
};

/** 'ios' = show the Share › Add to Home Screen steps, 'prompt' = show an Install button, null = show nothing. */
export const useInstallTip = () => useSyncExternalStore(subscribe, snapshot);
