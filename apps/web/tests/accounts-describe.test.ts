import { describe, expect, it } from 'vitest';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  accountLabel,
  devicesLine,
  hasNextPage,
  pageRange,
} from '#/features/accounts/describe';

const t = createTranslator(DEFAULT_LOCALE);

describe('the pages of the accounts', () => {
  it('shows the range past 200 accounts', () => {
    expect(pageRange(5, 50, 205, t)).toBe('201–205 sur 205');
    expect(pageRange(1, 50, 0, t)).toBe('0–0 sur 0');
  });

  it('offers the next page while accounts remain, and only then', () => {
    expect(hasNextPage(4, 50, { total: 205 })).toBe(true);
    expect(hasNextPage(5, 50, { total: 205 })).toBe(false);
  });
});

describe('the state of an invited account', () => {
  const now = new Date('2026-11-01T12:00:00Z');

  it('says when the link has run out', () => {
    const invited = (linkExpiresAt: Date | null) =>
      accountLabel({ state: 'invited', linkExpiresAt }, t, now);
    expect(invited(new Date('2026-11-02T12:00:00Z'))).toBe('Invitation envoyée');
    expect(invited(new Date('2026-10-31T12:00:00Z'))).toBe('Invitation expirée');
    expect(invited(null)).toBe('Invitation expirée');
  });

  it('leaves the others alone', () => {
    expect(accountLabel({ state: 'active', linkExpiresAt: null }, t, now)).toBe('Actif');
  });
});

describe('the devices of an account', () => {
  it('names each kind once', () => {
    expect(
      devicesLine(
        { deviceAgents: ['Mozilla (iPhone)', 'x iPhone', 'Macintosh', null] },
        t,
      ),
    ).toBe('iPhone, Mac, Ordinateur');
  });
});
