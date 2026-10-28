import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RemiseNomPage } from '#/features/handover/components/remise-nom-page';

export const Route = createFileRoute('/_authenticated/remise/nom')({
  component: RemiseNomRoute,
});

function RemiseNomRoute() {
  const navigate = useNavigate();
  return (
    <RemiseNomPage
      onPick={(recipient) =>
        void navigate({
          to: '/remise/colis',
          search: { ...recipient, via: 'manuel', at: Date.now() },
        })
      }
      onClose={() => void navigate({ to: '/remise' })}
    />
  );
}
