import { describe, expect, it } from 'vitest';
import { damageColumns, damageForEmail, damageOf } from '../src/parcel-damage';

const at = new Date('2026-10-27T09:12:00Z');

describe('parcel damage', () => {
  it('reads back the reserve it sets, and nothing once lifted', () => {
    const damage = {
      reason: 'contenu_casse' as const,
      note: 'Bruit de verre',
      notifyRecipient: true,
      carrierReserve: true,
      at,
    };
    expect(damageOf(damageColumns(damage))).toEqual(damage);
    expect(damageOf(damageColumns(null))).toBeNull();
  });

  it('leaves alone a reason a newer app wrote', () => {
    expect(damageOf({ damage: 'perce', damagedAt: at })).toBeNull();
  });

  it('tells the e-mail only when the agent asked to warn the employee', () => {
    const row = damageColumns({
      reason: 'carton_abime',
      note: '  ',
      notifyRecipient: true,
      carrierReserve: false,
      at,
    });
    expect(damageForEmail(row)).toEqual({ label: 'Carton abîmé', note: null });
    expect(damageForEmail({ ...row, damageNotify: false })).toBeNull();
  });
});
