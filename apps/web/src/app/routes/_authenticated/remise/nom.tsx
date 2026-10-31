import { mayHandOverByName } from '@repo/contract/operating-profile';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { db } from '#/features/db/database';
import { RemiseNomPage } from '#/features/handover/components/remise-nom-page';
import {
  readOperatingProfile,
  useOperatingProfile,
} from '#/features/settings/operating-profile';
import { useWorkPath } from '#/features/shell/components/use-work-path';

export const Route = createFileRoute('/_authenticated/remise/nom')({
  // Proof required and no signature to stand in for it (D6): the QR or the code only.
  beforeLoad: async () => {
    if (!mayHandOverByName(await readOperatingProfile(db))) {
      throw redirect({ to: '/remise', replace: true });
    }
  },
  component: RemiseNomRoute,
});

function RemiseNomRoute() {
  const navigate = useNavigate();
  const workPath = useWorkPath();
  const profile = useOperatingProfile();
  return (
    <RemiseNomPage
      onPick={(recipient) =>
        void navigate({
          to: '/remise/colis',
          search: { ...recipient, via: 'manuel', at: Date.now() },
        })
      }
      // Without proof, the viewfinder would only bring the agent back here.
      onClose={() =>
        void navigate({
          to: profile?.handoverProof === 'disabled' ? workPath : '/remise',
        })
      }
    />
  );
}
