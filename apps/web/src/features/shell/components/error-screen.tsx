import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, EmptyState, Screen } from '@repo/ui';
import { useRouter } from '@tanstack/react-router';

const t = createTranslator(DEFAULT_LOCALE);

export function ErrorScreen({ reset }: { reset: () => void }) {
  const router = useRouter();
  const retry = async () => {
    await router.invalidate();
    reset();
  };
  return (
    <Screen>
      <EmptyState
        icon="alert"
        title={t('shell.error.title')}
        description={t('shell.error.description')}
        className="mt-[129px]"
      >
        <Button onClick={() => void retry()} className="w-[201px]">
          {t('shell.error.retry')}
        </Button>
      </EmptyState>
    </Screen>
  );
}
