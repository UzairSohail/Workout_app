import { exportBackup, updateSettings } from './db';

/** Saves a file: the share sheet on phones that support it (so iOS can save to Files), else a download. */
export async function saveFile(name: string, text: string, type: string) {
  const file = new File([text], name, { type });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    /* fall back to a download */
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Exports a full JSON backup and remembers when, for the backup reminder. */
export async function backupNow() {
  const data = await exportBackup();
  await saveFile(`workouts-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data), 'application/json');
  await updateSettings({ lastBackupAt: Date.now() });
}

export const BACKUP_EVERY_DAYS = 14;

export function backupDue(lastBackupAt: number | undefined, workoutCount: number, now = Date.now()) {
  if (workoutCount < 3) return false;
  return !lastBackupAt || now - lastBackupAt > BACKUP_EVERY_DAYS * 864e5;
}
