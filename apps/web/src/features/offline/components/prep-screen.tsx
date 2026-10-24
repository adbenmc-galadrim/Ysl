import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Banner, Button, OfflinePrepScreen } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { formatBytes } from '#/features/db/storage';
import { resumeDownload } from '#/features/offline/prep';
import { markPrepared } from '#/features/offline/prepared';
import { useOfflinePrep } from '#/features/offline/use-offline-prep';

const t = createTranslator(DEFAULT_LOCALE);

/**
 * First launch after sign-in: the three packs with their bars. Nothing
 * restarts on its own once a download stopped; the agent resumes it, or
 * starts typing the parcels and lets it finish later.
 */
export function PrepScreen() {
  const navigate = useNavigate();
  const { downloads, allDone, paused, remainingBytes } = useOfflinePrep();

  const start = () => {
    markPrepared(localStorage);
    void navigate({ to: '/' });
  };

  if (paused) {
    return (
      <OfflinePrepScreen
        description={t('prep.description.paused')}
        downloads={downloads}
        notice={
          <Banner
            tone="blue"
            icon="info"
            title={t('prep.notice.paused.title')}
            description={t('prep.notice.paused.text')}
            classNames={{ root: 'pb-5' }}
          />
        }
        actions={[
          <Button
            key="resume"
            variant="secondary"
            block
            onClick={() => void resumeDownload()}
          >
            {remainingBytes === null
              ? t('prep.resume.unknown')
              : t('prep.resume', { size: formatBytes(remainingBytes) })}
          </Button>,
          <Button key="manual" block onClick={start}>
            {t('prep.manual')}
          </Button>,
        ]}
      />
    );
  }

  return (
    <OfflinePrepScreen
      description={t('prep.description')}
      downloads={downloads}
      notice={
        <Banner
          tone="blue"
          size="lg"
          icon="info"
          title={t('prep.notice.running')}
          classNames={{
            root: 'pb-5',
            icon: 'text-blue',
            title: 'text-14 leading-[1.4] font-normal',
          }}
        />
      }
      actions={[
        <Button
          key="continue"
          variant={allDone ? 'primary' : 'inactive'}
          block
          disabled={!allDone}
          onClick={start}
        >
          {t('prep.continue')}
        </Button>,
      ]}
    />
  );
}
