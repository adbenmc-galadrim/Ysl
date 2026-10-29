import { createFileRoute } from '@tanstack/react-router';
import { ExportScreen } from '#/features/exports/components/export-screen';
import { searchIds } from '#/lib/search-ids';

export const Route = createFileRoute('/_authenticated/reglages/export')({
  validateSearch: (search: Record<string, unknown>): { colis?: string[] } => {
    const colis = searchIds(search.colis);
    return colis ? { colis } : {};
  },
  component: ExportRoute,
});

function ExportRoute() {
  const { colis } = Route.useSearch();
  return <ExportScreen parcelIds={colis} />;
}
