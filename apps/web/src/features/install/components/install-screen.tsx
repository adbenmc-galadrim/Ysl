import { env } from '@repo/shared/env/web';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { PageIntro, Screen, StepCard, type StepCardProps } from '@repo/ui';

const t = createTranslator(DEFAULT_LOCALE);

const STEPS: StepCardProps[] = [
  {
    icon: 'share',
    title: t('install.step.share'),
    hint: t('install.step.shareHint'),
  },
  {
    icon: 'plusSquare',
    title: t('install.step.add'),
    hint: t('install.step.addHint'),
  },
  {
    icon: 'package',
    title: t('install.step.open', { appName: env.PUBLIC_APP_NAME }),
    hint: t('install.step.openHint'),
  },
];

export function InstallScreen() {
  return (
    <Screen>
      <PageIntro
        title={t('install.title')}
        description={t('install.description')}
        className="mt-7"
      />
      <ol className="mt-[55px] flex flex-col gap-3">
        {STEPS.map((step) => (
          <li key={step.icon}>
            <StepCard {...step} />
          </li>
        ))}
      </ol>
    </Screen>
  );
}
