/**
 * When a notified parcel calls for a reminder, and when it is « en
 * souffrance » (F37, D12): reminders at J+2 and J+5 working days after the
 * first notice, then an alert to the agent. Nothing leaves by itself (D2):
 * the app says who is due, the agent sends. Working days run Monday to
 * Friday on the iPhone's calendar; public holidays are not known and count
 * as working days.
 */

/** Working days after the first notice: the first reminder, then the second (D12). */
export const REMINDER_DAYS = [2, 5] as const;

/** Working days after the last reminder before the parcel is « en souffrance ». */
export const LATE_AFTER_LAST_REMINDER_DAYS = 2;

function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function isWorkingDay(day: Date): boolean {
  const weekday = day.getDay();
  return weekday !== 0 && weekday !== 6;
}

/**
 * The start of the day `count` working days after `date`'s day: Friday + 2
 * is Tuesday, and so is Saturday + 2.
 */
export function addWorkingDays(date: Date, count: number): Date {
  const day = startOfDay(date);
  let left = count;
  while (left > 0) {
    day.setDate(day.getDate() + 1);
    if (isWorkingDay(day)) left -= 1;
  }
  return day;
}

export type ReminderHistory = {
  /** The first notice confirmed sent. */
  notifiedAt: Date;
  /** The reminders confirmed sent after it, in any order. */
  reminders: readonly Date[];
  /**
   * « Absent jusqu'au … » (YSL-70): the last day the recipient is away.
   * Nothing is due nor late until the working day after it.
   */
  pausedUntil?: Date | null;
};

/** The working day the recipient is back: the one after the last day away. */
export function resumeOf(pausedUntil: Date): Date {
  return addWorkingDays(pausedUntil, 1);
}

export type ReminderState = {
  /** Reminders already sent. */
  sent: number;
  /** The last mail that left: the last reminder, else the notice. */
  last: Date;
  /** When the next reminder is due; null once both went. */
  dueAt: Date | null;
  /** A reminder is due now. */
  due: boolean;
  /** When the parcel is « en souffrance ». */
  lateAt: Date;
  late: boolean;
  /** Away until then (`pausedUntil`): no reminder, no alert before it. */
  pausedUntil: Date | null;
};

/**
 * Where a notified parcel stands. The first reminder is due two working
 * days after the notice, the second five, never on the day the first went.
 * Both sent, the parcel is « en souffrance » two working days after the
 * last; short of them, from the fifth working day. A recipient away
 * holds both back: what fell due meanwhile is due the day they are back,
 * and the alert waits two more working days.
 */
export function reminderState(
  { notifiedAt, reminders, pausedUntil = null }: ReminderHistory,
  now: Date,
): ReminderState {
  const sent = reminders.length;
  const last = reminders.reduce(
    (latest, at) => (at > latest ? at : latest),
    notifiedAt,
  );
  const nextDays = REMINDER_DAYS[sent];
  let dueAt: Date | null = null;
  if (nextDays !== undefined) {
    const planned = addWorkingDays(notifiedAt, nextDays);
    const afterLast = sent > 0 ? addWorkingDays(last, 1) : planned;
    dueAt = afterLast > planned ? afterLast : planned;
  }
  let lateAt =
    sent >= REMINDER_DAYS.length
      ? addWorkingDays(last, LATE_AFTER_LAST_REMINDER_DAYS)
      : addWorkingDays(notifiedAt, REMINDER_DAYS.at(-1)!);
  const resumeAt = pausedUntil && resumeOf(pausedUntil);
  const paused = resumeAt !== null && now < resumeAt;
  if (resumeAt) {
    if (dueAt && dueAt < resumeAt) dueAt = resumeAt;
    const alertAt = addWorkingDays(resumeAt, LATE_AFTER_LAST_REMINDER_DAYS);
    if (lateAt <= resumeAt) lateAt = alertAt;
  }
  return {
    sent,
    last,
    dueAt,
    due: dueAt !== null && now >= dueAt,
    lateAt,
    late: now >= lateAt,
    pausedUntil: paused ? pausedUntil : null,
  };
}
