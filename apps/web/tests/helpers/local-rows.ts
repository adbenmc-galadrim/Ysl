import { damageColumns } from '@repo/contract/parcel-damage';
import { newId } from '@repo/shared/id';
import {
  CourrierDatabase,
  type LocalContact,
  type LocalDirectoryPerson,
  type LocalParcel,
  type LocalSender,
  type LocalSenderAccount,
} from '#/features/db/schema';

export const NOW = new Date(2026, 9, 24, 12, 0);

/** A fresh database per test: fake-indexeddb keeps every name alive. */
export async function openTestDatabase(): Promise<CourrierDatabase> {
  const db = new CourrierDatabase(`test-${newId()}`);
  await db.open();
  return db;
}

export function parcelRow(overrides: Partial<LocalParcel> = {}): LocalParcel {
  return {
    id: newId(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    batchId: null,
    type: 'colis',
    status: 'recu',
    statusSeq: 0,
    carrier: 'UPS',
    tracking: '1ZE6344W0499230622',
    trackingNorm: '1ZE6344W0499230622',
    personId: null,
    contactId: null,
    readName: null,
    notificationEmail: null,
    department: null,
    senderId: null,
    senderName: null,
    pieceN: null,
    pieceTotal: null,
    weightKg: null,
    carrierService: null,
    reference: null,
    location: null,
    notes: null,
    ...damageColumns(null),
    receivedAt: new Date(2026, 9, 24, 10, 42),
    receivedBy: 'agent-1',
    validatedAt: null,
    notifiedAt: null,
    lastNotifiedAt: null,
    deliveredAt: null,
    deliveredBy: null,
    ...overrides,
  };
}

export function personRow(
  overrides: Partial<LocalDirectoryPerson> = {},
): LocalDirectoryPerson {
  return {
    id: newId(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    lastName: 'Morel',
    firstName: 'Camille',
    nameNorm: 'camille morel',
    email: 'camille@example.com',
    department: 'Studio',
    site: null,
    source: 'manuel',
    active: true,
    ...overrides,
  };
}

export function contactRow(
  overrides: Partial<LocalContact> = {},
): LocalContact {
  return {
    id: newId(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    name: 'Atelier Rive gauche',
    nameNorm: 'atelier rive gauche',
    email: null,
    department: null,
    createdBy: null,
    usageCount: 0,
    lastUsedAt: null,
    ...overrides,
  };
}

export function senderRow(overrides: Partial<LocalSender> = {}): LocalSender {
  return {
    id: newId(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    displayName: 'Metalworks SpA',
    nameNorm: 'metalworks spa',
    address: null,
    seenCount: 1,
    lastSeenAt: NOW,
    ...overrides,
  };
}

export function senderAccountRow(
  overrides: Partial<LocalSenderAccount> = {},
): LocalSenderAccount {
  return {
    id: newId(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    carrier: 'ups',
    accountNumber: 'E6344W',
    senderId: newId(),
    confirmations: 1,
    ...overrides,
  };
}
