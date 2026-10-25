import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type { ColisSection, Parcel, ParcelState } from '@repo/ui';

const t = createTranslator(DEFAULT_LOCALE);

export const SECTION_IDS = [
  'incomplete',
  'toNotify',
  'waiting',
  'handedOver',
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

const SECTIONS: {
  id: SectionId;
  title: string;
  states: readonly ParcelState[];
}[] = [
  {
    id: 'incomplete',
    title: t('colis.section.incomplete'),
    states: ['incomplete'],
  },
  { id: 'toNotify', title: t('colis.section.toNotify'), states: ['toNotify'] },
  {
    id: 'waiting',
    title: t('colis.section.waiting'),
    states: ['notified', 'late'],
  },
  {
    id: 'handedOver',
    title: t('colis.section.handedOver'),
    states: ['handedOver'],
  },
];

/** The titles `ColisScreen` folds, from the ids kept on the iPhone. */
export function sectionTitles(ids: readonly SectionId[]): string[] {
  return SECTIONS.filter(({ id }) => ids.includes(id)).map(
    ({ title }) => title,
  );
}

export function sectionId(title: string): SectionId | undefined {
  return SECTIONS.find((section) => section.title === title)?.id;
}

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
