import type { DamageInput } from '#/features/damage/report';
import type { DraftAnnex } from '#/features/scan/annex';
import type { OcrLine } from '@repo/ocr/worker';
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
  recipientAlias,
  sender,
  senderAccount,
  senderAlias,
  setting,
  SYNCED_ENTITIES,
} from '@repo/db/schema';
import type {
  ConfidenceLevel,
  FieldFlag,
  FieldSource,
  KnownRecipientAlias,
  SourceKind,
} from '@repo/contract/extract';
import type { RecipientKind } from '@repo/contract/recipient';
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
/** `challengerId` and `challenges` are missing on a row pulled before YSL-60: read them as none. */
export type LocalSenderAccount = Omit<
  LocalRow<typeof senderAccount.$inferSelect>,
  'challengerId' | 'challenges'
> & {
  challengerId?: string | null;
  challenges?: number;
};
export type LocalSenderAlias = LocalRow<typeof senderAlias.$inferSelect>;
export type LocalRecipientAlias = LocalRow<typeof recipientAlias.$inferSelect>;
export type LocalBatch = LocalRow<typeof batch.$inferSelect>;
/** `statusSeq` is missing on a row pulled before the column existed: read it as 0. */
export type LocalParcel = Omit<
  LocalRow<typeof parcel.$inferSelect>,
  'statusSeq'
> & {
  statusSeq?: number;
};
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
  sender_alias: LocalSenderAlias;
  recipient_alias: LocalRecipientAlias;
};

export type OutboxOpType = 'upsert' | 'delete';

/** `queued` waits for `sync.push`; `rejected` was refused for good (4xx) and waits for a correction. */
export type OutboxOpState = 'queued' | 'rejected';

/** One change waiting for `sync.push`, in the order it was made. */
export type OutboxOp = {
  seq: number;
  opId: string;
  entity: SyncedEntity;
  entityId: string;
  type: OutboxOpType;
  patch: Record<string, unknown>;
  clientTs: Date;
  state: OutboxOpState;
  attempts: number;
  lastError: string | null;
};

export const PHOTO_KINDS = ['etiquette', 'signature', 'dommage'] as const;
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

/** Where this device stands with the server (`sync_state` rows). */
export const SYNC_STATE_KEYS = {
  /** `SyncCursor`: the generation and the first transaction id not yet pulled. */
  cursor: 'cursor',
  /** `Date` of the last push and pull that both went through. */
  lastSyncAt: 'lastSyncAt',
} as const;

/** What the reader made of a draft's photo so far; `typed` came by hand. */
export type DraftReading =
  'pending' | 'read' | 'unreadable' | 'failed' | 'typed';

export type DraftSymbol = { format: string; text: string };

/**
 * The printed text: still to read, read, failed, or never read (no photo,
 * or a photo the reader could not open). A failure never fails the draft.
 */
export type DraftOcrState = 'pending' | 'done' | 'failed' | 'skipped';

/** A line as `@repo/ocr` read it, kept as is for the diagnostic and the bench. */
export type DraftOcrLine = OcrLine;

/** A batch being scanned on this device; it becomes a `batch` row at the end. */
export type DraftBatch = { id: string; startedAt: Date };

/**
 * A parcel delivered as several boxes (F20, §4.6): how many the label announces,
 * the pieces read so far (1-based), the key the pieces share (carrier and
 * shipment number, else the tracking number) and the photos of the pieces
 * after the first, which `photoId` holds.
 */
export type DraftPieces = {
  total: number;
  read: number[];
  key: string;
  photoIds: string[];
};

/**
 * The sender as the reader proposes it (F19, §4.5): named by a code, found
 * by its carrier account, matched to a sender already seen, or guessed from
 * the printed `FROM` block. `level` says how it shows (§4.4); `account` is
 * the carrier account the codes carried, which "Terminer" learns from.
 */
export type DraftSender = {
  name: string;
  /** The `sender` row it names, when the dictionary knows it. */
  id: string | null;
  level: ConfidenceLevel;
  /** The score behind `level`; absent on drafts stored before YSL-52. */
  confidence?: number;
  source: SourceKind;
  account: { carrier: string; accountNumber: string } | null;
  /** The `FROM` block as the OCR read it, which a correction teaches (§4.8); absent before YSL-60. */
  read?: string | null;
  /** The name comes from an alias the agent's corrections taught; absent before YSL-60. */
  alias?: boolean;
};

/**
 * Who the parcel is for, once settled (F18): a card of the directory or a
 * contact, chosen by the agent, or named by a code that matched one card
 * exactly. `name` is the card's name at the time.
 */
export type DraftRecipient = {
  kind: RecipientKind;
  id: string;
  name: string;
  source: 'code' | 'agent';
};

/**
 * A reserve set on a parcel still in the batch (YSL-53): it becomes the
 * parcel's columns and event at « Terminer »; its photos wait meanwhile
 * with `parcelId: null`, like the label's.
 */
