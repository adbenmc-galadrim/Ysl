import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { RemiseScanPage } from '#/features/handover/components/remise-scan-page';
import type { RemiseColisSearch } from '#/features/handover/route';

export const Route = createFileRoute('/_authenticated/remise/')({
  component: RemisePage,
});

function RemisePage() {
  const navigate = useNavigate();
  const onFound = useCallback(
    (search: RemiseColisSearch) =>
      void navigate({ to: '/remise/colis', search }),
    [navigate],
  );
  return (
    <RemiseScanPage
      onFound={onFound}
      onTypeCode={() => void navigate({ to: '/remise/code' })}
      onSearchName={() => void navigate({ to: '/remise/nom' })}
      onClose={() => void navigate({ to: '/' })}
    />
  );
}
