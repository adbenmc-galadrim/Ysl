import { describe, expect, it } from 'vitest';
import { dueAmong, type ReminderMail } from '#/features/mail/reminder-mails';

const mail = (due: Record<string, boolean>) =>
  ({
    due: Object.values(due).some(Boolean),
    parcels: Object.keys(due).map((id) => ({ id })),
    reminders: new Map(Object.entries(due).map(([id, d]) => [id, { due: d }])),
  }) as unknown as ReminderMail;

describe('dueAmong', () => {
  it('keeps who is due over a parcel shown', () => {
    expect(dueAmong([mail({ a: true })], new Set(['a']))).toHaveLength(1);
  });

  it('leaves out who is late here and due in another department', () => {
    expect(
      dueAmong([mail({ here: false, there: true })], new Set(['here'])),
    ).toEqual([]);
  });

  it('leaves out who has nothing due', () => {
    expect(dueAmong([mail({ a: false })], new Set(['a']))).toEqual([]);
  });
});
