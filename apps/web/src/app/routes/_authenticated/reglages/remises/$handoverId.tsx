import {
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { useCallback } from 'react';
import { RemiseDetailPage } from '#/features/handover/components/journal-remises-page';

export const Route = createFileRoute(
  '/_authenticated/reglages/remises/$handoverId',
)({
  component: RemiseDetailRoute,
});

function RemiseDetailRoute() {
  const { handoverId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const back = useCallback(() => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: '/reglages/remises' });
  }, [navigate, router]);
  return (
    <RemiseDetailPage
      key={handoverId}
      handoverId={handoverId}
      onBack={back}
      onParcel={(parcelId) =>
        void navigate({ to: '/colis/$parcelId', params: { parcelId } })
      }
    />
  );
}
