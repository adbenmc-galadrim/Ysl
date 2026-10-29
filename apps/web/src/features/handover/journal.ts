import { normalizeName } from '@repo/shared/text';
import type { TranslateFn } from '@repo/shared/i18n';
import type {
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
  handedOf,
  handedParcel,
  type HandoverEntry,
  type HandoverSync,
  handoverSyncOf,
  METHOD_ICON,
  methodLabel,
} from '#/features/handover/entry';
import { formatTime, startOfDay } from '#/features/parcels/model';
import { formatWhen, handoverItems } from '#/features/parcels/record';
import { dayTitle } from '#/features/search/search-index';

/**
 * A handover of the journal: how many parcels it did hand over, and where
 * it stands with the server.
 */
export type JournalItem = {
  handover: LocalHandover;
  count: number;
  sync: HandoverSync;
};

/** Every handover on this iPhone, from every agent (§8.4), newest first. */
export async function loadJournal(
  db: CourrierDatabase,
): Promise<JournalItem[]> {
  const [handovers, ops] = await Promise.all([
    db.handover.filter((handover) => !handover.deletedAt).toArray(),
    db.outbox.filter((op) => op.entity === 'handover').toArray(),
  ]);
  const listed = await db.parcel.bulkGet([
    ...new Set(handovers.flatMap((handover) => handover.parcelIds)),
  ]);
  const parcels = new Map(
    listed.flatMap((parcel) => (parcel ? [[parcel.id, parcel]] : [])),
  );
  const opsOf = new Map<string, OutboxOp[]>();
  for (const op of ops) {
    opsOf.set(op.entityId, [...(opsOf.get(op.entityId) ?? []), op]);
  }
  return handovers
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .map((handover) => ({
      handover,
      count: handedOf(
        handover,
        handover.parcelIds.map((id) => parcels.get(id)),
      ).length,
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

function summaryOf({ handover, count }: JournalItem, t: TranslateFn): string {
  const summary = t('journal.summary', {
    count,
    method: methodLabel(handover.method, t),
  });
  return handover.delegateName
    ? t('journal.delegate', { summary, name: handover.delegateName })
    : summary;
}

export const lowerFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1);

function stateOf({ handover, sync }: JournalItem, now: Date, t: TranslateFn) {
  if (handover.cancelledAt) {
    return {
      state: 'cancelled' as const,
      status:
        startOfDay(handover.cancelledAt).getTime() ===
        startOfDay(handover.at).getTime()
          ? t('journal.cancelled', { time: formatTime(handover.cancelledAt) })
          : t('journal.cancelledLater', {
              when: lowerFirst(formatWhen(handover.cancelledAt, now, t)),
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

export function journalRow(
  item: JournalItem,
  now: Date,
  t: TranslateFn,
  me?: string,
): JournalRemise {
  const { handover } = item;
  return {
    id: handover.id,
    recipient: handover.recipientName,
    icon: METHOD_ICON[handover.method],
    summary: summaryOf(item, t),
    detail: t('journal.detail', {
      time: formatTime(handover.at),
      agent: agentNameOf(handover, t, me),
    }),
    ...stateOf(item, now, t),
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
  me?: string,
): JournalRemisesSection[] {
  const sections: JournalRemisesSection[] = [];
  for (const item of items) {
    if (!matchesQuery(item.handover, query)) continue;
    const title = dayTitle(startOfDay(item.handover.at), now, t);
    const row = journalRow(item, now, t, me);
    const last = sections.at(-1);
    if (last?.title === title) last.entries.push(row);
    else sections.push({ title, entries: [row] });
  }
  return sections;
}

/** One handover, opened from the journal or a parcel's record. */
export function describeHandoverDetail(
  { handover, parcels, sync, proofs }: HandoverEntry,
  now: Date,
  t: TranslateFn,
  me?: string,
): Omit<RemiseDetailScreenProps, 'onBack' | 'onParcel' | 'media'> {
  const items = handoverItems(
    handover,
    sync,
    { now, t, me },
    { cancelled: false, here: proofs },
  );
  const when = handover.cancelledAt && formatWhen(handover.cancelledAt, now, t);
  return {
    title: t('handover.confirm.title', { count: parcels.length }),
    subtitle: t('journal.to', { name: handover.recipientName }),
    ...(when
      ? {
          cancelled: t('journal.cancelledOn', { when: lowerFirst(when) }),
        }
      : {}),
    items,
    parcels: parcels.map((parcel) => handedParcel(parcel, t)),
  };
}
