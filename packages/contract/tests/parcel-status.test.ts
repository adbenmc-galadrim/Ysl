import { describe, expect, it } from 'vitest';
import {
  BACKWARD_TRANSITIONS,
  canTransition,
  FORWARD_TRANSITIONS,
  isStepBack,
  PARCEL_STATUSES,
  type StatusFields,
  statusPatch,
  StatusTransitionError,
  stepBackOf,
  stepOf,
} from '@repo/contract/parcel-status';

const NOW = new Date('2026-10-25T10:00:00Z');
const EARLIER = new Date('2026-10-24T09:00:00Z');
const context = { now: NOW, agentId: 'agent-1' };

function fields(overrides: Partial<StatusFields> = {}): StatusFields {
  return {
    status: 'recu',
    notifiedAt: null,
    lastNotifiedAt: null,
    deliveredAt: null,
    deliveredBy: null,
    ...overrides,
  };
}

describe('the status graph', () => {
  it('undoes every step forward back to where it came from', () => {
    for (const from of PARCEL_STATUSES) {
      for (const to of FORWARD_TRANSITIONS[from]) {
        expect(BACKWARD_TRANSITIONS[to], `${from} → ${to}`).toContain(from);
      }
    }
  });

  it('steps back only along a step forward', () => {
    for (const from of PARCEL_STATUSES) {
      for (const to of BACKWARD_TRANSITIONS[from]) {
        expect(FORWARD_TRANSITIONS[to], `${from} → ${to}`).toContain(from);
        expect(isStepBack(from, to)).toBe(true);
      }
    }
  });

  it('keeps the shortcuts of §8.3 out', () => {
    expect(canTransition('a_completer', 'notifie')).toBe(false);
    expect(canTransition('a_completer', 'remis')).toBe(false);
    expect(canTransition('notifie', 'a_completer')).toBe(false);
    expect(canTransition('remis', 'retourne')).toBe(false);
    expect(canTransition('remis', 'remis')).toBe(true);
  });
});

describe('stepBackOf', () => {
  it.each([
    ['a_completer', null, undefined],
    ['recu', null, 'a_completer'],
    ['notifie', EARLIER, 'recu'],
    ['remis', EARLIER, 'notifie'],
    ['remis', null, 'recu'],
    ['retourne', EARLIER, 'notifie'],
    ['retourne', null, 'recu'],
  ] as const)('%s, notified %s → %s', (status, notifiedAt, expected) => {
    expect(stepBackOf({ status, notifiedAt })).toBe(expected);
  });
});

describe('stepOf', () => {
  it('puts a parcel to complete on the first step and a returned one nowhere', () => {
    expect(stepOf('a_completer')).toBe(0);
    expect(stepOf('notifie')).toBe(1);
    expect(stepOf('remis')).toBe(2);
    expect(stepOf('retourne')).toBeUndefined();
  });
});

describe('statusPatch', () => {
  it('counts from 0 on a row pulled before the counter', () => {
    expect(statusPatch(fields(), 'notifie', context).statusSeq).toBe(1);
    expect(
      statusPatch(fields({ statusSeq: 4 }), 'notifie', context).statusSeq,
    ).toBe(5);
  });

  it('keeps the first notification and stamps it only once', () => {
    expect(statusPatch(fields(), 'notifie', context).notifiedAt).toEqual(NOW);
    const back = fields({ status: 'remis', notifiedAt: EARLIER });
    expect(statusPatch(back, 'notifie', context).notifiedAt).toEqual(EARLIER);
  });

  it('writes the proof of a handover and clears it when it is undone', () => {
    expect(statusPatch(fields(), 'remis', context)).toMatchObject({
      deliveredAt: NOW,
      deliveredBy: 'agent-1',
    });
    const handedOver = fields({
      status: 'remis',
      notifiedAt: EARLIER,
      deliveredAt: EARLIER,
      deliveredBy: 'agent-2',
    });
    expect(statusPatch(handedOver, 'notifie', context)).toMatchObject({
      deliveredAt: null,
      deliveredBy: null,
    });
  });

  it('forgets the notification when it is undone', () => {
    const notified = fields({
      status: 'notifie',
      notifiedAt: EARLIER,
      lastNotifiedAt: NOW,
    });
    expect(statusPatch(notified, 'recu', context)).toMatchObject({
      notifiedAt: null,
      lastNotifiedAt: null,
    });
  });

  it('refuses a change outside the graph, or no change at all', () => {
    expect(() =>
      statusPatch(fields({ status: 'a_completer' }), 'notifie', context),
    ).toThrow(StatusTransitionError);
    expect(() => statusPatch(fields(), 'recu', context)).toThrow(
      StatusTransitionError,
    );
  });
});
