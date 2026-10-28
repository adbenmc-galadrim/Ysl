import { createFileRoute } from '@tanstack/react-router';
import { ExportScreen } from '#/features/exports/components/export-screen';

export const Route = createFileRoute('/_authenticated/reglages/export')({
  validateSearch: (search: Record<string, unknown>): { colis?: string[] } =>
    Array.isArray(search.colis)
      ? {
          colis: search.colis.filter(
            (id): id is string => typeof id === 'string',
          ),
        }
      : {},
  component: ExportRoute,
});

function ExportRoute() {
  const { colis } = Route.useSearch();
  return <ExportScreen parcelIds={colis} />;
}
