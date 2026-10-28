import { resumeOf } from './reminders';

/**
 * What a recipient answered to the pickup e-mail (YSL-70). The app reads no
 * mail (D2): the agent reads the answer in their own mailbox and reports it
 * in two taps.
 *
 * - `not_mine`: the parcel is not theirs; it goes back « À compléter ».
 * - `colleague`: someone else comes for it (`expectedDelegate`).
 * - `absent`: away until a day (`remindersPausedUntil`), no reminder before.
 */
export const REPLY_KINDS = ['not_mine', 'colleague', 'absent'] as const;

export type ReplyKind = (typeof REPLY_KINDS)[number];

export function isReplyKind(value: unknown): value is ReplyKind {
  return (
    typeof value === 'string' &&
    (REPLY_KINDS as readonly string[]).includes(value)
  );
}

/** The longest colleague's name kept on a parcel. */
export const DELEGATE_NAME_MAX = 120;

/** The reply columns of a parcel row, server or device. */
export type ReplyColumns = {
  status: string;
  reply?: string | null;
  repliedAt?: Date | null;
  expectedDelegate?: string | null;
  remindersPausedUntil?: Date | null;
};

/** The answer that still says something about the parcel, and when it came. */
export type StandingReply =
  | { kind: 'not_mine'; at: Date }
  | { kind: 'colleague'; at: Date; delegate: string }
  | { kind: 'absent'; at: Date; until: Date };

/**
 * The last answer while it still holds: « pas pour moi » until someone else
 * is set for the parcel, a colleague until the parcel leaves the desk, an
 * absence until the recipient is back. A reply this version does not know
 * is left alone.
 */
export function standingReply(
  row: ReplyColumns,
  now: Date,
): StandingReply | null {
  if (!isReplyKind(row.reply) || !row.repliedAt) return null;
  const at = row.repliedAt;
  switch (row.reply) {
    case 'not_mine':
      return row.status === 'a_completer' ? { kind: 'not_mine', at } : null;
    case 'colleague':
      return row.status === 'notifie' && row.expectedDelegate
        ? { kind: 'colleague', at, delegate: row.expectedDelegate }
        : null;
    case 'absent': {
      const until = row.remindersPausedUntil;
      return row.status === 'notifie' && until && now < resumeOf(until)
        ? { kind: 'absent', at, until }
        : null;
    }
  }
}

/** The day picked in « Absence jusqu'au … », at the start of that day on the iPhone. */
export function lastDayAway(day: Date): Date {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** `YYYY-MM-DD` of a day on the iPhone's calendar, as the event keeps it. */
export function dayKey(day: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** The start of the day a `dayKey` names, on the iPhone's calendar. */
export function fromDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year!, month! - 1, day);
}
