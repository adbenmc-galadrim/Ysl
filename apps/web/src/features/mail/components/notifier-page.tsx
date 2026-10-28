import {
  renderMail,
  type MailMessage,
  type MailTarget,
  type NotifyChange,
} from '@repo/contract/mail';
import { newPickupToken } from '@repo/contract/pickup';
import type { PickupSetting } from '@repo/contract/settings';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Button,
  EmptyState,
  FixAddressSheet,
  MailSentSheet,
  NavBar,
  NotifierScreen,
  Screen,
  Sheet,
  type NotifierMailState,
} from '@repo/ui';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import { useAddressEntry } from '#/features/mail/use-address-entry';
import {
  cardOf,
  fixAddress,
  type AddressCard,
} from '#/features/mail/fix-address';
import { MailFallback } from '#/features/mail/components/mail-fallback';
import {
  canShareFiles,
  needsFallback,
  shareMailWithFiles,
} from '#/features/mail/fallback';
import { useMailTarget } from '#/features/mail/mail-target';
import { MAILERS } from '#/features/mail/mailer';
import {
  drawSecrets,
  pickupToWrite,
  recallSecrets,
  type PickupSecret,
} from '#/features/mail/pickup-code';
import { pickupQrFile } from '#/features/mail/pickup-qr';
import {
  mailsAbout,
  mailsOfBatch,
  recipientValues,
  type RecipientMail,
} from '#/features/mail/recipients';
import {
  listTemplates,
  type EmailTemplateView,
} from '#/features/mail/templates';
import { loadPendingMails } from '#/features/mail/pending-mails';
import { loadReminderMails } from '#/features/mail/reminder-mails';
import { pageAfter, pickTemplate } from '#/features/mail/round';
import { useNotifications } from '#/features/mail/use-notifications';
import { whenVisible } from '#/features/mail/visibility';
import { templateWarnings } from '#/features/mail/warnings';
import { initialsOf } from '#/features/settings/initials';
import { readPickup } from '#/features/settings/pickup';

const t = createTranslator(DEFAULT_LOCALE);

/**
 * Every mail to send, one recipient's (from a record), or one batch's.
 * `reminder`: the reminders due instead of the notices (F37), or one
 * recipient's with `parcelId`.
 */
export type NotifierScope = {
  parcelId?: string;
  batchId?: string;
  reminder?: boolean;
};

type Session = {
  mails: RecipientMail[];
  secrets: PickupSecret[];
  templates: EmailTemplateView[];
  pickup: PickupSetting;
  now: Date;
};

/**
 * The mails as they stood when the screen opened: a mail confirmed makes
 * its parcels "Notifié", and a live list would drop the page under the
 * agent's thumb.
 */
async function openSession(
  userId: string,
  { parcelId, batchId, reminder }: NotifierScope,
): Promise<Session> {
  const now = new Date();
  if (reminder) {
    const all = await loadReminderMails(db, now);
    const mails = parcelId
      ? mailsAbout(all, parcelId)
      : all.filter((mail) => mail.due);
    const [secrets, templates, pickup] = await Promise.all([
      recallSecrets(db, mails, { now }),
      listTemplates(db, userId),
      readPickup(db),
    ]);
    return {
      mails,
      secrets,
      templates: templates.filter((template) => template.type === 'relance'),
      pickup,
      now,
    };
  }
  const all = await loadPendingMails(db);
  const mails = parcelId
    ? mailsAbout(all, parcelId)
    : batchId
      ? mailsOfBatch(all, batchId)
      : all;
  const [secrets, templates, pickup] = await Promise.all([
    drawSecrets(db, mails.length, { now }),
    listTemplates(db, userId),
    readPickup(db),
  ]);
  return {
    mails,
    secrets,
    templates: templates.filter((template) => template.type === 'avis'),
    pickup,
    now,
  };
}

/**
 * A recipient without an address (D-zone « Destinataire sans e-mail »):
 * the agent types it, on the card by default so the next parcel has it,
 * and the page then offers to send.
 */
