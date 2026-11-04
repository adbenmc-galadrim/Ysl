import type { ScanReportError } from '@repo/contract/scan-report';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type {
  ReportOutcome,
  ReportSettled,
} from '#/features/scan-report/outbox';

const t = createTranslator(DEFAULT_LOCALE);

const OUTCOME_MESSAGE: Partial<Record<ReportOutcome, string>> = {
  sent: t('scan.report.sent'),
  unavailable: t('scan.report.unavailable'),
  lost: t('scan.report.lost'),
  'signed-out': t('scan.report.signedOut'),
};

const REFUSAL_REASON: Partial<Record<ScanReportError, string>> = {
  invalid: t('scan.report.reason.invalid'),
  too_large: t('scan.report.reason.tooLarge'),
  type: t('scan.report.reason.type'),
  suspended: t('scan.report.reason.suspended'),
};

/** What the scan screen says of one report, or nothing for a retry to come. */
export function reportMessage({ outcome, error }: ReportSettled) {
  if (outcome !== 'refused') return OUTCOME_MESSAGE[outcome];
  const reason = error && REFUSAL_REASON[error];
  return reason
    ? t('scan.report.refusedBecause', { reason })
    : t('scan.report.refused');
}
