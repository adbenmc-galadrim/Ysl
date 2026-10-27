import { MAIL_TARGETS, type MailTarget } from '@repo/contract/mail';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { MailAppScreen, type MailAppTest } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import {
  isMailTarget,
  setMailTarget,
  useMailTarget,
} from '#/features/mail/mail-target';
import { notOpenedHint } from '#/features/mail/fallback';
import { MAILERS } from '#/features/mail/mailer';

const t = createTranslator(DEFAULT_LOCALE);

const OPTIONS = MAIL_TARGETS.map((target) => ({
  value: target,
  title: t(`mail.target.${target}`),
  subtitle:
    target === 'mailto'
      ? t('settings.mailApp.mailto')
      : t('settings.mailApp.other'),
}));

const EMPTY = { to: [], subject: '', body: '' };

/**
 * Réglages › E-mails › Messagerie: the app "Envoyer" opens on this iPhone,
 * and "Tester", an empty draft in it, to find out before a real mail.
 */
export function MailAppPage() {
  const navigate = useNavigate();
  const target = useMailTarget();
  const [result, setResult] = useState<MailAppTest>();
  const attempt = useRef(0);
  const prepared = MAILERS[target].prepare(EMPTY);

  const choose = (value: string) => {
    if (!isMailTarget(value) || value === target) return;
    setMailTarget(value);
    attempt.current += 1;
    setResult(undefined);
  };

  const test = () => {
    const tried: MailTarget = target;
    const app = t(`mail.target.${tried}`);
    const current = ++attempt.current;
    setResult(undefined);
    void MAILERS[tried].open(prepared).then((outcome) => {
      if (current !== attempt.current) return;
      setResult(
        outcome === 'opened'
          ? {
              tone: 'green',
              title: t('settings.mailApp.opened', { app }),
              description: t('settings.mailApp.opened.description'),
            }
          : {
              tone: 'orange',
              title: t('settings.mailApp.stayed', { app }),
              description: notOpenedHint(tried, t),
            },
      );
    });
  };

  return (
    <MailAppScreen
      options={OPTIONS}
      value={target}
      onChange={choose}
      footer={t('settings.mailApp.footer')}
      testHref={prepared.url}
      onTest={test}
      result={result}
      onBack={() => void navigate({ to: '/reglages' })}
    />
  );
}
