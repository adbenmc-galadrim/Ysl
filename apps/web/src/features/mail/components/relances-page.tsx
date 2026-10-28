import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { RelancesScreen } from '@repo/ui';
import { useNavigate, useRouter } from '@tanstack/react-router';
import {
  dueCount,
  reminderSections,
  useReminderMails,
} from '#/features/mail/reminder-mails';

const t = createTranslator(DEFAULT_LOCALE);

/**
 * « Colis en souffrance » (F37, P5): who a reminder is due for, and who
 * both went to. « Relancer » opens Notifier on that person with the
 * reminder template; « Relancer les N » on every reminder due. Those
 * without an address are apart (F25): « Prévenir » opens the ways to tell
 * them, never part of « Relancer les N ».
 */
export function RelancesPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const mails = useReminderMails();
  if (!mails) return null;

  const sections = reminderSections(mails, new Date(), t);
  const people = sections.flatMap((section) => section.people);
  const due = dueCount(mails.filter((mail) => mail.address));
  const back = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: '/' });
  };

  return (
    <RelancesScreen
      intro={t('remind.intro')}
      sections={sections.map(({ people: listed, ...section }) => ({
        ...section,
        people: listed.map(({ person }) => person),
      }))}
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
          search: {
            relance: true,
            colis: mail.parcels[0]!.id,
            ...(mail.address ? {} : { prevenir: true }),
          },
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
