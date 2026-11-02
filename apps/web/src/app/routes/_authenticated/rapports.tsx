import { createFileRoute } from '@tanstack/react-router';
import { ReportsPage } from '#/features/reports/components/reports-page';
import { REPORT_PERIODS, type ReportPeriod } from '#/features/reports/figures';

export type ReportsSearch = { periode?: ReportPeriod; departement?: string };

export const Route = createFileRoute('/_authenticated/rapports')({
  validateSearch: (search: Record<string, unknown>): ReportsSearch => ({
    ...(REPORT_PERIODS.includes(search.periode as ReportPeriod) && {
      periode: search.periode as ReportPeriod,
    }),
    ...(typeof search.departement === 'string' && {
      departement: search.departement,
    }),
  }),
  component: ReportsPage,
});