export type DraftDamage = DamageInput & { at: Date; photoIds: string[] };

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
  /** The recipient a structured code named: sure enough to notify. */
  readName: string | null;
  symbols: DraftSymbol[];
  ocrState: DraftOcrState;
  /** The recipient the OCR guessed from the printed text: shown with a doubt. */
  ocrName: string | null;
  /** Every line read, in the frame of the 1 600 px working image. */
  ocrLines: DraftOcrLine[];
  /** Set when the label is one piece of several; absent on drafts stored before YSL-38. */
  pieces?: DraftPieces | null;
  /** The sender proposed so far; absent on drafts stored before YSL-40. */
  sender?: DraftSender | null;
  /** The annex fields (F20); absent on drafts stored before YSL-41. */
  annex?: DraftAnnex | null;
  /** The recipient settled; absent on drafts stored before YSL-46. */
  recipient?: DraftRecipient | null;
  /** The agent picked the tracking among the suggestions (§4.4); absent before YSL-52. */
  trackingConfirmed?: boolean;
  /** How long the codes and the text took to read, in ms; absent before YSL-52. */
  durations?: DraftDurations;
  /** The reserve on the parcel's state; absent on drafts stored before YSL-53. */
  damage?: DraftDamage | null;
  /** « Passer » in the batch review: saved « À compléter » as it stands (YSL-58). */
  reviewSkipped?: boolean;
  /** The card the agent chose before for the name this label prints (§4.8); absent before YSL-60. */
  learnedRecipient?: KnownRecipientAlias | null;
  /** The department typed with someone outside the directory (F27); absent before YSL-64. */
  department?: string | null;
};

export type DraftDurations = { codesMs?: number; ocrMs?: number };

/** A value the reader weighed for a field, with the sources behind it. */
export type ExtractionCandidate = {
  value: unknown;
  confidence: number;
  sources: FieldSource[];
};

/** A field as the reader scored it: its value, how sure, why, and from where (§4.3). */
export type ExtractionField = {
  value: unknown;
  confidence: number;
  level: ConfidenceLevel;
  flags: FieldFlag[];
  sources: FieldSource[];
  /** Every value the reader weighed, the agent's confirmation aside; absent before YSL-59. */
  candidates?: ExtractionCandidate[];
};

export type ExtractionFieldName =
  | 'tracking'
  | 'carrier'
  | 'recipient'
  | 'sender'
  | 'pieces'
  | 'weightKg'
  | 'service'
  | 'reference';

/**
 * What the reader made of a parcel's label (§8.2 `extraction`), kept on this
 * device for the diagnostic (F22) and the batch review: every field with its
 * sources and confidence, the codes as decoded, the printed text, the time
 * each step took. Not synced: the server has no table for it yet.
 */
export type LocalExtraction = {
  parcelId: string;
  /** The rules that scored the fields (`EXTRACTION_VERSION`). */
  version: number;
  fields: Partial<Record<ExtractionFieldName, ExtractionField>>;
  codes: DraftSymbol[];
  ocrText: string | null;
  durations: {
    codesMs: number | null;
    ocrMs: number | null;
    /** Scoring the fields at « Terminer »; absent before YSL-59. */
    fusionMs?: number | null;
  };
  provenance: 'device';
  createdAt: Date;
};

/** Indexes of the synced tables: the primary key, then what the app queries. */
const FIRST_SYNCED_STORES: Record<
  Exclude<SyncedEntity, keyof typeof ALIAS_STORES>,
  string
> = {
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

/** Version 4 (YSL-52): what the reader made of each parcel's label. */
const EXTRACTION_STORES = { extraction: 'parcelId, createdAt' };

/** Version 5 (YSL-54): the mails by where they stand, for their follow-up. */
const NOTIFICATION_V5 = {
  notification: 'id, personId, contactId, preparedAt, sentAt, status',
};

/** Version 6 (YSL-60): what the agent's corrections teach (§4.8). */
const ALIAS_STORES = {
  sender_alias: 'id, aliasNorm, senderId',
  recipient_alias: 'id, nameNorm, personId, contactId',
};

const SYNCED_STORES: Record<SyncedEntity, string> = {
  ...FIRST_SYNCED_STORES,
  ...ALIAS_STORES,
};

/** Version 3 (YSL-28): the outbox tells queued operations from rejected ones. */
const OUTBOX_V3 = {
  outbox: '++seq, &opId, [entity+entityId], clientTs, state',
};

export const SYNCED_TABLE_NAMES = Object.keys(SYNCED_STORES) as SyncedEntity[];

export class CourrierDatabase extends Dexie {
  directoryPerson!: Table<LocalDirectoryPerson, string>;
  contact!: Table<LocalContact, string>;
  sender!: Table<LocalSender, string>;
  senderAccount!: Table<LocalSenderAccount, string>;
  senderAlias!: Table<LocalSenderAlias, string>;
  recipientAlias!: Table<LocalRecipientAlias, string>;
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
  extraction!: Table<LocalExtraction, string>;

  constructor(name = DATABASE_NAME) {
    super(name);
    this.version(1).stores({ ...FIRST_SYNCED_STORES, ...LOCAL_STORES });
    this.version(2).stores(DRAFT_STORES);
    this.version(3)
      .stores(OUTBOX_V3)
      .upgrade((tx) =>
        tx
          .table('outbox')
          .toCollection()
          .modify((op: Partial<OutboxOp>) => {
            op.state ??= 'queued';
          }),
      );
    this.version(4).stores(EXTRACTION_STORES);
    this.version(5).stores(NOTIFICATION_V5);
    this.version(6).stores(ALIAS_STORES);
    this.directoryPerson = this.table('directory_person');
    this.contact = this.table('contact');
    this.sender = this.table('sender');
    this.senderAccount = this.table('sender_account');
    this.senderAlias = this.table('sender_alias');
    this.recipientAlias = this.table('recipient_alias');
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
    this.extraction = this.table('extraction');
  }

  /** The Dexie table of a synced entity, by its server name. */
  synced<Entity extends SyncedEntity>(
    entity: Entity,
  ): Table<SyncedRows[Entity], string> {
    return this.table(entity);
  }
}
