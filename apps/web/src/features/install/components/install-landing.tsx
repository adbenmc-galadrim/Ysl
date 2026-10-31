import { env } from '@repo/shared/env/web';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { LandingPage, type LandingCopy } from '@repo/ui';
import { displayHost, displayVersion } from '#/features/install/app-host';

const t = createTranslator(DEFAULT_LOCALE);

const appName = env.PUBLIC_APP_NAME;
const url = env.PUBLIC_APP_URL;
const host = displayHost(url);
const version = displayVersion(__APP_VERSION__);

const COPY: LandingCopy = {
  nav: {
    home: t('landing.nav.home', { appName }),
    journey: t('landing.nav.journey'),
    offline: t('landing.nav.offline'),
    install: t('landing.nav.install'),
    cta: t('landing.nav.cta'),
    signIn: t('landing.nav.signIn'),
  },
  hero: {
    eyebrow: t('landing.hero.eyebrow'),
    titleLead: t('landing.hero.titleLead'),
    titleTail: t('landing.hero.titleTail'),
    lineOne: t('landing.hero.lineOne'),
    lineTwo: t('landing.hero.lineTwo'),
    install: t('landing.hero.install'),
    howItWorks: t('landing.hero.howItWorks'),
    scanTitle: t('landing.hero.scanTitle'),
    scanText: t('landing.hero.scanText'),
    scanLink: t('landing.hero.scanLink'),
    scanLinkLabel: t('landing.hero.scanLinkLabel', { host }),
    computer: {
      text: t('landing.hero.computer.text'),
      link: t('landing.hero.computer.link'),
    },
    perks: [
      t('landing.hero.perk1'),
      t('landing.hero.perk2'),
      t('landing.hero.perk3'),
    ],
  },
  journey: {
    eyebrow: t('landing.journey.eyebrow'),
    title: t('landing.journey.title'),
    text: t('landing.journey.text'),
    received: {
      label: t('landing.journey.received.label'),
      title: t('landing.journey.received.title'),
      text: t('landing.journey.received.text'),
    },
    notified: {
      label: t('landing.journey.notified.label'),
      title: t('landing.journey.notified.title'),
      text: t('landing.journey.notified.text'),
    },
    handedOver: {
      label: t('landing.journey.handedOver.label'),
      title: t('landing.journey.handedOver.title'),
      text: t('landing.journey.handedOver.text'),
    },
    batch: {
      title: t('landing.journey.batch.title'),
      progress: t('landing.journey.batch.progress'),
      names: t('landing.journey.batch.names'),
    },
    notification: {
      device: t('landing.journey.notification.device'),
      sender: t('landing.journey.notification.sender'),
      time: t('landing.journey.notification.time'),
      title: t('landing.journey.notification.title'),
      body: t('landing.journey.notification.body'),
      footnote: t('landing.journey.notification.footnote'),
    },
    handover: {
      codeLabel: t('landing.journey.handover.codeLabel'),
      handedAt: t('landing.journey.handover.handedAt'),
      signature: t('landing.journey.handover.signature'),
    },
  },
  offline: {
    eyebrow: t('landing.offline.eyebrow'),
    title: t('landing.offline.title'),
    text: t('landing.offline.text'),
    chipPending: t('landing.offline.chipPending'),
    chipSynced: t('landing.offline.chipSynced'),
    queueTitle: t('landing.offline.queueTitle'),
    pending: t('landing.offline.pending'),
    queue: [
      {
        name: t('landing.offline.queue1.name'),
        meta: t('landing.offline.queue1.meta'),
      },
      {
        name: t('landing.offline.queue2.name'),
        meta: t('landing.offline.queue2.meta'),
      },
      {
        name: t('landing.offline.queue3.name'),
        meta: t('landing.offline.queue3.meta'),
      },
    ],
  },
  install: {
    eyebrow: t('landing.install.eyebrow'),
    title: t('landing.install.title'),
    text: t('landing.install.text'),
    scanTitle: t('landing.install.scanTitle'),
    scanText: t('landing.install.scanText'),
    gestures: [
      t('landing.install.gesture1'),
      t('landing.install.gesture2'),
      t('landing.install.gesture3'),
    ],
  },
  closing: {
    install: t('landing.closing.install'),
    alreadyInstalled: t('landing.closing.alreadyInstalled'),
    title: t('landing.closing.title'),
    text: t('landing.closing.text', { appName }),
    scanTitle: t('landing.closing.scanTitle'),
    scanText: t('landing.closing.scanText'),
  },
  footer: {
    service: t('landing.footer.service'),
    usage: t('landing.footer.usage'),
  },
};

export function InstallLanding({ signInHref }: { signInHref?: string }) {
  return (
    <LandingPage
      copy={COPY}
      appName={appName}
      url={url}
      host={host}
      version={version}
      signInHref={signInHref}
    />
  );
}
