import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type { ColisSection, Parcel, ParcelState } from '@repo/ui';

const t = createTranslator(DEFAULT_LOCALE);

export const SECTION_IDS = [
  'replies',
  'incomplete',
  'toSettle',
  'toNotify',
  'toDispatch',
  'onTour',
  'waiting',
  'handedOver',
  'present',
  'coming',
  'returning',
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

const SECTIONS: {
  id: SectionId;
  title: string;
  states: readonly ParcelState[];
}[] = [
  // Every state: a parcel with an answer standing is listed here, first.
  {
    id: 'replies',
    title: t('colis.section.replies'),
    states: ['incomplete', 'toNotify', 'notified', 'handedOver', 'returned'],
  },
  {
    id: 'incomplete',
    title: t('colis.section.incomplete'),
    states: ['incomplete'],
  },
  { id: 'toSettle', title: t('colis.section.toSettle'), states: ['toSettle'] },
  {
    id: 'returning',
    title: t('colis.section.returning'),
    states: ['returning'],
  },
  {
    id: 'toNotify',
    title: t('colis.section.toNotify'),
    states: ['toNotify', 'deposited'],
  },
  {
    id: 'toDispatch',
    title: t('colis.section.toDispatch'),
    states: ['toDispatch'],
  },
  { id: 'onTour', title: t('colis.section.onTour'), states: ['onTour'] },
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

/** The phone of a department (maquette 03): what is here, then what is coming. */
const DEPARTMENT_SECTIONS: typeof SECTIONS = [
  // « À compléter » stays apart: with a tour such a parcel is still to come.
  ...SECTIONS.filter(({ id }) =>
    ['replies', 'incomplete', 'toNotify'].includes(id),
  ),
  {
    id: 'present',
    title: t('departmentSpace.section.present'),
    states: ['notified', 'late'],
  },
  ...SECTIONS.filter(({ id }) => id === 'toSettle'),
  {
    id: 'coming',
    title: t('departmentSpace.section.coming'),
    states: ['toDispatch', 'onTour'],
  },
  ...SECTIONS.filter(({ id }) => id === 'returning'),
];

const ALL_SECTIONS = [
  ...SECTIONS,
  ...DEPARTMENT_SECTIONS.filter((section) => !SECTIONS.includes(section)),
];

/** The titles `ColisScreen` folds, from the ids kept on the iPhone. */
export function sectionTitles(ids: readonly SectionId[]): string[] {
  return ALL_SECTIONS.filter(({ id }) => ids.includes(id)).map(
    ({ title }) => title,
  );
}

export function sectionId(title: string): SectionId | undefined {
  return ALL_SECTIONS.find((section) => section.title === title)?.id;
}

const TODO_STATES: readonly ParcelState[] = [
  'incomplete',
  'toSettle',
  'toNotify',
  'toDispatch',
];

/**
 * The home list: one section per thing left to do, in the order of the day;
 * the recipients' answers on top (maquette 09 « Réponses des salariés »),
 * each parcel listed once.
 */
export function toSections(
  parcels: readonly Parcel[],
  sections: typeof SECTIONS = SECTIONS,
): ColisSection[] {
  return sections.flatMap(({ id, title, states }) => {
    const rows = parcels.filter(
      (parcel) =>
        states.includes(parcel.state) &&
        (id === 'replies') === (parcel.reply !== undefined),
    );
    return rows.length ? [{ title, parcels: rows }] : [];
  });
}

export const toDepartmentSections = (parcels: readonly Parcel[]) =>
  toSections(parcels, DEPARTMENT_SECTIONS);

/** « Studio · 12 présents, 6 à venir ». */
export const summarizeDepartment = (
  { present, coming }: { present: number; coming: number },
  name: string,
) =>
  t('departmentSpace.summary', {
    name,
    present: t(
      present === 1
        ? 'departmentSpace.summary.present.one'
        : 'departmentSpace.summary.present',
      { count: present },
    ),
    coming,
  });

export function summarize(parcels: readonly Parcel[]) {
  if (!parcels.length) return t('colis.summary.empty');
  const todo = parcels.filter((parcel) =>
    TODO_STATES.includes(parcel.state),
  ).length;
  return t('colis.summary', { count: parcels.length, todo });
}

/**
 * The counters over the list (F32, F37), each a filter: what is left to
 * complete, to hand over, to remind, to chase.
 */
const COUNTER_IDS = ['incomplete', 'waiting', 'remind', 'late'] as const;

export type CounterId = (typeof COUNTER_IDS)[number];

/** A home row, and whether a reminder is due for its parcel (`HomeParcel`). */
type CountedRow = Parcel & { remindDue?: boolean };

/** At the department, to be collected: « À retirer » here, « En attente de retrait » on the overview. */
export const awaitsPickup = (state: ParcelState): boolean =>
  state === 'deposited' || state === 'notified' || state === 'late';

const COUNTER_ROWS: Record<CounterId, (row: CountedRow) => boolean> = {
  incomplete: (row) => row.state === 'incomplete',
  waiting: (row) => awaitsPickup(row.state),
  remind: (row) => row.remindDue === true,
  late: (row) => row.state === 'late',
};

/** The rows a counter keeps; all of them with none on. */
export function filterRows<Row extends CountedRow>(
  parcels: readonly Row[],
  counter: CounterId | null,
): Row[] {
  if (!counter) return [...parcels];
  return parcels.filter(COUNTER_ROWS[counter]);
}

/**
 * « À compléter 1 », « À retirer 3 », « À relancer 2 », « En souffrance 1 »: the counters
 * worth a tap, those above zero, and the one on even when it fell to zero
 * so the agent can turn it off.
 */
export function counters(
  parcels: readonly CountedRow[],
  on: CounterId | null,
): { id: CounterId; label: string; count: number }[] {
  return COUNTER_IDS.flatMap((id) => {
    const count = filterRows(parcels, id).length;
    return count > 0 || id === on
      ? [{ id, label: t(`colis.counter.${id}`), count }]
      : [];
  });
}
