import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RemiseCodePage } from '#/features/handover/components/remise-code-page';

export const Route = createFileRoute('/_authenticated/remise/code')({
  component: RemiseCodeRoute,
});

function RemiseCodeRoute() {
  const navigate = useNavigate();
  return (
    <RemiseCodePage
      onFound={(search) => void navigate({ to: '/remise/colis', search })}
      onBack={() => void navigate({ to: '/remise' })}
    />
  );
}
