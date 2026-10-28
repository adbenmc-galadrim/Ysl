import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { RelancesScreen } from '@repo/ui';
import { useNavigate, useRouter } from '@tanstack/react-router';
import {
  describeReminder,
  dueCount,
  useReminderMails,
} from '#/features/mail/reminder-mails';

const t = createTranslator(DEFAULT_LOCALE);

/**
 * « Colis en souffrance » (F37, P5): who a reminder is due for, and who
 * both went to. « Relancer » opens Notifier on that person with the
 * reminder template; « Relancer les N » on every reminder due.
 */
export function RelancesPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const mails = useReminderMails();
  if (!mails) return null;

  const now = new Date();
  const people = mails.map((mail) => ({
    mail,
    person: describeReminder(mail, now, t),
  }));
  const due = dueCount(mails);
  const back = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: '/' });
  };

  return (
    <RelancesScreen
      intro={t('remind.intro')}
      sections={[
        {
          title: t('remind.section.due'),
          people: people
            .filter(({ mail }) => mail.due)
            .map(({ person }) => person),
        },
        {
          title: t('remind.section.late'),
          people: people
            .filter(({ mail }) => !mail.due)
            .map(({ person }) => person),
        },
      ]}
      empty={{
        title: t('remind.none.title'),
        description: t('remind.none.description'),
      }}
      onRemind={(person) => {
        const mail = people.find(
          (entry) => entry.person.id === person.id,
        )?.mail;
        if (!mail) return;
        void navigate({
          to: '/notifier',
          search: { relance: true, colis: mail.parcels[0]!.id },
        });
      }}
      remindAllLabel={
        due === 1 ? t('remind.all.one') : t('remind.all.many', { count: due })
      }
      onRemindAll={
        due > 0
          ? () => void navigate({ to: '/notifier', search: { relance: true } })
          : undefined
      }
      onBack={back}
    />
  );
}
