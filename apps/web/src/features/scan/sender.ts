import {
  type AccountRead,
  accountKey,
  carrierKey,
  extractFields,
  type KnownAccount,
  type KnownSender,
} from '@repo/contract/extract';
import type {
  CourrierDatabase,
  DraftSender,
  DraftSymbol,
} from '#/features/db/schema';

/** The dictionary rows of the accounts the codes carry (§4.8, `sender_account`). */
export async function knownAccounts(
  db: CourrierDatabase,
  reads: readonly AccountRead[],
): Promise<KnownAccount[]> {
  const found: KnownAccount[] = [];
  for (const read of reads) {
    const account = await db.senderAccount
      .where('[carrier+accountNumber]')
      .equals([carrierKey(read.carrier), accountKey(read.accountNumber)])
      .filter((row) => row.deletedAt === null)
      .first();
    if (!account) continue;
    const sender = await db.sender.get(account.senderId);
    if (!sender || sender.deletedAt !== null) continue;
    found.push({
      carrier: account.carrier,
      accountNumber: account.accountNumber,
      senderId: sender.id,
      name: sender.displayName,
      confirmations: account.confirmations,
    });
  }
  return found;
}

/** Every sender already seen, for the OCR to be matched against (§4.8, `sender`). */
export async function knownSenders(
  db: CourrierDatabase,
): Promise<KnownSender[]> {
  const rows = await db.sender
    .filter((row) => row.deletedAt === null)
    .toArray();
  return rows.map((row) => ({
    id: row.id,
    name: row.displayName,
    nameNorm: row.nameNorm,
  }));
}

/**
 * The sender of a draft, from its codes and the OCR's `FROM` block when it
 * has landed: the codes first, then the local dictionary, then the senders
 * already seen. `null` when nothing names one.
 */
export async function resolveSender(
  db: CourrierDatabase,
  symbols: readonly DraftSymbol[],
  ocrName: string | null,
): Promise<DraftSender | null> {
  const bare = symbols.map(({ format, text }) => ({ format, text }));
  const probe = extractFields({ symbols: bare });
  const accounts = probe.accounts.length
    ? await knownAccounts(db, probe.accounts)
    : [];
  const known = ocrName ? await knownSenders(db) : [];
  const { sender, senderId } = extractFields({
    symbols: bare,
    ocr: ocrName ? { text: '', senderName: ocrName } : null,
    senders: { accounts, known },
  });
  if (!sender) return null;
  const source = sender.sources[0]?.kind ?? 'ocr';
  return {
    name: sender.value,
    id: senderId,
    level: sender.level,
    confidence: sender.confidence,
    source,
    account: probe.accounts[0] ?? null,
  };
}
