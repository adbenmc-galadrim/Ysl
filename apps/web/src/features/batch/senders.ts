import { accountKey, aliasKey, carrierKey } from '@repo/contract/extract';
import { newId } from '@repo/shared/id';
import { normalizeName } from '@repo/shared/text';
import type { Upsert } from '#/features/db/commit';
import type {
  CourrierDatabase,
  DraftParcel,
  DraftSender,
  LocalSender,
  LocalSenderAccount,
  LocalSenderAlias,
} from '#/features/db/schema';

/**
 * The sender worth writing on the parcel (§4.4): sure, or prefilled to
 * verify; a bare guess leaves the field empty.
 */
export function promotedSender(draft: DraftParcel): DraftSender | null {
  const sender = draft.sender ?? null;
  return sender && sender.level !== 'none' ? sender : null;
}

/**
 * Corrections of the agent that agree before a carrier account another
 * sender owns moves to theirs (§4.8): one slip of the finger is not enough
 * to undo what earlier parcels taught.
 */
export const ACCOUNT_REATTRIBUTION = 2;

export type LearnedSenders = {
  /** The `sender` rows first, then the accounts and the aliases: they point at them. */
  upserts: Upsert[];
  /** The sender row each sure draft ends up with, by draft id; `null` when its row is gone. */
  senderIds: Map<string, string | null>;
};

/** What one parcel teaches about its sender. */
export type SenderLesson = {
  name: string;
  /** The `sender` row the name came with, when the dictionary knew it. */
  id: string | null;
  /** The carrier account the label's codes carried. */
  account: { carrier: string; accountNumber: string } | null;
  /** The `FROM` block as the OCR read it. */
  read: string | null;
  /** The agent typed, kept or corrected the name (§4.3 rank 9). */
  byAgent: boolean;
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
  challengerId: null,
  challenges: 0,
});

const newAlias = (
  aliasNorm: string,
  senderId: string,
  now: Date,
): LocalSenderAlias => ({
  id: newId(),
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  aliasNorm,
  senderId,
  confirmations: 0,
});

/**
 * The account confirmed for its owner, or contested by the agent: a
 * correction naming another sender counts for that one, and the account
 * moves at the second correction that agrees. A sender only a code or the
 * dictionary named never contests: it may be the label's mistake.
 */
function teachAccount(
  account: LocalSenderAccount,
  senderId: string,
  byAgent: boolean,
): boolean {
  if (account.senderId === senderId) {
    account.confirmations += 1;
    account.challengerId = null;
    account.challenges = 0;
    return true;
  }
  if (!byAgent) return false;
  const challenges =
    account.challengerId === senderId ? (account.challenges ?? 0) + 1 : 1;
  if (challenges >= ACCOUNT_REATTRIBUTION) {
    account.senderId = senderId;
    account.confirmations = challenges;
    account.challengerId = null;
    account.challenges = 0;
  } else {
    account.challengerId = senderId;
    account.challenges = challenges;
  }
  return true;
}

/**
 * What the parcels of one write teach the sender dictionary (§4.8), pooled
 * so that two parcels of a batch count on the same rows: the sender seen
 * once more, its carrier account, and the OCR text the agent took for it.
 */
export function senderLessons(db: CourrierDatabase, now: Date) {
  const senders = new Map<string, LocalSender>();
  const accounts = new Map<string, LocalSenderAccount>();
  const aliases = new Map<string, LocalSenderAlias>();
  const changed = new Set<object>();

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

  const accountFor = async (carrier: string, number: string) => {
    const key = `${carrier}\u0000${number}`;
    const pooled = accounts.get(key);
    if (pooled) return pooled;
    const existing = await db.senderAccount
      .where('[carrier+accountNumber]')
      .equals([carrier, number])
      .filter((row) => row.deletedAt === null)
      .first();
    const row = existing ?? null;
    if (row) accounts.set(key, row);
    return row;
  };

  const aliasFor = async (key: string) => {
    const pooled = aliases.get(key);
    if (pooled) return pooled;
    const rows = await db.senderAlias
      .where('aliasNorm')
      .equals(key)
      .filter((row) => row.deletedAt === null)
      .toArray();
    const best = rows.sort((a, b) => b.confirmations - a.confirmations)[0];
    if (best) aliases.set(key, best);
    return best ?? null;
  };

  const touch = <Row extends { updatedAt: Date }>(row: Row) => {
    row.updatedAt = now;
    changed.add(row);
  };

  return {
    /** Learns one parcel's sender; the row it ends up with, `null` when that row is gone. */
    async learn(lesson: SenderLesson): Promise<LocalSender | null> {
      const sender = await senderFor(lesson.name, lesson.id);
      if (!sender) return null;
      sender.seenCount += 1;
      sender.lastSeenAt = now;
      touch(sender);

      const read = lesson.account;
      if (read) {
        const carrier = carrierKey(read.carrier);
        const number = accountKey(read.accountNumber);
        const account = await accountFor(carrier, number);
        if (!account) {
          const row = newAccount(carrier, number, sender.id, now);
          row.confirmations = 1;
          accounts.set(`${carrier}\u0000${number}`, row);
          touch(row);
        } else if (teachAccount(account, sender.id, lesson.byAgent)) {
          touch(account);
        }
      }

      const key = lesson.byAgent && lesson.read ? aliasKey(lesson.read) : '';
      if (key !== '' && key !== sender.nameNorm) {
        const alias = await aliasFor(key);
        if (!alias) {
          const row = newAlias(key, sender.id, now);
          row.confirmations = 1;
          aliases.set(key, row);
          touch(row);
        } else {
          alias.confirmations =
            alias.senderId === sender.id ? alias.confirmations + 1 : 1;
          alias.senderId = sender.id;
          touch(alias);
        }
      }
      return sender;
    },

    upserts(): Upsert[] {
      const kept = <Row extends object>(rows: Map<string, Row>) =>
        [...rows.values()].filter((row) => changed.has(row));
      return [
        ...kept(senders).map((row) => ({ entity: 'sender' as const, row })),
        ...kept(accounts).map((row) => ({
          entity: 'sender_account' as const,
          row,
        })),
        ...kept(aliases).map((row) => ({
          entity: 'sender_alias' as const,
          row,
        })),
      ];
    },
  };
}

/** The lesson of a draft's sender, sure on its parcel; none for a sender still to verify. */
export function lessonOf(sender: DraftSender | null): SenderLesson | null {
  if (!sender || sender.level !== 'sure') return null;
  return {
    name: sender.name,
    id: sender.id,
    account: sender.account,
    read: sender.read ?? null,
    byAgent: sender.source === 'agent',
  };
}

/**
 * What "Terminer" teaches the dictionary (§4.8): a sender sure on a parcel
 * counts as seen once more, and the carrier account its codes carried is
 * confirmed for it, or created. A sender the agent kept or corrected also
 * teaches the OCR text of its `FROM` block (an alias), and contests an
 * account another sender owns. A sender only to verify teaches nothing: the
 * agent has not validated it. A sure sender whose row was deleted meanwhile
 * is dropped from the parcel rather than pointed at.
 */
export async function learnSenders(
  db: CourrierDatabase,
  drafts: readonly DraftParcel[],
  now: Date,
): Promise<LearnedSenders> {
  const lessons = senderLessons(db, now);
  const senderIds = new Map<string, string | null>();
  for (const draft of drafts) {
    const lesson = lessonOf(promotedSender(draft));
    if (!lesson) continue;
    const sender = await lessons.learn(lesson);
    senderIds.set(draft.id, sender?.id ?? null);
  }
  return { upserts: lessons.upserts(), senderIds };
}
