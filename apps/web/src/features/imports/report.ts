import {
  type ImportFlag,
  isTrackingFlag,
  type V1ImportReport,
} from '@repo/contract/imports';
import type { TranslateFn } from '@repo/shared/i18n';
import type { ImportV1ScreenProps, SettingsGroup } from '@repo/ui';

export type ImportV1State =
  | { step: 'ready' }
  | { step: 'importing'; fileName: string }
  | { step: 'done'; report: V1ImportReport }
  | { step: 'failed'; message: string };

type View = Omit<ImportV1ScreenProps, 'onAction' | 'onBack'>;

const count = (n: number, one: string, many: (n: number) => string): string =>
  n === 1 ? one : many(n);

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

function reasonOf(
  flag: ImportFlag,
  row: V1ImportReport['flagged'][number],
  t: TranslateFn,
): string {
  switch (flag) {
    case 'tracking-rejected':
      return t('import.v1.flag.trackingRejected');
    case 'tracking-to-verify':
      return t('import.v1.flag.trackingToVerify');
    case 'status-unknown':
      return t('import.v1.flag.statusUnknown', { status: row.status ?? '' });
    case 'recipient-missing':
      return t('import.v1.flag.recipientMissing');
  }
}

/** "Ligne 3 · clé fausse · Éloïse Martin": where the row is and what is wrong, first. */
function flaggedLine(
  row: V1ImportReport['flagged'][number],
  t: TranslateFn,
): string {
  return [
    t('import.v1.line', { line: row.line }),
    ...row.flags.map((flag) => reasonOf(flag, row, t)),
    row.recipient,
  ]
    .filter(Boolean)
    .join(' · ');
}

function reportGroups(report: V1ImportReport, t: TranslateFn): SettingsGroup[] {
  const tracking = report.flagged.filter((row) =>
    row.flags.some(isTrackingFlag),
  );
  const others = report.flagged.filter(
    (row) => !row.flags.some(isTrackingFlag),
  );
  const groups: SettingsGroup[] = [];
  if (tracking.length) {
    groups.push({
      header: t('import.v1.group.tracking'),
      footer: t('import.v1.group.tracking.footer'),
      items: tracking.map((row) => ({
        key: `flag-${row.line}`,
        icon: 'alert',
        color: 'orange',
        label: row.tracking,
        subtitle: flaggedLine(row, t),
        value: row.carrier ?? undefined,
        chevron: false,
      })),
    });
  }
  if (others.length) {
    groups.push({
      header: t('import.v1.group.toComplete'),
      items: others.map((row) => ({
        key: `flag-${row.line}`,
        icon: 'edit',
        color: 'grey',
        label: row.tracking,
        subtitle: flaggedLine(row, t),
        value: row.carrier ?? undefined,
        chevron: false,
      })),
    });
  }
  if (report.skips.length) {
    groups.push({
      header: t('import.v1.group.skipped'),
      items: report.skips.map((row) => ({
        key: `skip-${row.line}`,
        label: t('import.v1.line', { line: row.line }),
        subtitle: capitalize(
          [row.tracking, t(`import.v1.skip.${row.reason}`)]
            .filter(Boolean)
            .join(' · '),
        ),
        chevron: false,
      })),
    });
  }
  return groups;
}

/** What the Historique v1 screen shows at each step of an import. */
export function importV1View(
  state: ImportV1State,
  online: boolean,
  t: TranslateFn,
): View {
  if (state.step === 'importing') {
    return {
      state: 'importing',
      title: t('import.v1.importing'),
      detail: state.fileName,
    };
  }
  if (!online) {
    return {
      state: 'offline',
      title: t('import.v1.offline.title'),
      detail: t('import.v1.offline.detail'),
    };
  }
  if (state.step === 'failed') {
    return {
      state: 'failed',
      title: t('import.v1.failed.title'),
      detail: state.message,
      action: t('import.v1.chooseAnother'),
    };
  }
  if (state.step === 'ready') {
    return {
      state: 'ready',
      title: t('import.v1.ready.title'),
      detail: t('import.v1.ready.detail'),
      action: t('import.v1.choose'),
    };
  }
  const { report } = state;
  const trackings = report.flagged.filter((row) =>
    row.flags.some(isTrackingFlag),
  ).length;
  const detail = [
    count(report.skipped, t('import.v1.skipped.one'), (n) =>
      t('import.v1.skipped.many', { count: n }),
    ),
    count(trackings, t('import.v1.trackings.one'), (n) =>
      t('import.v1.trackings.many', { count: n }),
    ),
    count(report.contactsCreated, t('import.v1.contacts.one'), (n) =>
      t('import.v1.contacts.many', { count: n }),
    ),
  ].join(' · ');
  return {
    state: trackings > 0 ? 'flagged' : 'done',
    title:
      report.imported === 0
        ? t('import.v1.imported.none')
        : count(report.imported, t('import.v1.imported.one'), (n) =>
            t('import.v1.imported.many', { count: n }),
          ),
    detail,
    action: t('import.v1.chooseAgain'),
    groups: reportGroups(report, t),
  };
}
