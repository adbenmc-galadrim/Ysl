import 'fake-indexeddb/auto';
import { OPERATING_PROFILE_KEY } from '@repo/contract/operating-profile';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import {
  countDepositMails,
  depositMailRows,
} from '#/features/mail/deposit-mails';
import { awaitsNotice } from '#/features/mail/recipients';
import { homeState } from '#/features/parcels/model';
import { toSections } from '#/features/parcels/sections';
import { parcelRow, NOW, openTestDatabase } from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);
const parcel = (values: Partial<LocalParcel>): LocalParcel => ({
  ...parcelRow(),
  personId: 'person-1',
  ...values,
});

const AT_SCAN = { tour: true, atScan: true };
const AT_DEPOSIT = { tour: true, atScan: false };

describe('awaitsNotice (ME29)', () => {
  it('lets a company with no tour tell a parcel received, as it always did', () => {
    expect(awaitsNotice(parcel({ status: 'recu' }))).toBe(true);
  });

  it('holds everything back until the deposit on the profile « au dépôt »', () => {
    expect(awaitsNotice(parcel({ status: 'recu' }), AT_DEPOSIT)).toBe(false);
    expect(awaitsNotice(parcel({ status: 'en_route' }), AT_DEPOSIT)).toBe(
      false,
    );
    expect(awaitsNotice(parcel({ status: 'depose' }), AT_DEPOSIT)).toBe(true);
  });

  it('tells a parcel on its way once on the profile « au scan »', () => {
    expect(awaitsNotice(parcel({ status: 'en_route' }), AT_SCAN)).toBe(true);
    expect(
      awaitsNotice(
        parcel({ status: 'en_route', lastNotifiedAt: NOW }),
        AT_SCAN,
      ),
    ).toBe(false);
    expect(awaitsNotice(parcel({ status: 'recu' }), AT_SCAN)).toBe(false);
  });

  it('never tells a parcel with nobody on it', () => {
    expect(
      awaitsNotice(
        parcel({ status: 'depose', personId: null, contactId: null }),
      ),
    ).toBe(false);
  });
});

describe('Colis', () => {
  it('asks to notify a parcel deposited or due at the scan, not one still to wait', () => {
    expect(homeState(parcel({ status: 'depose' }), NOW)).toBe('deposited');
    expect(
      homeState(parcel({ status: 'en_route' }), NOW, undefined, true, true),
    ).toBe('toNotify');
    expect(
      homeState(parcel({ status: 'en_route' }), NOW, undefined, true, false),
    ).toBe('onTour');
    expect(
      homeState(
        parcel({ status: 'en_route', lastNotifiedAt: NOW }),
        NOW,
        undefined,
        true,
        true,
      ),
    ).toBe('onTour');
  });

  it('lists a parcel deposited under « À notifier », where the button is', () => {
    const [section] = toSections([{ id: 'a', state: 'deposited' } as never]);
    expect(section?.title).toBe(t('colis.section.toNotify'));
  });
});

describe('the line of a confirmed deposit', () => {
  const mails = (parcels: Partial<LocalParcel>[], onServer: string[] = []) =>
    depositMailRows(
      countDepositMails(parcels.map(parcel), new Set(onServer)),
      t,
    )[0]?.value;

  it('says what is left, per recipient, before what has left', () => {
    expect(
      mails([
        { status: 'depose', personId: 'a' },
        { status: 'depose', personId: 'a' },
        { status: 'notifie', personId: 'b' },
      ]),
    ).toBe('1 à envoyer');
  });

  it('says the server is on it, then that they left', () => {
    const row = parcel({ status: 'depose' });
    expect(mails([row], [row.id])).toBe('1 en cours d’envoi');
    expect(
      mails([
        { status: 'notifie', personId: 'a' },
        { status: 'notifie', personId: 'b' },
      ]),
    ).toBe('2 envoyés');
  });

  it('has no line for parcels held back', () => {
    expect(mails([{ status: 'a_regulariser' }])).toBeUndefined();
  });
});

describe('the pickup a phone mail quotes', () => {
  it('is the department’s with tours, and the company’s for a shuttle acting as department', async () => {
    const db = await openTestDatabase();
    const { readDepartmentPickups } =
      await import('#/features/settings/pickup');
    await db.department.put({
      id: 'finance',
      name: 'Finance',
      pickup: {
        place: 'Salle 12',
        hours: { mon: '', tue: '', wed: '', thu: '', fri: '' },
        instructions: '',
      },
      deletedAt: null,
    } as never);
    const profile = (shuttleActsAsDepartment: boolean) =>
      db.setting.put({
        id: 's',
        key: OPERATING_PROFILE_KEY,
        value: { shuttleActsAsDepartment, emailMoment: 'deposit' },
        deletedAt: null,
      } as never);
    await profile(true);
    expect((await readDepartmentPickups(db)).size).toBe(0);
    await profile(false);
    expect((await readDepartmentPickups(db)).get('finance')?.place).toBe(
      'Salle 12',
    );
  });
});

describe('the rule on the device', () => {
  let db: CourrierDatabase;
  beforeEach(async () => {
    db = await openTestDatabase();
  });

  it('reads a tour and its moment from the profile, nothing without one', async () => {
    const { noticeRule } = await import('#/features/parcels/tour');
    expect(await noticeRule(db)).toEqual({ tour: false, atScan: false });
    await db.setting.put({
      id: 's',
      key: OPERATING_PROFILE_KEY,
      value: { shuttleActsAsDepartment: false, emailMoment: 'deposit' },
      deletedAt: null,
    } as never);
    expect(await noticeRule(db)).toEqual({ tour: true, atScan: false });
  });
});
