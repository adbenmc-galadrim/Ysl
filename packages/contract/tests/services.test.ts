import { describe, expect, it } from 'vitest';
import {
  carrierService,
  REGISTERED,
  serviceLabel,
  serviceOfTracking,
} from '@repo/contract/codes';

describe('serviceLabel', () => {
  it('names a UPS service class by its last two digits', () => {
    expect(serviceLabel('ups', '002')).toBe('2nd Day Air');
    expect(serviceLabel('ups', '13')).toBe('Next Day Air Saver');
  });

  it('names a FedEx service class', () => {
    expect(serviceLabel('fedex', '020')).toBe('Express Saver');
    expect(serviceLabel('fedex', '1')).toBe('Priority Overnight');
  });

  it('keeps a Geopost code without a name', () => {
    expect(serviceLabel('colissimo', '801')).toBeNull();
    expect(serviceLabel('dpd', '328')).toBeNull();
    expect(carrierService('dpd', '328')).toEqual({ code: '328', label: null });
    expect(carrierService('ups', '004')).toEqual({ code: '04', label: null });
  });

  it('does not name an unknown code', () => {
    expect(serviceLabel('ups', '99')).toBeNull();
    expect(serviceLabel(null, '01')).toBeNull();
  });
});

describe('serviceOfTracking', () => {
  it('reads the service code inside a 1Z', () => {
    expect(serviceOfTracking('1Z12345E0205271686', 'ups')).toEqual({
      code: '02',
      label: '2nd Day Air',
    });
  });

  it('marks a registered S10 item by its service indicator', () => {
    expect(serviceOfTracking('RA123456785FR', null)).toEqual({
      code: null,
      label: REGISTERED,
    });
    expect(serviceOfTracking('RA123456785FR', 'la-poste')?.label).toBe(
      REGISTERED,
    );
  });

  it('says nothing of other S10 items, Chronopost or other shapes', () => {
    expect(serviceOfTracking('CA123456785FR', null)).toBeNull();
    expect(serviceOfTracking('RA123456785FR', 'chronopost')).toBeNull();
    expect(serviceOfTracking('01234567890128', 'dpd')).toBeNull();
    expect(serviceOfTracking('1Z12345E020527168', 'ups')).toBeNull();
  });
});
