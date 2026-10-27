import { jaroWinkler, normalizeName } from '@repo/shared/text';
import type { ParsedCode } from '../codes';
import type { TrackingVerdict } from '../tracking/validate';
import { CONFIDENCE } from './confidence';
import { canonical, mergeField, type Observation } from './fields';
import {
  aliasKey,
  bestAlias,
  type KnownSenderAlias,
  learnedConfidence,
} from './learning';
import type { Field, FieldSource } from './types';

/** A carrier account already tied to a sender (§4.8, `sender_account`). */
export type KnownAccount = {
  carrier: string;
  accountNumber: string;
  senderId: string;
  name: string;
  confirmations: number;
};

/** A sender already seen (§4.8, `sender`), with its frozen key. */
export type KnownSender = { id: string; name: string; nameNorm: string };

export type SenderKnowledge = {
  accounts?: readonly KnownAccount[];
  known?: readonly KnownSender[];
  /** OCR texts the agent took for a sender before (§4.8, `sender_alias`). */
  aliases?: readonly KnownSenderAlias[];
};

/** A carrier account as a code printed it, with the carrier that owns it. */
export type AccountRead = { carrier: string; accountNumber: string };

export type SenderInput = {
  /** Senders named by a structured code, with their source. */
  named: readonly { name: string; source: FieldSource }[];
  accounts: readonly AccountRead[];
  ocrName?: string | null;
  knowledge?: SenderKnowledge | null;
};

export type SenderField = {
  field: Field<string> | null;
  senderId: string | null;
  /** The field names the sender an alias learned from the agent gave. */
  alias: boolean;
};

/** Confirmations of an account before its sender is prefilled at 0,95 (§4.8). */
export const ACCOUNT_CONFIRMED = 3;

/** Jaro-Winkler from which an OCR name is taken for a known sender (§4.3). */
export const KNOWN_SENDER_SIMILARITY = 0.92;

/** The shape of `sender_account_carrier_number_idx`: no space, upper case. */
export const accountKey = (accountNumber: string) =>
  accountNumber.replace(/\s+/g, '').toUpperCase();

/** The carrier as the dictionary keys it: trimmed, lower case. */
export const carrierKey = (carrier: string) => carrier.trim().toLowerCase();

/** The carrier accounts a parsed code or a tracking verdict carries. */
export const accountsOf = (
  parsed: ParsedCode | null,
  verdict: TrackingVerdict | null,
): AccountRead[] => {
  const reads: AccountRead[] = [];
  const carrier = parsed?.carrier ?? verdict?.carrier ?? null;
  if (carrier === null) return reads;
  if (parsed?.shipperAccount) {
    reads.push({ carrier, accountNumber: parsed.shipperAccount });
  }
  if (verdict?.shipperAccount) {
    reads.push({ carrier, accountNumber: verdict.shipperAccount });
  }
  return reads;
};

const learned = (format: string, confidence: number, value: string) =>
  ({ kind: 'learned', format, confidence, value }) as const;

const bestKnown = (
  ocrName: string,
  known: readonly KnownSender[],
): { sender: KnownSender; confidence: number } | null => {
  const norm = normalizeName(ocrName);
  if (norm === '') return null;
  let best: { sender: KnownSender; score: number } | null = null;
  for (const sender of known) {
    if (sender.nameNorm === norm) {
      return { sender, confidence: CONFIDENCE.knownSender };
    }
    const score = jaroWinkler(norm, sender.nameNorm);
    if (score >= KNOWN_SENDER_SIMILARITY && (!best || score > best.score)) {
      best = { sender, score };
    }
  }
  return best
    ? { sender: best.sender, confidence: CONFIDENCE.knownSenderFuzzy }
    : null;
};

/**
 * The sender of §4.5: a structured code first, then the account dictionary
 * (0,90, 0,95 once confirmed), then the OCR block: the sender the agent
 * took that very text for (an alias, 0,30 rising to 0,90 with each
 * confirmation), else a known sender it matches, else a bare guess (0,40). A match derives
 * from the OCR text, so the two never count as independent sources.
 */
export const extractSender = ({
  named,
  accounts,
  ocrName,
  knowledge,
}: SenderInput): SenderField => {
  const observations: Observation<string>[] = [];
  const ids = new Map<string, string>();
  const remember = (name: string, senderId: string) => {
    const key = canonical(name);
    if (!ids.has(key)) ids.set(key, senderId);
  };

  for (const { name, source } of named) {
    observations.push({ key: canonical(name), value: name, source });
  }

  const dictionary = knowledge?.accounts ?? [];
  const seen = new Set<string>();
  for (const read of accounts) {
    const id = `${carrierKey(read.carrier)}:${accountKey(read.accountNumber)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const account = dictionary.find(
      (a) =>
        carrierKey(a.carrier) === carrierKey(read.carrier) &&
        accountKey(a.accountNumber) === accountKey(read.accountNumber),
    );
    if (!account) continue;
    const confidence =
      account.confirmations >= ACCOUNT_CONFIRMED
        ? CONFIDENCE.learnedAccountConfirmed
        : CONFIDENCE.learnedAccount;
    observations.push({
      key: canonical(account.name),
      value: account.name,
      source: learned(
        `account:${carrierKey(read.carrier)}`,
        confidence,
        account.name,
      ),
    });
    remember(account.name, account.senderId);
  }

  let alias: KnownSenderAlias | null = null;
  if (ocrName) {
    const key = aliasKey(ocrName);
    alias =
      key === ''
        ? null
        : bestAlias(knowledge?.aliases ?? [], (a) => a.aliasNorm === key);
    const match = alias ? null : bestKnown(ocrName, knowledge?.known ?? []);
    if (alias) {
      observations.push({
        key: canonical(alias.name),
        value: alias.name,
        source: learned(
          'alias',
          learnedConfidence(alias.confirmations),
          alias.name,
        ),
      });
      remember(alias.name, alias.senderId);
    } else if (match) {
      observations.push({
        key: canonical(match.sender.name),
        value: match.sender.name,
        source: learned('sender', match.confidence, match.sender.name),
      });
      remember(match.sender.name, match.sender.id);
    } else {
      observations.push({
        key: canonical(ocrName),
        value: ocrName,
        source: {
          kind: 'ocr',
          format: 'block',
          confidence: CONFIDENCE.unvalidated,
          value: ocrName,
        },
      });
    }
  }

  const field = mergeField(observations);
  return {
    field,
    senderId: field ? (ids.get(canonical(field.value)) ?? null) : null,
    alias:
      field !== null &&
      field.sources.some((s) => s.kind === 'learned' && s.format === 'alias'),
  };
};
