import { env } from '@repo/shared/env/web';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, PageIntro, StatusPill } from '@repo/ui';
import { useHealthQuery } from '#/features/health/api/get-health';

const t = createTranslator(DEFAULT_LOCALE);

type Tone = 'green' | 'grey' | 'red';

function statusPill(state: 'up' | 'down' | 'unreachable' | 'checking') {
  const pills = {
    up: { icon: 'check', label: t('home.status.up'), tone: 'green' },
    down: { icon: 'alert', label: t('home.status.down'), tone: 'red' },
    unreachable: {
      icon: 'wifiOff',
      label: t('home.status.unreachable'),
      tone: 'red',
    },
    checking: {
      icon: 'refresh',
      label: t('home.status.checking'),
      tone: 'grey',
    },
  } as const satisfies Record<
    string,
    {
      icon: 'check' | 'alert' | 'wifiOff' | 'refresh';
      label: string;
      tone: Tone;
    }
  >;
  return pills[state];
}

export function HomeScreen() {
  const health = useHealthQuery();

  const apiState = health.isError
    ? 'unreachable'
    : health.data
      ? health.data.api
      : 'checking';
  const databaseState = health.isError
    ? 'unreachable'
    : health.data
      ? health.data.database
      : 'checking';

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-16">
      <PageIntro title={env.PUBLIC_APP_NAME} description={t('home.subtitle')} />
      <section
        aria-labelledby="status-heading"
        className="flex flex-col gap-4 rounded-card bg-white p-6"
      >
        <h2 id="status-heading" className="text-18 font-semibold">
          {t('home.status.heading')}
        </h2>
        <div className="flex items-center justify-between gap-4">
          <span className="text-16">{t('home.status.api')}</span>
          <StatusPill {...statusPill(apiState)} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-16">{t('home.status.database')}</span>
          <StatusPill {...statusPill(databaseState)} />
        </div>
        <Button
          variant="secondary"
          size="md"
          icon="refresh"
          disabled={health.isFetching}
          onClick={() => void health.refetch()}
        >
          {t('home.status.retry')}
        </Button>
      </section>
    </main>
  );
}
