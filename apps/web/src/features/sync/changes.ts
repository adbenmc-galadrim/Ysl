import type { TranslateFn } from '@repo/shared/i18n';
import type { SettingsItem } from '@repo/ui';
import { SYNCED_ENTITIES } from '@repo/contract/sync';
import type {
  CourrierDatabase,
  OutboxOp,
  SyncedEntity,
  SyncedRows,
} from '#/features/db/schema';
import { formatTime, startOfDay } from '#/features/parcels/model';

/** One operation of the outbox with the row it concerns, as this device holds it. */
export type WaitingChange<Entity extends SyncedEntity = SyncedEntity> = {
  op: OutboxOp;
  row: SyncedRows[Entity] | null;
};

const isSynced = (entity: string): entity is SyncedEntity =>
  (SYNCED_ENTITIES as readonly string[]).includes(entity);

/**
 * Everything still to send or refused, oldest first: what the export carries.
 * An operation on an entity this build does not know (written by a newer
 * app, read after a downgrade) keeps its place with no row: the export is
 * the safety net, it must never fail on it.
 */
export async function listWaitingChanges(
  db: CourrierDatabase,
): Promise<WaitingChange[]> {
  const ops = await db.outbox.orderBy('clientTs').toArray();
  const rows = await Promise.all(
    ops.map(async (op) =>
      isSynced(op.entity) ? db.synced(op.entity).get(op.entityId) : null,
    ),
  );
  return ops.map((op, index) => ({ op, row: rows[index] ?? null }));
}

const ENTITY_ROW: Record<SyncedEntity, Pick<SettingsItem, 'icon' | 'color'>> = {
  parcel: { icon: 'package', color: 'ink' },
  batch: { icon: 'inbox', color: 'ink' },
  directory_person: { icon: 'user', color: 'indigo' },
  contact: { icon: 'user', color: 'indigo' },
  sender: { icon: 'send', color: 'grey' },
  sender_account: { icon: 'send', color: 'grey' },
  email_template: { icon: 'mail', color: 'blue' },
  notification: { icon: 'mail', color: 'blue' },
  pickup_code: { icon: 'qr', color: 'green' },
  handover: { icon: 'check', color: 'green' },
  event: { icon: 'clock', color: 'grey' },
  setting: { icon: 'list', color: 'grey' },
  sender_alias: { icon: 'send', color: 'grey' },
  recipient_alias: { icon: 'user', color: 'indigo' },
};

const dayFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

/** "10 h 42" today, "23 oct. 10 h 42" before. */
export function formatChangeTime(at: Date, now: Date): string {
  if (at >= startOfDay(now)) return formatTime(at);
  return `${dayFormat.format(at)} ${formatTime(at)}`;
}

type Subject = { label: string; subtitle?: string };

function subject({ op, row }: WaitingChange, t: TranslateFn): Subject {
  switch (op.entity as string) {
    case 'parcel': {
      const parcel = row as SyncedRows['parcel'] | null;
      return {
        label: parcel?.tracking
          ? t('sync.change.parcel', { tracking: parcel.tracking.slice(-4) })
          : t('sync.change.entity.parcel'),
        subtitle: parcel?.readName ?? undefined,
      };
    }
    case 'directory_person': {
      const person = row as SyncedRows['directory_person'] | null;
      return {
        label: t('sync.change.entity.directory_person'),
        subtitle: person ? `${person.firstName} ${person.lastName}` : undefined,
      };
    }
    case 'contact':
      return {
        label: t('sync.change.entity.contact'),
        subtitle: (row as SyncedRows['contact'] | null)?.name,
      };
    case 'sender':
      return {
        label: t('sync.change.entity.sender'),
        subtitle: (row as SyncedRows['sender'] | null)?.displayName,
      };
    case 'handover':
      return {
        label: t('sync.change.entity.handover'),
        subtitle: (row as SyncedRows['handover'] | null)?.recipientName,
      };
    case 'email_template':
      return {
        label: t('sync.change.entity.email_template'),
        subtitle: (row as SyncedRows['email_template'] | null)?.name,
      };
    case 'setting':
      return { label: t('sync.change.entity.setting') };
    case 'batch':
      return { label: t('sync.change.entity.batch') };
    case 'sender_account':
      return { label: t('sync.change.entity.sender_account') };
    case 'sender_alias':
      return { label: t('sync.change.entity.sender_alias') };
    case 'recipient_alias':
      return { label: t('sync.change.entity.recipient_alias') };
    case 'notification':
      return { label: t('sync.change.entity.notification') };
    case 'pickup_code':
      return { label: t('sync.change.entity.pickup_code') };
    case 'event':
      return { label: t('sync.change.entity.event') };
    default:
      return { label: t('sync.change.entity.unknown') };
  }
}

/** The Réglages row of a waiting change: what it is, when it was made, or that it was refused. */
export function describeChange(
  change: WaitingChange,
  t: TranslateFn,
  now = new Date(),
): SettingsItem {
  const { op } = change;
  const { label, subtitle } = subject(change, t);
  return {
    key: op.opId,
    ...(ENTITY_ROW[op.entity] ?? { icon: 'list', color: 'grey' }),
    label: op.type === 'delete' ? t('sync.change.deleted', { label }) : label,
    subtitle,
    value:
      op.state === 'rejected'
        ? t('sync.change.rejected')
        : formatChangeTime(op.clientTs, now),
    chevron: false,
  };
}
