import { createFileRoute } from '@tanstack/react-router';
import { SettlementPage } from '#/features/deposits/components/settlement-page';

export const Route = createFileRoute(
  '/_authenticated/tableau-de-bord_/regulariser',
)({
  validateSearch: (search: Record<string, unknown>): { colis?: string } =>
    typeof search.colis === 'string' ? { colis: search.colis } : {},
  component: SettlementPage,
});
