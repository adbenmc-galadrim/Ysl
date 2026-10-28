import { describe, expect, it } from 'vitest';
import { lastDayAway, standingReply } from '@repo/contract/parcel-reply';

const repliedAt = new Date(2026, 9, 28, 10, 42);
const now = new Date(2026, 9, 28, 11);

describe('the reply that still holds', () => {
  it('keeps « pas pour moi » until someone else is set', () => {
    expect(
      standingReply(
        { status: 'a_completer', reply: 'not_mine', repliedAt },
        now,
      ),
    ).toEqual({ kind: 'not_mine', at: repliedAt });
    expect(
      standingReply({ status: 'recu', reply: 'not_mine', repliedAt }, now),
    ).toBeNull();
  });

  it('keeps a colleague while the parcel waits', () => {
    const row = {
      reply: 'colleague',
      repliedAt,
      expectedDelegate: 'Paul Mercier',
    };
    expect(standingReply({ ...row, status: 'notifie' }, now)).toMatchObject({
      kind: 'colleague',
      delegate: 'Paul Mercier',
    });
    expect(standingReply({ ...row, status: 'remis' }, now)).toBeNull();
  });

  it('keeps an absence until the working day after the last day away', () => {
    const row = {
      status: 'notifie',
      reply: 'absent',
      repliedAt,
      remindersPausedUntil: lastDayAway(new Date(2026, 9, 30, 15)),
    };
    expect(row.remindersPausedUntil).toEqual(new Date(2026, 9, 30));
    expect(standingReply(row, new Date(2026, 9, 31, 12))?.kind).toBe('absent');
    expect(standingReply(row, new Date(2026, 10, 2, 0, 0))).toBeNull();
  });

  it('leaves alone a reply a newer app wrote', () => {
    expect(
      standingReply({ status: 'notifie', reply: 'en_conges', repliedAt }, now),
    ).toBeNull();
  });
});
