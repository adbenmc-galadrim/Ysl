import { createFileRoute } from '@tanstack/react-router';
import { ColisPage } from '#/features/parcels/components/colis-page';

export const Route = createFileRoute('/_authenticated/colis/')({
  validateSearch: (search: Record<string, unknown>): { departement?: string } =>
    typeof search.departement === 'string'
      ? { departement: search.departement }
      : {},
  component: ColisPage,
});
