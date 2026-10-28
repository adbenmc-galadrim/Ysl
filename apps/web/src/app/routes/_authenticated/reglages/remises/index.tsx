import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { JournalRemisesPage } from '#/features/handover/components/journal-remises-page';

export const Route = createFileRoute('/_authenticated/reglages/remises/')({
  component: JournalRemisesRoute,
});

function JournalRemisesRoute() {
  const navigate = useNavigate();
  return (
    <JournalRemisesPage
      onBack={() => void navigate({ to: '/reglages' })}
      onOpen={(handoverId) =>
        void navigate({
          to: '/reglages/remises/$handoverId',
          params: { handoverId },
        })
      }
    />
  );
}