function AddAddressSheet({
  mail,
  onAdded,
  onDismiss,
}: {
  mail: RecipientMail;
  onAdded: (address: string) => void;
  onDismiss: () => void;
}) {
  const userId = useSession().user.id;
  const [card, setCard] = useState<AddressCard | null>(null);
  const [failed, setFailed] = useState(false);
  const entry = useAddressEntry(card, '');
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    void cardOf(db, mail).then((next) => {
      if (live) setCard(next);
    });
    return () => {
      live = false;
    };
  }, [mail]);

  const save = async () => {
    const { address, onCard } = entry;
    if (!card || !address || busy.current) return;
    busy.current = true;
    setFailed(false);
    try {
      await fixAddress(
        db,
        {
          card,
          parcelIds: mail.parcels.map(({ id }) => id),
          address,
          onCard,
        },
        { agentId: userId },
      );
      onAdded(address);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  };

  return (
    <FixAddressSheet
      fixed
      recipient={mail.name}
      title={t('mails.fix.add')}
      description={t('mails.fix.missing', { name: mail.name })}
      {...entry.fields(failed)}
      resendLabel={t('mails.fix.save')}
      onResend={() => void save()}
      onDismiss={onDismiss}
    />
  );
}

type Sent = { state: NotifierMailState; count?: number; reason?: string };

/**
 * One mail per recipient of the "À notifier" parcels (F34), of one
 * parcel's recipient when opened from its record, or of the recipients of
 * a batch just saved (« Lot enregistré »). Each "Envoyer" opens the
 * mail app chosen in Réglages on a real link (S5); the agent then says
 * whether it left, and only a "yes" notifies the parcels (D2, declarative
 * follow-up). When the page stays in front, the fallback sheet offers the
 * other apps, the text to copy or share, and how it ended.
 */
