import type { JournalEntry } from '@repo/contract/platform';
import type { TranslateFn } from '@repo/shared/i18n';
import type { JournalKind, JournalLine } from '@repo/ui';
import {
  counted,
  daysAgo,
  figure,
  modelName,
  monthName,
  shortDate,
  timeOf,
} from '#/features/platform/company-view';
import { initialsOf } from '#/features/settings/initials';

const KIND_OF: Record<JournalEntry['action'], JournalKind> = {
  company_created: 'creation',
  company_renamed: 'renaming',
  company_suspended: 'suspension',
  company_reactivated: 'reactivation',
  company_deleted: 'deletion',
  company_admin_invited: 'invitation',
  company_admin_invite_refused: 'invitation',
};

export function journalWhen(at: Date, now: Date, t: TranslateFn): string {
  const time = timeOf(at);
  const days = daysAgo(at, now);
  if (days === 0) return t('platform.journal.when.today', { time });
  if (days === 1) return t('platform.journal.when.yesterday', { time });
  return t('platform.journal.when.other', { date: shortDate(at), time });
}

export function journalDetailText(entry: JournalEntry, t: TranslateFn): string {
  const { detail } = entry;
  switch (entry.action) {
    case 'company_created':
      return t('platform.journal.detail.model', {
        model: modelName(detail.profileModel ?? null, t),
      });
    case 'company_renamed':
      return t('platform.journal.detail.renamed', {
        name: detail.previousName ?? '',
      });
    case 'company_deleted':
      return t('platform.journal.detail.deleted', {
        accounts: counted('accounts', detail.accounts ?? 0, t),
        departments: counted('departments', detail.departments ?? 0, t),
        parcels: t('platform.count.parcels', {
          count: figure(detail.parcels ?? 0),
        }),
      });
    case 'company_admin_invite_refused':
      return t('platform.journal.detail.refused');
    default:
      return '';
  }
}

/** One line for the record's panel: the action, and what it left. */
export function journalText(entry: JournalEntry, t: TranslateFn): string {
  const detail = journalDetailText(entry, t);
  const action = t(`platform.journal.action.${entry.action}`);
  return detail ? `${action} · ${detail}` : action;
}

export function journalLine(
  entry: JournalEntry,
  now: Date,
  t: TranslateFn,
): JournalLine {
  return {
    id: entry.id,
    when: journalWhen(entry.at, now, t),
    kind: KIND_OF[entry.action],
    action: t(`platform.journal.action.${entry.action}`),
    company: entry.companyName,
    detail: journalDetailText(entry, t),
    by: initialsOf(entry.actorName),
  };
}

/** Today, yesterday, then month by month: the phone's headings. */
export function journalDays(
  entries: JournalEntry[],
  now: Date,
  t: TranslateFn,
): { title: string; lines: JournalLine[] }[] {
  const days: { title: string; lines: JournalLine[] }[] = [];
  for (const entry of entries) {
    const ago = daysAgo(entry.at, now);
    const month = monthName(entry.at);
    const title =
      ago === 0
        ? t('platform.journal.today')
        : ago === 1
          ? t('platform.journal.yesterday')
          : month.charAt(0).toLocaleUpperCase('fr') + month.slice(1);
    const last = days.at(-1);
    if (last?.title === title) last.lines.push(journalLine(entry, now, t));
    else days.push({ title, lines: [journalLine(entry, now, t)] });
  }
  return days;
}
