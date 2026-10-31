import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { RemiseConfirmeePage } from '#/features/handover/components/remise-confirmee-page';
import { readQueue, shiftQueue, writeQueue } from '#/features/handover/queue';
import { useWorkPath } from '#/features/shell/components/use-work-path';

const t = createTranslator(DEFAULT_LOCALE);

export const Route = createFileRoute('/_authenticated/remise/confirmee')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { handover: string; signature?: 'lost'; file?: boolean } => ({
    handover: typeof search.handover === 'string' ? search.handover : '',
    ...(search.signature === 'lost' ? { signature: 'lost' as const } : {}),
    ...(search.file === true || search.file === 'true' ? { file: true } : {}),
  }),
  component: RemiseConfirmeeRoute,
});

function RemiseConfirmeeRoute() {
  const navigate = useNavigate();
  const workPath = useWorkPath();
  const { handover, signature, file } = Route.useSearch();
  const done = useCallback(() => {
    writeQueue([]);
    void navigate({ to: workPath, replace: true });
  }, [navigate, workPath]);
  // A selection handed over person by person (F31): the next one waits.
  const queued = file ? readQueue()[0] : undefined;
  const next = queued && {
    label: t('selection.next', {
      name: queued.name,
      count: queued.parcelIds.length,
    }),
    onClick: () => {
      const head = shiftQueue();
      if (!head) return;
      void navigate({
        to: '/remise/colis',
        search: {
          kind: head.kind,
          id: head.id,
          via: 'manuel',
          at: Date.now(),
          colis: head.parcelIds,
          file: true,
        },
        replace: true,
      });
    },
  };
  // Undone under the screen: the rest of a selection still waits its turn.
  const gone = () => {
    if (next) next.onClick();
    else done();
  };
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
      onGone={gone}
      onAnother={another}
      next={next}
    />
  );
}
