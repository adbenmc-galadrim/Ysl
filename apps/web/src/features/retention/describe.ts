import {
  purgeTotals,
  RETENTION,
  type PurgeRun,
  type RetentionDuration,
} from '@repo/contract/retention';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type { SettingsGroup } from '@repo/ui';
import { formatWhen } from '#/features/parcels/record';

const t = createTranslator(DEFAULT_LOCALE);

export function formatDuration({ amount, unit }: RetentionDuration): string {
  const key = amount > 1 ? 'many' : 'one';
  return t(`privacy.duration.${unit}.${key}`, { count: amount });
}

export const retentionGroup: SettingsGroup = {
  header: t('privacy.retention.header'),
  items: [
    {
      icon: 'image',
      color: 'indigo',
      label: t('privacy.retention.photo'),
      subtitle: t('privacy.retention.photo.detail'),
      value: formatDuration(RETENTION.photo),
      chevron: false,
    },
    {
      icon: 'scan',
      color: 'sky',
      label: t('privacy.retention.extraction'),
      subtitle: t('privacy.retention.extraction.detail'),
      value: formatDuration(RETENTION.extraction),
      chevron: false,
    },
    {
      icon: 'package',
      color: 'ink',
      label: t('privacy.retention.parcel'),
      subtitle: t('privacy.retention.parcel.detail'),
      value: formatDuration(RETENTION.parcel),
      chevron: false,
    },
    {
      icon: 'sign',
      color: 'purple',
      label: t('privacy.retention.signature'),
      subtitle: t('privacy.retention.signature.detail'),
      value: formatDuration(RETENTION.signature),
      chevron: false,
    },
    {
      icon: 'user',
      color: 'orange',
      label: t('privacy.retention.contact'),
      subtitle: t('privacy.retention.contact.detail'),
      value: formatDuration(RETENTION.contact),
      chevron: false,
    },
  ],
};

type Counted =
  | 'privacy.purge.parcels'
  | 'privacy.purge.contacts'
  | 'privacy.purge.rows'
  | 'privacy.erase.pending';

export const counted = (key: Counted, count: number) =>
  t(`${key}.${count > 1 ? 'many' : 'one'}`, { count });

/** "Aujourd'hui à 3 h 00 : 38 colis retirés, 120 lignes traitées". */
export function describePurge(run: PurgeRun, now: Date): string {
  const { parcels, contacts, rows } = purgeTotals(run.counts);
  const parts = [
    parcels > 0 && counted('privacy.purge.parcels', parcels),
    contacts > 0 && counted('privacy.purge.contacts', contacts),
    rows > 0 && counted('privacy.purge.rows', rows),
  ].filter((part): part is string => typeof part === 'string');
  return t('privacy.purge.summary', {
    when: formatWhen(run.finishedAt ?? run.startedAt, now, t),
    what: parts.length ? parts.join(', ') : t('privacy.purge.nothing'),
  });
}
