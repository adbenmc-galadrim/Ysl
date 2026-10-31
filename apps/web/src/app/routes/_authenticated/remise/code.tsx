import { mayHandOverByName } from '@repo/contract/operating-profile';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { db } from '#/features/db/database';
import { RemiseCodePage } from '#/features/handover/components/remise-code-page';
import {
  readOperatingProfile,
  useOperatingProfile,
} from '#/features/settings/operating-profile';

export const Route = createFileRoute('/_authenticated/remise/code')({
  beforeLoad: async () => {
    const { handoverProof } = await readOperatingProfile(db);
    if (handoverProof === 'disabled') {
      throw redirect({ to: '/remise/nom', replace: true });
    }
  },
  component: RemiseCodeRoute,
});

function RemiseCodeRoute() {
  const navigate = useNavigate();
  const profile = useOperatingProfile();
  return (
    <RemiseCodePage
      onFound={(search) => void navigate({ to: '/remise/colis', search })}
      onBack={() => void navigate({ to: '/remise' })}
      onSearchName={
        !profile || mayHandOverByName(profile)
          ? () => void navigate({ to: '/remise/nom' })
          : undefined
      }
    />
  );
}
