import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { RemiseColisPage } from '#/features/handover/components/remise-colis-page';
import type { PickupRefusal } from '#/features/handover/pickup-lookup';
import type { HandoverDone } from '#/features/handover/record-handover';
import { parseRemiseColisSearch } from '#/features/handover/route';

export const Route = createFileRoute('/_authenticated/remise/colis')({
  validateSearch: parseRemiseColisSearch,
  component: RemiseColisRoute,
});

function RemiseColisRoute() {
  const navigate = useNavigate();
  const session = useSession();
  const search = Route.useSearch();
  const back = useCallback(
    () =>
      void navigate({
        // From a selection, back where it was made.
        to: search.colis
          ? '/'
          : search.via === 'manuel'
            ? '/remise/nom'
            : '/remise',
      }),
    [navigate, search.via, search.colis],
  );
  const refused = useCallback(
    (refus: PickupRefusal) =>
      void navigate({ to: '/remise', search: { refus }, replace: true }),
    [navigate],
  );
  const done = useCallback(
    ({ handoverId, signatureLost }: HandoverDone) =>
      void navigate({
        to: '/remise/confirmee',
        search: {
          handover: handoverId,
          ...(signatureLost ? { signature: 'lost' as const } : {}),
          ...(search.file ? { file: true } : {}),
        },
        replace: true,
      }),
    [navigate, search.file],
  );
  return (
    <RemiseColisPage
      key={`${search.kind}:${search.id}`}
      search={search}
      agentId={session.user.id}
      agentName={session.user.name}
      onBack={back}
      onGone={back}
      onRefused={refused}
      onDone={done}
    />
  );
}
