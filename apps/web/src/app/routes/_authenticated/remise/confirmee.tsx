import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { RemiseConfirmeePage } from '#/features/handover/components/remise-confirmee-page';

export const Route = createFileRoute('/_authenticated/remise/confirmee')({
  validateSearch: (search: Record<string, unknown>) => ({
    handover: typeof search.handover === 'string' ? search.handover : '',
  }),
  component: RemiseConfirmeeRoute,
});

function RemiseConfirmeeRoute() {
  const navigate = useNavigate();
  const { handover } = Route.useSearch();
  const done = useCallback(
    () => void navigate({ to: '/', replace: true }),
    [navigate],
  );
  const another = useCallback(
    () => void navigate({ to: '/remise', replace: true }),
    [navigate],
  );
  return (
    <RemiseConfirmeePage
      key={handover}
      handoverId={handover}
      onDone={done}
      onAnother={another}
    />
  );
}
