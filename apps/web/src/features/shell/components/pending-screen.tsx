import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Screen } from '@repo/ui';

const t = createTranslator(DEFAULT_LOCALE);

/** The page while a route loads: its background, and nothing to read yet. */
export function PendingScreen() {
  return (
    <Screen>
      <span className="sr-only" aria-busy="true">
        {t('shell.loading')}
      </span>
    </Screen>
  );
}
