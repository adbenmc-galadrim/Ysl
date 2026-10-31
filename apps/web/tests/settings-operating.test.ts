import 'fake-indexeddb/auto';
import {
  DEFAULT_OPERATING_PROFILE,
  OPERATING_PROFILE_KEY,
  SMALL_SITE_OPERATING_PROFILE,
} from '@repo/contract/operating-profile';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { OPERATING_PARAMS } from '@repo/contract/operating-profile';
import { beforeEach, describe, expect, it } from 'vitest';
import { NOT_YET_PARAMS } from '#/features/settings/operating-steps';
import type { CourrierDatabase, LocalSetting } from '#/features/db/schema';
import { readPickup } from '#/features/settings/pickup';
import { readOperatingProfile } from '#/features/settings/operating-profile';
import { NOW, openTestDatabase } from './helpers/local-rows';

let db: CourrierDatabase;

const row = (values: Partial<LocalSetting>): LocalSetting => ({
  id: 'operating-1',
  key: OPERATING_PROFILE_KEY,
  value: SMALL_SITE_OPERATING_PROFILE,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  updatedBy: 'admin-1',
  ...values,
});

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('readOperatingProfile', () => {
  it('reads the default on a device with no profile', async () => {
    expect(await readOperatingProfile(db)).toEqual(DEFAULT_OPERATING_PROFILE);
  });

  it('reads what the server sent down', async () => {
    await db.setting.put(row({}));
    expect(await readOperatingProfile(db)).toEqual(
      SMALL_SITE_OPERATING_PROFILE,
    );
  });

  it('ignores a deleted row', async () => {
    await db.setting.put(row({ deletedAt: NOW }));
    expect(await readOperatingProfile(db)).toEqual(DEFAULT_OPERATING_PROFILE);
  });

  it('leaves the pickup of the same table alone', async () => {
    await db.setting.put(row({}));
    expect((await readPickup(db)).place).toBe('');
  });
});

describe('the banner of what does not act yet', () => {
  const t = createTranslator(DEFAULT_LOCALE);

  it('names the moment of the e-mail, and no other step', () => {
    const banner = t('operating.notYet');
    expect(NOT_YET_PARAMS).toEqual(['emailMoment']);
    for (const param of OPERATING_PARAMS) {
      expect(banner.includes(`« ${t(`operating.param.${param}`)} »`)).toBe(
        NOT_YET_PARAMS.includes(param),
      );
    }
  });
});
