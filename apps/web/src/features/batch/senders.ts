import { accountKey, carrierKey } from '@repo/contract/extract';
import { newId } from '@repo/shared/id';
import { normalizeName } from '@repo/shared/text';
import type { Upsert } from '#/features/db/commit';
import type {
  CourrierDatabase,
  DraftParcel,
  DraftSender,
  LocalSender,
  LocalSenderAccount,
} from '#/features/db/schema';

/**
 * The sender worth writing on the parcel (§4.4): sure, or prefilled to
 * verify; a bare guess leaves the field empty.
 */
export function promotedSender(draft: DraftParcel): DraftSender | null {
  const sender = draft.sender ?? null;
  return sender && sender.level !== 'none' ? sender : null;
}

export type LearnedSenders = {
  /** The `sender` rows first, then the accounts: the parcels point at them. */
  upserts: Upsert[];
  /** The sender row each sure draft ends up with, by draft id; `null` when its row is gone. */
  senderIds: Map<string, string | null>;
};

const newSender = (name: string, now: Date): LocalSender => ({
  id: newId(),
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  displayName: name,
  nameNorm: normalizeName(name),
  address: null,
  seenCount: 0,
  lastSeenAt: null,
});

const newAccount = (
  carrier: string,
  accountNumber: string,
  senderId: string,
  now: Date,
): LocalSenderAccount => ({
  id: newId(),
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  carrier,
  accountNumber,
  senderId,
  confirmations: 0,
});

/**
 * What "Terminer" teaches the dictionary (§4.8): a sender sure on a parcel
 * counts as seen once more, and the carrier account its codes carried is
 * confirmed for it, or created. A sender only to verify teaches nothing: the
 * agent has not validated it. An account already owned by another sender is
 * left as it is; a sure sender whose row was deleted meanwhile is dropped
 * from the parcel rather than pointed at.
 */
export async function learnSenders(
  db: CourrierDatabase,
  drafts: readonly DraftParcel[],
  now: Date,
): Promise<LearnedSenders> {
  const senders = new Map<string, LocalSender>();
  const accounts = new Map<string, LocalSenderAccount>();
  const senderIds = new Map<string, string | null>();

  const senderFor = async (
    name: string,
    id: string | null,
  ): Promise<LocalSender | null> => {
    const norm = normalizeName(name);
    if (norm === '') return null;
    const known = id ? senders.get(id) : undefined;
    if (known) return known;
    const existing = id
      ? await db.sender.get(id)
      : await db.sender
          .where('nameNorm')
          .equals(norm)
          .filter((row) => row.deletedAt === null)
          .first();
    if (existing && existing.deletedAt !== null) return null;
    const pooled = existing && senders.get(existing.id);
    if (pooled) return pooled;
    const byName = [...senders.values()].find((row) => row.nameNorm === norm);
    if (byName) return byName;
    const row = existing ?? newSender(name, now);
    senders.set(row.id, row);
    return row;
  };

  for (const draft of drafts) {
    const proposed = promotedSender(draft);
    if (!proposed || proposed.level !== 'sure') continue;
    const sender = await senderFor(proposed.name, proposed.id);
    senderIds.set(draft.id, sender?.id ?? null);
    if (!sender) continue;
    sender.seenCount += 1;
    sender.lastSeenAt = now;

    const read = proposed.account;
    if (!read) continue;
    const carrier = carrierKey(read.carrier);
    const number = accountKey(read.accountNumber);
    const key = `${carrier}\u0000${number}`;
    let account = accounts.get(key);
    if (!account) {
      const existing = await db.senderAccount
        .where('[carrier+accountNumber]')
        .equals([carrier, number])
        .filter((row) => row.deletedAt === null)
        .first();
      if (existing && existing.senderId !== sender.id) continue;
      account = existing ?? newAccount(carrier, number, sender.id, now);
      accounts.set(key, account);
    }
    if (account.senderId !== sender.id) continue;
    account.confirmations += 1;
  }

  return {
    upserts: [
      ...[...senders.values()].map((row) => ({
        entity: 'sender' as const,
        row,
      })),
      ...[...accounts.values()].map((row) => ({
        entity: 'sender_account' as const,
        row,
      })),
    ],
    senderIds,
  };
}
