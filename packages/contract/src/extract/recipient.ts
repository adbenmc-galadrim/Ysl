import { jaroWinkler, normalizeName } from '@repo/shared/text';
import type { Party } from '../codes';
import { CONFIDENCE } from './confidence';
import { adjust, canonical, mergeField, type Observation } from './fields';
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

/**
 * The recipient of §4.5 with the business checks of §4.3: a name read
 * twice close enough (Jaro-Winkler ≥ 0,92) is one name read by two
 * sources; a code that addresses the parcel outside 75007 costs a malus
 * and asks « réexpédition ? »; a name the directory knows earns 0,10.
 */
export const extractRecipient = (
  reads: readonly RecipientRead[],
  directory: readonly string[] = [],
): Field<string> | null => {
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
  const observations: Observation<string>[] = reads.map((read) => ({
    key: keyOf(read.name),
    value: read.name,
    source: read.source,
  }));
  let field = mergeField(observations);
  if (field === null) return null;
  const chosen = canonical(field.value);
  if (reads.some((r) => canonical(r.name) === chosen && elsewhere(r.party))) {
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
  return field;
};
