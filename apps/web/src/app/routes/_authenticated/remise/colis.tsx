import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { RemiseColisPage } from '#/features/handover/components/remise-colis-page';
import { parseRemiseColisSearch } from '#/features/handover/route';

export const Route = createFileRoute('/_authenticated/remise/colis')({
  validateSearch: parseRemiseColisSearch,
  component: RemiseColisRoute,
});

function RemiseColisRoute() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const back = useCallback(() => void navigate({ to: '/remise' }), [navigate]);
  return (
    <RemiseColisPage
      key={`${search.kind}:${search.id}`}
      search={search}
      onBack={back}
      onGone={back}
    />
  );
}
