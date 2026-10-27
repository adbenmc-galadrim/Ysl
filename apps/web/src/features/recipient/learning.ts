import {
  aliasKey,
  bestAlias,
  type KnownRecipientAlias,
} from '@repo/contract/extract';
import { newId } from '@repo/shared/id';
import { normalizeName } from '@repo/shared/text';
import type { Upsert } from '#/features/db/commit';
import type {
  CourrierDatabase,
  DraftParcel,
  DraftRecipient,
  LocalContact,
  LocalRecipientAlias,
} from '#/features/db/schema';
import { fullName } from '#/features/directory/people';
import { recipientInCodes } from '#/features/scan/extract';

/**
 * The names the label printed for its recipient: the one a structured code
 * gave, then the OCR's. Not a name the agent copied (« Même destinataire »):
 * the label never said it.
 */
export function printedNames(
  draft: Pick<DraftParcel, 'symbols' | 'ocrName'>,
): string[] {
  const names = [recipientInCodes(draft.symbols), draft.ocrName];
  const keys = new Set<string>();
  return names.filter((name): name is string => {
    const key = name ? aliasKey(name) : '';
    if (key === '' || keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

/** The card an alias points at, with its name today; none once it left the directory. */
async function cardOf(
  db: CourrierDatabase,
  alias: LocalRecipientAlias,
): Promise<KnownRecipientAlias | null> {
  if (alias.personId) {
    const person = await db.directoryPerson.get(alias.personId);
    if (!person || !person.active || person.deletedAt) return null;
    return {
      nameNorm: alias.nameNorm,
      kind: 'person',
      id: person.id,
      name: fullName(person),
      confirmations: alias.confirmations,
    };
  }
  if (!alias.contactId) return null;
  const contact = await db.contact.get(alias.contactId);
  if (!contact || contact.deletedAt) return null;
  return {
    nameNorm: alias.nameNorm,
    kind: 'contact',
    id: contact.id,
    name: contact.name,
    confirmations: alias.confirmations,
  };
}

/**
 * The card the agent chose before for a name this label prints (§4.8,
 * `recipient_alias`): the most confirmed one, among those still listed.
 */
export async function learnedRecipientOf(
  db: CourrierDatabase,
  draft: Pick<DraftParcel, 'symbols' | 'ocrName'>,
): Promise<KnownRecipientAlias | null> {
  const found: KnownRecipientAlias[] = [];
  for (const name of printedNames(draft)) {
    const rows = await db.recipientAlias
      .where('nameNorm')
      .equals(aliasKey(name))
      .filter((row) => row.deletedAt === null)
      .toArray();
    for (const row of rows) {
      const card = await cardOf(db, row);
      if (card) found.push(card);
    }
  }
  return bestAlias(found, () => true);
}

const sameCard = (
  alias: LocalRecipientAlias,
  card: Pick<DraftRecipient, 'kind' | 'id'>,
) =>
  card.kind === 'person'
    ? alias.personId === card.id
    : alias.contactId === card.id;

/**
 * What the parcels of one write teach about their recipients (§4.8), pooled
 * so that two parcels of a batch count on the same rows: each name the
 * label printed is taken for the card the agent chose, once more when it
 * already was, from scratch when it pointed elsewhere. A name that already
 * spells the card teaches nothing: the directory finds it as it is. Rows
 * two iPhones learned apart for one name are folded into the most
 * confirmed one (their confirmations added when they agree), the others
 * deleted: a correction then holds on every iPhone.
 */
export function recipientLessons(db: CourrierDatabase, now: Date) {
  const aliases = new Map<string, LocalRecipientAlias>();
  /** Rows two iPhones learned apart for one name, folded into the best one. */
  const retired: LocalRecipientAlias[] = [];

  const aliasFor = async (key: string) => {
    const pooled = aliases.get(key);
    if (pooled) return pooled;
    const rows = await db.recipientAlias
      .where('nameNorm')
      .equals(key)
      .filter((row) => row.deletedAt === null)
      .toArray();
    const best = bestAlias(rows, () => true);
    if (!best) return null;
    for (const other of rows) {
      if (other === best) continue;
      if (
        other.personId === best.personId &&
        other.contactId === best.contactId
      ) {
        best.confirmations += other.confirmations;
      }
      retired.push({ ...other, deletedAt: now, updatedAt: now });
    }
    return best;
  };

  return {
    async learn(
      names: readonly string[],
      card: Pick<DraftRecipient, 'kind' | 'id' | 'name'>,
    ): Promise<void> {
      const spelled = normalizeName(card.name);
      for (const name of names) {
        const key = aliasKey(name);
        if (key === '' || key === spelled) continue;
        const known = await aliasFor(key);
        const row: LocalRecipientAlias = known ?? {
          id: newId(),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          nameNorm: key,
          personId: null,
          contactId: null,
          confirmations: 1,
        };
        row.confirmations =
          known && sameCard(known, card) ? known.confirmations + 1 : 1;
        row.personId = card.kind === 'person' ? card.id : null;
        row.contactId = card.kind === 'contact' ? card.id : null;
        row.updatedAt = now;
        aliases.set(key, row);
      }
    },

    upserts(): Upsert[] {
      return [...aliases.values(), ...retired].map((row) => ({
        entity: 'recipient_alias' as const,
        row,
      }));
    },
  };
}

/**
 * What "Terminer" teaches about recipients: the card the agent chose for
 * the names each label printed (a card a code settled alone teaches
 * nothing new), and each contact addressed counted as used, which keeps it
 * from the 12-month purge (§9.2). The contacts first: the aliases may
 * point at them.
 */
export async function learnRecipients(
  db: CourrierDatabase,
  drafts: readonly DraftParcel[],
  now: Date,
): Promise<Upsert[]> {
  const lessons = recipientLessons(db, now);
  const contacts = new Map<string, LocalContact>();
  for (const draft of drafts) {
    const recipient = draft.recipient;
    if (!recipient) continue;
    if (recipient.kind === 'contact') {
      const contact =
        contacts.get(recipient.id) ?? (await db.contact.get(recipient.id));
      if (contact && !contact.deletedAt) {
        contacts.set(contact.id, {
          ...contact,
          usageCount: contact.usageCount + 1,
          lastUsedAt: now,
          updatedAt: now,
        });
      }
    }
    if (recipient.source === 'agent') {
      await lessons.learn(printedNames(draft), recipient);
    }
  }
  return [
    ...[...contacts.values()].map((row) => ({
      entity: 'contact' as const,
      row,
    })),
    ...lessons.upserts(),
  ];
}
