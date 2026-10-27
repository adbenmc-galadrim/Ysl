import {
  type AccountRead,
  accountKey,
  aliasKey,
  carrierKey,
  extractFields,
  type KnownAccount,
  type KnownSender,
  type KnownSenderAlias,
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

/** The senders the agent took this OCR text for before (§4.8, `sender_alias`). */
export async function knownSenderAliases(
  db: CourrierDatabase,
  ocrName: string,
): Promise<KnownSenderAlias[]> {
  const key = aliasKey(ocrName);
  if (key === '') return [];
  const rows = await db.senderAlias
    .where('aliasNorm')
    .equals(key)
    .filter((row) => row.deletedAt === null)
    .toArray();
  const found: KnownSenderAlias[] = [];
  for (const row of rows) {
    const sender = await db.sender.get(row.senderId);
    if (!sender || sender.deletedAt !== null) continue;
    found.push({
      aliasNorm: row.aliasNorm,
      senderId: sender.id,
      name: sender.displayName,
      confirmations: row.confirmations,
    });
  }
  return found;
}

/**
 * The sender of a draft, from its codes and the OCR's `FROM` block when it
 * has landed: the codes first, then the local dictionary, then what the
 * agent's corrections taught, then the senders already seen. `null` when nothing names one.
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
  const aliases = ocrName ? await knownSenderAliases(db, ocrName) : [];
  const { sender, senderId, senderAlias } = extractFields({
    symbols: bare,
    ocr: ocrName ? { text: '', senderName: ocrName } : null,
    senders: { accounts, known, aliases },
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
    read: ocrName,
    alias: senderAlias,
  };
}
