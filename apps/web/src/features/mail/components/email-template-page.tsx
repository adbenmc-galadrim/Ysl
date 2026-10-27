import {
  MAIL_VARIABLES,
  mailValues,
  renderMail,
  SAMPLE_MAIL,
  TEMPLATE_BODY_MAX,
  TEMPLATE_NAME_MAX,
  TEMPLATE_SUBJECT_MAX,
  type TemplateText,
} from '@repo/contract/mail';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, EmailTemplateScreen, Sheet } from '@repo/ui';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import { MailFallback } from '#/features/mail/components/mail-fallback';
import { needsFallback } from '#/features/mail/fallback';
import { useMailTarget } from '#/features/mail/mail-target';
import { MAILERS } from '#/features/mail/mailer';
import {
  deleteTemplate,
  duplicateTemplate,
  getTemplate,
  isPreset,
  restoreDefault,
  saveTemplate,
  type EmailTemplateView,
} from '#/features/mail/templates';
import { templateWarnings } from '#/features/mail/warnings';
import { readPickup } from '#/features/settings/pickup';

const t = createTranslator(DEFAULT_LOCALE);

const VARIABLES = MAIL_VARIABLES.map((name) => ({
  name,
  hint: t(`mail.variable.${name}`),
}));

const same = (a: TemplateText, b: TemplateText) =>
  a.name === b.name && a.subject === b.subject && a.body === b.body;

/**
 * One template, edited in place and saved on leaving, by OK or back, as
 * Lieu et horaires does. The preview renders it on the sample parcel with
 * this mailroom's pickup, and "M'envoyer un essai" opens it in the mail
 * app chosen in Réglages, addressed to the agent: the Mailer, tried
 * without any parcel, with its fallback when the app stays shut.
 */
export function EmailTemplatePage({ templateId }: { templateId: string }) {
  const navigate = useNavigate();
  const session = useSession();
  const userId = session.user.id;
  const template = useLiveQuery(
    async () => (await getTemplate(db, userId, templateId)) ?? null,
    [userId, templateId],
  );
  const pickup = useLiveQuery(() => readPickup(db), []);
  const [draft, setDraft] = useState<TemplateText | null>(null);
  const [confirm, setConfirm] = useState<'delete' | 'restore' | null>(null);
  const [failed, setFailed] = useState(false);
  const mailTarget = useMailTarget();
  const [stayed, setStayed] = useState(false);
  const busy = useRef(false);

  if (template === null)
    return <Navigate to="/reglages/modeles-email" replace />;
  if (!template || !pickup) return null;

  const value: TemplateText = draft ?? template;
  const options = { userId };
  const rendered = renderMail(
    value,
    mailValues({
      ...SAMPLE_MAIL,
      pickup,
      agent: session.user.name,
      replyTo: session.user.email,
    }),
  );
  const trial = session.user.email
    ? {
        to: [session.user.email],
        subject: rendered.subject,
        body: rendered.body,
      }
    : undefined;
  const prepared = trial && MAILERS[mailTarget].prepare(trial);

  const edit = (change: Partial<TemplateText>) =>
    setDraft({ ...value, ...change });

  const named = (text: TemplateText): TemplateText => ({
    ...text,
    name: text.name.trim() || template.name || t('mail.template.untitled'),
  });

  const run = async (
    action: () => Promise<unknown>,
    then: () => Promise<unknown> | void,
  ) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await action();
    } catch {
      busy.current = false;
      setFailed(true);
      return;
    }
    busy.current = false;
    setFailed(false);
    await then();
  };

  const save = async (): Promise<EmailTemplateView> => {
    const text = named(value);
    return same(text, template) && template.stored
      ? template
      : saveTemplate(db, template, text, options);
  };

  const leave = () =>
    void run(
      () => (draft ? save() : Promise.resolve()),
      () => navigate({ to: '/reglages/modeles-email' }),
    );

  const sheet =
    confirm &&
    (confirm === 'delete' ? (
      <Sheet
        fixed
        title={t('mail.template.delete.title')}
        description={t('mail.template.delete.description')}
        className="pb-[calc(var(--safe-bottom)+16px)]"
        onDismiss={() => setConfirm(null)}
      >
        <Button
          variant="destructive"
          block
          className="mt-6"
          onClick={() =>
            void run(
              () => deleteTemplate(db, template),
              () => navigate({ to: '/reglages/modeles-email', replace: true }),
            )
          }
        >
          {t('mail.template.delete.confirm')}
        </Button>
        <Button
          variant="secondary"
          block
          className="mt-3"
          onClick={() => setConfirm(null)}
        >
          {t('record.cancel')}
        </Button>
      </Sheet>
    ) : (
      <Sheet
        fixed
        title={t('mail.template.restore.title')}
        description={t('mail.template.restore.description')}
        className="pb-[calc(var(--safe-bottom)+16px)]"
        onDismiss={() => setConfirm(null)}
      >
        <Button
          block
          className="mt-6"
          onClick={() =>
            void run(
              () => restoreDefault(db, template, options),
              () => {
                setDraft(null);
                setConfirm(null);
              },
            )
          }
        >
          {t('mail.template.restore.confirm')}
        </Button>
        <Button
          variant="secondary"
          block
          className="mt-3"
          onClick={() => setConfirm(null)}
        >
          {t('record.cancel')}
        </Button>
      </Sheet>
    ));

  return (
    <>
      <EmailTemplateScreen
        name={value.name}
        subject={value.subject}
        body={value.body}
        onNameChange={(name) => edit({ name })}
        onSubjectChange={(subject) => edit({ subject })}
        onBodyChange={(body) => edit({ body })}
        variables={VARIABLES}
        warnings={templateWarnings(rendered, t)}
        preview={rendered}
        previewNote={t('mail.template.previewNote')}
        tryHref={prepared?.url}
        onTry={
          prepared &&
          (() =>
            void MAILERS[mailTarget]
              .open(prepared)
              .then((outcome) => setStayed(needsFallback(outcome))))
        }
        onDuplicate={() =>
          void run(
            async () => {
              const current = await save();
              const copy = await duplicateTemplate(
                db,
                current,
                t('mail.template.copyName', { name: current.name }),
                options,
              );
              setDraft(null);
              await navigate({
                to: '/reglages/modeles-email/$templateId',
                params: { templateId: copy.id },
                replace: true,
              });
            },
            () => {},
          )
        }
        onRestore={
          template.isDefault && !(isPreset(template) && !draft)
            ? () => setConfirm('restore')
            : undefined
        }
        onDelete={template.isDefault ? undefined : () => setConfirm('delete')}
        error={failed ? t('mail.template.saveFailed') : undefined}
        nameMaxLength={TEMPLATE_NAME_MAX}
        subjectMaxLength={TEMPLATE_SUBJECT_MAX}
        bodyMaxLength={TEMPLATE_BODY_MAX}
        onBack={leave}
        onDone={leave}
      />
      {sheet}
      {stayed && trial && !sheet && (
        <MailFallback
          message={trial}
          target={mailTarget}
          onOpened={() => setStayed(false)}
          onClose={() => setStayed(false)}
        />
      )}
    </>
  );
}
