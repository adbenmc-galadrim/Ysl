import { mayHandOverByName } from '@repo/contract/operating-profile';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { RemiseScanPage } from '#/features/handover/components/remise-scan-page';
import {
  parseRemiseScanSearch,
  type RemiseColisSearch,
} from '#/features/handover/route';
import { db } from '#/features/db/database';
import {
  readOperatingProfile,
  useOperatingProfile,
} from '#/features/settings/operating-profile';
import { useWorkPath } from '#/features/shell/components/use-work-path';

export const Route = createFileRoute('/_authenticated/remise/')({
  validateSearch: parseRemiseScanSearch,
  // Proof turned off: the handover goes by the name (§3.7.9).
  beforeLoad: async () => {
    const { handoverProof } = await readOperatingProfile(db);
    if (handoverProof === 'disabled') {
      throw redirect({ to: '/remise/nom', replace: true });
    }
  },
  component: RemisePage,
});

function RemisePage() {
  const navigate = useNavigate();
  const workPath = useWorkPath();
  const { refus } = Route.useSearch();
  const profile = useOperatingProfile();
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
      onClose={() => void navigate({ to: workPath })}
      refused={refus}
      nameSearch={!profile || mayHandOverByName(profile)}
    />
  );
}
