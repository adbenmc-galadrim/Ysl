import { describe, expect, it } from 'vitest';
import { impactLine } from '#/features/settings/operating-impact';

describe('impactLine', () => {
  it('words the example of the specification', () => {
    expect(
      impactLine({
        param: 'signature',
        from: 'optional',
        to: 'required',
        parcels: 12,
      }),
    ).toBe('12 colis prêts devront être signés');
  });

  it('agrees with a single parcel', () => {
    expect(
      impactLine({
        param: 'photo',
        from: 'optional',
        to: 'disabled',
        parcels: 1,
      }),
    ).toBe('1 colis prêt : étape retirée');
  });

  it('reads reminders as none, by hand, automatic', () => {
    expect(
      impactLine({
        param: 'reminders',
        from: 'optional',
        to: 'required',
        parcels: 7,
      }),
    ).toBe('7 colis notifiés : relances automatiques');
  });

  it('says no parcel is touched where the step has none yet', () => {
    expect(
      impactLine({
        param: 'emailMoment',
        from: 'scan',
        to: 'deposit',
        parcels: 0,
      }),
    ).toBe('Aucun colis touché pour l’instant');
  });
});
