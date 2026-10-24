import type { SyncedEntity } from '@repo/contract/sync';
import {
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
} from '@repo/db/schema';

/** The drizzle table of each synced entity. */
export const SYNC_TABLES = {
  directory_person: directoryPerson,
  contact,
  sender,
  sender_account: senderAccount,
  batch,
  parcel,
  email_template: emailTemplate,
  notification,
  pickup_code: pickupCode,
  handover,
  event,
  setting,
} as const satisfies Record<SyncedEntity, unknown>;

export type SyncTable = (typeof SYNC_TABLES)[SyncedEntity];

export function tableOf(entity: SyncedEntity): SyncTable {
  return SYNC_TABLES[entity];
}
