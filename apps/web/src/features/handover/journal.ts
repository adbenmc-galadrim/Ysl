import { normalizeName } from '@repo/shared/text';
import type { TranslateFn } from '@repo/shared/i18n';
import type {
  DetailsItem,
  JournalRemise,
  JournalRemisesSection,
  RemiseDetailScreenProps,
} from '@repo/ui';
import type {
  CourrierDatabase,
  LocalHandover,
  OutboxOp,
} from '#/features/db/schema';
import {
  agentNameOf,
  handedParcel,
  type HandoverEntry,
  type HandoverSync,
  handoverSyncOf,
  METHOD_ICON,
  methodLabel,
} from '#/features/handover/entry';
import { DAY_MS, formatTime, startOfDay } from '#/features/parcels/model';
import { formatWhen } from '#/features/parcels/record';

/** A handover of the journal, with where it stands with the server. */
export type JournalItem = { handover: LocalHandover; sync: HandoverSync };

/** Every handover on this iPhone, from every agent (§8.4), newest first. */
export async function loadJournal(
  db: CourrierDatabase,
): Promise<JournalItem[]> {
  const [handovers, ops] = await Promise.all([
    db.handover.filter((handover) => !handover.deletedAt).toArray(),
    db.outbox.filter((op) => op.entity === 'handover').toArray(),
  ]);
  const opsOf = new Map<string, OutboxOp[]>();
  for (const op of ops) {
    opsOf.set(op.entityId, [...(opsOf.get(op.entityId) ?? []), op]);
  }
  return handovers
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .map((handover) => ({
      handover,
      sync: handoverSyncOf(opsOf.get(handover.id) ?? []),
    }));
}

/** Found by the employee who collected, the colleague who did for them, or the agent. */
export function matchesQuery(handover: LocalHandover, query: string): boolean {
  const wanted = normalizeName(query);
  if (!wanted) return true;
  return [handover.recipientName, handover.delegateName, handover.agentName]
    .flatMap((name) => (name ? [normalizeName(name)] : []))
    .some((name) => name.includes(wanted));
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const yearFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** « Aujourd’hui », « Hier », « Lundi 26 octobre », « 3 mars 2025 ». */
export function dayTitle(date: Date, now: Date, t: TranslateFn): string {
  const today = startOfDay(now);
  if (date >= today) return t('journal.today');
  if (date.getTime() >= today.getTime() - DAY_MS) return t('journal.yesterday');
  const text =
    date.getFullYear() === now.getFullYear()
      ? dayFormat.format(date)
      : yearFormat.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function summaryOf(handover: LocalHandover, t: TranslateFn): string {
  const summary = t('journal.summary', {
    count: handover.parcelIds.length,
    method: methodLabel(handover.method, t),
  });
  return handover.delegateName
    ? t('journal.delegate', { summary, name: handover.delegateName })
    : summary;
}

function stateOf({ handover, sync }: JournalItem, t: TranslateFn) {
  if (handover.cancelledAt) {
    return {
      state: 'cancelled' as const,
      status: t('journal.cancelled', {
        time: formatTime(handover.cancelledAt),
      }),
    };
  }
  if (sync === 'rejected') {
    return { state: 'rejected' as const, status: t('journal.rejected') };
  }
  if (sync === 'unsent') {
    return { state: 'unsent' as const, status: t('journal.unsent') };
  }
  return { state: 'done' as const };
}

export function journalRow(item: JournalItem, t: TranslateFn): JournalRemise {
  const { handover } = item;
  return {
    id: handover.id,
    recipient: handover.recipientName,
    icon: METHOD_ICON[handover.method],
    summary: summaryOf(handover, t),
    detail: t('journal.detail', {
      time: formatTime(handover.at),
      agent: agentNameOf(handover, t),
    }),
    ...stateOf(item, t),
  };
}

/**
 * The journal as the screen lists it: the handovers that match the search,
 * one section per day, the newest first.
 */
export function journalSections(
  items: readonly JournalItem[],
  query: string,
  now: Date,
  t: TranslateFn,
): JournalRemisesSection[] {
  const sections: JournalRemisesSection[] = [];
  for (const item of items) {
    if (!matchesQuery(item.handover, query)) continue;
    const title = dayTitle(item.handover.at, now, t);
    const last = sections.at(-1);
    if (last?.title === title) last.entries.push(journalRow(item, t));
    else sections.push({ title, entries: [journalRow(item, t)] });
  }
  return sections;
}

/** One handover, opened from the journal or a parcel's record. */
export function describeHandoverDetail(
  { handover, parcels, sync }: HandoverEntry,
  now: Date,
  t: TranslateFn,
): Omit<RemiseDetailScreenProps, 'onBack' | 'onParcel' | 'children'> {
  const items: DetailsItem[] = [
    ...(handover.delegateName
      ? [{ label: t('record.handover.delegate'), value: handover.delegateName }]
      : []),
    {
      label: t('record.handover.when'),
      value: formatWhen(handover.at, now, t),
    },
    { label: t('record.handover.agent'), value: agentNameOf(handover, t) },
    {
      label: t('record.handover.method'),
      value: methodLabel(handover.method, t),
    },
    { label: t('record.detail.sync'), value: t(`record.sync.${sync}`) },
  ];
  const when = handover.cancelledAt && formatWhen(handover.cancelledAt, now, t);
  return {
    title: t('handover.confirm.title', { count: handover.parcelIds.length }),
    subtitle: t('journal.to', { name: handover.recipientName }),
    ...(when
      ? {
          cancelled: t('journal.cancelledOn', {
            when: when.charAt(0).toLowerCase() + when.slice(1),
          }),
        }
      : {}),
    items,
    parcels: parcels.map((parcel) => handedParcel(parcel, t)),
  };
}
