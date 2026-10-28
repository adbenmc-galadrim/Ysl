import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { signatureHeading } from '#/features/handover/signing';
import { parcelRow } from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);

describe('signatureHeading', () => {
  it('names who signs and for how many parcels', () => {
    expect(
      signatureHeading('Nora Haddad', [parcelRow(), parcelRow()], t),
    ).toEqual({ title: 'Nora Haddad signe pour 2 colis' });
  });

  it('names the colleague who signs, and for whom', () => {
    expect(
      signatureHeading(
        'Nora Haddad',
        [parcelRow(), parcelRow(), parcelRow()],
        t,
        'Paul Mercier',
      ),
    ).toEqual({ title: 'Paul Mercier signe pour Nora Haddad, 3 colis' });
  });

  it('points out the registered parcel among them, as the mockup does', () => {
    const registered = parcelRow({
      type: 'recommande',
      carrier: 'UPS',
      tracking: '1Z999AA10123458810',
    });
    expect(
      signatureHeading(
        'Nora Haddad',
        [parcelRow(), registered, parcelRow()],
        t,
      ),
    ).toEqual({
      title: 'Nora Haddad signe pour 3 colis',
      detail: 'Dont 1 recommandé UPS ···8810',
    });
  });

  it('counts several registered parcels', () => {
    const registered = () => parcelRow({ type: 'recommande' });
    expect(
      signatureHeading('Nora Haddad', [registered(), registered()], t).detail,
    ).toBe('Dont 2 recommandés');
  });
});
