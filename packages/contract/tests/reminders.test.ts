import { describe, expect, it } from 'vitest';
import { addWorkingDays, reminderState } from '@repo/contract/reminders';

/** October 2026: the 23rd is a Friday, the 24th a Saturday. */
const at = (day: number, hour = 10) => new Date(2026, 9, day, hour);

describe('working days', () => {
  it('skips the weekend', () => {
    expect(addWorkingDays(at(23, 17), 2)).toEqual(new Date(2026, 9, 27));
    expect(addWorkingDays(at(24), 2)).toEqual(new Date(2026, 9, 27));
    expect(addWorkingDays(at(25), 1)).toEqual(new Date(2026, 9, 26));
    expect(addWorkingDays(at(21), 2)).toEqual(new Date(2026, 9, 23));
    expect(addWorkingDays(at(23), 5)).toEqual(new Date(2026, 9, 30));
  });
});

describe('the reminders of a notified parcel', () => {
  it('asks for the first one on the second working day, not on Saturday', () => {
    const history = { notifiedAt: at(22, 16), reminders: [] };
    expect(reminderState(history, at(23, 18)).due).toBe(false);
    expect(reminderState(history, at(24)).due).toBe(false);
    expect(reminderState(history, at(25)).due).toBe(false);
    const monday = reminderState(history, new Date(2026, 9, 26, 0, 0));
    expect(monday).toMatchObject({ sent: 0, due: true, late: false });
    expect(monday.dueAt).toEqual(new Date(2026, 9, 26));
  });

  it('counts a notice given on Saturday from Monday', () => {
    const state = reminderState({ notifiedAt: at(24), reminders: [] }, at(26));
    expect(state.due).toBe(false);
    expect(state.dueAt).toEqual(new Date(2026, 9, 27));
  });

  it('asks for the second one on the fifth working day', () => {
    const history = { notifiedAt: at(19), reminders: [at(21)] };
    expect(reminderState(history, at(23)).due).toBe(false);
    const state = reminderState(history, at(26));
    expect(state).toMatchObject({ sent: 1, due: true });
    expect(state.dueAt).toEqual(new Date(2026, 9, 26));
    expect(state.last).toEqual(at(21));
  });

  it('never asks for the second one on the day the first went', () => {
    const state = reminderState(
      { notifiedAt: at(19), reminders: [at(26, 9)] },
      at(26, 18),
    );
    expect(state.due).toBe(false);
    expect(state.dueAt).toEqual(new Date(2026, 9, 27));
  });

  it('asks for no third one', () => {
    const state = reminderState(
      { notifiedAt: at(12), reminders: [at(19), at(14)] },
      at(30),
    );
    expect(state).toMatchObject({ sent: 2, due: false, dueAt: null });
    expect(state.last).toEqual(at(19));
  });

  it('is late two working days after the second reminder', () => {
    const history = { notifiedAt: at(16), reminders: [at(20), at(23, 11)] };
    expect(reminderState(history, at(26)).late).toBe(false);
    const state = reminderState(history, at(27, 0));
    expect(state.late).toBe(true);
    expect(state.lateAt).toEqual(new Date(2026, 9, 27));
  });

  it('is late from the fifth working day when the reminders did not go', () => {
    const none = { notifiedAt: at(23), reminders: [] };
    expect(reminderState(none, at(29, 23)).late).toBe(false);
    const state = reminderState(none, at(30, 8));
    expect(state).toMatchObject({ late: true, due: true });
    const one = { notifiedAt: at(23), reminders: [at(27)] };
    expect(reminderState(one, at(30)).late).toBe(true);
  });
});

describe('a recipient away (YSL-70)', () => {
  // Notified Wednesday the 21st: first reminder due Friday the 23rd.
  const notifiedAt = at(21, 9);

  it('holds the reminder back until the working day after the last day away', () => {
    const history = { notifiedAt, reminders: [], pausedUntil: at(23, 0) };
    const away = reminderState(history, at(23));
    expect(away).toMatchObject({ due: false, late: false });
    expect(away.pausedUntil).toEqual(at(23, 0));
    const back = reminderState(history, new Date(2026, 9, 26, 0, 0));
    expect(back).toMatchObject({ due: true, late: false, pausedUntil: null });
    expect(back.dueAt).toEqual(new Date(2026, 9, 26));
  });

  it('is not late while away, and alerts two working days after the return', () => {
    const history = { notifiedAt, reminders: [], pausedUntil: at(30, 0) };
    expect(reminderState(history, at(29)).late).toBe(false);
    expect(reminderState(history, new Date(2026, 10, 2, 9)).late).toBe(false);
    const state = reminderState(history, new Date(2026, 10, 4, 9));
    expect(state.lateAt).toEqual(new Date(2026, 10, 4));
    expect(state.late).toBe(true);
  });

  it('changes nothing once the absence is over before anything fell due', () => {
    const plain = reminderState({ notifiedAt, reminders: [] }, at(27));
    const paused = reminderState(
      { notifiedAt, reminders: [], pausedUntil: at(21, 0) },
      at(27),
    );
    expect(paused).toEqual(plain);
  });
});
