import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { deviceKind, deviceSubtitle } from '#/features/devices/describe';

const t = createTranslator(DEFAULT_LOCALE);

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';

describe('deviceKind', () => {
  it('tells an iPhone from a Mac, though both say Mac OS X', () => {
    expect(deviceKind(IPHONE)).toBe('iphone');
    expect(deviceKind(MAC)).toBe('mac');
  });

  it('falls back to a computer when the browser says nothing useful', () => {
    expect(deviceKind(null)).toBe('computer');
    expect(deviceKind('curl/8.0')).toBe('computer');
  });
});

describe('deviceSubtitle', () => {
  const now = new Date(2026, 9, 28, 15, 0);

  it('says what the device is and when it was last used', () => {
    expect(
      deviceSubtitle(
        {
          userAgent: IPHONE,
          lastActiveAt: new Date(2026, 9, 27, 9, 5),
          current: false,
        },
        t,
        now,
      ),
    ).toBe('iPhone · actif le 27 octobre à 9 h 05');
  });

  it('marks the device the admin is holding', () => {
    expect(
      deviceSubtitle(
        { userAgent: IPHONE, lastActiveAt: now, current: true },
        t,
        now,
      ),
    ).toBe('iPhone · cet appareil');
  });
});
