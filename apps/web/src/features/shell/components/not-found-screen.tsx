import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, EmptyState, Screen } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';

const t = createTranslator(DEFAULT_LOCALE);

export function NotFoundScreen() {
  const navigate = useNavigate();
  return (
    <Screen>
      <EmptyState
        icon="search"
        title={t('shell.notFound.title')}
        description={t('shell.notFound.description')}
        className="mt-[129px]"
      >
        <Button
          onClick={() => void navigate({ to: '/' })}
          className="w-[201px]"
        >
          {t('shell.notFound.home')}
        </Button>
      </EmptyState>
    </Screen>
  );
}
