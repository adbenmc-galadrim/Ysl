import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { RemiseConfirmeePage } from '#/features/handover/components/remise-confirmee-page';

export const Route = createFileRoute('/_authenticated/remise/confirmee')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { handover: string; signature?: 'lost' } => ({
    handover: typeof search.handover === 'string' ? search.handover : '',
    ...(search.signature === 'lost' ? { signature: 'lost' as const } : {}),
  }),
  component: RemiseConfirmeeRoute,
});

function RemiseConfirmeeRoute() {
  const navigate = useNavigate();
  const { handover, signature } = Route.useSearch();
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
      signatureLost={signature === 'lost'}
      onDone={done}
      onAnother={another}
    />
  );
}
