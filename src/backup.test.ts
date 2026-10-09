import { describe, expect, it } from 'vitest';
import { backupDue } from './backup';

describe('backupDue', () => {
  const now = Date.UTC(2026, 9, 9);
  it('waits until there is something worth backing up', () => {
    expect(backupDue(undefined, 2, now)).toBe(false);
    expect(backupDue(undefined, 3, now)).toBe(true);
  });
  it('reminds again after two weeks', () => {
    expect(backupDue(now - 13 * 864e5, 10, now)).toBe(false);
    expect(backupDue(now - 15 * 864e5, 10, now)).toBe(true);
  });
});
