import { jaroWinkler, normalizeName } from '@repo/shared/text';
import type { Party } from '../codes';
import { CONFIDENCE } from './confidence';
import { adjust, canonical, mergeField, type Observation } from './fields';
import {
  aliasKey,
  bestAlias,
  type KnownRecipientAlias,
  LEARNED,
  learnedConfidence,
} from './learning';
import type { Field, FieldSource } from './types';

/** The mailroom's address (§4.3): rue de Bellechasse, Paris 7e. */
export const MAILROOM = {
  postalCode: '75007',
  countries: ['FR', 'FRA', 'FRANCE', '250'],
} as const;

export type RecipientRead = {
  name: string;
  source: FieldSource;
  /** The party a structured code describes, with its address. */
  party?: Party;
};

const similarity = (a: string, b: string) => {
  const left = normalizeName(a);
  const right = normalizeName(b);
  return left === '' || right === '' ? 0 : jaroWinkler(left, right);
};

/** A party addressed elsewhere than the mailroom: forwarded, or misread. */
export const elsewhere = (party: Party | undefined) => {
  const postal = party?.postalCode?.replace(/\s+/g, '');
  const country = party?.country?.trim().toUpperCase();
  return (
    (postal !== undefined && postal !== '' && postal !== MAILROOM.postalCode) ||
    (country !== undefined &&
      country !== '' &&
      !(MAILROOM.countries as readonly string[]).includes(country))
  );
};

/** The card a learned alias names for the recipient field. */
export type RecipientCard = Pick<KnownRecipientAlias, 'kind' | 'id'>;

export type RecipientField = {
  field: Field<string> | null;
  card: RecipientCard | null;
};

const fromAlias = (field: Field<string>) =>
  field.sources.some((s) => s.kind === 'learned' && s.format === 'alias');

/**
 * The recipient of §4.5 with the business checks of §4.3: a name read
 * twice close enough (Jaro-Winkler ≥ 0,92) is one name read by two
 * sources; a code that addresses the parcel outside 75007 costs a malus
 * and asks « réexpédition ? »; a name the directory knows earns 0,10. A
 * printed name the agent took for a card before reads as that card, with
 * the confidence its confirmations earned (§4.8), never « sûr » alone.
 */
export const extractRecipientField = (
  reads: readonly RecipientRead[],
  directory: readonly string[] = [],
  aliases: readonly KnownRecipientAlias[] = [],
): RecipientField => {
  const keys: { key: string; name: string }[] = [];
  const keyOf = (name: string) => {
    const close = keys.find(
      (k) => similarity(k.name, name) >= CONFIDENCE.directorySimilarity,
    );
    if (close) return close.key;
    const key = canonical(name);
    keys.push({ key, name });
    return key;
  };
  const cards = new Map<string, RecipientCard>();
  const observations: Observation<string>[] = reads.map((read) => {
    const key = aliasKey(read.name);
    const alias =
      key === '' ? null : bestAlias(aliases, (a) => a.nameNorm === key);
    if (!alias) {
      return { key: keyOf(read.name), value: read.name, source: read.source };
    }
    const confidence = learnedConfidence(
      alias.confirmations,
      LEARNED.recipientMax,
    );
    const observed = keyOf(alias.name);
    if (!cards.has(observed)) {
      cards.set(observed, { kind: alias.kind, id: alias.id });
    }
    return {
      key: observed,
      value: alias.name,
      source: {
        kind: 'learned',
        format: 'alias',
        confidence,
        value: alias.name,
      },
    };
  });
  let field = mergeField(observations);
  if (field === null) return { field: null, card: null };
  const chosen = keyOf(field.value);
  if (
    reads.some(
      (r, at) => observations[at]!.key === chosen && elsewhere(r.party),
    )
  ) {
    field = adjust(field, -CONFIDENCE.forwardMalus, 'forward');
  }
  const value = field.value;
  if (
    directory.some(
      (name) => similarity(value, name) >= CONFIDENCE.directorySimilarity,
    )
  ) {
    field = adjust(field, CONFIDENCE.directoryBonus);
  }
  if (!fromAlias(field)) return { field, card: null };
  const capped = Math.min(field.confidence, LEARNED.recipientMax);
  return {
    field: adjust(field, capped - field.confidence),
    card: cards.get(keyOf(field.value)) ?? null,
  };
};

/** The recipient field alone, for callers with no learned names. */
export const extractRecipient = (
  reads: readonly RecipientRead[],
  directory: readonly string[] = [],
): Field<string> | null => extractRecipientField(reads, directory).field;
