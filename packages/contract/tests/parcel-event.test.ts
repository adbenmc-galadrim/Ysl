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
    ];
    for (const event of events) expect(roundTrip(event)).toEqual(event);
  });

  it('skips an event another version wrote and this one cannot read', () => {
    expect(readParcelEvent('parcel.archived', null)).toBeUndefined();
    expect(
      readParcelEvent('parcel.status', { from: 'perdu', to: 'recu' }),
    ).toBeUndefined();
    expect(readParcelEvent('parcel.edited', 'poids')).toBeUndefined();
  });

  it('keeps the fields it knows of an edit, drops the others', () => {
    expect(
      readParcelEvent('parcel.edited', { fields: ['tracking', 'color'] }),
    ).toEqual({ type: 'parcel.edited', fields: ['tracking'] });
  });
});
