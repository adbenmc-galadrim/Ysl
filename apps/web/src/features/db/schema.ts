import type {
  batch,
  contact,
  directoryPerson,
  emailTemplate,
  event,
  handover,
  notification,
  parcel,
  pickupCode,
  sender,
  senderAccount,
  setting,
  SYNCED_ENTITIES,
} from '@repo/db/schema';
import { Dexie, type EntityTable, type Table } from 'dexie';

export const DATABASE_NAME = 'courrier';

export type SyncedEntity = (typeof SYNCED_ENTITIES)[number];

/**
 * A synced row as this device holds it: the server shape without the
 * organization (one device serves one mailroom; the server stamps it on push)
 * and with the transaction id only once the row came back through a pull.
 */
export type LocalRow<Row> = Omit<Row, 'organizationId' | 'serverXid'> & {
  serverXid?: number;
};

export type LocalDirectoryPerson = LocalRow<
  typeof directoryPerson.$inferSelect
>;
export type LocalContact = LocalRow<typeof contact.$inferSelect>;
export type LocalSender = LocalRow<typeof sender.$inferSelect>;
export type LocalSenderAccount = LocalRow<typeof senderAccount.$inferSelect>;
export type LocalBatch = LocalRow<typeof batch.$inferSelect>;
export type LocalParcel = LocalRow<typeof parcel.$inferSelect>;
export type LocalEmailTemplate = LocalRow<typeof emailTemplate.$inferSelect>;
export type LocalNotification = LocalRow<typeof notification.$inferSelect>;
export type LocalPickupCode = LocalRow<typeof pickupCode.$inferSelect>;
export type LocalHandover = LocalRow<typeof handover.$inferSelect>;
export type LocalEvent = LocalRow<typeof event.$inferSelect>;
export type LocalSetting = LocalRow<typeof setting.$inferSelect>;

export type SyncedRows = {
  directory_person: LocalDirectoryPerson;
  contact: LocalContact;
  sender: LocalSender;
  sender_account: LocalSenderAccount;
  batch: LocalBatch;
  parcel: LocalParcel;
  email_template: LocalEmailTemplate;
  notification: LocalNotification;
  pickup_code: LocalPickupCode;
  handover: LocalHandover;
  event: LocalEvent;
  setting: LocalSetting;
};

export type OutboxOpType = 'upsert' | 'delete';

/** One change waiting for `sync.push`, in the order it was made. */
export type OutboxOp = {
  seq: number;
  opId: string;
  entity: SyncedEntity;
  entityId: string;
  type: OutboxOpType;
  patch: Record<string, unknown>;
  clientTs: Date;
  attempts: number;
  lastError: string | null;
};

export const PHOTO_KINDS = ['etiquette', 'signature'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/** A photo kept on this iPhone only: the file lives in OPFS, never here. */
export type LocalPhoto = {
  id: string;
  parcelId: string | null;
  kind: PhotoKind;
  path: string;
  sha256: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: Date;
};

export type SyncStateEntry = { key: string; value: unknown };

/** What the reader made of a draft's photo so far. */
export type DraftReading = 'pending' | 'read' | 'unreadable' | 'failed';

export type DraftSymbol = { format: string; text: string };

/** A batch being scanned on this device; it becomes a `batch` row at the end. */
export type DraftBatch = { id: string; startedAt: Date };

/**
 * A parcel of the batch in progress: one tap, one photo, the reading when
 * it lands. Local only, never queued; `finishBatch` turns it into a parcel.
 */
export type DraftParcel = {
  id: string;
  batchId: string;
  createdAt: Date;
  photoId: string | null;
  reading: DraftReading;
  carrier: string | null;
  tracking: string | null;
  trackingNorm: string | null;
  readName: string | null;
  symbols: DraftSymbol[];
};

/** Indexes of the synced tables: the primary key, then what the app queries. */
const SYNCED_STORES: Record<SyncedEntity, string> = {
  directory_person: 'id, nameNorm, email',
  contact: 'id, nameNorm, email',
  sender: 'id, nameNorm',
  sender_account: 'id, [carrier+accountNumber], senderId',
  batch: 'id, agentId, startedAt',
  parcel:
    'id, [status+receivedAt], trackingNorm, batchId, personId, contactId, deliveredAt',
  email_template: 'id, type',
  notification: 'id, personId, contactId, preparedAt, sentAt',
  pickup_code: 'id, personId, contactId, tokenHash, expiresAt',
  handover: 'id, personId, contactId, at',
  event: 'id, [entity+entityId], at',
  setting: 'id, key',
};

const LOCAL_STORES = {
  outbox: '++seq, &opId, [entity+entityId], clientTs',
  photo: 'id, parcelId, kind, createdAt',
  sync_state: 'key',
};

/** Version 2 (YSL-23): the batch in progress and its draft parcels. */
const DRAFT_STORES = {
  draft_batch: 'id, startedAt',
  draft_parcel: 'id, batchId, createdAt, trackingNorm',
};

export const SYNCED_TABLE_NAMES = Object.keys(SYNCED_STORES) as SyncedEntity[];

export class CourrierDatabase extends Dexie {
  directoryPerson!: Table<LocalDirectoryPerson, string>;
  contact!: Table<LocalContact, string>;
  sender!: Table<LocalSender, string>;
  senderAccount!: Table<LocalSenderAccount, string>;
  batch!: Table<LocalBatch, string>;
  parcel!: Table<LocalParcel, string>;
  emailTemplate!: Table<LocalEmailTemplate, string>;
  notification!: Table<LocalNotification, string>;
  pickupCode!: Table<LocalPickupCode, string>;
  handover!: Table<LocalHandover, string>;
  event!: Table<LocalEvent, string>;
  setting!: Table<LocalSetting, string>;
  outbox!: EntityTable<OutboxOp, 'seq'>;
  photo!: Table<LocalPhoto, string>;
  syncState!: Table<SyncStateEntry, string>;
  draftBatch!: Table<DraftBatch, string>;
  draftParcel!: Table<DraftParcel, string>;

  constructor(name = DATABASE_NAME) {
    super(name);
    this.version(1).stores({ ...SYNCED_STORES, ...LOCAL_STORES });
    this.version(2).stores(DRAFT_STORES);
    this.directoryPerson = this.table('directory_person');
    this.contact = this.table('contact');
    this.sender = this.table('sender');
    this.senderAccount = this.table('sender_account');
    this.batch = this.table('batch');
    this.parcel = this.table('parcel');
    this.emailTemplate = this.table('email_template');
    this.notification = this.table('notification');
    this.pickupCode = this.table('pickup_code');
    this.handover = this.table('handover');
    this.event = this.table('event');
    this.setting = this.table('setting');
    this.outbox = this.table('outbox');
    this.photo = this.table('photo');
    this.syncState = this.table('sync_state');
    this.draftBatch = this.table('draft_batch');
    this.draftParcel = this.table('draft_parcel');
  }

  /** The Dexie table of a synced entity, by its server name. */
  synced<Entity extends SyncedEntity>(
    entity: Entity,
  ): Table<SyncedRows[Entity], string> {
    return this.table(entity);
  }
}
