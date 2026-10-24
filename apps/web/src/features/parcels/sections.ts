import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type { ColisSection, Parcel, ParcelState } from '@repo/ui';

const t = createTranslator(DEFAULT_LOCALE);

const SECTIONS: { title: string; states: readonly ParcelState[] }[] = [
  { title: t('colis.section.incomplete'), states: ['incomplete'] },
  { title: t('colis.section.toNotify'), states: ['toNotify'] },
  { title: t('colis.section.waiting'), states: ['notified', 'late'] },
  { title: t('colis.section.handedOver'), states: ['handedOver'] },
];

const TODO_STATES: readonly ParcelState[] = ['incomplete', 'toNotify'];

/** The home list: one section per thing left to do, in the order of the day. */
export function toSections(parcels: readonly Parcel[]): ColisSection[] {
  return SECTIONS.flatMap(({ title, states }) => {
    const rows = parcels.filter((parcel) => states.includes(parcel.state));
    return rows.length ? [{ title, parcels: rows }] : [];
  });
}

export function summarize(parcels: readonly Parcel[]) {
  if (!parcels.length) return t('colis.summary.empty');
  const todo = parcels.filter((parcel) =>
    TODO_STATES.includes(parcel.state),
  ).length;
  return t('colis.summary', { count: parcels.length, todo });
}
