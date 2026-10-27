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

/** The counters over the list (F32), each a filter: what is left to complete, to hand over, to chase. */
export const COUNTER_IDS = ['incomplete', 'waiting', 'late'] as const;

export type CounterId = (typeof COUNTER_IDS)[number];

const COUNTER_STATES: Record<CounterId, readonly ParcelState[]> = {
  incomplete: ['incomplete'],
  waiting: ['notified', 'late'],
  late: ['late'],
};

/** The rows a counter keeps; all of them with none on. */
export function filterRows(
  parcels: readonly Parcel[],
  counter: CounterId | null,
): Parcel[] {
  if (!counter) return [...parcels];
  return parcels.filter((parcel) =>
    COUNTER_STATES[counter].includes(parcel.state),
  );
}

/**
 * « À compléter 1 », « À retirer 3 », « En souffrance 1 »: the counters
 * worth a tap, those above zero, and the one on even when it fell to zero
 * so the agent can turn it off.
 */
export function counters(
  parcels: readonly Parcel[],
  on: CounterId | null,
): { id: CounterId; label: string; count: number }[] {
  return COUNTER_IDS.flatMap((id) => {
    const count = filterRows(parcels, id).length;
    return count > 0 || id === on
      ? [{ id, label: t(`colis.counter.${id}`), count }]
      : [];
  });
}
