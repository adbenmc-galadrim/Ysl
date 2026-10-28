import { describe, expect, it } from 'vitest';
import {
  eventColumns,
  type ParcelEvent,
  readParcelEvent,
} from '../src/parcel-event';

const roundTrip = (event: ParcelEvent) => {
  const { type, detail } = eventColumns(event);
  return readParcelEvent(type, JSON.parse(JSON.stringify(detail)));
};

describe('parcel events', () => {
  it('reads back what it writes', () => {
    const events: ParcelEvent[] = [
      { type: 'parcel.edited', fields: ['recipient', 'weightKg'] },
      { type: 'parcel.status', from: 'notifie', to: 'recu' },
      { type: 'parcel.deleted' },
      { type: 'parcel.imported', flags: ['tracking-rejected'] },
      { type: 'parcel.imported', flags: [] },
      {
        type: 'parcel.damaged',
        reason: 'mouille',
        note: null,
        notifyRecipient: true,
        carrierReserve: false,
        photos: 2,
      },
      { type: 'parcel.damage_lifted', reason: 'mouille' },
      { type: 'parcel.delivered', handoverId: 'h-1', method: 'pin' },
      { type: 'parcel.informed', kind: 'avis' },
      { type: 'parcel.informed', kind: 'relance' },
      {
        type: 'parcel.reply',
        reply: 'not_mine',
        previous: { kind: 'person', id: 'p-1', name: 'Hugo Lefèvre' },
      },
      { type: 'parcel.reply', reply: 'not_mine', previous: null },
      { type: 'parcel.reply', reply: 'colleague', delegate: 'Paul Mercier' },
      { type: 'parcel.reply', reply: 'absent', until: '2026-11-03' },
    ];
    for (const event of events) expect(roundTrip(event)).toEqual(event);
  });

  it('skips an event another version wrote and this one cannot read', () => {
    expect(readParcelEvent('parcel.archived', null)).toBeUndefined();
    expect(
      readParcelEvent('parcel.status', { from: 'perdu', to: 'recu' }),
    ).toBeUndefined();
    expect(readParcelEvent('parcel.edited', 'poids')).toBeUndefined();
    expect(
      readParcelEvent('parcel.damage_lifted', { reason: 'perce' }),
    ).toBeUndefined();
    expect(
      readParcelEvent('parcel.delivered', {
        handoverId: 'h-1',
        method: 'face',
      }),
    ).toBeUndefined();
    expect(
      readParcelEvent('parcel.reply', { reply: 'en_conges' }),
    ).toBeUndefined();
    expect(readParcelEvent('parcel.informed', { kind: 'sms' })).toBeUndefined();
    expect(
      readParcelEvent('parcel.reply', { reply: 'absent', until: '3 nov.' }),
    ).toBeUndefined();
  });

  it('keeps the fields it knows of an edit, drops the others', () => {
    expect(
      readParcelEvent('parcel.edited', { fields: ['tracking', 'color'] }),
    ).toEqual({ type: 'parcel.edited', fields: ['tracking'] });
  });
});