export function NotifierPage({ parcelId, batchId, reminder }: NotifierScope) {
  const navigate = useNavigate();
  const router = useRouter();
  const session = useSession();
  const userId = session.user.id;
  const outbox = useNotifications();
  const [opened, setOpened] = useState<Session | null>(null);
  const [index, setIndex] = useState(0);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState<{ key: string; id: string } | null>(
    null,
  );
  const [done, setDone] = useState<Record<string, Sent>>({});
  const [failed, setFailed] = useState(false);
  const chosenTarget = useMailTarget();
  // The app that opened on a retry carries the rest of the round: the chosen
  // one just failed, and every next mail would fall back again.
  const [roundTarget, setRoundTarget] = useState<MailTarget | null>(null);
  const mailTarget = roundTarget ?? chosenTarget;
  const [stayed, setStayed] = useState<{
    key: string;
    id: string;
    message: MailMessage;
    target: MailTarget;
  } | null>(null);
  const busy = useRef(false);
  // The page's QR, drawn before the tap: the share sheet opens only from
  // the tap itself, with nothing awaited before it.
  const [qr, setQr] = useState<{ token: string; file: File } | null>(null);
  const token = opened?.secrets[index]?.token;

  useEffect(() => {
    let live = true;
    void openSession(userId, { parcelId, batchId, reminder }).then((value) => {
      if (live) setOpened(value);
    });
    return () => {
      live = false;
    };
  }, [userId, parcelId, batchId, reminder]);

  useEffect(() => {
    if (!token) return;
    let live = true;
    void pickupQrFile(token)
      .then((file) => {
        if (live && canShareFiles([file])) setQr({ token, file });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [token]);

  const back = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: '/' });
  };

  if (!opened) return null;
  const { mails, secrets, templates, pickup, now } = opened;
  const mail = mails[index];
  if (!mail) {
    return (
      <Screen tone="fill">
        <NavBar title={t('notify.title')} onBack={back} />
        <EmptyState
          icon="mail"
          title={t(reminder ? 'remind.empty.title' : 'notify.empty.title')}
          description={t(
            reminder ? 'remind.empty.description' : 'notify.empty.description',
          )}
          className="mt-[129px]"
        />
      </Screen>
    );
  }

  const template = pickTemplate(templates, templateId)!;
  const secret = secrets[index];
  const code = secret?.pin ?? null;
  const rendered = renderMail(
    template,
    recipientValues(mail, {
      pickup,
      agent: session.user.name,
      replyTo: session.user.email,
      code,
      now,
      t,
    }),
  );
  const message: MailMessage | undefined = mail.address
    ? { to: [mail.address], subject: rendered.subject, body: rendered.body }
    : undefined;
  const prepared = message && MAILERS[mailTarget].prepare(message);
  const sent = done[mail.key];
  const state: NotifierMailState = !mail.address
    ? 'missing'
    : (sent?.state ?? 'ready');
  const firstName = (mail.firstName ?? mail.name).split(/\s+/)[0] ?? '';
  const record = () =>
    void navigate({
      to: '/colis/$parcelId',
      params: { parcelId: mail.parcels[0]!.id },
    });
  const last = index === mails.length - 1;

  // A token is written once (`pickup_code_token_hash_idx`): a second try on
  // this page, after a "no", quotes the same PIN with a new token.
  const renewToken = () =>
    setOpened({
      ...opened,
      secrets: secrets.map((other, at) =>
        at === index ? { ...other, token: newPickupToken() } : other,
      ),
    });

  const send = (event: MouseEvent) => {
    if (!prepared || !message || !mail.address || busy.current) {
      event.preventDefault();
      return;
    }
    busy.current = true;
    setFailed(false);
    const opening = MAILERS[mailTarget].open(prepared);
    const preparing = outbox.prepare({
      type: template.type,
      personId: mail.personId,
      contactId: mail.contactId,
      recipients: [mail.address],
      parcelIds: mail.parcels.map(({ id }) => id),
      templateId: template.stored ? template.id : null,
      target: mailTarget,
      pickup: pickupToWrite(secret, { withQr: false }),
    });
    renewToken();
    void (async () => {
      try {
        const row = await preparing;
        const outcome = await opening;
        if (needsFallback(outcome)) {
          setStayed({
            key: mail.key,
            id: row.id,
            message,
            target: mailTarget,
          });
          return;
        }
        await outbox.markOpened(row.id);
        await whenVisible();
        setAsking({ key: mail.key, id: row.id });
      } catch {
        setFailed(true);
      } finally {
        busy.current = false;
      }
    })();
  };

  const shareFile = qr && qr.token === secret?.token ? qr.file : null;

  // The share sheet takes the text and the QR, never the address: the agent
  // types it in the mail app (S5). The mail is recorded as for "Envoyer",
  // without a mail app; a closed sheet gives it up, as the fallback does.
  const share = () => {
    if (!message || !shareFile || !mail.address || busy.current) return;
    busy.current = true;
    setFailed(false);
    const sharing = shareMailWithFiles(message, [shareFile]);
    const preparing = outbox.prepare({
      type: template.type,
      personId: mail.personId,
      contactId: mail.contactId,
      recipients: [mail.address],
      parcelIds: mail.parcels.map(({ id }) => id),
      templateId: template.stored ? template.id : null,
      target: null,
      pickup: pickupToWrite(secret, { withQr: true }),
    });
    renewToken();
    const key = mail.key;
    void (async () => {
      try {
        const row = await preparing;
        const outcome = await sharing;
        if (outcome === 'shared') {
          await whenVisible();
          setAsking({ key, id: row.id });
          return;
        }
        await outbox.markFailed(
          row.id,
          t(
            outcome === 'cancelled'
              ? 'notify.share.reason'
              : 'notify.share.refused',
          ),
        );
        setDone((all) => ({
          ...all,
          [key]: {
            state: 'failed',
            reason:
              outcome === 'blocked'
                ? t('mail.fallback.shareBlocked')
                : outcome === 'cancelled'
                  ? t('mail.fallback.shareCancelled')
                  : t('mail.fallback.shareUnavailable'),
          },
        }));
      } catch {
        setFailed(true);
      } finally {
        busy.current = false;
      }
    })();
  };

  const confirmSent = (key: string, changes: NotifyChange[]) => {
    const count = changes.filter((change) => !('skip' in change)).length;
    setDone((all) => ({ ...all, [key]: { state: 'sent', count } }));
    setIndex(pageAfter(index, mails.length, 'sent'));
  };

  const answer = async (left: boolean) => {
    if (!asking || busy.current) return;
    busy.current = true;
    try {
      if (left) {
        const { changes } = await outbox.markSent(asking.id);
        confirmSent(asking.key, changes);
      } else {
        await outbox.markFailed(asking.id, t('notify.notSent.reason'));
        setDone((all) => ({ ...all, [asking.key]: { state: 'failed' } }));
        setIndex(pageAfter(index, mails.length, 'failed'));
      }
      setAsking(null);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  };

  const notice = failed
    ? { title: t('notify.error') }
    : state === 'missing'
      ? {
          title: t('notify.missing.title'),
          description: t('notify.missing.description'),
        }
      : state === 'sent'
        ? {
            title: t('notify.sent.title'),
            description: t(
              reminder
                ? sent?.count === 1
                  ? 'remind.sent.one'
                  : 'remind.sent.many'
                : sent?.count === 1
                  ? 'notify.sent.one'
                  : 'notify.sent.many',
              { count: sent?.count ?? 0 },
            ),
          }
        : state === 'failed'
          ? {
              title: t('notify.notSent.title'),
              description: sent?.reason ?? t('notify.notSent.description'),
            }
          : undefined;

  return (
    <NotifierScreen
      position={index + 1}
      total={mails.length}
      recipient={{
        name: mail.name,
        initials: initialsOf(mail.name),
        email: mail.address ?? undefined,
        missing: mail.address ? undefined : t('notify.missing'),
        onClick: record,
      }}
      state={state}
      template={{
        name: template.name,
        onClick: templates.length > 1 ? () => setChoosing(true) : undefined,
      }}
      onEditTemplate={() =>
        void navigate({
          to: '/reglages/modeles-email/$templateId',
          params: { templateId: template.id },
        })
      }
      preview={rendered}
      warnings={templateWarnings(rendered, t)}
      sendLabel={
        state === 'sent'
          ? t('notify.sent.title')
          : t('notify.send', { name: firstName })
      }
      sendHref={prepared?.url}
      onSend={send}
      shareLabel={t('notify.share')}
      shareHint={t('notify.share.hint')}
      onShare={shareFile && mail.address ? share : undefined}
      completeLabel={t('mails.fix.add')}
      onComplete={() => setAdding(true)}
      notice={notice}
      nextLabel={last ? t('notify.finish') : t('notify.next')}
      onNext={() => (last ? void navigate({ to: '/' }) : setIndex(index + 1))}
      onBack={back}
      sheet={
        stayed ? (
          <MailFallback
            message={stayed.message}
            target={stayed.target}
            notificationId={stayed.id}
            onOpened={(opened) => {
              setRoundTarget(opened);
              const { key, id } = stayed;
              setStayed(null);
              void whenVisible().then(() => setAsking({ key, id }));
            }}
            onSent={({ changes }) => {
              confirmSent(stayed.key, changes);
              setStayed(null);
            }}
            onAbandoned={() => {
              setDone((all) => ({
                ...all,
                [stayed.key]: { state: 'failed' },
              }));
              setIndex(pageAfter(index, mails.length, 'failed'));
              setStayed(null);
            }}
          />
        ) : asking ? (
          <MailSentSheet
            recipient={
              mails.find((other) => other.key === asking.key)?.name ?? mail.name
            }
            description={
              reminder
                ? t('remind.question', {
                    name:
                      mails.find((other) => other.key === asking.key)?.name ??
                      mail.name,
                  })
                : undefined
            }
            onSent={() => void answer(true)}
            onNotSent={() => void answer(false)}
          />
        ) : adding ? (
          <AddAddressSheet
            mail={mail}
            onAdded={(address) => {
              setOpened({
                ...opened,
                mails: mails.map((other) =>
                  other.key === mail.key ? { ...other, address } : other,
                ),
              });
              setAdding(false);
            }}
            onDismiss={() => setAdding(false)}
          />
        ) : choosing ? (
          <Sheet
            fixed
            title={t('notify.template.title')}
            className="pb-[calc(var(--safe-bottom)+16px)]"
            onDismiss={() => setChoosing(false)}
          >
            {templates.map((row, at) => (
              <Button
                key={row.id}
                variant={row.id === template.id ? 'primary' : 'secondary'}
                block
                className={at === 0 ? 'mt-6' : 'mt-3'}
                onClick={() => {
                  setTemplateId(row.id);
                  setChoosing(false);
                }}
              >
                {row.name}
              </Button>
            ))}
          </Sheet>
        ) : undefined
      }
    />
  );
}
