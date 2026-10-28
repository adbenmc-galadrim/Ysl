import type { TranslateFn } from '@repo/shared/i18n';
import { normalizeName } from '@repo/shared/text';
import type { Parcel } from '@repo/ui';
import type { LocalParcel } from '#/features/db/schema';
import { addressOf, groupByRecipient } from '#/features/mail/recipients';
import type { RecipientContext } from '#/features/parcels/model';

/**
 * The ticked parcels of the home list, by id: a row scrolled out of the
 * virtual list or hidden by a filter stays ticked, and a parcel gone from
 * the list (deleted, synced away) drops out of what the actions see.
 */
export type Selection = ReadonlySet<string>;

export function toggled(
  selection: Selection,
  id: string,
  selected: boolean,
): Selection {
  const next = new Set(selection);
  if (selected) next.add(id);
  else next.delete(id);
  return next;
}

/** Every id of `ids` ticked, or every one unticked when all already were. */
export function toggledAll(
  selection: Selection,
  ids: readonly string[],
): Selection {
  const next = new Set(selection);
  if (allTicked(selection, ids)) for (const id of ids) next.delete(id);
  else for (const id of ids) next.add(id);
  return next;
}

export function allTicked(
  selection: Selection,
  ids: readonly string[],
): boolean {
  return ids.length > 0 && ids.every((id) => selection.has(id));
}

/** The ticked ids still in the list, in the list's order. */
export function tickedIn(
  selection: Selection,
  rows: readonly { id: string }[],
): string[] {
  return rows.filter((row) => selection.has(row.id)).map((row) => row.id);
}

/**
 * Whether a row answers what was typed over the selection: the name, the
 * department, the carrier or the end of the number, accents and case
 * ignored, every word found.
 */
export function matchesQuery(row: Parcel, query: string): boolean {
  const words = normalizeName(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const text = normalizeName(
    [
      row.recipient,
      row.department,
      row.carrier,
      row.last4,
      row.tracking ?? '',
      row.detail ?? '',
    ].join(' '),
  );
  return words.every((word) => text.includes(word));
}

/** Why a ticked parcel was left out of the mails: told to the agent, counted. */
export type MailSkips = { recipient: number; address: number };

/**
 * The mails a selection calls for, one per person (D12): a person with a
 * received parcel ticked gets a notice listing every ticked parcel of
 * theirs (a new code, the notified ones count as reminded); a person with
 * notified parcels only gets a reminder quoting the code they hold (F37).
 * Parcels with nobody set, or nobody to write to, are left out and
 * counted; those already handed over or returned are not the agent's ask.
 */
export function planMails(
  parcels: readonly LocalParcel[],
  context: RecipientContext,
): { notice: string[]; reminder: string[]; skipped: MailSkips } {
  const skipped: MailSkips = { recipient: 0, address: 0 };
  const open = parcels.filter(
    (parcel) =>
      !parcel.deletedAt &&
      parcel.status !== 'remis' &&
      parcel.status !== 'retourne',
  );
  const writable = open.filter((parcel) => {
    if (
      parcel.status === 'a_completer' ||
      (!parcel.personId && !parcel.contactId)
    ) {
      skipped.recipient += 1;
      return false;
    }
    if (!addressOf(parcel, context)) {
      skipped.address += 1;
      return false;
    }
    return true;
  });
  const notice: string[] = [];
  const reminder: string[] = [];
  for (const mail of groupByRecipient(writable, context, () => true)) {
    const ids = mail.parcels.map(({ id }) => id);
    if (mail.parcels.some((parcel) => parcel.status === 'recu'))
      notice.push(...ids);
    else reminder.push(...ids);
  }
  return { notice, reminder, skipped };
}

/** « 2 ignorés : 1 sans destinataire, 1 sans e-mail », or nothing. */
export function skipsLine(
  skipped: MailSkips,
  t: TranslateFn,
): string | undefined {
  const total = skipped.recipient + skipped.address;
  if (!total) return undefined;
  const reasons = [
    skipped.recipient &&
      t('selection.skipped.recipient', { count: skipped.recipient }),
    skipped.address &&
      t('selection.skipped.address', { count: skipped.address }),
  ].filter(Boolean);
  return t(total === 1 ? 'selection.skipped.one' : 'selection.skipped.many', {
    count: total,
    reasons: reasons.join(', '),
  });
}
